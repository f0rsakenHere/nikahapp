/* Creates a staff account.
 *
 * There is no admin UI yet, and there is a chicken-and-egg problem
 * underneath it: the staff console will only be reachable by staff, and
 * nobody is staff. So the first accounts are made here, deliberately —
 * from a machine with the database credentials, not from a form on the
 * internet.
 *
 * The account is created with 2FA *required but not yet configured*:
 * `UserSchema` refuses a staff account with `mfa.enabled: false`, so the
 * secret is enrolled on first sign-in through /settings. That means this
 * script cannot hand anyone a fully working staff login on its own,
 * which is the point.
 *
 *   node scripts/create-staff.cjs someone@example.com "Their Name" admin
 */
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { randomBytes, createHmac } = require("node:crypto");
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

/* A password nobody knows, including us. They set their own through the
   reset flow — which means the account cannot be signed into from this
   script's output, and there is no shared secret in anyone's terminal
   history. */
const password = randomBytes(24).toString("base64url");

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
      "They cannot sign in yet, and that is deliberate. Two things must happen:",
      "",
      "  1. They set a password via /forgot-password — no password was chosen",
      "     here, so none of us knows one.",
      "  2. They enrol an authenticator app. The account already requires a",
      "     second factor; until a secret is enrolled, sign-in is impossible.",
      "",
      "⚠ Step 2 has no path yet for an account that cannot sign in — enrolment",
      "  lives behind /settings. Until the staff console handles it, enrol the",
      "  secret while signed in as them, or add an unauthenticated enrolment",
      "  step to the reset flow.",
      "",
    ].join("\n")
  );
})()
  .catch((err) => {
    console.error(`\nFAIL  ${err && err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
