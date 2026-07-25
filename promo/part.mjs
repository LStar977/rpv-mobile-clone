// Renders one frame range to its own MP4, in its own process, with its own
// browser. Called by render-chunked.mjs — not meant to be run by hand.
import { selectComposition, renderMedia } from '@remotion/renderer';

const [serveUrl, start, end, out] = process.argv.slice(2);
const EXE = process.env.PROMO_BROWSER;
const browser = EXE
  ? { browserExecutable: EXE, chromiumOptions: { gl: 'swangle' } }
  : {};

const composition = await selectComposition({
  serveUrl,
  id: 'PromoVertical',
  ...browser,
});

await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: out,
  crf: 20,
  concurrency: 1,
  imageFormat: 'jpeg',
  jpegQuality: 95,
  frameRange: [Number(start), Number(end)],
  timeoutInMilliseconds: 120000,
  ...browser,
});
