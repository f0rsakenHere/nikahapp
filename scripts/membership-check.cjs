/* The membership page, and the webhook that pays for it.
 *
 * Money is the one thing a member will certainly dispute, so this
 * checks the things that would be embarrassing to get wrong: that the
 * right price is shown to the right person, that the PayPal button is
 * really drawn rather than a dead box, and — the part that matters most
 * — that the endpoint granting memberships cannot be talked into
 * granting one.
 *
 *   BASE=https://nikahcanada.ca node scripts/membership-check.cjs
 */
const { chromium, devices } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

loadEnv();
const mongo = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const SISTER = "aisha.rahman@seed.test";
const PASSWORD = "one good passphrase";

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

(async () => {
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB || "nikahcanada");
  const browser = await chromium.launch();

  try {
    /* ---------- the endpoint refuses what it cannot verify ---------- */
    const forged = `forged-${Date.now()}`;
    const res = await fetch(`${BASE}/api/paypal/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: forged,
        event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        resource: {
          id: "I-FORGED",
          custom_id: "deadbeefdeadbeefdeadbeef",
          billing_info: { next_billing_time: "2030-01-01T00:00:00Z" },
        },
      }),
    });
    check(
      "an unsigned event is refused",
      res.status === 400,
      `the endpoint answered ${res.status}`
    );

    /* Not merely refused — it must not have reached the database. A
       recorded forgery would mean the write happened before the check. */
    const wrote = await db.collection("payments").countDocuments({ eventId: forged });
    check("and it never reaches the database", wrote === 0, `${wrote} row(s) written`);

    /* Nobody's membership moved. The id in the forged event is not a
       real account, but a handler that trusted `custom_id` before
       verifying would have tried. */
    const granted = await db
      .collection("users")
      .countDocuments({ planActiveUntil: { $gt: new Date("2029-01-01") } });
    check("and nobody was granted a membership by it", granted === 0, `${granted} account(s)`);

    /* ---------- what a member sees ---------------------------------- */
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    const page = await ctx.newPage();
    page.setDefaultTimeout(45_000);

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await assertOurApp(page);
    await page.fill('input[name="email"]', SISTER);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('main button[type="submit"]');
    await page.waitForTimeout(4000);

    await page.goto(`${BASE}/membership`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => /Membership|month/i.test(document.body.innerText), {
      timeout: 30_000,
    });
    const seen = await page.evaluate(() => document.body.innerText);

    const me = await db.collection("users").findOne({ email: SISTER });
    const paid = me?.planActiveUntil && me.planActiveUntil > new Date();

    if (paid) {
      check("a paid-up member is told when it runs to", /active until/i.test(seen), seen.slice(0, 160));
    } else {
      /* A sister, so $9.99 — and emphatically not $19.99. Showing
         somebody the other gender's price is the kind of mistake that
         ends up in a screenshot. */
      check("a sister is quoted $9.99", /\$9\.99/.test(seen), seen.slice(0, 200));
      check("and never the brothers' price", !/\$19\.99/.test(seen), seen.slice(0, 200));

      /* What the page should say depends on whether the paywall is on,
         so it is read from settings rather than assumed. The first
         version of this check expected the word "free" and failed
         against a site where charging is switched off — where the page
         correctly says the opposite, that nothing is closed to you. */
      const settings = (await db.collection("settings").findOne({})) ?? {};
      const gateOn = settings.planGate && settings.planGate !== "nobody";
      check(
        gateOn
          ? "the page says what stays free, so the price is not read as a gate on everything"
          : "with charging off, the page says so instead of implying a gate",
        gateOn
          ? /free/i.test(seen)
          : /not required|every part of the site is open/i.test(seen),
        `planGate=${settings.planGate ?? "(unset)"} — ${seen.replace(/\s+/g, " ").slice(0, 160)}`
      );

      /* The button is PayPal's own, drawn into an iframe by their
         script. Checking for the iframe rather than for our markup is
         the difference between "we rendered a container" and "a member
         can actually pay". */
      const drawn = await page
        .waitForSelector('iframe[name^="__paypal"], iframe[title*="PayPal" i], div[data-funding-source]', {
          timeout: 25_000,
        })
        .then(() => true)
        .catch(() => false);
      check(
        "PayPal's button is really drawn, not just a box where one should be",
        drawn,
        "no PayPal iframe appeared — the SDK did not load or the plan id is wrong"
      );
    }

    /* The card is never ours to see. */
    check(
      "and the page says who takes the payment",
      /PayPal/.test(seen),
      seen.slice(0, 200)
    );

    /* ---------- pricing leads somewhere useful --------------------
       Signed in, "Get started" on a price used to go to the dashboard.
       It navigated perfectly well and still looked broken: a member who
       is already signed in presses a price, lands on their own
       dashboard, and reads that as the button doing nothing. */
    await page.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    /* Only one price can ever be yours — gender is fixed at signup — so
       signed in there is exactly one button, on your own card. Two
       identical buttons read as a choice, and pressing the other one
       landed this sister on a page quoting $9.99, which looks broken. */
    const buttons = await page.locator(".pricing-plan-button").count();
    check("signed in, only your own plan is offered", buttons === 1, `${buttons} buttons`);
    const note = await page.locator(".pricing-plan-note").innerText().catch(() => "");
    check(
      "and the other price is stated, not pressable",
      /brothers/i.test(note),
      `the note says ${JSON.stringify(note)}`
    );

    const cta = page.locator(".pricing-plan-button").first();
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await cta.click();
    const landed = await page
      .waitForURL("**/membership", { timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    check(
      "a signed-in member pressing a price reaches membership",
      landed,
      `landed on ${new URL(page.url()).pathname}`
    );
  } finally {
    await browser.close();
    await mongo.close();
  }

  console.log(bad ? `\n${bad} check(s) failed` : "\nall good");
  process.exitCode = bad ? 1 : 0;
})();
