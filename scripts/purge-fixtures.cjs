/* Removes every fixture account and everything hanging off it.
 *
 * The end-to-end checkers clean up after themselves in a `finally`, but
 * a run that is killed — a timeout, a Ctrl-C, a laptop lid — never gets
 * there. The leftovers are live profiles, so the next run sees a pool it
 * did not create and fails on a count, which reads as a product bug and
 * is not one. This is the recovery.
 *
 * Only `@example.invalid` addresses. That suffix is reserved by RFC 2606
 * and can never be a real member, so this cannot touch anybody's data
 * however carelessly it is run.
 *
 *   node scripts/purge-fixtures.cjs           # report only
 *   node scripts/purge-fixtures.cjs --apply
 */
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";
const APPLY = process.argv.includes("--apply");

const FIXTURE = /@example\.invalid$/;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await client.connect();
  const db = client.db(dbName);

  const users = await db.collection("users").find({ email: FIXTURE }).toArray();
  console.log(`${users.length} fixture account(s)${APPLY ? "" : "  (dry run)"}`);
  for (const u of users) console.log(`  ${u.email}`);

  if (!APPLY) {
    if (users.length) console.log("\nRe-run with --apply to remove them.");
    return;
  }

  const removed = {};
  const bump = (name, n) => (removed[name] = (removed[name] ?? 0) + n);

  for (const u of users) {
    const id = String(u._id);

    /* Per account, and each independent of the others: one failure must
       not abandon the rest, which is exactly how the leftovers built up
       in the first place. */
    for (const [name, filter] of [
      ["sessions", { userId: id }],
      ["verificationTokens", { userId: id }],
      ["connectionLedger", { userId: id }],
      ["connectionRequests", { $or: [{ fromUserId: id }, { toUserId: id }] }],
      ["guardianships", { $or: [{ memberUserId: id }, { waliUserId: id }] }],
      ["verifications", { "subject.userId": id }],
      ["profiles", { userId: u._id }],
    ]) {
      try {
        bump(name, (await db.collection(name).deleteMany(filter)).deletedCount ?? 0);
      } catch (err) {
        console.error(`  ${name} for ${u.email}: ${err.message}`);
      }
    }

    try {
      const convs = await db
        .collection("conversations")
        .find({ "participants.userId": id })
        .toArray();
      for (const c of convs) {
        bump(
          "messages",
          (await db.collection("messages").deleteMany({ conversationId: c._id.toHexString() }))
            .deletedCount ?? 0
        );
        await db.collection("conversations").deleteOne({ _id: c._id });
        bump("conversations", 1);
      }
    } catch (err) {
      console.error(`  conversations for ${u.email}: ${err.message}`);
    }

    /* The audit log is not deleted from — §5.10, and the same reasoning
       as erasure. Fixture entries are pseudonymised rather than removed
       so the collection keeps its one rule. */
    try {
      bump(
        "auditLogPseudonymised",
        (
          await db.collection("auditLog").updateMany(
            { $or: [{ "actor.userId": id }, { "subject.id": id }] },
            { $set: { "actor.userId": "fixture", "actor.ip": null, "actor.userAgent": null, meta: {} } }
          )
        ).modifiedCount ?? 0
      );
    } catch (err) {
      console.error(`  auditLog for ${u.email}: ${err.message}`);
    }

    await db.collection("users").deleteOne({ _id: u._id });
    bump("users", 1);
  }

  /* The synthetic senders the browse checker inserts to fill an inbox. */
  bump(
    "connectionRequests",
    (await db.collection("connectionRequests").deleteMany({ fromUserId: /^filler/ })).deletedCount ?? 0
  );

  console.log("");
  for (const [name, n] of Object.entries(removed)) console.log(`  ${name.padEnd(24)} ${n}`);
  console.log(`\nremoved ${users.length} fixture account(s)`);
})()
  .catch((err) => {
    console.error(`\nFAIL  ${err && err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
