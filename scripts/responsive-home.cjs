/* Horizontal-overflow check for the rebuilt homepage.

   Names the offending element rather than just reporting a number, and
   exits non-zero if it finds nothing to test — a checker that silently
   passes because its selector stopped matching is worse than no checker. */
const { chromium } = require("playwright");

const WIDTHS = [320, 360, 375, 390, 414, 430, 540, 768, 834, 1024, 1180, 1280, 1440, 1600, 1920];
const BASE = process.env.BASE || "http://localhost:3000";
const ROUTES = (process.env.ROUTES || "/,/how-it-works").split(",");

(async () => {
  const b = await chromium.launch();
  const failures = [];
  let checked = 0;

  for (const route of ROUTES) {
    for (const w of WIDTHS) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      const res = await p.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
      if (!res || res.status() >= 400) {
        failures.push(`${route} @${w}: HTTP ${res && res.status()}`);
        await p.close();
        continue;
      }
      await p.waitForTimeout(500);

      const report = await p.evaluate((vw) => {
        const doc = document.documentElement;
        const overflow = doc.scrollWidth - vw;
        const culprits = [];
        if (overflow > 0) {
          document.querySelectorAll("*").forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            // .sr-only clips itself to a 1px box on purpose
            if (el.classList.contains("sr-only")) return;
            const right = r.right + window.scrollX;
            if (right > vw + 1 || r.left < -1) {
              // only blame it if it is actually the thing that scrolls
              let node = el.parentElement;
              let clipped = false;
              while (node) {
                const ov = getComputedStyle(node).overflowX;
                if (ov === "hidden" || ov === "clip" || ov === "auto") {
                  clipped = true;
                  break;
                }
                node = node.parentElement;
              }
              if (!clipped) {
                culprits.push(
                  `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 70)}"> ` +
                    `left=${Math.round(r.left)} right=${Math.round(right)}`
                );
              }
            }
          });
        }
        return { overflow, culprits: culprits.slice(0, 3), tallest: doc.scrollHeight };
      }, w);

      checked++;
      if (report.overflow > 0) {
        failures.push(
          `${route} @${w}px overflows by ${report.overflow}px\n      ` +
            (report.culprits.join("\n      ") || "(no unclipped culprit found)")
        );
      }
      await p.close();
    }
  }

  await b.close();

  if (checked === 0) {
    console.error("FAIL: checked nothing");
    process.exit(1);
  }
  if (failures.length) {
    console.error(`${failures.length} of ${checked} combinations FAILED:\n  ` + failures.join("\n  "));
    process.exit(1);
  }
  console.log(`all ${checked} route/width combinations pass (no horizontal overflow)`);
})();
