/* Responsive audit across every route and a spread of real viewport widths.
   Reports horizontal overflow AND names the element causing it, so a failure
   is actionable rather than just a number. Exits non-zero on any failure.

   Usage: node scripts/responsive.cjs [outDir]   (outDir optional, for shots) */
const { chromium } = require("playwright");
const { assertStyled } = require("./lib/styled.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

const ROUTES = ["/", "/how-it-works"];
const WIDTHS = [320, 360, 390, 414, 480, 640, 768, 834, 1024, 1280, 1440, 1920];

(async () => {
  const outDir = process.argv[2];
  const browser = await chromium.launch();
  const failures = [];

  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      await assertStyled(page, `${route} @ ${width}px`);
      await assertOurApp(page);

      const report = await page.evaluate(() => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        /* The authoritative signal. Decorative elements deliberately sit
           outside the viewport inside overflow-hidden sections and are NOT
           bugs — only a real horizontal scrollbar is. */
        const overflow = doc.scrollWidth - vw;

        let culprits = [];
        if (overflow > 0) {
          const over = [];
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            const past = Math.round(r.right - vw);
            if (past > 1) over.push({ el, past });
          }
          culprits = over
            .filter((o) => !over.some((p) => p !== o && o.el.contains(p.el)))
            .sort((a, b) => b.past - a.past)
            .slice(0, 4)
            .map((o) => ({
              tag: o.el.tagName.toLowerCase(),
              cls: String(o.el.className).slice(0, 70),
              past: o.past,
              text: (o.el.textContent || "").trim().slice(0, 30),
            }));
        }

        // Text clipped by its own box. .sr-only is a 1px clip box by design.
        const clipped = [];
        for (const el of document.querySelectorAll("h1,h2,h3,p,span,a,li,button")) {
          if (el.closest(".sr-only") || String(el.className).includes("sr-only")) continue;
          if (el.scrollWidth - el.clientWidth > 2 && getComputedStyle(el).overflow !== "visible") {
            clipped.push(el.tagName.toLowerCase() + "." + String(el.className).split(" ")[0]);
          }
        }

        return { overflow, culprits, clipped: [...new Set(clipped)].slice(0, 3) };
      });

      const ok = report.overflow <= 0 && report.clipped.length === 0;
      if (!ok) {
        failures.push({ route, width, ...report });
        console.log(`FAIL ${route.padEnd(15)} ${String(width).padStart(4)}px  overflow=${report.overflow}px`);
        for (const c of report.culprits) {
          console.log(`       └ <${c.tag}> +${c.past}px  "${c.text}"  [${c.cls}]`);
        }
        for (const c of report.clipped) console.log(`       └ clipped text: ${c}`);
        if (outDir) {
          await page.screenshot({
            path: `${outDir}/fail-${route.replace(/\W/g, "_")}-${width}.png`,
            fullPage: false,
          });
        }
      } else {
        console.log(`ok   ${route.padEnd(15)} ${String(width).padStart(4)}px`);
      }

      await page.close();
    }
  }

  await browser.close();
  console.log(
    failures.length
      ? `\n${failures.length} failing combination(s)`
      : `\nall ${ROUTES.length * WIDTHS.length} route/width combinations pass`
  );
  process.exit(failures.length ? 1 : 0);
})();
