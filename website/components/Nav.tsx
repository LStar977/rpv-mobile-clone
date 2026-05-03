'use client';

import { useEffect, useState } from 'react';
import { Container } from './Container';

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#citizens', label: 'For citizens' },
  { href: '#cities', label: 'For cities' },
  { href: '#calgary', label: 'Calgary' },
  { href: '#faq', label: 'FAQ' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled
          ? 'border-b border-bone/[0.08] bg-ink/80 backdrop-blur-md'
          : 'border-b border-transparent'
      }`}
    >
      <Container className="flex h-[64px] items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gold-tintStrong text-gold font-serif text-[15px] leading-none">
            R
          </span>
          <span className="font-serif text-[18px] tracking-tightish">
            Represent<span className="text-gold">.</span>
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] text-bone-muted transition-colors hover:text-bone"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#cities-cta"
            className="hidden rounded-full border border-bone/[0.12] px-4 py-2 text-[13px] text-bone-muted transition-colors hover:border-bone/30 hover:text-bone md:inline-flex"
          >
            Book a demo
          </a>
          <a
            href="#download"
            className="rounded-full bg-gold px-4 py-2 text-[13px] font-medium text-ink transition-transform active:translate-y-[1px]"
          >
            Get the app
          </a>
        </div>
      </Container>
    </header>
  );
}
