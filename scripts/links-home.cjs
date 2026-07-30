/* Every href on the homepage must resolve: routes must return 200 and
   fragments must match a real element id. Exits non-zero if it finds no
   links to check. */
const { chromium } = require("playwright");

const BASE = process.env.BASE || "http://localhost:3000";

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(600);

  const { hrefs, ids } = await p.evaluate(() => ({
    hrefs: [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))],
    ids: [...document.querySelectorAll("[id]")].map((e) => e.id),
  }));

  if (!hrefs.length) {
    console.error("FAIL: found no links to check");
    process.exit(1);
  }

  const broken = [];
  for (const href of hrefs) {
    if (!href || href === "#" || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    if (href.startsWith("http")) continue; // external, not ours to police
    if (href.startsWith("#")) {
      if (!ids.includes(href.slice(1))) broken.push(`${href} -> no element with that id`);
      continue;
    }
    const res = await p.request.get(BASE + href);
    if (res.status() >= 400) broken.push(`${href} -> HTTP ${res.status()}`);
  }

  await b.close();
  if (broken.length) {
    console.error(`${broken.length} broken of ${hrefs.length}:\n  ` + broken.join("\n  "));
    process.exit(1);
  }
  console.log(`all ${hrefs.length} distinct links resolve`);
})();
