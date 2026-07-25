/* Contact sheet of a folder of images, rendered on the site's dark hero
   ground so candidates can be judged against the real palette.
   Usage: node scripts/contact.cjs <imageDir> <out.png> */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const dir = process.argv[2];
  const out = process.argv[3];
  const files = fs.readdirSync(dir).filter((f) => /\.(jpg|png)$/i.test(f)).sort();

  /* Inlined as data URIs — Chromium refuses file:// subresources from a
     setContent page and would render broken icons. */
  const cells = files
    .map((f) => {
      const b64 = fs.readFileSync(path.join(dir, f)).toString("base64");
      const mime = f.toLowerCase().endsWith(".png") ? "png" : "jpeg";
      return `<figure><div class="arch"><img src="data:image/${mime};base64,${b64}"></div><figcaption>${f}</figcaption></figure>`;
    })
    .join("");

  const html = `<style>
    body{margin:0;background:#10201A;font:12px system-ui,sans-serif;color:#B9C9C0;
      display:grid;grid-template-columns:repeat(5,1fr);gap:18px;padding:18px}
    figure{margin:0}
    .arch{border-radius:50% 50% 22px 22px / 38% 38% 22px 22px;overflow:hidden;
      aspect-ratio:440/560;box-shadow:0 24px 50px -20px rgba(0,0,0,.6)}
    img{width:100%;height:100%;object-fit:cover;display:block;
      filter:sepia(.16) saturate(.94) contrast(1.03)}
    figcaption{padding:6px 0;font-size:11px}
  </style>${cells}`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
  await page.setContent(html);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log("ok " + files.length);
})();
