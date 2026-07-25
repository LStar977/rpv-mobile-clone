import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, F } from '../theme';
import { Serif, Sans } from '../components/Chrome';
import { rise } from '../anim';

const PILLS = [
  'UNLIMITED BALLOTS',
  'INSTANT RESULTS',
  'ADVANCED ANALYTICS',
  'SUB-GROUPS',
  'VERIFIED ROSTERS',
];

/** The org pitch — features first. */
export const S7Orgs: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px' }}
    >
      <Serif size={78} style={rise(frame, 4, 30, 24)}>
        Run your union, party
        <br />
        or board the same way.
      </Serif>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 16,
          marginTop: 60,
          maxWidth: 880,
        }}
      >
        {PILLS.map((p, i) => (
          <div
            key={p}
            style={{
              ...rise(frame, 22 + i * 5, 20, 20),
              padding: '16px 28px',
              borderRadius: 999,
              border: '1px solid rgba(234,186,88,0.35)',
              background: C.goldSurface,
              fontFamily: F.mono,
              fontSize: 19,
              letterSpacing: 2.6,
              color: C.gold,
            }}
          >
            {p}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 66, ...rise(frame, 56, 24, 24) }}>
        <Sans size={31} color={C.text}>
          Ask your members anything.
          <br />
          Get an answer they can't dispute.
        </Sans>
      </div>
    </AbsoluteFill>
  );
};
