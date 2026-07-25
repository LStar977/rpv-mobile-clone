import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, F } from '../theme';
import { Phone, StatusBar, TabBar } from '../components/Phone';
import { Mono, Sans } from '../components/Chrome';
import { rise, springIn, EASE_OUT } from '../anim';

const TAP = 46;
const SEAL = 64;
const TALLY = 92;

const OptionCard: React.FC<{
  label: string;
  chosen: boolean;
  press: number;
  fade: number;
}> = ({ label, chosen, press, fade }) => (
  <div
    style={{
      opacity: fade,
      transform: `scale(${1 - press * 0.03})`,
      padding: '26px 28px',
      borderRadius: 18,
      background: chosen ? C.goldSurface : C.surface,
      border: `1.5px solid ${chosen ? 'rgba(234,186,88,0.55)' : C.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <span
      style={{
        fontFamily: F.sans,
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: 1,
        color: chosen ? C.gold : C.text,
      }}
    >
      {label}
    </span>
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        border: `1.5px solid ${chosen ? C.gold : 'rgba(244,245,246,0.2)'}`,
        background: chosen ? C.gold : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: C.bg,
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      {chosen ? '✓' : ''}
    </div>
  </div>
);

/** The product itself: cast a ballot, then meet the threshold rule. */
export const S5Ballot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chosen = frame >= TAP + 4;
  const press = interpolate(frame, [TAP, TAP + 5, TAP + 12], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ripple = interpolate(frame, [TAP, TAP + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });
  const sealP = springIn(frame, fps, SEAL, 14);
  // options give way to the tally card
  const swap = interpolate(frame, [TALLY, TALLY + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });

  const FILLED = 3; // 8 of 25 ballots → 3 of 10 dots

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Phone width={560} style={{ marginBottom: 60 }}>
        <StatusBar />

        <div style={{ padding: '54px 40px 0', position: 'relative' }}>
          <div style={rise(frame, 4, 20, 20)}>
            <Mono size={14} color={C.gold} style={{ marginBottom: 14 }}>
              Public ballot · Calgary
            </Mono>
          </div>

          <div
            style={{
              fontFamily: F.serif,
              fontSize: 40,
              lineHeight: 1.16,
              color: C.text,
              marginBottom: 40,
              ...rise(frame, 10, 22, 22),
            }}
          >
            Should the city extend
            <br />
            weekend transit service
            <br />
            to 1 a.m.?
          </div>

          {/* options → tally swap */}
          <div style={{ position: 'relative', minHeight: 260 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                opacity: 1 - swap,
                transform: `translateY(${-swap * 18}px)`,
              }}
            >
              <div style={{ position: 'relative' }}>
                <OptionCard
                  label="SUPPORT"
                  chosen={chosen}
                  press={press}
                  fade={interpolate(frame, [22, 34], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}
                />
                {frame >= TAP && frame < TAP + 24 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: 120,
                      height: 120,
                      marginLeft: -60,
                      marginTop: -60,
                      borderRadius: 999,
                      border: `2px solid ${C.gold}`,
                      transform: `scale(${0.3 + ripple * 1.5})`,
                      opacity: 1 - ripple,
                    }}
                  />
                )}
              </div>
              <OptionCard
                label="OPPOSE"
                chosen={false}
                press={0}
                fade={interpolate(frame, [28, 40], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}
              />

              {/* seal confirmation */}
              <div
                style={{
                  marginTop: 12,
                  display: 'flex',
                  justifyContent: 'center',
                  opacity: sealP,
                  transform: `translateY(${(1 - sealP) * 16}px)`,
                }}
              >
                <Mono size={15} color={C.gold}>
                  ✓ Ballot sealed
                </Mono>
              </div>
            </div>

            {/* early tally card */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: swap,
                transform: `translateY(${(1 - swap) * 22}px)`,
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  padding: '26px 26px 28px',
                  borderRadius: 20,
                  background: C.goldSurface,
                  border: '1px solid rgba(234,186,88,0.35)',
                }}
              >
                <Mono size={13} color={C.gold} style={{ marginBottom: 20 }}>
                  Early voting
                </Mono>

                <div style={{ display: 'flex', gap: 9, marginBottom: 18 }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 9,
                        borderRadius: 999,
                        background: i < FILLED ? C.gold : 'rgba(234,186,88,0.18)',
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 18,
                  }}
                >
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 15,
                      letterSpacing: 2,
                      color: C.text,
                    }}
                  >
                    8 OF 25
                  </span>
                  <span
                    style={{
                      fontFamily: F.mono,
                      fontSize: 13,
                      letterSpacing: 2,
                      color: C.textTertiary,
                    }}
                  >
                    TALLY AT 25
                  </span>
                </div>

                <div
                  style={{
                    paddingTop: 16,
                    borderTop: `1px solid rgba(234,186,88,0.2)`,
                    fontFamily: F.sans,
                    fontSize: 19,
                    color: C.textSecondary,
                  }}
                >
                  Your ballot:{' '}
                  <span style={{ color: C.gold, fontWeight: 600 }}>SUPPORT</span> ·
                  recorded
                </div>
              </div>
            </div>
          </div>

          {/* the rest of the queue, softly present */}
          <div style={{ marginTop: 34, opacity: 0.42 }}>
            <Mono size={12} color={C.textDim} style={{ marginBottom: 16 }}>
              Next in your queue
            </Mono>
            {[
              'Should council publish all lobbying meetings?',
              'Fund the downtown library expansion?',
            ].map((q) => (
              <div
                key={q}
                style={{
                  padding: '20px 22px',
                  marginBottom: 12,
                  borderRadius: 16,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  fontFamily: F.serif,
                  fontSize: 24,
                  lineHeight: 1.25,
                  color: C.textSecondary,
                }}
              >
                {q}
              </div>
            ))}
          </div>
        </div>

        <TabBar active="VOTE" />
      </Phone>

      <div style={{ padding: '0 100px', ...rise(frame, 118, 26, 26) }}>
        <Sans size={31} color={C.text}>
          The split stays sealed until 25 verified
          <br />
          ballots. No bandwagon. No early spin.
        </Sans>
      </div>
    </AbsoluteFill>
  );
};
