/* Every link on the public pages: does it go somewhere real?
 *
 * The marketing site came from a template, and a template's links point
 * at the template's pages. Several pointed at "#" and several more at a
 * contact form standing in for a product that now exists. Nothing in the
 * type system catches a live `href` string that resolves to nothing, so
 * this walks the rendered DOM and follows every one.
 *
 * In-page anchors are checked against the ids actually present in the
 * DOM — a `/#fee` with no `id="fee"` scrolls nowhere and is a broken
 * link even though it returns 200.
 *
 *   npm run check:links          # dev server must be running
 */
const { chromium } = require("playwright");
const { BASE, assertOurApp } = require("./lib/base.cjs");

const PAGES = ["/", "/how-it-works", "/legal/privacy", "/legal/terms"];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  let bad = 0;
  let checked = false;

  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 90_000 });
    if (!checked) {
      await assertOurApp(page);
      checked = true;
    }

    const links = await page.$$eval("a", (as) =>
      as.map((a) => ({
        href: a.getAttribute("href"),
        text: (a.innerText || a.getAttribute("aria-label") || "").trim().slice(0, 34),
      }))
    );
    const ids = await page.$$eval("[id]", (els) => els.map((e) => e.id));

    console.log(`\n${path}  (${links.length} links)`);
    const seen = new Set();

    for (const { href, text } of links) {
      const key = `${href}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (!href || href === "#") {
        console.log(`  DEAD    "${text}" -> ${href}`);
        bad++;
        continue;
      }
      if (/^(https?:|mailto:|tel:)/.test(href)) {
        console.log(`  ext     "${text}" -> ${href}`);
        continue;
      }

      const [p, hash] = href.split("#");
      const target = p || path;

      if (hash && (target === path || (target === "/" && path === "/"))) {
        const found = ids.includes(hash);
        console.log(`  ${found ? "ok     " : "NO-ID  "} "${text}" -> ${href}`);
        if (!found) bad++;
        continue;
      }

      const status = (await page.request.get(BASE + target, { maxRedirects: 0 })).status();
      const okish = status < 400;
      console.log(`  ${okish ? String(status).padEnd(7) : `FAIL ${status}`} "${text}" -> ${href}`);
      if (!okish) bad++;
    }
  }

  await browser.close();
  console.log(bad ? `\nFAIL  ${bad} broken link(s)\n` : "\nno broken links\n");
  process.exitCode = bad ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${err && err.message}\n`);
  process.exitCode = 1;
});
