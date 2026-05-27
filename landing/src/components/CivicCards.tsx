import { motion, useTransform, type MotionValue } from "framer-motion";
import { ShieldCheck } from "lucide-react";
import { cards, type CivicCard } from "../data/cards";

const N = cards.length; // 7
const MID = (N - 1) / 2; // 3

/**
 * Scroll keyframes (shared across every card):
 *   0.00–0.16  fan formation across the hero
 *   0.16–0.32  collapse into a centered, descending stack
 *   0.32–0.48  fan out into a diagonal ladder on the right of Section 2
 *   0.48–0.68  hold the ladder while Section 2 is read
 *   0.68–0.86  scale + fade away as Section 3 banner takes over
 */
const RANGE = [0, 0.16, 0.32, 0.48, 0.68, 0.86];

function CardItem({
  card,
  i,
  progress,
}: {
  card: CivicCard;
  i: number;
  progress: MotionValue<number>;
}) {
  const offset = i - MID; // -3 .. 3

  // Fan formation (centred a touch right + lower so hero copy stays clear)
  const fanX = 150 + offset * 104;
  const fanY = 70 + Math.abs(offset) * 30;
  const fanRot = offset * 8;

  // Centred descending stack
  const stackX = offset * 4;
  const stackY = 150;
  const stackRot = offset * 1.5;

  // Diagonal ladder on the right side of Section 2
  const ladderX = 250 + i * 26;
  const ladderY = -176 + i * 60;
  const ladderRot = -8 + i * 1.4;

  const x = useTransform(progress, RANGE, [
    fanX,
    fanX,
    stackX,
    ladderX,
    ladderX,
    ladderX + 70,
  ]);
  const y = useTransform(progress, RANGE, [
    fanY,
    fanY,
    stackY,
    ladderY,
    ladderY,
    ladderY - 60,
  ]);
  const rotate = useTransform(progress, RANGE, [
    fanRot,
    fanRot,
    stackRot,
    ladderRot,
    ladderRot,
    ladderRot,
  ]);
  const scale = useTransform(progress, RANGE, [1, 1, 0.92, 0.86, 0.86, 0.6]);
  const opacity = useTransform(progress, RANGE, [1, 1, 1, 1, 1, 0]);

  const Icon = card.icon;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{
        x,
        y,
        rotate,
        scale,
        opacity,
        zIndex: 10 + i,
        translateX: "-50%",
        translateY: "-50%",
      }}
    >
      <div
        className="relative w-[168px] overflow-hidden rounded-[20px] border border-[#EABA58]/25 p-4 shadow-[0_24px_60px_-24px_rgba(4,7,7,0.7)] backdrop-blur-sm"
        style={{
          background:
            "linear-gradient(160deg, #0b0e0f 0%, #040707 60%, #07090a 100%)",
        }}
      >
        {/* gold edge glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[20px]"
          style={{
            background:
              "radial-gradient(120% 60% at 80% -10%, rgba(234,186,88,0.22), rgba(234,186,88,0) 60%)",
          }}
        />

        <div className="relative flex items-center justify-between">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#EABA58]/30"
            style={{ background: "rgba(234,186,88,0.10)" }}
          >
            <Icon size={19} className="text-[#EABA58]" strokeWidth={1.9} />
          </span>
          {/* glowing verified node */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EABA58] opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#EABA58] shadow-[0_0_10px_2px_rgba(234,186,88,0.7)]" />
          </span>
        </div>

        <div className="relative mt-4">
          <p className="text-[14px] font-semibold leading-tight text-[#F2F2F0]">
            {card.title}
          </p>
          <p className="mt-1 text-[11px] font-medium tracking-wide text-[#F2F2F0]/45">
            {card.meta}
          </p>
        </div>

        <div className="relative mt-4 flex items-center gap-1.5 border-t border-white/8 pt-3">
          <ShieldCheck size={12} className="text-[#EABA58]" />
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#EABA58]">
            {card.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function CivicCards({
  progress,
}: {
  progress: MotionValue<number>;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {/* Responsive scaling keeps the whole formation centred on any screen */}
      <div className="absolute inset-0 translate-y-[15vh] scale-[0.5] sm:translate-y-[6vh] sm:scale-[0.7] md:translate-y-0 md:scale-90 lg:scale-100">
        {cards.map((card, i) => (
          <CardItem key={card.id} card={card} i={i} progress={progress} />
        ))}
      </div>
    </div>
  );
}
