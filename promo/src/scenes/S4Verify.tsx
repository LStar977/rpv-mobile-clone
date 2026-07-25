import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, F } from '../theme';
import { Phone, StatusBar } from '../components/Phone';
import { Mono, Sans } from '../components/Chrome';
import { rise, springIn, EASE_OUT, EASE_IN_OUT } from '../anim';

/** Identity check — ID scans, seal turns gold. */
export const S4Verify: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const SCAN_START = 16;
  const SCAN_END = 62;
  const verified = frame > SCAN_END;

  const scanY = interpolate(frame, [SCAN_START, SCAN_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN_OUT,
  });
  const goldize = interpolate(frame, [SCAN_END, SCAN_END + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });
  const badge = springIn(frame, fps, SCAN_END + 4, 13);
  const keep = interpolate(frame, [SCAN_END + 14, SCAN_END + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Phone width={560} style={{ marginBottom: 64 }}>
        <StatusBar />

        <div style={{ padding: '54px 40px 0', height: '100%', position: 'relative' }}>
          <Mono size={15} color={C.textDim} style={{ marginBottom: 10 }}>
            Step 1 of 1
          </Mono>
          <div
            style={{
              fontFamily: F.serif,
              fontSize: 44,
              lineHeight: 1.1,
              color: C.text,
              marginBottom: 46,
            }}
          >
            Prove you're
            <br />
            one person.
          </div>

          {/* ID card */}
          <div
            style={{
              position: 'relative',
              borderRadius: 22,
              padding: 26,
              background: C.surface,
              border: `1.5px solid ${
                verified ? `rgba(234,186,88,${0.25 + goldize * 0.7})` : C.border
              }`,
              boxShadow: verified
                ? `0 0 ${40 * goldize}px rgba(234,186,88,${0.2 * goldize})`
                : 'none',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div
                style={{
                  width: 96,
                  height: 118,
                  borderRadius: 10,
                  background:
                    'linear-gradient(150deg, rgba(244,245,246,0.14) 0%, rgba(244,245,246,0.05) 100%)',
                  border: `1px solid ${C.border}`,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 13,
                    letterSpacing: 2.5,
                    color: C.gold,
                    marginBottom: 14,
                  }}
                >
                  CAN · PASSPORT
                </div>
                {[0.9, 0.62, 0.75].map((w, i) => (
                  <div
                    key={i}
                    style={{
                      height: 11,
                      width: `${w * 100}%`,
                      borderRadius: 6,
                      background: 'rgba(244,245,246,0.12)',
                      marginBottom: 12,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* scan sweep */}
            {frame >= SCAN_START && frame <= SCAN_END + 4 && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: `${scanY * 100}%`,
                  height: 3,
                  background: `linear-gradient(90deg, rgba(234,186,88,0) 0%, ${C.gold} 50%, rgba(234,186,88,0) 100%)`,
                  boxShadow: `0 0 26px 6px rgba(234,186,88,0.45)`,
                }}
              />
            )}
          </div>

          {/* verified pill */}
          <div
            style={{
              marginTop: 38,
              display: 'flex',
              justifyContent: 'center',
              opacity: badge,
              transform: `scale(${0.8 + badge * 0.2})`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 26px',
                borderRadius: 999,
                background: C.goldSurfaceStrong,
                border: `1px solid rgba(234,186,88,0.4)`,
              }}
            >
              <span style={{ color: C.gold, fontSize: 22 }}>✓</span>
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 16,
                  letterSpacing: 3,
                  color: C.gold,
                }}
              >
                VERIFIED
              </span>
            </div>
          </div>

          {/* what the app actually keeps */}
          <div
            style={{
              marginTop: 40,
              opacity: keep,
              transform: `translateY(${(1 - keep) * 16}px)`,
              padding: 24,
              borderRadius: 18,
              background: C.surface,
              border: `1px solid ${C.border}`,
            }}
          >
            <Mono size={12} color={C.textDim} style={{ marginBottom: 14 }}>
              What we keep
            </Mono>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 20,
                letterSpacing: 1,
                color: C.gold,
              }}
            >
              0x7f3c9a…e214b8
            </div>
            <div
              style={{
                fontFamily: F.sans,
                fontSize: 17,
                lineHeight: 1.55,
                color: C.textTertiary,
                marginTop: 14,
              }}
            >
              A one-way hash. It proves you are one real person. It cannot be
              turned back into your documents.
            </div>
          </div>

          {/* primary action */}
          <div
            style={{
              position: 'absolute',
              left: 40,
              right: 40,
              bottom: 46,
              opacity: keep,
              padding: '20px 0',
              borderRadius: 999,
              background: C.gold,
              textAlign: 'center',
              fontFamily: F.sans,
              fontWeight: 700,
              fontSize: 22,
              color: C.bg,
            }}
          >
            Start voting
          </div>
        </div>
      </Phone>

      <div style={{ padding: '0 110px', ...rise(frame, 74, 26, 26) }}>
        <Sans size={31} color={C.text} weight={400}>
          Verified once with government ID —
          <br />
          then reduced to a one-way hash.
        </Sans>
      </div>
    </AbsoluteFill>
  );
};
