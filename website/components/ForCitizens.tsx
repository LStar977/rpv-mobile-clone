import { Container } from './Container';

const FEATURES = [
  {
    title: 'Only what you can act on.',
    body: "We don't surface noise from places you can't vote. Federal proposals if you're Canadian. Provincial if you're in Alberta. Municipal if you live in the city. Everything else stays out of your way.",
  },
  {
    title: 'A vote takes under a minute.',
    body: 'Swipe through the dossier. Read the plain-language summary. Cast support or oppose. The receipt lands before you put your phone down.',
  },
  {
    title: 'No ads. No tracking. No selling you out.',
    body: 'Free for citizens, forever. We make money from cities — not from your data. Your ID document is processed and discarded; only the proof of residence stays.',
  },
  {
    title: 'See what your neighbours think.',
    body: 'Anonymized vote tallies update in real time. Read public comments from verified residents. Spot the trend lines before the result lands.',
  },
];

export function ForCitizens() {
  return (
    <section id="citizens" className="relative py-24 md:py-32">
      <Container>
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-[1.1fr_1fr] lg:gap-24">
          {/* Phone showcase — staggered stack */}
          <div className="relative order-2 lg:order-1">
            <PhoneStack />
          </div>

          {/* Copy + features */}
          <div className="order-1 max-w-[560px] lg:order-2">
            <div className="eyebrow-gold mb-4">FOR CITIZENS</div>
            <h2 className="font-serif text-4xl leading-[1.05] tracking-crunch md:text-[56px]">
              Civic life,
              <br />
              <em className="not-italic text-gold">in your pocket.</em>
            </h2>
            <p className="mt-6 max-w-[55ch] text-[16px] leading-relaxed text-bone-muted">
              Represent's mobile app gives you a direct line to the decisions that shape your city, your province, your country. Verified once, useful for years.
            </p>

            <div className="mt-10 divide-y divide-bone/[0.08] border-y border-bone/[0.08]">
              {FEATURES.map((f) => (
                <div key={f.title} className="flex flex-col gap-2 py-5">
                  <h3 className="font-serif text-[20px] leading-[1.2] tracking-tightish">
                    {f.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed text-bone-muted">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <AppStoreButton store="apple" />
              <AppStoreButton store="google" />
              <span className="ml-1 font-mono text-[10.5px] tracking-eyebrow text-bone-faint">
                FREE · NO IN-APP PURCHASES REQUIRED
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function PhoneStack() {
  return (
    <div className="relative mx-auto aspect-[10/12] max-w-[520px]">
      {/* Back phone */}
      <PhoneFrame
        src="/screenshots/phone-receipt.png"
        className="absolute left-0 top-8 w-[48%] -rotate-[6deg] opacity-90"
      />
      {/* Mid phone */}
      <PhoneFrame
        src="/screenshots/phone-vote.png"
        className="absolute right-2 top-2 w-[52%] rotate-[3deg]"
      />
      {/* Front phone — hero */}
      <PhoneFrame
        src="/screenshots/phone-home.png"
        className="absolute bottom-0 left-1/2 w-[58%] -translate-x-1/2"
        front
      />
    </div>
  );
}

function PhoneFrame({
  src,
  className = '',
  front = false,
}: {
  src: string;
  className?: string;
  front?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[34px] border border-bone/[0.10] bg-ink-850 ${
        front ? 'shadow-[0_40px_80px_-30px_rgba(234,186,88,0.18)]' : 'shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)]'
      } ${className}`}
      style={{ aspectRatio: '9 / 19.5' }}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-2 z-10 h-1.5 w-12 -translate-x-1/2 rounded-full bg-ink-700"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover object-top"
        loading="lazy"
      />
    </div>
  );
}

function AppStoreButton({ store }: { store: 'apple' | 'google' }) {
  const isApple = store === 'apple';
  return (
    <a
      href="#"
      className="inline-flex items-center gap-3 rounded-xl border border-bone/[0.16] bg-bone/[0.04] px-4 py-2.5 transition-colors hover:border-bone/30 active:translate-y-[1px]"
    >
      <span className="grid h-7 w-7 place-items-center text-bone">
        {isApple ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M16.365 1.43c0 1.14-.42 2.21-1.13 3.02-.85.97-2.24 1.69-3.39 1.6-.13-1.1.41-2.27 1.13-3.04.84-.92 2.27-1.6 3.39-1.58Zm3.78 17.55c-.66 1.45-.98 2.1-1.83 3.39-1.18 1.81-2.85 4.07-4.92 4.09-1.85.02-2.32-1.21-4.83-1.2-2.51.02-3.03 1.22-4.88 1.2-2.07-.03-3.65-2.06-4.83-3.86C-3.51 16.16-2.83 7.66 1.5 5.04c1.34-.81 2.78-1.25 4.06-1.27 1.92-.04 3.73 1.3 4.83 1.3 1.1 0 3.31-1.6 5.58-1.37.95.04 3.62.39 5.34 2.92-.14.09-3.18 1.85-3.15 5.5.04 4.36 3.84 5.81 3.88 5.83Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <path d="M3.6 1.6a2 2 0 0 0-1 1.7v17.4a2 2 0 0 0 1 1.7l9.7-10.4L3.6 1.6Zm10.7 11.5L17 16l3.4-2c1.1-.7 1.1-2.4 0-3l-3.4-2-2.7 4.1Zm-1 .8L4.6 22.5a1.6 1.6 0 0 0 1.5 0l9.6-5.6-2.4-3.1Zm0-3.8 2.4-3.1L6 1.5a1.6 1.6 0 0 0-1.5 0l8.7 8.6Z" />
          </svg>
        )}
      </span>
      <span className="flex flex-col text-left leading-tight">
        <span className="text-[10px] uppercase tracking-eyebrow text-bone-faint">
          {isApple ? 'Download on the' : 'Get it on'}
        </span>
        <span className="text-[14px] font-medium text-bone">
          {isApple ? 'App Store' : 'Google Play'}
        </span>
      </span>
    </a>
  );
}
