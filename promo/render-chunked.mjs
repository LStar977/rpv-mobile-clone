// Renders the film in chunks, one child process each, then stitches the parts
// losslessly with ffmpeg.
//
// Rendering all 1020 frames in a single process reliably died around frame 500:
// the browser would give out mid-run and every later frame failed with it. A
// fresh browser per chunk keeps each run short, and a chunk that fails can be
// retried on its own instead of losing the whole render.
import { bundle } from '@remotion/bundler';
import { spawn } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';

const CHUNK = 120;
const TOTAL = 1020;
const OUT = path.resolve('out/represent-promo.mp4');
const PARTS = path.resolve('out/parts');

fs.mkdirSync(PARTS, { recursive: true });

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))
    );
  });

console.log('bundling…');
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });

const parts = [];
for (let start = 0; start < TOTAL; start += CHUNK) {
  const end = Math.min(start + CHUNK - 1, TOTAL - 1);
  const out = path.join(PARTS, `part-${String(start).padStart(4, '0')}.mp4`);
  parts.push(out);

  if (fs.existsSync(out) && fs.statSync(out).size > 0) {
    console.log(`frames ${start}-${end}: cached`);
    continue;
  }

  let ok = false;
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    try {
      console.log(`frames ${start}-${end}: rendering (attempt ${attempt})`);
      await run('node', ['part.mjs', serveUrl, String(start), String(end), out]);
      ok = true;
    } catch (err) {
      console.log(`frames ${start}-${end}: failed — ${err.message}`);
      if (fs.existsSync(out)) fs.unlinkSync(out);
    }
  }
  if (!ok) throw new Error(`chunk ${start}-${end} failed three times`);
  console.log(`frames ${start}-${end}: done`);
}

// The concat *filter* rather than the concat demuxer: the demuxer joins on
// container timestamps and leaves a small gap at every seam, which added up to
// half a second of drift and a visible hitch. This re-encodes once and gives
// exactly the sum of the parts' frames.
console.log('stitching…');
const inputs = parts.flatMap((p) => ['-i', p]);
const filter =
  parts.map((_, i) => `[${i}:v]`).join('') +
  `concat=n=${parts.length}:v=1:a=0[v]`;

await run(ffmpeg, [
  '-y', ...inputs,
  '-filter_complex', filter, '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
  '-r', '30', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', OUT,
]);

console.log('DONE', OUT);
