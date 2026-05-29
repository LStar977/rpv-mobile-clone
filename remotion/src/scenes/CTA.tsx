import React from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Logo } from '../components/Logo';
import { GradientText } from '../components/GradientText';
import { grotesk, serif } from '../fonts';
import { COLORS } from '../theme';

export const CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height: H, width: W } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 200 } });
  const head = interpolate(frame, [14, 32], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cta = interpolate(frame, [30, 48], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const foot = interpolate(frame, [44, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <Background />
      {/* ambient rising motes */}
      {new Array(40).fill(0).map((_, i) => {
        const life = 120 + random(`ml${i}`) * 90;
        const t = ((frame + random(`mb${i}`) * life) % life) / life;
        const x = random(`mx${i}`) * W;
        const y = H - t * H;
        const o = (1 - t) * 0.5;
        const size = random(`ms${i}`) * 8 + 4;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, ${random(`mc${i}`) > 0.5 ? '#FBF1D6' : COLORS.gold} 0%, transparent 70%)`, opacity: o, mixBlendMode: 'screen' }} />
        );
      })}

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '0 8%', textAlign: 'center', fontFamily: grotesk }}>
        <div style={{ transform: `scale(${interpolate(logo, [0, 1], [0.7, 1])})`, opacity: logo }}>
          <Logo size={150} glow={0.35} />
        </div>
        <div style={{ opacity: head, color: COLORS.white, fontSize: 96, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 40 }}>
          Make your{' '}
          <GradientText style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 104 }}>voice</GradientText> heard.
        </div>

        <div style={{ opacity: cta, display: 'flex', gap: 22, marginTop: 56 }}>
          <Badge top="Download on the" bottom="App Store" />
          <Badge top="Get it on" bottom="Google Play" />
        </div>

        <div style={{ opacity: foot, marginTop: 64, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: COLORS.gold, fontSize: 34, letterSpacing: '0.06em', fontWeight: 500 }}>representvote.com</div>
          <div style={{ color: COLORS.faint, fontSize: 22, letterSpacing: '0.12em' }}>© Represent Labs Inc.</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Badge: React.FC<{ top: string; bottom: string }> = ({ top, bottom }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', border: '1px solid rgba(230,178,74,0.4)', borderRadius: 18, padding: '16px 30px', background: 'rgba(230,178,74,0.05)' }}>
    <span style={{ color: COLORS.faint, fontSize: 18 }}>{top}</span>
    <span style={{ color: COLORS.white, fontSize: 30, fontWeight: 600 }}>{bottom}</span>
  </div>
);
