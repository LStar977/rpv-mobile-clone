import { Container } from './Container';

const STEPS = [
  {
    n: '01',
    title: 'Verify once.',
    sub: 'A two-minute ID check on your phone. Government IDs, passports, status cards — Indigenous, provincial, federal. Your data is processed and discarded; only the proof of residence stays.',
    detail: 'On-device biometric · NFC chip read · zero-storage of the document image.',
  },
  {
    n: '02',
    title: "Vote on what's actually in front of council.",
    sub: "Real proposals, written in plain language. Federal, provincial, municipal — only the ones you're eligible to weigh in on. One person, one vote, mathematically.",
    detail: 'Geo-restricted by your verified residence · cannot be re-cast or duplicated.',
  },
  {
    n: '03',
    title: 'Get a receipt. So does the city.',
    sub: 'Every result is signed, time-stamped, and made public the moment voting closes. Cities download an audit-ready report. You get a tamper-proof receipt that says you voted.',
    detail: 'Deloitte-audited yearly · signed records on Base · public after closing.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative py-24 md:py-32">
      <Container>
        <div className="mb-14 max-w-[640px] md:mb-20">
          <div className="eyebrow mb-4">HOW IT WORKS</div>
          <h2 className="font-serif text-4xl leading-[1.05] tracking-crunch md:text-[56px]">
            Three steps. Then your voice
            <br className="hidden md:block" />{' '}
            <em className="not-italic text-gold">is on the record.</em>
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-[24px] border border-bone/[0.08] bg-bone/[0.04] md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="relative flex flex-col gap-6 bg-ink-850 p-7 md:p-9"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] tracking-eyebrow text-gold">
                  STEP {s.n}
                </span>
                <span className="font-serif text-[40px] leading-none text-bone/[0.08] md:text-[56px]">
                  {s.n}
                </span>
              </div>

              <h3 className="font-serif text-[26px] leading-[1.1] tracking-tightish md:text-[28px]">
                {s.title}
              </h3>

              <p className="text-[14.5px] leading-relaxed text-bone-muted">
                {s.sub}
              </p>

              <div className="mt-auto border-t border-bone/[0.08] pt-5">
                <div className="font-mono text-[10.5px] leading-relaxed tracking-wide text-bone-faint">
                  {s.detail}
                </div>
              </div>

              {/* Connector line on desktop between cards */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute right-0 top-1/2 hidden h-px w-12 -translate-y-1/2 translate-x-1/2 bg-gold/30 md:block"
                />
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
