/* The member's home: does it exist, is it where you land, and does it
 * say the right thing at each stage?
 *
 * Three states, because they are three different screens and only one of
 * them is the easy one:
 *   draft         — part-filled, with somewhere to continue, pool shut
 *   pendingReview — sent in, and with approval deferred (D1f) that is
 *                   what puts somebody in the pool
 *   live          — the same, plus staff have run the checks
 *
 * The line these checks hold is that the screen describes the state the
 * member is actually in: a locked door is not advertised as open, and a
 * queue is not described to somebody who is not standing in it.
 *
 *   BASE=http://127.0.0.1:3001 node scripts/dashboard-flow.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp, fillDob } = require("./lib/base.cjs");

loadEnv();
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const STAMP = Date.now();
/* A sister, so the wali panel is in scope — it is the one part of this
   screen that appears and disappears with the profile's status. */
const EMAIL = `dash+sister${STAMP}@example.invalid`;
const PASSWORD = "a sentence I will remember";

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

async function register(page) {
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.click('label:has(input[name="gender"][value="sister"])');
  await page.fill('input[name="firstName"]', "Dashboard");
  await page.fill('input[name="lastName"]', "Test");
  await fillDob(page, "1995-04-12");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.check('input[name="marriageIntention"]');
  await page.check('input[name="terms"]');
  await page.click('button[type="submit"]');
  await page.waitForURL("**/onboarding", { timeout: 20_000 });
}

const body = (p) => p.innerText("body");

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const browser = await chromium.launch();

  try {
    const p = await browser.newPage({ viewport: { width: 500, height: 1000 } });
    await register(p);
    await assertOurApp(p);

    const user = await db.collection("users").findOne({ email: EMAIL });
    const profiles = db.collection("profiles");

    /* ---------- it exists, and the tabs are on it ------------------- */
    await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    check("the dashboard renders", new URL(p.url()).pathname === "/dashboard", p.url());
    check("it greets the member by name", /Assalamu alaikum, Dashboard/.test(await body(p)));

    /* Two navs are rendered — the desktop row in the header and the
       thumb bar at the bottom — and exactly one of them is visible at
       any width. So: the link exists in both, and only the visible one
       is asserted against. */
    for (const [label, href] of [
      ["Home", "/dashboard"],
      ["Browse", "/browse"],
      ["Requests", "/requests"],
      ["Profile", "/onboarding"],
    ]) {
      const n = await p.locator(`nav a[href="${href}"]`).count();
      check(`the ${label} tab is there`, n === 2, `${n} links to ${href}`);
      const visible = await p.locator(`nav:visible a[href="${href}"]`).count();
      check(`and exactly one of them is on screen`, visible === 1, `${visible} visible`);
    }
    check(
      "Home is marked as the tab you are on",
      (await p.locator('nav:visible a[aria-current="page"]').innerText()).trim() === "Home"
    );

    /* ---------- draft: it says what is unfinished, and where -------- */
    const text = await body(p);
    check("a draft profile is reported as unfinished", /Not finished yet/.test(text));
    check("with a percentage", /\d+%/.test(text));
    const cont = p.locator('a[href^="/onboarding/"]').first();
    check("and a link into the next step", (await cont.count()) === 1);
    check(
      "which names that step rather than saying 'continue'",
      /Continue — About you/.test(text),
      text.slice(0, 200)
    );

    /* Browsing is shut, and the dashboard says so rather than offering
       a link that leads to a refusal. */
    check(
      "browsing is described as closed until the profile is sent in",
      /Browsing opens once you have finished your profile and sent it in/.test(text)
    );

    /* Her wali is one of the five steps she has not reached yet. Being
       told off about it on day one is not a state worth having. */
    check("no wali alarm while the profile is still hers to finish", !/wali has not confirmed/i.test(text));

    /* ---------- the counters ---------------------------------------- */
    /* Case-insensitively: these labels are uppercased in CSS, and
       `innerText` reports what is rendered, not what is in the source. */
    for (const label of ["Waiting on you", "Conversations", "You asked"]) {
      check(`the "${label}" count is shown`, new RegExp(label, "i").test(text));
    }
    /* The monthly quota is not one of them. It buys requests, and a
       draft cannot send one — so it appears with the pool, once the
       pool is open, and is asserted on the live dashboard below. */
    check("the quota is not offered to a draft", !/Requests left/i.test(text));

    /* ---------- waiting on us --------------------------------------- */
    await profiles.updateOne(
      { userId: user._id },
      { $set: { status: "pendingReview", submittedAt: new Date() } }
    );
    await p.goto(`${BASE}/dashboard?submitted=1`, { waitUntil: "networkidle" });
    const waitingText = await body(p);
    check("a submitted profile is acknowledged", /Thank you — we have it/.test(waitingText));
    /* D1f, deferred: sending the profile in is what puts somebody in the
       pool, so this state is no longer a waiting room. The strict
       setting still exists and still says "With our team" — what must
       never happen is this screen describing a queue the member is not
       actually standing in. */
    check("and reported as being in the pool", /In the pool/.test(waitingText));
    check("the checks are still promised, alongside them", /telephones/.test(waitingText));
    check("browsing is offered rather than shut", /Browse the pool/.test(waitingText));
    check(
      "and the pool is not claimed to be fully checked",
      !/every one checked by our team/i.test(waitingText)
    );
    check(
      "the unfinished checklist is gone",
      !/Not finished yet/.test(waitingText) && !/\d+% *$/m.test(waitingText)
    );
    /* Now it blocks something, so now it is said. */
    check("the wali is raised once it is out of her hands", /wali has not confirmed/i.test(waitingText));

    /* ---------- live ------------------------------------------------ */
    await profiles.updateOne({ userId: user._id }, { $set: { status: "live" } });
    await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    const liveText = await body(p);
    check("a live profile is reported as live", /\bLive\b/.test(liveText));
    check("with the pool offered", /Browse the pool/.test(liveText));
    check("and the closed-pool notice withdrawn", !/Browsing opens once/.test(liveText));
    check("the monthly quota is shown once she can spend it", /Requests left/i.test(liveText));
    /* The date the next grant actually lands, not today's. It used to
       print `now` beside the word "renews", which reads as the renewal
       day — so this asserts the first of a month, and that it is not
       today. */
    const renews = /(\d+) more on ([A-Z][a-z]{2} 1, \d{4})/.exec(liveText);
    check("it says when the next connections arrive", Boolean(renews), liveText.slice(0, 200));
    check(
      "and that date is not today",
      Boolean(renews) && renews[2] !== new Intl.DateTimeFormat("en-CA", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date()),
      renews && renews[2]
    );
    /* Still three counts, and still no fourth box for the quota. */
    for (const label of ["Waiting on you", "Conversations", "You asked"]) {
      check(`the "${label}" count survives going live`, new RegExp(label, "i").test(liveText));
    }

    /* ---------- and it is where signing in lands -------------------- */
    const fresh = await browser.newPage();
    await fresh.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await fresh.fill('input[name="email"]', EMAIL);
    await fresh.fill('input[name="password"]', PASSWORD);
    await fresh.click('button[type="submit"]');
    await fresh.waitForURL("**/dashboard", { timeout: 20_000 }).catch(() => {});
    check("signing in lands on the dashboard", new URL(fresh.url()).pathname === "/dashboard", fresh.url());

    /* ---------- signed in, the public front door still opens -------- */
    for (const [from, why] of [
      ["/login", "there is nothing to sign in to"],
      ["/register", "the form would only say the address is taken"],
    ]) {
      await p.goto(BASE + from, { waitUntil: "networkidle" });
      check(
        `${from} sends a signed-in member to the dashboard — ${why}`,
        new URL(p.url()).pathname === "/dashboard",
        p.url()
      );
    }

    /* The homepage is not one of them any more. It used to redirect a
       member to their dashboard, which meant they could not read the
       pricing, check the process before explaining it to a relative, or
       follow a link somebody had sent them. The nav answers instead —
       see scripts/nav-check.cjs. */
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    check(
      "/ leaves a signed-in member on the homepage",
      new URL(p.url()).pathname === "/",
      p.url()
    );

    /* The marketing pages themselves stay readable. Only the front door
       moves; a member who wants to re-read how it works, or the privacy
       policy, must still be able to. */
    for (const open of ["/how-it-works", "/legal/privacy", "/legal/terms"]) {
      await p.goto(BASE + open, { waitUntil: "networkidle" });
      check(`${open} is still readable while signed in`, new URL(p.url()).pathname === open, p.url());
    }

    /* A ?next is still honoured — the fallback changed, not the rule.
       Reached the way a person reaches it: asking for a page while
       signed out, being bounced to sign in, and expecting to arrive
       where they were going rather than at the new default. */
    const aimed = await browser.newPage();
    await aimed.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
    const bounced = new URL(aimed.url());
    check(
      "a signed-out visit is bounced to sign in, carrying where it was going",
      bounced.pathname === "/login" && bounced.searchParams.get("next") === "/settings",
      aimed.url()
    );
    await aimed.fill('input[name="email"]', EMAIL);
    await aimed.fill('input[name="password"]', PASSWORD);
    await aimed.click('button[type="submit"]');
    await aimed.waitForURL("**/settings", { timeout: 45_000 }).catch(() => {});
    check(
      "an explicit ?next still wins",
      new URL(aimed.url()).pathname === "/settings",
      `${aimed.url()} — ${(await body(aimed)).replace(/\s+/g, " ").slice(0, 160)}`
    );

    /* ---------- and nothing bounces forever ------------------------- */
    /* An account with no profile is the one case where /dashboard sends
       somebody *to* /register. If /register sent every session back the
       two would ping-pong until the browser gave up, so this walks that
       exact state rather than trusting the reasoning. */
    await profiles.deleteOne({ userId: user._id });
    p.setDefaultNavigationTimeout(30_000);
    const landed = await p
      .goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
      .then(() => new URL(p.url()).pathname)
      .catch((e) => `threw: ${e.message.split("\n")[0]}`);
    check(
      "a profileless account reaches registration instead of looping",
      landed === "/register",
      landed
    );
  } finally {
    await browser.close();
    const user = await db.collection("users").findOne({ email: EMAIL });
    if (user) {
      const id = new ObjectId(user._id);
      for (const c of ["profiles", "sessions", "connectionLedger", "auditLog"]) {
        await db.collection(c).deleteMany({ userId: { $in: [id, String(id)] } });
      }
      await db.collection("users").deleteOne({ _id: id });
      console.log("\ncleaned up the fixture account");
    }
    await client.close();
  }

  console.log(bad ? `\n${bad} dashboard check(s) FAILED\n` : `\nall dashboard checks pass\n`);
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
