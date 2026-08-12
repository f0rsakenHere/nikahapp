/* End-to-end check of the member account features: email verification,
 * password reset, password change, and the signed-in device list.
 *
 * These are the flows where a mistake is a security hole rather than a
 * bug, so the checks lean on the negative cases — a link used twice, a
 * link used for the wrong thing, a reset that leaves old sessions alive.
 *
 * Creates one throwaway account and deletes it. Exits non-zero on any
 * failure, and if it ran no checks.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/account-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const STAMP = Date.now();
const EMAIL = `accountflow+${STAMP}@example.invalid`;
const PASSWORD = "a-long-enough-passphrase";
const NEW_PASSWORD = "an-entirely-different-one";

const findings = [];
let checks = 0;

function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

async function signIn(page, password) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  /* Waited on, not slept through. A correct password lands on the
     dashboard, and on a cold dev server that route can take longer to
     compile than any fixed pause — which then reads as "the password
     was rejected". A refusal keeps us on /login, so this settles either
     way. */
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 }).catch(() => {});
  await page.waitForLoadState("networkidle").catch(() => {});
  return new URL(page.url()).pathname;
}

/** The link that would have been emailed, read off the dev panel.
 *
 *  Counts before reading. `getAttribute` waits for the element, so
 *  asserting a link is *absent* with it costs a 30-second timeout and
 *  then fails as a crash rather than as a check. */
async function devLink(page) {
  const links = page.locator('a[href*="token="]');
  if ((await links.count()) === 0) return null;
  return links.first().getAttribute("href");
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
    const ctx = await browser.newContext();
    const p = await ctx.newPage();

    await p.goto(BASE + "/register", { waitUntil: "networkidle" });
    await assertOurApp(p);
    await p.click('label:has(input[name="gender"][value="brother"])');
    await p.fill('input[name="firstName"]', "Testonly");
    await fillDob(p, "1995-04-12");
    await p.fill('input[name="email"]', EMAIL);
    await p.fill('input[name="password"]', PASSWORD);
    await p.check('input[name="marriageIntention"]');
    await p.check('input[name="terms"]');
    await p.click('button[type="submit"]');
    await p.waitForURL("**/onboarding", { timeout: 20_000 });

    const user = await db.collection("users").findOne({ email: EMAIL });
    check("a new account starts unverified", user && user.emailVerifiedAt === null);

    /* ---------- the public pages are reachable signed out ----------- */
    {
      const anon = await browser.newContext();
      const q = await anon.newPage();
      for (const route of ["/forgot-password", "/reset-password", "/verify-email"]) {
        await q.goto(BASE + route, { waitUntil: "networkidle" });
        check(`${route} is reachable without signing in`, new URL(q.url()).pathname === route, q.url());
      }
      await anon.close();
    }

    /* ---------- email verification ---------------------------------- */
    await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
    check("settings says the address is not confirmed", /Not confirmed yet/.test(await p.textContent("body")));

    await p.click('button:has-text("Send me a confirmation link")');
    await p.waitForTimeout(2500);
    const verifyLink = await devLink(p);
    check("a verification link was issued", !!verifyLink);
    check(
      "the token is stored only as a digest",
      !!verifyLink &&
        (await db.collection("verificationTokens").countDocuments({
          tokenHash: new URL(verifyLink).searchParams.get("token"),
        })) === 0
    );

    /* Wrong purpose: a verification link must not reset a password. */
    const asReset = verifyLink.replace("/verify-email", "/reset-password");
    const q = await ctx.newPage();
    await q.goto(asReset, { waitUntil: "networkidle" });
    await q.fill('input[name="password"]', "some-other-password");
    await q.click('button[type="submit"]');
    await q.waitForTimeout(2500);
    check(
      "a verification token cannot be used to reset a password",
      /no longer valid|already been used/i.test(await q.textContent("body"))
    );
    const stillUnverified = await db.collection("users").findOne({ email: EMAIL });
    check("and it did not change the password", stillUnverified.passwordHash === user.passwordHash);
    await q.close();

    /* That attempt consumed it, so ask for a fresh one. */
    await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
    await p.click('button:has-text("Send me a confirmation link")');
    await p.waitForTimeout(2500);
    const link2 = await devLink(p);

    await p.goto(link2, { waitUntil: "networkidle" });
    check("the link confirms the address", /Email confirmed/.test(await p.textContent("body")));
    const verified = await db.collection("users").findOne({ email: EMAIL });
    check("the account records the confirmation", !!verified.emailVerifiedAt);

    await p.goto(link2, { waitUntil: "networkidle" });
    check(
      "the same link a second time does nothing",
      /did not work|Already confirmed/.test(await p.textContent("body"))
    );

    /* ---------- password reset -------------------------------------- */
    const anon = await browser.newContext();
    const r = await anon.newPage();

    await r.goto(BASE + "/forgot-password", { waitUntil: "networkidle" });
    await r.fill('input[name="email"]', `nobody+${STAMP}@example.invalid`);
    await r.click('button[type="submit"]');
    await r.waitForTimeout(2000);
    const unknownAnswer = (await r.textContent("body")).includes("If that address has an account");
    check("an unknown address gets the non-committal answer", unknownAnswer);
    check("and no link is produced for it", !(await devLink(r)));

    await r.goto(BASE + "/forgot-password", { waitUntil: "networkidle" });
    await r.fill('input[name="email"]', EMAIL);
    await r.click('button[type="submit"]');
    await r.waitForTimeout(2500);
    check(
      "a known address gets the identical answer",
      (await r.textContent("body")).includes("If that address has an account")
    );
    const resetLink = await devLink(r);
    check("a reset link was issued", !!resetLink);

    await r.goto(resetLink, { waitUntil: "networkidle" });
    await r.fill('input[name="password"]', "short");
    await r.click('button[type="submit"]');
    await r.waitForTimeout(2000);
    check("a too-short password is refused", /at least 10/i.test(await r.textContent("body")));
    /* The length check runs before the token is consumed, on purpose:
       mistyping a short password must not cost you the link. */
    check(
      "and the link was not burned by the failed attempt",
      (await db
        .collection("verificationTokens")
        .countDocuments({ userId: String(user._id), purpose: "resetPassword" })) === 1
    );

    await r.goto(resetLink, { waitUntil: "networkidle" });
    await r.fill('input[name="password"]', NEW_PASSWORD);
    await r.click('button[type="submit"]');
    await r.waitForURL("**/login**", { timeout: 20_000 });
    check("resetting lands back on sign in", new URL(r.url()).pathname === "/login", r.url());
    check("with a message saying so", /has been reset/i.test(await r.textContent("body")));

    check(
      "every session was destroyed by the reset",
      (await db.collection("sessions").countDocuments({ userId: String(user._id) })) === 0
    );

    await r.goto(resetLink, { waitUntil: "networkidle" });
    await r.fill('input[name="password"]', "yet-another-password");
    await r.click('button[type="submit"]');
    await r.waitForTimeout(2000);
    check(
      "the reset link cannot be used twice",
      /already been used|no longer valid/i.test(await r.textContent("body"))
    );

    /* The original session was signed out by the reset. */
    await p.goto(BASE + "/settings", { waitUntil: "networkidle" });
    check(
      "the session open elsewhere was signed out",
      new URL(p.url()).pathname === "/login",
      p.url()
    );

    check("the old password no longer works", (await signIn(r, PASSWORD)) === "/login");
    check("the new password does", (await signIn(r, NEW_PASSWORD)) === "/dashboard");

    /* ---------- change password ------------------------------------- */
    await r.goto(BASE + "/settings", { waitUntil: "networkidle" });
    await r.fill('input[name="currentPassword"]', "not-the-current-one");
    await r.fill('input[name="newPassword"]', "another-good-passphrase");
    await r.click('button:has-text("Change password")');
    await r.waitForTimeout(2500);
    check(
      "changing without the current password is refused",
      /not your current password/i.test(await r.textContent("body"))
    );

    await r.fill('input[name="currentPassword"]', NEW_PASSWORD);
    await r.fill('input[name="newPassword"]', "another-good-passphrase");
    await r.click('button:has-text("Change password")');
    await r.waitForURL("**/login**", { timeout: 20_000 });
    check("changing it signs you out", /has been changed/i.test(await r.textContent("body")));
    check(
      "and destroys every session",
      (await db.collection("sessions").countDocuments({ userId: String(user._id) })) === 0
    );
    check("the new one works", (await signIn(r, "another-good-passphrase")) === "/dashboard");

    /* ---------- the device list ------------------------------------- */
    await r.goto(BASE + "/settings", { waitUntil: "networkidle" });
    const rows = await r.locator("ul li").count();
    check("the device list shows this session", rows >= 1, `${rows} rows`);
    check("and marks it as the current one", /this device/.test(await r.textContent("body")));

    await anon.close();
    await ctx.close();
  } finally {
    await browser.close();
    const user = await db.collection("users").findOne({ email: EMAIL });
    if (user) {
      await db.collection("sessions").deleteMany({ userId: String(user._id) });
      await db.collection("verificationTokens").deleteMany({ userId: String(user._id) });
      await db.collection("profiles").deleteMany({ userId: user._id });
      await db.collection("users").deleteOne({ _id: user._id });
      console.log("\ncleaned up the fixture account");
    }
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
  console.log(`\nall ${checks} account checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
