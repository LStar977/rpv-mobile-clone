# Redesign implementation — build guide

Porting the Claude Design redesign (`content/handoff/app-redesign-brief.md` + the
`.dc.html` mockups) into the React Native app. This folder is the **foundation**:
fonts, tokens, and the reusable component kit. Screens are built on top of it.

## What's done (foundation — this commit)

- **Fonts** — `assets/fonts/` has Newsreader (400/500/600), Onest (400–700),
  JetBrains Mono (400/500/600). Loaded non-blocking via `expo-font` in
  `app/_layout.tsx`; text falls back to the system font until they're ready, so a
  slow font load never blanks the app. `expo-font` added to `package.json`.
- **Tokens** — `lib/redesign.ts`: `FONTS`, `TYPE` (the full type scale), `SPACE`,
  `RADIUS`, `SIDE` (Support/Oppose colors — the one seam to change for a neutral
  restyle), `MOTION`. Colors themselves are unchanged (still `lib/theme.ts`).
- **Component kit** — `components/redesign/`:
  - `T` / `Serif` / `Mono` / `Eyebrow` — typed text primitives (only way to render
    text in redesign screens).
  - `Button` — primary(gold)/secondary/ghost/destructive, press-scale + loading.
  - `TrustChip` — verified / citizens-only / scope / open-closed pills.
  - `TallyBar` — the signature results viz; handles the 0-ballot launch state.
  - `ProposalCard` — the workhorse card (yes-no / ranked / multi).

## Preview routes (test on-device before IA cutover)

These render the finished redesign screens against **real data**, without touching
the live tabs. Open them in Expo (deep-link or a temp button):

| Route | Screen |
|---|---|
| `/redesign-home` | 04 · Home / Vote (verified status, Oct-19 countdown, open proposals) |
| `/redesign-feed` | 05 · Proposal Feed |
| `/redesign-proposal` | 06/08 · Proposal detail + yes/no vote + receipt |
| `/redesign-ballot` | 07 · Ranked / multiple-choice ballot |
| `/redesign-results` | 09 · Results (yes-no / multi / ranked) |

Flow works end-to-end: Home/Feed → tap a proposal → detail → vote → recorded
receipt (or → full ballot for ranked/multi). All calls hit the real
`proposalsApi`. Start at `/redesign-home` or `/redesign-feed`.

## How to run it locally (you, in Expo)

```bash
npm install          # installs expo-font (this container had no node_modules)
npx expo start       # then open on a device / simulator
```

The fonts + kit are non-breaking: existing screens are untouched and keep working
while redesign screens are built alongside.

## Screen build queue (recommended order)

Build the **core loop first** — it's the heart and exercises the whole kit:

1. `04 Home / Vote` — verified status, open proposals, Oct-19 countdown
2. `05 Proposal Feed` — scoped list of `ProposalCard`s + filters
3. `06 Proposal Detail + yes/no vote` — the ballot (pre/post-vote states)
4. `X1 Confirm-ballot sheet` + `08 Vote Receipt` — the "recorded" moment
5. `09 Results + Shadow Referendum board`
6. `07 Ranked / multi-choice ballot`
7. `10 Identity` (verified credential card + badges)
8. `01–03 Onboarding + verification flow`
9. `11 Organizations`, `12 Create proposal`, `13 Sentinel + paywall`
10. Secondary set (14–22) + empty/loading/error system

### Two decisions to make before the screen phase
- **Restyle-in-place vs fresh rebuild.** The redesign changes IA (5 tabs → 4:
  Vote · Results · Organizations · Identity). Recommendation: build fresh screens
  in a new route group and cut over tab-by-tab, keeping the current (audited-buggy)
  screens as reference for API/nav wiring — don't lose the working data plumbing.
- **Wire to real data as you go.** Each screen should consume the existing
  `lib/api.ts` + stores (auth, ballots) so it's not a dead mockup. Port the
  *layout* from the mockup; reuse the *logic* from the current screen.

### Notes for faithful porting (RN ≠ CSS)
- No `gap` on RN < 0.71 — this project is on a version that supports `gap`, but
  verify on device.
- No `font:` shorthand, no CSS vars — use the `T` component + `TYPE` tokens.
- Gradients (gold) → `expo-linear-gradient` (already a dependency).
- Shadows differ iOS/Android — use `shadow*` + `elevation` together.
- `letterSpacing` is px in RN (already converted in `TYPE`).
- Percentages work for width (used in `TallyBar`); avoid percentage heights.
