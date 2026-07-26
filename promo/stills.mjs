import { bundle } from '@remotion/bundler';
import { selectComposition, renderStill } from '@remotion/renderer';
import path from 'path';

const EXE = process.env.PROMO_BROWSER;
const browser = EXE
  ? { browserExecutable: EXE, chromiumOptions: { gl: 'swangle' } }
  : {};
const ID = process.env.COMP || 'PromoVertical';
const frames = process.argv.slice(2).map(Number);

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({
  serveUrl,
  id: ID,
  ...browser,
});

for (const frame of frames) {
  await renderStill({
    composition,
    serveUrl,
    output: path.resolve(`out/f${frame}.png`),
    frame,
    ...browser,
    overwrite: true,
  });
  console.log('rendered', frame);
}
