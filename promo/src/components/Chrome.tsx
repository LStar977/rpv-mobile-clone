import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, F } from '../theme';

/** Film grain + vignette, layered over every scene so the black never reads as flat. */
export const Grain: React.FC<{ frame: number }> = ({ frame }) => {
  const shift = (frame % 6) * 37;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: 0.045,
        mixBlendMode: 'overlay',
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>\")",
        backgroundPosition: `${shift}px ${shift * 1.7}px`,
      }}
    />
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background:
        'radial-gradient(ellipse 74% 60% at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.42) 100%)',
    }}
  />
);

/** Faint gold bloom behind hero moments. */
export const GoldGlow: React.FC<{ opacity?: number; y?: string }> = ({
  opacity = 0.5,
  y = '48%',
}) => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      opacity,
      background: `radial-gradient(ellipse 46% 26% at 50% ${y}, rgba(234,186,88,0.16) 0%, rgba(234,186,88,0) 70%)`,
    }}
  />
);

export const Hairline: React.FC<{
  progress: number;
  width?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ progress, width = 420, color = C.gold, style }) => (
  <div
    style={{
      width: width * progress,
      height: 1,
      background: `linear-gradient(90deg, rgba(0,0,0,0) 0%, ${color} 22%, ${color} 78%, rgba(0,0,0,0) 100%)`,
      opacity: 0.9,
      ...style,
    }}
  />
);

export const Mono: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 20, color = C.textTertiary, style }) => (
  <div
    style={{
      fontFamily: F.mono,
      fontWeight: 500,
      fontSize: size,
      letterSpacing: size * 0.22,
      textTransform: 'uppercase',
      color,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Serif: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  italic?: boolean;
  style?: React.CSSProperties;
}> = ({ children, size = 76, color = C.text, italic, style }) => (
  <div
    style={{
      fontFamily: F.serif,
      fontWeight: 400,
      fontStyle: italic ? 'italic' : 'normal',
      fontSize: size,
      lineHeight: 1.14,
      letterSpacing: -size * 0.018,
      color,
      textAlign: 'center',
      ...style,
    }}
  >
    {children}
  </div>
);

export const Sans: React.FC<{
  children: React.ReactNode;
  size?: number;
  weight?: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 28, weight = 400, color = C.textSecondary, style }) => (
  <div
    style={{
      fontFamily: F.sans,
      fontWeight: weight,
      fontSize: size,
      lineHeight: 1.45,
      color,
      textAlign: 'center',
      ...style,
    }}
  >
    {children}
  </div>
);
