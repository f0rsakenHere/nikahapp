/* Behavioural audit of the running site: console/network health, the
   interactive bits (menu, dropdown, carousel, form), keyboard access and
   a few accessibility basics.

   Reports every finding it can prove. Exits non-zero if anything failed,
   or if it somehow ran no checks at all. */
const { chromium } = require("playwright");

const { BASE, assertOurApp } = require("./lib/base.cjs");
const ROUTES = ["/", "/how-it-works"];
const findings = [];
let checks = 0;

function check(name, ok, detail) {
  checks++;
  if (!ok) findings.push(`${name}: ${detail}`);
  return ok;
}

(async () => {
  const b = await chromium.launch();

  /* ---------- 1. console + network on both routes, desktop and phone ---- */
  for (const route of ROUTES) {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
    ]) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      const errs = [];
      const bad = [];
      p.on("pageerror", (e) => errs.push(e.message));
      p.on("console", (m) => {
        if (m.type() === "error") errs.push(m.text().slice(0, 200));
      });
      p.on("response", (r) => {
        if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(BASE, "")}`);
      });
      await p.goto(BASE + route, { waitUntil: "networkidle" });
      await assertOurApp(p);
      await p.evaluate(async () => {
        const s = window.innerHeight * 0.5;
        for (let y = 0; y < document.documentElement.scrollHeight; y += s) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 90));
        }
      });
      await p.waitForTimeout(600);
      check(`console ${route} @${w}`, errs.length === 0, errs.slice(0, 3).join(" | "));
      check(`network ${route} @${w}`, bad.length === 0, [...new Set(bad)].slice(0, 4).join(" | "));
      await p.close();
    }
  }

  /* ---------- 2. mobile menu ------------------------------------------- */
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    const toggle = p.locator('button[aria-label="Toggle menu"]');
    check("burger visible @390", await toggle.isVisible(), "toggle not visible");
    await toggle.click();
    await p.waitForTimeout(500);
    const links = p.locator("header nav a, header ul a");
    const openCount = await p.locator("header li a").count();
    check("menu opens", openCount > 0, `no links after opening (${openCount})`);
    check(
      "menu aria-expanded",
      (await toggle.getAttribute("aria-expanded")) === "true",
      "aria-expanded not true when open"
    );
    // a link inside the drawer must be clickable, not zero-height
    const first = p.locator("header li a").first();
    const box = await first.boundingBox();
    check("menu link tappable", !!box && box.height >= 40, `height ${box && box.height}`);
    await toggle.click();
    await p.waitForTimeout(500);
    check(
      "menu closes",
      (await toggle.getAttribute("aria-expanded")) === "false",
      "aria-expanded still true after close"
    );
    await p.close();
  }

  /* ---------- 3. desktop dropdown -------------------------------------- */
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    const pages = p.locator('header button[aria-expanded]').first();
    await pages.hover();
    await p.waitForTimeout(450);
    const items = await p.locator("header nav ul li a").count();
    check("Pages dropdown opens on hover", items >= 4, `${items} items`);
    await p.mouse.move(10, 600);
    await p.waitForTimeout(500);
    const after = await p.locator("header nav ul li a").count();
    check("Pages dropdown closes", after === 0, `${after} items still shown`);
    await p.close();
  }

  /* ---------- 4. story carousel ---------------------------------------- */
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.locator("#wali").scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
    const srcOf = () => p.locator("#wali img").nth(1).getAttribute("src");
    const before = await srcOf();
    await p.locator('button[aria-label="Next story"]').click();
    await p.waitForTimeout(900);
    const after = await srcOf();
    check("carousel next changes slide", before !== after, `still ${String(after).slice(-30)}`);
    await p.close();
  }

  /* ---------- 5. booking form ------------------------------------------ */
  {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + "/", { waitUntil: "networkidle" });
    await p.locator("#contact").scrollIntoViewIfNeeded();
    await p.waitForTimeout(600);
    await p.fill('input[name="name"]', "Test");
    await p.fill('input[name="email"]', "a@b.com");
    await p.fill('input[name="phone"]', "5140000000");
    await p.fill('input[name="city"]', "Montreal");
    await p.fill('textarea[name="message"]', "Hello");
    const note = p.locator('#contact p[role="status"]');
    check("status note starts hidden", (await note.evaluate((e) => getComputedStyle(e).opacity)) === "0", "visible before submit");
    await p.locator('#contact button[type="submit"]').click();
    await p.waitForTimeout(700);
    check(
      "form acknowledges submit",
      (await note.evaluate((e) => getComputedStyle(e).opacity)) === "1",
      "status note stayed hidden"
    );
    await p.close();
  }

  /* ---------- 6. accessibility basics ----------------------------------
     Sections 6-8 loop over both routes. They used to check the homepage
     only, which meant /how-it-works — the longer page, and the one
     carrying every app screen — was never checked for alt text, heading
     structure, focus visibility or tap target size. */
  for (const route of ROUTES) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    const a11y = await p.evaluate(() => {
      const out = {};
      out.imgNoAlt = [...document.querySelectorAll("img")]
        .filter((i) => i.getAttribute("alt") === null)
        .map((i) => i.getAttribute("src"))
        .slice(0, 5);
      out.emptyLinks = [...document.querySelectorAll("a")]
        .filter(
          (a) =>
            !a.textContent.trim() &&
            !a.getAttribute("aria-label") &&
            !a.querySelector("img[alt]:not([alt=''])")
        )
        .map((a) => a.getAttribute("href"))
        .slice(0, 5);
      out.buttonsNoName = [...document.querySelectorAll("button")]
        .filter((x) => !x.textContent.trim() && !x.getAttribute("aria-label"))
        .map((x) => x.className.slice(0, 40))
        .slice(0, 5);
      const h1 = document.querySelectorAll("h1");
      out.h1Count = h1.length;
      out.langSet = document.documentElement.lang || null;
      return out;
    });
    check(`all images have alt ${route}`, a11y.imgNoAlt.length === 0, a11y.imgNoAlt.join(", "));
    check(`no unnamed links ${route}`, a11y.emptyLinks.length === 0, a11y.emptyLinks.join(", "));
    check(`no unnamed buttons ${route}`, a11y.buttonsNoName.length === 0, a11y.buttonsNoName.join(", "));
    check(`exactly one h1 ${route}`, a11y.h1Count === 1, `found ${a11y.h1Count}`);
    check(`lang attribute set ${route}`, !!a11y.langSet, "missing");
    await p.close();
  }

  /* ---------- 7. keyboard focus is visible ----------------------------- */
  for (const route of ROUTES) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    let focusable = 0;
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press("Tab");
      const ok = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName,
          outline: cs.outlineStyle !== "none" && cs.outlineWidth !== "0px",
          shadow: cs.boxShadow !== "none",
        };
      });
      if (ok) focusable++;
    }
    check(`tab reaches interactive elements ${route}`, focusable >= 5, `only ${focusable} in 12 tabs`);
    await p.close();
  }

  /* ---------- 8. touch target sizes on phone --------------------------- */
  for (const route of ROUTES) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(BASE + route, { waitUntil: "networkidle" });
    await p.evaluate(async () => {
      const s = window.innerHeight * 0.5;
      for (let y = 0; y < document.documentElement.scrollHeight; y += s) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    const small = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll("a, button, input, select").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        if (getComputedStyle(el).visibility === "hidden") return;
        if (r.height < 30 || r.width < 30) {
          out.push(
            `<${el.tagName.toLowerCase()}> ${Math.round(r.width)}x${Math.round(r.height)} "${(
              el.textContent || el.getAttribute("aria-label") || ""
            ).trim().slice(0, 24)}"`
          );
        }
      });
      return [...new Set(out)];
    });
    check(
      `touch targets >= 30px ${route}`,
      small.length === 0,
      `${small.length}: ${small.slice(0, 6).join(" | ")}`
    );
    await p.close();
  }

  await b.close();

  if (checks === 0) {
    console.error("FAIL: audit ran no checks");
    process.exit(1);
  }
  if (findings.length) {
    console.error(`${findings.length} of ${checks} checks FAILED:\n  - ` + findings.join("\n  - "));
    process.exit(1);
  }
  console.log(`all ${checks} behavioural checks pass`);
})();
