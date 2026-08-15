// Scene components for the principle film grammar:
// IDENTIFY -> STATE -> EXPLAIN -> DEMONSTRATE -> EVIDENCE -> TEST -> RESOLVE
//
// Every component reads canonical text from data verbatim. Layout adapts to
// text; text is never adapted to layout.
//
// The visual language is craft-dense but doctrine-clean: engraving-style
// line draws, letterpress reveals, living grain, breathing vignettes, pooled
// gold light, slow continuous drift. Nothing bounces, nothing glitches,
// nothing moves merely to attract attention.

import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, G, SAFE, T } from '../design';
import type { PrincipleFilm } from '../types';
import {
  Aura,
  fadeIn,
  GoldDivider,
  GoldSymbol,
  Grain,
  Meta,
  pressIn,
  riseIn,
  SealedScroll,
  SectionIdentifier,
  settle,
  Vignette,
} from './primitives';

const Column: React.FC<{ children: React.ReactNode; justify?: string }> = ({ children, justify = 'center' }) => (
  <AbsoluteFill
    style={{
      padding: `${SAFE.top}px ${SAFE.side}px ${SAFE.bottom}px`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: justify,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Scene envelope: fade at both ends plus a slow, continuous vertical drift —
    every scene is quietly alive, drifting ~10px across its whole life. */
const useScene = (total: number) => {
  const frame = useCurrentFrame();
  const env = interpolate(frame, [0, T.sceneCross, total - T.sceneCross, total], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  const drift = interpolate(frame, [0, total], [5, -5]);
  return { frame, env, drift };
};

const Drift: React.FC<{ children: React.ReactNode; drift: number }> = ({ children, drift }) => (
  <AbsoluteFill style={{ transform: `translateY(${drift}px)` }}>{children}</AbsoluteFill>
);

// ── 1 · InstitutionalOpen ───────────────────────────────────────────────
export const InstitutionalOpen: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env, drift } = useScene(total);
  const wordP = fadeIn(frame, 4, T.headingReveal);
  return (
    <AbsoluteFill style={{ opacity: env }}>
      {/* A section numeral the size of a museum wall, barely there. */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: FONT.principle,
            fontSize: 980,
            fontWeight: 500,
            color: G.gold,
            opacity: 0.045 * fadeIn(frame, 0, 30),
            lineHeight: 1,
            transform: `scale(${1 + frame * 0.0004})`,
          }}
        >
          {film.sectionId}
        </div>
      </AbsoluteFill>
      <Aura opacity={fadeIn(frame, 10, 40) * 0.8} />
      <Drift drift={drift}>
        <Column>
          <div
            style={{
              fontFamily: FONT.verification,
              fontSize: 30,
              letterSpacing: settle(wordP, 0.62, 0.32),
              textTransform: 'uppercase',
              color: G.ink70,
              opacity: wordP,
            }}
          >
            THE LAW ABOVE POWER
          </div>
          <div style={{ height: 44 }} />
          <GoldDivider at={10} />
          <div style={{ height: 44 }} />
          <div
            style={{
              fontFamily: FONT.verification,
              fontSize: 34,
              letterSpacing: '0.3em',
              color: G.gold,
              opacity: fadeIn(frame, 18, T.metadataFade),
            }}
          >
            PRINCIPLE {film.id} / {film.total}
          </div>
          <div style={{ height: 40 }} />
          <SectionIdentifier sectionId={film.sectionId} sectionTitle={film.sectionTitle} at={28} />
        </Column>
      </Drift>
      <Vignette strength={0.5} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 2 · PrincipleStatement ──────────────────────────────────────────────
export const PrincipleStatement: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env, drift } = useScene(total);
  const titleP = fadeIn(frame, 2, T.headingReveal + 6);
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Aura opacity={fadeIn(frame, 20, 50) * 0.7} y="38%" />
      <Drift drift={drift}>
        <Column>
          <div
            style={{
              fontFamily: FONT.principle,
              fontWeight: 500,
              fontSize: 88,
              lineHeight: 1.06,
              letterSpacing: '-0.01em',
              color: G.ink,
              textAlign: 'center',
              maxWidth: 880,
              ...pressIn(titleP),
              transform: `translateY(${(1 - titleP) * 14}px)`,
            }}
          >
            {film.title}
          </div>
          <div style={{ height: 56 }} />
          <GoldDivider at={18} width={90} />
          <div style={{ height: 56 }} />
          {/* Canonical statement — verbatim from data, printed downward. */}
          <div
            style={{
              fontFamily: FONT.principle,
              fontWeight: 400,
              fontSize: 54,
              lineHeight: 1.32,
              color: G.ink70,
              textAlign: 'center',
              maxWidth: SAFE.teachingWidth,
              fontStyle: 'italic',
              ...pressIn(fadeIn(frame, 26, T.canonicalReveal + 10)),
            }}
          >
            {film.canonicalText}
          </div>
        </Column>
      </Drift>
      <Vignette strength={0.45} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 3 · ExplanationScene (Human Origin) ─────────────────────────────────
// Teaching rule: the individual must visually precede the institution.
export const HumanOrigin: React.FC<{ total: number }> = ({ total }) => {
  const { frame, env, drift } = useScene(total);
  const individualAt = 16;
  const institutionAt = 150; // the institution appears only afterward
  const shift = interpolate(frame, [institutionAt - 8, institutionAt + T.canonicalReveal], [0, -215], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Aura opacity={fadeIn(frame, individualAt, 40) * 0.75} y="46%" spread="46% 30%" />
      <Drift drift={drift}>
        <Column>
          <div
            style={{
              fontFamily: FONT.principle,
              fontSize: 72,
              fontWeight: 500,
              color: G.gold,
              letterSpacing: settle(fadeIn(frame, 2, T.headingReveal), 0.16, 0.02),
              opacity: fadeIn(frame, 2, T.headingReveal),
            }}
          >
            RIGHTS
          </div>
          <div style={{ height: 90 }} />
          <div style={{ position: 'relative', width: SAFE.teachingWidth, height: 330 }}>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                transform: `translateX(calc(-50% + ${shift}px))`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 26,
              }}
            >
              {/* The individual engraves itself into existence. */}
              <GoldSymbol
                name="individual"
                size={210}
                draw={fadeIn(frame, individualAt, 44)}
                opacity={fadeIn(frame, individualAt, 12)}
              />
              <Meta at={individualAt + 26} size={26} color={G.ink70} tracking="0.26em">
                THE INDIVIDUAL
              </Meta>
            </div>
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: 20,
                transform: 'translateX(calc(-50% + 215px))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 26,
              }}
            >
              <GoldSymbol
                name="governance"
                size={190}
                color={G.ink50}
                draw={fadeIn(frame, institutionAt, 44)}
                opacity={fadeIn(frame, institutionAt, 12)}
              />
              <Meta at={institutionAt + 26} size={26} tracking="0.26em">
                THE INSTITUTION
              </Meta>
            </div>
          </div>
          <div style={{ height: 70 }} />
          <div
            style={{
              fontFamily: FONT.instruction,
              fontSize: 42,
              lineHeight: 1.45,
              color: G.ink70,
              textAlign: 'center',
              maxWidth: SAFE.teachingWidth,
              ...riseIn(frame, 52, T.canonicalReveal, 14),
            }}
          >
            Freedom is older than politics.
          </div>
        </Column>
      </Drift>
      <Vignette strength={0.45} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 4 · ConceptDiagram (The Inversion) ──────────────────────────────────
const DrawnArrow: React.FC<{ at: number; frame: number; gold: boolean }> = ({ at, frame, gold }) => {
  const p = fadeIn(frame, at, T.lineDraw);
  return (
    <svg width="54" height="18" viewBox="0 0 54 18" style={{ opacity: p > 0 ? 1 : 0 }}>
      <line
        x1="2"
        y1="9"
        x2="44"
        y2="9"
        pathLength={1}
        stroke={gold ? G.gold : G.ink50}
        strokeWidth="2.5"
        strokeDasharray={1}
        strokeDashoffset={1 - p}
      />
      <path
        d="M 42 3 L 50 9 L 42 15"
        pathLength={1}
        fill="none"
        stroke={gold ? G.gold : G.ink50}
        strokeWidth="2.5"
        strokeDasharray={1}
        strokeDashoffset={Math.max(0, 1 - Math.max(0, (p - 0.6) / 0.4))}
      />
    </svg>
  );
};

const DiagramRow: React.FC<{
  nodes: { label: string }[];
  at: number;
  gold: boolean;
  boxed?: boolean;
  frame: number;
  dimTo?: number;
  dimAt?: number;
}> = ({ nodes, at, gold, boxed, frame, dimTo = 1, dimAt = 0 }) => {
  const rowIn = fadeIn(frame, at, T.canonicalReveal);
  const dim = dimAt > 0 ? interpolate(frame, [dimAt, dimAt + 30], [1, dimTo], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE }) : 1;
  const boxP = boxed ? fadeIn(frame, at + 30, T.lineDraw + 10) : 0;
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        opacity: (boxed ? rowIn * 0.92 : rowIn) * dim,
        padding: '30px 36px',
      }}
    >
      {boxed ? (
        // The constraint draws itself around the inverted order.
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="none" viewBox="0 0 100 100">
          <rect
            x="0.6"
            y="1.8"
            width="98.8"
            height="96.4"
            rx="2.4"
            pathLength={1}
            fill="none"
            stroke={G.line}
            strokeWidth="0.5"
            strokeDasharray={1}
            strokeDashoffset={1 - boxP}
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: 1.5 }}
          />
        </svg>
      ) : null}
      {nodes.map((n, i) => (
        <React.Fragment key={n.label}>
          {i > 0 && <DrawnArrow at={at + 8 + i * 14} frame={frame} gold={gold} />}
          <div
            style={{
              fontFamily: FONT.verification,
              fontSize: 30,
              letterSpacing: '0.14em',
              color: gold ? (i === 0 ? G.gold : G.ink) : G.ink50,
              opacity: fadeIn(frame, at + i * 14, T.canonicalReveal),
            }}
          >
            {n.label}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export const ConceptDiagram: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env, drift } = useScene(total);
  return (
    <AbsoluteFill style={{ opacity: env }}>
      {/* The proper order sits in light; the inversion sits outside it. */}
      <Aura opacity={fadeIn(frame, 10, 40) * 0.8} y="30%" spread="60% 22%" />
      <Drift drift={drift}>
        <Column>
          <Meta at={2} size={27} color={G.ink50}>
            THE PROPER ORDER
          </Meta>
          <div style={{ height: 22 }} />
          <DiagramRow nodes={film.properOrder.nodes} at={10} gold frame={frame} />
          <div style={{ height: 84 }} />
          <Meta at={92} size={27} color={G.ink30}>
            THE INVERSION
          </Meta>
          <div style={{ height: 22 }} />
          <DiagramRow
            nodes={film.invertedOrder.nodes}
            at={100}
            gold={false}
            boxed
            frame={frame}
            dimAt={168}
            dimTo={0.55}
          />
          <div style={{ height: 92 }} />
          <div
            style={{
              fontFamily: FONT.instruction,
              fontSize: 40,
              lineHeight: 1.45,
              color: G.ink70,
              textAlign: 'center',
              maxWidth: SAFE.teachingWidth,
              ...riseIn(frame, 152, T.canonicalReveal, 14),
            }}
          >
            What is treated as a gift can be confiscated as easily as it is bestowed.
          </div>
        </Column>
      </Drift>
      <Vignette strength={0.45} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 5 · HistoricalEvidence ──────────────────────────────────────────────
// Authentic archival scans presented like an exhibit: gold corner brackets
// draw around each document, the year stamps in, the scan drifts 100→103%.
const Bracket: React.FC<{ corner: string; p: number }> = ({ corner, p }) => {
  const size = 46;
  const pos: React.CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    ...(corner.includes('t') ? { top: -14 } : { bottom: -14 }),
    ...(corner.includes('l') ? { left: -14 } : { right: -14 }),
    transform: `rotate(${corner === 'tr' ? 90 : corner === 'br' ? 180 : corner === 'bl' ? 270 : 0}deg)`,
  };
  return (
    <svg viewBox="0 0 46 46" style={pos}>
      <path
        d="M 2 44 L 2 2 L 44 2"
        pathLength={1}
        fill="none"
        stroke={G.gold}
        strokeWidth="3"
        strokeDasharray={1}
        strokeDashoffset={1 - p}
        opacity={p > 0 ? 0.85 : 0}
      />
    </svg>
  );
};

const ArchivalItem: React.FC<{
  item: PrincipleFilm['historicalEvidence'][number];
  at: number;
  frame: number;
  visibleUntil: number;
}> = ({ item, at, frame, visibleUntil }) => {
  const p =
    fadeIn(frame, at, T.archivalFade) *
    interpolate(frame, [visibleUntil - 12, visibleUntil], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE,
    });
  const drift = interpolate(frame, [at, at + 240], [1, 1.03], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bracketP = fadeIn(frame, at + 6, T.lineDraw + 6);
  const stampP = fadeIn(frame, at + 18, 14);
  if (p <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: p }}>
      {item.asset ? (
        <div style={{ position: 'relative' }}>
          <div style={{ width: SAFE.teachingWidth, height: 860, overflow: 'hidden', borderRadius: 6, border: `1px solid ${G.line}` }}>
            <Img
              src={staticFile(item.asset)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${drift})` }}
            />
            {/* A whisper of gold over the parchment so it belongs to the film. */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(4,7,7,0.16), transparent 30%, transparent 72%, rgba(4,7,7,0.28))' }} />
          </div>
          <Bracket corner="tl" p={bracketP} />
          <Bracket corner="tr" p={bracketP} />
          <Bracket corner="br" p={bracketP} />
          <Bracket corner="bl" p={bracketP} />
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: SAFE.teachingWidth,
          marginTop: 36,
          borderBottom: `1px solid ${G.lineSoft}`,
          paddingBottom: 22,
        }}
      >
        <div style={{ fontFamily: FONT.principle, fontSize: 46, fontWeight: 500, color: G.ink, ...pressIn(fadeIn(frame, at + 10, 18)) }}>
          {item.title}
        </div>
        {/* The year stamps in: arrives slightly large, presses flat. */}
        <div
          style={{
            fontFamily: FONT.verification,
            fontSize: 30,
            color: G.gold,
            letterSpacing: '0.1em',
            opacity: stampP,
            transform: `scale(${1.18 - 0.18 * stampP})`,
            transformOrigin: 'right bottom',
          }}
        >
          {item.year}
        </div>
      </div>
    </div>
  );
};

export const HistoricalEvidence: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env, drift } = useScene(total);
  const resolveAt = 196;
  const per = Math.floor(resolveAt / Math.max(film.historicalEvidence.length, 1));
  const itemsFade = interpolate(frame, [resolveAt - 16, resolveAt], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Drift drift={drift}>
        <Column>
          <div style={{ position: 'absolute', inset: 0, opacity: itemsFade }}>
            {film.historicalEvidence.map((h, i) => (
              <ArchivalItem key={h.title} item={h} at={4 + i * per} frame={frame} visibleUntil={4 + (i + 1) * per} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
            <Aura opacity={fadeIn(frame, resolveAt, 30)} y="48%" spread="52% 22%" />
            <div
              style={{
                fontFamily: FONT.principle,
                fontSize: 62,
                fontWeight: 500,
                color: G.gold,
                ...riseIn(frame, resolveAt, T.canonicalReveal, 16),
              }}
            >
              Remembered. Rediscovered.
            </div>
            <div
              style={{
                fontFamily: FONT.principle,
                fontSize: 44,
                fontStyle: 'italic',
                color: G.ink30,
                opacity:
                  fadeIn(frame, resolveAt + 14, T.canonicalReveal) *
                  interpolate(frame, [resolveAt + 52, resolveAt + 80], [1, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: EASE,
                  }),
              }}
            >
              Not created.
            </div>
          </div>
        </Column>
      </Drift>
      <Vignette strength={0.5} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 6 · Reflection ──────────────────────────────────────────────────────
// The breath before the test: near-darkness, one line of gold, a single
// slow ring expanding once like a struck bell falling silent.
export const Reflection: React.FC<{ total: number }> = ({ total }) => {
  const { frame, env } = useScene(total);
  const ringP = interpolate(frame, [24, total], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 620 * ringP + 60,
            height: 620 * ringP + 60,
            borderRadius: '50%',
            border: `1px solid ${G.gold}`,
            opacity: (1 - ringP) * 0.22,
          }}
        />
      </AbsoluteFill>
      <Column>
        <GoldDivider at={8} width={70} />
      </Column>
      <Vignette strength={0.62} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 7 · SentinelTest ────────────────────────────────────────────────────
// The ritual. The world darkens to the words; the conclusion arrives alone,
// in gold, and is given stillness.
export const SentinelTest: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env } = useScene(total);
  // Presentation split only — joined back together this is the exact
  // canonical string. Words are never altered.
  const clauses = film.sentinelTest.split(' - ');
  const setup = clauses[0] ?? film.sentinelTest;
  const conclusion = clauses.length > 1 ? clauses.slice(1).join(' - ') : null;
  const labelP = fadeIn(frame, 6, T.metadataFade + 6);
  const vignette = interpolate(frame, [0, total * 0.65], [0.45, 0.78], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const conclusionAt = 96;
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Aura opacity={fadeIn(frame, conclusionAt, 40) * 0.9} y="55%" spread="58% 26%" />
      <Column>
        <div
          style={{
            fontFamily: FONT.verification,
            fontSize: 32,
            letterSpacing: settle(labelP, 0.7, 0.42),
            color: G.gold,
            opacity: labelP,
            textTransform: 'uppercase',
          }}
        >
          SENTINEL TEST
        </div>
        <div style={{ height: 40 }} />
        <GoldDivider at={14} width={80} />
        <div style={{ height: 76 }} />
        <div
          style={{
            fontFamily: FONT.principle,
            fontWeight: 400,
            fontSize: 60,
            lineHeight: 1.34,
            color: G.ink,
            textAlign: 'center',
            maxWidth: SAFE.teachingWidth,
            ...pressIn(fadeIn(frame, 28, T.diagnosticReveal + 8)),
          }}
        >
          {setup}
          {conclusion ? ' -' : ''}
        </div>
        {conclusion ? (
          <div
            style={{
              fontFamily: FONT.principle,
              fontWeight: 500,
              fontSize: 66,
              lineHeight: 1.3,
              color: G.gold,
              textAlign: 'center',
              maxWidth: SAFE.teachingWidth,
              marginTop: 34,
              ...pressIn(fadeIn(frame, conclusionAt, T.diagnosticReveal)),
            }}
          >
            {conclusion}
          </div>
        ) : null}
      </Column>
      <Vignette strength={vignette} />
      <Grain />
    </AbsoluteFill>
  );
};

// ── 8 · SeriesClose ─────────────────────────────────────────────────────
export const SeriesClose: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env, drift } = useScene(total);
  // One slow pass of light across the series name — a polish, not a flare.
  const sheenX = interpolate(frame, [40, 110], [140, -40], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Aura opacity={fadeIn(frame, 8, 40) * 0.8} y="40%" spread="50% 30%" />
      <Drift drift={drift}>
        <Column>
          {/* The seal engraves itself closed. */}
          <SealedScroll size={150} draw={fadeIn(frame, 4, 46)} opacity={fadeIn(frame, 4, 12)} />
          <div style={{ height: 60 }} />
          <div
            style={{
              fontFamily: FONT.verification,
              fontSize: 30,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              opacity: fadeIn(frame, 18, T.metadataFade),
              backgroundImage: `linear-gradient(100deg, ${G.ink70} 42%, ${G.ink} 50%, ${G.ink70} 58%)`,
              backgroundSize: '220% 100%',
              backgroundPositionX: `${sheenX}%`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            THE LAW ABOVE POWER
          </div>
          <div style={{ height: 26 }} />
          <Meta at={26} size={24} color={G.ink50} tracking="0.24em">
            155 IMMUTABLE PRINCIPLES OF SELF-GOVERNANCE
          </Meta>
          <div style={{ height: 46 }} />
          <div
            style={{
              fontFamily: FONT.verification,
              fontSize: 28,
              letterSpacing: '0.3em',
              color: G.gold,
              opacity: fadeIn(frame, 34, T.metadataFade),
            }}
          >
            PRINCIPLE {film.id} / {film.total}
          </div>
        </Column>
      </Drift>
      <Vignette strength={0.55} />
      <Grain />
    </AbsoluteFill>
  );
};
