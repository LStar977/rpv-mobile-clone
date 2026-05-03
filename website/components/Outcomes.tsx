import { ShieldCheck, Users, Zap } from "lucide-react";

const outcomes = [
  {
    icon: ShieldCheck,
    title: "Higher Trust",
    body: "Identity-verified participation ensures legitimacy and strengthens public trust.",
  },
  {
    icon: Users,
    title: "Better Participation",
    body: "Accessible, inclusive, and secure engagement that reflects the people you serve.",
  },
  {
    icon: Zap,
    title: "Faster Decisions",
    body: "Clear consensus, surfaced faster — so leaders can move with confidence.",
  },
];

export default function Outcomes() {
  return (
    <section className="relative">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="mx-auto max-w-[1440px] px-8 py-28">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <p className="eyebrow">OUTCOMES / IMPACT</p>
            <div className="mt-3 h-px w-16 bg-gold/60" />
            <h2 className="mt-10 font-display text-[80px] leading-[0.98]">
              From opinion to
              <br />
              <span className="text-gold italic">accountable action</span>
              <span className="text-gold">.</span>
            </h2>
            <p className="mt-10 max-w-lg text-[15px] leading-relaxed text-white/75">
              Represent Vote turns diverse input into verified consensus—so
              institutions and communities can decide with confidence and act
              with clarity.
            </p>
          </div>

          {/* Visual asset slot — convergence beams */}
          <div className="relative h-[360px] w-full">
            <div className="asset-placeholder absolute inset-0" aria-hidden />
            <div className="absolute bottom-6 right-6 max-w-[220px] text-right">
              <p className="text-[11px] font-semibold tracking-wider2 text-gold">
                VERIFIED CONSENSUS
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-white/80">
                Clear signal. Strong mandate. Confident action.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-12 md:grid-cols-3">
          {outcomes.map((o, i) => (
            <div
              key={o.title}
              className={`flex items-start gap-6 ${
                i !== outcomes.length - 1 ? "md:border-r md:border-white/10 md:pr-12" : ""
              }`}
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-gold/40">
                <o.icon className="h-7 w-7 text-gold" strokeWidth={1.3} />
              </div>
              <div>
                <h3 className="font-display text-[28px] leading-tight text-white">
                  {o.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-white/70">
                  {o.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 flex items-center gap-4">
          <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_2px_rgba(229,185,92,0.6)]" />
          <span className="h-px flex-1 bg-gold/40" />
          <p className="px-6 text-[12px] font-semibold tracking-wider2 text-gold">
            VERIFIED INPUT. CLEAR INSIGHT. ACCOUNTABLE OUTCOMES.
          </p>
          <span className="h-px flex-1 bg-gold/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_12px_2px_rgba(229,185,92,0.6)]" />
        </div>
      </div>
    </section>
  );
}
