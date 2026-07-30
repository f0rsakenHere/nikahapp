/* Fills the 24 grey placeholder slots in the Bridely homepage with real
   bridal/floral photography from Unsplash.

   Unsplash photo pages are behind a bot check, but
   /photos/<slug>/download?force=true still 302s to the CDN — that redirect
   is where the stable `photo-<id>` comes from. Once we have it we build our
   own imgix URL so each file arrives pre-cropped to the exact slot size
   (at 2x for retina) instead of shipping a 4000px original.

   Every slot is deliberately people-free: the site is a Muslim matrimony
   service, so the imagery is flowers, tablescapes and venues only. */
const fs = require("fs");
const path = require("path");
const https = require("https");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const OUT_DIR = path.join(__dirname, "..", "public", "images", "bridely");

/* slot file name, Unsplash slug, CSS pixel size of the slot, subject */
const SLOTS = [
  // The hero sits on a pale watercolour wash, so it needs a light,
  // high-key frame — a dark still life reads as a hole in the page.
  ["hero.jpg",          "JX1v91WS8gs", 475,  540,  "white flowers in a vase"],
  ["about-1.jpg",       "Ko6XKSsO4w8", 445,  354,  "white and beige flowers"],
  ["about-2.jpg",       "FAgn1RJY5jw", 285,  250,  "pink roses and baby's breath"],
  ["about-3.jpg",       "sZPNohUn9RA", 255,  95,   "white flowers, macro"],
  ["video.jpg",         "zZ4hsQfse7o", 1110, 500,  "floral archway with ceremony chairs"],
  ["category-1.jpg",    "ZhoSk8W4lt8", 255,  220,  "white petalled centerpiece"],
  ["category-2.jpg",    "__vggaw2Nzk", 255,  220,  "outdoor wedding arch"],
  ["category-3.jpg",    "Ikcn0alusdg", 255,  220,  "red and white flowers on a wooden table"],
  ["category-4.jpg",    "NFj6pEUdmpY", 255,  220,  "centerpiece in a glass vase"],
  ["reservation-1.jpg", "CDypHfdef6M", 635,  540,  "flowers hanging from a ceiling"],
  ["reservation-2.jpg", "h6p5784SMCI", 445,  300,  "vases of assorted flowers"],
  ["reservation-3.jpg", "fJzmPe-a0eU", 445,  210,  "aisle flower arrangement"],
  ["organizer-1.jpg",   "4icV47LjYc4", 255,  220,  "white and pink flowers on a wooden box"],
  ["organizer-2.jpg",   "PTLBXS2zM0o", 255,  220,  "white and purple flowers in a black vase"],
  ["organizer-3.jpg",   "sqLVUTFtxVs", 255,  220,  "white roses"],
  ["organizer-4.jpg",   "Ee8ecXLT1mo", 255,  220,  "white flowers in a vase"],
  ["story.jpg",         "4s49hoeAlRA", 665,  523,  "outdoor ceremony setup with florals"],
  ["form.jpg",          "3wazBys8ECo", 540,  631,  "a vase of white flowers"],
  ["insta-1.jpg",       "iajkliejEiU", 255,  255,  "white rose"],
  ["insta-2.jpg",       "o10y0dPTBOY", 255,  255,  "white flowers, macro"],
  ["insta-3.jpg",       "7oS5HyWYtlw", 255,  255,  "pink flowers in a clear glass vase"],
  ["insta-4.jpg",       "0IsBu45B3T8", 255,  255,  "red flower arrangement on a white table"],
  ["event-bg.jpg",      "iZit-SCQAdA", 1732, 680,  "reception room laid for a wedding"],
  // The template treats this slot as a near-white wash behind the feed, so
  // it needs a high-key frame — a dark or busy photo swallows the tiles.
  ["insta-bg.jpg",      "5KZ57nxFHU0", 1920, 1081, "white cherry blossom"],
];

function req(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("too many redirects"));
    https
      .get(url, { headers: { "User-Agent": UA, Accept: "*/*" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve({ redirect: res.headers.location, status: res.statusCode });
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url.slice(0, 80)}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ body: Buffer.concat(chunks) }));
      })
      .on("error", reject);
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const credits = [];
  const failures = [];

  for (const [file, slug, w, h, subject] of SLOTS) {
    const dest = path.join(OUT_DIR, file);
    try {
      // 1. resolve the slug to a stable photo id + the photographer's name
      const r = await req(`https://unsplash.com/photos/${slug}/download?force=true`);
      if (!r.redirect) throw new Error("no redirect from download endpoint");
      const photoId = r.redirect.match(/photo-[\w-]+/)?.[0];
      // the dl= filename carries the photographer slug: name-SLUG-unsplash.jpg
      const author = decodeURIComponent(r.redirect.match(/dl=([^&]+)/)?.[1] || "")
        .replace(new RegExp(`-${slug}-unsplash\\.jpg$`), "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      if (!photoId) throw new Error(`could not parse photo id from ${r.redirect}`);

      // 2. ask the CDN for exactly the slot size, at 2x
      const cdn =
        `https://images.unsplash.com/${photoId}` +
        `?w=${w * 2}&h=${h * 2}&fit=crop&crop=entropy&q=78&fm=jpg&auto=format`;
      const img = await req(cdn);
      if (!img.body || img.body.length < 5000) {
        throw new Error(`suspiciously small download (${img.body?.length} bytes)`);
      }
      fs.writeFileSync(dest, img.body);
      credits.push(
        `| ${file} | ${w}x${h} | ${subject} | ${author || "unknown"} | https://unsplash.com/photos/${slug} |`
      );
      console.log(
        `ok   ${file.padEnd(18)} ${String(w).padStart(4)}x${String(h).padEnd(4)} ` +
          `${(img.body.length / 1024).toFixed(0)}KB  ${author}`
      );
    } catch (e) {
      failures.push(`${file} (${slug}): ${e.message}`);
      console.log(`FAIL ${file.padEnd(18)} ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 350)); // be polite
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "CREDITS.md"),
    "# Bridely homepage photography\n\n" +
      "All from Unsplash, free for commercial use. No people in any frame —\n" +
      "the site is a Muslim matrimony service.\n\n" +
      "| file | slot size | subject | photographer | source |\n" +
      "| --- | --- | --- | --- | --- |\n" +
      credits.join("\n") +
      "\n"
  );

  console.log(`\n${credits.length}/${SLOTS.length} downloaded`);
  if (failures.length) {
    console.error(`\n${failures.length} FAILED:\n  ` + failures.join("\n  "));
    process.exit(1);
  }
  if (credits.length !== SLOTS.length) {
    console.error("FAIL: credit count does not match slot count");
    process.exit(1);
  }
})();
