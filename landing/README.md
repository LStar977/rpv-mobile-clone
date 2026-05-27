# Represent Vote — Landing Page

A single-page, scroll-driven landing page for **Represent Vote**, a verified
civic engagement platform that gives people a voice beyond election day.

Premium, institutional, cinematic — black, gold, and off-white.

## Stack

- React + Vite + TypeScript
- Tailwind CSS (`font-heading` / `font-body` / `font-sans` → `"Inter Tight"`)
- Framer Motion (scroll-linked animation)
- lucide-react icons
- Google Font: Inter Tight (weights 300–900)

## Getting started

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Structure

A single vertical scroll surface (`src/App.tsx`) holds three full-height
sections inside one container ref. A fixed overlay of seven civic cards is
driven by the container's scroll progress:

- **Section 1 — Hero:** cards fan across the hero.
- **Section 2 — How It Works:** cards collapse into a centered stack, descend,
  then fan into a diagonal ladder on the right.
- **Section 3 — Civic Impact:** cinematic autoplay banner (3 slides) with
  prev/next controls; cards fade away.

```
src/
  App.tsx                  scroll container + useScroll
  components/
    Background.tsx         fixed gold/grey radial blur blobs
    Navbar.tsx             logo + center links + User/Settings
    CivicCards.tsx         scroll-linked 7-card formation
    Hero.tsx               Section 1
    HowItWorks.tsx         Section 2
    CivicImpact.tsx        Section 3 banner
  data/cards.ts            the seven civic cards
public/logo.png            brand logo mark
```
