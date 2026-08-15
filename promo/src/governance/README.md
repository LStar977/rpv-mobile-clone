# The Law Above Power — governance film system

A data-driven Remotion system for the 155-part governance-literacy series.
Principle 001 is the reference implementation. Full build specification lives
with the project owner ("REPRESENT_REMOTION_README").

## Architecture

- `types.ts` — the `PrincipleFilm` data contract. Canonical text and the
  Sentinel Test are source material: **never edited by rendering code**.
- `design.ts` — all brand tokens and timing constants. Scenes contain no
  magic colors or durations.
- `data/principle-XXX.ts` — one file per principle. Content, scene timeline,
  diagram nodes, evidence list, captions.
- `components/primitives.tsx` — GoldDivider, SectionIdentifier, Captions,
  symbol marks (Individual, Governance, SealedScroll).
- `components/scenes.tsx` — the film grammar: InstitutionalOpen →
  PrincipleStatement → HumanOrigin → ConceptDiagram → HistoricalEvidence →
  Reflection → SentinelTest → SeriesClose.
- `PrincipleVertical.tsx` — assembles any `PrincipleFilm` from its timeline.
  Duration is computed from data (`filmDuration`).

## Adding a principle

1. Create `data/principle-002.ts` exporting a `PrincipleFilm`.
2. Register a `<Composition id="Principle002" …>` in `src/Root.tsx` with
   `durationInFrames={filmDuration(PRINCIPLE_002)}`.
3. Render: `PROMO_BROWSER=… node render-chunked.mjs Principle002`

No component changes should be needed for a standard principle. If one is,
prefer adding a controlled layout variant over one-off code.

## Render / preview

```bash
npm run studio                     # live preview
node stills.mjs 200 760 1480       # QC stills (COMP=Principle001 env var)
node render-chunked.mjs Principle001
```

Output: `out/represent-principle001.mp4` (1080×1920, 30fps, H.264).

## Audio

The system renders silent until narration exists. Drop a WAV under
`public/narration/` and set `audio.narration` in the principle's data file —
the composition picks it up automatically. Music likewise (`audio.music`,
mixed low; narration always wins).

## Known gaps (deliberate)

- Historical evidence renders as typographic cards. The spec forbids invented
  document imagery; add authentic public-domain scans under
  `public/historical/` and set `asset` on each item to upgrade the scene.
- No music/sonic identity yet — the spec's motif is unapproved, so nothing is
  hard-coded.
- 16:9 Academy composition not yet built; layout constants are centralized in
  `design.ts` to keep that door open.
