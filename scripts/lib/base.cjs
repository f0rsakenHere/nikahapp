/* Where the checkers point, and proof that it is us.
 *
 * Port 3000 is not ours by right. Any other Next project on this machine
 * will take it first, and then every checker here quietly measures
 * somebody else's application: `/` answers 200, `/how-it-works` answers
 * 404, and the geometry scripts report "NO PHONE FRAMES FOUND" — which
 * reads as a broken selector, not a wrong server. That cost real time
 * once, so it is now a named failure.
 *
 *   BASE=http://127.0.0.1:3001 node scripts/measure.cjs
 */

const BASE = (process.env.BASE || "http://127.0.0.1:3000").replace(/\/$/, "");

/* `en-CA` is set in src/app/layout.tsx and is deliberately unusual —
 * a stray `en` or `en-US` means we are looking at a different app. */
const MARKER = "en-CA";

/** Fails loudly if the page did not come from this project. Call once per
 *  run, after the first navigation. */
async function assertOurApp(page) {
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang === MARKER) return;

  /* A crashed page has no `lang` either, and reporting that as "another
     dev server has the port" sent a real debugging session off after a
     port conflict that did not exist. Next's error page names itself. */
  const title = await page.title().catch(() => "");
  const body = await page.evaluate(() => document.body?.innerText ?? "").catch(() => "");
  if (/error|exception|unhandled/i.test(title) || /Application error|Unhandled Runtime/i.test(body)) {
    console.error(`\nFAIL: ${BASE}${new URL(page.url()).pathname} returned an error page.`);
    console.error(`      ${title || body.split("\n")[0] || "no title"}`);
    console.error("");
    console.error("This is our app, and it is broken. Check the dev server's output — a stale");
    console.error(".next cache after a build is the usual cause, and `rm -rf .next` clears it.");
    console.error("");
    process.exit(1);
  }

  console.error(`\nFAIL: ${BASE} is not serving this project.`);
  console.error(`      <html lang> is "${lang || "(unset)"}", expected "${MARKER}".`);
  console.error("");
  console.error("Another dev server has the port. Either stop it, or start this one");
  console.error("elsewhere and point the checkers at it:");
  console.error("");
  console.error("  npx next dev -p 3001");
  console.error("  BASE=http://127.0.0.1:3001 node scripts/<checker>.cjs");
  console.error("");
  process.exit(1);
}

/** Fills the sign-up form's date of birth from a `yyyy-mm-dd` string.
 *
 *  It is three controls, not one — a day, a named month and a year (see
 *  `DateOfBirthField`). Every checker that registers somebody goes
 *  through here so that the next change to the control is one edit
 *  rather than nine. */
async function fillDob(page, iso) {
  const [year, month, day] = iso.split("-");
  await page.fill('input[name="dobDay"]', String(Number(day)));
  await page.selectOption('select[name="dobMonth"]', String(Number(month)));
  await page.fill('input[name="dobYear"]', year);
}

module.exports = { BASE, assertOurApp, fillDob };
