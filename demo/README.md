# Represent — Investor Demo

A clickable prototype that simulates the citizen voting experience. Built for investor presentations.

## Flow

1. **Landing** — Transit proposal hook with Participate CTA
2. **Verification** — Simulated government ID scan, 1.4s verification
3. **Proposal** — Calgary Ward 7 LRT question with Support/Oppose
4. **Confirmation** — Animated success with Base tx hash receipt
5. **Results** — Aggregated results with postal code & age breakdowns, investor meeting CTA

## Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Framer Motion
- Lucide icons
- Onest + JetBrains Mono (Google Fonts)

## Develop

```bash
cd demo
npm install
npm run dev
```

Open http://localhost:3000 — best viewed in Chrome DevTools mobile view (iPhone 14 Pro).

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow prompts. The `demo/` directory should be set as the root during setup. Attach a custom domain (e.g. `demo.representvote.com`) in the Vercel dashboard.

## Edit demo content

All content (proposal text, tx hash, results data, investor email) lives in `lib/demoData.ts`.
