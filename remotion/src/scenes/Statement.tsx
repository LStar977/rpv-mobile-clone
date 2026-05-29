import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background';
import { WordReveal } from '../components/WordReveal';
import { GradientText } from '../components/GradientText';
import { grotesk, serif } from '../fonts';
import { COLORS } from '../theme';

export const Statement: React.FC = () => {
  const frame = useCurrentFrame();
  const sub = interpolate(frame, [54, 72], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 8%', textAlign: 'center', fontFamily: grotesk }}>
        <div style={{ color: COLORS.gold, fontSize: 24, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 40 }}>The problem</div>
        <div style={{ color: COLORS.white, fontSize: 92, fontWeight: 500, lineHeight: 1.06, letterSpacing: '-0.03em' }}>
          <WordReveal text="One vote every four years" />
          <br />
          <GradientText style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 100 }}>
            <WordReveal text="isn't democracy." delay={14} />
          </GradientText>
        </div>
        <div style={{ opacity: sub, marginTop: 46, color: COLORS.muted, fontSize: 34, maxWidth: 760 }}>
          It's a suggestion box with a four-year delay.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
