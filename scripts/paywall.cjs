/* Turns charging on and off, and says who it affects before it does.
 *
 * `planGate` is one word in one document, and it is the difference
 * between a site where everything is free and a site that stops people
 * mid-conversation until they pay. That is too consequential to be a
 * hand-typed update to a collection, so it lives here: it shows the
 * current state, says who would be walled the moment it changed, and
 * refuses to write anything without --apply.
 *
 *   node scripts/paywall.cjs                        # what is it now, and who would it hit
 *   node scripts/paywall.cjs --set everybody --apply
 *   node scripts/paywall.cjs --set nobody --apply   # back off again, instantly
 *
 * The three settings:
 *   nobody     nothing is charged; every part of the site is open.
 *   brother    brothers pay, sisters never do. The original rule, from
 *              before sisters had a price of their own.
 *   everybody  both pay, at their own prices. What the site runs on.
 *
 * Turning it off is as immediate as turning it on. Nobody's paid-up
 * date is touched either way — this only decides whether the date is
 * consulted.
 */
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();

const GATES = ["nobody", "brother", "everybody"];
const APPLY = process.argv.includes("--apply");
const wanted = (() => {
  const i = process.argv.indexOf("--set");
  if (i === -1) return null;
  const v = process.argv[i + 1];
  if (!GATES.includes(v)) {
    console.error(`\nFAIL  --set must be one of ${GATES.join(", ")} — not ${JSON.stringify(v)}\n`);
    process.exit(1);
  }
  return v;
})();

const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

/* Mirrors `messageAllowance` in src/lib/domain/plan.ts. Kept deliberately
   simple and read-only: this is a warning, not the rule. */
function wouldBeWalled(gate, gender, sent, free) {
  if (gate === "nobody") return false;
  if (gender !== "brother" && gender !== "sister") return false;
  if (gate === "brother" && gender !== "brother") return false;
  return sent >= free;
}

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");

  const doc = await db.collection("settings").findOne({ key: "product" });
  const current = doc?.value?.planGate ?? "nobody";
  const free = doc?.value?.freeMessagesPerConversation ?? 3;
  const now = new Date();

  console.log(`database:          ${db.databaseName}`);
  console.log(`charging:          ${current}${current === "nobody" ? "  (nothing is charged)" : ""}`);
  console.log(`free messages:     ${free} per conversation`);

  const paid = await db
    .collection("users")
    .countDocuments({ planActiveUntil: { $gt: now } });
  console.log(`paid-up members:   ${paid}`);

  /* Who is standing where the wall would appear. The question somebody
     should ask before flipping this and cannot ask afterwards. */
  const sent = await db
    .collection("messages")
    .aggregate([
      { $match: { kind: { $ne: "system" }, fromUserId: { $ne: null } } },
      { $group: { _id: { c: "$conversationId", u: "$fromUserId" }, n: { $sum: 1 } } },
    ])
    .toArray();

  const target = wanted ?? current;
  let walled = 0;
  for (const row of sent) {
    let userId;
    try {
      userId = new (require("mongodb").ObjectId)(String(row._id.u));
    } catch {
      continue;
    }
    const profile = await db
      .collection("profiles")
      .findOne({ userId }, { projection: { gender: 1 } });
    const user = await db
      .collection("users")
      .findOne({ _id: userId }, { projection: { planActiveUntil: 1 } });
    const hasPlan = user?.planActiveUntil && user.planActiveUntil > now;
    if (hasPlan) continue;
    if (wouldBeWalled(target, profile?.gender, row.n, free)) walled++;
  }

  console.log(
    `\nunder "${target}", ${walled} member-conversation(s) would be stopped at the wall right now.`
  );
  if (walled > 0) {
    console.log("Those people are mid-conversation and will be asked to pay to continue.");
  }

  if (!wanted) {
    console.log(`\nNothing written. Use --set <${GATES.join("|")}> --apply to change it.\n`);
    return;
  }
  if (wanted === current) {
    console.log(`\nAlready "${current}". Nothing to do.\n`);
    return;
  }
  if (!APPLY) {
    console.log(`\nWould change charging from "${current}" to "${wanted}".`);
    console.log("Nothing written. Re-run with --apply.\n");
    return;
  }

  await db
    .collection("settings")
    .updateOne(
      { key: "product" },
      { $set: { key: "product", "value.planGate": wanted } },
      { upsert: true }
    );

  const after = (await db.collection("settings").findOne({ key: "product" }))?.value?.planGate;
  console.log(`\ncharging: ${current} -> ${after}`);
  if (after !== wanted) {
    console.error("FAIL  the stored value is not what was asked for.");
    process.exitCode = 1;
    return;
  }
  console.log("Live immediately. Run with --set nobody --apply to undo it.\n");
})()
  .catch((e) => {
    console.error("\nFAIL ", e.message);
    process.exitCode = 1;
  })
  .finally(() => client.close());
