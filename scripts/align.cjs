/* The container rule: every `.shell-b` on a page — the header's, each
   section's, the footer's — must land on the same left and right rails.
   Horizontal padding belongs on the outer element, with `.shell-b` nested
   inside; putting it on the container instead pulls that one band out of
   alignment with the rest of the page, which is the exact defect this
   catches.

   Rewritten from the version that compared the nav's rail against the
   <h1>. That rule described the original design, where the h1 opened at
   the left rail. It holds on neither page now — the homepage sets its h1
   in the hero's right column and /how-it-works centres it — and the
   check's other two selectors (`header .shell`, `main section ol`) match
   nothing at all since the rebuild, so they were quietly comparing null
   to null and reporting a pass on both. */
const { chromium } = require("playwright");
const { assertStyled } = require("./lib/styled.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

const ROUTES = ["/", "/how-it-works"];
const WIDTHS = [1440, 1670, 1920];

(async () => {
  const b = await chromium.launch();
  let bad = 0;
  let compared = 0;

  for (const w of WIDTHS) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });

    for (const route of ROUTES) {
      await p.goto(BASE + route, { waitUntil: "networkidle" });
      await p.waitForTimeout(700);
      /* Especially important here: unstyled, every .shell-b is full-width
         and they all "agree", so this check reports a false PASS. */
      await assertStyled(p, `${route} @ ${w}`);
      await assertOurApp(p);

      const rails = await p.evaluate(() =>
        [...document.querySelectorAll(".shell-b")].map((el) => {
          const r = el.getBoundingClientRect();
          return {
            left: Math.round(r.left),
            right: Math.round(r.right),
            // enough of the section to name it in a failure
            hint: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34),
          };
        })
      );

      if (rails.length < 2) {
        console.error(`FAIL: ${route} @ ${w} — found ${rails.length} .shell-b containers, expected several`);
        await b.close();
        process.exit(1);
      }

      const { left, right } = rails[0];
      const off = rails.filter((r) => Math.abs(r.left - left) > 1 || Math.abs(r.right - right) > 1);
      compared += rails.length;

      if (off.length) {
        bad++;
        console.log(`${String(w).padEnd(5)} ${route.padEnd(15)} rail ${left}..${right}  ${off.length}/${rails.length} OFF`);
        for (const o of off.slice(0, 4)) {
          console.log(`      ${o.left}..${o.right}  "${o.hint}"`);
        }
      } else {
        console.log(`${String(w).padEnd(5)} ${route.padEnd(15)} rail ${left}..${right}  all ${rails.length} agree`);
      }
    }

    await p.close();
  }

  await b.close();

  if (compared === 0) {
    console.error("FAIL: nothing was compared");
    process.exit(1);
  }
  console.log(
    bad ? `\n${bad} route/width pairs misaligned` : `\n${compared} containers checked, all share their page's rails`
  );
  process.exit(bad ? 1 : 0);
})();
