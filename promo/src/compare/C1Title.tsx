import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { C } from '../theme';
import { Serif, Mono, Hairline } from '../components/Chrome';
import { rise, draw, EASE_OUT } from '../anim';

/** Cold open — one question, two counting machines. */
export const C1Title: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 75], [1, 1.04], {
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
      <div style={{ ...rise(frame, 4, 24, 20), marginBottom: 44 }}>
        <Mono size={19} color={C.textDim}>
          The difference
        </Mono>
      </div>

      <Serif size={92} style={rise(frame, 10, 30, 22)}>
        Same question.
      </Serif>

      <div style={{ height: 50, display: 'flex', alignItems: 'center' }}>
        <Hairline progress={draw(frame, 28, 22)} width={340} />
      </div>

      <Serif size={76} italic color={C.gold} style={rise(frame, 34, 26, 22)}>
        Two ways to count.
      </Serif>
    </AbsoluteFill>
  );
};
