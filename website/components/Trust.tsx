import { UserRound, Globe2, ShieldCheck } from "lucide-react";

const items = [
  {
    icon: UserRound,
    title: "One Person, One Vote",
    body: "Each verified individual gets one vote — and only one.",
  },
  {
    icon: Globe2,
    title: "Verified Geography or Membership",
    body: "Eligibility is confirmed through trusted data and institutional rules.",
  },
  {
    icon: ShieldCheck,
    title: "Cryptographic Audit Trail",
    body: "Every vote is cryptographically signed, timestamped, and verifiable.",
  },
];

export default function Trust() {
  return (
    <section className="relative">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-12 px-8 py-28 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-[80px] leading-[0.98]">
            <span className="text-gold italic">Trust,</span>
            <br />
            built into
            <br />
            every vote<span className="text-gold">.</span>
          </h2>

          <div className="mt-16 max-w-xl">
            {items.map((it, i) => (
              <div
                key={it.title}
                className={`flex items-start gap-7 py-7 ${
                  i !== items.length - 1 ? "border-b border-white/10" : ""
                }`}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-gold/40">
                  <it.icon className="h-6 w-6 text-gold" strokeWidth={1.4} />
                </div>
                <div>
                  <h3 className="text-[18px] font-medium text-white">
                    {it.title}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/65">
                    {it.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual asset slot — verified credential card */}
        <div className="relative h-[640px] w-full">
          <div className="asset-placeholder absolute inset-0" aria-hidden />
        </div>
      </div>
    </section>
  );
}
