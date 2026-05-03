import { Landmark, GraduationCap, Users, Briefcase } from "lucide-react";

type Card = {
  icon: typeof Landmark;
  title: string;
  body: string;
  span?: "lg" | "sm";
};

const cards: Card[] = [
  {
    icon: Landmark,
    title: "Municipalities",
    body: "Verified resident feedback.",
    span: "lg",
  },
  {
    icon: GraduationCap,
    title: "Schools",
    body: "Student voice.",
  },
  {
    icon: Users,
    title: "Unions",
    body: "Member decisions.",
  },
  {
    icon: Briefcase,
    title: "Enterprises",
    body: "Workforce consensus.",
  },
];

function UseCard({ card }: { card: Card }) {
  return (
    <div className="group relative flex h-full min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition hover:border-gold/40">
      <div className="absolute inset-0 asset-placeholder rounded-2xl opacity-40" aria-hidden />
      <div className="relative">
        <card.icon className="h-7 w-7 text-gold" strokeWidth={1.4} />
        <h3 className="mt-6 font-display text-[44px] leading-none text-white">
          {card.title}
        </h3>
        <p className="mt-3 text-[14px] text-gold">{card.body}</p>
      </div>
    </div>
  );
}

export default function UseCases() {
  return (
    <section id="solutions" className="relative">
      <div className="mx-auto h-px max-w-[1440px] bg-white/10" />
      <div className="mx-auto max-w-[1440px] px-8 py-28">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <p className="eyebrow text-gold">Use Cases / Solutions</p>
            <h2 className="mt-6 font-display text-[64px] leading-[0.98]">
              For the institutions
              <br />
              that need
              <br />
              <span className="text-gold italic">real answers</span>
              <span className="text-gold">.</span>
            </h2>
            <p className="mt-8 max-w-md text-[15px] leading-relaxed text-white/70">
              Identity-verified, secure voting infrastructure designed for every
              community and organization.
            </p>
          </div>

          <UseCard card={cards[0]} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {cards.slice(1).map((c) => (
            <UseCard key={c.title} card={c} />
          ))}
        </div>
      </div>
    </section>
  );
}
