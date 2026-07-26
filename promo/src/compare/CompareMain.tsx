import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { C } from '../theme';
import { Grain, Vignette } from '../components/Chrome';
import { sceneFade } from '../anim';
import { C1Title } from './C1Title';
import { C2Split } from './C2Split';
import { C3Verdict } from './C3Verdict';
import { C4Outro } from './C4Outro';

const Scene: React.FC<{ len: number; children: React.ReactNode }> = ({ len, children }) => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: sceneFade(frame, len) }}>{children}</AbsoluteFill>;
};

const TIMELINE: [React.FC, number][] = [
  [C1Title, 80],
  [C2Split, 400],
  [C3Verdict, 105],
  [C4Outro, 115],
];

export const COMPARE_TOTAL = TIMELINE.reduce((a, [, n]) => a + n, 0);

export const CompareMain: React.FC = () => {
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
