import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C, F } from '../theme';
import { Serif, Mono } from '../components/Chrome';
import { rise, EASE_OUT } from '../anim';

const HANDLES = [
  'anon_4471', 'anon_4472', 'anon_4473', 'anon_4474', 'anon_4475',
  'anon_4476', 'anon_4477', 'anon_4478', 'anon_4479', 'anon_4480',
  'anon_4481', 'anon_4482', 'anon_4483', 'anon_4484', 'anon_4485',
  'anon_4486', 'anon_4487', 'anon_4488', 'anon_4489', 'anon_4490',
];

/** Duplicate ballots pile up — the same person, over and over. */
export const S2Ghosts: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      {/* the pile */}
      <div
        style={{
          position: 'absolute',
          top: 210,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          maskImage:
            'linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 12%, #000 46%, rgba(0,0,0,0) 72%)',
        }}
      >
        {HANDLES.map((h, i) => {
          const at = 4 + i * 3.4;
          const p = interpolate(frame, [at, at + 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE_OUT,
          });
          // rows drain of colour as they stack up
          const fade = interpolate(frame, [at + 14, at + 40], [1, 0.28], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={h}
              style={{
                opacity: p * fade,
                transform: `translateY(${(1 - p) * 22}px)`,
                width: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 30px',
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: C.surface,
              }}
            >
              <span
                style={{
                  fontFamily: F.mono,
                  fontWeight: 500,
                  fontSize: 24,
                  color: C.textSecondary,
                }}
              >
                @{h}
              </span>
              <span
                style={{
                  fontFamily: F.sans,
                  fontWeight: 600,
                  fontSize: 20,
                  letterSpacing: 2,
                  color: C.support,
                  opacity: 0.75,
                }}
              >
                VOTED ✓
              </span>
            </div>
          );
        })}
      </div>

      {/* scrim so the verdict never fights the pile */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(4,7,7,0) 38%, rgba(4,7,7,0.9) 58%, #040707 72%)',
        }}
      />

      {/* verdict */}
      <div
        style={{
          position: 'absolute',
          bottom: 250,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
        }}
      >
        <div style={rise(frame, 40, 26, 24)}>
          <Mono size={19} color={C.textDim}>
            One person · Fifty accounts
          </Mono>
        </div>
        <Serif size={74} style={rise(frame, 50, 30, 26)}>
          So the number
          <br />
          means nothing.
        </Serif>
      </div>
    </AbsoluteFill>
  );
};
