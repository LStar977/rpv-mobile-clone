// Shared primitives: GoldDivider, SectionIdentifier, Captions, symbols.
// Every motion here derives from the centralized timing tokens in design.ts.

import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { EASE, FONT, G, SAFE, T } from '../design';
import type { Caption } from '../types';
import { SYMBOL_PATHS } from '../symbolLibrary';

export const fadeIn = (frame: number, at: number, len: number) =>
  interpolate(frame, [at, at + len], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });

export const riseIn = (frame: number, at: number, len: number, dist = 24) => {
  const p = fadeIn(frame, at, len);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};

/** A thin gold rule that draws from the centre outward. */
export const GoldDivider: React.FC<{ at: number; width?: number }> = ({ at, width = 120 }) => {
  const frame = useCurrentFrame();
  const p = fadeIn(frame, at, T.lineDraw);
  return (
    <div
      style={{
        width,
        height: 2,
        background: G.gold,
        transform: `scaleX(${p})`,
        opacity: p,
      }}
    />
  );
};

/** Mono metadata line — the voice of verification. */
export const Meta: React.FC<{
  children: React.ReactNode;
  at?: number;
  size?: number;
  color?: string;
  tracking?: string;
}> = ({ children, at = 0, size = 28, color = G.ink50, tracking = '0.32em' }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONT.verification,
        fontSize: size,
        letterSpacing: tracking,
        color,
        opacity: fadeIn(frame, at, T.metadataFade),
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
};

export const SectionIdentifier: React.FC<{ sectionId: string; sectionTitle: string; at?: number }> = ({
  sectionId,
  sectionTitle,
  at = 0,
}) => (
  <Meta at={at} size={26}>
    SECTION {sectionId} · {sectionTitle}
  </Meta>
);

/** Accessibility captions — Onest, off-white, max two lines, never kinetic. */
export const Captions: React.FC<{ captions: Caption[]; hideRanges?: Array<{ from: number; to: number }> }> = ({
  captions,
  hideRanges = [],
}) => {
  const frame = useCurrentFrame();
  const active = captions.find((c) => frame >= c.startFrame && frame < c.endFrame);
  if (!active) return null;
  // Where a large on-screen canonical statement already shows the same words,
  // the caption is suppressed rather than duplicated (spec §11).
  if (hideRanges.some((r) => frame >= r.from && frame < r.to)) return null;
  const p = fadeIn(frame, active.startFrame, 8);
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.side,
        right: SAFE.side,
        bottom: SAFE.bottom - 120,
        display: 'flex',
        justifyContent: 'center',
        opacity: p,
      }}
    >
      <div
        style={{
          fontFamily: FONT.instruction,
          fontSize: 33,
          lineHeight: 1.4,
          color: G.ink70,
          textAlign: 'center',
          maxWidth: SAFE.teachingWidth,
        }}
      >
        {active.text}
      </div>
    </div>
  );
};

/** Renders any symbol from the Represent Gold Symbol Library by name.
    Stroke settings match the library's handoff exactly.

    `draw` (0..1) makes the symbol engrave itself: pathLength is normalized on
    every shape and stroke-dasharray/-offset are set on the parent svg — both
    are inheritable presentation properties, so one style draws all strokes in
    parallel. Line drawing is the one flourish the spec explicitly blesses. */
export const GoldSymbol: React.FC<{
  name: string;
  size?: number;
  opacity?: number;
  color?: string;
  draw?: number;
}> = ({ name, size = 150, opacity = 1, color = G.gold, draw }) => {
  const raw = SYMBOL_PATHS[name];
  if (!raw) return null;
  let inner = color === G.gold ? raw : raw.replaceAll('#EABA58', color);
  const drawStyle: React.CSSProperties = {};
  if (draw !== undefined) {
    inner = inner.replace(/<(path|circle|line|rect|polyline|ellipse)\b/g, '<$1 pathLength="1"');
    drawStyle.strokeDasharray = 1;
    drawStyle.strokeDashoffset = Math.max(0, 1 - draw);
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity, ...drawStyle }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
};

/* ── Atmosphere ─────────────────────────────────────────────────────────
   The environment layer: living grain, a breathing vignette, and gold
   light. All deterministic — no randomness, identical on every render. */

const GRAIN_URI =
  'url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%27180%27 height=%27180%27><filter id=%27n%27><feTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%272%27 stitchTiles=%27stitch%27/></filter><rect width=%27180%27 height=%27180%27 filter=%27url(%23n)%27 opacity=%270.6%27/></svg>")';

/** Film grain that lives: the tile jumps position each frame, deterministically. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.05 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: GRAIN_URI,
        backgroundPosition: `${(frame * 37) % 180}px ${(frame * 53) % 180}px`,
        mixBlendMode: 'overlay',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

/** Edge darkness that can tighten for grave moments (the Sentinel Test). */
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse 130% 92% at 50% 42%, transparent 52%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

/** A soft pool of gold light behind whatever currently carries the meaning. */
export const Aura: React.FC<{ opacity: number; y?: string; spread?: string }> = ({
  opacity,
  y = '42%',
  spread = '68% 38%',
}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse ${spread} at 50% ${y}, rgba(234,186,88,0.13), transparent 70%)`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

/** Letterpress reveal: content appears as if printed, top edge downward. */
export const pressIn = (p: number): React.CSSProperties => ({
  clipPath: `inset(0 0 ${(1 - Math.min(1, Math.max(0, p))) * 100}% 0)`,
  opacity: p > 0 ? 1 : 0,
});

/** Tracking that settles: type arrives slightly expanded and breathes in. */
export const settle = (p: number, from: number, to: number) => `${to + (from - to) * (1 - p)}em`;

/** The Individual — a restrained gold figure. Symbolic, not clip-art. */
export const IndividualSymbol: React.FC<{ size?: number; opacity?: number }> = ({ size = 150, opacity = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }}>
    <circle cx="50" cy="30" r="13" fill="none" stroke={G.gold} strokeWidth="3.4" />
    <path
      d="M 26 88 C 26 62 38 50 50 50 C 62 50 74 62 74 88"
      fill="none"
      stroke={G.gold}
      strokeWidth="3.4"
      strokeLinecap="round"
    />
  </svg>
);

/** Governance — a restrained institutional portico. */
export const GovernanceSymbol: React.FC<{ size?: number; opacity?: number; color?: string }> = ({
  size = 150,
  opacity = 1,
  color = G.ink50,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }}>
    <path d="M 50 12 L 88 34 L 12 34 Z" fill="none" stroke={color} strokeWidth="3.2" strokeLinejoin="round" />
    {[24, 41.3, 58.6, 76].map((x) => (
      <line key={x} x1={x} y1="42" x2={x} y2="74" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
    ))}
    <line x1="14" y1="82" x2="86" y2="82" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
  </svg>
);

/** The sealed scroll — series identity mark. A document between two roller
    rods, closed with a wax seal. */
export const SealedScroll: React.FC<{ size?: number; opacity?: number; draw?: number }> = ({ size = 130, opacity = 1, draw }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={{
      opacity,
      ...(draw !== undefined ? { strokeDasharray: 1, strokeDashoffset: Math.max(0, 1 - draw) } : {}),
    }}
  >
    {/* top rod */}
    <line pathLength={1} x1="18" y1="16" x2="82" y2="16" stroke={G.gold} strokeWidth="3.2" strokeLinecap="round" />
    <circle pathLength={1} cx="16" cy="16" r="4" fill="none" stroke={G.gold} strokeWidth="2.4" />
    <circle pathLength={1} cx="84" cy="16" r="4" fill="none" stroke={G.gold} strokeWidth="2.4" />
    {/* parchment body, slightly narrower than the rods */}
    <path pathLength={1} d="M 26 16 L 26 84 M 74 16 L 74 84" stroke={G.gold} strokeWidth="2.6" strokeLinecap="round" />
    {/* bottom rod */}
    <line pathLength={1} x1="18" y1="84" x2="82" y2="84" stroke={G.gold} strokeWidth="3.2" strokeLinecap="round" />
    <circle pathLength={1} cx="16" cy="84" r="4" fill="none" stroke={G.gold} strokeWidth="2.4" />
    <circle pathLength={1} cx="84" cy="84" r="4" fill="none" stroke={G.gold} strokeWidth="2.4" />
    {/* faint script lines */}
    <line pathLength={1} x1="35" y1="32" x2="65" y2="32" stroke={G.gold} strokeWidth="1.6" opacity="0.45" strokeLinecap="round" />
    <line pathLength={1} x1="35" y1="41" x2="65" y2="41" stroke={G.gold} strokeWidth="1.6" opacity="0.45" strokeLinecap="round" />
    {/* wax seal */}
    <circle pathLength={1} cx="50" cy="62" r="12.5" fill={G.obsidian} stroke={G.gold} strokeWidth="3" />
    <circle pathLength={1} cx="50" cy="62" r="6" fill="none" stroke={G.gold} strokeWidth="1.8" opacity="0.8" />
  </svg>
);
