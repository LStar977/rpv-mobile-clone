import { Container } from './Container';

export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate min-h-[100dvh] overflow-hidden pt-[64px]"
    >
      {/* Ambient gold wash, very subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(234,186,88,0.10), transparent 60%)',
        }}
      />

      <Container className="grid grid-cols-1 items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
        {/* Left: pitch */}
        <div className="max-w-[640px]">
          <div className="eyebrow-gold mb-6">VERIFIED · NON-PARTISAN · ON-CHAIN</div>
          <h1 className="font-serif text-5xl leading-[1.02] tracking-crunch md:text-[72px] md:leading-[0.98]">
            What if your city <em className="not-italic text-gold">actually asked</em> before deciding?
          </h1>
          <p className="mt-6 max-w-[58ch] text-[17px] leading-relaxed text-bone-muted">
            Represent runs identity-verified votes that cities can act on. Residents weigh in from their phone in under a minute. Every result is signed, public, and built to be trusted by both sides.
          </p>

          {/* Split CTAs */}
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <a
              id="download"
              href="#citizens"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-gold/40 bg-gold-tintStrong px-5 py-4 transition-colors hover:bg-gold-tint hover:border-gold/60 active:translate-y-[1px]"
            >
              <div className="text-left">
                <div className="eyebrow-gold mb-1.5">FOR CITIZENS</div>
                <div className="text-[15px] font-medium text-bone">Get the app</div>
              </div>
              <ArrowOut />
            </a>
            <a
              id="cities-cta"
              href="#cities"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-bone/[0.12] bg-bone/[0.02] px-5 py-4 transition-colors hover:border-bone/[0.24] hover:bg-bone/[0.04] active:translate-y-[1px]"
            >
              <div className="text-left">
                <div className="eyebrow mb-1.5">FOR CITIES & ORGS</div>
                <div className="text-[15px] font-medium text-bone">Book a demo</div>
              </div>
              <ArrowOut muted />
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-bone-faint">
            <Stat n="612K+" l="Verified residents" />
            <Divider />
            <Stat n="208,743" l="Votes · April 2026" />
            <Divider />
            <Stat n="100%" l="Audit integrity" />
          </div>
        </div>

        {/* Right: institutional dossier panel */}
        <div className="relative w-full">
          <DossierPanel />
        </div>
      </Container>
    </section>
  );
}

function ArrowOut({ muted = false }: { muted?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={muted ? '#C7CACD' : '#EABA58'}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-transform group-hover:translate-x-[2px]"
    >
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className="font-mono text-[14px] text-bone">{n}</span>
      <span className="text-bone-faint">{l}</span>
    </span>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-bone/[0.12]" />;
}

// Dossier-style preview of a live vote — the institutional aesthetic in miniature.
function DossierPanel() {
  return (
    <div className="relative rounded-[20px] border border-bone/[0.10] bg-ink-850 p-7 shadow-diffuse">
      {/* Corner ticks (subtle paper-like marks) */}
      <Tick className="absolute left-3 top-3" />
      <Tick className="absolute right-3 top-3 rotate-90" />
      <Tick className="absolute bottom-3 left-3 -rotate-90" />
      <Tick className="absolute bottom-3 right-3 rotate-180" />

      <div className="flex items-center justify-between">
        <div className="eyebrow-gold">CG · 2061 · 26 · LIVE</div>
        <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-eyebrow text-support">
          <span className="relative grid h-1.5 w-1.5 place-items-center">
            <span className="absolute inset-0 rounded-full bg-support" />
            <span className="absolute inset-0 animate-ping rounded-full bg-support/60" />
          </span>
          STREAMING
        </span>
      </div>

      <div className="mt-5 font-serif text-[28px] leading-[1.1] tracking-tightish">
        Bus rapid transit
        <br />
        <span className="text-bone-muted">17 Avenue corridor</span>
      </div>

      <div className="mt-5 text-[12.5px] text-bone-muted">
        Council proposes a dedicated transit lane along 17 Avenue SW. The corridor handles 28,000 daily transit trips already.
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-bone/[0.08] pt-5">
        <Cell label="VOTES" v="32,418" />
        <Cell label="SUPPORT" v="64.2%" tone="support" />
        <Cell label="CLOSES IN" v="2d 04h" tone="gold" />
      </div>

      {/* Sentiment bar */}
      <div className="mt-5 flex h-1.5 overflow-hidden rounded-full bg-bone/[0.06]">
        <span className="block bg-support" style={{ width: '64.2%' }} />
        <span className="block bg-oppose" style={{ width: '35.8%' }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-bone-faint">
        <span className="text-support">64.2% sup</span>
        <span className="text-oppose">35.8% opp</span>
      </div>

      {/* Verification chip */}
      <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-bone/[0.08] bg-bone/[0.02] px-3.5 py-3">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-gold-tint text-gold">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-[12px] text-bone">Every vote verified, every result signed.</span>
          <span className="font-mono text-[10px] tracking-wide text-bone-faint">SHA-256 · audited by Deloitte LLP</span>
        </div>
      </div>
    </div>
  );
}

function Cell({
  label,
  v,
  tone,
}: {
  label: string;
  v: string;
  tone?: 'gold' | 'support';
}) {
  const c =
    tone === 'gold' ? 'text-gold' : tone === 'support' ? 'text-support' : 'text-bone';
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className={`font-serif text-[20px] leading-none ${c}`}>{v}</div>
    </div>
  );
}

function Tick({ className = '' }: { className?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="rgba(234,186,88,0.4)"
      strokeWidth="0.8"
      className={className}
      aria-hidden
    >
      <path d="M0 0h4M0 0v4" />
    </svg>
  );
}
