import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { C } from './theme';
import { Grain, Vignette } from './components/Chrome';
import { sceneFade } from './anim';
import { S1Open } from './scenes/S1Open';
import { S2Ghosts } from './scenes/S2Ghosts';
import { S3Reveal } from './scenes/S3Reveal';
import { S4Verify } from './scenes/S4Verify';
import { S5Ballot } from './scenes/S5Ballot';
import { S6Ledger } from './scenes/S6Ledger';
import { S7Orgs } from './scenes/S7Orgs';
import { S8CTA } from './scenes/S8CTA';

/** Fades each scene up from and back to black so cuts feel edited, not stitched. */
const Scene: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: sceneFade(frame, len) }}>{children}</AbsoluteFill>;
};

const TIMELINE: [React.FC, number][] = [
  [S1Open, 105],
  [S2Ghosts, 120],
  [S3Reveal, 120],
  [S4Verify, 135],
  [S5Ballot, 180],
  [S6Ledger, 135],
  [S7Orgs, 105],
  [S8CTA, 120],
];

export const TOTAL = TIMELINE.reduce((a, [, n]) => a + n, 0);

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  let cursor = 0;

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {TIMELINE.map(([Comp, len], i) => {
        const from = cursor;
        cursor += len;
        return (
          <Sequence key={i} from={from} durationInFrames={len}>
            <Scene len={len}>
              <Comp />
            </Scene>
          </Sequence>
        );
      })}

      <Vignette />
      <Grain frame={frame} />

      {/* hairline playback progress along the bottom edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 3,
          width: `${interpolate(frame, [0, durationInFrames], [0, 100])}%`,
          background: `linear-gradient(90deg, ${C.goldDark}, ${C.gold})`,
          opacity: 0.55,
        }}
      />
    </AbsoluteFill>
  );
};
