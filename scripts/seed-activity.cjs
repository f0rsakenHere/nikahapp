/* Makes the seeded pool behave like a pool people are actually in.
 *
 * `seed-pool.cjs` creates members. This creates *movement*: presence,
 * arrivals, and requests genuinely waiting on you — so the dashboard,
 * browse and the requests screen can be seen in their populated states
 * instead of only their empty ones. Every screen in this product is
 * designed around something happening, and until now nothing ever did
 * unless a human sat and clicked through it.
 *
 * ── What is faked and what is not ─────────────────────────────────────
 * The requests are real. They are sent by signing seeded members in and
 * pressing the button, so they carry the same ledger entries, the same
 * notifications and the same wali gating as a request from a stranger —
 * a fixture written straight into the collection would be the one thing
 * that passes every checker and still breaks in production.
 *
 * Presence and arrival dates are written directly, because there is no
 * interface for "was here on Tuesday". They are only ever written to
 * @seed.test accounts, and the previous values are kept so `--clean`
 * puts them back.
 *
 * Nothing here touches a real member's row, and no count anywhere in the
 * app is invented by this script — the pool figures on the dashboard are
 * counted from whatever is actually live.
 * ──────────────────────────────────────────────────────────────────────
 *
 *   node scripts/seed-pool.cjs --apply
 *   BASE=http://127.0.0.1:3001 node scripts/seed-activity.cjs --for you@example.com --apply
 *   BASE=http://127.0.0.1:3001 node scripts/seed-activity.cjs --for you@example.com --approve
 *   BASE=http://127.0.0.1:3001 node scripts/seed-activity.cjs --for you@example.com --clean
 *   BASE=http://127.0.0.1:3001 node scripts/seed-activity.cjs --for you@example.com --clean --presence
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

loadEnv();
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const PASSWORD = "one good passphrase";
const SEEDED = /@seed\.test$/;
/* Where the presence values this script writes are remembered, so
   `--clean` restores rather than guesses. One document per run. */
const BACKUP = "seedActivityBackup";

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};
const TARGET = argOf("--for");
const APPLY = process.argv.includes("--apply");
const APPROVE = process.argv.includes("--approve");
const CLEAN = process.argv.includes("--clean");
/* Presence is written across the whole seeded pool, not per target, so
   restoring it on any `--clean` would undo the pool's movement because
   one member's requests were being tidied up. It comes back only when
   asked for by name. */
const CLEAN_PRESENCE = process.argv.includes("--presence");
const HOW_MANY = Number(argOf("--requests") ?? 3);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/* Loud, not silent. A seeding script that quietly does nothing is worse
   than one that fails: you spend the next hour looking for the bug in
   the app. */
function die(message) {
  console.error(`\nFAIL  ${message}\n`);
  process.exitCode = 1;
}

async function signIn(browser, email) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.setDefaultTimeout(30_000);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90_000 });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  if (new URL(p.url()).pathname.startsWith("/login")) {
    throw new Error(`could not sign in as ${email} — is it a seeded account?`);
  }
  return p;
}

/* ── presence ───────────────────────────────────────────────────────────
 * A deterministic spread rather than a random one: two runs produce the
 * same pool, so a screenshot taken today can be compared with one taken
 * next week. Roughly a third here today, a third this week, a sixth this
 * month, and the rest with no record at all — a pool where everybody is
 * "active today" reads as fake to anybody who has used one.
 * ────────────────────────────────────────────────────────────────────── */
function presenceFor(index, now) {
  switch (index % 6) {
    case 0:
      return new Date(now.getTime() - 20 * 60_000);
    case 1:
      return new Date(now.getTime() - 5 * HOUR);
    case 2:
      return new Date(now.getTime() - 2 * DAY);
    case 3:
      return new Date(now.getTime() - 5 * DAY);
    case 4:
      return new Date(now.getTime() - 12 * DAY);
    /* Nobody. Somebody who has not been back is a fact about a pool
       too, and the card says nothing rather than inventing a visit. */
    default:
      return null;
  }
}

async function spreadPresence(db, now) {
  const seeded = await db.collection("users").find({ email: SEEDED }).toArray();
  if (!seeded.length) return { touched: 0 };

  const ids = seeded.map((u) => u._id);
  const profiles = await db
    .collection("profiles")
    .find({ userId: { $in: ids } })
    .toArray();

  /* Everything about to be overwritten, before it is overwritten. */
  const before = profiles.map((p) => ({
    profileId: p._id,
    lastActiveAt: p.lastActiveAt ?? null,
    liveAt: p.liveAt ?? null,
  }));
  await db.collection(BACKUP).insertOne({ _id: new ObjectId(), at: now, profiles: before });

  let touched = 0;
  for (const [i, p] of profiles.entries()) {
    const lastActiveAt = presenceFor(i, now);
    /* The four most recently created seeded profiles become this week's
       arrivals, so "New this week" has something in it and the badge on
       a card can be seen. The rest are pushed back beyond the window so
       the section means something. */
    const liveAt =
      i < 4
        ? new Date(now.getTime() - (i + 1) * DAY - 3 * HOUR)
        : new Date(now.getTime() - (20 + i) * DAY);

    await db.collection("profiles").updateOne(
      { _id: p._id },
      lastActiveAt
        ? { $set: { lastActiveAt, liveAt } }
        : { $set: { liveAt }, $unset: { lastActiveAt: "" } }
    );
    touched++;
  }
  return { touched };
}

async function restorePresence(db) {
  const backups = await db.collection(BACKUP).find({}).sort({ at: 1 }).toArray();
  if (!backups.length) return { restored: 0 };
  /* Oldest first, so the earliest recorded state is the one that
     survives if the script was run more than once. */
  let restored = 0;
  for (const backup of backups) {
    for (const row of backup.profiles ?? []) {
      const set = {};
      const unset = {};
      if (row.lastActiveAt) set.lastActiveAt = row.lastActiveAt;
      else unset.lastActiveAt = "";
      if (row.liveAt) set.liveAt = row.liveAt;
      else unset.liveAt = "";
      await db.collection("profiles").updateOne({ _id: row.profileId }, {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      });
      restored++;
    }
  }
  await db.collection(BACKUP).deleteMany({});
  return { restored };
}

/* ── requests ─────────────────────────────────────────────────────────── */

async function askOnBehalf(browser, db, sender, targetProfileId) {
  const p = await signIn(browser, sender.email);
  try {
    await assertOurApp(p);
    await p.goto(`${BASE}/browse/${targetProfileId}`, { waitUntil: "networkidle" });
    const ask = p.locator('button:has-text("Ask to talk")').first();
    if ((await ask.count()) !== 1) {
      const body = (await p.innerText("body")).replace(/\s+/g, " ").slice(0, 160);
      throw new Error(`${sender.email} was not offered the button — ${body}`);
    }
    await ask.click();
    await p.waitForTimeout(3500);

    const row = await db
      .collection("connectionRequests")
      .findOne({ fromUserId: String(sender._id) }, { sort: { sentAt: -1 } });
    if (!row || row.state !== "pending") {
      throw new Error(`${sender.email} pressed it and no pending request appeared`);
    }
    return row;
  } finally {
    await p.close();
  }
}

(async () => {
  if (!TARGET) return die("who is this for? pass --for someone@example.com");
  if (!APPLY && !CLEAN && !APPROVE) {
    console.log("\n(dry run) nothing written. Add --apply, --approve or --clean.\n");
  }

  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const now = new Date();

  const target = await db.collection("users").findOne({ email: TARGET });
  if (!target) return die(`no account for ${TARGET}`);
  const targetProfile = await db.collection("profiles").findOne({ userId: target._id });
  if (!targetProfile) return die(`${TARGET} has no profile`);

  /* ---------- clean ---------------------------------------------------- */
  if (CLEAN) {
    const requests = await db
      .collection("connectionRequests")
      .find({ toUserId: String(target._id) })
      .toArray();
    const seededSenders = new Set(
      (await db.collection("users").find({ email: SEEDED }).toArray()).map((u) => String(u._id))
    );
    /* Only the ones a seeded member sent. A request from a real person
       is not this script's to delete. */
    const mine = requests.filter((r) => seededSenders.has(String(r.fromUserId)));
    const ids = mine.map((r) => String(r._id));
    const conversations = await db
      .collection("conversations")
      .find({ requestId: { $in: ids } })
      .toArray();

    for (const c of conversations) {
      await db.collection("messages").deleteMany({ conversationId: String(c._id) });
    }
    await db.collection("conversations").deleteMany({ requestId: { $in: ids } });
    await db.collection("connectionRequests").deleteMany({ _id: { $in: mine.map((r) => r._id) } });
    await db.collection("connectionLedger").deleteMany({ requestId: { $in: ids } });
    /* The notifications those events wrote, for everybody they told. */
    await db.collection("notifications").deleteMany({
      href: { $in: [...ids.map((i) => `/requests`), ...conversations.map((c) => `/conversations/${c._id}`)] },
      userId: String(target._id),
    });
    const { restored } = await restorePresence(db);

    console.log(
      `\nremoved ${mine.length} seeded request(s), ${conversations.length} conversation(s); restored ${restored} profile(s)\n`
    );
    await client.close();
    return;
  }

  const browser = await chromium.launch();
  try {
    /* ---------- approve whatever is waiting on a seeded wali ---------- */
    if (APPROVE) {
      const waiting = await db
        .collection("conversations")
        .find({ state: "awaitingWali" })
        .toArray();
      const mine = waiting.filter((c) =>
        (c.participants ?? []).some((p) => String(p.userId) === String(target._id))
      );
      if (!mine.length) {
        console.log("\nnothing is waiting on a wali. Accept a request first.\n");
      }
      let opened = 0;
      for (const c of mine) {
        const seat = (c.participants ?? []).find((p) => p.role === "wali");
        const wali = seat
          ? await db.collection("users").findOne({ _id: ObjectId.createFromHexString(String(seat.userId)) })
          : null;
        if (!wali || !SEEDED.test(wali.email)) {
          console.log(`skipped ${c._id}: its wali is not a seeded account`);
          continue;
        }
        const p = await signIn(browser, wali.email);
        try {
          await p.waitForURL("**/wali", { timeout: 30_000 }).catch(() => {});
          const approve = p.locator('button:has-text("Approve")').first();
          if ((await approve.count()) !== 1) {
            throw new Error(`${wali.email} was not offered Approve in his portal`);
          }
          await approve.click();
          await p.waitForTimeout(3500);
          const after = await db.collection("conversations").findOne({ _id: c._id });
          if (after?.state !== "open") throw new Error(`approval did not open ${c._id}`);
          opened++;
        } finally {
          await p.close();
        }
      }
      console.log(`\nopened ${opened} conversation(s)\n`);
      await browser.close();
      await client.close();
      return;
    }

    /* ---------- apply ------------------------------------------------- */
    if (targetProfile.status !== "live") {
      return die(`${TARGET} is "${targetProfile.status}" — nobody can ask a profile that is not live`);
    }

    const wanted = targetProfile.gender === "brother" ? "sister" : "brother";
    const candidates = await db
      .collection("profiles")
      .find({ gender: wanted, status: "live" })
      .toArray();
    const senders = [];
    for (const c of candidates) {
      const u = await db.collection("users").findOne({ _id: c.userId });
      if (!u || !SEEDED.test(u.email)) continue;
      /* Not somebody who is already in a request with them — the point
         is new movement, and a duplicate would be refused anyway. */
      const already = await db.collection("connectionRequests").countDocuments({
        fromUserId: String(u._id),
        toUserId: String(target._id),
        state: { $in: ["pending", "accepted"] },
      });
      if (!already) senders.push(u);
      if (senders.length >= HOW_MANY) break;
    }

    if (!APPLY) {
      console.log(
        `\nwould set presence on the seeded pool and have ${senders.length} ${wanted}(s) ask ${TARGET}:\n` +
          senders.map((s) => `  ${s.email}`).join("\n") +
          "\n\nRe-run with --apply.\n"
      );
      await browser.close();
      await client.close();
      return;
    }

    const { touched } = await spreadPresence(db, now);
    console.log(`presence and arrival dates set on ${touched} seeded profile(s)`);

    if (!senders.length) return die("no seeded member is free to ask — try --clean first");

    let sent = 0;
    for (const sender of senders) {
      const row = await askOnBehalf(browser, db, sender, String(targetProfile._id));
      console.log(`  ${sender.email} asked — request ${row._id}`);
      sent++;
    }

    const settings = (await db.collection("settings").findOne({})) ?? {};
    /* The schema's default, so the warning fires at the same number the
       app enforces rather than at a number invented here. */
    const cap = settings.inboundCap ?? 10;
    console.log(
      `\n${sent} request(s) now waiting on ${TARGET}.` +
        (sent >= cap
          ? `\nNote: that meets the inbound cap of ${cap}, so they are out of browse until they answer some — which is the app working, not a bug.`
          : "") +
        `\n\nNext: sign in, accept one, then run --approve to have her wali open it.\n`
    );
  } catch (err) {
    die((err && err.message) || String(err));
  } finally {
    await browser.close();
    await client.close();
  }
})().catch((err) => die((err && err.message) || String(err)));
