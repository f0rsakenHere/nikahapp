/* End-to-end check of pausing, withdrawing, export and erasure.
 *
 * Erasure is the one operation here that cannot be undone and reaches
 * into every collection, so most of these checks are about what is left
 * behind afterwards — and about the one thing that must survive.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/lifecycle-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { BASE, assertOurApp } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const SISTER = `life+sister${STAMP}@example.invalid`;
const WALI = `life+wali${STAMP}@example.invalid`;
const emails = [SISTER, WALI];

const findings = [];
let checks = 0;
function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

async function devLink(page) {
  const links = page.locator('a[href*="token="]');
  return (await links.count()) ? links.first().getAttribute("href") : null;
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
    const ctx = await browser.newContext({ acceptDownloads: true });
    const p = await ctx.newPage();

    await p.goto(BASE + "/register", { waitUntil: "networkidle" });
    await assertOurApp(p);
    await p.click('label:has(input[name="gender"][value="sister"])');
    await p.fill('input[name="firstName"]', "Fatima");
    await p.fill('input[name="lastName"]', "Fixture");
    await p.fill('input[name="dateOfBirth"]', "1995-04-12");
    await p.fill('input[name="email"]', SISTER);
    await p.fill('input[name="password"]', PASSWORD);
    await p.check('input[name="marriageIntention"]');
    await p.check('input[name="terms"]');
    await p.click('button[type="submit"]');
    await p.waitForURL("**/onboarding", { timeout: 20_000 });

    await p.goto(BASE + "/onboarding/basics", { waitUntil: "networkidle" });
    await p.fill('input[name="basics.birthYear"]', "1995");
    await p.fill('input[name="basics.city"]', "Montreal");
    await p.selectOption('select[name="basics.province"]', "QC");
    await p.click('label:has(input[name="basics.citizenship"][value="citizen"])');
    await p.click('button[type="submit"]');
    await p.waitForTimeout(2000);

    /* A wali, so erasure has a guardianship to remove. */
    await p.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
    await p.fill('input[name="name"]', "Ahmed Al-Rashid");
    await p.selectOption('select[name="relationship"]', "father");
    await p.fill('input[name="email"]', WALI);
    await p.click('button[type="submit"]');
    await p.waitForTimeout(2500);
    const invite = await devLink(p);
    const him = await (await browser.newContext()).newPage();
    await him.goto(String(invite), { waitUntil: "networkidle" });
    await him.fill('input[name="password"]', PASSWORD);
    await him.click('button[type="submit"]');
    await him.waitForURL("**/login**", { timeout: 20_000 });
    await him.close();

    const user = await db.collection("users").findOne({ email: SISTER });
    const userId = String(user._id);

    /* ---------- pausing a draft is refused --------------------------- */
    await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
    check("settings offers to pause", /Pause my profile/.test(await p.textContent("body")));
    await p.click('button:has-text("Pause my profile")');
    await p.waitForTimeout(2500);
    check(
      "pausing a draft is refused, and says why",
      /not live/i.test(await p.textContent("body"))
    );
    check(
      "and the profile is untouched",
      (await db.collection("profiles").findOne({ userId: user._id })).status === "draft"
    );

    /* ---------- the export ------------------------------------------- */
    const [download] = await Promise.all([
      p.waitForEvent("download", { timeout: 30_000 }),
      p.click('button:has-text("Download my data")'),
    ]);
    const stream = await download.createReadStream();
    let raw = "";
    for await (const chunk of stream) raw += chunk;
    const data = JSON.parse(raw);

    check("the export is machine-readable JSON", typeof data === "object" && !!data.exportedAt);
    check("it contains their account", data.account?.email === SISTER);
    check("and their profile", data.profile?.basics?.city === "Montreal");
    check("and their wali", Array.isArray(data.guardianships) && data.guardianships.length === 1);
    check("and what happened, with dates", Array.isArray(data.activity) && data.activity.length > 0);

    /* The parts that must never be in it, even for their owner. */
    check("it does not contain the password hash", !raw.includes("$argon2"));
    check("it does not contain a session token digest", !/[0-9a-f]{64}/.test(raw));
    check("it does not contain the mfa block", !raw.includes('"mfa"'));
    check(
      "it does not name the staff who looked at them",
      !JSON.stringify(data.activity).includes("actor")
    );

    /* ---------- withdrawing needs the password ----------------------- */
    await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
    await p.click('button:has-text("Withdraw my profile")');
    /* Wait for the panel rather than for a stopwatch: the click swaps
       the button for a form, and filling a field that has not rendered
       yet fails in a way that reads like a product bug. */
    await p.waitForSelector('input[name="password"]', { timeout: 15_000 });
    await p.fill('input[name="password"]', "not-my-password");
    await p.click('button:has-text("Withdraw my profile")');
    await p.waitForFunction(
      () => /not your password/i.test(document.body.innerText),
      undefined,
      { timeout: 15_000 }
    ).catch(() => {});
    check("withdrawing with the wrong password is refused", /not your password/i.test(await p.textContent("body")));
    check(
      "and nothing changed",
      (await db.collection("profiles").findOne({ userId: user._id })).status === "draft"
    );

    await p.fill('input[name="password"]', PASSWORD);
    await p.click('button:has-text("Withdraw my profile")');
    await p.waitForTimeout(3500);
    check(
      "withdrawing with the right password works",
      (await db.collection("profiles").findOne({ userId: user._id })).status === "withdrawn"
    );

    /* ---------- what is in the database before erasure --------------- */
    const before = {
      users: await db.collection("users").countDocuments({ _id: user._id }),
      profiles: await db.collection("profiles").countDocuments({ userId: user._id }),
      sessions: await db.collection("sessions").countDocuments({ userId }),
      guardianships: await db.collection("guardianships").countDocuments({ memberUserId: userId }),
      audit: await db.collection("auditLog").countDocuments({ "actor.userId": userId }),
    };
    check("she has records to erase", before.users === 1 && before.guardianships === 1 && before.audit > 0);

    /* ---------- erasure --------------------------------------------- */
    await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
    await p.click('button:has-text("Delete my account and everything in it")');
    await p.waitForSelector('input[name="confirm"]', { timeout: 15_000 });
    check(
      "it explains that the log survives with them removed",
      /removed\s+from it/i.test(await p.textContent("body"))
    );

    await p.fill('input[name="password"]', PASSWORD);
    await p.fill('input[name="confirm"]', "nope");
    await p.click('button:has-text("Delete everything")');
    await p.waitForTimeout(2500);
    check("a mistyped confirmation is refused", /Type DELETE/i.test(await p.textContent("body")));
    check("and nothing was deleted", (await db.collection("users").countDocuments({ _id: user._id })) === 1);

    await p.fill('input[name="password"]', PASSWORD);
    await p.fill('input[name="confirm"]', "DELETE");
    await p.click('button:has-text("Delete everything")');
    await p.waitForTimeout(4000);

    check("the account is gone", (await db.collection("users").countDocuments({ _id: user._id })) === 0);
    check("the profile is gone", (await db.collection("profiles").countDocuments({ userId: user._id })) === 0);
    check("the sessions are gone", (await db.collection("sessions").countDocuments({ userId })) === 0);
    check(
      "the guardianship is gone",
      (await db.collection("guardianships").countDocuments({ memberUserId: userId })) === 0
    );
    check(
      "her verification tokens are gone",
      (await db.collection("verificationTokens").countDocuments({ userId })) === 0
    );

    /* His account is not hers to delete. */
    check("her wali still has his own account", (await db.collection("users").countDocuments({ email: WALI })) === 1);

    /* The one thing that must survive. */
    const stillHers = await db.collection("auditLog").countDocuments({ "actor.userId": userId });
    check("no audit entry still names her", stillHers === 0);

    const pseudonymised = await db
      .collection("auditLog")
      .find({ "actor.userId": /^erased-/ })
      .toArray();
    check("the entries survive under a pseudonym", pseudonymised.length >= before.audit, `${pseudonymised.length} vs ${before.audit}`);
    check("they keep what happened and when", pseudonymised.every((e) => e.action && e.at));
    check("they carry no metadata any more", pseudonymised.every((e) => Object.keys(e.meta ?? {}).length === 0));
    check("and no address or device", pseudonymised.every((e) => e.actor.ip === null && e.actor.userAgent === null));
    check(
      "one pseudonym, so her entries still group together",
      new Set(pseudonymised.map((e) => e.actor.userId)).size === 1
    );

    /* ---------- and she is signed out -------------------------------- */
    await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
    check("the session is gone with the account", new URL(p.url()).pathname === "/login", p.url());

    await ctx.close();
  } finally {
    await browser.close();
    for (const email of emails) {
      const u = await db.collection("users").findOne({ email });
      if (!u) continue;
      await db.collection("sessions").deleteMany({ userId: String(u._id) });
      await db.collection("verificationTokens").deleteMany({ userId: String(u._id) });
      await db.collection("guardianships").deleteMany({
        $or: [{ memberUserId: String(u._id) }, { waliUserId: String(u._id) }],
      });
      await db.collection("profiles").deleteMany({ userId: u._id });
      await db.collection("auditLog").deleteMany({ "subject.id": String(u._id) });
      await db.collection("users").deleteOne({ _id: u._id });
    }
    await db.collection("auditLog").deleteMany({ "actor.userId": /^erased-/ });
    console.log("\ncleaned up the fixture accounts");
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
  console.log(`\nall ${checks} lifecycle checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
