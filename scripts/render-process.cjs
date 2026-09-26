const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.argv.includes('--live') ? 'http://localhost:3000' : 'http://localhost:3015';

async function serve() {
  const next = require('next');
  const http = require('node:http');
  const app = next({ dev: true, dir: process.cwd(), hostname: '127.0.0.1', port: 3015 });
  await app.prepare();
  http.createServer(app.getRequestHandler()).listen(3015, '127.0.0.1');
}

async function main() {
  const root = process.cwd();
  const server = process.argv.includes('--live') ? null : spawn(process.execPath, [__filename, '--serve'], { cwd: root, env: { ...process.env, NIKAH_QA: '1' }, windowsHide: true, stdio: 'pipe' });
  let serverLog = '';
  if (server) {
    server.stdout.on('data', chunk => { serverLog += chunk; });
    server.stderr.on('data', chunk => { serverLog += chunk; });
  }
  let browser;
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetch(BASE, { signal: AbortSignal.timeout(5000) })).ok) break; } catch {}
      if (attempt === 59) throw new Error('Server did not start: ' + serverLog.slice(-4000));
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    browser = await chromium.launch({ headless: true });
    const out = path.join(root, '.next-qa', 'screenshots');
    fs.mkdirSync(out, { recursive: true });
    const failures = [];
    for (const width of [320, 360, 390, 430, 600, 767, 768, 880, 946, 1218, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: width === 946 ? 1420 : 1000 }, deviceScaleFactor: width === 1218 ? 1.25 : 1 });
      page.on('pageerror', error => failures.push(`${width}: ${error.message}`));
      const response = await page.goto(BASE, { waitUntil: 'networkidle' });
      if (!response.ok()) failures.push(`${width}: HTTP ${response.status()}`);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
      const layout = await page.evaluate(() => {
        const logo = document.querySelector('.landing-brand-link img');
        const logoBounds = logo.getBoundingClientRect();
        const heroBounds = document.querySelector('.landing-hero').getBoundingClientRect();
        const heroItems = [...document.querySelector('.landing-hero-copy').children].map(element => element.getBoundingClientRect());
        const heroPadding = {
          top: Math.round(heroItems[0].top - heroBounds.top),
          bottom: Math.round(heroBounds.bottom - heroItems.at(-1).bottom),
        };
        const heroGaps = heroItems.slice(1).map((item, index) => Math.round(item.top - heroItems[index].bottom));
        const sectionPadding = ['.landing-marks', '.landing-steps-panel', '.landing-values', '.landing-faq', '.landing-closing'].map(selector => {
          const style = getComputedStyle(document.querySelector(selector));
          return { selector, top: parseFloat(style.paddingTop), bottom: parseFloat(style.paddingBottom) };
        });
        const gutters = ['.landing-header-inner', '.landing-hero-inner', '.landing-steps', '.landing-values', '.landing-faq', '.landing-closing', '.landing-footer-inner'].map(selector => {
          const style = getComputedStyle(document.querySelector(selector));
          return { selector, left: parseFloat(style.paddingLeft), right: parseFloat(style.paddingRight) };
        });
        const steps = [...document.querySelectorAll('.landing-step-grid > li')].map(step => {
          const illustration = step.querySelector('.landing-step-illustration').getBoundingClientRect();
          const heading = step.querySelector('h3').getBoundingClientRect();
          const body = step.querySelector('p').getBoundingClientRect();
          return {
            illustrationGap: Math.round(heading.top - illustration.bottom),
            bodyGap: Math.round(body.top - heading.bottom),
            headingTop: Math.round(heading.top),
            bodyTop: Math.round(body.top),
            horizontalGap: Math.round(heading.left - illustration.right),
            cardHeight: Math.round(step.getBoundingClientRect().height),
          };
        });
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          hero: Math.round(document.querySelector('.landing-hero').getBoundingClientRect().height),
          valuesBottom: Math.round(document.querySelector('#why').getBoundingClientRect().bottom),
          navHeight: Math.round(document.querySelector('header').getBoundingClientRect().height),
          logoSrc: logo.getAttribute('src'),
          logoRatio: logoBounds.width / logoBounds.height,
          heroPadding,
          heroGaps,
          headingSize: parseFloat(getComputedStyle(document.querySelector('.landing-hero h1')).fontSize),
          bodySize: parseFloat(getComputedStyle(document.querySelector('.landing-description')).fontSize),
          sectionPadding,
          gutters,
          mobileBackground: getComputedStyle(document.querySelector('.landing-hero')).backgroundImage,
          marksTop: [...document.querySelectorAll('.landing-marks li')].map(item => Math.round(item.getBoundingClientRect().top)),
          valuesTop: [...document.querySelectorAll('.landing-values li')].map(item => Math.round(item.getBoundingClientRect().top)),
          steps,
        };
      });
      if (layout.overflow > 0) failures.push(`${width}: overflows by ${layout.overflow}px`);
      if (!layout.logoSrc.includes('nikahcanada-reference.webp')) failures.push(`${width}: reference logo is missing`);
      if (Math.abs(layout.logoRatio - 1200 / 303) > 0.02) failures.push(`${width}: logo is distorted`);
      if (layout.heroPadding.top !== layout.heroPadding.bottom) failures.push(`${width}: hero padding is uneven`);
      if (layout.sectionPadding.some(section => section.top !== section.bottom)) failures.push(`${width}: section padding is uneven`);
      if (!layout.mobileBackground.includes('mobile-mosque-blossoms.webp')) failures.push(`${width}: generated hero artwork is missing`);
      if (!(await page.request.get(BASE + '/images/mobile-mosque-blossoms.webp')).ok()) failures.push(`${width}: generated artwork failed to load`);
      if (width <= 767) {
        if (layout.heroGaps.some(gap => gap !== 8)) failures.push(`${width}: mobile hero gaps are uneven`);
        if (layout.steps.some(step => step.horizontalGap < 8 || step.bodyGap !== 4)) failures.push(`${width}: mobile card layout is incorrect`);
        if (layout.steps.some(step => step.cardHeight > 130)) failures.push(`${width}: mobile cards are too tall`);
        if (new Set(layout.marksTop).size !== 1 || new Set(layout.valuesTop).size !== 1) failures.push(`${width}: four-column strips are not aligned`);
      } else {
        if (layout.steps.some(step => step.illustrationGap !== 16 || step.bodyGap !== 16)) failures.push(`${width}: step spacing is not uniform`);
        if (layout.heroGaps.some(gap => gap !== 16)) failures.push(`${width}: hero content gaps are not uniform`);
        if (layout.headingSize > 60 || layout.bodySize > 18 || layout.hero > 600) failures.push(`${width}: desktop hero is oversized`);
        if (layout.gutters.some(gutter => gutter.left !== gutter.right) || new Set(layout.gutters.map(gutter => gutter.left)).size !== 1) failures.push(`${width}: page gutters are not uniform`);
      }
      if (width > 767 && new Set(layout.steps.map(step => step.headingTop)).size !== 1) failures.push(`${width}: step headings are not aligned`);
      if (width > 767 && new Set(layout.steps.map(step => step.bodyTop)).size !== 1) failures.push(`${width}: step descriptions are not aligned`);
      if ([320, 390, 430, 946, 1440].includes(width)) await page.screenshot({ path: path.join(out, `homepage-${width}.png`), fullPage: width !== 946 });
      if ([390, 768, 946, 1218, 1522].includes(width)) {
        await page.locator('#how').screenshot({ path: path.join(out, `steps-${width}.png`) });
        await page.locator('header').screenshot({ path: path.join(out, `header-${width}.png`) });
      }
      if (width === 390) {
        await page.getByRole('button', { name: 'Open menu' }).click();
        if (!(await page.locator('#landing-nav').isVisible())) failures.push('Mobile menu did not open');
        await page.locator('#landing-nav').getByRole('link', { name: 'Why NikahCanada' }).click();
        await page.waitForURL('**/#why');
        if (await page.locator('#landing-nav').isVisible()) failures.push('Mobile menu did not close');
        if (!page.url().endsWith('#why')) failures.push('Why navigation did not land on the section');
      }
      if (width === 946) {
        const firstQuestion = page.getByRole('button', { name: 'What does it cost?', exact: true });
        if (await firstQuestion.getAttribute('aria-expanded') !== 'true') failures.push('First FAQ answer should be visible');
        await firstQuestion.click();
        if (await firstQuestion.getAttribute('aria-expanded') !== 'false') failures.push('FAQ did not collapse');
        await firstQuestion.press('Enter');
        if (await firstQuestion.getAttribute('aria-expanded') !== 'true') failures.push('FAQ did not expand with keyboard');
        await page.getByRole('button', { name: 'Who can see my profile?', exact: true }).click();
        if (await page.locator('#faq .landing-faq-item[data-open="true"]').count() !== 1) failures.push('FAQ should show one answer at a time');
        const registerHref = await page.getByRole('link', { name: 'Create Your Free Profile' }).first().getAttribute('href');
        if (registerHref !== '/register') failures.push('Profile CTA points to wrong route');
      }
      console.log(JSON.stringify({ width, overflow: layout.overflow, heroPadding: layout.heroPadding, heroGaps: layout.heroGaps, steps: layout.steps }));
      await page.close();
    }
    const processPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const processResponse = await processPage.goto(BASE + '/how-it-works', { waitUntil: 'networkidle' });
    if (!processResponse.ok()) failures.push(`How-it-works: HTTP ${processResponse.status()}`);
    await processPage.close();
    if (failures.length) throw new Error(failures.join('\n'));
    console.log('PASS: responsive layouts, illustration/text spacing, reference logo proportions, menu, FAQ, registration links, and shared process page.');
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
}
(process.argv.includes('--serve') ? serve() : main()).catch(error => { console.error(error); process.exitCode = 1; });
