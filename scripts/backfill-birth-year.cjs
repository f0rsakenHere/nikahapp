/* Fills `profiles.basics.birthYear` from the account's date of birth.
 *
 * The profile builder used to ask for the year of birth a second time,
 * after sign-up had already taken the whole date. It no longer does —
 * `createMemberAccount` derives it — but a profile created before that
 * change has no year and now has no way to acquire one, which leaves it
 * short of the "About you" step forever and unable to be submitted for
 * review. This is that one-off repair.
 *
 * Only fills what is missing. A profile that already carries a year is
 * left exactly as it is, even if it disagrees with the account: that is
 * a person's own answer and a staff question, not something a script
 * should quietly overwrite. Disagreements are reported.
 *
 *   node scripts/backfill-birth-year.cjs           # report only
 *   node scripts/backfill-birth-year.cjs --apply
 */
const { MongoClient, ServerApiVersion } = require("mongodb");
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

  const profiles = await db.collection("profiles").find({}).toArray();
  const users = new Map(
    (await db.collection("users").find({}, { projection: { dateOfBirth: 1 } }).toArray()).map((u) => [
      String(u._id),
      u.dateOfBirth,
    ])
  );

  let filled = 0;
  let stuck = 0;
  let disagreed = 0;

  for (const p of profiles) {
    const born = users.get(String(p.userId));
    const year = born instanceof Date ? born.getUTCFullYear() : null;
    const has = p.basics?.birthYear;

    if (has !== undefined && has !== null) {
      if (year && Number(has) !== year) {
        console.log(`  differs  ${p._id}  profile ${has}, account ${year}  (left alone)`);
        disagreed++;
      }
      continue;
    }

    if (!year) {
      /* A wali has no date of birth and is not asked for one, so he has
         no profile either — reaching this means something else. */
      console.log(`  STUCK    ${p._id}  no date of birth on the account`);
      stuck++;
      continue;
    }

    console.log(`  fill     ${p._id}  -> ${year}`);
    filled++;
    if (APPLY) {
      await db
        .collection("profiles")
        .updateOne({ _id: p._id }, { $set: { "basics.birthYear": year, updatedAt: new Date() } });
    }
  }

  console.log(
    `\n${profiles.length} profile(s): ${filled} ${APPLY ? "filled" : "to fill"}, ` +
      `${disagreed} disagreeing, ${stuck} with nothing to fill from`
  );
  if (!APPLY && filled) console.log("Re-run with --apply to write them.");

  /* A profile the app can never complete is worth a non-zero exit, so a
     run wired into anything notices. */
  process.exitCode = stuck ? 1 : 0;
})()
  .catch((err) => {
    console.error(`\nFAIL  ${(err && err.message) || err}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
