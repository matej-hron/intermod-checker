// Asserts that no view overflows its viewport at any of the three widths.
// Horizontal overflow was the headline defect this redesign exists to fix, so
// it gets an executable check rather than an eyeball.
const { chromium } = require('playwright-core');

// Ports are often contested, and `vite preview` silently falls back to another
// one. Pass the URL it actually printed: npm run check:viewport -- http://localhost:4174/
const TARGET = process.argv[2] || process.env.CHECK_URL || 'http://localhost:4173/';

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

async function populateCarriers(page) {
  for (let i = 0; i < 4; i++) {
    const n = await page.locator('.carrier').count();
    if (n >= 4) break;
    await page.getByRole('button', { name: 'Add frequency' }).click();
    await page.getByRole('dialog', { name: /Edit / }).waitFor();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('dialog', { name: /Edit / }).waitFor({ state: 'hidden' });
  }

  const freqs = ['500.000', '500.250', '500.500', '501.000'];
  const rows = page.locator('.carrier__open');
  for (let i = 0; i < freqs.length; i++) {
    await rows.nth(i).click();
    const dialog = page.getByRole('dialog', { name: /Edit / });
    await dialog.waitFor();
    const input = dialog.getByLabel(/Frequency for .* in megahertz/);
    await input.fill(freqs[i]);
    await input.blur();
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  let failures = 0;

  for (const size of WIDTHS) {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
    });
    await page.goto(TARGET, { waitUntil: 'networkidle' });

    // Seed: add carriers and set colliding frequencies so Tune has data.
    await populateCarriers(page);
    await page.getByRole('button', { name: 'Analyse' }).click();
    await page.waitForTimeout(2500);

    for (const view of ['Setup', 'Results', 'Tune']) {
      if (view === 'Tune') {
        await page.getByRole('button', { name: 'Tune', exact: true }).click();
        const chips = page.locator('.context-chip');
        if ((await chips.count()) > 0) await chips.first().click();
        await page.waitForTimeout(2500);
      } else {
        await page.getByRole('button', { name: view, exact: true }).click();
        await page.waitForTimeout(250);
      }
      const [scrollWidth, clientWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      const ok = scrollWidth <= clientWidth;
      if (!ok) failures += 1;
      console.log(
        `${ok ? 'PASS' : 'FAIL'} ${size.name} ${view}: scroll ${scrollWidth} / client ${clientWidth}`,
      );
    }

    const small = await page.evaluate(() => {
      const targets = document.querySelectorAll(
        'button, a, input, select, summary, [role="button"]',
      );
      return [...targets]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.height < 44 || r.width < 44);
        })
        .map((el) => `${el.tagName}.${el.className} ${Math.round(el.getBoundingClientRect().height)}px`);
    });
    if (size.name === 'phone' && small.length > 0) {
      failures += 1;
      console.log(`FAIL phone touch targets under 44px:\n  ${small.join('\n  ')}`);
    } else if (size.name === 'phone') {
      console.log('PASS phone touch targets: none under 44px');
    }

    await page.close();
  }

  await browser.close();
  console.log(failures === 0 ? 'ALL PASS' : `${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
})();
