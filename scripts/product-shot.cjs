/* Screenshots /how-it-works — full page plus each phone frame individually. */
const { chromium } = require("playwright");

(async () => {
  const out = process.argv[2] || ".";
  const browser = await chromium.launch();

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:3000/how-it-works", { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  await page.screenshot({
    path: `${out}/how-it-works-full.jpg`,
    fullPage: true,
    type: "jpeg",
    quality: 76,
  });

  // Each phone at full resolution, so the screens can actually be read.
  const figures = await page.$$("div[style*='780px']");
  for (let i = 0; i < figures.length; i++) {
    await figures[i].screenshot({ path: `${out}/phone-${i + 1}.png` }).catch(() => {});
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  console.log(`phones: ${figures.length}, horizontal overflow: ${overflow}px`);

  await browser.close();
})();
