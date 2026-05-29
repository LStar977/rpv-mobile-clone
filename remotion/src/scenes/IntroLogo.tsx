import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Logo } from '../components/Logo';
import { grotesk } from '../fonts';
import { COLORS } from '../theme';

export const IntroLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200, mass: 0.9 } });
  const scale = interpolate(s, [0, 1], [0.6, 1]);
  const word = spring({ frame: frame - 16, fps, config: { damping: 200 } });
  const cap = interpolate(frame, [34, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: grotesk }}>
        <div style={{ transform: `scale(${scale})`, opacity: s }}>
          <Logo size={300} glow={0.4} />
        </div>
        <div style={{ overflow: 'hidden', marginTop: 50 }}>
          <div
            style={{
              transform: `translateY(${interpolate(word, [0, 1], [110, 0])}%)`,
              color: COLORS.white,
              fontSize: 96,
              fontWeight: 600,
              letterSpacing: '-0.04em',
            }}
          >
            Represent
          </div>
        </div>
        <div
          style={{
            opacity: cap,
            marginTop: 24,
            color: COLORS.gold,
            fontSize: 26,
            letterSpacing: '0.5em',
            textTransform: 'uppercase',
            paddingLeft: '0.5em',
          }}
        >
          Voice beyond the ballot box
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
