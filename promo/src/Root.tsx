import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Main, TOTAL } from './Main';
import { CompareMain, COMPARE_TOTAL } from './compare/CompareMain';
import { PrincipleVertical, filmDuration } from './governance/PrincipleVertical';
import { PRINCIPLE_001 } from './governance/data/principle-001';

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
    {/* The Law Above Power — governance literacy film system. One composition
        per principle, all driven by data files in governance/data/. */}
    <Composition
      id="Principle001"
      component={PrincipleVertical}
      durationInFrames={filmDuration(PRINCIPLE_001)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ film: PRINCIPLE_001 }}
    />
  </>
);
