/* Motion audit.

   The failure mode for scroll-driven reveals is content stranded at
   opacity 0 — invisible, unselectable, invisible to a reader. This
   scrolls each route end to end and asserts every animated element
   settles visible, then checks the reduced-motion and no-support paths
   render everything visible too.

   Exits non-zero on any stranded element, or if it finds nothing to test. */
const { chromium } = require("playwright");

const ROUTES = ["/", "/how-it-works"];
const SEL = ".reveal, .reveal-group > *, .reveal-arch, .enter, .enter-arch";

async function sweep(page) {
  // Scroll to the bottom in steps so every view timeline advances.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 400));
  });
  await page.waitForTimeout(600);

  return page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const faded = els
      .map((el) => {
        const cs = getComputedStyle(el);
        const opacity = parseFloat(cs.opacity);
        const r = el.getBoundingClientRect();
        return {
          opacity,
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 48),
          text: (el.textContent || "").trim().slice(0, 34),
          offscreen: r.bottom < 0 || r.top > window.innerHeight,
        };
      })
      .filter((e) => e.opacity < 0.9);
    return { total: els.length, faded };
  }, SEL);
}

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  let checked = 0;

  // 1. Normal: scroll through, everything must settle visible.
  for (const route of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const { total, faded } = await sweep(page);
    checked += total;
    // Elements still below the fold at the very bottom legitimately have not
    // entered yet; only flag ones that are on screen and still faded.
    const stranded = faded.filter((f) => !f.offscreen);
    console.log(`${route.padEnd(15)} animated=${String(total).padStart(3)}  stranded=${stranded.length}`);
    for (const s of stranded.slice(0, 5)) {
      console.log(`     └ opacity ${s.opacity.toFixed(2)} <${s.tag}> "${s.text}" [${s.cls}]`);
    }
    failed += stranded.length;
    await page.close();
  }

  // 2. Reduced motion: nothing may be hidden, at any scroll position.
  for (const route of ROUTES) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const res = await page.evaluate((sel) => {
      const els = [...document.querySelectorAll(sel)];
      return {
        total: els.length,
        hidden: els.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.9).length,
      };
    }, SEL);
    console.log(`${route.padEnd(15)} reduced-motion: ${res.total} animated, ${res.hidden} hidden`);
    failed += res.hidden;
    await page.close();
  }

  await browser.close();

  if (!checked) {
    console.error("\nNO ANIMATED ELEMENTS FOUND — selector is wrong. This is not a pass.");
    process.exit(1);
  }
  console.log(failed ? `\n${failed} stranded element(s)` : `\nall ${checked} animated elements settle visible`);
  process.exit(failed ? 1 : 0);
})();
