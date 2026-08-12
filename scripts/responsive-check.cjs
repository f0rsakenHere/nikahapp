/* Does every screen work on a phone?
 *
 * "It looked fine when I resized the window" is not an answer, and the
 * one thing this codebase has been caught by twice is a page that is
 * only *nearly* within the viewport — 79 pixels of tab bar in a 78 pixel
 * slot, a grid track sized to max-content. Both were invisible until
 * something one line longer arrived.
 *
 * So this measures, on every route, at every width worth caring about:
 *
 *   sideways    the document is wider than the window (the killer: it
 *               makes every horizontal gesture fight the page)
 *   escapes     an element whose box ends past the right edge
 *   tiny type   visible text under the 18px floor this product holds to
 *   small taps  a control under 40px in either direction
 *   clipped     text cut off by its own box without an ellipsis or a
 *               line clamp, i.e. lost rather than shortened
 *   spills      a control taller than its own box: a fixed-height pill
 *               whose label wraps prints its second line straight across
 *               its border. Overflow is visible, so nothing clips it and
 *               no width check ever sees it — "Delete my account and
 *               everything in it" was doing exactly this on every phone
 *
 * Signed in as a member, as a wali and signed out, because those are
 * three different chromes. Nothing is written; it only looks.
 *
 *   BASE=http://127.0.0.1:3001 node scripts/responsive-check.cjs
 *   BASE=... node scripts/responsive-check.cjs --width 390 --verbose
 */
const { chromium } = require("playwright");
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

loadEnv();
const client = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const PASSWORD = "one good passphrase";
const MEMBER = "yusuf.rahman@seed.test";

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
};
const VERBOSE = process.argv.includes("--verbose");
const ONLY = argOf("--width");

/* 320 is the narrowest phone still in use (an SE in a zoomed browser),
   360 is the commonest Android, 390 an iPhone, 430 a large one, 768 an
   iPad portrait — the width where most "desktop" layouts have not
   started yet and most phone layouts have stopped. */
const WIDTHS = [320, 360, 390, 430, 768];

/* The type floor this product holds to. Anything below it is a finding,
   not a preference. */
const MIN_TEXT = 18;
/* Below this a control is hard to hit with a thumb. Apple says 44, and
   40 is the point at which this codebase's own pill buttons sit. */
const MIN_TAP = 40;

let findings = 0;
const seen = new Map();

function report(where, kind, detail) {
  findings++;
  const key = `${kind}|${detail}`;
  seen.set(key, [...(seen.get(key) ?? []), where]);
  if (VERBOSE) console.log(`  ${kind.padEnd(11)} ${where}  ${detail}`);
}

/* Everything the page can tell us about its own geometry, measured in
   the page rather than over the wire — one round trip instead of one per
   element. */
async function measure(page) {
  return page.evaluate(
    ({ MIN_TEXT, MIN_TAP }) => {
      const vw = document.documentElement.clientWidth;
      const out = { vw, sideways: document.documentElement.scrollWidth - vw, escapes: [], tiny: [], taps: [], clipped: [], spills: [] };

      const label = (el) =>
        `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}` +
        `${(el.textContent || "").trim() ? ` "${(el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34)}"` : ""}`;

      const visible = (el, r) => {
        if (!r.width || !r.height) return false;
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) < 0.05) return false;
        /* Screen-reader-only text: a 1px box under a clip-path. It is
           not on screen, so its font size and its overflow are not
           anybody's problem — and there is a `sr-only` label on every
           fact in this app, which would otherwise be the loudest and
           most useless finding in the report. */
        if (r.width <= 2 || r.height <= 2) return false;
        if (s.clipPath && s.clipPath !== "none") return false;
        return true;
      };

      for (const el of document.querySelectorAll("body *")) {
        if (el.closest("script, style, noscript, svg")) continue;
        const r = el.getBoundingClientRect();
        if (!visible(el, r)) continue;

        /* Escapes the viewport. Fixed elements deliberately hung off
           screen (a closed drawer) would report here, so anything the
           page has hidden with a transform is skipped. */
        const s = getComputedStyle(el);
        if (r.right > vw + 1 && s.transform === "none" && s.position !== "fixed") {
          out.escapes.push({ label: label(el), right: Math.round(r.right) });
        }

        const leaf = el.children.length === 0 && (el.textContent || "").trim();
        if (leaf) {
          const size = parseFloat(s.fontSize);
          if (size < MIN_TEXT) out.tiny.push({ label: label(el), size });

          /* Cut off rather than shortened: the box is smaller than its
             own content and nothing says so. `text-overflow` and a line
             clamp are deliberate; plain overflow is a bug. */
          const clamped = s.webkitLineClamp && s.webkitLineClamp !== "none";
          if (
            el.scrollWidth > el.clientWidth + 1 &&
            s.textOverflow !== "ellipsis" &&
            !clamped &&
            s.overflowX === "hidden"
          ) {
            out.clipped.push({ label: label(el), by: el.scrollWidth - el.clientWidth });
          }
        }

        /* Content taller than the box it was given. Only for controls
           with a ground of their own — a border or a fill — because
           those are the ones with a fixed height and a visible edge for
           the overflow to cross. Anything that scrolls, clamps, or
           holds an absolutely-positioned child is measuring something
           other than its own text. */
        if (
          el.matches("button, a[href], [role='button']") &&
          el.scrollHeight > el.clientHeight + 1 &&
          s.overflowY === "visible" &&
          (!s.webkitLineClamp || s.webkitLineClamp === "none") &&
          (s.borderTopWidth !== "0px" || s.backgroundColor !== "rgba(0, 0, 0, 0)")
        ) {
          const absolute = [...el.querySelectorAll("*")].some(
            (c) => getComputedStyle(c).position === "absolute"
          );
          if (!absolute) {
            out.spills.push({ label: label(el), by: el.scrollHeight - el.clientHeight });
          }
        }

        if (el.matches("button, a[href], input, select, textarea, [role='button']")) {
          /* Three things that look like small controls and are not:
             a link set as running text (it is text, and is hit the way
             text is hit); a checkbox or radio inside its own label,
             where the label is the target and is usually large; and a
             link with no ground of its own — no background, no border —
             which is a text link however it is displayed. */
          const asText =
            el.matches("a[href]") &&
            s.backgroundColor === "rgba(0, 0, 0, 0)" &&
            s.borderTopWidth === "0px" &&
            !el.querySelector("svg, img");
          const wrapped =
            el.matches("input") &&
            el.closest("label") &&
            el.closest("label").getBoundingClientRect().height >= MIN_TAP;

          if (!asText && !wrapped && (r.height < MIN_TAP || r.width < MIN_TAP)) {
            out.taps.push({ label: label(el), w: Math.round(r.width), h: Math.round(r.height) });
          }
        }
      }
      return out;
    },
    { MIN_TEXT, MIN_TAP }
  );
}

async function signIn(context, email) {
  const p = await context.newPage();
  p.setDefaultTimeout(30_000);
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 90_000 });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', PASSWORD);
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.close();
}

(async () => {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "nikahcanada");

  const member = await db.collection("users").findOne({ email: MEMBER });
  if (!member) {
    console.error("\nFAIL  no seeded pool. Run: node scripts/seed-pool.cjs --apply\n");
    process.exitCode = 1;
    await client.close();
    return;
  }

  /* Real ids, so the detail routes are measured with content in them
     rather than as a not-found page. */
  const profile = await db
    .collection("profiles")
    .findOne({ gender: "sister", status: "live" }, { sort: { _id: 1 } });
  const conversation = await db
    .collection("conversations")
    .findOne({ "participants.userId": String(member._id) });
  /* `waliUserId` is a string on the guardianship, not an ObjectId, so
     this looked it up by the wrong type, found nobody, and quietly
     measured no wali screens at all — a role reported as covered on the
     strength of a query that never matched. Wrong on both counts now:
     the id is cast, and a missing wali is a failure rather than a
     silently shorter run. */
  const guardianship = await db.collection("guardianships").findOne({ status: "confirmed" });
  const wali = guardianship
    ? await db.collection("users").findOne({ _id: new ObjectId(String(guardianship.waliUserId)) })
    : null;
  if (!wali) {
    console.error("\nFAIL  no confirmed wali to sign in as — the wali screens would go unmeasured.");
    console.error("      Run: node scripts/seed-activity.cjs --for <member email> --approve\n");
    process.exitCode = 1;
    await client.close();
    return;
  }

  const ROUTES = {
    "signed out": [
      "/",
      "/how-it-works",
      "/legal/privacy",
      "/legal/terms",
      "/login",
      "/register",
      "/forgot-password",
    ],
    member: [
      /* The marketing pages a member can now reach — the homepage no
         longer bounces them to the dashboard, so its nav has a second
         state and this is where that state gets measured. */
      "/",
      "/how-it-works",
      "/dashboard",
      "/browse",
      "/browse?new=1",
      "/browse?saved=1",
      profile ? `/browse/${profile._id}` : null,
      "/requests",
      "/conversations",
      conversation ? `/conversations/${conversation._id}` : null,
      "/notifications",
      "/onboarding",
      "/onboarding/basics",
      "/onboarding/deen",
      "/onboarding/lookingFor",
      "/onboarding/guardian",
      "/settings",
    ].filter(Boolean),
    wali: ["/wali"],
  };

  const browser = await chromium.launch();
  const widths = ONLY ? [Number(ONLY)] : WIDTHS;

  try {
    for (const [role, paths] of Object.entries(ROUTES)) {
      if (!paths.length) continue;
      const context = await browser.newContext({ viewport: { width: widths[0], height: 900 } });
      if (role === "member") await signIn(context, MEMBER);
      if (role === "wali") await signIn(context, wali.email);

      const page = await context.newPage();
      page.setDefaultTimeout(30_000);
      let asserted = false;

      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of paths) {
          await page.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {});
          if (!asserted) {
            await assertOurApp(page);
            asserted = true;
          }
          /* Signed-in routes bounce a signed-out visitor; measuring the
             sign-in page five times over is noise, not coverage. */
          const landed = new URL(page.url()).pathname;
          if (landed.startsWith("/login") && !path.startsWith("/login")) continue;

          const m = await measure(page);
          const where = `${width}px ${path}`;
          if (m.sideways > 1) report(where, "SIDEWAYS", `+${m.sideways}px`);
          for (const e of m.escapes.slice(0, 3)) report(where, "escapes", `${e.label} → ${e.right}px`);
          for (const t of m.tiny.slice(0, 3)) report(where, "tiny type", `${t.size}px ${t.label}`);
          for (const t of m.taps.slice(0, 3)) report(where, "small tap", `${t.w}×${t.h} ${t.label}`);
          for (const c of m.clipped.slice(0, 3)) report(where, "clipped", `-${c.by}px ${c.label}`);
          for (const s of m.spills.slice(0, 3)) report(where, "spills", `+${s.by}px ${s.label}`);
        }
        console.log(`  ${role} at ${width}px — ${paths.length} route(s)`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await client.close();
  }

  if (!findings) {
    console.log("\nno responsive findings: nothing scrolls sideways, escapes, or falls under the floor\n");
  } else {
    console.log(`\n${findings} finding(s), grouped:\n`);
    for (const [key, wheres] of [...seen.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const [kind, detail] = key.split("|");
      console.log(`  ${kind.padEnd(11)} ${detail}`);
      console.log(`              ${wheres.length} place(s): ${wheres.slice(0, 4).join(", ")}${wheres.length > 4 ? " …" : ""}`);
    }
    console.log("");
  }
  process.exitCode = findings ? 1 : 0;
})().catch((err) => {
  console.error(`\nFAIL  ${(err && err.message) || err}\n`);
  process.exitCode = 1;
});
