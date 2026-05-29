import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background';
import { GradientText } from '../components/GradientText';
import { grotesk, serif } from '../fonts';
import { COLORS } from '../theme';

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const n = Math.round(interpolate(frame, [6, 64], [0, 1460], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const fill = interpolate(frame, [10, 70], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cap = interpolate(frame, [40, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 8%', textAlign: 'center', fontFamily: grotesk }}>
        <GradientText style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 320, lineHeight: 0.9, letterSpacing: '-0.04em' }}>
          {n.toLocaleString('en-US')}
        </GradientText>
        <div style={{ opacity: cap, color: COLORS.faint, fontSize: 28, letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: 8 }}>
          days of decisions — made without you
        </div>

        {/* 4-year silence timeline */}
        <div style={{ width: '78%', marginTop: 90, position: 'relative' }}>
          <div style={{ height: 4, background: 'rgba(248,246,239,0.1)', borderRadius: 4, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${fill}%`, background: 'linear-gradient(120deg,#F6DB9A,#E6B24A,#C8862E)', borderRadius: 4, boxShadow: '0 0 22px rgba(230,178,74,0.5)' }} />
            <Dot left="0%" />
            <Dot left="100%" show={fill > 98} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, color: COLORS.muted, fontSize: 24 }}>
            <span>You vote</span>
            <span>You vote again</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ left: string; show?: boolean }> = ({ left, show = true }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top: '50%',
      transform: 'translate(-50%,-50%)',
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: COLORS.gold,
      boxShadow: '0 0 0 7px rgba(230,178,74,0.16)',
      opacity: show ? 1 : 0,
    }}
  />
);
