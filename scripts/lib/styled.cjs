/* Guard: refuse to measure an unstyled page.

   Every geometry checker in this directory reads bounding boxes. If the
   stylesheet has not loaded, those boxes are real numbers describing a
   document that no reader will ever see — so the checkers do not error,
   they report confidently wrong results:

     - measure.cjs  reports all ten app screens "clipped" by 300-2700px
     - squash.cjs   reports a clean pass, because nothing is constrained
     - align.cjs    reports a clean PASS, because unstyled containers are
                    all full-width and therefore all agree

   The two false passes are the dangerous half. This turns the whole
   class of failure into one loud, self-explaining error.

   The usual cause is `next build` run against a live dev server: they
   share `.next` and clobber each other, after which dev serves 404s for
   every chunk including layout.css. */

const MIN_RULES = 10; // a healthy page here carries >100

async function assertStyled(page, where) {
  const state = await page.evaluate(() => {
    let rules = 0;
    for (const sheet of document.styleSheets) {
      try {
        rules += sheet.cssRules.length;
      } catch {
        /* cross-origin sheet, not ours */
      }
    }
    return { rules, font: getComputedStyle(document.body).fontFamily };
  });

  if (state.rules >= MIN_RULES) return;

  console.error(
    `\nFAIL: ${where} rendered with ${state.rules} CSS rules (body font: ${state.font}).`
  );
  console.error("The stylesheet did not load, so every measurement here would be meaningless.");
  console.error("");
  console.error("Usual cause: `next build` was run while the dev server was up — they share");
  console.error(".next and clobber each other. Fix:");
  console.error("");
  console.error("  1. stop the dev server");
  console.error("  2. rm -rf .next");
  console.error("  3. npm run dev");
  console.error("");
  process.exit(1);
}

module.exports = { assertStyled };
