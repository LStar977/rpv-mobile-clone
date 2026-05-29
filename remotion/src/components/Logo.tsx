import React from 'react';
import { Img, staticFile } from 'remotion';

export const Logo: React.FC<{ size: number; glow?: number }> = ({
  size,
  glow = 0,
}) => (
  <div
    style={{
      width: size,
      height: size,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {glow > 0 && (
      <div
        style={{
          position: 'absolute',
          inset: -size * 0.25,
          borderRadius: '50%',
          background: `radial-gradient(50% 50% at 50% 50%, rgba(230,178,74,${glow}), transparent 70%)`,
        }}
      />
    )}
    <Img src={staticFile('logo.png')} style={{ width: '100%', height: '100%' }} />
  </div>
);
