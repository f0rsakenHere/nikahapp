/* Creates a staff account.
 *
 * There is no admin UI yet, and there is a chicken-and-egg problem
 * underneath it: the staff console will only be reachable by staff, and
 * nobody is staff. So the first accounts are made here, deliberately —
 * from a machine with the database credentials, not from a form on the
 * internet.
 *
 * The account is created with 2FA required and no secret enrolled, so
 * the first sign-in goes straight to authenticator setup. TOTP needs no
 * email — it is a shared secret and a clock.
 *
 * Setting the first password would, though: the reset flow sends a link,
 * and no email provider has been supplied. So the script mints that link
 * itself and prints it here. Hand it over in person or on a channel you
 * trust; it works once and expires in an hour.
 *
 *   node scripts/create-staff.cjs someone@example.com "Their Name" admin
 */
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { randomBytes, createHash } = require("node:crypto");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

const [email, name, ...roleArgs] = process.argv.slice(2);
const roles = roleArgs.length ? roleArgs : ["staff"];

const VALID = ["staff", "verifier", "admin"];

if (!email || !name) {
  console.error(
    "\nusage: node scripts/create-staff.cjs <email> <full name> [role…]\n" +
      `       roles: ${VALID.join(", ")}  (default: staff)\n`
  );
  process.exit(1);
}
for (const role of roles) {
  if (!VALID.includes(role)) {
    console.error(`\n"${role}" is not a staff role. Use one of: ${VALID.join(", ")}\n`);
    process.exit(1);
  }
}

/* A password nobody knows, including us — not even briefly, and not in
   anyone's shell history. They set their own with the link below. */
const password = randomBytes(24).toString("base64url");

const APP_ORIGIN = process.env.APP_ORIGIN || "http://localhost:3000";

/* One hour, matching TOKEN_TTL_MS.resetPassword in src/lib/auth/tokens.ts.
   Deliberately not longer for a staff account. */
const SETUP_TTL_MS = 60 * 60 * 1000;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection("users");

  const lower = email.trim().toLowerCase();
  if (await users.findOne({ email: lower })) {
    console.error(`\nAn account already exists for ${lower}.\n`);
    process.exitCode = 1;
    return;
  }

  /* argon2 lives in the app's dependencies; requiring it here keeps this
     script honest about using the same hashing the app does. */
  const argon2 = require("@node-rs/argon2");
  const passwordHash = await argon2.hash(password, {
    algorithm: 2, // Argon2id
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const [first, ...rest] = name.trim().split(/\s+/);
  const now = new Date();
  const _id = new ObjectId();

  await users.insertOne({
    _id,
    email: lower,
    emailVerifiedAt: null,
    passwordHash,
    roles,
    status: "active",
    locale: "en-CA",
    legalName: { first, ...(rest.length ? { last: rest.join(" ") } : {}) },
    phone: null,
    dateOfBirth: null,
    /* Enabled with no secret: the schema demands 2FA for these roles,
       and the secret is set on first sign-in. Until then the account
       exists and cannot be used, which is the safe direction to fail. */
    mfa: { enabled: true, secret: null },
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    tokenVersion: 0,
    closedAt: null,
    closureReason: null,
  });

  /* The setup link: an ordinary password-reset token, created here so
     the account is reachable without an email provider. Same collection,
     same shape, same expiry — the reset screen cannot tell the
     difference, and there is no second code path to keep correct. */
  const setupToken = randomBytes(32).toString("base64url");
  await db.collection("verificationTokens").insertOne({
    _id: new ObjectId(),
    tokenHash: createHash("sha256").update(setupToken).digest("hex"),
    purpose: "resetPassword",
    userId: _id.toHexString(),
    email: lower,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SETUP_TTL_MS),
  });

  await db.collection("auditLog").insertOne({
    _id: new ObjectId(),
    at: now,
    actor: { userId: null, role: null, ip: null, userAgent: null, impersonatedBy: null },
    action: "account.registered",
    subject: { type: "user", id: _id.toHexString() },
    meta: { roles, createdBy: "scripts/create-staff.cjs" },
  });

  console.log(
    [
      "",
      `Created ${lower} with roles: ${roles.join(", ")}`,
      "",
      "Send them this link. It works once and expires in an hour:",
      "",
      `  ${APP_ORIGIN}/reset-password?token=${setupToken}`,
      "",
      "It is a live credential — hand it over in person or on a channel you",
      "trust, not by anything you would not send a password over.",
      "",
      "They set a password with it, and the first sign-in then takes them",
      "straight to authenticator setup rather than a code prompt, because the",
      "account requires a second factor and has none enrolled.",
      "",
      "No email is involved in any of that. TOTP is a shared secret and a",
      "clock; nothing is sent. Only this first link would normally have been",
      "emailed, which is why the script mints it instead.",
      "",
      `If ${APP_ORIGIN} is wrong, set APP_ORIGIN and run this again.`,
      "",
    ].join("\n")
  );
})()
  .catch((err) => {
    console.error(`\nFAIL  ${err && err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
