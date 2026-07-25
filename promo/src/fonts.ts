import { continueRender, delayRender } from 'remotion';
import { FONT_CSS, FONT_SPECS } from './fontData';

// Fonts are inlined as data URIs (see scripts/build-fonts.mjs), so this is a
// parse, not a fetch — nothing here can stall on the network.
const handle = delayRender('Loading Represent brand fonts');

const style = document.createElement('style');
style.textContent = FONT_CSS;
document.head.appendChild(style);

const ready = Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec)));

// Belt and braces: never hold a render hostage to font loading.
Promise.race([
  ready,
  new Promise((resolve) => setTimeout(resolve, 15000)),
])
  .catch(() => undefined)
  .then(() => continueRender(handle));
