# Represent — investment proposal deck

`Represent-Investment-Proposal.pptx` — 15 slides, 16:9, built for the staged
$1M conversation. Editable in PowerPoint or Keynote like any other deck; the
generator below exists so it can be rebuilt cleanly after bigger changes.

## What's in it

| # | Slide | Note |
|---|-------|------|
| 1 | Title | |
| 2 | The problem | The 386,698-signature petition, cited without naming the cause |
| 3 | Why now | AI, institutional distrust, cheap verification |
| 4 | One verified human. One vote. | The three pillars |
| 5 | Already built | What ships today, and the $125/month run rate |
| 6 | How it works | Verify → vote → sealed at 25 → published |
| 7 | Why it's hard to copy | |
| 8 | Business model | The real tiers from `lib/org-tiers.ts` |
| 9 | Unit economics | KYC cost, target CAC, run rate |
| 10 | Where we are today | States plainly that user acquisition has not started |
| 11 | The plan | Six stages, gated on verified users |
| 12 | Use of funds | Native chart — edit the data in PowerPoint |
| 13 | The ask | $1M / 20% / $5M pre, equity issued in step |
| 14 | Team | |
| 15 | Close | |

Every number traces to something real: pricing from the app's tier config,
stage structure and equity schedule from `content/investor-milestone-plan-v5.md`,
KYC costs from `INVESTOR_TECH_BRIEF.md`. Nothing is invented, and slide 10
says what has not happened yet rather than dressing it up.

The Alberta referendum framing that runs through the v5 plan is deliberately
absent — that was a positioning decision, not an oversight. If it ever goes
back in, it belongs on slide 3 as the "why now" catalyst.

## Rebuilding

    cd pitch/deck
    npm install pptxgenjs
    node build.js

Copy is in `build.js`, one block per slide, in slide order. Colours at the top
match the app (`lib/theme.ts`) and the National Ledger site palette.

## Checking it

LibreOffice can't run in the build container, so `render.py` reads the
generated `.pptx` back with python-pptx and redraws it as HTML — real positions,
sizes and colours — and `shots.mjs` screenshots each slide with headless
Chromium. Install the metric-compatible fonts first (`fonts-crosextra-carlito`,
`fonts-crosextra-caladea`) so text wraps at the width PowerPoint would use:

    python render.py Represent-Investment-Proposal.pptx deck.html
    node shots.mjs          # → shots/slide-NN.png

Native charts render as a labelled placeholder — they can't be drawn this way.
On a machine with working LibreOffice, just convert to PDF instead.
