/* measure.cjs catches content that overflows a phone frame. It cannot
   catch the other failure mode: a flex child inside an `overflow-hidden`
   column does not overflow, it SHRINKS — so an element vanishes to a few
   pixels while every bounding box stays politely inside the frame and the
   overflow check reports a clean pass.

   This compares each element's rendered height against its natural
   height (scrollHeight) and fails on anything squashed. */
const { chromium } = require("playwright");
const { assertStyled } = require("./lib/styled.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

const TOLERANCE = Number(process.env.TOLERANCE || 2); // px of rounding slack

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  await p.goto(BASE + "/how-it-works", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await assertStyled(p, "/how-it-works");
  await assertOurApp(p);

  const rows = await p.evaluate((tol) => {
    const frames = [...document.querySelectorAll("div[style*='780px']")];
    return frames.map((frame, i) => {
      const squashed = [];
      for (const el of frame.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        const scale = r.height / el.offsetHeight || 1;
        const natural = el.scrollHeight * scale;
        const lost = natural - r.height;
        if (lost > tol) {
          squashed.push({
            text: (el.textContent || el.tagName).trim().slice(0, 40),
            lost: Math.round(lost / scale),
          });
        }
      }
      // only report the innermost offenders, not every ancestor of one
      const deepest = squashed.filter(
        (s, _, all) => !all.some((o) => o !== s && o.text.includes(s.text) && o.text !== s.text)
      );
      return {
        label: frame.querySelector("h3")?.textContent?.trim().slice(0, 22) || `screen ${i + 1}`,
        squashed: deepest.slice(0, 3),
      };
    });
  }, TOLERANCE);

  if (!rows.length) {
    console.error("NO PHONE FRAMES FOUND — selector is wrong. This is not a pass.");
    await b.close();
    process.exit(1);
  }

  let bad = 0;
  for (const r of rows) {
    if (r.squashed.length) {
      bad++;
      console.log(`${r.label.padEnd(24)} SQUASHED`);
      for (const s of r.squashed) console.log(`    -${s.lost}px  "${s.text}"`);
    } else {
      console.log(`${r.label.padEnd(24)} ok`);
    }
  }

  console.log(bad ? `\n${bad} of ${rows.length} screens squash content` : `\nall ${rows.length} screens render at full height`);
  await b.close();
  process.exit(bad ? 1 : 0);
})();
