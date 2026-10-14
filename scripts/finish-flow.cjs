/* Finishing a profile, from a tester's two complaints.
 *
 *   "There are certain fields under Your Background that must be
 *    populated other wise it would not progress the user. Education and
 *    Field of Study."
 *
 *   "The user must then return to home and hit the 'send it to us'
 *    button which is something I expected to be done on it's own."
 *
 * Both are about the same silence: a step saves whatever is in it, blank
 * boxes and all, so an unfinished one looks finished on the way out; and
 * the answer that completes the profile used to leave the member to go
 * and find a button on another screen.
 *
 *   BASE=http://127.0.0.1:3000 node scripts/finish-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");

loadEnv();
const dbName = process.env.MONGODB_DB || "nikahcanada";
const mongo = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const STAMP = Date.now();
const EMAIL = `finish+${STAMP}@example.invalid`;
const PASSWORD = "a-long-enough-passphrase";

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

const text = (p) => p.evaluate(() => document.body.innerText);

(async () => {
  await mongo.connect();
  const db = mongo.db(dbName);
  const browser = await chromium.launch();

  try {
    const page = await (await browser.newContext({ viewport: { width: 520, height: 1000 } })).newPage();
    page.setDefaultTimeout(45_000);

    await page.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90_000 });
    await assertOurApp(page);
    await page.click('label:has(input[name="gender"][value="brother"])');
    await page.fill('input[name="firstName"]', "Finish");
    await page.fill('input[name="lastName"]', "Fixture");
    await fillDob(page, "1993-03-03");
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.check('input[name="marriageIntention"]');
    await page.check('input[name="terms"]');
    await page.click('button[type="submit"]');
    await page.waitForURL("**/onboarding", { timeout: 60_000 });

    /* Confirmed the short way; verify-email-flow walks the link itself,
       and nothing can be sent in without it. */
    await db.collection("users").updateOne({ email: EMAIL }, { $set: { emailVerifiedAt: new Date() } });

    /* ---------- a step that was left half-answered ----------------- */
    await page.goto(`${BASE}/onboarding/background`, { waitUntil: "networkidle" });
    await page.click('label:has(input[name="background.maritalStatus"][value="neverMarried"])');
    await page.click('label:has(input[name="background.children"][value="none"])');
    await page.fill('input[name="background.languages"]', "English");
    /* Education deliberately skipped — the field the tester could not
       work out was wanted. */
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);

    await page.goto(`${BASE}/onboarding/background`, { waitUntil: "networkidle" });
    const backAgain = await text(page);
    check(
      "the step names the answer it is still waiting for",
      /still needed here/i.test(backAgain) && /Education/.test(backAgain),
      backAgain.replace(/\s+/g, " ").slice(0, 220)
    );
    check(
      "and says the rest of the page is optional",
      /optional/i.test(backAgain)
    );

    await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
    const checklist = await text(page);
    check("the checklist says what is left", /things? left|One thing left/i.test(checklist));
    check("names the step", /Your background/.test(checklist));
    check("and marks it unfinished", /Not finished yet/.test(checklist));
    check(
      "the send button is there, and refuses",
      await page.locator('button:has-text("Send my profile for review")').first().isDisabled()
    );

    /* ---------- the answer that finishes it, sends it -------------- */
    await page.goto(`${BASE}/onboarding/background`, { waitUntil: "networkidle" });
    await page.selectOption('select[name="education.level"]', "bachelor");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);

    await page.goto(`${BASE}/onboarding/basics`, { waitUntil: "networkidle" });
    await page.fill('input[name="basics.city"]', "Montreal");
    await page.selectOption('select[name="basics.province"]', "QC");
    await page.click('label:has(input[name="basics.citizenship"][value="citizen"])');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);

    await page.goto(`${BASE}/onboarding/deen`, { waitUntil: "networkidle" });
    const lastStep = await text(page);
    check(
      "the last answer's button says it will send the profile",
      /Save and send my profile/i.test(lastStep),
      lastStep.replace(/\s+/g, " ").slice(-200)
    );

    await page.click('label:has(input[name="deen.salah"][value="fiveDaily"])');
    await page.click('label:has(input[name="deen.beard"][value="yes"])');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);

    const user = await db.collection("users").findOne({ email: EMAIL });
    const profile = await db.collection("profiles").findOne({ userId: user._id });
    check(
      "answering the last question sent the profile in",
      profile?.status === "pendingReview",
      String(profile?.status)
    );
    check(
      "and the member is told so, where they landed",
      /Thank you/i.test(await text(page)),
      (await text(page)).replace(/\s+/g, " ").slice(0, 160)
    );
    check(
      "it was recorded as a submission, not a silent write",
      (await db.collection("auditLog").countDocuments({
        action: "profile.submitted",
        "actor.userId": String(user._id),
      })) === 1
    );

    /* ---------- editing a sent profile does not re-send ------------- */
    await page.goto(`${BASE}/onboarding/basics`, { waitUntil: "networkidle" });
    await page.fill('input[name="basics.city"]', "Laval");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    check(
      "editing it afterwards changes the answer, not the status",
      (await db.collection("auditLog").countDocuments({
        action: "profile.submitted",
        "actor.userId": String(user._id),
      })) === 1
    );
  } finally {
    await browser.close();
    const user = await db.collection("users").findOne({ email: EMAIL });
    if (user) {
      const id = new ObjectId(user._id);
      for (const c of ["profiles", "sessions", "verificationTokens", "auditLog", "verifications", "notifications"]) {
        await db.collection(c).deleteMany({ userId: { $in: [id, String(id)] } });
      }
      await db.collection("auditLog").deleteMany({ "actor.userId": String(id) });
      await db.collection("verifications").deleteMany({ "subject.userId": String(id) });
      await db.collection("users").deleteOne({ _id: id });
      console.log("\ncleaned up the fixture account");
    }
    await mongo.close();
  }

  console.log(bad ? `\n${bad} finish check(s) FAILED\n` : `\nfinishing a profile sends it, and an unfinished step says why\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
