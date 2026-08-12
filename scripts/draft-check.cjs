/* Does a refresh keep what someone has typed — and does it keep the
 * password too?
 *
 * Both halves matter. The first is the feature. The second is the line
 * it must not cross: a draft lives in sessionStorage, which is plain
 * text readable by any script on the page, so a password reaching it
 * would be a real hole shipped in the name of convenience.
 *
 * Three moments, because the draft has to behave differently at each:
 * a refresh restores it, a rejected submission keeps it, and a
 * successful one throws it away — an account's worth of personal
 * details should not sit in the browser after the account exists.
 *
 *   BASE=http://127.0.0.1:3001 node scripts/draft-check.cjs
 */
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");

/* Reserved by RFC 2606, so it can never collide with a real member —
   and `purge-fixtures` recognises the suffix if this run is killed
   before it cleans up after itself. */
const EMAIL = "draft.check@example.invalid";
const TYPED = { firstName: "Refresh", lastName: "Test", email: EMAIL };
/* The three boxes are what has to come back, so they are checked by
   name — a date that survives as "1996-04-11" tells us nothing about
   which of the three was restored. */
const BORN = "1996-04-11";
const DOB_PARTS = { dobDay: "11", dobMonth: "4", dobYear: "1996" };
const PASSWORD = "correct horse battery staple";

let bad = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`  ${ok ? "ok    " : "FAIL  "} ${label}: ${JSON.stringify(actual)}`);
  if (!ok) {
    console.log(`         expected ${JSON.stringify(expected)}`);
    bad++;
  }
}

const storage = (page) =>
  page.evaluate(() => {
    const out = {};
    for (let i = 0; i < sessionStorage.length; i++) out[sessionStorage.key(i)] = sessionStorage.getItem(sessionStorage.key(i));
    return { session: out, local: JSON.stringify(Object.entries(localStorage)) };
  });

async function fill(page) {
  /* The radio itself is sr-only — the pill label is what a person can
     actually hit, so that is what gets clicked here too. */
  await page.locator('label:has(input[name="gender"][value="sister"])').click();
  for (const [name, value] of Object.entries(TYPED)) await page.fill(`[name="${name}"]`, value);
  await fillDob(page, BORN);
  await page.fill('[name="password"]', PASSWORD);
  await page.locator('[name="marriageIntention"]').check();
  await page.locator('[name="terms"]').check();
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90_000 });
    await assertOurApp(page);

    /* ---- 1. a refresh ---- */
    await fill(page);
    await page.reload({ waitUntil: "networkidle" });

    console.log("\nafter a refresh");
    for (const [name, value] of Object.entries({ ...TYPED, ...DOB_PARTS })) {
      check(name, await page.inputValue(`[name="${name}"]`), value);
    }
    check("sister still chosen", await page.locator('[name="gender"][value="sister"]').isChecked(), true);
    check("marriage intention ticked", await page.locator('[name="marriageIntention"]').isChecked(), true);
    check("terms ticked", await page.locator('[name="terms"]').isChecked(), true);
    check("password cleared", await page.inputValue('[name="password"]'), "");

    console.log("\nwhat is in the browser's storage");
    const dump = await storage(page);
    check("no password anywhere in it", JSON.stringify(dump).includes(PASSWORD), false);
    check("localStorage untouched", dump.local, "[]");
    console.log(`  keys: ${Object.keys(dump.session).join(", ") || "(none)"}`);

    /* ---- 2. a rejected submission ---- */
    await fillDob(page, "2015-04-11");
    await page.fill('[name="password"]', PASSWORD);
    await page.locator('button[type="submit"]').click();
    /* The error element, not the words. The hint under this field also
       says "18 or older", so a text match here passes before the server
       has answered — and then everything below it measures the form as
       it was a moment ago rather than as it came back. */
    await page.waitForSelector("#dob-error", { timeout: 30_000 });

    console.log("\nafter the server rejects it");
    check("still on the form", new URL(page.url()).pathname, "/register");
    check("told why", await page.innerText("#dob-error"), "You must be 18 or older to register.");
    check("year kept", await page.inputValue('[name="dobYear"]'), "2015");
    check("month kept", await page.inputValue('[name="dobMonth"]'), "4");
    check("name kept", await page.inputValue('[name="firstName"]'), TYPED.firstName);
    check("marriage intention still ticked", await page.locator('[name="marriageIntention"]').isChecked(), true);
    check("terms still ticked", await page.locator('[name="terms"]').isChecked(), true);
    check("draft still held", Object.keys((await storage(page)).session).includes("nc.draft.register"), true);

    /* ---- 3. a successful one ---- */
    await fillDob(page, BORN);
    await page.fill('[name="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL("**/onboarding**", { timeout: 30_000 }),
      page.locator('button[type="submit"]').click(),
    ]);

    console.log("\nafter the account is created");
    /* Polled, not read once: the URL changes before React has unmounted
       the old page, and the clearing happens in that unmount. Reading
       storage the instant the address bar moves measures the moment
       before the one being tested. */
    const cleared = await page
      .waitForFunction(() => !sessionStorage.getItem("nc.draft.register"), null, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    check("draft discarded", cleared, true);
    check("nothing of it left", JSON.stringify(await storage(page)).includes(TYPED.email), false);

    /* ---- 4. the same thing, one step into the profile ---- */
    await page.locator('a[href^="/onboarding/"]').first().click();
    await page.waitForSelector("form");
    const field = page.locator('form textarea, form input[type="text"]').first();
    const answer = "Something typed and not yet saved.";
    await field.fill(answer);
    const fieldName = await field.getAttribute("name");
    await page.reload({ waitUntil: "networkidle" });

    console.log("\none step into the profile, after a refresh");
    check(`${fieldName} kept`, await page.inputValue(`[name="${fieldName}"]`), answer);
    const keys = Object.keys((await storage(page)).session);
    check("draft is scoped to this member", keys.some((k) => /^nc\.draft\.onboarding\..+\..+/.test(k)), true);
    console.log(`  keys: ${keys.join(", ") || "(none)"}`);

    /* ---- and a second tab is a second session ---- */
    const other = await browser.newPage();
    await other.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    console.log("\nin a fresh tab");
    check("email empty", await other.inputValue('[name="email"]'), "");
  } finally {
    await browser.close();
    console.log("\ncleanup");
    console.log(
      execFileSync(process.execPath, ["scripts/purge-fixtures.cjs", "--apply"], {
        encoding: "utf8",
      }).trim()
    );
  }

  console.log(bad ? `\nFAIL  ${bad} problem(s)\n` : "\ndraft persistence ok\n");
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
