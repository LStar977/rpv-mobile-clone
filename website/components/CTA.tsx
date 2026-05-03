import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section id="demo" className="relative overflow-hidden">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="mx-auto grid max-w-[1440px] grid-cols-1 items-center gap-10 px-8 py-28 lg:grid-cols-2">
        <div>
          <p className="eyebrow">READY TO GET STARTED?</p>
          <h2 className="mt-8 font-display text-[80px] leading-[0.98]">
            Bring <span className="text-gold italic">verified</span> voice
            <br />
            to every decision<span className="text-gold">.</span>
          </h2>

          <p className="mt-10 max-w-md text-[16px] leading-relaxed text-white/75">
            Join institutions and communities building a more trusted
            future—together.
          </p>

          <div className="mt-12 flex items-center gap-8">
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

        {/* Visual asset slot — golden wave */}
        <div className="relative h-[420px] w-full">
          <div className="asset-placeholder absolute inset-0" aria-hidden />
        </div>
      </div>
    </section>
  );
}
