/* Full-page captures of the rebuilt homepage, for eyeballing against the
   original template.

   Captured under `prefers-reduced-motion: reduce`. Playwright's fullPage
   screenshot resizes the viewport to the whole document, which re-triggers
   Framer Motion's whileInView observers and photographs half the page
   mid-reveal — scrolling first does not reliably fix it. Reduced motion
   makes every Reveal render as a plain element in its settled state, and
   holds the decorative twinkles at full opacity instead of catching them
   at a random point in their 10s fade, so the capture shows what a reader
   actually ends up looking at. */
const { chromium } = require("playwright");
const path = require("path");

const OUT = process.env.OUT;
const BASE = process.env.BASE || "http://localhost:3000";
const ROUTE = process.env.ROUTE || "/";

const SIZES = (process.env.SIZES || "1440x900,390x844")
  .split(",")
  .map((s) => s.split("x").map(Number));

(async () => {
  const b = await chromium.launch();
  let shot = 0;
  for (const [w, h] of SIZES) {
    const p = await b.newPage({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && errors.push(m.text()));

    const res = await p.goto(BASE + ROUTE, { waitUntil: "networkidle", timeout: 60000 });
    if (!res || res.status() >= 400) {
      console.error(`FAIL: ${ROUTE} returned ${res && res.status()}`);
      process.exit(1);
    }
    await p.waitForTimeout(1200);

    // walk the page so every whileInView block has fired
    await p.evaluate(async () => {
      const step = window.innerHeight * 0.6;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await p.waitForTimeout(900);

    const file = path.join(OUT, `${process.env.NAME || "site"}-${w}.png`);
    await p.screenshot({ path: file, fullPage: true });
    const height = await p.evaluate(() => document.body.scrollHeight);
    console.log(`${w}x${h}  page height ${height}px  -> ${path.basename(file)}`);
    if (errors.length) console.log(`  console errors: ${errors.slice(0, 4).join(" | ")}`);
    shot++;
    await p.close();
  }
  if (shot === 0) {
    console.error("FAIL: captured nothing");
    process.exit(1);
  }
  await b.close();
})();
