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
const { BASE, assertOurApp } = require("./lib/base.cjs");
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
  const email = `profileflow+${gender}${STAMP}@example.invalid`;
  emails.push(email);
  await page.goto(BASE + "/register", { waitUntil: "networkidle" });
  await page.click(`label:has(input[name="gender"][value="${gender}"])`);
  await page.fill('input[name="firstName"]', "Testonly");
  await page.fill('input[name="lastName"]', "Fixture");
  await page.fill('input[name="dateOfBirth"]', "1995-04-12");
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
      check("a sister sees five steps", steps === 5, `saw ${steps}`);
      check("a sister starts at 0% — the wali step is not hers to finish", (await p.textContent("body")).includes("0%"));
      check(
        "the wali step reads as waiting on someone else",
        /Waiting on your wali/.test(await p.textContent("body"))
      );

      /* --- step 1, filled properly ---------------------------------- */
      await p.goto(BASE + "/onboarding/basics", { waitUntil: "networkidle" });
      await p.fill('input[name="basics.birthYear"]', "1995");
      await p.fill('input[name="basics.city"]', "Montreal");
      await p.selectOption('select[name="basics.province"]', "QC");
      await p.click('label:has(input[name="basics.citizenship"][value="refugee"])');
      await p.fill('input[name="basics.heightCm"]', "163");
      await p.click('button[type="submit"]');
      await p.waitForURL("**/onboarding/background", { timeout: 20_000 });
      check("saving step one moves to step two", p.url().endsWith("/onboarding/background"));

      const user = await db.collection("users").findOne({ email });
      let profile = await db.collection("profiles").findOne({ userId: user._id });
      check("the answers reached the database", profile?.basics?.city === "Montreal");
      check(
        "a citizenship a guessed list would have rejected survives",
        profile?.basics?.citizenship === "refugee"
      );
      check("progress was recomputed on save", profile?.completeness?.percent === 20, String(profile?.completeness?.percent));

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
        profile?.completeness?.percent === 20,
        String(profile?.completeness?.percent)
      );

      /* --- the deen step is gendered -------------------------------- */
      const deen = await p.textContent("body");
      check("a sister is asked about hijab", /Hijab/.test(deen));
      check("a sister is not asked about a beard", !/Beard/.test(deen));
      check("there is a way to decline every question", /Prefer not to say/.test(deen));

      /* --- an age range that runs backwards -------------------------- */
      await p.goto(BASE + "/onboarding/lookingFor", { waitUntil: "networkidle" });
      await p.fill('input[name="lookingFor.ageMin"]', "40");
      await p.fill('input[name="lookingFor.ageMax"]', "30");
      await p.click('label:has(input[name="lookingFor.provinces"][value="QC"])');
      await p.click('button[type="submit"]');
      await p.waitForTimeout(2000);
      check(
        "an age range that runs backwards is refused",
        /youngest/i.test(await p.textContent("body")),
        p.url()
      );

      await p.fill('input[name="lookingFor.ageMax"]', "45");
      await p.click('button[type="submit"]');
      await p.waitForURL("**/onboarding", { timeout: 20_000 });
      profile = await db.collection("profiles").findOne({ userId: user._id });
      check("the corrected range saves", profile?.lookingFor?.ageMax === 45);
      check(
        "the last step returns to the overview",
        new URL(p.url()).pathname === "/onboarding",
        p.url()
      );

      await p.close();
    }

    /* --------------------------------------------------- the brother -- */
    {
      const p = await browser.newPage({ viewport: { width: 500, height: 900 } });
      const email = await register(p, "brother");

      const steps = await p.locator("ol li a").count();
      check("a brother sees four steps — no wali", steps === 4, `saw ${steps}`);
      check("a brother starts at 0% too", (await p.textContent("body")).includes("0%"));

      await p.goto(BASE + "/onboarding/deen", { waitUntil: "networkidle" });
      const deen = await p.textContent("body");
      check("a brother is asked about his beard", /Beard/.test(deen));
      check("a brother is not asked about hijab", !/Hijab/.test(deen));

      /* Typing the wali step's URL must not show it to him. */
      await p.goto(BASE + "/onboarding/guardian", { waitUntil: "networkidle" });
      check(
        "a brother typing the wali step's URL is sent back",
        new URL(p.url()).pathname === "/onboarding",
        p.url()
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
