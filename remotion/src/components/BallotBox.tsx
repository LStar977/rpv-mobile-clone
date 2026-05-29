import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { COLORS } from '../theme';

const DROP_DUR = 26;
const N = 90;

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// 3D gold ballot box: a ballot drops into the slot, then voices erupt upward.
export const BallotBox: React.FC<{ startFrame?: number }> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const local = frame - startFrame;

  // geometry (adapts to format)
  const bw = Math.min(W * 0.42, 460);
  const bh = bw * 0.62;
  const depth = bw * 0.4;
  const cx = W / 2;
  const baseY = H * 0.82;
  const topY = baseY - bh;
  const ex = depth * 0.52;
  const ey = -depth * 0.46;

  const A = { x: cx - bw / 2, y: topY };
  const B = { x: cx + bw / 2, y: topY };
  const C = { x: cx + bw / 2, y: baseY };
  const D = { x: cx - bw / 2, y: baseY };
  const Ae = { x: A.x + ex, y: A.y + ey };
  const Be = { x: B.x + ex, y: B.y + ey };
  const Ce = { x: C.x + ex, y: C.y + ey };

  const slot = {
    x: cx + ex / 2,
    y: topY + ey / 2,
    w: bw * 0.5,
    h: Math.max(depth * 0.16, 12),
  };

  const eruptAt = DROP_DUR;
  const fe = local - eruptAt; // frames since eruption
  const erupted = fe >= 0;
  const power = clamp(fe / 22);
  const riseH = H * 0.5;

  const gold = 'rgba(230,178,74,0.9)';
  const lw = 2.4;

  // ballot drop
  const dropK = clamp(local / DROP_DUR);
  const cardStartY = slot.y - bh * 1.5;
  const cardY = cardStartY + (slot.y - cardStartY) * dropK * dropK;
  const cardW = slot.w * 0.74;
  const cardH = slot.w * 0.48;

  // ripples
  const rings: { r: number; o: number }[] = [];
  if (erupted) {
    for (let k = 0; k < 6; k++) {
      const age = fe - k * 22;
      if (age >= 0 && age <= 56) rings.push({ r: age * 6 + slot.w * 0.2, o: clamp(1 - age / 56) * 0.5 });
    }
  }

  const flashO = erupted ? clamp(1 - fe / 26) * 0.85 : 0;

  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="front" x1="0" y1={topY} x2="0" y2={baseY} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#100d08" />
            <stop offset="1" stopColor="#070605" />
          </linearGradient>
          <radialGradient id="shadow">
            <stop offset="0" stopColor="rgba(0,0,0,0.6)" />
            <stop offset="1" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* contact shadow */}
        <ellipse cx={cx} cy={baseY + 16} rx={bw * 0.78} ry={bw * 0.18} fill="url(#shadow)" />

        {/* right face */}
        <polygon points={`${B.x},${B.y} ${C.x},${C.y} ${Ce.x},${Ce.y} ${Be.x},${Be.y}`} fill="rgba(10,9,6,0.97)" stroke={gold} strokeWidth={lw} strokeLinejoin="round" />
        {/* top face */}
        <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${Be.x},${Be.y} ${Ae.x},${Ae.y}`} fill="rgba(28,24,15,0.97)" stroke={gold} strokeWidth={lw} strokeLinejoin="round" />
        {/* front face */}
        <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`} fill="url(#front)" stroke={gold} strokeWidth={lw} strokeLinejoin="round" />
        {/* slot */}
        <rect x={slot.x - slot.w / 2} y={slot.y - slot.h / 2} width={slot.w} height={slot.h} rx={slot.h / 2} fill="#000" stroke={gold} strokeWidth={lw} />
      </svg>

      {/* logo emblem on the front face */}
      <Img
        src={staticFile('logo.png')}
        style={{
          position: 'absolute',
          width: bw * 0.5,
          height: bw * 0.5,
          left: cx - bw * 0.25,
          top: (topY + baseY) / 2 - bw * 0.25,
          opacity: 0.55,
        }}
      />

      {/* dropping ballot */}
      {local < eruptAt + 4 && (
        <div
          style={{
            position: 'absolute',
            left: slot.x - cardW / 2,
            top: cardY - cardH / 2,
            width: cardW,
            height: cardH,
            borderRadius: cardH * 0.18,
            background: 'linear-gradient(180deg,#FBF7EC,#E6DDC6)',
            border: `2px solid ${gold}`,
            transform: `rotate(${-7 * (1 - dropK)}deg)`,
            opacity: clamp(1 - (local - eruptAt) / 4),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            clipPath:
              cardY > slot.y ? `inset(0 0 ${Math.min(100, ((cardY - slot.y) / cardH) * 100 + 40)}% 0)` : 'none',
          }}
        >
          <svg width={cardW * 0.5} height={cardH * 0.5} viewBox="0 0 24 24" fill="none" stroke={COLORS.goldDeep} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </div>
      )}

      {/* erupt flash */}
      {flashO > 0 && (
        <div
          style={{
            position: 'absolute',
            left: slot.x - bw * 0.9,
            top: slot.y - bw * 0.9,
            width: bw * 1.8,
            height: bw * 1.8,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(250,232,190,1) 0%, transparent 60%)',
            opacity: flashO,
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* ripples */}
      {rings.map((rg, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: slot.x - rg.r,
            top: slot.y - rg.r * 0.34,
            width: rg.r * 2,
            height: rg.r * 0.68,
            borderRadius: '50%',
            border: `2px solid rgba(230,178,74,${rg.o})`,
            mixBlendMode: 'screen',
          }}
        />
      ))}

      {/* slot halo */}
      {erupted && (
        <div
          style={{
            position: 'absolute',
            left: slot.x - bw * 0.55,
            top: slot.y - bw * 0.5,
            width: bw * 1.1,
            height: bw * 1.1,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(250,232,190,0.9) 0%, transparent 60%)',
            opacity: (0.22 + 0.08 * Math.sin(local / 7)) * power,
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* voice fountain */}
      {erupted &&
        new Array(N).fill(0).map((_, i) => {
          const life = 70 + random(`l${i}`) * 60;
          const birth = random(`b${i}`) * life;
          const t = (((fe + birth) % life) + life) % life;
          const progress = t / life;
          const y = slot.y - progress * riseH;
          const spread = (random(`x${i}`) - 0.5) * (70 + progress * 260);
          const sway = Math.sin(fe * 0.04 + i) * (8 + progress * 26);
          const x = slot.x + spread + sway;
          const o = Math.sin(progress * Math.PI) * (0.55 + random(`o${i}`) * 0.45) * power;
          const size = (random(`z${i}`) * 10 + 6) * (1 - progress * 0.4);
          const bright = random(`c${i}`) > 0.5;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${bright ? '#FBF1D6' : COLORS.gold} 0%, transparent 70%)`,
                opacity: o,
                mixBlendMode: 'screen',
              }}
            />
          );
        })}
    </AbsoluteFill>
  );
};
