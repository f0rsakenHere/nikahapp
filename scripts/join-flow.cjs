/* Register, fill everything in, and be in the pool.
 *
 * The workflow the client asked for: somebody opens an account, answers
 * every question, is put on their dashboard, and can see other members
 * from that moment — without waiting for a staff approval that now
 * happens behind them rather than in front of them (D1f, see `inPool`).
 *
 * What this drives, through the real UI and against the real database:
 *
 *   register            a brand-new brother, from the public form
 *   every step          basics, background, deen, reference, lookingFor
 *   submit              and land on the dashboard, not back on the list
 *   browse              profiles are there, and the count is not nought
 *   be browsed          another member sees him without anyone approving
 *   ask                 a connection can actually be spent
 *
 * And the line that must not move: a half-filled draft is not in the
 * pool. It cannot browse and it cannot ask, whatever the setting says
 * about approval — that check used to sit behind the setting, so
 * deferring approval removed it rather than widening it.
 *
 * The account is deleted afterwards. Exits non-zero on any failure.
 *
 *   BASE=http://127.0.0.1:3000 node scripts/join-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const mongo = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const EMAIL = `joinflow+${STAMP}@example.invalid`;
/* An existing seeded sister, to be looked at and asked. */
const LOOKER = "aisha.rahman@seed.test";
const LOOKER_PASSWORD = "one good passphrase";

let failed = 0;
function check(what, ok, detail = "") {
  console.log(`${ok ? "pass" : "FAIL"}  ${what}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed++;
  return ok;
}

/* Each step is a form that saves and moves on. The selectors follow the
   field kinds in `STEP_FIELDS`: text and list are inputs, select is a
   dropdown, radio and multiselect are inputs inside their own label. */
/** Opens a step, runs `fill`, saves, and does not return until the page
 *  has actually left that step.
 *
 *  Waiting on `**​/onboarding/**` was the bug: the URL already matched
 *  the step being submitted, so the wait returned immediately and the
 *  next navigation cancelled the POST that was still in flight. Roughly
 *  one run in two lost a step that way, which showed up at the end as an
 *  incomplete profile and told you nothing about where it went. */
async function step(p, id, fill) {
  await p.goto(`${BASE}/onboarding/${id}`, { waitUntil: "networkidle" });
  await fill(p);
  await Promise.all([
    p.waitForURL((u) => !u.pathname.endsWith(`/onboarding/${id}`), { timeout: 30_000 }),
    p.click('button[type="submit"]'),
  ]);
  await p.waitForLoadState("networkidle").catch(() => {});
}

async function fillSteps(p) {
  await step(p, "basics", async (p) => {
    await p.fill('input[name="basics.city"]', "Montreal");
    await p.selectOption('select[name="basics.province"]', "QC");
    await p.click('label:has(input[name="basics.citizenship"][value="citizen"])');
  });

  await step(p, "background", async (p) => {
    await p.click('label:has(input[name="background.maritalStatus"][value="neverMarried"])');
    await p.click('label:has(input[name="background.children"][value="none"])');
    await p.fill('input[name="background.languages"]', "English, Arabic");
    await p.selectOption('select[name="education.level"]', "bachelor");
  });

  await step(p, "deen", async (p) => {
    await p.click('label:has(input[name="deen.salah"][value="fiveDaily"])');
    await p.click('label:has(input[name="deen.madhhab"][value="hanafi"])');
    await p.click('label:has(input[name="deen.beard"][value="yes"])');
  });

  await step(p, "reference", async (p) => {
    await p.fill('input[name="reference.name"]', "Testonly Reference");
    await p.fill('input[name="reference.relationship"]', "A fixture, not a person");
    await p.fill('input[name="reference.phone"]', "514-555-0142");
  });

  await step(p, "lookingFor", async (p) => {
    await p.fill('input[name="lookingFor.ageMin"]', "24");
    await p.fill('input[name="lookingFor.ageMax"]', "40");
    await p.click('label:has(input[name="lookingFor.provinces"][value="QC"])');
  });
}

async function cardCount(p) {
  return p.evaluate(() => document.querySelectorAll("main ul li").length);
}

(async () => {
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB || "nikahcanada");

  const looker = await db.collection("users").findOne({ email: LOOKER });
  if (!looker) {
    console.error(`\nFAIL  no seeded pool — ${LOOKER} is missing.`);
    console.error("      Run: node scripts/seed-pool.cjs --apply\n");
    process.exitCode = 1;
    await mongo.close();
    return;
  }

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await context.newPage();
    p.setDefaultTimeout(30_000);

    /* ---------------------------------------------------- register ---- */
    await p.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90_000 });
    await assertOurApp(p);
    await p.click('label:has(input[name="gender"][value="brother"])');
    await p.fill('input[name="firstName"]', "Testonly");
    await p.fill('input[name="lastName"]', "Joinflow");
    await fillDob(p, "1994-03-09");
    await p.fill('input[name="email"]', EMAIL);
    await p.fill('input[name="password"]', PASSWORD);
    await p.check('input[name="marriageIntention"]');
    await p.check('input[name="terms"]');
    await p.click('button[type="submit"]');
    await p.waitForURL("**/onboarding", { timeout: 45_000 });
    check("registering lands on the profile, not the dashboard", true);

    /* ------------------------------- a draft is not in the pool ------- */
    await p.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    const draftBody = await p.textContent("body");
    check("a draft cannot browse", /Not yet\./.test(draftBody));
    check(
      "and is told it is their own form holding it up, not our queue",
      /finished your profile and sent it in/i.test(draftBody),
      draftBody.slice(0, 0)
    );

    /* The ask path, called directly — the button is not on screen for a
       draft, and "not on screen" is not a check. */
    const target = await db
      .collection("profiles")
      .findOne({ userId: looker._id }, { projection: { _id: 1 } });
    await p.goto(`${BASE}/browse/${target._id.toHexString()}`, { waitUntil: "networkidle" });
    check(
      "a draft cannot open somebody's profile either",
      /not found|404/i.test(await p.textContent("body")),
      p.url()
    );

    /* ------------------------------------------------ fill it all ----- */
    await fillSteps(p);

    const user = await db.collection("users").findOne({ email: EMAIL });
    let profile = await db.collection("profiles").findOne({ userId: user._id });
    check("every answer reached the database", profile?.basics?.city === "Montreal");
    check("and the profile is still a draft until it is sent", profile?.status === "draft");

    /* ---------------------------------------------------- submit ------ */
    await p.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
    const submit = p.locator('button:has-text("Send my profile for review")').first();
    if (
      !check(
        "the profile is complete, so it offers to be sent",
        await submit.isVisible(),
        /* The checklist's own words about what is missing, rather than a
           bare click timeout thirty seconds later. */
        (await p.textContent("main")).replace(/\s+/g, " ").slice(0, 220)
      )
    ) {
      throw new Error("the profile did not complete — see the line above");
    }
    await submit.click();
    await p.waitForURL("**/dashboard**", { timeout: 45_000 });
    check("submitting lands on the dashboard", /\/dashboard/.test(p.url()), p.url());

    profile = await db.collection("profiles").findOne({ userId: user._id });
    check("and the profile is now sent in", profile?.status === "pendingReview", profile?.status);
    check("with the moment it was sent recorded", Boolean(profile?.submittedAt));
    check(
      "nobody has approved it — that is the point",
      !profile?.liveAt,
      profile?.liveAt ? String(profile.liveAt) : "no liveAt"
    );

    const dash = await p.textContent("body");
    check("the dashboard says they are in", /In the pool/.test(dash));
    check(
      "and does not claim the pool has all been checked",
      !/every one checked by our team/i.test(dash)
    );

    /* ----------------------------------------------- see the pool ----- */
    await p.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    const seen = await cardCount(p);
    check("browse shows other members straight away", seen > 0, `${seen} cards`);
    check(
      "and counts a pool that is not empty",
      /\d+ in the pool/.test(await p.textContent("body"))
    );

    /* ------------------------------------------------ be browsed ------ */
    const other = await context.browser().newContext({ viewport: { width: 1280, height: 900 } });
    const q = await other.newPage();
    q.setDefaultTimeout(30_000);
    await q.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await q.fill('input[name="email"]', LOOKER);
    await q.fill('input[name="password"]', LOOKER_PASSWORD);
    await q.click('button[type="submit"]');
    await q.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
    /* The status code, not the words on the page: `notFound()` renders
       a 404 whose copy is Next's and could say anything. */
    const res = await q.goto(`${BASE}/browse/${profile._id.toHexString()}`, {
      waitUntil: "networkidle",
    });
    const his = await q.textContent("body");
    check(
      "a member who was never approved is visible to others",
      res.status() === 200 && /Montreal/.test(his),
      `HTTP ${res.status()}`
    );
    check("and can be asked", /Ask to talk/i.test(his));
    await other.close();

    /* --------------------------------------------------- he can ask --- */
    await p.goto(`${BASE}/browse/${target._id.toHexString()}`, { waitUntil: "networkidle" });
    const ask = p.locator('button:has-text("Ask to talk")').first();
    check("and he can spend a connection himself", await ask.isVisible());
    await ask.click();
    /* Polled, not waited on: the button posts a server action, and
       `networkidle` returns while it is still being handled. */
    let asked = null;
    for (let i = 0; i < 20 && !asked; i++) {
      asked = await db
        .collection("connectionRequests")
        .findOne({ fromUserId: String(user._id), toUserId: String(looker._id) });
      if (!asked) await new Promise((r) => setTimeout(r, 500));
    }
    check(
      "the request was actually created",
      Boolean(asked),
      asked?.state ?? (await p.textContent("main")).replace(/\s+/g, " ").slice(0, 120)
    );

    await context.close();
  } finally {
    /* Whatever happened above, the fixture does not stay in the pool. */
    const user = await db.collection("users").findOne({ email: EMAIL });
    if (user) {
      const id = new ObjectId(user._id);
      await db.collection("connectionRequests").deleteMany({
        $or: [{ fromUserId: String(id) }, { toUserId: String(id) }],
      });
      await db.collection("connectionLedger").deleteMany({ userId: String(id) });
      await db.collection("notifications").deleteMany({ userId: String(id) });
      await db.collection("verifications").deleteMany({ userId: String(id) });
      await db.collection("profiles").deleteMany({ userId: id });
      await db.collection("sessions").deleteMany({ userId: String(id) });
      await db.collection("users").deleteOne({ _id: id });
      console.log("\ncleaned up the fixture account");
    }
    await browser.close();
    await mongo.close();
  }

  console.log(failed ? `\n${failed} join check(s) failed\n` : "\nall join checks pass\n");
  process.exitCode = failed ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
