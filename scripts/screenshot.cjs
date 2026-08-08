/* Screenshots the running dev server. Usage: node scripts/screenshot.cjs <outDir> */
const { chromium } = require("playwright");
const { BASE } = require("./lib/base.cjs");

(async () => {
  const out = process.argv[2] || ".";
  const browser = await chromium.launch();

  // Full page at half scale so the image stays a manageable size.
  const wide = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 0.5,
  });
  await wide.goto(BASE + "/", { waitUntil: "networkidle" });
  await wide.waitForTimeout(1500);
  await wide.screenshot({ path: `${out}/full.jpg`, fullPage: true, type: "jpeg", quality: 78 });

  // Crisp per-section captures.
  const shot = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await shot.goto(BASE + "/", { waitUntil: "networkidle" });
  await shot.waitForTimeout(1500);
  for (const [name, sel] of [
    ["hero", "#top"],
    ["why", "#why"],
    ["steps", "#steps"],
    ["scholars", "#scholars"],
    ["safety", "#safety"],
    ["fee", "#fee"],
    ["faq", "#faq"],
    ["cta", "#start"],
  ]) {
    const el = await shot.$(sel);
    if (el) await el.screenshot({ path: `${out}/s-${name}.png` }).catch(() => {});
  }

  await browser.close();
  console.log("ok");
})();
