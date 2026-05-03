# Represent — Marketing Website

Single-page landing for representvote.com. Pitches both audiences (citizens + cities) on the same scroll.

## Stack

- Next.js 14 (App Router, RSC by default; client islands for FAQ accordion + Nav scroll-state)
- Tailwind CSS
- Onest + JetBrains Mono + Cormorant Garamond
- No emojis. No Inter. No 3-up generic card rows. (See `website/TASTE.md` style notes if added.)

## Running

```bash
cd website
npm install
npm run dev
```

Opens on http://localhost:3001 so it doesn't collide with the `demo/` prototype on 3000.

## Structure

```
website/
  app/
    layout.tsx       # fonts, grain overlay, metadata
    page.tsx         # composes the sections
    globals.css      # tailwind + base + grain
  components/
    Nav.tsx          # fixed top nav, scroll-aware
    Hero.tsx         # split CTAs + dossier preview panel
    Trust.tsx        # logo/credential strip
    HowItWorks.tsx   # 3 steps, connected dossier cards
    ForCitizens.tsx  # phone stack + features + App Store buttons
    ForCities.tsx    # Civic Desk preview + features + stat strip
    Calgary.tsx      # case study quote + meta dossier
    FAQ.tsx          # 7 FAQs, accordion (client component)
    FinalCTA.tsx     # split download + book demo
    Footer.tsx       # 4-col footer
    Container.tsx    # max-w-page wrapper
  public/screenshots/
    phone-home.png
    phone-vote.png
    phone-receipt.png
    phone-identity.png
```

## Brand tokens

Defined in `tailwind.config.ts`:
- `ink` — near-black background scale (`#040707` → `#3A4049`)
- `bone` — restrained whites (`#F4F5F6` → `#5A5F66`)
- `gold` — signature `#EABA58` plus light/dark/tint variants
- `support` / `oppose` — semantic green/red

Mirrors the design system at `_civic-desk-preview.html` and the mobile app's `lib/theme.ts`.

## Notes for the next agent

- Dial values applied: variance 8 (asymmetric layouts), motion 4 (CSS-only for now), density 5.
- No Framer Motion in this initial pass — kept the build dependency-light. Add for hero stagger or magnetic CTAs as a Phase 2 polish.
- `components/Nav.tsx` and `components/FAQ.tsx` are the only `'use client'` components. Everything else is RSC.
- App Store badges are placeholder anchors — wire to real store URLs once the iOS/Android builds are public.
- Hero "DossierPanel" and "CivicDeskPreview" are HTML/Tailwind compositions, not screenshots. They re-render at any viewport size. If you'd rather use real Civic Desk screenshots, drop them in `public/screenshots/` and swap out the JSX.
