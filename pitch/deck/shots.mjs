import { chromium } from 'playwright';
import path from 'path';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('file://' + path.resolve('deck.html'));
await page.waitForTimeout(1200);

const n = await page.locator('.slide').count();
for (let i = 1; i <= n; i++) {
  await page.locator(`#s${i}`).screenshot({ path: `shots/slide-${String(i).padStart(2, '0')}.png` });
}
console.log('captured', n);
await browser.close();
