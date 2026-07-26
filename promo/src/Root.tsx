import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Main, TOTAL } from './Main';
import { CompareMain, COMPARE_TOTAL } from './compare/CompareMain';

export const RemotionRoot: React.FC = () => (
  <>
    {/* 9:16 — X, Instagram Reels, TikTok, YouTube Shorts */}
    <Composition
      id="PromoVertical"
      component={Main}
      durationInFrames={TOTAL}
      fps={30}
      width={1080}
      height={1920}
    />
    {/* Poll vs ballot split-screen, same canvas */}
    <Composition
      id="PollVsBallot"
      component={CompareMain}
      durationInFrames={COMPARE_TOTAL}
      fps={30}
      width={1080}
      height={1920}
    />
  </>
);
