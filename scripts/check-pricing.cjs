const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const base = 'http://localhost:3000';
  const out = path.join(process.cwd(), '.next-qa', 'screenshots');
  fs.mkdirSync(out, { recursive: true });
  try {
    for (const width of [320, 360, 390, 430, 600, 767, 768, 880, 881, 946, 1218, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      page.on('pageerror', error => failures.push(`${width}: ${error.message}`));
      const response = await page.goto(base + '/pricing', { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      if (!response.ok() || new URL(page.url()).pathname !== '/pricing') failures.push(`${width}: pricing is not publicly accessible`);
      if (await page.locator('#pricing-title').count() !== 1) failures.push(`${width}: pricing title is missing`);
      if (await page.locator('.pricing-card').count() !== 3) failures.push(`${width}: three packages should be visible`);
      const prices = await page.locator('.pricing-price').allTextContents();
      if (!['$29.99', '$69.99', '$99.99'].every((price, index) => prices[index]?.includes(price))) failures.push(`${width}: package prices do not match the reference`);
      if (await page.locator('.pricing-card.is-featured').count() !== 1 || !(await page.locator('.pricing-card').nth(1).getAttribute('class')).includes('is-featured')) failures.push(`${width}: middle package should be featured`);
      const layout = await page.evaluate(() => {
        const logo = document.querySelector('.landing-brand-link img');
        const bounds = logo.getBoundingClientRect();
        const cards = [...document.querySelectorAll('.pricing-card')].map(element => element.getBoundingClientRect());
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          logoSrc: logo.getAttribute('src'),
          logoRatio: bounds.width / bounds.height,
          cardTops: cards.map(card => Math.round(card.top)),
          cardHeights: cards.map(card => Math.round(card.height)),
          dashes: document.body.innerText.split('\n').filter(text => /[-\u2010-\u2015\u2212]/.test(text)),
        };
      });
      if (layout.overflow > 0) failures.push(`${width}: horizontal overflow`);
      if (!layout.logoSrc.includes('nikahcanada-reference.webp') || Math.abs(layout.logoRatio - 1200 / 303) > .02) failures.push(`${width}: reference logo is missing or distorted`);
      if (layout.dashes.length) failures.push(`${width}: visible copy contains dash characters`);
      if (width > 767 && (new Set(layout.cardTops).size !== 1 || new Set(layout.cardHeights).size !== 1)) failures.push(`${width}: desktop package cards are uneven`);
      if (width <= 767 && new Set(layout.cardTops).size !== 3) failures.push(`${width}: mobile package cards should stack`);
      const destinations = await page.locator('.pricing-plan-button').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
      if (destinations.some(destination => destination !== '/register')) failures.push(`${width}: package actions should lead to registration`);
      if (width === 390) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        const pricingLink = page.locator('#landing-nav').getByRole('link', { name: 'Pricing', exact: true });
        if (await pricingLink.getAttribute('aria-current') !== 'page') failures.push('Mobile navigation does not identify the pricing page');
        await pricingLink.click();
        if (await page.locator('#landing-nav').isVisible()) failures.push('Mobile navigation did not close');
      }
      if ([390, 946, 1440].includes(width)) {
        await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
        await page.screenshot({ path: path.join(out, `pricing-${width}.png`), fullPage: true });
      }
      console.log(JSON.stringify({ width, overflow: layout.overflow, cardHeights: layout.cardHeights }));
      await page.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.landing-desktop-nav').getByRole('link', { name: 'Pricing', exact: true }).click();
    await page.waitForURL('**/pricing');
    if (await page.locator('.landing-desktop-nav').getByRole('link', { name: 'Pricing', exact: true }).getAttribute('aria-current') !== 'page') failures.push('Desktop navigation does not identify the pricing page');
    await page.getByRole('link', { name: 'Get started with 3 connections', exact: true }).click();
    await page.waitForURL('**/register');
    if (await page.getByRole('heading', { name: 'Create your account' }).count() !== 1) failures.push('Package action did not reach registration');
    await page.goto(base + '/dashboard', { waitUntil: 'networkidle' });
    if (new URL(page.url()).pathname !== '/login') failures.push('Member routes should still require sign in');
    await page.close();
    if (failures.length) throw new Error(failures.join('\n'));
    console.log('PASS: public pricing route, reference logo, prices, responsive cards, navigation, registration actions, and member route protection.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
