import { Bot, Users, FileText } from "lucide-react";

const points = [
  {
    icon: Bot,
    title: "Bots & Duplicates",
    body: "Automated and duplicate submissions distort results at scale.",
  },
  {
    icon: Users,
    title: "Bad Sampling",
    body: "Self-selected and unrepresentative responses mislead decision makers.",
  },
  {
    icon: FileText,
    title: "No Audit Trail",
    body: "No verifiable record. No transparency. No accountability.",
  },
];

const bars = [
  { label: "72%", width: "72%" },
  { label: "58%", width: "58%" },
  { label: "41%", width: "41%" },
  { label: "67%", width: "67%" },
  { label: "39%", width: "39%" },
];

export default function Problem() {
  return (
    <section className="relative">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-16 px-8 py-28 lg:grid-cols-2">
        <div>
          <p className="eyebrow">— The Problem</p>
          <h2 className="mt-6 font-display text-[72px] leading-[0.98]">
            Most public
            <br />
            feedback
            <br />
            <span className="text-gold italic">can&rsquo;t be trusted</span>
            <span className="text-gold">.</span>
          </h2>

          <p className="mt-10 max-w-md text-[16px] leading-relaxed text-white/75">
            Polls, petitions, and surveys are flooded with unverified responses.
            No way to confirm who voted, where they&rsquo;re from, or whether
            it&rsquo;s real.
          </p>

          <div className="mt-14 grid grid-cols-3 gap-8">
            {points.map((p) => (
              <div key={p.title} className="border-l border-gold/30 pl-5">
                <p.icon className="h-7 w-7 text-gold" strokeWidth={1.4} />
                <p className="mt-5 text-[11px] font-semibold tracking-wider2 text-gold">
                  {p.title.toUpperCase()}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: visual + caption pair */}
        <div className="flex flex-col justify-between gap-10">
          <div>
            <p className="text-[11px] font-semibold tracking-wider2 text-white/60">
              NOISY, UNVERIFIED INPUT
            </p>
            <div className="mt-8 space-y-6">
              {bars.map((b) => (
                <div key={b.label} className="flex items-center gap-6">
                  <span className="w-10 text-sm text-white/60">{b.label}</span>
                  <div className="relative h-3 flex-1">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: b.width,
                        background:
                          "linear-gradient(90deg, rgba(229,185,92,0.55) 0%, rgba(229,185,92,0.25) 70%, rgba(229,185,92,0) 100%)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold tracking-wider2 text-gold">
              VERIFIED. GEOGATED. TRUSTWORTHY.
            </p>
            <div className="mt-3 h-px w-full bg-gradient-to-r from-gold/0 via-gold/80 to-gold/0" />
            <div className="mt-12 flex justify-end">
              <div className="text-right">
                <p className="text-[11px] font-semibold tracking-wider2 text-gold">
                  CLEAN SIGNAL.
                </p>
                <p className="text-[11px] font-semibold tracking-wider2 text-gold">
                  REAL REPRESENTATION.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
