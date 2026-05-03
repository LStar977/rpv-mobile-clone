import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Full-width background globe */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/hero-globe.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-right"
        />
        {/* Left-side fade so the headline stays readable on smaller screens */}
        <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-ink via-ink/70 to-transparent lg:w-1/2" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-8 pb-32 pt-24 lg:pt-36">
        <div className="max-w-xl">
          <h1 className="font-display text-[88px] leading-[0.95] tracking-tight">
            <span className="block text-white">Verified</span>
            <span className="block text-gold italic">public</span>
            <span className="block text-white">
              consensus<span className="text-gold">.</span>
            </span>
          </h1>

          <p className="mt-10 max-w-md text-[17px] leading-relaxed text-white/80">
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

        {/* keeps the section tall enough for the globe to breathe */}
        <div className="h-[280px] lg:h-[360px]" aria-hidden />
      </div>
    </section>
  );
}
