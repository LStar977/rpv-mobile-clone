// Stub for the scroll-driven space → city sequence.
// Full GSAP/ScrollTrigger choreography lands in the next iteration —
// this section is here so the page has somewhere to scroll to and
// the visual rhythm is in place. Each stage is currently a static panel.

const stages = [
  {
    eyebrow: 'Stage 1 · Space',
    title: 'A planet of voices.',
    body:
      'Every gold dot is a place where a verified citizen lives. ' +
      'No bots. No bought signatures. Just people, located.',
  },
  {
    eyebrow: 'Stage 2 · Country',
    title: 'Borders that mean something.',
    body:
      'Proposals can be opened to a country, a province, a city, or a single electoral riding. ' +
      'Identity and address are checked once — privately — then never asked again.',
  },
  {
    eyebrow: 'Stage 3 · Riding',
    title: 'Your riding. Your ballot.',
    body:
      'When a vote opens in Calgary-Buffalo, only verified residents of Calgary-Buffalo can cast it. ' +
      'The result is final, public, and yours to share.',
  },
];

export function ScrollTeaser() {
  return (
    <section id="how" className="relative bg-bg py-32 md:py-48">
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gold">How it works</p>
        <h2 className="font-serif text-4xl leading-[1.05] tracking-tightest text-cream md:text-6xl">
          From a planet, to your block.
        </h2>
        <p className="mt-4 max-w-2xl text-cream/60">
          Most platforms ask the wrong question — &ldquo;who&apos;s loudest?&rdquo; We ask
          &ldquo;who actually lives here?&rdquo; The difference is the entire product.
        </p>

        <div className="mt-24 space-y-32">
          {stages.map((stage, i) => (
            <article
              key={stage.eyebrow}
              className="grid items-center gap-10 md:grid-cols-2 md:gap-16"
            >
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <p className="mb-3 text-xs uppercase tracking-[0.25em] text-gold/80">
                  {stage.eyebrow}
                </p>
                <h3 className="font-serif text-3xl leading-tight tracking-tightest text-cream md:text-5xl">
                  {stage.title}
                </h3>
                <p className="mt-4 text-cream/60">{stage.body}</p>
              </div>
              <div
                className={
                  'aspect-square rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/5 to-transparent ' +
                  (i % 2 === 1 ? 'md:order-1' : '')
                }
              >
                {/* Placeholder for the per-stage 3D scene */}
                <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.25em] text-cream/30">
                  Scene {i + 1}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
