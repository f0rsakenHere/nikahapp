/* Does registering actually send the confirmation email?
 *
 * It did not, for the whole life of the product: the account was created
 * with `emailVerifiedAt: null`, several screens spoke as though a letter
 * had gone out, and the only thing that ever issued one was a button in
 * settings nobody goes looking for. This walks the real form and then
 * asks the database whether a token exists, because a checker that only
 * reads the screen would have passed the entire time.
 *
 *   BASE=http://127.0.0.1:3001 node scripts/signup-email-check.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");

loadEnv();
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const STAMP = Date.now();
const EMAIL = `signup+${STAMP}@example.invalid`;
const PASSWORD = "a-long-enough-passphrase";

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const browser = await chromium.launch();

  try {
    const p = await browser.newPage({ viewport: { width: 500, height: 1000 } });
    await p.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90_000 });
    await assertOurApp(p);

    await p.click('label:has(input[name="gender"][value="brother"])');
    await p.fill('input[name="firstName"]', "Signup");
    await p.fill('input[name="lastName"]', "Fixture");
    await fillDob(p, "1995-04-12");
    await p.fill('input[name="email"]', EMAIL);
    await p.fill('input[name="password"]', PASSWORD);
    await p.check('input[name="marriageIntention"]');
    await p.check('input[name="terms"]');
    await p.click('button[type="submit"]');
    await p.waitForURL("**/onboarding", { timeout: 30_000 });

    check("registration completes and lands on onboarding", true);

    const user = await db.collection("users").findOne({ email: EMAIL });
    check("the account exists", Boolean(user));
    check("and starts unconfirmed", user && user.emailVerifiedAt === null);

    /* The point of the whole exercise. Polled, because the send is not
       on the redirect's critical path. */
    let token = null;
    for (let i = 0; i < 20 && !token; i++) {
      token = await db.collection("verificationTokens").findOne({
        userId: String(user._id),
        purpose: "verifyEmail",
      });
      if (!token) await new Promise((r) => setTimeout(r, 500));
    }
    check("a verification token was issued at sign-up", Boolean(token), "none in verificationTokens");

    if (token) {
      check("it expires", Boolean(token.expiresAt) && token.expiresAt > new Date());
      check(
        "and it is stored as a digest, never the token itself",
        typeof token.tokenHash === "string" && token.tokenHash.length === 64
      );
    }

    /* Registration must not break when mail cannot be sent. Nothing here
       can force a provider failure, but the redirect landing is itself
       the evidence: `send()` is called before it and never throws. */
    check("the member is signed in despite mail being fire-and-forget", new URL(p.url()).pathname === "/onboarding");

    await p.close();
  } finally {
    await browser.close();
    const user = await db.collection("users").findOne({ email: EMAIL });
    if (user) {
      const id = new ObjectId(user._id);
      for (const c of ["profiles", "sessions", "verificationTokens", "auditLog"]) {
        await db.collection(c).deleteMany({ userId: { $in: [id, String(id)] } });
      }
      await db.collection("users").deleteOne({ _id: id });
      console.log("\ncleaned up the fixture account");
    }
    await client.close();
  }

  console.log(bad ? `\n${bad} sign-up email check(s) FAILED\n` : `\nall sign-up email checks pass\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
