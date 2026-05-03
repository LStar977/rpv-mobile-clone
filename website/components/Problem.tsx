import Image from "next/image";
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

export default function Problem() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="relative mx-auto max-w-[1440px] py-28">
        {/* Right-side bleed image — visually anchors to viewport right edge */}
        <div className="pointer-events-none absolute right-0 top-1/2 hidden w-[58vw] max-w-[1100px] -translate-y-1/2 lg:block">
          <Image
            src="/problem-bars.jpg"
            alt=""
            width={1725}
            height={812}
            priority
            sizes="58vw"
            className="h-auto w-full"
          />
        </div>

        <div className="grid grid-cols-1 gap-16 px-8 lg:grid-cols-2">
          {/* Left column */}
          <div>
            <p className="eyebrow">— The Problem</p>
            <h2 className="mt-6 font-display text-[80px] leading-[0.98]">
              Most public
              <br />
              feedback
              <br />
              <span className="text-gold italic">can&rsquo;t be trusted</span>
              <span className="text-gold">.</span>
            </h2>

            <p className="mt-10 max-w-md text-[16px] leading-relaxed text-white/80">
              Polls, petitions, and surveys are flooded with unverified
              responses. No way to confirm who voted, where they&rsquo;re from,
              or whether it&rsquo;s real.
            </p>

            <div className="mt-16 grid grid-cols-3 gap-8">
              {points.map((p, i) => (
                <div
                  key={p.title}
                  className={`pl-5 ${i !== 0 ? "border-l border-gold/30" : ""}`}
                >
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

          {/* Spacer column on desktop (image is absolutely positioned) */}
          <div className="hidden lg:block" />

          {/* Mobile: render image inline */}
          <div className="relative w-full lg:hidden">
            <Image
              src="/problem-bars.jpg"
              alt=""
              width={1725}
              height={812}
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
