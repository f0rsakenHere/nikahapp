const { chromium } = require("playwright");
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.2 });
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/m-hero-early.png` });   // mid on-load stagger
  await p.waitForTimeout(1600);
  await p.screenshot({ path: `${out}/m-hero-settled.png` });
  // mid-scroll, reveals in flight
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.30));
  await p.waitForTimeout(120);
  await p.screenshot({ path: `${out}/m-scroll-inflight.png` });
  await b.close();
  console.log("ok");
})();
