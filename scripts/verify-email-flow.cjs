/* The whole confirmation loop, walked the way a member walks it.
 *
 * The sign-up checker proves a token was minted. That is not the same as
 * the thing working: a token nobody can reach, or a link that lands on a
 * page which does not consume it, would pass that check and fail the
 * member. So this one goes the whole way — register, take the link out
 * of the email itself, open it in the browser, and then ask the database
 * whether the account is actually confirmed.
 *
 * The link is read from the dev server's own output, which is where
 * `send()` prints the message when no provider is configured. That is
 * the real email body, not a reconstruction: the token is stored only as
 * a digest, so there is no way to rebuild the link from the database and
 * any checker that tried would be testing its own arithmetic.
 *
 *   LOG=/path/to/dev-server.log node scripts/verify-email-flow.cjs
 */
const fs = require("fs");
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");

loadEnv();

const LOG = process.env.LOG;
if (!LOG || !fs.existsSync(LOG)) {
  console.error("\nFAIL  point LOG at the dev server's output file:\n");
  console.error("  LOG=/tmp/dev.log node scripts/verify-email-flow.cjs\n");
  console.error("It is where send() prints the message while no email provider is");
  console.error("configured, and the only place the un-hashed link exists.\n");
  process.exit(1);
}

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const STAMP = Date.now();
const EMAIL = `verifyloop+${STAMP}@example.invalid`;
const PASSWORD = "a-long-enough-passphrase";

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

/** The verification link for this run, out of the printed email. */
function linkFromLog(sinceByte) {
  const fd = fs.openSync(LOG, "r");
  const size = fs.fstatSync(fd).size;
  const buf = Buffer.alloc(Math.max(0, size - sinceByte));
  if (buf.length) fs.readSync(fd, buf, 0, buf.length, sinceByte);
  fs.closeSync(fd);
  const text = buf.toString("utf8");
  const matches = [...text.matchAll(/https?:\/\/\S*\/verify-email\?token=[A-Za-z0-9_-]+/g)];
  return matches.length ? matches[matches.length - 1][0] : null;
}

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const browser = await chromium.launch();
  const startedAt = fs.statSync(LOG).size;

  try {
    const p = await browser.newPage({ viewport: { width: 500, height: 1000 } });
    await p.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90_000 });
    await assertOurApp(p);

    await p.click('label:has(input[name="gender"][value="brother"])');
    await p.fill('input[name="firstName"]', "Loop");
    await p.fill('input[name="lastName"]', "Fixture");
    await fillDob(p, "1995-04-12");
    await p.fill('input[name="email"]', EMAIL);
    await p.fill('input[name="password"]', PASSWORD);
    await p.check('input[name="marriageIntention"]');
    await p.check('input[name="terms"]');
    await p.click('button[type="submit"]');
    await p.waitForURL("**/onboarding", { timeout: 30_000 });

    const user = await db.collection("users").findOne({ email: EMAIL });
    check("the account exists and starts unconfirmed", user && user.emailVerifiedAt === null);

    /* The email is written after the redirect returns, so give it a
       moment to appear rather than assuming it is already there. */
    let link = null;
    for (let i = 0; i < 30 && !link; i++) {
      link = linkFromLog(startedAt);
      if (!link) await new Promise((r) => setTimeout(r, 500));
    }
    check("an email with a verification link was actually sent", Boolean(link), "none in the log");
    if (!link) return;

    check("the link points at this app's verify page", link.includes("/verify-email?token="), link);

    /* Opened in a browser with no session at all. A confirmation link
       that only works while its owner happens to be signed in is a link
       that fails for the person who opens it on their phone. */
    const stranger = await (await browser.newContext()).newPage();
    const res = await stranger.goto(link, { waitUntil: "networkidle", timeout: 30_000 });
    check("the link opens", res && res.status() < 400, res && String(res.status()));

    const shown = await stranger.evaluate(() => document.body.innerText);
    check("and says it worked", /confirmed|thank you|verified/i.test(shown), shown.slice(0, 160));

    /* The claim on screen is not the evidence. The database is. */
    const after = await db.collection("users").findOne({ email: EMAIL });
    check("the account is now confirmed in the database", Boolean(after && after.emailVerifiedAt));

    /* Single use is the whole security property: a link that keeps
       working is a permanent credential sitting in an inbox. */
    await stranger.goto(link, { waitUntil: "networkidle", timeout: 30_000 });
    const again = await stranger.evaluate(() => document.body.innerText);
    check(
      "using it a second time does not work again",
      !/^.*confirmed just now/i.test(again) || /already|no longer|expired|invalid/i.test(again),
      again.slice(0, 160)
    );

    const tokensLeft = await db
      .collection("verificationTokens")
      .countDocuments({ userId: String(user._id), purpose: "verifyEmail" });
    check("and the token is gone from the database", tokensLeft === 0, `${tokensLeft} left`);

    await stranger.close();
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

  console.log(bad ? `\n${bad} check(s) FAILED\n` : `\nthe confirmation loop works end to end\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
