/* End-to-end check of staff accounts, mandatory 2FA, and the audit log.
 *
 * Creates a staff account the way the real script does, signs in with a
 * genuine TOTP code computed here, and checks that a half-authenticated
 * session reaches nothing.
 *
 *   BASE=http://127.0.0.1:3007 node scripts/staff-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { createHmac, createHash, randomBytes } = require("node:crypto");
const argon2 = require("@node-rs/argon2");
const { BASE, assertOurApp } = require("./lib/base.cjs");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const STAMP = Date.now();
const STAFF = `staffflow+${STAMP}@example.invalid`;
const MEMBER = `staffflow+member${STAMP}@example.invalid`;
const PASSWORD = "a-long-enough-passphrase";

const findings = [];
let checks = 0;

function check(name, ok, detail = "") {
  checks++;
  if (!ok) findings.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${ok ? "pass " : "FAIL "} ${name}${detail && !ok ? `  (${detail})` : ""}`);
  return ok;
}

/* An independent TOTP, written from RFC 6238 rather than imported from
   the app, so a bug in src/lib/auth/totp.ts cannot agree with itself. */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input) {
  let bits = 0, value = 0;
  const out = [];
  for (const c of input.toUpperCase().replace(/=+$/, "")) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function totp(secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 30000);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const d = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = d[d.length - 1] & 0x0f;
  const n = ((d[o] & 0x7f) << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3];
  return String(n % 1e6).padStart(6, "0");
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
    /* ---------- a staff account, as scripts/create-staff.cjs makes it -- */
    const staffId = new ObjectId();
    await db.collection("users").insertOne({
      _id: staffId,
      email: STAFF,
      emailVerifiedAt: null,
      passwordHash: await argon2.hash(PASSWORD, {
        algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1,
      }),
      roles: ["staff"],
      status: "active",
      locale: "en-CA",
      legalName: { first: "Staff", last: "Fixture" },
      phone: null,
      dateOfBirth: null,
      mfa: { enabled: true, secret: null },
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: 0,
      closedAt: null,
      closureReason: null,
    });

    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(BASE + "/login", { waitUntil: "networkidle" });
    await assertOurApp(p);

    /* ---------- the bootstrap link, with no email anywhere ------------
       scripts/create-staff.cjs mints a reset token and prints it, because
       the password is the one part of staff onboarding that would
       otherwise need a provider. Built here the same way. */
    {
      const setupToken = randomBytes(32).toString("base64url");
      await db.collection("verificationTokens").insertOne({
        _id: new ObjectId(),
        tokenHash: createHash("sha256").update(setupToken).digest("hex"),
        purpose: "resetPassword",
        userId: staffId.toHexString(),
        email: STAFF,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const boot = await (await browser.newContext()).newPage();
      await boot.goto(`${BASE}/reset-password?token=${setupToken}`, { waitUntil: "networkidle" });
      check("the setup link opens the password screen", /Choose a new password/.test(await boot.textContent("body")));

      await boot.fill('input[name="password"]', PASSWORD);
      await boot.click('button[type="submit"]');
      await boot.waitForURL("**/login**", { timeout: 20_000 });
      check("setting the first password lands on sign in", /has been reset/i.test(await boot.textContent("body")));
      await boot.close();
    }

    /* ---------- first sign-in goes to enrolment, not a code prompt ---- */
    await p.fill('input[name="email"]', STAFF);
    await p.fill('input[name="password"]', PASSWORD);
    await p.click('button[type="submit"]');
    await p.waitForTimeout(3000);
    check("a staff sign-in lands on the second factor", new URL(p.url()).pathname === "/mfa", p.url());
    check(
      "with no secret enrolled it offers setup, not a challenge",
      /Set up two-factor/.test(await p.textContent("body"))
    );

    /* ---------- half-authenticated reaches nothing -------------------- */
    for (const route of ["/onboarding", "/settings", "/wali"]) {
      await p.goto(BASE + route, { waitUntil: "networkidle" });
      check(
        `a half-authenticated session cannot reach ${route}`,
        new URL(p.url()).pathname === "/login",
        p.url()
      );
    }

    /* ---------- enrol with a real code ------------------------------- */
    await p.goto(BASE + "/mfa", { waitUntil: "networkidle" });
    await p.waitForSelector("code", { timeout: 15_000 });
    const secret = (await p.textContent("code")).trim();
    check("a base32 secret is offered", /^[A-Z2-7]{32}$/.test(secret), secret.slice(0, 12));

    await p.fill('input[name="code"]', "000000");
    await p.click('button[type="submit"]');
    await p.waitForTimeout(2500);
    check("a wrong code is refused", /not right/i.test(await p.textContent("body")));
    const notYet = await db.collection("users").findOne({ _id: staffId });
    check("and nothing was stored", notYet.mfa.secret === null);

    /* The secret changes on each render of the page, so re-read it. */
    const secret2 = (await p.inputValue('input[name="secret"]')) || secret;
    await p.fill('input[name="code"]', totp(secret2));
    await p.click('button[type="submit"]');
    await p.waitForTimeout(3000);
    check(
      "a real code finishes the sign-in",
      new URL(p.url()).pathname !== "/mfa" && new URL(p.url()).pathname !== "/login",
      p.url()
    );

    const enrolled = await db.collection("users").findOne({ _id: staffId });
    check("the secret was stored", typeof enrolled.mfa.secret === "string");
    check("and 2FA is on", enrolled.mfa.enabled === true);

    /* ---------- signing in again now asks for a code ----------------- */
    const ctx2 = await browser.newContext();
    const q = await ctx2.newPage();
    await q.goto(BASE + "/login", { waitUntil: "networkidle" });
    await q.fill('input[name="email"]', STAFF);
    await q.fill('input[name="password"]', PASSWORD);
    await q.click('button[type="submit"]');
    await q.waitForTimeout(3000);
    check("a second sign-in asks for the code", /Enter your code/.test(await q.textContent("body")));

    await q.fill('input[name="code"]', "111111");
    await q.click('button[type="submit"]');
    await q.waitForTimeout(2500);
    check("a wrong code is refused there too", /not right/i.test(await q.textContent("body")));

    await q.fill('input[name="code"]', totp(enrolled.mfa.secret));
    await q.click('button[type="submit"]');
    await q.waitForTimeout(3000);
    check("the right code gets in", new URL(q.url()).pathname !== "/mfa", q.url());

    /* ---------- a member is not asked for a code --------------------- */
    const m = await (await browser.newContext()).newPage();
    await m.goto(BASE + "/register", { waitUntil: "networkidle" });
    await m.click('label:has(input[name="gender"][value="brother"])');
    await m.fill('input[name="firstName"]', "Testonly");
    await m.fill('input[name="dateOfBirth"]', "1995-04-12");
    await m.fill('input[name="email"]', MEMBER);
    await m.fill('input[name="password"]', PASSWORD);
    await m.check('input[name="marriageIntention"]');
    await m.check('input[name="terms"]');
    await m.click('button[type="submit"]');
    await m.waitForURL("**/onboarding", { timeout: 20_000 });
    check("a member is not forced through a second factor", new URL(m.url()).pathname === "/onboarding");

    /* ---------- the audit log ---------------------------------------- */
    const staffEntries = await db
      .collection("auditLog")
      .find({ "subject.id": staffId.toHexString() })
      .toArray();
    const actions = staffEntries.map((e) => e.action);
    check("the failed second factor was logged", actions.includes("account.mfaChallengeFailed"));
    check("enabling 2FA was logged", actions.includes("account.mfaEnabled"));
    check("the sign-in was logged", actions.includes("account.signedIn"));

    const member = await db.collection("users").findOne({ email: MEMBER });
    const memberEntries = await db
      .collection("auditLog")
      .find({ "subject.id": String(member._id) })
      .toArray();
    check("registration was logged", memberEntries.some((e) => e.action === "account.registered"));

    const everything = JSON.stringify([...staffEntries, ...memberEntries]);
    check("no password reached the log", !everything.includes(PASSWORD));
    check("no TOTP secret reached the log", !everything.includes(enrolled.mfa.secret));
    check(
      "every entry records who did it and when",
      [...staffEntries, ...memberEntries].every((e) => e.at && e.actor && e.subject?.id)
    );

    await ctx.close();
    await ctx2.close();
  } finally {
    await browser.close();
    for (const email of [STAFF, MEMBER]) {
      const u = await db.collection("users").findOne({ email });
      if (!u) continue;
      await db.collection("sessions").deleteMany({ userId: String(u._id) });
      await db.collection("profiles").deleteMany({ userId: u._id });
      await db.collection("auditLog").deleteMany({ "subject.id": String(u._id) });
      await db.collection("verificationTokens").deleteMany({ userId: String(u._id) });
      await db.collection("users").deleteOne({ _id: u._id });
    }
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
  console.log(`\nall ${checks} staff checks pass`);
})().catch((err) => {
  console.error("\n" + (err && err.stack));
  process.exit(1);
});
