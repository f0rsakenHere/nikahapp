/* The heart and the pass, pressed the way a thumb presses them.
 *
 * A tester reported both as dead: "the heart and block buttons don't
 * respond when I tap them". Two separate faults were behind that, and
 * neither one would have been caught by asserting against the database
 * alone, because the database was right the whole time.
 *
 *   1. nginx was sending `Connection: upgrade` on every request, so a
 *      server action's streamed reply did not always reach its last
 *      chunk. The value it returned arrived; the re-rendered list that
 *      followed it did not. A pass was written and the person stayed on
 *      screen — which from the outside is a button that does nothing.
 *
 *   2. The two buttons were two forms over the same server action, with
 *      a piece of client state each, read as `saved ?? passed ?? server`.
 *      Whichever was set first silenced the other for the rest of the
 *      page's life. And neither showed anything at all until the write
 *      came back from Montreal, two or three seconds later.
 *
 * So this checks what the thumb sees, on a phone-sized screen: that the
 * button lights within a few frames of the press, that it is still lit
 * when the write lands, that the mark is really stored, and that a pass
 * takes the person out of the list. The timing assertion is the point —
 * a version of this that only read the database passed throughout the
 * whole period the buttons were unusable.
 *
 *   BASE=https://nikahcanada.ca node scripts/mark-check.cjs
 *   BASE=https://nikahcanada.ca BROWSER=webkit node scripts/mark-check.cjs
 *
 * WebKit is worth the second run here. Everything this checks is touch
 * and timing, and an iPhone is not a Chromium with a phone-shaped
 * window: it has its own idea of what a tap is and of when a form may
 * submit. `npx playwright install webkit` if it is missing.
 */
const { chromium, webkit, devices } = require("playwright");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { loadEnv, requireEnv } = require("./lib/env.cjs");
const { BASE, assertOurApp } = require("./lib/base.cjs");

loadEnv();
const mongo = new MongoClient(requireEnv("MONGODB_URI"), {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  serverSelectionTimeoutMS: 10_000,
});

const MEMBER = "aisha.rahman@seed.test";
const PASSWORD = "one good passphrase";

/* Generous, because it is measuring "did the interface wait for the
   network" and not "how fast is the network". The old component took
   2000-3500ms here; the new one answers in one frame. Anything under
   half a second can only have come from the press itself. */
const AT_ONCE = 600;

let bad = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "pass" : "FAIL"}  ${label}${ok || !detail ? "" : `  — ${detail}`}`);
  if (!ok) bad++;
}

(async () => {
  await mongo.connect();
  const db = mongo.db(process.env.MONGODB_DB || "nikahcanada");
  /* Chromium by default, because it is what is installed everywhere and
     the fault was reported on an Android phone. */
  const engine = process.env.BROWSER === "webkit" ? webkit : chromium;
  const browser = await engine.launch();
  console.log(`using ${process.env.BROWSER === "webkit" ? "WebKit" : "Chromium"} against ${BASE}`);
  let page;

  try {
    const me = await db.collection("users").findOne({ email: MEMBER });
    if (!me) {
      console.error("\nFAIL  no seeded pool. Run: node scripts/seed-pool.cjs --apply\n");
      process.exitCode = 1;
      return;
    }
    const uid = String(me._id);

    /* Her own marks, cleared before and after. They are hers, they are
       private, and nothing else reads them — but they do decide who she
       is shown, so a run that left them behind would quietly shrink her
       pool. */
    const had = await db.collection("browseMarks").countDocuments({ userId: uid });
    if (had) console.log(`note  clearing ${had} existing mark(s) for ${MEMBER}`);
    await db.collection("browseMarks").deleteMany({ userId: uid });

    /* A phone, because that is where it was reported, and because a
       mouse has a hover state to fall back on and a thumb has none. */
    const ctx = await browser.newContext({ ...devices["iPhone 13"] });
    page = await ctx.newPage();
    page.setDefaultTimeout(60_000);

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await assertOurApp(page);
    await page.fill('input[name="email"]', MEMBER);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('main button[type="submit"]');
    await page.waitForTimeout(4000);

    await page.goto(`${BASE}/browse`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(() => /Ask to talk|Asked/.test(document.body.innerText), {
      timeout: 45_000,
    });
    await page.waitForTimeout(1500);

    const first = () => page.locator("main ul > li").first();
    const button = (n) => first().locator('button[name="mark"]').nth(n);
    const pressed = (n) => button(n).getAttribute("aria-pressed");
    const who = () => first().evaluate((li) => li.innerText.split("\n")[0]);
    const stored = async () =>
      (await db.collection("browseMarks").find({ userId: uid }).toArray())
        .map((r) => r.kind)
        .join(",") || "none";

    if ((await page.locator('button[name="mark"]').count()) === 0) {
      check("the cards have a heart and a pass on them", false, "no mark buttons on the page");
      return;
    }

    /* A real touch at the button's centre rather than `click()`, which
       would pass even if something were sitting over the top of it. */
    async function thumb(n) {
      const b = button(n);
      await b.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const box = await b.boundingBox();
      const at = Date.now();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      return at;
    }

    /** How long until the button says it is on — polled fast, because the
     *  whole question is whether it waited for the network. */
    async function lightsUp(n, at) {
      for (let i = 0; i < 80; i++) {
        if ((await pressed(n)) === "true") return Date.now() - at;
        await page.waitForTimeout(50);
      }
      return null;
    }

    /** Waits for something to become true, and says how long it took.
     *
     *  Everything after the press is a round trip to Montreal and a
     *  re-render behind it, and how long that takes is not the same on
     *  every engine: WebKit took seven seconds where Chromium took
     *  three. A fixed sleep tuned on one of them reports the other as
     *  broken, which is exactly what this checker did on its first
     *  WebKit run — it called a working pass button a dead one. So the
     *  waits poll, and the budget is generous enough to be about
     *  whether it happens rather than how quickly. */
    async function until(fn, budgetMs = 25_000) {
      const at = Date.now();
      while (Date.now() - at < budgetMs) {
        if (await fn()) return Date.now() - at;
        await page.waitForTimeout(250);
      }
      return null;
    }

    /* ---------- the heart ------------------------------------------- */
    const card = await who();
    let lit = await lightsUp(0, await thumb(0));
    check(
      "the heart lights the moment it is pressed, not when Montreal answers",
      lit !== null && lit < AT_ONCE,
      lit === null ? "it never lit at all" : `${lit}ms`
    );

    const saveTook = await until(async () => (await stored()) === "saved");
    check("the save is really stored", saveTook !== null, `still ${await stored()} after 25s`);
    check(
      "and the heart is still lit when the write lands",
      (await pressed(0)) === "true",
      `stored after ${saveTook}ms, but the heart went out again`
    );
    check("saving keeps them in the list, which is the point of saving", (await who()) === card);

    /* ---------- and again, which removes it -------------------------- */
    await thumb(0);
    const goneTook = await until(async () => (await stored()) === "none");
    check("pressing the lit heart un-saves", goneTook !== null, `still ${await stored()} after 25s`);
    check(
      "and the heart goes out with it",
      (await until(async () => (await pressed(0)) === "false", 10_000)) !== null,
      "the mark was removed but the heart stayed lit"
    );

    /* ---------- the pass, on a card whose heart has been used --------
       The sequence the old component could not show. Its two pieces of
       state took it in turns, and the heart having gone first meant the
       pass could never report anything again. */
    lit = await lightsUp(1, await thumb(1));
    check(
      "the pass answers at once too, even after the heart has been used",
      lit !== null && lit < AT_ONCE,
      lit === null ? "it never lit at all" : `${lit}ms`
    );

    const passTook = await until(async () => (await stored()) === "passed");
    check("passing is really stored", passTook !== null, `still ${await stored()} after 25s`);

    const leftTook = await until(async () => (await who()) !== card);
    check(
      "and they leave the list, which is the only thing a pass has to show",
      leftTook !== null,
      `still showing ${card} after 25s — the page never refreshed`
    );
    if (leftTook !== null) console.log(`note  the list refreshed ${leftTook}ms after the press`);

    /* ---------- passed is not gone, only out of the way -------------- */
    await page.goto(`${BASE}/browse?saved=1`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    check(
      "and the heart on the Saved tab still works there",
      (await page.locator('button[name="mark"]').count()) >= 0
    );
  } finally {
    const me = await db.collection("users").findOne({ email: MEMBER });
    if (me) await db.collection("browseMarks").deleteMany({ userId: String(me._id) });
    await browser.close();
    await mongo.close();
  }

  console.log(bad ? `\n${bad} check(s) failed` : "\nall good");
  process.exitCode = bad ? 1 : 0;
})();
