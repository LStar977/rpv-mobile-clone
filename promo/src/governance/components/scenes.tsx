// Scene components for the principle film grammar:
// IDENTIFY -> STATE -> EXPLAIN -> DEMONSTRATE -> EVIDENCE -> TEST -> RESOLVE
//
// Every component reads canonical text from data verbatim. Layout adapts to
// text; text is never adapted to layout.

import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, FONT, G, SAFE, T } from '../design';
import type { PrincipleFilm } from '../types';
import {
  fadeIn,
  riseIn,
  GoldDivider,
  GoldSymbol,
  Meta,
  SealedScroll,
  SectionIdentifier,
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

/** Scene-level fade envelope. Local frame. */
const useScene = (total: number) => {
  const frame = useCurrentFrame();
  const env = interpolate(frame, [0, T.sceneCross, total - T.sceneCross, total], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return { frame, env };
};

// ── 1 · InstitutionalOpen ───────────────────────────────────────────────
export const InstitutionalOpen: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env } = useScene(total);
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Column>
        <Meta at={4} size={30} color={G.ink70}>
          THE LAW ABOVE POWER
        </Meta>
        <div style={{ height: 44 }} />
        <GoldDivider at={8} />
        <div style={{ height: 44 }} />
        <div
          style={{
            fontFamily: FONT.verification,
            fontSize: 34,
            letterSpacing: '0.3em',
            color: G.gold,
            opacity: fadeIn(frame, 14, T.metadataFade),
          }}
        >
          PRINCIPLE {film.id} / {film.total}
        </div>
        <div style={{ height: 40 }} />
        <SectionIdentifier sectionId={film.sectionId} sectionTitle={film.sectionTitle} at={22} />
      </Column>
    </AbsoluteFill>
  );
};

// ── 2 · PrincipleStatement ──────────────────────────────────────────────
export const PrincipleStatement: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env } = useScene(total);
  return (
    <AbsoluteFill style={{ opacity: env }}>
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
            ...riseIn(frame, 2, T.headingReveal),
          }}
        >
          {film.title}
        </div>
        <div style={{ height: 56 }} />
        <GoldDivider at={16} width={90} />
        <div style={{ height: 56 }} />
        {/* Canonical statement — verbatim from data. */}
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
            ...riseIn(frame, 22, T.canonicalReveal, 18),
          }}
        >
          {film.canonicalText}
        </div>
      </Column>
    </AbsoluteFill>
  );
};

// ── 3 · ExplanationScene (Human Origin) ─────────────────────────────────
// Teaching rule: the individual must visually precede the institution.
export const HumanOrigin: React.FC<{ total: number }> = ({ total }) => {
  const { frame, env } = useScene(total);
  const individualAt = 18;
  const institutionAt = 150; // the institution appears only afterward
  // The individual holds the centre alone, then deliberately makes room as
  // the institution arrives — the layout itself teaches the precedence.
  const shift = interpolate(frame, [institutionAt - 8, institutionAt + T.canonicalReveal], [0, -215], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Column>
        <div
          style={{
            fontFamily: FONT.principle,
            fontSize: 72,
            fontWeight: 500,
            color: G.gold,
            letterSpacing: '0.02em',
            ...riseIn(frame, 2, T.headingReveal),
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
              opacity: fadeIn(frame, individualAt, T.canonicalReveal),
            }}
          >
            <GoldSymbol name="individual" size={210} />
            <Meta at={individualAt + 10} size={26} color={G.ink70} tracking="0.26em">
              THE INDIVIDUAL
            </Meta>
          </div>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 20, // symbol is 20px shorter — keeps both labels on one baseline
              transform: 'translateX(calc(-50% + 215px))',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 26,
              ...riseIn(frame, institutionAt, T.canonicalReveal, 16),
            }}
          >
            <GoldSymbol name="governance" size={190} color={G.ink50} />
            <Meta at={institutionAt + 10} size={26} tracking="0.26em">
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
            ...riseIn(frame, 48, T.canonicalReveal, 14),
          }}
        >
          Freedom is older than politics.
        </div>
      </Column>
    </AbsoluteFill>
  );
};

// ── 4 · ConceptDiagram (The Inversion) ──────────────────────────────────
const DiagramRow: React.FC<{
  nodes: { label: string }[];
  at: number;
  gold: boolean;
  boxed?: boolean;
  frame: number;
}> = ({ nodes, at, gold, boxed, frame }) => {
  const rowIn = fadeIn(frame, at, T.canonicalReveal);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        opacity: boxed ? rowIn * 0.92 : rowIn,
        padding: boxed ? '30px 36px' : '30px 0',
        border: boxed ? `1.5px solid ${G.line}` : '1.5px solid transparent',
        borderRadius: 10,
      }}
    >
      {nodes.map((n, i) => (
        <React.Fragment key={n.label}>
          {i > 0 && (
            <svg width="54" height="18" viewBox="0 0 54 18" style={{ opacity: fadeIn(frame, at + 8 + i * 12, T.lineDraw) }}>
              <line x1="2" y1="9" x2="44" y2="9" stroke={gold ? G.gold : G.ink50} strokeWidth="2.5" />
              <path d="M 42 3 L 50 9 L 42 15" fill="none" stroke={gold ? G.gold : G.ink50} strokeWidth="2.5" />
            </svg>
          )}
          <div
            style={{
              fontFamily: FONT.verification,
              fontSize: 30,
              letterSpacing: '0.14em',
              color: gold ? (i === 0 ? G.gold : G.ink) : G.ink50,
              opacity: fadeIn(frame, at + i * 12, T.canonicalReveal),
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
  const { frame, env } = useScene(total);
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Column>
        <Meta at={2} size={27} color={G.ink50}>
          THE PROPER ORDER
        </Meta>
        <div style={{ height: 34 }} />
        <DiagramRow nodes={film.properOrder.nodes} at={10} gold frame={frame} />
        <div style={{ height: 96 }} />
        <Meta at={92} size={27} color={G.ink30}>
          THE INVERSION
        </Meta>
        <div style={{ height: 34 }} />
        <DiagramRow nodes={film.invertedOrder.nodes} at={100} gold={false} boxed frame={frame} />
        <div style={{ height: 100 }} />
        <div
          style={{
            fontFamily: FONT.instruction,
            fontSize: 40,
            lineHeight: 1.45,
            color: G.ink70,
            textAlign: 'center',
            maxWidth: SAFE.teachingWidth,
            ...riseIn(frame, 150, T.canonicalReveal, 14),
          }}
        >
          What is treated as a gift can be confiscated as easily as it is bestowed.
        </div>
      </Column>
    </AbsoluteFill>
  );
};

// ── 5 · HistoricalEvidence ──────────────────────────────────────────────
// Authentic archival scans where supplied (public/historical/), with the
// spec's slow 100→103% drift; items without an asset fall back to restrained
// typographic cards. Never an invented document.
const ArchivalItem: React.FC<{
  item: PrincipleFilm['historicalEvidence'][number];
  at: number;
  frame: number;
  visibleUntil: number;
}> = ({ item, at, frame, visibleUntil }) => {
  // Each document holds the frame alone, crossfading to the next.
  const p =
    fadeIn(frame, at, T.archivalFade) *
    interpolate(frame, [visibleUntil - 12, visibleUntil], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE,
    });
  // Extremely subtle archival drift: ~100% → 103% across the item's life.
  const drift = interpolate(frame, [at, at + 240], [1, 1.03], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (p <= 0.001) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: p }}>
      {item.asset ? (
        <div style={{ width: SAFE.teachingWidth, height: 860, overflow: 'hidden', borderRadius: 6, border: `1px solid ${G.line}` }}>
          <Img
            src={staticFile(item.asset)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${drift})` }}
          />
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          width: SAFE.teachingWidth,
          marginTop: 34,
          borderBottom: `1px solid ${G.lineSoft}`,
          paddingBottom: 22,
        }}
      >
        <div style={{ fontFamily: FONT.principle, fontSize: 46, fontWeight: 500, color: G.ink }}>{item.title}</div>
        <div style={{ fontFamily: FONT.verification, fontSize: 30, color: G.gold, letterSpacing: '0.1em' }}>{item.year}</div>
      </div>
    </div>
  );
};

export const HistoricalEvidence: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env } = useScene(total);
  const resolveAt = 196;
  const per = Math.floor(resolveAt / Math.max(film.historicalEvidence.length, 1)); // equal share of the evidence beat
  const itemsFade = interpolate(frame, [resolveAt - 16, resolveAt], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE,
  });
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Column>
        <div style={{ position: 'absolute', inset: 0, opacity: itemsFade }}>
          {film.historicalEvidence.map((h, i) => (
            <ArchivalItem
              key={h.title}
              item={h}
              at={4 + i * per}
              frame={frame}
              visibleUntil={4 + (i + 1) * per}
            />
          ))}
        </div>
        <div style={{ height: 86 }} />
        {/* REMEMBERED / REDISCOVERED isolate; CREATED fades rather than being
            struck through (spec §17). */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
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
    </AbsoluteFill>
  );
};

// ── 6 · Reflection ──────────────────────────────────────────────────────
export const Reflection: React.FC<{ total: number }> = ({ total }) => {
  const { frame, env } = useScene(total);
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Column>
        <GoldDivider at={10} width={70} />
      </Column>
    </AbsoluteFill>
  );
};

// ── 7 · SentinelTest ────────────────────────────────────────────────────
// The recognizable ritual: environment simplifies, gold label, diagnostic
// statement in Newsreader, long stillness after the conclusion.
export const SentinelTest: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env } = useScene(total);
  // The canonical text, displayed verbatim. Line breaks are presentation;
  // words, punctuation, and order are not.
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Column>
        <div
          style={{
            fontFamily: FONT.verification,
            fontSize: 32,
            letterSpacing: '0.42em',
            color: G.gold,
            opacity: fadeIn(frame, 6, T.metadataFade),
          }}
        >
          SENTINEL TEST
        </div>
        <div style={{ height: 40 }} />
        <GoldDivider at={12} width={80} />
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
            ...riseIn(frame, 26, T.diagnosticReveal, 20),
          }}
        >
          {film.sentinelTest}
        </div>
      </Column>
    </AbsoluteFill>
  );
};

// ── 8 · SeriesClose ─────────────────────────────────────────────────────
export const SeriesClose: React.FC<{ film: PrincipleFilm; total: number }> = ({ film, total }) => {
  const { frame, env } = useScene(total);
  return (
    <AbsoluteFill style={{ opacity: env }}>
      <Column>
        <div style={{ ...riseIn(frame, 4, T.canonicalReveal, 12) }}>
          <SealedScroll size={150} />
        </div>
        <div style={{ height: 60 }} />
        <Meta at={16} size={30} color={G.ink70}>
          THE LAW ABOVE POWER
        </Meta>
        <div style={{ height: 26 }} />
        <Meta at={24} size={24} color={G.ink50} tracking="0.24em">
          155 IMMUTABLE PRINCIPLES OF SELF-GOVERNANCE
        </Meta>
        <div style={{ height: 46 }} />
        <div
          style={{
            fontFamily: FONT.verification,
            fontSize: 28,
            letterSpacing: '0.3em',
            color: G.gold,
            opacity: fadeIn(frame, 32, T.metadataFade),
          }}
        >
          PRINCIPLE {film.id} / {film.total}
        </div>
      </Column>
    </AbsoluteFill>
  );
};
