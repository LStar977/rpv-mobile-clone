import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C, F } from '../theme';
import { Serif, Mono } from '../components/Chrome';
import { rise } from '../anim';

// deterministic pseudo-hex so every render is identical
const hex = (seed: number, len: number) => {
  let s = '';
  let x = seed * 2654435761;
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    s += '0123456789abcdef'[(x >> 8) % 16];
  }
  return s;
};

const ROWS = Array.from({ length: 22 }).map((_, i) => ({
  id: `0x${hex(i + 7, 8)}…${hex(i + 91, 6)}`,
  time: `2026-07-${String(11 + (i % 18)).padStart(2, '0')} ${String(
    9 + (i % 12)
  ).padStart(2, '0')}:${String((i * 17) % 60).padStart(2, '0')}`,
}));

/** The public record: every ballot leaves a hash anyone can check. */
export const S6Ledger: React.FC = () => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [0, 135], [0, -560]);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* scrolling ledger */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: `translateY(${scroll}px)`,
          opacity: 0.32,
          maskImage:
            'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 20%, #000 74%, rgba(0,0,0,0) 100%)',
        }}
      >
        {ROWS.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 90px',
              height: 92,
              borderBottom: `1px solid ${C.border}`,
              fontFamily: F.mono,
              fontSize: 22,
              color: C.textTertiary,
            }}
          >
            <span>{r.time}</span>
            <span style={{ color: C.textSecondary }}>{r.id}</span>
            <span style={{ color: C.gold, fontSize: 15, letterSpacing: 2 }}>SEALED</span>
          </div>
        ))}
      </div>

      {/* legibility scrim behind the headline */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 96% 34% at 50% 55%, rgba(4,7,7,1) 0%, rgba(4,7,7,0.99) 46%, rgba(4,7,7,0.86) 70%, rgba(4,7,7,0) 100%)',
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0 96px',
        }}
      >
        <Serif size={78} style={rise(frame, 10, 30, 26)}>
          Every ballot is written
          <br />
          to a public ledger.
        </Serif>

        <div style={{ marginTop: 44, ...rise(frame, 34, 24, 24) }}>
          <Mono size={19} color={C.gold}>
            Anyone can audit it · Nobody can edit it
          </Mono>
        </div>

        <div style={{ marginTop: 100, ...rise(frame, 58, 20, 24) }}>
          <Mono size={15} color={C.textDim}>
            Pilot phase · representvote.com/record
          </Mono>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
