import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import path from 'path';

// On a normal laptop, leave PROMO_BROWSER unset — Remotion fetches its own headless
// Chrome the first time you render. Set it only on machines without that download.
const EXE = process.env.PROMO_BROWSER;
const browser = EXE
  ? { browserExecutable: EXE, chromiumOptions: { gl: 'swangle' } }
  : {};

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'PromoVertical', ...browser });

let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: path.resolve('out/represent-promo-vertical.mp4'),
  crf: 20,
  concurrency: 3,
  imageFormat: 'jpeg',
  jpegQuality: 95,
  // font loading in several tabs at once outruns the 28s default
  timeoutInMilliseconds: 180000,
  ...browser,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 100);
    if (pct >= last + 10) {
      last = pct;
      console.log(`progress ${pct}%`);
    }
  },
});
console.log('DONE');
