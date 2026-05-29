import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background';
import { BallotBox } from '../components/BallotBox';
import { GradientText } from '../components/GradientText';
import { grotesk, serif } from '../fonts';
import { COLORS } from '../theme';

// Headline appears, then the ballot drops & voices erupt beneath it.
export const BallotScene: React.FC = () => {
  const frame = useCurrentFrame();
  const head = interpolate(frame, [44, 64], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const headY = interpolate(frame, [44, 64], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Background auraY="78%" />
      {/* the box + fountain start immediately */}
      <BallotBox startFrame={0} />
      {/* headline overlaid up top, the voices rise into it */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: '11%', fontFamily: grotesk, pointerEvents: 'none' }}>
        <div style={{ opacity: head, transform: `translateY(${headY}px)`, textAlign: 'center', padding: '0 7%' }}>
          <div style={{ color: COLORS.gold, fontSize: 22, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 26 }}>
            Voice beyond the ballot box
          </div>
          <div style={{ color: COLORS.white, fontSize: 84, fontWeight: 500, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
            Your voice doesn't stop
            <br />
            at the{' '}
            <GradientText style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 92 }}>
              ballot box.
            </GradientText>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
