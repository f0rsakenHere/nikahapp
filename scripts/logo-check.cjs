/* Every place the logo is drawn: right shape, on screen, big enough to
 * press.
 *
 * Why this is not part of responsive-check: that script looks for things
 * that overflow, clip, or come out too small to read. A squashed logo
 * does none of those. Tailwind's preflight puts `max-width:100%` on
 * images, and with `w-auto` and a height utility that does not scale a
 * too-wide mark down — it clamps the width and leaves the height alone.
 * The mark is then the wrong shape, entirely inside its container, and
 * invisible to every geometric rule the other sweep has. It happened:
 * the footer lockup at 320px was 27% narrow, and passed a clean sweep.
 *
 * So this compares the drawn aspect ratio against the file's own, which
 * is the only measurement that can tell. It also checks the mark is
 * on screen and that whatever link wraps it clears the 40px tap floor,
 * because those are cheap once a browser is open.
 *
 * Hidden copies are skipped rather than failed — the app frame ships two
 * logos, a rail and a phone header, and exactly one is ever displayed.
 *
 *   BASE=http://127.0.0.1:3001 node scripts/logo-check.cjs
 *   node scripts/logo-check.cjs <dir>     # also writes screenshots
 */
const { chromium } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

const OUT = process.argv[2] || null;
const PASSWORD = "one good passphrase";
const MEMBER = "yusuf.rahman@seed.test";
const WIDTHS = [320, 390, 768, 1440];
const MIN_TAP = 40;
/* Half a percent of skew is rounding in getBoundingClientRect, not a
   distorted logo. Twenty-seven percent was the real one. */
const MAX_SKEW = 0.01;

loadEnv();
let bad = 0;

(async () => {
  const client = new MongoClient(requireEnv("MONGODB_URI"), {
    serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");
  const member = await db.collection("users").findOne({ email: MEMBER });
  await client.close();
  if (!member) {
    console.error("\nFAIL  no seeded member. Run: node scripts/seed-pool.cjs --apply\n");
    process.exit(1);
  }

  const browser = await chromium.launch();

  async function look(context, role, path, width) {
    const p = await context.newPage();
    p.setDefaultTimeout(45_000);
    await p.setViewportSize({ width, height: 900 });
    await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });

    /* Scrolled and awaited, because the footer mark is lazy and an image
       that has not loaded reports a natural size of zero — which reads
       as "no logo here" and would have failed this check for a page that
       is perfectly fine. */
    /* Measured at the bottom of the page, and that is the point. The
       footer mark is lazy, so it does not begin loading until it is in
       view — scrolling down and straight back up reported it as an image
       that never loaded on every single page. Staying put until it has
       actually arrived is the only honest way to measure it. Horizontal
       geometry, which is all this checks, does not care where the page
       is scrolled to. */
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p
      .waitForFunction(
        () =>
          [...document.querySelectorAll('img[src*="brand"], img[srcset*="brand"]')].every(
            (i) => i.complete
          ),
        undefined,
        { timeout: 15_000 }
      )
      /* A timeout here is not a pass. It falls through to the natural-size
         check below, which reports the image as never having loaded. */
      .catch(() => {});
    await p.waitForTimeout(300);

    const found = await p.evaluate(() =>
      [...document.querySelectorAll('img[src*="brand"], img[srcset*="brand"]')].map((el) => {
        const r = el.getBoundingClientRect();
        const link = el.closest("a");
        const lr = link ? link.getBoundingClientRect() : null;
        return {
          w: r.width,
          h: r.height,
          natW: el.naturalWidth,
          natH: el.naturalHeight,
          left: Math.round(r.left),
          right: Math.round(r.right),
          hidden: r.width === 0 && r.height === 0,
          tapH: lr ? lr.height : null,
          tapW: lr ? lr.width : null,
          src: (el.currentSrc || el.src).split("/").pop().slice(0, 40),
        };
      })
    );

    const shown = found.filter((f) => !f.hidden);
    if (!shown.length) {
      console.log(`FAIL  ${role} ${width}px ${path} — no logo is displayed on this page`);
      bad++;
    }

    for (const f of shown) {
      if (!f.natW || !f.natH) {
        console.log(`FAIL  ${role} ${width}px ${path} — the logo never loaded`);
        bad++;
        continue;
      }
      const drawn = f.w / f.h;
      const real = f.natW / f.natH;
      const skew = Math.abs(drawn - real) / real;
      const off = f.right > width + 1 || f.left < -1;
      const tap = f.tapH !== null && (f.tapH < MIN_TAP || f.tapW < MIN_TAP);
      const ok = skew <= MAX_SKEW && !off && !tap;
      if (!ok) bad++;
      console.log(
        `${ok ? "pass" : "FAIL"}  ${role.padEnd(6)} ${String(width).padStart(4)}px ` +
          `${path.padEnd(11)} ${Math.round(f.w)}×${Math.round(f.h)}` +
          `${skew > MAX_SKEW ? `  SQUASHED ${(skew * 100).toFixed(0)}% — drawn ${drawn.toFixed(2)}, artwork ${real.toFixed(2)}` : ""}` +
          `${off ? `  OFF SCREEN right=${f.right}` : ""}` +
          `${tap ? `  TAP ${Math.round(f.tapW)}×${Math.round(f.tapH)} under ${MIN_TAP}` : ""}`
      );
    }

    if (OUT) {
      await p.screenshot({
        path: `${OUT}/${role}-${width}-${path.replace(/\W+/g, "_") || "home"}.png`,
        fullPage: true,
      });
    }
    await p.close();
  }

  try {
    const out = await browser.newContext();
    const first = await out.newPage();
    await first.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 120_000 });
    await assertOurApp(first);
    await first.close();

    for (const w of WIDTHS) {
      await look(out, "out", "/", w);
      await look(out, "out", "/login", w);
    }

    const inn = await browser.newContext();
    const s = await inn.newPage();
    await s.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await s.fill('input[name="email"]', MEMBER);
    await s.fill('input[name="password"]', PASSWORD);
    await s.click('button[type="submit"]');
    await s.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }).catch(() => {});
    await s.close();

    for (const w of WIDTHS) {
      await look(inn, "member", "/dashboard", w);
      await look(inn, "member", "/", w);
    }
  } finally {
    await browser.close();
  }

  console.log(
    bad
      ? `\n${bad} logo problem(s)\n`
      : `\nevery logo is the right shape, on screen and tappable\n`
  );
  process.exitCode = bad ? 1 : 0;
})().catch((e) => {
  console.error(`\nFAIL  ${(e && e.message) || e}\n`);
  process.exitCode = 1;
});
