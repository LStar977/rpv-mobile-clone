# Represent — Investor Landing

Self-contained single-page pitch landing for the BDC investor audience. Built from `Landing Page.html` in the design bundle (`1ckv09fvjJq9PfInQihNng`).

## Sections

1. **Hero** — *"Democracy has no infrastructure. We're building it."*
2. **The Category** — the world before Represent
3. **Why Now** — three shifts making this inevitable
4. **How It Works** — four pillars of verified consensus
5. **The Market Creation Thesis** — we're not competing, we're creating
6. **Traction & Momentum** — demand before launch
7. **The Competitive Trigger** — what unlocks the market
8. **The Ask**

## Deploy to Vercel

This is a single static `index.html` with all CSS, fonts, and the logo inlined. No build step needed.

### Fastest — via Vercel CLI

```bash
cd pitch
npx vercel --prod
```

Walks you through login on first run, then publishes a `*.vercel.app` URL in ~30 seconds.

### Via the Vercel dashboard

1. Go to https://vercel.com/new and import `LStar977/rpv-mobile-clone`
2. Configure:
   - **Root Directory**: `pitch`
   - **Framework Preset**: Other (static)
   - Build/Output: leave blank
3. Deploy

Auto-deploys on every push to the configured branch.

## Local preview

```bash
cd pitch
python3 -m http.server 8000
# open http://localhost:8000
```
