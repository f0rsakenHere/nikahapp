/* Retires the guardianships that were written against brothers.
 *
 * The wali step used to be shown to a brother as an optional extra. It
 * is gone — the wali in this product is the woman's guardian — but the
 * rows it created do not disappear with the screen, and a `confirmed`
 * guardianship is not a dormant record. It is a live grant: the man it
 * names can sign in at /wali, sees the brother listed as his ward, and
 * `canWaliReadConversation` will hand him any thread opened after he
 * confirmed. Leaving those in place would mean removing the feature from
 * the interface while the access it granted stayed switched on.
 *
 * Only guardianships whose member has a brother's profile. A sister's is
 * never touched, and neither is a row whose member cannot be resolved —
 * that is a data problem to look at, not one to guess at.
 *
 * Idempotent: once revoked they no longer match.
 *
 *   node scripts/revoke-brother-walis.cjs           # report only
 *   node scripts/revoke-brother-walis.cjs --apply   # actually revoke
 */
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const APPLY = process.argv.includes("--apply");

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

/* The two states that still grant or promise something. `declined`,
   `expired`, `revoked` and `replaced` are already over. */
const LIVE = ["confirmed", "invited"];

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const now = new Date();

  const candidates = await db
    .collection("guardianships")
    .find({ status: { $in: LIVE } })
    .toArray();

  const brothers = [];
  const unresolved = [];

  for (const g of candidates) {
    let profile = null;
    try {
      profile = await db
        .collection("profiles")
        .findOne({ userId: new ObjectId(String(g.memberUserId)) }, { projection: { gender: 1 } });
    } catch {
      /* An id that is not an ObjectId at all. Falls through to the
         unresolved list rather than throwing the whole run away. */
    }
    if (!profile) {
      unresolved.push(g);
      continue;
    }
    if (profile.gender === "brother") brothers.push(g);
  }

  console.log(
    `${brothers.length} guardianship(s) held against a brother${APPLY ? "" : "  (dry run)"}`
  );
  for (const g of brothers) {
    console.log(`  ${g._id}  ${g.status}  wali: ${g.invited.email}`);
  }

  /* Loud, not skipped. A guardianship pointing at a member who has no
     profile is either an orphan left by an incomplete erasure or an id
     stored in the wrong shape, and both are worth a person looking. */
  if (unresolved.length) {
    console.log(`\n${unresolved.length} guardianship(s) whose member has no profile — left alone:`);
    for (const g of unresolved) console.log(`  ${g._id}  member ${g.memberUserId}`);
  }

  if (!brothers.length) {
    console.log("\nnothing to revoke\n");
    return;
  }

  if (!APPLY) {
    console.log("\nRe-run with --apply to revoke them.\n");
    return;
  }

  let revoked = 0;
  for (const g of brothers) {
    /* Guarded on the status inside the update, so a wali confirming at
       the moment this runs is not silently overwritten by a sweep that
       read the row a second earlier. */
    const result = await db.collection("guardianships").updateOne(
      { _id: g._id, status: g.status },
      {
        $set: {
          status: "revoked",
          revokedAt: now,
          /* Nobody pressed anything. Attributing it to the member would
             read, a year from now, as though he had removed his own
             wali. */
          revokedBy: null,
        },
      }
    );
    if (result.modifiedCount !== 1) continue;
    revoked++;

    await db.collection("auditLog").insertOne({
      _id: new ObjectId(),
      at: now,
      actor: { userId: null, role: null, ip: null, userAgent: null, impersonatedBy: null },
      action: "guardianship.revoked",
      subject: { type: "guardianship", id: g._id.toHexString() },
      meta: {
        reason: "the wali step was withdrawn from brothers",
        wasStatus: g.status,
        memberUserId: String(g.memberUserId),
      },
    });
  }

  console.log(`\nrevoked ${revoked} of ${brothers.length}`);
  if (revoked !== brothers.length) {
    console.log("The difference changed status while this ran, which is the guard working.");
  }
  console.log("");
})()
  .catch((err) => {
    console.error(`\nFAIL  ${(err && err.message) || err}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
