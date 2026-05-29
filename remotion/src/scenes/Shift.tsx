import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background';
import { GradientText } from '../components/GradientText';
import { grotesk, serif } from '../fonts';
import { COLORS } from '../theme';

// "From a single vote to a constant voice." — dead dot vs. living equalizer.
export const Shift: React.FC = () => {
  const frame = useCurrentFrame();
  const head = interpolate(frame, [4, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const reveal = interpolate(frame, [26, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bars = 13;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 8%', textAlign: 'center', fontFamily: grotesk }}>
        <div style={{ opacity: head, color: COLORS.white, fontSize: 78, fontWeight: 500, lineHeight: 1.08, letterSpacing: '-0.03em', maxWidth: 920 }}>
          From a single vote to a{' '}
          <GradientText style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 86 }}>
            constant voice.
          </GradientText>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 70, marginTop: 100, opacity: reveal }}>
          {/* old: one dot, then silence */}
          <Panel label="The old way" muted>
            <div style={{ display: 'flex', alignItems: 'center', width: 320 }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: COLORS.faint }} />
              <span style={{ flex: 1, height: 3, background: 'rgba(248,246,239,0.1)' }} />
            </div>
          </Panel>

          <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 56, color: COLORS.gold }}>→</span>

          {/* new: living equalizer */}
          <Panel label="With Represent">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 90 }}>
              {new Array(bars).fill(0).map((_, i) => {
                const h = 30 + (Math.sin(frame * 0.18 + i * 0.7) * 0.5 + 0.5) * 60;
                return (
                  <span
                    key={i}
                    style={{
                      width: 12,
                      height: h,
                      borderRadius: 6,
                      background: 'linear-gradient(180deg,#F6DB9A,#C8862E)',
                    }}
                  />
                );
              })}
            </div>
          </Panel>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Panel: React.FC<{ label: string; muted?: boolean; children: React.ReactNode }> = ({ label, muted, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
    <div style={{ fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase', color: muted ? COLORS.faint : COLORS.gold }}>{label}</div>
    {children}
  </div>
);
