/* Puts somebody in the moderator-as-wali seat.
 *
 * A woman with no father, brother or uncle who will take this on is
 * otherwise shut out of the product: she cannot go live, and no
 * conversation can ever open for her. This creates the account she can
 * name instead, and records it in settings so the option appears.
 *
 * The address and the name are arguments. Nothing here guesses at
 * NikahCanada's own email addresses, and nothing invents a person — the
 * name given is the name members will see in the banner on every one of
 * their conversations, so it should be a real one.
 *
 * The account is created with the `wali` role and no password. It is
 * reachable the same way any wali is: through the ordinary
 * password-reset flow, which is what the printed link does.
 *
 *   node scripts/create-moderator-wali.cjs --email wali@example.org --name "Imam Suleiman Diallo"
 *   node scripts/create-moderator-wali.cjs --clear     # empty the seat
 */
const { randomBytes, createHash } = require("node:crypto");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

const CLEAR = process.argv.includes("--clear");
const email = (arg("email") || "").trim().toLowerCase();
const name = (arg("name") || "").trim();

if (!CLEAR && (!email || !name)) {
  console.error("\nUsage: node scripts/create-moderator-wali.cjs --email <address> --name \"Full Name\"");
  console.error("       node scripts/create-moderator-wali.cjs --clear\n");
  process.exitCode = 1;
  return;
}

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const settings = db.collection("settings");

  if (CLEAR) {
    /* Settings live as one document, `{ key: "product", value: {...} }`
       — the same shape `readSettings` parses. */
    await settings.updateOne(
      { key: "product" },
      { $set: { key: "product", "value.moderatorWaliUserId": null } },
      { upsert: true }
    );
    console.log("The moderator seat is empty. The option is no longer offered anywhere.");
    console.log("Existing guardianships naming him are untouched — clear the seat, not the wali.");
    return;
  }

  const users = db.collection("users");
  const now = new Date();
  let user = await users.findOne({ email });

  if (user) {
    /* Already an account — add the role rather than refusing, so this
       can be pointed at an existing staff member. */
    await users.updateOne({ _id: user._id }, { $addToSet: { roles: "wali" } });
    console.log(`${email} already had an account; added the wali role.`);
  } else {
    const [first, ...rest] = name.split(/\s+/);
    const _id = new ObjectId();
    await users.insertOne({
      _id,
      email,
      emailVerifiedAt: now,
      /* No password. He sets one through the reset link below, which is
         the same door every other wali comes through. */
      passwordHash: null,
      roles: ["wali"],
      status: "active",
      locale: "en-CA",
      legalName: { first, ...(rest.length ? { last: rest.join(" ") } : {}) },
      phone: null,
      /* A wali is not asked for one — see the note on `dateOfBirth` in
         domain/user.ts. */
      dateOfBirth: null,
      mfa: { enabled: false, secret: null },
      lastLoginAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      tokenVersion: 0,
      closedAt: null,
      closureReason: null,
    });
    user = { _id };

    const token = randomBytes(32).toString("base64url");
    await db.collection("verificationTokens").insertOne({
      _id: new ObjectId(),
      userId: String(_id),
      kind: "passwordReset",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      usedAt: null,
      createdAt: now,
    });
    console.log(`Created ${email} as "${name}".`);
    console.log(`\nHe sets his password here (24 hours):\n  /reset-password?token=${token}\n`);
  }

  await settings.updateOne(
    { key: "product" },
    { $set: { key: "product", "value.moderatorWaliUserId": String(user._id) } },
    { upsert: true }
  );
  console.log(`He is now offered as a wali of last resort. Members will see the name "${name}".`);
})()
  .catch((err) => {
    console.error(`\nFAIL  ${(err && err.message) || err}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
