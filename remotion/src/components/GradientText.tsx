import React from 'react';
import { GOLD_GRADIENT } from '../theme';

export const GradientText: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <span
    style={{
      backgroundImage: GOLD_GRADIENT,
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
      WebkitTextFillColor: 'transparent',
      ...style,
    }}
  >
    {children}
  </span>
);
