/* Captures the rebuilt page one section at a time at full resolution, so
   defects are visible instead of being lost in a 10,000px thumbnail.
   Optionally captures the same slice of the original template for a
   side-by-side. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = process.env.OUT;
const W = Number(process.env.W || 1440);
const TARGET = process.env.TARGET || "http://localhost:3000/";
const TEMPLATE =
  "file:///D:/Codes/Nikah%20APP/bridely-wedding-event-management-html-template-2024-01-26-13-13-29-utc/Bridely/index.html";

/* label -> [start y, end y] on the page being shot */
const BANDS = JSON.parse(process.env.BANDS);

async function shoot(browser, url, bands, tag, isTemplate) {
  const p = await browser.newPage({ viewport: { width: W, height: 900 } });
  await p.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1500);
  if (isTemplate) {
    await p.addStyleTag({
      content:
        "[data-aos]{opacity:1!important;transform:none!important;transition:none!important}",
    });
  }
  await p.evaluate(async () => {
    const step = window.innerHeight * 0.5;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 130));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(900);

  let n = 0;
  for (const [label, [top, bottom]] of Object.entries(bands)) {
    const height = bottom - top;
    await p.setViewportSize({ width: W, height: Math.min(height, 2400) });
    await p.evaluate((y) => window.scrollTo(0, y), top);
    await p.waitForTimeout(250);
    await p.screenshot({
      path: path.join(OUT, `${tag}-${label}.png`),
      clip: { x: 0, y: 0, width: W, height: Math.min(height, 2400) },
    });
    n++;
  }
  await p.close();
  return n;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const mine = await shoot(b, TARGET, BANDS, process.env.TAG || "mine", false);
  let theirs = 0;
  if (process.env.ALSO_TEMPLATE) {
    theirs = await shoot(b, TEMPLATE, JSON.parse(process.env.ALSO_TEMPLATE), "tpl", true);
  }
  await b.close();
  if (mine === 0) {
    console.error("FAIL: captured no bands");
    process.exit(1);
  }
  console.log(`captured ${mine} band(s)${theirs ? ` + ${theirs} template band(s)` : ""} @${W}px`);
})();
