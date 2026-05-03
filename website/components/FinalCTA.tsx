import { Container } from './Container';

export function FinalCTA() {
  return (
    <section className="relative py-24 md:py-32">
      {/* Faint gold halo behind the band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(234,186,88,0.10), transparent 65%)',
        }}
      />

      <Container>
        <div className="mx-auto max-w-[860px] text-center">
          <div className="eyebrow-gold mb-5">THE BENCH IS IN SESSION</div>
          <h2 className="font-serif text-5xl leading-[1.02] tracking-crunch md:text-[80px] md:leading-[0.96]">
            Whichever side
            <br />
            of the desk you're on,
            <br />
            <em className="not-italic text-gold">we're ready.</em>
          </h2>

          <div className="mt-12 grid gap-3 sm:grid-cols-2">
            <a
              href="#download"
              className="rounded-2xl bg-gold px-6 py-5 text-center transition-transform active:translate-y-[1px]"
            >
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-ink/70">
                FREE · iOS + ANDROID
              </div>
              <div className="mt-1 text-[18px] font-medium text-ink">
                Get the app
              </div>
            </a>
            <a
              href="mailto:hello@representvote.com?subject=Civic%20Desk%20demo%20request"
              className="rounded-2xl border border-bone/[0.16] bg-bone/[0.02] px-6 py-5 text-center transition-colors hover:border-bone/30 hover:bg-bone/[0.04] active:translate-y-[1px]"
            >
              <div className="font-mono text-[10px] uppercase tracking-eyebrow text-bone-faint">
                30-MIN WALKTHROUGH
              </div>
              <div className="mt-1 text-[18px] font-medium text-bone">
                Book a demo
              </div>
            </a>
          </div>

          <p className="mt-10 text-[12.5px] text-bone-faint">
            Or just write us — <a href="mailto:hello@representvote.com" className="text-bone-muted underline decoration-bone/20 underline-offset-4 hover:decoration-gold/60">hello@representvote.com</a>
          </p>
        </div>
      </Container>
    </section>
  );
}
