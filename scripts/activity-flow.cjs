/* Presence and arrivals: is what the cards say true of the database?
 *
 * The risk with a signal like "Active today" is not that it fails to
 * render — it is that it renders for everybody, or for nobody, and looks
 * plausible either way. So every check here sets a known value, reads
 * the screen, and then sets the opposite and reads it again. A badge
 * that cannot be turned off is not a badge, it is decoration.
 *
 * Runs against the seeded pool and puts every value it changed back.
 *
 *   node scripts/seed-pool.cjs --apply
 *   BASE=http://127.0.0.1:3001 node scripts/activity-flow.cjs
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
const VIEWER = "yusuf.rahman@seed.test";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

const text = (p) => p.innerText("body");

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");

  const viewer = await db.collection("users").findOne({ email: VIEWER });
  if (!viewer) {
    console.error("\nFAIL  no seeded pool. Run: node scripts/seed-pool.cjs --apply\n");
    process.exitCode = 1;
    await client.close();
    return;
  }
  const mine = await db.collection("profiles").findOne({ userId: viewer._id });

  /* One sister, watched through every state. Chosen by id so the run is
     repeatable rather than "whoever browse happens to list first". */
  const subject = await db
    .collection("profiles")
    .findOne({ gender: "sister", status: "live", userId: { $ne: viewer._id } }, { sort: { _id: 1 } });
  if (!subject) {
    console.error("\nFAIL  no live sister in the pool to watch\n");
    process.exitCode = 1;
    await client.close();
    return;
  }

  /* Everything about to be written, so the pool is handed back as found. */
  const before = {
    subject: { lastActiveAt: subject.lastActiveAt ?? null, liveAt: subject.liveAt ?? null },
    mine: { lastActiveAt: mine?.lastActiveAt ?? null },
  };
  const restore = async () => {
    const set = {};
    const unset = {};
    if (before.subject.lastActiveAt) set.lastActiveAt = before.subject.lastActiveAt;
    else unset.lastActiveAt = "";
    if (before.subject.liveAt) set.liveAt = before.subject.liveAt;
    else unset.liveAt = "";
    await db.collection("profiles").updateOne({ _id: subject._id }, {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    });
  };

  const setSubject = async (patch) => {
    const set = {};
    const unset = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) unset[k] = "";
      else set[k] = v;
    }
    await db.collection("profiles").updateOne({ _id: subject._id }, {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    });
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.setDefaultTimeout(30_000);

  /* The one card this run is about, wherever browse put it. */
  const card = () =>
    page.locator(`li:has(a[href="/browse/${subject._id}"])`).first();

  try {
    const now = new Date();

    /* ---------- signed in ------------------------------------------- */
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.fill('input[name="email"]', VIEWER);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await assertOurApp(page);

    /* ---------- being here is recorded ------------------------------ */
    /* The frame writes it, and writes it at most once an hour — so the
       contract is "not older than the interval", not "written just now".
       Asserting the latter passes only when nobody has looked at the app
       in the last hour, which is exactly the run this checker is least
       likely to have. */
    const touched = await db.collection("profiles").findOne({ _id: mine._id });
    const age = touched?.lastActiveAt ? Date.now() - touched.lastActiveAt.getTime() : Infinity;
    check(
      "arriving records that this member was here",
      touched?.lastActiveAt instanceof Date && age < 65 * 60_000,
      `${String(touched?.lastActiveAt)} — ${Math.round(age / 60_000)} minutes old`
    );

    /* ---------- active today ---------------------------------------- */
    await setSubject({ lastActiveAt: new Date(now.getTime() - 30 * 60_000), liveAt: new Date(now.getTime() - 60 * DAY) });
    await page.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    let card1 = await card().innerText();
    check("a card says when somebody was last around", /Active today/.test(card1), card1.replace(/\s+/g, " ").slice(0, 160));
    check("and does not print a time of day", !/\d{1,2}:\d{2}/.test(card1), card1.replace(/\s+/g, " ").slice(0, 160));

    /* ---------- active this week ------------------------------------ */
    await setSubject({ lastActiveAt: new Date(now.getTime() - 3 * DAY) });
    await page.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    card1 = await card().innerText();
    check("the band widens with the gap", /Active this week/.test(card1), card1.replace(/\s+/g, " ").slice(0, 160));

    /* ---------- and falls silent ------------------------------------ */
    await setSubject({ lastActiveAt: new Date(now.getTime() - 200 * DAY) });
    await page.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    card1 = await card().innerText();
    check(
      "somebody long gone is not advertised as absent",
      !/Active /.test(card1),
      card1.replace(/\s+/g, " ").slice(0, 160)
    );

    /* ---------- never recorded -------------------------------------- */
    await setSubject({ lastActiveAt: null });
    await page.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    card1 = await card().innerText();
    check("and neither is somebody with no record at all", !/Active /.test(card1));

    /* ---------- new to the pool ------------------------------------- */
    await setSubject({ liveAt: new Date(now.getTime() - 2 * DAY) });
    await page.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    card1 = await card().innerText();
    check("a recent arrival is marked new", /\bNew\b/.test(card1), card1.replace(/\s+/g, " ").slice(0, 160));

    /* The tab, and its count, against the database rather than itself. */
    const liveNow = await db.collection("profiles").countDocuments({ status: "live" });
    const newNow = await db
      .collection("profiles")
      .countDocuments({ status: "live", liveAt: { $gte: new Date(Date.now() - 7 * DAY) } });
    const browseText = await text(page);
    check(
      "browse counts the whole pool, and counts it correctly",
      new RegExp(`${liveNow} in the pool`).test(browseText),
      `expected ${liveNow} — ${browseText.replace(/\s+/g, " ").slice(0, 200)}`
    );

    await page.goto(`${BASE}/browse?new=1`, { waitUntil: "networkidle" });
    const newText = await text(page);
    check("there is a screen for this week's arrivals", /New this week/.test(newText));
    const hrefs = await page.locator('li a[href^="/browse/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("href"))
    );
    const shownIds = [...new Set(hrefs.map((h) => h.split("/").pop()))];
    check(
      "and it shows no more than the pool actually gained",
      shownIds.length > 0 && shownIds.length <= newNow,
      `${shownIds.length} shown, ${newNow} live this week`
    );

    /* Against the database rather than against the badge. A card for
       somebody the viewer has already asked shows "Asked" instead of
       "New" — the badge is not the claim being tested here, being on
       this screen is. */
    const shownDocs = await db
      .collection("profiles")
      .find({ _id: { $in: shownIds.map((id) => new ObjectId(id)) } })
      .toArray();
    const stale = shownDocs.filter(
      (d) => !d.liveAt || Date.now() - new Date(d.liveAt).getTime() >= 7 * DAY
    );
    check(
      "every profile on it really did go live this week",
      shownDocs.length === shownIds.length && stale.length === 0,
      `${stale.length} of ${shownDocs.length} were older`
    );

    /* ---------- an old arrival is not new --------------------------- */
    await setSubject({ liveAt: new Date(now.getTime() - 90 * DAY) });
    await page.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    card1 = await card().innerText();
    check("an older member is not marked new", !/\bNew\b/.test(card1), card1.replace(/\s+/g, " ").slice(0, 160));

    /* ---------- the dashboard says the same thing ------------------- */
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    const dash = await text(page);
    const liveAtEnd = await db.collection("profiles").countDocuments({ status: "live" });
    check(
      "the dashboard reports the same pool as the database",
      new RegExp(`${liveAtEnd} in the pool`).test(dash),
      `expected ${liveAtEnd} — ${dash.replace(/\s+/g, " ").slice(0, 200)}`
    );
  } catch (err) {
    check("the run completed", false, (err && err.message) || String(err));
  } finally {
    await browser.close();
    await restore();
    console.log("\nthe watched profile was put back as it was");
    await client.close();
  }

  console.log(bad ? `\n${bad} activity check(s) FAILED\n` : "\nall activity checks pass\n");
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
