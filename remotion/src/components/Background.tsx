import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { COLORS } from '../theme';

// Black canvas + breathing gold aura + film grain.
export const Background: React.FC<{ auraY?: string }> = ({ auraY = '50%' }) => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + 0.5 * Math.sin(frame / 36);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.black }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(50% 42% at 50% ${auraY}, rgba(230,178,74,${0.1 +
            pulse * 0.06}), transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(60% 50% at 18% 12%, rgba(230,178,74,0.05), transparent 60%)',
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.06,
          mixBlendMode: 'overlay',
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* soft vignette */}
      <AbsoluteFill
        style={{
          boxShadow: 'inset 0 0 320px 120px rgba(0,0,0,0.7)',
        }}
      />
    </AbsoluteFill>
  );
};
