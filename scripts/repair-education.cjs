/* Repairs seeded profiles whose education level the schema never had.
 *
 * `seed-pool.cjs` wrote "college", "trade" and "someUniversity" — none
 * of which are in EDUCATION. Browse reads raw documents so those members
 * looked fine in the pool; every screen that parses a profile threw, so
 * seven seeded people got a 500 on the dashboard. The seed script now
 * refuses to write a value the schema will reject; this fixes the rows
 * that were written before it did.
 *
 * Only @seed.test accounts. A real member's answer is not something a
 * migration script should be guessing at — if one of these ever appears
 * on a real profile it is listed and left alone.
 *
 *   node scripts/repair-education.cjs            (dry run)
 *   node scripts/repair-education.cjs --apply
 */
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();
const APPLY = process.argv.includes("--apply");
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const VALID = ["highSchool", "collegeDiploma", "bachelor", "master", "doctorate", "islamicStudies", "other"];
/* Nearest honest bucket, not nearest string. A trade certificate and a
   CEGEP diploma are both a college-level qualification here; "some
   university, no degree" has no bucket of its own and is "other". */
const MAP = { college: "collegeDiploma", trade: "collegeDiploma", someUniversity: "other" };

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");

  const broken = await db
    .collection("profiles")
    .find({ "education.level": { $nin: [...VALID, null] } })
    .toArray();

  if (!broken.length) {
    console.log("\nnothing to repair — every profile parses\n");
    await client.close();
    return;
  }

  let fixed = 0;
  let skipped = 0;
  for (const p of broken) {
    const user = await db.collection("users").findOne({ _id: p.userId });
    const level = p.education?.level;
    const to = MAP[level];
    if (!user || !/@seed\.test$/.test(user.email)) {
      console.log(`  SKIP  ${user?.email ?? p._id}: "${level}" — not a seeded account, leaving it alone`);
      skipped++;
      continue;
    }
    if (!to) {
      console.log(`  SKIP  ${user.email}: "${level}" — no mapping for it`);
      skipped++;
      continue;
    }
    console.log(`  ${user.email}: "${level}" → "${to}"`);
    if (APPLY) {
      await db.collection("profiles").updateOne({ _id: p._id }, { $set: { "education.level": to } });
    }
    fixed++;
  }

  console.log(
    APPLY
      ? `\nrepaired ${fixed} profile(s)${skipped ? `, skipped ${skipped}` : ""}\n`
      : `\n(dry run) ${fixed} profile(s) would be repaired${skipped ? `, ${skipped} skipped` : ""}. Re-run with --apply.\n`
  );
  if (skipped) process.exitCode = 1;
  await client.close();
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
