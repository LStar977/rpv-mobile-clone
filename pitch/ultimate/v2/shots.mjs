import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'path';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  args: ['--no-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('file://' + '/home/user/rpv-mobile-clone/pitch/ultimate/v2/deck.html');
await page.waitForTimeout(1200);

const n = await page.locator('.slide').count();
for (let i = 1; i <= n; i++) {
  await page.locator(`#s${i}`).screenshot({ path: `/home/user/rpv-mobile-clone/pitch/ultimate/v2/shots/slide-${String(i).padStart(2, '0')}.png` });
}
console.log('captured', n);
await browser.close();
