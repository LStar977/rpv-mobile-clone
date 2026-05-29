# Represent — Remotion brand video

A ~22s motion piece for **Represent** (representvote.com), built with [Remotion](https://remotion.dev).
Brand: black + gold + warm white, the raised-hand logo, editorial type (Space Grotesk + Instrument Serif).

## Storyboard
1. **Intro** — the logo blooms, "Represent" rises, "Voice beyond the ballot box."
2. **The problem** — "One vote every four years *isn't democracy.*"
3. **1,460** — the count of silent days, with the four-year timeline drawing across.
4. **The ballot box** — a ballot drops into the slot, the slot flashes, and **voices erupt** upward beneath "Your voice doesn't stop at the *ballot box.*"
5. **The shift** — "From a single vote to a *constant voice*" — a dead dot vs. a living equalizer.
6. **CTA** — logo, "Make your *voice* heard," store badges, representvote.com.

## Run it
```bash
cd remotion
npm install          # first time
npm run dev          # open Remotion Studio to preview/scrub
```

## Render
```bash
npm run render               # 1080x1920 vertical -> out/represent.mp4
npm run render:square        # 1080x1080 square    -> out/represent-square.mp4
npm run still                # poster frame        -> out/poster.png
```
Rendering needs Chrome/Chromium (Remotion downloads one automatically on first render).

### Restricted networks / CI
Fonts load from Google Fonts at render time. On locked-down networks (TLS-intercepting proxy, or to reuse an existing browser):
```bash
npx remotion render Represent out/represent.mp4 \
  --browser-executable="/path/to/chrome" \
  --ignore-certificate-errors
```
(Not needed on a normal connection.)

## Compositions
- `Represent` — 1080×1920 @ 30fps, 660 frames (~22s) — primary (Reels/TikTok/Stories).
- `RepresentSquare` — 1080×1080 @ 30fps — feed posts.

## Customize
- Colors/gradient: `src/theme.ts`
- Fonts: `src/fonts.ts`
- Timing & order: `src/Main.tsx` (each scene's `durationInFrames`)
- Scenes: `src/scenes/*`, shared visuals in `src/components/*`
- Logo: `public/logo.png`

## Add music / voiceover
Drop an audio file in `public/` and add to `src/Main.tsx`:
```tsx
import { Audio, staticFile } from 'remotion';
// inside <AbsoluteFill>:
<Audio src={staticFile('track.mp3')} />
```
Then size the composition's `durationInFrames` to the audio if needed.
