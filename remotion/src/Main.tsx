import React from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { COLORS } from './theme';

import { IntroLogo } from './scenes/IntroLogo';
import { Statement } from './scenes/Statement';
import { Problem } from './scenes/Problem';
import { BallotScene } from './scenes/BallotScene';
import { Shift } from './scenes/Shift';
import { CTA } from './scenes/CTA';

const T = 16; // transition length

const Soundtrack: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // gentle master fade in/out on top of the track's own envelope
  const volume = interpolate(
    frame,
    [0, 12, durationInFrames - 36, durationInFrames - 1],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return <Audio src={staticFile('music.wav')} volume={volume} />;
};

export const Main: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <Soundtrack />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={90}>
          <IntroLogo />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

        <TransitionSeries.Sequence durationInFrames={110}>
          <Statement />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

        <TransitionSeries.Sequence durationInFrames={120}>
          <Problem />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

        <TransitionSeries.Sequence durationInFrames={160}>
          <BallotScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

        <TransitionSeries.Sequence durationInFrames={120}>
          <Shift />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />

        <TransitionSeries.Sequence durationInFrames={140}>
          <CTA />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
