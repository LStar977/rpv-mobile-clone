import React from 'react';
import { Composition } from 'remotion';
import { Main } from './Main';

const FPS = 30;
const DURATION = 660; // ~22s after transition overlaps

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Vertical — Reels / TikTok / Stories / app promo */}
      <Composition
        id="Represent"
        component={Main}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* Square — feed posts */}
      <Composition
        id="RepresentSquare"
        component={Main}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
    </>
  );
};
