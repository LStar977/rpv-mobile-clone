import { Fingerprint, MapPin, FilePlus2, BarChart3 } from "lucide-react";

const steps = [
  { n: 1, icon: Fingerprint, title: "Verify Identity" },
  { n: 2, icon: MapPin, title: "Confirm Place\nor Membership" },
  { n: 3, icon: FilePlus2, title: "Launch or Join\na Proposal" },
  { n: 4, icon: BarChart3, title: "Vote and View\nLive Results" },
];

export default function HowItWorks() {
  return (
    <section className="relative">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="mx-auto max-w-[1440px] px-8 py-28">
        <div className="max-w-2xl">
          <p className="eyebrow">H O W &nbsp; I T &nbsp; W O R K S</p>
          <h2 className="mt-6 font-display text-[80px] leading-[0.98]">
            How it <span className="text-gold italic">works</span>
          </h2>
          <p className="mt-8 text-[16px] text-white/75">
            Represent turns verified people into{" "}
            <span className="text-gold">verified consensus</span>.
          </p>
        </div>

        <div className="relative mt-20">
          {/* connecting hairline */}
          <div className="absolute left-[8%] right-[8%] top-1/2 hidden h-px bg-gradient-to-r from-gold/0 via-gold/40 to-gold/0 md:block" />

          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-4">
            {steps.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl border border-white/10 bg-white/[0.02] px-8 pb-10 pt-8 transition hover:border-gold/40"
              >
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 text-sm text-gold">
                  {s.n}
                </div>
                <div className="mt-10 flex justify-center">
                  <s.icon className="h-12 w-12 text-gold" strokeWidth={1.2} />
                </div>
                <p className="mt-12 whitespace-pre-line text-center text-[18px] leading-snug text-white">
                  {s.title}
                </p>
                <div className="mx-auto mt-6 h-px w-10 bg-gold/60" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex items-center justify-center gap-4 text-gold">
          <span className="h-px w-32 bg-gold/40" />
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z"
              stroke="#E5B95C"
              strokeWidth="1.4"
            />
          </svg>
          <span className="h-px w-32 bg-gold/40" />
        </div>
      </div>
    </section>
  );
}
