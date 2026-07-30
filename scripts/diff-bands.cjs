/* Pixel-diffs each rebuilt band against the same band of the original
   template and reports where they disagree, so fidelity is a number rather
   than an impression.

   Photographs will never match the grey placeholders, so the report is
   column/row profiles of the difference: bands of disagreement that run the
   full height of a section point at layout, not at imagery. */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const OUT = process.env.OUT;
const LABELS = process.env.LABELS.split(",");

(async () => {
  const b = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  const p = await b.newPage();
  await p.goto("file:///" + OUT.replace(/\\/g, "/") + "/");

  const rows = [];
  for (const label of LABELS) {
    const a = path.join(OUT, `mine-${label}.png`);
    const c = path.join(OUT, `tpl-${label}.png`);
    if (!fs.existsSync(a) || !fs.existsSync(c)) {
      rows.push(`${label}: MISSING capture`);
      continue;
    }
    const r = await p.evaluate(
      async ([srcA, srcB]) => {
        const load = (s) =>
          new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => res(i);
            i.onerror = () => rej(new Error("load " + s));
            i.src = s;
          });
        const [ia, ib] = await Promise.all([load(srcA), load(srcB)]);
        const W = Math.min(ia.width, ib.width);
        const H = Math.min(ia.height, ib.height);
        const grab = (img) => {
          const cv = document.createElement("canvas");
          cv.width = W;
          cv.height = H;
          cv.getContext("2d").drawImage(img, 0, 0);
          return cv.getContext("2d").getImageData(0, 0, W, H).data;
        };
        const da = grab(ia);
        const db = grab(ib);
        const colBad = new Array(W).fill(0);
        const rowBad = new Array(H).fill(0);
        let total = 0;
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            const i = (y * W + x) * 4;
            const d =
              Math.abs(da[i] - db[i]) +
              Math.abs(da[i + 1] - db[i + 1]) +
              Math.abs(da[i + 2] - db[i + 2]);
            if (d > 90) {
              colBad[x]++;
              rowBad[y]++;
              total++;
            }
          }
        }
        const samples = (W / 2) * (H / 2);
        // column bands where >70% of sampled rows differ = structural
        const tall = [];
        const thresh = (H / 2) * 0.7;
        let run = null;
        for (let x = 0; x < W; x++) {
          if (colBad[x] > thresh) {
            if (!run) run = [x, x];
            else run[1] = x;
          } else if (run) {
            if (run[1] - run[0] > 6) tall.push(run);
            run = null;
          }
        }
        if (run && run[1] - run[0] > 6) tall.push(run);
        return {
          W, H,
          pct: ((total / samples) * 100).toFixed(1),
          tall: tall.slice(0, 8),
          sizeMismatch: ia.height !== ib.height ? `${ia.height} vs ${ib.height}` : null,
        };
      },
      ["file:///" + a.replace(/\\/g, "/"), "file:///" + c.replace(/\\/g, "/")]
    );
    rows.push(
      `${label.padEnd(9)} diff ${String(r.pct).padStart(5)}%  ` +
        (r.sizeMismatch ? `height ${r.sizeMismatch}  ` : "") +
        (r.tall.length
          ? `full-height mismatch at x: ${r.tall.map((t) => `${t[0]}-${t[1]}`).join(", ")}`
          : "no structural bands")
    );
  }

  if (!rows.length) {
    console.error("FAIL: diffed nothing");
    process.exit(1);
  }
  console.log(rows.join("\n"));
  await b.close();
})();
