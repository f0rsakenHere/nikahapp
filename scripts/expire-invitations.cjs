/* Expires wali invitations nobody answered.
 *
 * §12.2 lists scheduled jobs; there is no scheduler yet, so this is
 * written to be run by cron, by a platform scheduler, or by hand. It is
 * idempotent and safe to run as often as you like.
 *
 * Why it matters more than it looks: an invitation link is a live
 * credential that grants read access to a woman's private
 * correspondence. `expiresAt` bounds that on paper, and the accept path
 * enforces it on use — but a row sitting in `invited` forever also means
 * her screen says "waiting on him" indefinitely, with no prompt to do
 * anything else. Expiring it is what turns a silence into a decision.
 *
 *   node scripts/expire-invitations.cjs           # report only
 *   node scripts/expire-invitations.cjs --apply   # actually expire
 */
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB || "nikahcanada";
const APPLY = process.argv.includes("--apply");

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await client.connect();
  const db = client.db(dbName);
  const now = new Date();

  const overdue = await db
    .collection("guardianships")
    .find({ status: "invited", "invited.expiresAt": { $lte: now } })
    .toArray();

  console.log(`${overdue.length} invitation(s) past their expiry${APPLY ? "" : "  (dry run)"}`);

  for (const g of overdue) {
    const days = Math.floor((now - g.invited.invitedAt) / 86_400_000);
    console.log(
      `  ${g._id}  invited ${days}d ago  reminded ${g.invited.remindersSent}x  ${g.invited.email}`
    );
  }

  if (!APPLY) {
    if (overdue.length) console.log("\nRe-run with --apply to expire them.");
    return;
  }

  let expired = 0;
  for (const g of overdue) {
    /* Guarded on the status inside the update: a wali accepting at the
       same moment this job runs must win, not be overwritten by a sweep
       that read the row a second earlier. */
    const result = await db
      .collection("guardianships")
      .updateOne(
        { _id: g._id, status: "invited" },
        { $set: { status: "expired", expiredAt: now } }
      );
    if (result.modifiedCount !== 1) continue;
    expired++;

    /* Attributed to nobody, because nobody did it — the actor is null
       for something the system did on its own. */
    await db.collection("auditLog").insertOne({
      _id: new ObjectId(),
      at: now,
      actor: { userId: null, role: null, ip: null, userAgent: null, impersonatedBy: null },
      action: "guardianship.revoked",
      subject: { type: "guardianship", id: g._id.toHexString() },
      meta: { reason: "invitation expired unanswered", remindersSent: g.invited.remindersSent },
    });
  }

  console.log(`\nexpired ${expired} of ${overdue.length}`);
  if (expired !== overdue.length) {
    console.log("The difference was answered while this ran, which is the guard working.");
  }
})()
  .catch((err) => {
    console.error(`\nFAIL  ${err && err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
