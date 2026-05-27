import { motion } from "framer-motion";
import { BadgeCheck, MapPin, BarChart3, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: BadgeCheck,
    title: "Verify once with government ID",
    body: "A one-time identity check confirms every participant is a real, eligible person — no bots, no duplicates.",
  },
  {
    icon: MapPin,
    title: "Participate in location-based proposals",
    body: "Geo-gating surfaces the proposals, questions and issues that actually belong to your community.",
  },
  {
    icon: BarChart3,
    title: "View transparent, tamper-resistant results",
    body: "Every response is recorded to an auditable trail, so outcomes are public, verifiable and trusted.",
  },
];

const reveal = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

export default function HowItWorks() {
  return (
    <section
      id="how"
      className="relative flex h-screen w-full items-center"
    >
      <div className="mx-auto w-full max-w-[1440px] px-6 md:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <motion.span
              variants={reveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6 }}
              className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[rgba(0,0,0,0.5)]"
            >
              Verified Civic Participation
            </motion.span>

            <motion.h2
              variants={reveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.7, delay: 0.05 }}
              className="mt-5 font-heading text-[34px] font-extrabold leading-[1.04] tracking-tight text-[#111111] sm:text-[44px] md:text-[58px]"
            >
              Turn public opinion
              <br />
              into{" "}
              <span className="relative inline-block text-[#111111]">
                <span className="relative z-10">verified consensus.</span>
                <span className="absolute -bottom-1 left-0 z-0 h-[12px] w-full bg-[#EABA58]/60" />
              </span>
            </motion.h2>

            <motion.p
              variants={reveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-[rgba(0,0,0,0.55)] md:text-[17px]"
            >
              Represent Vote verifies that every participant is real, local, and
              eligible — then lets people respond to proposals, questions, and
              public issues with secure, auditable results.
            </motion.p>

            <div className="mt-10 space-y-5">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.title}
                    variants={reveal}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.4 }}
                    transition={{ duration: 0.6, delay: 0.12 + i * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <span className="mt-0.5 flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-black/12 bg-white/60 backdrop-blur">
                      <Icon size={19} className="text-[#040707]" strokeWidth={1.9} />
                    </span>
                    <div>
                      <p className="text-[15.5px] font-semibold text-[#111111]">
                        {step.title}
                      </p>
                      <p className="mt-1 max-w-[460px] text-[14px] leading-relaxed text-[rgba(0,0,0,0.55)]">
                        {step.body}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              variants={reveal}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-11 flex flex-wrap items-center gap-3.5"
            >
              <a
                href="#"
                className="group inline-flex items-center gap-2 rounded-full bg-[#040707] px-7 py-3.5 text-[14.5px] font-semibold text-[#F2F2F0] shadow-[0_18px_40px_-16px_rgba(4,7,7,0.8)] transition-transform hover:-translate-y-0.5"
              >
                Start Voting
                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </a>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full border border-black/20 bg-white/40 px-7 py-3.5 text-[14.5px] font-semibold text-[#111111] backdrop-blur transition-colors hover:border-black/40 hover:bg-white/70"
              >
                For Institutions
              </a>
            </motion.div>
          </div>

          {/* Right column intentionally open — the civic cards fan into a
              diagonal ladder here via the scroll-linked overlay. */}
          <div className="hidden lg:col-span-5 lg:block" aria-hidden />
        </div>
      </div>
    </section>
  );
}
