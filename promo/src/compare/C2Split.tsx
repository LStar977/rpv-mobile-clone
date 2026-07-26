import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C, F } from '../theme';
import { Mono } from '../components/Chrome';
import { rise, EASE_OUT } from '../anim';

const BLUE = '#5B8DEF';
const QUESTION = 'Should the city extend weekend transit to 1 a.m.?';

// Deterministic wobble — chunked rendering re-mounts components, so nothing
// here may depend on randomness or wall-clock time, only on the frame.
const wob = (f: number, speed: number, amp: number, phase: number) =>
  Math.sin(f * speed + phase) * amp;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── Poll half ────────────────────────────────────────────────────────────────

// The joke is in the stream: the same guy keeps voting.
const POLL_STREAM = [
  '@kmart_stan voted',
  '@brad_2 voted',
  '@yyc_realtalk voted',
  '@brad_2 voted again',
  '@sunny4hire voted',
  '@brad_2 · 3rd vote',
  '@pollcrusher_9 voted',
  '@brad_2 · 4th vote',
  '@newacct48211 voted',
  '@brad_2 · 5th vote',
  '@newacct48212 voted',
  '@newacct48213 voted',
  '@brad_2 · 6th vote',
  '@newacct48214 voted',
  '@brad_2 · 7th vote',
  '@newacct48215 voted',
  '@brad_2 · 8th vote',
  '@newacct48216 voted',
  '@brad_2 · 9th vote',
  '@newacct48217 voted',
];
const STREAM_START = 66;
const STREAM_EVERY = 13;
const CAPTION_AT = 320;

const PollPanel: React.FC<{ frame: number }> = ({ frame }) => {
  // percentages thrash — no settling, ever
  const yesPct = clamp(
    Math.round(52 + wob(frame, 0.11, 16, 0) + wob(frame, 0.043, 11, 2) + wob(frame, 0.019, 8, 5)),
    9,
    91
  );

  const votes = Math.floor(
    interpolate(frame, [36, 380], [3, 8942], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE_OUT,
    })
  );

  const appeared = Math.max(
    0,
    Math.min(POLL_STREAM.length, Math.floor((frame - STREAM_START) / STREAM_EVERY) + 1)
  );

  const bar = (label: string, pct: number) => (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          position: 'relative',
          height: 62,
          borderRadius: 12,
          background: 'rgba(91,141,239,0.10)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            background: 'rgba(91,141,239,0.32)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px',
            fontFamily: F.sans,
            fontWeight: 600,
            fontSize: 24,
            color: C.text,
          }}
        >
          <span>{label}</span>
          <span style={{ color: BLUE }}>{pct}%</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding: '84px 74px 0', height: '100%', position: 'relative' }}>
      {/* corner tag */}
      <div
        style={{
          position: 'absolute',
          top: 26,
          left: 74,
          padding: '8px 18px',
          borderRadius: 999,
          border: '1px solid rgba(91,141,239,0.45)',
          fontFamily: F.mono,
          fontSize: 15,
          letterSpacing: 3,
          color: BLUE,
          ...rise(frame, 2, 14, 16),
        }}
      >
        A POLL
      </div>

      {/* generic product header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 22,
          ...rise(frame, 8, 16, 18),
        }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 8, background: BLUE }} />
        <span style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 24, color: C.text }}>
          QuickPoll
        </span>
      </div>

      <div
        style={{
          fontFamily: F.sans,
          fontWeight: 600,
          fontSize: 31,
          lineHeight: 1.3,
          color: C.text,
          marginBottom: 28,
          maxWidth: 700,
          ...rise(frame, 14, 18, 18),
        }}
      >
        {QUESTION}
      </div>

      <div style={rise(frame, 22, 18, 18)}>
        {bar('Yes', yesPct)}
        {bar('No', 100 - yesPct)}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginTop: 6,
          ...rise(frame, 30, 16, 18),
        }}
      >
        <span
          style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 40, color: C.text }}
        >
          {votes.toLocaleString()}
        </span>
        <span style={{ fontFamily: F.sans, fontSize: 22, color: C.textTertiary }}>
          votes
        </span>
      </div>

      {/* vote stream — newest at the bottom, older rows pushed up and faded */}
      <div
        style={{
          position: 'relative',
          marginTop: 34,
          height: 190,
          overflow: 'hidden',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 45%)',
        }}
      >
        {POLL_STREAM.slice(0, appeared).map((s, i) => {
          const isBrad = s.includes('brad_2');
          const offset = (appeared - 1 - i) * 46;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                bottom: offset,
                left: 0,
                fontFamily: F.mono,
                fontSize: 19,
                color: isBrad ? BLUE : C.textTertiary,
                opacity: clamp(1 - offset / 160, 0, 1),
              }}
            >
              {s} <span style={{ opacity: 0.7 }}>✓</span>
            </div>
          );
        })}
      </div>

      {/* the problem, stated */}
      <div
        style={{
          position: 'absolute',
          left: 74,
          right: 74,
          bottom: 64,
          fontFamily: F.sans,
          fontSize: 24,
          color: C.textSecondary,
          ...rise(frame, CAPTION_AT, 18, 20),
        }}
      >
        From how many people?{' '}
        <span style={{ color: BLUE, fontWeight: 600 }}>No way to know.</span>
      </div>
    </div>
  );
};

// ── Represent half ───────────────────────────────────────────────────────────

const FILL_AT = [50, 100, 150, 200, 252, 300, 348];

const BallotPanel: React.FC<{ frame: number }> = ({ frame }) => {
  const filled = FILL_AT.filter((t) => frame >= t).length;

  return (
    <div style={{ padding: '84px 74px 0', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 26,
          left: 74,
          padding: '8px 18px',
          borderRadius: 999,
          border: '1px solid rgba(234,186,88,0.5)',
          background: C.goldSurface,
          fontFamily: F.mono,
          fontSize: 15,
          letterSpacing: 3,
          color: C.gold,
          ...rise(frame, 2, 14, 16),
        }}
      >
        A BALLOT
      </div>

      {/* ballot card, in the house style */}
      <div
        style={{
          marginTop: 24,
          borderRadius: 24,
          border: `1px solid ${C.borderStrong}`,
          background: C.surface,
          padding: '40px 42px 36px',
          ...rise(frame, 10, 20, 20),
        }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <span
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              background: 'rgba(244,245,246,0.07)',
              fontFamily: F.mono,
              fontSize: 14,
              letterSpacing: 2.4,
              color: C.textSecondary,
            }}
          >
            CALGARY · PUBLIC
          </span>
          <span
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              border: '1px solid rgba(234,186,88,0.4)',
              fontFamily: F.mono,
              fontSize: 14,
              letterSpacing: 2.4,
              color: C.gold,
            }}
          >
            ● LIVE
          </span>
        </div>

        <div
          style={{
            fontFamily: F.serif,
            fontSize: 44,
            lineHeight: 1.22,
            color: C.text,
            marginBottom: 36,
          }}
        >
          {QUESTION}
        </div>

        {/* 25 threshold dots — 25×26 + 24×8 = 842px, inside the card's 848px */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {Array.from({ length: 25 }).map((_, i) => {
            const at = FILL_AT[i];
            const p =
              at === undefined
                ? 0
                : interpolate(frame, [at, at + 10], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                    easing: EASE_OUT,
                  });
            return (
              <div
                key={i}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background:
                    i < FILL_AT.length
                      ? `rgba(234,186,88,${0.16 + p * 0.84})`
                      : 'rgba(244,245,246,0.09)',
                  transform: `scale(${i < FILL_AT.length ? 0.9 + p * 0.1 : 0.9})`,
                }}
              />
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 17,
              letterSpacing: 2,
              color: C.gold,
            }}
          >
            {filled} OF 25 BALLOTS
          </span>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 15,
              letterSpacing: 2,
              color: C.textTertiary,
            }}
          >
            TALLY VISIBLE AT 25
          </span>
        </div>
      </div>

      {/* one verified line per fill — the slow, human cadence */}
      <div style={{ marginTop: 34, minHeight: 40 }}>
        {FILL_AT.map((t, i) => {
          const isLatest = filled === i + 1;
          if (!isLatest || frame < t) return null;
          const p = interpolate(frame, [t, t + 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE_OUT,
          });
          return (
            <div
              key={i}
              style={{
                opacity: p,
                transform: `translateY(${(1 - p) * 12}px)`,
                fontFamily: F.mono,
                fontSize: 19,
                letterSpacing: 1.5,
                color: C.textSecondary,
              }}
            >
              <span style={{ color: C.gold }}>✓</span> Verified human · ballot
              sealed on the public record
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 74,
          right: 74,
          bottom: 64,
          fontFamily: F.sans,
          fontSize: 24,
          color: C.textSecondary,
          ...rise(frame, CAPTION_AT, 18, 20),
        }}
      >
        {FILL_AT.length} ballots.{' '}
        <span style={{ color: C.gold, fontWeight: 600 }}>
          {FILL_AT.length} people. Provably.
        </span>
      </div>
    </div>
  );
};

// ── The split ────────────────────────────────────────────────────────────────

export const C2Split: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%' }}>
        <PollPanel frame={frame} />
      </div>

      {/* divider */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          height: 1,
          background: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${C.gold} 30%, ${C.gold} 70%, rgba(0,0,0,0) 100%)`,
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '8px 20px',
          borderRadius: 999,
          background: C.bg,
          border: `1px solid ${C.borderStrong}`,
          zIndex: 5,
          ...rise(frame, 6, 10, 16),
        }}
      >
        <Mono size={15} color={C.textSecondary}>
          Same question
        </Mono>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' }}>
        <BallotPanel frame={frame} />
      </div>
    </AbsoluteFill>
  );
};
