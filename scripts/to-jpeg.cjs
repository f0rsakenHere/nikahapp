/* Re-encode an image to JPEG via a headless canvas — avoids adding a native
   image dependency just to convert one file.
   Usage: node scripts/to-jpeg.cjs <in> <out.jpg> [quality] [maxWidth] */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

(async () => {
  const [input, output, q = "0.86", maxW = "1200"] = process.argv.slice(2);
  const ext = path.extname(input).slice(1).toLowerCase();
  const mime = ext === "png" ? "image/png" : "image/jpeg";
  const b64 = fs.readFileSync(input).toString("base64");
  /* Capture this BEFORE writing — in-place conversion (input === output)
     otherwise stats the file after it has already been overwritten and
     reports "226KB (from 226KB)". */
  const beforeKB = Math.round(fs.statSync(input).size / 1024);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  const dataUrl = await page.evaluate(
    async ({ src, quality, maxWidth }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return { url: c.toDataURL("image/jpeg", quality), w: c.width, h: c.height };
    },
    { src: `data:${mime};base64,${b64}`, quality: Number(q), maxWidth: Number(maxW) }
  );

  const buf = Buffer.from(dataUrl.url.split(",")[1], "base64");
  fs.writeFileSync(output, buf);
  await browser.close();
  console.log(
    `${output}  ${dataUrl.w}x${dataUrl.h}  ${Math.round(buf.length / 1024)}KB (from ${beforeKB}KB)`
  );
})();
