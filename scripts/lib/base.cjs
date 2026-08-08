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

module.exports = { BASE, assertOurApp };
