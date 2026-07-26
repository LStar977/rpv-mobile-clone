import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from '../theme';
import { Serif, Hairline, Mono } from '../components/Chrome';
import { rise, draw } from '../anim';

export const C3Verdict: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{ justifyContent: 'center', alignItems: 'center', padding: '0 90px' }}
    >
      <Serif size={84} style={rise(frame, 4, 28, 22)}>
        Polls count clicks.
      </Serif>

      <div style={{ height: 56, display: 'flex', alignItems: 'center' }}>
        <Hairline progress={draw(frame, 22, 22)} width={360} />
      </div>

      <Serif size={84} italic color={C.gold} style={rise(frame, 28, 28, 22)}>
        Ballots count people.
      </Serif>

      <div style={{ marginTop: 90, ...rise(frame, 52, 20, 22) }}>
        <Mono size={19} color={C.textTertiary}>
          One verified human · One ballot
        </Mono>
      </div>
    </AbsoluteFill>
  );
};
