/* Cuts the supplied logo into the crops the product actually uses.
 *
 * One file arrives from the client: a white lockup on transparency, with
 * a lot of empty margin around it and a tagline set small underneath.
 * Neither is usable as-is. The margin means a header asked for a 28px
 * logo gets 28px of mostly-nothing, and the tagline is so much smaller
 * than the script that at header sizes it renders about three pixels
 * tall and turns to mush.
 *
 * So: two crops, both cut at the artwork's own alpha boundaries rather
 * than by eye.
 *
 *   lockup    everything — the script and the tagline
 *   wordmark  the script alone, for anywhere under about 40px
 *
 * The split is the widest run of fully transparent rows inside the
 * artwork, which is the gap between the two lines of type. It is
 * reported rather than assumed: if a future logo has no such gap the
 * script says so and writes nothing, instead of guessing a boundary and
 * quietly shaving the descenders off somebody's brand.
 *
 * Playwright rather than sharp, because Playwright is already a
 * dependency and an image library for one job is a dependency forever.
 *
 *   node scripts/brand-crop.cjs "C:/path/to/logo-white.png"
 *   node scripts/brand-crop.cjs <source> --out public/brand
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SOURCE = process.argv[2];
const outFlag = process.argv.indexOf("--out");
const OUT = outFlag > -1 ? process.argv[outFlag + 1] : "public/brand";

/* Anything this faint is antialiasing fringe, not ink. Cropping to a
   threshold of zero keeps a halo of near-invisible pixels and makes the
   artwork read as badly centred. */
const ALPHA = 8;

if (!SOURCE) {
  console.error("\nFAIL  give the source PNG:\n");
  console.error('  node scripts/brand-crop.cjs "C:/Users/you/Desktop/logo-white.png"\n');
  process.exit(1);
}
if (!fs.existsSync(SOURCE)) {
  console.error(`\nFAIL  no such file: ${SOURCE}\n`);
  process.exit(1);
}

(async () => {
  const dataUrl = `data:image/png;base64,${fs.readFileSync(SOURCE).toString("base64")}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const result = await page.evaluate(
    async ({ dataUrl, ALPHA }) => {
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);

      /* Which rows and columns carry ink at all. */
      const rowInk = new Array(c.height).fill(false);
      const colInk = new Array(c.width).fill(false);
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3] > ALPHA) {
            rowInk[y] = true;
            colInk[x] = true;
          }
        }
      }

      const top = rowInk.indexOf(true);
      const bottom = rowInk.lastIndexOf(true);
      const left = colInk.indexOf(true);
      const right = colInk.lastIndexOf(true);
      if (top < 0) return { empty: true };

      /* The widest run of blank rows between the two lines of type. */
      let best = null;
      let runStart = null;
      for (let y = top; y <= bottom; y++) {
        if (!rowInk[y]) {
          if (runStart === null) runStart = y;
        } else if (runStart !== null) {
          const run = { start: runStart, end: y - 1, size: y - runStart };
          if (!best || run.size > best.size) best = run;
          runStart = null;
        }
      }

      const crop = (y0, y1) => {
        const w = right - left + 1;
        const h = y1 - y0 + 1;
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        out.getContext("2d").drawImage(c, left, y0, w, h, 0, 0, w, h);
        return { width: w, height: h, dataUrl: out.toDataURL("image/png") };
      };

      return {
        source: { width: c.width, height: c.height },
        box: { top, bottom, left, right },
        gap: best,
        lockup: crop(top, bottom),
        wordmark: best ? crop(top, best.start - 1) : null,
      };
    },
    { dataUrl, ALPHA }
  );

  await browser.close();

  if (result.empty) {
    console.error("\nFAIL  every pixel is transparent. Wrong file?\n");
    process.exit(1);
  }

  const { source, box, gap } = result;
  console.log(`\nsource      ${source.width}×${source.height}`);
  console.log(
    `artwork     ${box.right - box.left + 1}×${box.bottom - box.top + 1}  ` +
      `at ${box.left},${box.top}  (${box.left}px of margin on the left, ${box.top}px on top)`
  );

  if (!gap) {
    console.error("\nFAIL  no blank row anywhere inside the artwork, so there is no");
    console.error("      line to split on. Look at the file before trusting this script:");
    console.error("      a lockup whose tagline touches the script needs cutting by hand.\n");
    process.exit(1);
  }
  console.log(`split       ${gap.size} blank row(s) at y=${gap.start}`);

  fs.mkdirSync(OUT, { recursive: true });
  const written = [];
  for (const [name, art] of [
    ["nikahcanada-lockup-white", result.lockup],
    ["nikahcanada-wordmark-white", result.wordmark],
  ]) {
    const file = path.join(OUT, `${name}.png`);
    fs.writeFileSync(file, Buffer.from(art.dataUrl.split(",")[1], "base64"));
    written.push([file, art.width, art.height]);
    console.log(`wrote       ${file}  ${art.width}×${art.height}`);
  }

  console.log("\nPut these in ART in src/components/brand/Logo.tsx:\n");
  for (const [file, w, h] of written) {
    console.log(`  { src: "/${path.relative("public", file).replace(/\\/g, "/")}", width: ${w}, height: ${h} },`);
  }
  console.log("");
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
