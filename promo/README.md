# Represent — promo film

A 34-second vertical (1080×1920) promo film for the app, built with
[Remotion](https://remotion.dev). Remotion renders React components frame by
frame into an MP4, so the whole video is code — editing a line of copy and
re-rendering takes a couple of minutes and costs nothing.

Sized for X, Instagram Reels, TikTok and YouTube Shorts.

## The cut

| # | Scene | Length | What's on screen |
|---|-------|--------|------------------|
| 1 | Open | 3.5s | "Anyone can run a poll. Almost nobody can prove who voted." |
| 2 | Ghosts | 4.0s | Duplicate accounts pile up — "So the number means nothing." |
| 3 | Reveal | 4.0s | App mark, wordmark, "One verified human · One vote" |
| 4 | Verify | 4.5s | ID scan → VERIFIED → the one-way hash we keep |
| 5 | Ballot | 6.0s | A real ballot: tap SUPPORT, seal, then the 25-vote threshold card |
| 6 | Ledger | 4.5s | Sealed hashes scrolling — "Every ballot is written to a public ledger" |
| 7 | Orgs | 3.5s | Unlimited ballots, instant results, analytics, sub-groups |
| 8 | CTA | 4.0s | Free on the App Store · representvote.com |

Every claim in the film is one we can defend. There are no invented user
counts, vote totals or growth stats anywhere in it. The only numbers shown are
the real 25-ballot tally threshold and an illustrative in-app ballot, the same
way the App Store screenshots work. The ledger scene says "pilot phase"
because we are still on a testnet.

## Changing it

Copy lives inside the scene files, one per scene:

    src/scenes/S1Open.tsx    … S8CTA.tsx

Colours and fonts are in `src/theme.ts` and match the app's `lib/theme.ts`
(obsidian `#040707`, Sovereign Gold `#EABA58`, Newsreader / Onest /
JetBrains Mono). Scene order and timing are the `TIMELINE` array in
`src/Main.tsx` — the numbers are frames at 30fps, so 105 frames is 3.5
seconds. Change a length there and the video re-times itself.

## Rendering

First time on a machine:

    cd promo
    npm install

Then to make the MP4 (lands in `out/represent-promo-vertical.mp4`):

    npm run render

To preview interactively in a browser with a scrubber — much faster than
re-rendering while you tweak wording:

    npm run studio

To check single frames without rendering the whole thing (frame numbers, any
amount, written to `out/fNNN.png`):

    node stills.mjs 80 300 620

On a machine that can't download Chrome, point at an existing one:

    PROMO_BROWSER=/path/to/headless_shell npm run render

## Notes

- The film is silent by design — most social video autoplays muted. If you want
  music, add the track to `public/` and drop an `<Audio src={staticFile('…')} />`
  into `src/Main.tsx`. Use a licensed track; don't pull one off YouTube.
- `public/icon.png` is a copy of the app icon from `assets/icon.png`. If the
  icon changes, copy it across again.
- Fonts are committed in `public/fonts/` and also baked into `src/fontData.ts`
  as data URIs, so a render never touches the network for them. If you swap a
  font file, run `npm run build-fonts` to regenerate that file.
