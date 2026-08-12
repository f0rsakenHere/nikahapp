/* Phone screenshots of every member screen, so they can be looked at
 * rather than only measured. Real iPhone device metrics, both the
 * viewport (what you actually see) and the whole page.
 *
 *   node scripts/phone-shots.cjs <outDir> [width]
 */
const fs = require("fs");
const { chromium, devices } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

const OUT = process.argv[2] || ".";
const PASSWORD = "one good passphrase";
const MEMBER = "yusuf.rahman@seed.test";

loadEnv();
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const member = await db.collection("users").findOne({ email: MEMBER });
  if (!member) throw new Error("no seeded member — run: node scripts/seed-pool.cjs --apply");
  const profile = await db
    .collection("profiles")
    .findOne({ gender: "sister", status: "live" }, { sort: { _id: 1 } });
  const conversation = await db
    .collection("conversations")
    .findOne({ "participants.userId": String(member._id) });
  await client.close();

  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const width = Number(process.argv[3]) || 0;
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    ...(width ? { viewport: { width, height: 844 } } : {}),
  });

  const p = await context.newPage();
  p.setDefaultTimeout(45_000);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 120_000 });
  await assertOurApp(p);
  await p.screenshot({ path: `${OUT}/00-login.png` });
  await p.fill('input[name="email"]', MEMBER);
  await p.fill('input[name="password"]', PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 90_000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});

  const SHOTS = [
    ["01-dashboard", "/dashboard"],
    ["02-browse", "/browse"],
    ["03-browse-new", "/browse?new=1"],
    ["04-profile", profile ? `/browse/${profile._id}` : null],
    ["05-requests", "/requests"],
    ["06-conversations", "/conversations"],
    ["07-thread", conversation ? `/conversations/${conversation._id}` : null],
    ["08-notifications", "/notifications"],
    ["09-onboarding", "/onboarding"],
    ["10-onboarding-basics", "/onboarding/basics"],
    ["11-settings", "/settings"],
  ].filter(([, path]) => path);

  for (const [name, path] of SHOTS) {
    await p.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(700);
    const landed = new URL(p.url()).pathname;
    await p.screenshot({ path: `${OUT}/${name}.png` });
    await p.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
    console.log(`${name.padEnd(22)} ${path} → ${landed}`);
  }

  await browser.close();
  console.log("ok");
})().catch((e) => {
  console.error(`\nFAIL  ${(e && e.message) || e}\n`);
  process.exitCode = 1;
});
