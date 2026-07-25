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

export const S8CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = springIn(frame, fps, 2, 15);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <GoldGlow opacity={interpolate(frame, [0, 30], [0, 0.9], { extrapolateRight: 'clamp' })} y="42%" />

      <Img
        src={staticFile('icon.png')}
        style={{
          width: 190,
          height: 190,
          borderRadius: 44,
          opacity: pop,
          transform: `scale(${0.88 + pop * 0.12})`,
          marginBottom: 54,
        }}
      />

      <div
        style={{
          fontFamily: F.serif,
          fontWeight: 500,
          fontSize: 82,
          letterSpacing: 13,
          color: C.text,
          ...rise(frame, 14, 24, 24),
        }}
      >
        REPRESENT
      </div>

      <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
        <Hairline progress={draw(frame, 30, 22)} width={320} />
      </div>

      <div
        style={{
          fontFamily: F.serif,
          fontSize: 46,
          fontStyle: 'italic',
          color: C.textSecondary,
          ...rise(frame, 36, 22, 24),
        }}
      >
        Free on the App Store.
      </div>

      <div
        style={{
          marginTop: 62,
          padding: '24px 58px',
          borderRadius: 999,
          background: C.gold,
          fontFamily: F.sans,
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: 1.5,
          color: C.bg,
          boxShadow: '0 20px 60px rgba(234,186,88,0.22)',
          ...rise(frame, 46, 22, 24),
        }}
      >
        Search “Represent Vote”
      </div>

      <div style={{ marginTop: 70, ...rise(frame, 60, 20, 24) }}>
        <Mono size={21} color={C.gold}>
          representvote.com
        </Mono>
      </div>
    </AbsoluteFill>
  );
};
