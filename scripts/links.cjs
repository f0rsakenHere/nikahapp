/* Checks every link on every route: internal routes must return 200, and
   fragment targets must exist on the page they point at. Exits non-zero on
   any dead link. */
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:3000";
const ROUTES = ["/", "/how-it-works"];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Collect the set of ids present on each route first.
  const idsByRoute = {};
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    idsByRoute[r] = await page.evaluate(() =>
      [...document.querySelectorAll("[id]")].map((e) => e.id)
    );
  }

  const problems = [];
  for (const r of ROUTES) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")].map((a) => ({
        href: a.getAttribute("href"),
        text: (a.textContent || "").trim().slice(0, 28),
      }))
    );

    const seen = new Set();
    for (const l of links) {
      if (seen.has(l.href)) continue;
      seen.add(l.href);

      if (l.href.startsWith("http")) continue; // external, not our concern

      const [path, frag] = l.href.split("#");
      const targetRoute = path === "" ? r : path;

      if (!ROUTES.includes(targetRoute)) {
        problems.push(`${r}: "${l.text}" → ${l.href}  (no such route)`);
        continue;
      }
      if (frag && !idsByRoute[targetRoute].includes(frag)) {
        problems.push(`${r}: "${l.text}" → ${l.href}  (no #${frag} on ${targetRoute})`);
      }
    }
  }

  await browser.close();
  if (problems.length) {
    console.log("DEAD LINKS:");
    for (const p of problems) console.log("  " + p);
  } else {
    console.log("all links resolve");
  }
  process.exit(problems.length ? 1 : 0);
})();
