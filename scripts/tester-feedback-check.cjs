/* One tester's list, walked item by item.
 *
 * He sent a video. Transcribed, his points were:
 *
 *   1. "it shows somebody has asked to talk to you... but when you press
 *      on it, it doesn't show anything" — above a row of zeroes.
 *   2. "college or diploma... that can be confusing"
 *   3. "you guys took out the madhab, you guys took out the height...
 *      the ethnicity. So you need to add again"
 *   4. "maybe keep the introduction at the top"
 *   5. "let them mention the dealbreakers, what they're expecting...
 *      what madhab are they looking for... hijabi... with kids or
 *      without kids"
 *   6. "to also mention here if they have kids or they don't have kids"
 *   7. "for the person who hasn't been active it doesn't show anything.
 *      Maybe let it show when they were last active"
 *
 * Each is checked here against the screens he was looking at.
 *
 *   BASE=http://127.0.0.1:3000 node scripts/tester-feedback-check.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE } = require("./lib/base.cjs");

loadEnv();
const dbName = process.env.MONGODB_DB || "nikahcanada";
const mongo = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const MEMBER = "aisha.rahman@seed.test";
const PASSWORD = "one good passphrase";

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

const seen = (p) => p.evaluate(() => document.body.innerText);

(async () => {
  await mongo.connect();
  const db = mongo.db(dbName);
  const browser = await chromium.launch();
  const me = await db.collection("users").findOne({ email: MEMBER });
  if (!me) {
    console.error("\nFAIL  no seeded pool. Run: node scripts/seed-pool.cjs --apply\n");
    process.exitCode = 1;
    return;
  }

  /* His complaint, reproduced: a notification whose request is gone. It
     is how his own account got there — a request answered, withdrawn or
     expired leaves the line behind. */
  const planted = await db.collection("notifications").insertOne({
    userId: String(me._id),
    kind: "request.received",
    body: "Somebody has asked to talk to you.",
    href: "/requests",
    readAt: null,
    createdAt: new Date(),
  });

  try {
    const p = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
    p.setDefaultTimeout(45_000);
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90_000 });
    await p.fill('input[name="email"]', MEMBER);
    await p.fill('input[name="password"]', PASSWORD);
    await p.click('main button[type="submit"]');
    await p.waitForTimeout(3500);

    /* ---------- 1. the feed and the counters agree ------------------ */
    await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await p.waitForFunction(
      () => /In the pool|With our team|Not finished|Waiting on you/.test(document.body.innerText),
      { timeout: 20_000 }
    );
    /* Measured against the database rather than assumed to be zero.
     *
     * This read "nobody is waiting on her", which held on a local pool
     * and not on the live one, where the fixture sister has a real
     * request from August sitting unanswered. The tester's complaint was
     * never that the number is zero — it was that the number and the
     * sentence above it disagreed. So that is what is checked. */
    const waiting = await db
      .collection("connectionRequests")
      .countDocuments({ toUserId: String(me._id), state: "pending" });

    const dash = await seen(p);
    const shown = /(\d+)\s*\n?\s*Waiting on you/.exec(dash);
    const counted = shown ? Number(shown[1]) : /Nobody is waiting/.test(dash) ? 0 : null;
    check(
      "the counter matches the requests that are really waiting",
      counted === waiting,
      `screen says ${shown ? shown[1] : "(no counter)"}, database says ${waiting}`
    );
    check(
      waiting === 0
        ? "so the dashboard does not claim somebody has asked"
        : "and the line above it agrees that somebody has",
      /asked to talk to you/i.test(dash) === waiting > 0,
      dash.replace(/\s+/g, " ").slice(0, 200)
    );

    /* The history is still kept, where history belongs. */
    await p.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
    await p.waitForTimeout(1200);
    check(
      "the notifications page still has it",
      /asked to talk to you/i.test(await seen(p))
    );

    /* ---------- 2, 3, 6, 7. the card ------------------------------- */
    await p.goto(`${BASE}/browse`, { waitUntil: "networkidle" });
    await p.locator("main ul li").first().waitFor({ timeout: 20_000 });
    const rows = await p.evaluate(() =>
      [...document.querySelectorAll("main ul li")]
        .slice(0, 6)
        .map((c) => [...c.querySelectorAll("dd")].map((d) => d.textContent ?? "").join(" | "))
    );
    const all = rows.join("\n");
    check("the card says the madhhab again", /Hanafi|Maliki|Shafi|Hanbali|No specific madhhab/.test(all), rows[0]);
    check("and the height", /′/.test(all), rows[0]);
    check("and the ethnicity", /Ethnicity:/.test(all), rows[0]);
    check("and whether there are children", /no children|has children/.test(all), rows[0]);
    check(
      "the education label no longer reads as two answers",
      !/College or diploma/.test(all),
      rows.find((r) => /College/.test(r)) ?? "(no college rows)"
    );

    /* The quiet ones say so rather than saying nothing. */
    const quiet = await p.evaluate(() => document.body.innerText);
    check(
      "a profile nobody has seen lately says so",
      /Active (today|this week|this month)|Not here in the last month/.test(quiet)
    );

    /* ---------- 4, 5. the profile page ------------------------------ */
    const href = await p.locator('main ul li a[href^="/browse/"]').first().getAttribute("href");
    await p.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
    await p.waitForFunction(() => /IN THEIR OWN WORDS/i.test(document.body.innerText), {
      timeout: 20_000,
    });
    const detail = await seen(p);
    const order = (a, b) => detail.toUpperCase().indexOf(a) < detail.toUpperCase().indexOf(b);
    check("their own words come before the facts", order("IN THEIR OWN WORDS", "SALAH"), detail.replace(/\s+/g, " ").slice(0, 200));
    for (const row of ["MADHHAB", "ETHNIC BACKGROUND", "HEIGHT", "WOULD RELOCATE", "LAST HERE", "CHILDREN"]) {
      check(`the profile page shows ${row.toLowerCase()}`, detail.toUpperCase().includes(row));
    }
    check(
      "and no longer says a wali approves the photograph",
      !/wali approves/i.test(detail)
    );

    /* ---------- 5. the prompt asks for the rest --------------------- */
    await p.goto(`${BASE}/onboarding/deen`, { waitUntil: "networkidle" });
    await p.locator('textarea[name="freeText.aboutMe"]').waitFor({ timeout: 20_000 });
    const step = await seen(p);
    check("the deen step asks for a madhhab again", /Madhhab/i.test(step));
    check(
      "and the free text invites the dealbreakers",
      /would not work for you/i.test(step) && /children/i.test(step),
      step.replace(/\s+/g, " ").slice(-240)
    );
  } finally {
    await browser.close();
    await db.collection("notifications").deleteOne({ _id: planted.insertedId });
    await mongo.close();
  }

  console.log(bad ? `\n${bad} of the tester's points still open\n` : `\nevery point the tester raised is answered\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
