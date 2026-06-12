'use client';

import dynamic from 'next/dynamic';
import { Logo } from './Logo';

// Globe is client-only — WebGL doesn't SSR.
const Globe = dynamic(() => import('./Globe').then((m) => m.Globe), { ssr: false });

export function Hero() {
  return (
    <section className="relative h-screen w-full overflow-hidden">
      {/* Globe canvas — full-bleed, behind content */}
      <Globe />

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <Logo size={36} />
          <span className="font-serif text-lg tracking-tight text-cream">
            Represent Vote
          </span>
        </div>
        <nav className="hidden gap-8 text-sm text-cream/70 md:flex">
          <a href="#how" className="hover:text-cream">How it works</a>
          <a href="#trust" className="hover:text-cream">Identity &amp; privacy</a>
          <a href="#orgs" className="hover:text-cream">For organizations</a>
        </nav>
      </header>

      {/* Headline overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-6 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-xs uppercase tracking-[0.25em] text-gold">
            <span className="shimmer">Live</span> · Verified citizen voting
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tightest text-cream md:text-7xl lg:text-8xl">
            Your vote, <span className="text-gold">verified</span>.
            <br />
            Your voice, <span className="text-gold">heard</span>.
          </h1>
          <p className="mt-6 max-w-xl text-base text-cream/70 md:text-lg">
            Identity-checked. Geo-gated to your riding. Recorded on-chain.
            Built so that when Canadians speak, no one can pretend they didn&apos;t.
          </p>

          <div className="pointer-events-auto mt-10 flex flex-wrap items-center gap-4">
            <a
              href="https://apps.apple.com/ca/app/id6756912022"
              className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-black transition hover:bg-gold-soft"
            >
              Download on the App Store
              <span aria-hidden>→</span>
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-cream/20 px-6 py-3 text-sm text-cream transition hover:border-cream/60"
            >
              See how it works
            </a>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-cream/40">
        Scroll
      </div>
    </section>
  );
}
