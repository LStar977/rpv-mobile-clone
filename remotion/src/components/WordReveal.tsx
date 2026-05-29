import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Staggered word-by-word rise-in.
export const WordReveal: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  style?: React.CSSProperties;
}> = ({ text, delay = 0, stagger = 3, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(' ');
  return (
    <span style={style}>
      {words.map((w, i) => {
        const s = spring({
          frame: frame - delay - i * stagger,
          fps,
          config: { damping: 200, mass: 0.7 },
        });
        const y = interpolate(s, [0, 1], [44, 0]);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${y}px)`,
              opacity: s,
              marginRight: '0.26em',
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
};
