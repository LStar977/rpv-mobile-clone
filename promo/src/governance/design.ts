// Design tokens for the governance film system. Centralized per the build
// spec: brand tokens and timing constants live here, never inline in scenes.
//
// The spec's doctrine in one line: deliberate, mechanical, restrained,
// inevitable. Nothing bounces. Gold marks meaning — one dominant gold idea
// on screen at a time.

import { Easing } from 'remotion';

export const G = {
  obsidian: '#040707',
  gold: '#EABA58',
  goldDim: 'rgba(234,186,88,0.35)',
  goldFaint: 'rgba(234,186,88,0.12)',
  ink: '#F4F5F6',
  // Secondary information is off-white at reduced opacity, per spec —
  // no arbitrary greys.
  ink70: 'rgba(244,245,246,0.70)',
  ink50: 'rgba(244,245,246,0.50)',
  ink30: 'rgba(244,245,246,0.30)',
  line: 'rgba(244,245,246,0.14)',
  lineSoft: 'rgba(244,245,246,0.07)',
};

export const FONT = {
  principle: 'Newsreader', // the voice of principle
  instruction: 'Onest', // the voice of instruction
  verification: 'JetBrainsMono', // the voice of verification
};

// 1080x1920 safe areas (px): platform UI clearance per spec.
export const SAFE = { top: 180, bottom: 300, side: 90, teachingWidth: 800 };

export const FPS = 30;

// Motion timing (frames @30fps), matching the spec's millisecond ranges.
export const T = {
  metadataFade: 10, // ~330ms
  headingReveal: 18, // ~600ms
  canonicalReveal: 24, // ~800ms
  diagnosticReveal: 27, // ~900ms
  lineDraw: 21, // ~700ms
  archivalFade: 26, // ~870ms
  sceneCross: 18, // ~600ms
};

// The only easing family in the system. Deliberate and mechanical —
// no spring, no overshoot, nothing bounces.
export const EASE = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
