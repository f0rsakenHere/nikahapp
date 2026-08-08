/* Text contrast audit against WCAG 2.2 AA.

   Walks every element that holds its own text, composites the real
   background by climbing ancestors until it hits something opaque,
   composites any alpha on the text colour too, and computes the ratio.

   Thresholds: 4.5:1 normal text, 3:1 large text (>=24px, or >=18.66px
   when bold). Non-text UI would be 3:1 but is not checked here — this
   is text only, and it says so rather than implying wider coverage.

   Text sitting on a background-image cannot be computed from the DOM, so
   it is reported separately as INDETERMINATE rather than being silently
   passed. That distinction matters on this site: the banner is a
   watercolour PNG and a lot of type sits on it.

   Usage:  node scripts/contrast.cjs
           MIN_OCCURRENCES=3 node scripts/contrast.cjs   # only repeated offenders
*/
const { chromium } = require("playwright");
const { assertStyled } = require("./lib/styled.cjs");

const BASE = process.env.BASE || "http://127.0.0.1:3000";
const ROUTES = (process.env.ROUTES || "/,/how-it-works").split(",");
const WIDTHS = (process.env.WIDTHS || "1440,390").split(",").map(Number);

const PAGE_FN = () => {
  // ---- colour helpers -------------------------------------------------
  const parse = (css) => {
    const m = String(css).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const hex = (c) =>
    "#" + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  // ---- effective background ------------------------------------------
  function background(el) {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== "none") {
        return { indeterminate: true, why: cs.backgroundImage.slice(0, 60) };
      }
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        layers.push(bg);
        if (bg.a >= 1) return { layers };
      }
      node = node.parentElement;
    }
    layers.push({ r: 255, g: 255, b: 255, a: 1 }); // canvas
    return { layers };
  }

  function composite(layers) {
    // layers are innermost-first; paint from the outermost inward
    let out = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) out = over(layers[i], out);
    return out;
  }

  // ---- collect --------------------------------------------------------
  const results = [];
  const all = document.querySelectorAll("body *");

  for (const el of all) {
    // only elements holding their own text, so ancestors are not counted twice
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(" ");
    if (!own) continue;

    if (el.closest("[aria-hidden='true']")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    if (Number(cs.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;

    const fg = parse(cs.color);
    if (!fg) continue;

    const bgInfo = background(el);
    const sample = own.replace(/\s+/g, " ").slice(0, 46);
    const where = `${el.tagName.toLowerCase()}${
      el.className && typeof el.className === "string"
        ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
        : ""
    }`.slice(0, 70);

    if (bgInfo.indeterminate) {
      results.push({ kind: "indeterminate", sample, where, size, weight, need, why: bgInfo.why });
      continue;
    }

    const bg = composite(bgInfo.layers);
    const text = fg.a < 1 ? over(fg, bg) : fg;
    const r = ratio(text, bg);

    results.push({
      kind: r >= need ? "pass" : "fail",
      sample,
      where,
      size,
      weight,
      need,
      ratio: Math.round(r * 100) / 100,
      fg: hex(text),
      bg: hex(bg),
    });
  }
  return results;
};

(async () => {
  const b = await chromium.launch();
  const fails = new Map();
  const indet = new Map();
  let checked = 0;

  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const p = await b.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
      const res = await p.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
      if (!res || res.status() >= 400) {
        console.error(`FAIL: ${route} returned ${res && res.status()}`);
        process.exit(1);
      }
      await assertStyled(p, `${route} @ ${width}px`);
      await p.waitForTimeout(400);

      const rows = await p.evaluate(PAGE_FN);
      checked += rows.length;

      for (const r of rows) {
        const key = `${r.fg || "?"}|${r.bg || "?"}|${r.size}|${r.weight}|${r.where}`;
        const bucket = r.kind === "fail" ? fails : r.kind === "indeterminate" ? indet : null;
        if (!bucket) continue;
        const prev = bucket.get(key);
        if (prev) {
          prev.count++;
          prev.routes.add(`${route}@${width}`);
        } else {
          bucket.set(key, { ...r, count: 1, routes: new Set([`${route}@${width}`]) });
        }
      }
      await p.close();
    }
  }
  await b.close();

  if (checked === 0) {
    console.error("FAIL: no text elements were examined — the selector is wrong, not the page.");
    process.exit(1);
  }

  const min = Number(process.env.MIN_OCCURRENCES || 1);
  const failing = [...fails.values()].filter((f) => f.count >= min).sort((a, b) => a.ratio - b.ratio);

  console.log(`Examined ${checked} text elements across ${ROUTES.length * WIDTHS.length} page loads.\n`);

  if (failing.length) {
    console.log(`CONTRAST FAILURES (${failing.length} distinct):\n`);
    for (const f of failing) {
      console.log(
        `  ${String(f.ratio).padEnd(6)} need ${String(f.need).padEnd(4)} ` +
          `${f.fg} on ${f.bg}  ${Math.round(f.size)}px/${f.weight}  x${f.count}`
      );
      console.log(`         "${f.sample}"`);
      console.log(`         ${f.where}`);
      console.log(`         ${[...f.routes].join(", ")}\n`);
    }
  } else {
    console.log("No computable contrast failures.\n");
  }

  const ind = [...indet.values()];
  if (ind.length) {
    console.log(`INDETERMINATE — text on a background image, needs a human eye (${ind.length}):\n`);
    for (const i of ind.slice(0, 12)) {
      console.log(`  ${Math.round(i.size)}px/${i.weight} need ${i.need}  x${i.count}  "${i.sample}"`);
      console.log(`         ${i.where}\n`);
    }
    if (ind.length > 12) console.log(`  …and ${ind.length - 12} more\n`);
  }

  process.exit(failing.length ? 1 : 0);
})();
