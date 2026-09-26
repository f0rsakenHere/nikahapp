const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const question = page.getByRole('button', { name: 'What does it cost?', exact: true });
      const answer = page.locator('#landing-faq-answer-0');
      await question.scrollIntoViewIfNeeded();
      const initial = (await answer.boundingBox()).height;
      const sample = () => page.evaluate(async () => {
        document.querySelector('#landing-faq-question-0').click();
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => setTimeout(resolve, 70));
        const middle = document.querySelector('#landing-faq-answer-0').getBoundingClientRect().height;
        await new Promise(resolve => setTimeout(resolve, 330));
        const end = document.querySelector('#landing-faq-answer-0').getBoundingClientRect().height;
        return { middle, end };
      });
      const closing = await sample();
      const opening = await sample();
      if (!(closing.middle > 0 && closing.middle < initial && closing.end === 0)) throw new Error(`${width}: closing snapped instead of animating`);
      if (!(opening.middle > 0 && opening.middle < opening.end && Math.abs(opening.end - initial) < 1)) throw new Error(`${width}: opening snapped instead of animating`);

      await page.evaluate(async () => {
        const button = document.querySelector('#landing-faq-question-0');
        for (let count = 0; count < 4; count++) {
          button.click();
          await new Promise(resolve => setTimeout(resolve, 40));
        }
        await new Promise(resolve => setTimeout(resolve, 350));
      });
      if (Math.abs((await answer.boundingBox()).height - initial) > 1) throw new Error(`${width}: rapid toggles left the answer stuck`);

      await question.focus();
      await question.press('Enter');
      if (await question.getAttribute('aria-expanded') !== 'false' || await answer.getAttribute('aria-hidden') !== 'true' || await answer.getAttribute('inert') === null) throw new Error(`${width}: collapsed accessibility state is incorrect`);
      await question.press('Space');
      await page.getByRole('button', { name: 'What does a wali do here?', exact: true }).click();
      if (await page.locator('.landing-faq-trigger[aria-expanded="true"]').count() !== 1) throw new Error(`${width}: more than one answer is active`);

      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reducedDuration = await answer.evaluate(element => getComputedStyle(element).transitionDuration);
      if (reducedDuration.split(',').some(duration => parseFloat(duration) > .001)) throw new Error(`${width}: reduced motion is ignored`);
      console.log(JSON.stringify({ width, closing, opening, reducedDuration }));
      await page.close();
    }
    console.log('PASS: smooth opening and closing, rapid toggles, keyboard controls, accessibility states, and reduced motion.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
