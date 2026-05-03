import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Globe — contained on the right ~65% so the full sphere is visible */}
      <div className="pointer-events-none absolute inset-y-0 right-0 z-0 w-full lg:w-[65%]">
        <Image
          src="/hero-globe.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 65vw, 100vw"
          className="object-contain object-right"
        />
        {/* Soft black-to-transparent fade so the headline reads cleanly */}
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-ink via-ink/80 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1440px] px-8 pt-24 lg:pt-32">
        <div className="max-w-xl pb-32 lg:pb-48">
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

        {/* Reserves vertical space so the globe has room to breathe on tall screens */}
        <div className="hidden h-[120px] lg:block" aria-hidden />
      </div>
    </section>
  );
}
