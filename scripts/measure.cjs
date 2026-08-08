/* Detects UI clipped by a phone frame on /how-it-works.
   Targets the 390x780 screen element directly — do not key off <figure>,
   which the page layout may or may not use. Exits non-zero if it finds
   nothing, so a broken selector can never read as a pass. */
const { chromium } = require("playwright");
const { assertStyled } = require("./lib/styled.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(BASE + "/how-it-works", { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await assertStyled(p, "/how-it-works");
  await assertOurApp(p);

  const rows = await p.evaluate(() => {
    const frames = [...document.querySelectorAll("div[style*='780px']")];
    return frames.map((frame, i) => {
      const fr = frame.getBoundingClientRect();
      const scale = fr.height / 780; // undo the transform
      let worstBottom = 0;
      let worstRight = 0;
      let culprit = "";
      for (const el of frame.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.height === 0 && r.width === 0) continue;
        const bottomOver = (r.bottom - fr.bottom) / scale;
        const rightOver = (r.right - fr.right) / scale;
        if (bottomOver > worstBottom) {
          worstBottom = bottomOver;
          culprit = (el.textContent || el.tagName).trim().slice(0, 32);
        }
        if (rightOver > worstRight) worstRight = rightOver;
      }
      const heading = frame.querySelector("h3")?.textContent?.trim().slice(0, 22);
      return {
        label: heading || `screen ${i + 1}`,
        bottom: Math.round(worstBottom),
        right: Math.round(worstRight),
        culprit,
      };
    });
  });

  if (!rows.length) {
    console.error("NO PHONE FRAMES FOUND — selector is wrong. This is not a pass.");
    await b.close();
    process.exit(1);
  }

  let bad = 0;
  for (const r of rows) {
    const issues = [];
    if (r.bottom > 1) issues.push(`bottom +${r.bottom}px ("${r.culprit}")`);
    if (r.right > 1) issues.push(`right +${r.right}px`);
    if (issues.length) bad++;
    console.log(`${r.label.padEnd(24)} ${issues.length ? "CLIPPED  " + issues.join("  ") : "ok"}`);
  }
  console.log(bad ? `\n${bad} of ${rows.length} clipped` : `\nall ${rows.length} screens fit`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
