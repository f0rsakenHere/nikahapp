/* Finishing a profile, one step at a time.
 *
 * The client, November 2026: "without completing one step fully they
 * should not be able to go to next step... I put some info here then
 * some info there, that is not good." Steps used to save and move on
 * regardless, so answers ended up scattered half-filled across three
 * screens with 0% to show for it. Now a step opens only once the one
 * before it is finished, and "Save and continue" on an unfinished step
 * stays put and marks what is missing.
 *
 * Still covered from the earlier tester complaint: the answer that
 * completes the profile sends it in by itself.
 *
 *   BASE=http://127.0.0.1:3001 node scripts/finish-flow.cjs   (next dev)
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
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
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
    await page.click('main button[type="submit"]');
    await page.waitForURL("**/onboarding", { timeout: 60_000 });

    /* Confirmed the short way; verify-email-flow walks the link itself,
       and nothing can be sent in without it. */
    await db.collection("users").updateOne({ email: EMAIL }, { $set: { emailVerifiedAt: new Date() } });

    const path = () => new URL(page.url()).pathname;
    const save = async () => {
      const from = path();
      /* Wait on the save itself coming back, then on what the page does
         with it. Waiting for the error summary alone passed instantly on
         the second try at a step, because the first refusal's summary
         was still on screen — two checks "failed" on a page that had
         not finished moving yet. */
      const answered = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined,
        { timeout: 45_000 }
      );
      await page.click('main button[type="submit"]');
      await answered;
      await Promise.race([
        page.waitForURL((u) => new URL(u).pathname !== from, { timeout: 8_000 }),
        page.waitForFunction(
          () => !document.querySelector('main button[type="submit"]')?.disabled,
          null,
          { timeout: 8_000 }
        ).then(() => page.waitForTimeout(1_500)),
      ]).catch(() => {});
    };
    const highlighted = () =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll("main span")).filter(
            (s) => s.textContent.trim() === "Please answer this to continue."
          ).length
      );

    /* ---------- skipping ahead is refused ---------------------------- */
    await page.goto(`${BASE}/onboarding/deen`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="basics.city"]');
    check("typing a later step's address lands on the first unfinished one", path() === "/onboarding/basics", path());

    await page.goto(`${BASE}/onboarding`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main ol");
    check(
      "the checklist does not link to steps not reached yet",
      (await page.locator('main a[href="/onboarding/background"]').count()) === 0 &&
        (await page.locator('main a[href="/onboarding/deen"]').count()) === 0
    );
    check("and says when they open", /Opens once about you is finished/i.test(await text(page)));

    /* ---------- a half-answered step keeps you on it ----------------- */
    await page.goto(`${BASE}/onboarding/basics`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="basics.city"]');
    check(
      "the steps ahead are on screen but not links",
      (await page.locator('ol[aria-label="Profile steps"] a').count()) === 0 &&
        (await page.locator('ol[aria-label="Profile steps"] li').count()) === 3
    );
    await page.fill('input[name="basics.city"]', "Montreal");
    await save();
    check("saving with answers missing stays on the step", path() === "/onboarding/basics", path());
    const summary = await page.locator('main [role="alert"]').innerText().catch(() => "");
    check("and says how many are missing", /2 highlighted questions/.test(summary), summary);
    check("each missing question is marked where it is", (await highlighted()) === 2, String(await highlighted()));
    await page.waitForTimeout(800);
    check(
      "what was typed survives the refusal",
      (await page.inputValue('input[name="basics.city"]')) === "Montreal"
    );
    await page.screenshot({ path: process.env.SHOT || "finish-flow-refused.png", fullPage: false });

    const user = await db.collection("users").findOne({ email: EMAIL });
    let profile = await db.collection("profiles").findOne({ userId: user._id });
    check("and was saved, so leaving loses nothing", profile?.basics?.city === "Montreal", JSON.stringify(profile?.basics));

    await page.goto(`${BASE}/onboarding/background`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="basics.city"]');
    check("the next step is still shut", path() === "/onboarding/basics", path());

    /* ---------- finishing it opens the next one ---------------------- */
    await page.selectOption('select[name="basics.province"]', "QC");
    await page.click('label:has(input[name="basics.citizenship"][value="citizen"])');
    await save();
    check("a finished step moves on", path() === "/onboarding/background", path());
    await page.waitForSelector('input[name="background.languages"]');
    check(
      "and the finished step is a link back",
      (await page.locator('ol[aria-label="Profile steps"] a[href="/onboarding/basics"]').count()) === 1
    );

    await page.click('label:has(input[name="background.maritalStatus"][value="neverMarried"])');
    await page.click('label:has(input[name="background.children"][value="none"])');
    await page.fill('input[name="background.languages"]', "English");
    /* Education left out — the one a tester could not work out was wanted. */
    await save();
    check("background without education stays put", path() === "/onboarding/background", path());
    check("and marks education", (await highlighted()) === 1, String(await highlighted()));
    await page.selectOption('select[name="education.level"]', "bachelor");
    await save();
    check("then moves on", path() === "/onboarding/deen", path());
    await page.waitForSelector('input[name="deen.salah"]');

    /* ---------- the answer that finishes it, sends it -------------- */
    check(
      "the last answer's button says it will send the profile",
      /Save and send my profile/i.test(await text(page))
    );
    await page.click('label:has(input[name="deen.salah"][value="fiveDaily"])');
    await page.click('label:has(input[name="deen.madhhab"][value="hanafi"])');
    await page.click('label:has(input[name="deen.beard"][value="yes"])');
    await page.click('main button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 45_000 });

    profile = await db.collection("profiles").findOne({ userId: user._id });
    check("answering the last question sent the profile in", profile?.status === "pendingReview", String(profile?.status));
    check(
      "it was recorded as a submission",
      (await db.collection("auditLog").countDocuments({
        action: "profile.submitted",
        "actor.userId": String(user._id),
      })) === 1
    );

    /* ---------- editing afterwards ----------------------------------- */
    await page.goto(`${BASE}/onboarding/basics`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[name="basics.city"]');
    await page.fill('input[name="basics.city"]', "");
    await save();
    check("clearing a required answer later is refused too", path() === "/onboarding/basics", path());
    await page.fill('input[name="basics.city"]', "Laval");
    await save();
    profile = await db.collection("profiles").findOne({ userId: user._id });
    check("an edit goes through once it is whole", profile?.basics?.city === "Laval", profile?.basics?.city);
    check(
      "and does not send the profile a second time",
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

  console.log(bad ? `\n${bad} finish check(s) FAILED\n` : `\nsteps open in order, an unfinished step holds you, and the last answer sends it in\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
