/* Applies the index definitions in src/lib/db/indexes.ts.
 *
 * A stopgap until migrate-mongo (APP-PLAN §5.13) — see the header of
 * that file for why it exists at all. Idempotent: re-running is free.
 *
 *   npm run db:indexes
 */
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";

/* Duplicated from src/lib/db/indexes.ts rather than imported: that file
 * is TypeScript with a `@/` path alias and this is plain node. The
 * duplication is deliberate and small, and the test below fails loudly
 * if the two drift — every index named here must come back from the
 * server after creation. */
const INDEXES = {
  users: [
    [{ email: 1 }, { unique: true, name: "email_unique" }],
    [{ roles: 1, status: 1 }, { name: "roles_status" }],
    [{ "phone.e164": 1 }, { name: "phone_e164", sparse: true }],
  ],
  profiles: [
    [{ userId: 1 }, { unique: true, name: "userId_unique" }],
    [{ status: 1, gender: 1 }, { name: "status_gender" }],
  ],
  sessions: [
    [{ tokenHash: 1 }, { unique: true, name: "tokenHash_unique" }],
    [{ userId: 1, lastSeenAt: -1 }, { name: "userId_lastSeen" }],
    [{ absoluteExpiresAt: 1 }, { name: "absoluteExpiresAt_ttl", expireAfterSeconds: 0 }],
  ],
  connectionRequests: [
    [{ pairKey: 1 }, { unique: true, name: "pairKey_unique" }],
    [{ toUserId: 1, state: 1 }, { name: "inbox" }],
    [{ fromUserId: 1, state: 1 }, { name: "outbox" }],
    [{ state: 1, expiresAt: 1 }, { name: "expiry_sweep" }],
  ],
  connectionLedger: [
    [{ userId: 1, at: -1 }, { name: "userId_at" }],
    /* partial, not sparse: a sparse compound index still indexes a
       document when any key exists, so every non-grant entry was
       indexed with period: null and collided. */
    [
      { userId: 1, period: 1 },
      {
        unique: true,
        name: "grant_once_per_period",
        partialFilterExpression: { reason: "monthlyGrant" },
      },
    ],
  ],
  verifications: [
    [{ "subject.userId": 1, kind: 1 }, { name: "subject_kind" }],
    [{ decision: 1, createdAt: 1 }, { name: "decision_createdAt" }],
    [{ decision: 1, "call.scheduledFor": 1 }, { name: "decision_callAt" }],
  ],
  auditLog: [
    [{ "subject.type": 1, "subject.id": 1, at: -1 }, { name: "subject_at" }],
    [{ "actor.userId": 1, at: -1 }, { name: "actor_at" }],
    [{ action: 1, at: -1 }, { name: "action_at" }],
  ],
  verificationTokens: [
    [{ tokenHash: 1 }, { unique: true, name: "tokenHash_unique" }],
    [{ userId: 1, purpose: 1 }, { name: "userId_purpose" }],
    [{ expiresAt: 1 }, { name: "expiresAt_ttl", expireAfterSeconds: 0 }],
  ],
  guardianships: [
    [{ memberUserId: 1, status: 1 }, { name: "member_status" }],
    [{ waliUserId: 1, status: 1 }, { name: "wali_status", sparse: true }],
    [{ "invited.token": 1 }, { unique: true, sparse: true, name: "invite_token_unique" }],
    [{ status: 1, "invited.expiresAt": 1 }, { name: "status_inviteExpiry" }],
  ],
};

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await client.connect();
  const db = client.db(dbName);
  let total = 0;

  for (const [collection, specs] of Object.entries(INDEXES)) {
    const wanted = [];
    for (const [keys, options] of specs) {
      wanted.push(await db.collection(collection).createIndex(keys, options));
    }

    /* Read them back. `createIndex` returning a name proves the command
       was accepted, not that the index is on the server we think it is. */
    const present = new Set(
      (await db.collection(collection).listIndexes().toArray()).map((i) => i.name)
    );
    const missing = wanted.filter((n) => !present.has(n));
    if (missing.length) {
      console.error(`FAIL  ${collection}: created but not present — ${missing.join(", ")}`);
      process.exitCode = 1;
    }

    total += wanted.length;
    console.log(`${collection.padEnd(15)} ${wanted.join(", ")}`);
  }

  if (!total) {
    console.error("FAIL: no indexes defined — this is not a pass");
    process.exitCode = 1;
  } else if (!process.exitCode) {
    console.log(`\n${total} indexes present on ${dbName}`);
  }
})()
  .catch((err) => {
    console.error(`\nFAIL  ${err && err.message}\n`);
    if (/already exists with a different name|IndexOptionsConflict|IndexKeySpecsConflict/i.test(String(err && err.message))) {
      console.error(
        "An index with these keys already exists under different options. Drop it\n" +
          "deliberately — changing an index in place is a migration, not a re-run.\n"
      );
    }
    process.exitCode = 1;
  })
  .finally(() => client.close());
