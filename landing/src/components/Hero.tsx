import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex h-screen w-full items-center"
    >
      <div className="mx-auto w-full max-w-[1440px] px-6 md:px-10">
        <div className="max-w-[680px]">
          <motion.div
            custom={0}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-black/15 bg-white/50 px-3.5 py-1.5 backdrop-blur"
          >
            <ShieldCheck size={14} className="text-[#040707]" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(0,0,0,0.62)]">
              Verified Civic Engagement
            </span>
          </motion.div>

          <motion.h1
            custom={1}
            variants={fade}
            initial="hidden"
            animate="show"
            className="font-heading text-[15vw] font-extrabold leading-[0.92] tracking-tightest text-[#111111] sm:text-[10vw] md:text-[7.5vw] lg:text-[96px]"
          >
            One Person.
            <br />
            One Voice.
            <br />
            <span className="relative inline-block">
              Verified.
              <span className="absolute -bottom-1 left-0 h-[10px] w-full bg-[#EABA58]/55" />
            </span>
          </motion.h1>

          <motion.p
            custom={2}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-8 max-w-[540px] text-[16px] leading-relaxed text-[rgba(0,0,0,0.55)] md:text-[17px]"
          >
            Represent Vote gives citizens a secure, verified way to participate
            in public decisions between elections — while giving institutions a
            trusted way to hear from the people they represent.
          </motion.p>

          <motion.div
            custom={3}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-10 flex flex-wrap items-center gap-3.5"
          >
            <a
              href="#"
              className="group inline-flex items-center gap-2 rounded-full bg-[#040707] px-7 py-3.5 text-[14.5px] font-semibold text-[#F2F2F0] shadow-[0_18px_40px_-16px_rgba(4,7,7,0.8)] transition-transform hover:-translate-y-0.5"
            >
              Get Verified
              <ArrowRight
                size={17}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-white/40 px-7 py-3.5 text-[14.5px] font-semibold text-[#111111] backdrop-blur transition-colors hover:border-black/40 hover:bg-white/70"
            >
              See How It Works
            </a>
          </motion.div>

          <motion.div
            custom={4}
            variants={fade}
            initial="hidden"
            animate="show"
            className="mt-12 flex items-center gap-6 text-[12.5px] font-medium text-[rgba(0,0,0,0.5)]"
          >
            <span>Government-ID verified</span>
            <span className="h-1 w-1 rounded-full bg-black/25" />
            <span>Geo-gated &amp; anonymous</span>
            <span className="h-1 w-1 rounded-full bg-black/25" />
            <span>Tamper-resistant</span>
          </motion.div>
        </div>
      </div>

      {/* scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.8 }}
        className="absolute bottom-7 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgba(0,0,0,0.4)]"
      >
        Scroll
      </motion.div>
    </section>
  );
}
