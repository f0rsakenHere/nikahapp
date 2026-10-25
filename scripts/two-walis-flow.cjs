/* Two walis, and one man acting for two sisters.
 *
 * Both are the client's own words, after his members hit them:
 *
 *   "when the second Wali's information is provided, the first Wali gets
 *    disregarded, and the second one is made the Wali. It shouldn't be
 *    like this; both should remain as Walis and both should have access."
 *
 *   "if a father has two, three, or four daughters who all want to use
 *    our service, the father can't create three or four different email
 *    addresses"
 *
 * So this walks both, through the real screens: a sister names a wali, he
 * confirms, she names a second, he confirms too, and then the same man
 * accepts an invitation from a second sister on the same address. What is
 * asserted at the end is access — both walis seated in the conversation
 * that opens, and both wards listed in his portal.
 *
 *   BASE=http://127.0.0.1:3000 node scripts/two-walis-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp, fillDob, requireRevealedLinks } = require("./lib/base.cjs");

loadEnv();
const dbName = process.env.MONGODB_DB || "nikahcanada";
const mongo = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const STAMP = Date.now();
const PASSWORD = "a-long-enough-passphrase";
const SISTER_A = `twowali+sistera${STAMP}@example.invalid`;
const SISTER_B = `twowali+sisterb${STAMP}@example.invalid`;
const BROTHER = `twowali+brother${STAMP}@example.invalid`;
/* One address, three roles to play: father of both sisters. */
const FATHER = `twowali+father${STAMP}@example.invalid`;
const UNCLE = `twowali+uncle${STAMP}@example.invalid`;

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

async function register(browser, gender, first, email) {
  const context = await browser.newContext({ viewport: { width: 520, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45_000);
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.click(`label:has(input[name="gender"][value="${gender}"])`);
  await page.fill('input[name="firstName"]', first);
  await page.fill('input[name="lastName"]', "Fixture");
  await fillDob(page, "1994-06-15");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.check('input[name="marriageIntention"]');
  await page.check('input[name="terms"]');
  await page.click('main button[type="submit"]');
  await page.waitForURL("**/onboarding", { timeout: 45_000 });
  return { context, page, email };
}

/** The invitation link the dev server prints on screen when no email
 *  provider is configured. */
async function devLink(page) {
  const link = page.locator('a[href*="/wali/invite?token="]').first();
  await link.waitFor({ timeout: 20_000 });
  return link.getAttribute("href");
}

async function nameWali(page, { name, relationship, email }) {
  await page.goto(`${BASE}/onboarding/guardian`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', name);
  await page.selectOption('select[name="relationship"]', relationship);
  await page.fill('input[name="email"]', email);
  await page.click('main button[type="submit"]');
  await page.waitForTimeout(2500);
  return devLink(page);
}

/** Signs an account in, on the page given. Accepting a first invitation
 *  creates his account and lands him on the sign-in page, which is where
 *  a real wali would also find himself. */
async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PASSWORD);
  await page.click('main button[type="submit"]');
  await page.waitForTimeout(2500);
}

/** He opens the link and accepts. `page` is his own, signed-in page when
 *  he already has an account — the second-daughter case. */
async function accept(browser, link, { page } = {}) {
  const ctx = page ?? (await (await browser.newContext()).newPage());
  await ctx.goto(String(link), { waitUntil: "networkidle" });
  const needsPassword = (await ctx.locator('input[name="password"]').count()) > 0;
  if (needsPassword) await ctx.fill('input[name="password"]', PASSWORD);
  await ctx.click('button:has-text("I accept")');
  await ctx.waitForTimeout(3000);
  return ctx;
}

requireRevealedLinks("The two-walis flow");

(async () => {
  await mongo.connect();
  const db = mongo.db(dbName);
  const browser = await chromium.launch();
  const emails = [SISTER_A, SISTER_B, BROTHER, FATHER, UNCLE];

  try {
    /* ---------- a sister, and two walis --------------------------- */
    const her = await register(browser, "sister", "Fatima", SISTER_A);
    await assertOurApp(her.page);

    const firstLink = await nameWali(her.page, {
      name: "Ahmed Al Rashid",
      relationship: "father",
      email: FATHER,
    });
    check("her first wali is invited", Boolean(firstLink));

    const fatherPage = await accept(browser, firstLink);
    /* Accepting his first invitation created his account and left him at
       the sign-in page, which is where a real wali lands too. */
    await signIn(fatherPage, FATHER);
    const afterFirst = await db
      .collection("guardianships")
      .countDocuments({ status: "confirmed" });
    check("he confirms", afterFirst > 0);

    await her.page.goto(`${BASE}/onboarding/guardian`, { waitUntil: "networkidle" });
    const withOne = await her.page.evaluate(() => document.body.innerText);
    check("his name is on her screen", /Ahmed Al Rashid/.test(withOne));
    check(
      "and she is offered a second wali rather than a replacement",
      /Name another wali/i.test(withOne),
      withOne.replace(/\s+/g, " ").slice(0, 240)
    );

    /* The second name. This is the bug the client reported: it used to
       replace the first man rather than join him. */
    await her.page.click('button:has-text("Name another wali")');
    await her.page.waitForTimeout(600);
    await her.page.fill('input[name="name"]', "Yusuf Karim");
    await her.page.selectOption('select[name="relationship"]', "uncle");
    await her.page.fill('input[name="email"]', UNCLE);
    await her.page.click('main button[type="submit"]');
    await her.page.waitForTimeout(2500);
    const secondLink = await devLink(her.page);
    check("a second invitation goes out", Boolean(secondLink));

    const sisterUser = await db.collection("users").findOne({ email: SISTER_A });
    const afterInvite = await db
      .collection("guardianships")
      .find({ memberUserId: String(sisterUser._id) })
      .toArray();
    check(
      "the first wali is still confirmed while the second is pending",
      afterInvite.filter((g) => g.status === "confirmed").length === 1 &&
        afterInvite.filter((g) => g.status === "invited").length === 1,
      afterInvite.map((g) => g.status).join(",")
    );

    await accept(browser, secondLink);
    const bothConfirmed = await db
      .collection("guardianships")
      .find({ memberUserId: String(sisterUser._id), status: "confirmed" })
      .toArray();
    check(
      "both of them are her walis, and neither was dropped",
      bothConfirmed.length === 2,
      bothConfirmed.map((g) => `${g.invited.name}:${g.status}`).join(" | ")
    );

    await her.page.goto(`${BASE}/onboarding/guardian`, { waitUntil: "networkidle" });
    const withTwo = await her.page.evaluate(() => document.body.innerText);
    check("her screen lists both", /Ahmed Al Rashid/.test(withTwo) && /Yusuf Karim/.test(withTwo));
    check("and offers no third", !/Name another wali/i.test(withTwo));

    /* ---------- both of them sit in her conversation --------------- */
    /* Driven through the database rather than the pool: who may ask whom
       is pool-flow's subject, and this one is about the seats. */
    const him = await register(browser, "brother", "Bilal", BROTHER);
    const brotherUser = await db.collection("users").findOne({ email: BROTHER });
    const now = new Date();
    await db
      .collection("profiles")
      .updateMany(
        { userId: { $in: [sisterUser._id, brotherUser._id] } },
        { $set: { status: "live", liveAt: now } }
      );
    const requestId = new ObjectId();
    await db.collection("connectionRequests").insertOne({
      _id: requestId,
      pairKey: `${brotherUser._id}:${sisterUser._id}`,
      fromUserId: String(brotherUser._id),
      toUserId: String(sisterUser._id),
      state: "pending",
      sentAt: now,
      expiresAt: new Date(now.getTime() + 14 * 86_400_000),
      answeredAt: null,
      declineReason: null,
      conversationId: null,
    });

    await her.page.goto(`${BASE}/requests`, { waitUntil: "networkidle" });
    await her.page.click('button:has-text("Accept")');
    await her.page.waitForTimeout(3500);

    const conversation = await db.collection("conversations").findOne({
      requestId: requestId.toHexString(),
    });
    const waliSeats = (conversation?.participants ?? []).filter((p) => p.role === "wali");
    check(
      "both walis are seated in the conversation",
      waliSeats.length === 2,
      `${waliSeats.length} wali seat(s)`
    );

    const thread = `${BASE}/conversations/${conversation._id.toHexString()}`;
    await fatherPage.goto(thread, { waitUntil: "networkidle" });
    const fatherSees = await fatherPage.evaluate(() => document.body.innerText);
    check("the first wali can read it", /Assalamu|conversation|message/i.test(fatherSees));
    check("and the banner names both", /Ahmed Al Rashid/.test(fatherSees) && /Yusuf Karim/.test(fatherSees), fatherSees.replace(/\s+/g, " ").slice(0, 220));

    /* ---------- one address, a second daughter --------------------- */
    const her2 = await register(browser, "sister", "Khadija", SISTER_B);
    const secondDaughterLink = await nameWali(her2.page, {
      name: "Ahmed Al Rashid",
      relationship: "father",
      email: FATHER,
    });
    check("his second daughter can name the same address", Boolean(secondDaughterLink));

    /* Opened in a browser where he is not signed in: he is told to sign
       in, and the link brings him back here rather than dropping him. */
    const stranger = await (await browser.newContext()).newPage();
    await stranger.goto(String(secondDaughterLink), { waitUntil: "networkidle" });
    await stranger.click('button:has-text("I accept")');
    await stranger.waitForTimeout(2500);
    const strandedText = await stranger.evaluate(() => document.body.innerText);
    check(
      "an existing account is not treated as a problem to sort out",
      !/delete/i.test(strandedText) && /sign in/i.test(strandedText),
      strandedText.replace(/\s+/g, " ").slice(0, 200)
    );
    const back = await stranger.locator('a[href*="/login?next="]').first().getAttribute("href");
    check(
      "and the sign-in link carries him back to the invitation",
      Boolean(back && back.includes(encodeURIComponent("/wali/invite?token="))),
      String(back)
    );
    await stranger.close();

    /* In his own signed-in browser it goes straight through. */
    await accept(browser, secondDaughterLink, { page: fatherPage });
    const sister2 = await db.collection("users").findOne({ email: SISTER_B });
    const forSecond = await db
      .collection("guardianships")
      .find({ memberUserId: String(sister2._id), status: "confirmed" })
      .toArray();
    check(
      "one man is wali for both daughters, on one address",
      forSecond.length === 1,
      forSecond.map((g) => g.status).join(",")
    );

    await fatherPage.goto(`${BASE}/wali`, { waitUntil: "networkidle" });
    const portal = await fatherPage.evaluate(() => document.body.innerText);
    check("his portal lists both wards", /Fatima|F\.F/.test(portal) && /Khadija|K\.F/.test(portal), portal.replace(/\s+/g, " ").slice(0, 240));
  } finally {
    await browser.close();
    for (const email of emails) {
      const user = await db.collection("users").findOne({ email });
      if (!user) continue;
      const id = new ObjectId(user._id);
      await db.collection("guardianships").deleteMany({
        $or: [{ memberUserId: String(id) }, { waliUserId: String(id) }],
      });
      for (const c of ["profiles", "sessions", "verificationTokens", "auditLog", "notifications"]) {
        await db.collection(c).deleteMany({ userId: { $in: [id, String(id)] } });
      }
      await db.collection("connectionRequests").deleteMany({
        $or: [{ fromUserId: String(id) }, { toUserId: String(id) }],
      });
      await db.collection("conversations").deleteMany({ "participants.userId": String(id) });
      await db.collection("users").deleteOne({ _id: id });
    }
    console.log("\ncleaned up the fixture accounts");
    await mongo.close();
  }

  console.log(bad ? `\n${bad} wali check(s) FAILED\n` : `\ntwo walis, and one address for two daughters\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
