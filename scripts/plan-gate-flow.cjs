/* The paywall on talking, walked end to end.
 *
 * The rule: interest is free, sisters never pay, and a brother may send
 * three messages in a conversation before he needs a plan to send the
 * fourth. It ships switched off, so this checker has to switch it on —
 * and switching it on is a write to the `settings` document that every
 * visitor to the site reads.
 *
 * That is why it refuses to run against the production database. Point
 * it, and the dev server it talks to, at a throwaway database instead;
 * the checker creates everything it needs there and drops the whole
 * database when it finishes.
 *
 *   MONGODB_DB=nikahcanada_plantest npx next dev -p 3001
 *   MONGODB_DB=nikahcanada_plantest BASE=http://127.0.0.1:3001 node scripts/plan-gate-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");

const DB_NAME = process.env.MONGODB_DB;
loadEnv();

if (!DB_NAME || DB_NAME === "nikahcanada" || !/test/i.test(DB_NAME)) {
  console.error("\nFAIL  refusing to run: this checker switches the paywall on in `settings`.");
  console.error("      Set MONGODB_DB to a throwaway database whose name contains \"test\",");
  console.error("      and start the dev server with the same value.\n");
  process.exit(1);
}

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const FREE = 3;
/* Optional: a directory to write screenshots of the counter and the
   used-up panel into, for looking at rather than only asserting on. */
const SHOTS = process.env.SHOTS || null;
async function shot(page, name) {
  if (!SHOTS) return;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

async function register(browser, gender, first) {
  const email = `plan+${gender}${STAMP}@example.invalid`;
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.click(`label:has(input[name="gender"][value="${gender}"])`);
  await page.fill('input[name="firstName"]', first);
  await page.fill('input[name="lastName"]', "Fixture");
  await fillDob(page, "1994-05-10");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.check('input[name="marriageIntention"]');
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  await page.waitForURL("**/onboarding", { timeout: 60_000 });
  return { email, context, page };
}

const text = (p) => p.evaluate(() => document.body.innerText);

async function send(page, body) {
  await page.fill('textarea[name="body"]', body);
  await page.locator('button:has-text("Send")').first().click();
  await page.waitForTimeout(2500);
}

(async () => {
  await client.connect();
  const db = client.db(DB_NAME);
  const browser = await chromium.launch();

  try {
    const him = await register(browser, "brother", "Bilal");
    await assertOurApp(him.page);
    const her = await register(browser, "sister", "Maryam");

    const users = db.collection("users");
    const brother = await users.findOne({ email: him.email });
    const sister = await users.findOne({ email: her.email });
    check("both accounts exist in the test database", Boolean(brother && sister));

    const now = new Date();
    await db.collection("profiles").updateMany(
      { userId: { $in: [brother._id, sister._id] } },
      { $set: { status: "live", liveAt: now } }
    );

    const waliId = `plantest-wali-${STAMP}`;
    await db.collection("guardianships").insertOne({
      memberUserId: String(sister._id),
      memberProfileId: "plantest",
      waliUserId: waliId,
      invited: {
        name: "Ahmed",
        relationship: "father",
        email: `plan+wali${STAMP}@example.invalid`,
        invitedAt: now,
        tokenHash: "d".repeat(64),
        expiresAt: new Date(now.getTime() + 86_400_000),
        remindersSent: 0,
      },
      status: "confirmed",
      confirmedAt: now,
      declinedAt: null,
      declineReason: null,
      revokedAt: null,
      revokedBy: null,
      expiredAt: null,
      verification: { state: "verified", verifiedAt: now, method: "test" },
      replacesGuardianshipId: null,
      replacedByGuardianshipId: null,
    });

    /* Mutual interest, already reached — the ask and accept path is
       covered by pool-flow, and this checker is about what comes after. */
    const requestId = new ObjectId();
    await db.collection("connectionRequests").insertOne({
      _id: requestId,
      pairKey: `${brother._id}:${sister._id}`,
      fromUserId: String(brother._id),
      toUserId: String(sister._id),
      state: "accepted",
      sentAt: now,
      expiresAt: new Date(now.getTime() + 14 * 86_400_000),
      answeredAt: now,
      declineReason: null,
      conversationId: null,
    });
    const conversationId = new ObjectId();
    await db.collection("conversations").insertOne({
      _id: conversationId,
      requestId: requestId.toHexString(),
      participants: [
        { userId: String(brother._id), role: "member", canWrite: true },
        { userId: String(sister._id), role: "member", canWrite: true },
        { userId: waliId, role: "wali", canWrite: false },
      ],
      state: "open",
      openedAt: now,
      lastMessageAt: null,
      messageCount: 0,
      closedAt: null,
      closedBy: null,
      closeReason: null,
      createdAt: now,
    });
    const thread = `${BASE}/conversations/${conversationId.toHexString()}`;
    const countFrom = (u) =>
      db.collection("messages").countDocuments({
        conversationId: conversationId.toHexString(),
        fromUserId: String(u._id),
        kind: "member",
      });

    /* ---------- paywall off: nothing is counted ----------------------- */
    await him.page.goto(thread, { waitUntil: "networkidle" });
    check("with the paywall off, he has a box to write in", (await him.page.locator("textarea").count()) === 1);
    check("and no free-message counter is shown", !/free messages? left/i.test(await text(him.page)));

    /* ---------- switch it on, for brothers ---------------------------- */
    await db
      .collection("settings")
      .updateOne({ key: "product" }, { $set: { key: "product", "value.planGate": "brother" } }, { upsert: true });

    await him.page.goto(thread, { waitUntil: "networkidle" });
    check(
      `he is told he has ${FREE} free messages`,
      new RegExp(`${FREE} of ${FREE} free messages left`).test(await text(him.page)),
      (await text(him.page)).replace(/\s+/g, " ").slice(-300)
    );

    await shot(him.page, "1-counter");
    await send(him.page, "Assalamu alaikum. First message.");
    check("the counter goes down after one", /2 of 3 free messages left/.test(await text(him.page)));
    await send(him.page, "Second message.");
    check("and after two", /1 of 3 free messages left/.test(await text(him.page)));

    /* A second tab, left open on the thread while he still has one free
       message. It keeps a working composer after the limit is reached
       elsewhere — which is exactly how a form gets posted without the
       page that would have hidden it. */
    const staleTab = await him.context.newPage();
    await staleTab.goto(thread, { waitUntil: "networkidle" });

    await send(him.page, "Third message.");
    check("all three free messages were stored", (await countFrom(brother)) === 3, String(await countFrom(brother)));

    const afterThree = await text(him.page);
    check("after the third, the box to write in is gone", (await him.page.locator("textarea").count()) === 0);
    check("and he is told why", /You have used your 3 free messages/.test(afterThree), afterThree.replace(/\s+/g, " ").slice(-300));
    check("and that she can still write to him", /She can still write to you/.test(afterThree));
    await shot(him.page, "2-used-up");

    /* ---------- the server refuses, not only the screen --------------- */
    await send(staleTab, "A fourth message from a tab that was left open.");
    check(
      "a fourth message from a stale tab is refused by the server",
      (await countFrom(brother)) === 3,
      `${await countFrom(brother)} stored`
    );
    check(
      "with a sentence saying a plan is needed",
      /Sending another needs a plan/.test(await text(staleTab)),
      (await text(staleTab)).replace(/\s+/g, " ").slice(-240)
    );
    await staleTab.close();

    /* ---------- she is never charged ---------------------------------- */
    await her.page.goto(thread, { waitUntil: "networkidle" });
    check("she still has a box to write in", (await her.page.locator("textarea").count()) === 1);
    check("and sees no counter", !/free messages? left/i.test(await text(her.page)));
    for (let i = 1; i <= 4; i++) await send(her.page, `Her message ${i}.`);
    check("she can send more than three", (await countFrom(sister)) === 4, String(await countFrom(sister)));
    check("and he reads what she wrote", /Her message 4\./.test(await (async () => {
      await him.page.goto(thread, { waitUntil: "networkidle" });
      return text(him.page);
    })()));

    /* ---------- with a plan, he writes again -------------------------- */
    await users.updateOne(
      { _id: brother._id },
      { $set: { planActiveUntil: new Date(Date.now() + 30 * 86_400_000) } }
    );
    await him.page.goto(thread, { waitUntil: "networkidle" });
    check("with a plan, his box to write in comes back", (await him.page.locator("textarea").count()) === 1);
    check("and no counter is shown", !/free messages? left/i.test(await text(him.page)));
    await send(him.page, "Fourth message, with a plan.");
    check("and his fourth message is stored", (await countFrom(brother)) === 4, String(await countFrom(brother)));

    /* ---------- a plan that has run out is no plan -------------------- */
    await users.updateOne({ _id: brother._id }, { $set: { planActiveUntil: new Date(Date.now() - 60_000) } });
    await him.page.goto(thread, { waitUntil: "networkidle" });
    check("when the plan runs out, sending stops again", (await him.page.locator("textarea").count()) === 0);
    check("and nothing already said is hidden", /Fourth message, with a plan\./.test(await text(him.page)));
  } finally {
    await browser.close();
    /* The whole database, because it only ever existed for this run. */
    await db.dropDatabase();
    console.log(`\ndropped the test database ${DB_NAME}`);
    await client.close();
  }

  console.log(bad ? `\n${bad} plan check(s) FAILED\n` : `\nall plan checks pass\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
