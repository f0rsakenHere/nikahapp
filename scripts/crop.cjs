/* Full-resolution crops of a long page, so defects that vanish when a
   14000px capture is scaled to fit are still visible. */
const { chromium } = require("playwright");
const path = require("path");

const OUT = process.env.OUT;
const BASE = process.env.BASE || "http://localhost:3000";
const ROUTE = process.env.ROUTE || "/";
const W = Number(process.env.W || 1440);
// "name:y:height,name:y:height"
const BANDS = (process.env.BANDS || "").split(",").filter(Boolean);

(async () => {
  if (!OUT || BANDS.length === 0) {
    console.error("FAIL: OUT and BANDS are required");
    process.exit(1);
  }

  const b = await chromium.launch();
  const p = await b.newPage({
    viewport: { width: W, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });

  const errors = [];
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

  const res = await p.goto(BASE + ROUTE, { waitUntil: "networkidle", timeout: 60000 });
  if (!res || res.status() >= 400) {
    console.error(`FAIL: ${ROUTE} returned ${res && res.status()}`);
    process.exit(1);
  }

  await p.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(800);

  const docH = await p.evaluate(() => document.body.scrollHeight);
  let n = 0;

  for (const band of BANDS) {
    const [name, yRaw, hRaw] = band.split(":");
    const y = Number(yRaw);
    const h = Number(hRaw);
    if (y >= docH) {
      console.error(`FAIL: band "${name}" starts at ${y} but the page is only ${docH}px`);
      process.exit(1);
    }
    const file = path.join(OUT, `crop-${name}.png`);
    await p.screenshot({
      path: file,
      fullPage: true,
      clip: { x: 0, y, width: W, height: Math.min(h, docH - y) },
    });
    console.log(`${name}  y=${y} h=${h}  -> ${path.basename(file)}`);
    n++;
  }

  if (errors.length) {
    console.log(`\nPAGE ERRORS (${errors.length}):`);
    errors.slice(0, 8).forEach((e) => console.log("  " + e));
  } else {
    console.log("\nno console or page errors");
  }

  if (n !== BANDS.length) {
    console.error("FAIL: not every band was captured");
    process.exit(1);
  }
  console.log(`page height ${docH}px, ${n} crops written`);
  await b.close();
})();
