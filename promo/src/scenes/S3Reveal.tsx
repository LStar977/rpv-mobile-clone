import React from 'react';
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { C, F } from '../theme';
import { Hairline, Mono, GoldGlow } from '../components/Chrome';
import { rise, draw, springIn, EASE_OUT } from '../anim';

/** Brand reveal — the seal draws itself, then the wordmark lands. */
export const S3Reveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const pop = springIn(frame, fps, 4, 14);
  const ringP = interpolate(frame, [10, 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });

  const R = 208;
  const CIRC = 2 * Math.PI * R;

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <GoldGlow opacity={interpolate(frame, [8, 40], [0, 1], { extrapolateRight: 'clamp' })} y="38%" />

      <div style={{ position: 'relative', marginBottom: 88 }}>
        {/* sweeping seal ring */}
        <svg
          width={R * 2 + 40}
          height={R * 2 + 40}
          style={{ position: 'absolute', top: -R - 20 + 155, left: -R - 20 + 155 }}
        >
          <circle
            cx={R + 20}
            cy={R + 20}
            r={R}
            fill="none"
            stroke={C.gold}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.55}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - ringP)}
            transform={`rotate(-90 ${R + 20} ${R + 20})`}
          />
        </svg>

        <Img
          src={staticFile('icon.png')}
          style={{
            width: 310,
            height: 310,
            borderRadius: 999,
            transform: `scale(${0.86 + pop * 0.14})`,
            opacity: pop,
          }}
        />
      </div>

      <div
        style={{
          fontFamily: F.serif,
          fontWeight: 500,
          fontSize: 92,
          letterSpacing: 14,
          color: C.text,
          ...rise(frame, 40, 26, 26),
        }}
      >
        REPRESENT
      </div>

      <div style={{ height: 52, display: 'flex', alignItems: 'center' }}>
        <Hairline progress={draw(frame, 58, 24)} width={300} />
      </div>

      <div style={rise(frame, 64, 22, 24)}>
        <Mono size={22} color={C.gold}>
          One verified human · One vote
        </Mono>
      </div>
    </AbsoluteFill>
  );
};
