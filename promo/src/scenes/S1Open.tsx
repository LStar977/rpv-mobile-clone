import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C } from '../theme';
import { Hairline, Serif, Mono } from '../components/Chrome';
import { rise, draw, EASE_OUT } from '../anim';

/** Cold open — states the problem in two beats. */
export const S1Open: React.FC = () => {
  const frame = useCurrentFrame();
  // slow push-in keeps the still type alive
  const scale = interpolate(frame, [0, 105], [1, 1.045], {
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0 90px',
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ ...rise(frame, 6, 30, 26), marginBottom: 46 }}>
        <Mono size={19} color={C.textDim}>
          The problem
        </Mono>
      </div>

      <Serif size={88} style={rise(frame, 12, 34, 26)}>
        Anyone can
        <br />
        run a poll.
      </Serif>

      <div style={{ height: 54, display: 'flex', alignItems: 'center' }}>
        <Hairline progress={draw(frame, 44, 30)} width={340} />
      </div>

      <Serif size={72} italic color={C.gold} style={rise(frame, 52, 30, 28)}>
        Almost nobody can
        <br />
        prove who voted.
      </Serif>
    </AbsoluteFill>
  );
};
