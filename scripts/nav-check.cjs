/* What the marketing nav says, and to whom.
 *
 * Two claims, both of which were once wrong:
 *
 *   a member is offered their dashboard, not an invitation to register
 *   for a service they already pay for; and
 *
 *   the homepage stays the homepage. It used to redirect a signed-in
 *   member to /dashboard, so a member could not read the pricing, check
 *   the process before explaining it to a relative, or follow a link
 *   somebody had sent them.
 *
 * Signed out, nothing may change: "Register Now" and "Sign in" are how
 * this site earns anybody at all.
 *
 *   node scripts/nav-check.cjs
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

loadEnv();
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const PASSWORD = "one good passphrase";
const MEMBER = "yusuf.rahman@seed.test";
const PAGES = ["/", "/how-it-works"];

let failed = 0;
function check(what, ok, detail = "") {
  console.log(`${ok ? "pass" : "FAIL"}  ${what}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failed++;
}

/** The header only. The page below it has its own "Register Now" bands,
 *  which are a separate question from what the nav offers. */
async function nav(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header");
    if (!header) return null;
    const shown = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const links = [...header.querySelectorAll("a[href]")].filter(shown);
    return {
      dashboard: links
        .filter((a) => new URL(a.href, location.origin).pathname === "/dashboard")
        .map((a) => a.getAttribute("aria-label") || a.textContent.trim()),
      register: links.some((a) => new URL(a.href, location.origin).pathname === "/register"),
      signIn: links.some((a) => new URL(a.href, location.origin).pathname === "/login"),
    };
  });
}

async function signIn(context) {
  const p = await context.newPage();
  p.setDefaultTimeout(30_000);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90_000 });
  await p.fill('input[name="email"]', MEMBER);
  await p.fill('input[name="password"]', PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await p.close();
}

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const member = await db.collection("users").findOne({ email: MEMBER });
  await client.close();
  if (!member) {
    console.error("\nFAIL  no seeded member. Run: node scripts/seed-pool.cjs --apply\n");
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch();
  try {
    /* ---------------------------------------------- signed out ---- */
    const out = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const guest = await out.newPage();
    guest.setDefaultTimeout(30_000);

    for (const path of PAGES) {
      await guest.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });
      if (path === "/") await assertOurApp(guest);
      const n = await nav(guest);
      check(`signed out, ${path} offers Register Now`, n?.register === true);
      check(`signed out, ${path} offers Sign in`, n?.signIn === true);
      check(`signed out, ${path} offers no dashboard`, n?.dashboard.length === 0);
    }
    await out.close();

    /* ------------------------------------------------ signed in ---- */
    const inn = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await signIn(inn);
    const member_ = await inn.newPage();
    member_.setDefaultTimeout(30_000);

    for (const path of PAGES) {
      await member_.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });
      check(
        `signed in, ${path} is not redirected away`,
        new URL(member_.url()).pathname === path,
        member_.url()
      );
      const n = await nav(member_);
      check(`signed in, ${path} offers the dashboard`, n?.dashboard.length === 1, JSON.stringify(n?.dashboard));
      check(`signed in, ${path} does not offer Register Now`, n?.register === false);
      check(`signed in, ${path} does not offer Sign in`, n?.signIn === false);
    }

    /* The label is the first thing to go when the bar runs out of room,
       so the phone is checked separately: the glyph must still be there
       and must still be named. */
    await member_.setViewportSize({ width: 320, height: 844 });
    await member_.goto(BASE + "/", { waitUntil: "networkidle" });
    const small = await nav(member_);
    check("on a 320px phone the dashboard is still in the bar", small?.dashboard.length === 1);
    check(
      "and is still named for a screen reader",
      small?.dashboard[0] === "Dashboard",
      String(small?.dashboard[0])
    );
    const sideways = await member_.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    check("without pushing the page sideways", sideways <= 1, `${sideways}px`);
    await inn.close();
  } finally {
    await browser.close();
  }

  console.log(failed ? `\n${failed} nav check(s) failed\n` : "\nall nav checks pass\n");
  process.exitCode = failed ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
