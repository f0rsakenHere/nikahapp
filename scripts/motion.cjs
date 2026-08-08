/* Motion audit.

   The failure mode for reveal-on-scroll is content stranded at opacity 0
   — present in the DOM, invisible to the reader, and invisible to a
   screenshot taken under reduced motion, which is how it survives review.
   This brings every animated element into view one at a time and asserts
   it settles visible, in both the normal and the reduced-motion path.

   Exits non-zero on any stranded element, or if it finds nothing to test.

   Two notes on how this is done, both learned the hard way:

   1. Selector. This used to target `.reveal` / `.enter`. Both routes moved
      to Framer Motion's `whileInView`, which leaves no class behind — it
      writes opacity and transform as inline style. The old selector matched
      zero elements on every run, so the script only ever printed its own
      "this is not a pass" error. Framer's inline opacity is the signal now.

   2. Method. Scrolling to the bottom and then measuring everything at once
      does not work: elements are caught mid-transition and read as failures,
      and the decorative `.twinkle` art cycles through opacity 0 forever by
      design, so sampling it at a random moment is a coin flip. Each element
      is scrolled into view and given time to settle instead, and the
      decorative layers are excluded rather than being explained away. */
const { chromium } = require("playwright");
const { assertStyled } = require("./lib/styled.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

const ROUTES = ["/", "/how-it-works"];

/* Framer writes inline opacity on every motion component; the CSS classes
   are kept in case that system comes back. */
const SEL = '[style*="opacity"], .reveal, .reveal-group > *, .enter';

/* Purely decorative and deliberately animated forever — a twinkle at
   opacity 0 is the design working, not content going missing. */
const DECORATIVE = '.twinkle, [aria-hidden="true"]';

const SETTLE_MS = 450;

async function strandedElements(page) {
  return page.evaluate(
    async ({ sel, decorative, settle }) => {
      const els = [...document.querySelectorAll(sel)].filter((el) => {
        if (el.matches(decorative) || el.closest(decorative)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      const bad = [];
      for (const el of els) {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        await new Promise((r) => setTimeout(r, settle));
        const opacity = parseFloat(getComputedStyle(el).opacity);
        if (opacity < 0.9) {
          bad.push({
            opacity,
            tag: el.tagName.toLowerCase(),
            cls: String(el.className || "").slice(0, 48),
            text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
          });
        }
      }
      window.scrollTo(0, 0);
      return { total: els.length, bad };
    },
    { sel: SEL, decorative: DECORATIVE, settle: SETTLE_MS }
  );
}

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  let checked = 0;

  for (const mode of ["normal", "reduce"]) {
    for (const route of ROUTES) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 900 },
        ...(mode === "reduce" ? { reducedMotion: "reduce" } : {}),
      });
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await assertStyled(page, `${route} (${mode})`);
      await assertOurApp(page);
      await page.waitForTimeout(600);

      const { total, bad } = await strandedElements(page);
      checked += total;
      failed += bad.length;

      console.log(
        `${mode.padEnd(7)} ${route.padEnd(15)} animated=${String(total).padStart(3)}  stranded=${bad.length}`
      );
      for (const s of bad.slice(0, 6)) {
        console.log(`     └ opacity ${s.opacity.toFixed(2)} <${s.tag}> "${s.text}" [${s.cls}]`);
      }
      await page.close();
    }
  }

  await browser.close();

  if (!checked) {
    console.error("\nNO ANIMATED ELEMENTS FOUND — the selector is wrong. This is not a pass.");
    process.exit(1);
  }
  console.log(
    failed
      ? `\n${failed} stranded element(s) — content that never becomes visible`
      : `\nall ${checked} animated elements settle visible`
  );
  process.exit(failed ? 1 : 0);
})();
