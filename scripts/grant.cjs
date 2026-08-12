/* Operator commands for a single account: change its roles, or put its
 * profile live.
 *
 * Both of these have proper homes — roles belong to a staff console
 * screen that does not exist yet, and going live belongs to the review
 * queue, which does. This is for the case the product cannot serve
 * itself: the first administrator, who has to be made by somebody
 * outside the system, and an account that needs to be live before there
 * is anyone with the standing to approve it.
 *
 * It writes exactly what the application writes. `--live` sets the same
 * fields `decideProfile` sets on approval, including who decided and
 * when, so the record does not look different from an approved one.
 *
 *   node scripts/grant.cjs --email a@b.c --role admin
 *   node scripts/grant.cjs --email a@b.c --live
 *   node scripts/grant.cjs --email a@b.c           # report only
 */
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");

loadEnv();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

const email = (arg("email") || "").trim().toLowerCase();
const role = arg("role");
const LIVE = process.argv.includes("--live");

/* The set in domain/user.ts. Anything else is a typo that would sit in
   the database looking like a permission. */
const ROLES = new Set(["member", "wali", "staff", "verifier", "admin"]);

if (!email || (role && !ROLES.has(role))) {
  console.error("\nUsage: node scripts/grant.cjs --email <address> [--role <role>] [--live]");
  console.error(`Roles: ${[...ROLES].join(", ")}\n`);
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
  const users = db.collection("users");

  const user = await users.findOne({ email });
  if (!user) {
    console.error(`\nNo account for ${email}.\n`);
    process.exitCode = 1;
    return;
  }

  if (role) {
    await users.updateOne({ _id: user._id }, { $addToSet: { roles: role } });
    const after = await users.findOne({ _id: user._id }, { projection: { roles: 1 } });
    console.log(`roles: ${after.roles.join(", ")}`);
    if (["staff", "verifier", "admin"].includes(role)) {
      /* §7.1 makes TOTP non-negotiable for these roles. Nothing forces
         it at sign-in — the flag is only set when an account is created
         privileged — so an account promoted afterwards keeps signing in
         with a password alone until somebody turns it on. */
      console.log("⚠ two-factor is required for this role and is NOT on for this account.");
      console.log("  Turn it on at /settings — a promoted account is not asked automatically.");
    }
  }

  if (LIVE) {
    const profile = await db.collection("profiles").findOne({ userId: user._id });
    if (!profile) {
      console.error("No profile on this account.");
      process.exitCode = 1;
      return;
    }
    const now = new Date();
    /* The same fields, and the same guard: `decideProfile` only moves a
       profile that is actually waiting on a decision. Forcing a draft
       live would skip the questions it has not answered. */
    const res = await db.collection("profiles").updateOne(
      { _id: new ObjectId(profile._id), status: { $in: ["pendingReview", "verifying", "draft"] } },
      {
        $set: {
          status: "live",
          liveAt: now,
          updatedAt: now,
          decidedAt: now,
          decidedBy: String(user._id),
          decisionReason: "Set live by an operator, outside the review queue.",
        },
      }
    );
    console.log(
      res.matchedCount === 1
        ? `profile: ${profile.status} → live`
        : `profile: left at "${profile.status}" — only a draft or one awaiting review can be set live`
    );
  }

  const fresh = await users.findOne({ _id: user._id }, { projection: { roles: 1, mfa: 1 } });
  const p = await db.collection("profiles").findOne({ userId: user._id }, { projection: { status: 1, gender: 1 } });
  console.log(`\n${email}`);
  console.log(`  roles      ${fresh.roles.join(", ")}`);
  console.log(`  two-factor ${fresh.mfa?.enabled ? "on" : "off"}`);
  console.log(`  profile    ${p ? `${p.gender}, ${p.status}` : "none"}`);
})()
  .catch((err) => {
    console.error(`\nFAIL  ${(err && err.message) || err}\n`);
    process.exitCode = 1;
  })
  .finally(() => client.close());
