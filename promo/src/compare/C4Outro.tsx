import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { C, F } from '../theme';
import { Hairline, Mono, GoldGlow } from '../components/Chrome';
import { rise, draw, springIn } from '../anim';

export const C4Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springIn(frame, fps, 2, 15);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <GoldGlow
        opacity={interpolate(frame, [0, 28], [0, 0.85], { extrapolateRight: 'clamp' })}
        y="44%"
      />

      <Img
        src={staticFile('icon.png')}
        style={{
          width: 180,
          height: 180,
          borderRadius: 42,
          opacity: pop,
          transform: `scale(${0.88 + pop * 0.12})`,
          marginBottom: 50,
        }}
      />

      <div
        style={{
          fontFamily: F.serif,
          fontWeight: 500,
          fontSize: 80,
          letterSpacing: 13,
          color: C.text,
          ...rise(frame, 12, 22, 22),
        }}
      >
        REPRESENT
      </div>

      <div style={{ height: 46, display: 'flex', alignItems: 'center' }}>
        <Hairline progress={draw(frame, 26, 20)} width={320} />
      </div>

      <div style={rise(frame, 32, 20, 22)}>
        <Mono size={21} color={C.gold}>
          One verified human · One vote
        </Mono>
      </div>

      <div
        style={{
          marginTop: 64,
          fontFamily: F.serif,
          fontSize: 42,
          fontStyle: 'italic',
          color: C.textSecondary,
          ...rise(frame, 44, 20, 22),
        }}
      >
        Free on the App Store.
      </div>

      <div style={{ marginTop: 56, ...rise(frame, 56, 18, 22) }}>
        <Mono size={20} color={C.textTertiary}>
          representvote.com
        </Mono>
      </div>
    </AbsoluteFill>
  );
};
