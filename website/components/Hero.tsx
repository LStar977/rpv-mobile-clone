import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-8 pb-28 pt-24 lg:grid-cols-2 lg:pt-32">
        <div className="relative z-10">
          <h1 className="font-display text-[88px] leading-[0.95] tracking-tight">
            <span className="block text-white">Verified</span>
            <span className="block text-gold italic">public</span>
            <span className="block text-white">
              consensus<span className="text-gold">.</span>
            </span>
          </h1>

          <p className="mt-10 max-w-md text-[17px] leading-relaxed text-white/75">
            Identity-verified, geo-gated voting infrastructure for institutions
            and communities.
          </p>

          <div className="mt-10 flex items-center gap-8">
            <Link
              href="#demo"
              className="inline-flex items-center gap-3 rounded-md bg-gold px-6 py-4 text-[15px] font-medium text-ink transition hover:bg-gold-light"
            >
              Request a Demo
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="#platform"
              className="group inline-flex items-center gap-3 border-b border-gold/70 pb-1 text-[15px] text-gold transition hover:border-gold"
            >
              Explore Platform
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Visual asset slot — globe */}
        <div className="relative h-[520px] w-full lg:h-[640px]">
          <div className="asset-placeholder absolute inset-0" aria-hidden />
        </div>
      </div>
    </section>
  );
}
