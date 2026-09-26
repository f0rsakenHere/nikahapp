/* End-to-end check of the profile builder.
 *
 * Registers two throwaway accounts — one sister, one brother — walks
 * them through the steps, and checks the parts that only exist once a
 * browser and a database are both involved: that a half-filled step
 * survives leaving the page, that the gendered questions are actually
 * gendered, and that progress reflects what was answered.
 *
 * Deletes both accounts afterwards. Exits non-zero on any failure.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/profile-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const emails = [];

const findings = [];
let checks = 0;

function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

async function register(page, gender) {
  const isSister = gender.startsWith("sister");
  const email = `profileflow+${gender}${STAMP}@example.invalid`;
  emails.push(email);
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.click(`label:has(input[name="gender"][value="${isSister ? "sister" : "brother"}"])`);
  await page.fill('input[name="firstName"]', "Testonly");
  await page.fill('input[name="lastName"]', "Fixture");
  await fillDob(page, "1995-04-12");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.check('input[name="marriageIntention"]');
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  await page.waitForURL("**/onboarding", { timeout: 20_000 });
  return email;
}

const mongo = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await mongo.connect();
  const db = mongo.db(dbName);
  const browser = await chromium.launch();

  try {
    /* ---------------------------------------------------- the sister -- */
    {
      const p = await browser.newPage({ viewport: { width: 500, height: 900 } });
      await p.goto(BASE + "/register", { waitUntil: "networkidle" });
      await assertOurApp(p);

      const email = await register(p, "sister");

      const steps = await p.locator("ol li a").count();
      check("a sister sees four steps", steps === 4, `saw ${steps}`);
      /* Numbered 1-4 with nothing skipped. They used to be numbered by
         position in the full step list, which holds both slot-4 forms,
         so the last one read 5 under a 3. */
      check(
        "and they are numbered without a gap",
        (await p.evaluate(() =>
          [...document.querySelectorAll("ol li a > span:first-child")].map((s) => s.textContent.trim()).join(",")
        )) === "1,2,3,4",
        await p.evaluate(() =>
          [...document.querySelectorAll("ol li a > span:first-child")].map((s) => s.textContent.trim()).join(",")
        )
      );
      check("a sister starts at 0% — the wali step is not hers to finish", (await p.textContent("body")).includes("0%"));
      check(
        "the wali step reads as waiting on someone else",
        /Waiting on your wali/.test(await p.textContent("body"))
      );

      /* --- step 1, filled properly ---------------------------------- */
      await p.goto(BASE + "/onboarding/basics", { waitUntil: "networkidle" });
      await p.fill('input[name="basics.city"]', "Montreal");
      await p.selectOption('select[name="basics.province"]', "QC");
      await p.click('label:has(input[name="basics.citizenship"][value="refugee"])');
      await p.selectOption('select[name="basics.heightCm"]', "163");
      await p.click('button[type="submit"]');
      await p.waitForURL("**/onboarding/background", { timeout: 20_000 });
      check("saving step one moves to step two", p.url().endsWith("/onboarding/background"));

      const user = await db.collection("users").findOne({ email });
      let profile = await db.collection("profiles").findOne({ userId: user._id });
      check("the answers reached the database", profile?.basics?.city === "Montreal");
      /* Never typed on this step — it is derived from the date of birth
         given at sign-up, and the form no longer asks a second time. */
      check("the year of birth came from sign-up", profile?.basics?.birthYear === 1995);
      /* Strict: a dropdown posts a string, and centimetres stored as
         "163" would fail the profile schema the moment anything read
         it back. */
      check("height is stored as a number", profile?.basics?.heightCm === 163);
      check(
        "a citizenship a guessed list would have rejected survives",
        profile?.basics?.citizenship === "refugee"
      );
      check("progress was recomputed on save", profile?.completeness?.percent === 25, String(profile?.completeness?.percent));

      /* --- resume: the promise the marketing page makes -------------- */
      await p.goto(BASE + "/onboarding/basics", { waitUntil: "networkidle" });
      check(
        "coming back shows what was typed",
        (await p.inputValue('input[name="basics.city"]')) === "Montreal"
      );
      check(
        "the chosen radio is still chosen",
        await p.isChecked('input[name="basics.citizenship"][value="refugee"]')
      );
      check(
        "the chosen province is still chosen",
        (await p.inputValue('select[name="basics.province"]')) === "QC"
      );

      /* --- a half-filled step must still save ----------------------- */
      await p.goto(BASE + "/onboarding/background", { waitUntil: "networkidle" });
      await p.fill('input[name="background.languages"]', "English, Arabic");
      await p.click('button[type="submit"]');
      await p.waitForURL("**/onboarding/deen", { timeout: 20_000 });
      profile = await db.collection("profiles").findOne({ userId: user._id });
      check(
        "a partly-filled step is kept, not discarded",
        JSON.stringify(profile?.background?.languages) === '["English","Arabic"]'
      );
      check(
        "an unfinished step does not count towards progress",
        profile?.completeness?.percent === 25,
        String(profile?.completeness?.percent)
      );

      /* --- the deen step is gendered -------------------------------- */
      const deen = await p.textContent("body");
      check("a sister is asked about hijab", /Hijab/.test(deen));
      check("a sister is not asked about a beard", !/Beard/.test(deen));
      check("there is a way to decline every question", /Prefer not to say/.test(deen));

      /* --- a finished step returns to the overview ------------------- */
      await p.click('label:has(input[name="deen.salah"][value="fiveDaily"])');
      await p.click('label:has(input[name="deen.dress"][value="hijab"])');
      /* Submitted from the foot of a long form, which is where the
         button is. The next screen must start at its own top rather than
         at the height the last one was left at. */
      await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const leftAt = await p.evaluate(() => Math.round(window.scrollY));
      check("the step is long enough for this to matter", leftAt > 100, `scrolled to ${leftAt}`);
      await p.click('button[type="submit"]');
      /* Compared exactly rather than by glob, which would also match the
         step we are standing on and return before the save had run. */
      await p.waitForURL((u) => new URL(u).pathname !== "/onboarding/deen", { timeout: 20_000 });
      profile = await db.collection("profiles").findOne({ userId: user._id });
      check("her deen answers were stored", profile?.deen?.salah === "fiveDaily");
      await p.waitForTimeout(600);
      const landedAt = await p.evaluate(() => Math.round(window.scrollY));
      check("and the next screen starts at the top", landedAt === 0, `scrollY ${landedAt}`);
      check(
        "a finished step hands her on to the next one",
        new URL(p.url()).pathname === "/onboarding/guardian",
        p.url()
      );

      await p.close();
    }

    /* --------------------------------------------------- the brother -- */
    {
      const p = await browser.newPage({ viewport: { width: 500, height: 900 } });
      const email = await register(p, "brother");

      const steps = await p.locator("ol li a").count();
      /* Three: hers without the wali. He used to have a fourth, naming
         somebody who could vouch for him, and nobody is telephoned. */
      check("a brother sees three steps", steps === 3, `saw ${steps}`);
      check("a brother starts at 0% too", (await p.textContent("body")).includes("0%"));
      const brotherSteps = await p.textContent("body");
      check("he is not asked to name a reference", !/Your reference/.test(brotherSteps));
      check("and not a wali either", !/Your wali/.test(brotherSteps));
      check("he is told nobody will telephone him", !/telephone/i.test(brotherSteps), brotherSteps.slice(0, 200));

      await p.goto(BASE + "/onboarding/deen", { waitUntil: "networkidle" });
      const deen = await p.textContent("body");
      check("a brother is asked about his beard", /Beard/.test(deen));
      check("a brother is not asked about hijab", !/Hijab/.test(deen));

      /* The step is gone, and the URL with it. A bookmark or an open tab
         still points at it, so this is walked rather than assumed. */
      const gone = await p.goto(BASE + "/onboarding/reference", { waitUntil: "networkidle" });
      check(
        "the reference step's URL leads nowhere now",
        gone.status() === 404,
        String(gone.status())
      );

      const brother = await db.collection("users").findOne({ email });
      const bProfile = await db.collection("profiles").findOne({ userId: brother._id });
      check("and nothing of a reference is stored", !bProfile?.reference);

      /* The wali is her guardian, and he has no step for one. The URL
         was live until recently — a bookmark or an open tab still points
         at it — so this is walked rather than assumed. */
      await p.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
      check(
        "a brother typing the wali step's URL is sent back",
        new URL(p.url()).pathname === "/onboarding",
        p.url()
      );

      /* And his checklist does not mention one at all — not as a step,
         not as an optional extra, not as a link he could follow. */
      const checklist = await p.textContent("body");
      check("his checklist names no wali", !/wali/i.test(checklist), checklist.slice(0, 200));
      check(
        "and offers no way through to one",
        (await p.locator('a[href="/onboarding/guardian"]').count()) === 0
      );

      /* The dashboard is the other screen that used to invite him to
         name one, in a card of its own. */
      await p.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
      const brotherHome = await p.textContent("body");
      check("his dashboard does not ask him to name a wali", !/Name your wali/i.test(brotherHome));
      check(
        "and carries no wali card",
        (await p.locator('a[href="/onboarding/guardian"]').count()) === 0
      );

      /* And a step that does not exist is a 404, not a blank form. */
      const res = await p.goto(BASE + "/onboarding/nonsense", { waitUntil: "networkidle" });
      check("an unknown step is a 404", res.status() === 404, String(res.status()));

      await p.close();
    }

  } finally {
    await browser.close();
    for (const email of emails) {
      const user = await db.collection("users").findOne({ email });
      if (!user) continue;
      await db.collection("sessions").deleteMany({ userId: String(user._id) });
      await db.collection("profiles").deleteMany({ userId: user._id });
      await db.collection("users").deleteOne({ _id: user._id });
    }
    console.log(`\ncleaned up ${emails.length} fixture accounts`);
    await mongo.close();
  }

  if (!checks) {
    console.error("\nNO CHECKS RAN — this is not a pass.");
    process.exit(1);
  }
  if (findings.length) {
    console.error(`\n${findings.length} of ${checks} FAILED:\n  - ${findings.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`\nall ${checks} profile checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
