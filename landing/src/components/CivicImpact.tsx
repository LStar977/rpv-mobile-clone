import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Play,
  ShieldCheck,
  MapPin,
  Link2,
  CheckCircle2,
} from "lucide-react";

/* ---------------------------------- slides --------------------------------- */

const slides = [
  {
    key: "proposal",
    tag: "Verified Local Proposal",
    title: "Citizens receive a verified local proposal",
    copy: "Every eligible resident is notified the moment a decision that affects them goes live.",
    Visual: ProposalVisual,
  },
  {
    key: "map",
    tag: "City-Wide Consensus",
    title: "A city-wide map lights up with verified responses",
    copy: "Watch real public will form in real time as verified residents weigh in across districts.",
    Visual: MapVisual,
  },
  {
    key: "audit",
    tag: "Transparent Results",
    title: "Results confirmed with a blockchain audit trail",
    copy: "Outcomes are sealed to a tamper-resistant ledger — public, permanent and verifiable.",
    Visual: AuditVisual,
  },
] as const;

/* --------------------------------- visuals --------------------------------- */

function ProposalVisual() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* floating verified citizen nodes */}
      {[
        { top: "16%", left: "12%", d: 0 },
        { top: "68%", left: "20%", d: 0.4 },
        { top: "24%", left: "82%", d: 0.8 },
        { top: "74%", left: "78%", d: 1.2 },
      ].map((n, i) => (
        <motion.span
          key={i}
          className="absolute flex h-3 w-3 items-center justify-center"
          style={{ top: n.top, left: n.left }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: n.d }}
        >
          <span className="h-3 w-3 rounded-full bg-[#EABA58] shadow-[0_0_14px_3px_rgba(234,186,88,0.7)]" />
        </motion.span>
      ))}

      {/* proposal notification card */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7 }}
        className="relative w-[300px] rounded-2xl border border-[#EABA58]/25 bg-white/[0.04] p-5 backdrop-blur-md"
      >
        <div className="flex items-center gap-2 text-[#EABA58]">
          <ShieldCheck size={16} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">
            Verified Proposal · District 4
          </span>
        </div>
        <p className="mt-3 text-[15px] font-semibold leading-snug text-[#F2F2F0]">
          Should Elm Street become a protected bike corridor?
        </p>
        <div className="mt-4 flex gap-2">
          <span className="flex-1 rounded-lg bg-[#EABA58] py-2 text-center text-[12px] font-bold text-[#040707]">
            Support
          </span>
          <span className="flex-1 rounded-lg border border-white/15 py-2 text-center text-[12px] font-semibold text-[#F2F2F0]/80">
            Oppose
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function MapVisual() {
  const cols = 11;
  const rows = 6;
  const lit = new Set([3, 7, 14, 19, 25, 27, 33, 38, 41, 46, 52, 58, 60]);
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      >
        {Array.from({ length: cols * rows }).map((_, i) => {
          const isLit = lit.has(i);
          return (
            <motion.span
              key={i}
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: isLit ? "#EABA58" : "rgba(242,242,240,0.12)",
                boxShadow: isLit
                  ? "0 0 12px 2px rgba(234,186,88,0.65)"
                  : "none",
              }}
              animate={
                isLit
                  ? { opacity: [0.4, 1, 0.4], scale: [0.85, 1.1, 0.85] }
                  : { opacity: 0.35 }
              }
              transition={
                isLit
                  ? { duration: 2.2, repeat: Infinity, delay: (i % 7) * 0.18 }
                  : {}
              }
            />
          );
        })}
      </div>
      {/* consensus beam */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-[2px] w-[60%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(234,186,88,0.6), transparent)",
        }}
        animate={{ opacity: [0, 0.9, 0], scaleX: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <div className="absolute bottom-4 left-4 flex items-center gap-2 text-[11px] font-semibold text-[#EABA58]">
        <MapPin size={14} /> 12,481 verified responses
      </div>
    </div>
  );
}

function AuditVisual() {
  const bars = [72, 54, 88, 41, 63];
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-7">
      {/* results bars */}
      <div className="flex h-[120px] items-end gap-3">
        {bars.map((h, i) => (
          <motion.span
            key={i}
            className="w-7 rounded-t-md"
            style={{
              background:
                "linear-gradient(180deg, #EABA58, rgba(234,186,88,0.4))",
            }}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.9, delay: i * 0.12, ease: "easeOut" }}
          />
        ))}
      </div>

      {/* blockchain audit chain */}
      <div className="flex items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <motion.span
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#EABA58]/40 bg-[#EABA58]/10"
              animate={{
                boxShadow: [
                  "0 0 0px rgba(234,186,88,0)",
                  "0 0 16px rgba(234,186,88,0.5)",
                  "0 0 0px rgba(234,186,88,0)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            >
              <CheckCircle2 size={16} className="text-[#EABA58]" />
            </motion.span>
            {i < 3 && <Link2 size={14} className="text-[#EABA58]/60" />}
          </div>
        ))}
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#EABA58]/80">
        Audit confirmed · block #482,119
      </span>
    </div>
  );
}

/* --------------------------------- section --------------------------------- */

export default function CivicImpact() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  const go = useCallback((next: number) => {
    setDir(next > 0 ? 1 : -1);
    setIndex((prev) => (prev + next + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setDir(1);
      setIndex((prev) => (prev + 1) % slides.length);
    }, 5200);
    return () => clearInterval(t);
  }, []);

  const slide = slides[index];
  const Visual = slide.Visual;

  return (
    <section id="impact" className="relative flex h-screen w-full items-center">
      <div className="mx-auto w-full max-w-[1440px] px-6 md:px-10">
        <div className="mb-7 max-w-[760px]">
          <span className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[rgba(0,0,0,0.5)]">
            A Voice Beyond the Ballot Box
          </span>
          <h2 className="mt-4 font-heading text-[30px] font-extrabold leading-[1.05] tracking-tight text-[#111111] sm:text-[40px] md:text-[52px]">
            Democracy should not disappear between elections.
          </h2>
        </div>

        {/* cinematic banner */}
        <div
          className="relative overflow-hidden rounded-[28px] border border-white/10"
          style={{
            background:
              "linear-gradient(140deg, #0a0d0e 0%, #040707 55%, #0b0e0f 100%)",
          }}
        >
          {/* ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 60% at 75% 0%, rgba(234,186,88,0.16), rgba(234,186,88,0) 60%)",
            }}
          />

          <div className="relative grid min-h-[380px] grid-cols-1 md:min-h-[420px] md:grid-cols-2">
            {/* copy */}
            <div className="flex flex-col justify-center gap-5 p-8 md:p-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slide.key + "-copy"}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -14 }}
                  transition={{ duration: 0.5 }}
                >
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#EABA58]/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#EABA58]">
                    {slide.tag}
                  </span>
                  <h3 className="mt-4 max-w-[420px] font-heading text-[24px] font-bold leading-tight text-[#F2F2F0] md:text-[30px]">
                    {slide.title}
                  </h3>
                  <p className="mt-3 max-w-[400px] text-[14.5px] leading-relaxed text-[#F2F2F0]/55">
                    {slide.copy}
                  </p>
                </motion.div>
              </AnimatePresence>

              <a
                href="#"
                className="group mt-2 inline-flex w-fit items-center gap-2.5 rounded-full bg-[#EABA58] px-6 py-3 text-[14px] font-bold text-[#040707] transition-transform hover:-translate-y-0.5"
              >
                <Play size={15} fill="#040707" />
                Watch Demo
              </a>
            </div>

            {/* visual stage */}
            <div className="relative min-h-[260px] border-t border-white/10 md:border-l md:border-t-0">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={slide.key + "-vis"}
                  custom={dir}
                  initial={{ opacity: 0, x: dir * 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir * -40 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 p-8"
                >
                  <Visual />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* progress dots */}
          <div className="absolute bottom-6 left-8 flex items-center gap-2 md:left-12">
            {slides.map((s, i) => (
              <button
                key={s.key}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => {
                  setDir(i > index ? 1 : -1);
                  setIndex(i);
                }}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 26 : 10,
                  background:
                    i === index ? "#EABA58" : "rgba(242,242,240,0.25)",
                }}
              />
            ))}
          </div>

          {/* prev / next controls */}
          <div className="absolute bottom-5 right-6 flex items-center gap-2.5">
            <button
              aria-label="Previous slide"
              onClick={() => go(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#F2F2F0] transition-colors hover:border-[#EABA58]/60 hover:text-[#EABA58]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              aria-label="Next slide"
              onClick={() => go(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#F2F2F0] transition-colors hover:border-[#EABA58]/60 hover:text-[#EABA58]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* closing CTA row */}
        <div className="mt-9 flex flex-wrap items-center justify-between gap-5">
          <p className="max-w-[520px] text-[14.5px] leading-relaxed text-[rgba(0,0,0,0.55)]">
            A premium civic operating system where citizens, cities, schools,
            unions, and organizations can finally measure real public will —
            securely and continuously.
          </p>
          <div className="flex flex-wrap gap-3.5">
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full bg-[#040707] px-7 py-3.5 text-[14.5px] font-semibold text-[#F2F2F0] transition-transform hover:-translate-y-0.5"
            >
              Get Verified
            </a>
            <a
              href="#"
              className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-white/40 px-7 py-3.5 text-[14.5px] font-semibold text-[#111111] backdrop-blur transition-colors hover:border-black/40 hover:bg-white/70"
            >
              Request Pilot
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
