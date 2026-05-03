import { Container } from './Container';

export function Calgary() {
  return (
    <section
      id="calgary"
      className="relative border-y border-bone/[0.08] bg-ink-900/60 py-24 md:py-32"
    >
      {/* Crisp gold rule at top + bottom */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
      />

      <Container>
        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          {/* Sidebar — meta */}
          <div className="lg:sticky lg:top-24">
            <div className="eyebrow-gold mb-4">CASE · CALGARY</div>
            <h2 className="font-serif text-4xl leading-[1.05] tracking-crunch md:text-[52px]">
              The 17 Avenue
              <br />
              transit vote.
            </h2>
            <p className="mt-6 max-w-[42ch] text-[14.5px] leading-relaxed text-bone-muted">
              Council needed real numbers, not a town hall full of the loudest twelve people. They put the question on Represent and let every verified Calgarian weigh in.
            </p>

            <dl className="mt-10 grid grid-cols-2 gap-y-5 gap-x-6 border-t border-bone/[0.08] pt-8">
              <Meta l="Vote ran" v="14 days" />
              <Meta l="Eligible" v="121,050" />
              <Meta l="Cast" v="50,464" />
              <Meta l="Turnout" v="41.7%" tone="gold" />
              <Meta l="Result" v="Passed" tone="support" />
              <Meta l="Margin" v="14.2 pts" />
            </dl>
          </div>

          {/* Quote card */}
          <div className="relative">
            <span
              aria-hidden
              className="absolute -left-2 -top-3 font-serif text-[160px] leading-none text-gold/15 md:-left-6 md:-top-8 md:text-[220px]"
            >
              "
            </span>
            <blockquote className="relative font-serif text-[26px] italic leading-[1.32] tracking-tightish text-bone md:text-[34px]">
              We've run open houses for fifteen years. We thought we knew what people wanted. Represent told us — in two weeks — that we were wrong about almost half of it. The data was specific enough that we could actually <em className="not-italic text-gold">do</em> something with it.
            </blockquote>

            <div className="mt-10 flex items-center gap-4 border-t border-bone/[0.08] pt-6">
              <div className="grid h-12 w-12 place-items-center rounded-full border border-gold/30 bg-gold-tint font-serif text-[16px] text-gold">
                EN
              </div>
              <div>
                <div className="text-[14.5px] font-medium text-bone">
                  Eleanor Nakamura
                </div>
                <div className="text-[12.5px] text-bone-muted">
                  Director · Strategic Communications, City of Calgary
                </div>
              </div>
              <a
                href="#"
                className="ml-auto hidden text-[12.5px] text-bone-muted transition-colors hover:text-gold md:inline-flex md:items-center md:gap-2"
              >
                Read the case study
                <span aria-hidden>→</span>
              </a>
            </div>
          </div>
        </div>
      </Container>

      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
      />
    </section>
  );
}

function Meta({
  l,
  v,
  tone,
}: {
  l: string;
  v: string;
  tone?: 'gold' | 'support';
}) {
  const c =
    tone === 'gold' ? 'text-gold' : tone === 'support' ? 'text-support' : 'text-bone';
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-eyebrow text-bone-faint">
        {l}
      </dt>
      <dd className={`mt-1.5 font-serif text-[22px] leading-none ${c}`}>{v}</dd>
    </div>
  );
}
