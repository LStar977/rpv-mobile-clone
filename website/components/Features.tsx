import Link from "next/link";
import {
  Fingerprint,
  MapPin,
  Building2,
  BarChart3,
  Lock,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Identity Verification",
    body: "Cryptographically verified identities ensure one person, one vote.",
  },
  {
    icon: MapPin,
    title: "Geo-Gated Voting",
    body: "Location-aware access ensures votes are cast where they're valid.",
  },
  {
    icon: Building2,
    title: "Organization Gating",
    body: "Restrict participation to verified members and authorized groups.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Results",
    body: "Live, transparent results with instant updates you can trust.",
  },
  {
    icon: Lock,
    title: "Tamper-Resistant Records",
    body: "Immutable records secured by advanced cryptography and distributed infrastructure.",
  },
];

export default function Features() {
  return (
    <section id="platform" className="relative">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-12 px-8 py-28 lg:grid-cols-[1fr_1fr_1fr]">
        {/* Left column */}
        <div>
          <p className="eyebrow">— Platform Features</p>
          <h2 className="mt-6 font-display text-[64px] leading-[0.98]">
            Built for
            <br />
            <span className="text-gold italic">trusted</span>
            <br />
            participation<span className="text-gold">.</span>
          </h2>
          <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-white/70">
            Every layer of Represent Vote is designed to ensure only verified
            voices shape the outcome.
          </p>
          <Link
            href="#platform"
            className="mt-10 inline-flex items-center gap-3 rounded-md border border-gold/60 px-5 py-3 text-[14px] text-gold transition hover:bg-gold hover:text-ink"
          >
            Explore Platform
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Center: visual asset slot — orbital rings */}
        <div className="relative hidden h-[560px] w-full lg:block">
          <div className="asset-placeholder absolute inset-0 rounded-full" aria-hidden />
        </div>

        {/* Right column features list */}
        <div className="flex flex-col">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={`flex items-start gap-5 py-5 ${
                i !== features.length - 1 ? "border-b border-white/10" : ""
              }`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/40">
                <f.icon className="h-5 w-5 text-gold" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-gold">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                  {f.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
