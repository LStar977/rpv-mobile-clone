import React from 'react';
import { Composition } from 'remotion';
import './fonts';
import { Main, TOTAL } from './Main';

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
  </>
);
