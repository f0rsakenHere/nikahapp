const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  let bad = 0;
  for (const w of [1440, 1670, 1920]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } });
    for (const route of ["/", "/how-it-works"]) {
      await p.goto("http://127.0.0.1:3000" + route, { waitUntil: "networkidle" });
      await p.waitForTimeout(900);
      const r = await p.evaluate(() => {
        const q = (s) => document.querySelector(s)?.getBoundingClientRect();
        const logo = q("header a");                 // brand mark
        const cta  = q("header .shell > div:last-child"); // right cluster
        const h1   = q("h1");
        const grid = q("main section ol, main section .grid");
        return {
          navL: logo ? Math.round(logo.left) : null,
          navR: cta ? Math.round(cta.right) : null,
          h1L: h1 ? Math.round(h1.left) : null,
          bodyL: grid ? Math.round(grid.left) : null,
          bodyR: grid ? Math.round(grid.right) : null,
        };
      });
      const dL = Math.abs(r.navL - r.h1L);
      const dR = r.navR != null && r.bodyR != null ? Math.abs(r.navR - r.bodyR) : 0;
      if (dL > 1 || dR > 1) bad++;
      console.log(
        `${String(w).padEnd(5)} ${route.padEnd(15)} navL=${r.navL} h1L=${r.h1L} (Δ${dL})  navR=${r.navR} bodyR=${r.bodyR} (Δ${dR})`
      );
    }
    await p.close();
  }
  await b.close();
  console.log(bad ? `\n${bad} misaligned` : "\nnav and content share the same rails");
  process.exit(bad ? 1 : 0);
})();
