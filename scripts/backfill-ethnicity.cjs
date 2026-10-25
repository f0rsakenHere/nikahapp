/* Sets the heritage on the seeded demo profiles, and only those.
 *
 * The field was always asked for; every seeded profile simply left it
 * empty, which made the card's ethnicity row invisible across the whole
 * pool and read to a tester as the field having been removed.
 *
 * Each value is read off the languages the fixture already lists, the
 * same way scripts/seed-pool.cjs now does it. Nothing is deleted, no
 * real member is touched, and a profile that already has an answer is
 * left alone.
 *
 *   node scripts/backfill-ethnicity.cjs            # dry run
 *   node scripts/backfill-ethnicity.cjs --apply
 */
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
loadEnv();
const APPLY = process.argv.includes("--apply");

function heritageFrom(languages) {
  const spoken = String(languages ?? "");
  if (/Bengali/i.test(spoken)) return "Bangladeshi";
  if (/Urdu|Punjabi/i.test(spoken)) return "Pakistani";
  if (/Arabic/i.test(spoken)) return "Arab";
  if (/Somali/i.test(spoken)) return "Somali";
  if (/Hausa|Yoruba|Igbo/i.test(spoken)) return "Nigerian";
  if (/Wolof/i.test(spoken)) return "Senegalese";
  if (/Swahili/i.test(spoken)) return "East African";
  if (/Turkish/i.test(spoken)) return "Turkish";
  if (/Malay|Indonesian/i.test(spoken)) return "Malay";
  if (/Hindi|Gujarati/i.test(spoken)) return "Indian";
  return "Canadian";
}

(async () => {
  const c = new MongoClient(requireEnv("MONGODB_URI"), { serverApi: { version: ServerApiVersion.v1 } });
  await c.connect();
  const db = c.db(process.env.MONGODB_DB || "nikahcanada");

  const seeded = await db
    .collection("users")
    .find({ email: /@seed\.test$/ }, { projection: { _id: 1, email: 1 } })
    .toArray();
  const byId = new Map(seeded.map((u) => [String(u._id), u.email]));
  if (!seeded.length) {
    console.error("FAIL  no seeded accounts found — refusing to touch anything");
    process.exitCode = 1;
    await c.close();
    return;
  }

  const profiles = await db
    .collection("profiles")
    .find({ userId: { $in: seeded.map((u) => u._id) } })
    .toArray();

  let changed = 0;
  for (const p of profiles) {
    const email = byId.get(String(p.userId));
    /* Belt and braces: a profile whose owner is not a @seed.test
       address never reaches this line, and is skipped loudly if it
       somehow does. */
    if (!email || !/@seed\.test$/.test(email)) {
      console.log(`skip   ${p._id} — not a seeded account`);
      continue;
    }
    const current = (p.background?.ethnicity ?? "").trim();
    if (current) {
      console.log(`keep   ${email} — already says "${current}"`);
      continue;
    }
    const value = heritageFrom(p.background?.languages);
    console.log(`set    ${email} — ${value}  (languages: ${p.background?.languages ?? "none"})`);
    if (APPLY) {
      await db
        .collection("profiles")
        .updateOne({ _id: p._id }, { $set: { "background.ethnicity": value, updatedAt: new Date() } });
    }
    changed++;
  }

  console.log("");
  console.log(`${changed} demo profile(s) ${APPLY ? "updated" : "would be updated"} of ${profiles.length} seeded`);
  if (!APPLY) console.log("(dry run) re-run with --apply to write them");
  await c.close();
})().catch((e) => {
  console.error("FAIL ", e.message);
  process.exitCode = 1;
});
