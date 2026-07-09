import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AccessibilityInfo, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FONTS, ANIMATION, EASING } from '../../lib/theme';
import { heavyTap, errorNotification } from '../../lib/haptics';

// ═══════════════════════════════════════════════════════════════════════════════
// X1 · CONFIRM-BEFORE-CAST SHEET
//
// The mandatory stop between choosing a side and writing it to the ledger.
// A bottom sheet over a 75% scrim: the ballot question VERBATIM in serif,
// the chosen side rendered in GOLD (the committed-ballot color — never
// green/red), the permanence warning, then Confirm (gold) / Go Back.
//
// After Confirm the sheet transitions to the "ballot cast" seal state:
// the Momentous ballot seal — a gold ring draws around the seal circle in
// real time over ANIMATION.motion.momentous (900ms, standard easing), and
// when the ring closes the checkmark stamps in with overshoot + a heavy
// haptic. Then it auto-dismisses (share pill stretches the window).
//
// Honesty: when the parent reports submission status via the optional
// `castState` prop, the seal never claims completion it doesn't have —
// the ring holds at ~85% while 'pending', only completes and stamps on
// 'confirmed', and reverses in red on 'failed' with a retry/dismiss row.
// When `castState` is absent, behavior matches the legacy contract: the
// ring draws fully and stamps immediately on entering the cast state.
//
// Reduced motion: the ring-draw is replaced with a 160ms crossfade + haptic.
//
// Back-compat: when `onConfirm` is not provided the sheet skips straight to
// the cast/seal state, behaving like the old post-vote overlay.
// ═══════════════════════════════════════════════════════════════════════════════

const SEAL_SIZE = 72;
const RING_STROKE = 2.5;
const RING_RADIUS = (SEAL_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Redesign standard curve cubic-bezier(.2,0,0,1) and the ballot-seal
// checkmark overshoot cubic-bezier(.34,1.3,.5,1), from lib/theme EASING.
const STANDARD_EASING = Easing.bezier(...EASING.standard);
const OVERSHOOT_EASING = Easing.bezier(...EASING.overshoot);

interface VoteConfirmationOverlayProps {
  visible: boolean;
  voteType: 'support' | 'oppose';
  onDismiss: () => void;
  /** The ballot question, rendered verbatim in serif on the confirm sheet. */
  question?: string;
  /**
   * Called when the user presses "Cast Ballot". When provided, the sheet is a
   * mandatory confirm step: nothing is cast until this fires.
   */
  onConfirm?: () => void;
  // When provided, a "Share your vote" pill renders on the cast state and the
  // auto-dismiss window stretches to give it a beat. This is the single
  // cheapest viral moment in the app — the user just acted and is at peak
  // motivation to tell someone.
  // May return a promise (e.g. the native Share dialog) — the sheet stays
  // open until it settles so the share presentation isn't torn down.
  onShare?: () => void | Promise<unknown>;
  /**
   * OPTIONAL truthfulness channel. When the parent reports actual submission
   * status here, the seal reflects it instead of pretending:
   *   'pending'   → gold ring draws and HOLDS at ~85%; no checkmark, no
   *                 "cast" claim, no auto-dismiss.
   *   'confirmed' → ring completes, checkmark stamps with overshoot + heavy
   *                 haptic, auto-dismiss timer starts.
   *   'failed'    → ring turns red (colors.oppose) and reverses; a
   *                 Try Again / Dismiss row appears. Never auto-dismisses.
   * When ABSENT, legacy behavior: the ring draws fully and stamps as soon as
   * the cast state is entered (parent submits fire-and-forget today).
   */
  castState?: 'pending' | 'confirmed' | 'failed';
  /**
   * Called by the "Try Again" button on the 'failed' state. Falls back to
   * `onConfirm` when omitted; if neither exists only Dismiss is offered.
   */
  onRetry?: () => void;
}

export function VoteConfirmationOverlay({
  visible,
  voteType,
  onDismiss,
  question,
  onConfirm,
  onShare,
  castState,
  onRetry,
}: VoteConfirmationOverlayProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'confirm' | 'cast'>(onConfirm ? 'confirm' : 'cast');
  // True while the native share dialog is up — blocks auto-dismiss.
  const sharingRef = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const scrimOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(480);
  const sealScale = useSharedValue(0);
  const ringProgress = useSharedValue(0); // 0 → 1 around the seal circle
  const checkScale = useSharedValue(0);

  const sideLabel = voteType === 'support' ? 'Support' : 'Oppose';
  const isFailed = castState === 'failed';
  const isPending = castState === 'pending';
  const isSealed = castState === undefined || castState === 'confirmed';

  // Respect reduced motion — queried on each open so the setting is honored
  // without needing a remount.
  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    return () => {
      mounted = false;
    };
  }, [visible]);

  // Entrance / reset
  useEffect(() => {
    if (visible) {
      setPhase(onConfirm ? 'confirm' : 'cast');
      scrimOpacity.value = withTiming(1, { duration: ANIMATION.motion.quick });
      sheetTranslate.value = withSpring(0, ANIMATION.spring.gentle);
    } else {
      scrimOpacity.value = 0;
      sheetTranslate.value = 480;
      sealScale.value = 0;
      ringProgress.value = 0;
      checkScale.value = 0;
    }
  }, [visible]);

  // The checkmark stamp: overshoot cubic-bezier(.34,1.3,.5,1) + heavy haptic.
  // Runs on the JS thread (invoked via runOnJS from the ring's completion).
  const stampCheckmark = () => {
    heavyTap();
    checkScale.value = withTiming(1, {
      duration: ANIMATION.motion.quick,
      easing: OVERSHOOT_EASING,
    });
  };

  // Cast state: the Momentous ballot seal. Auto-dismiss only once the seal is
  // truthfully complete (legacy mode, or castState === 'confirmed') — with a
  // long enough window to actually read it and tap the share pill. Tapping
  // share cancels the timer (sharingRef) so the sheet never dismisses out
  // from under the native share dialog.
  useEffect(() => {
    if (!visible || phase !== 'cast') return;

    let dismissTimer: ReturnType<typeof setTimeout> | undefined;
    const startAutoDismiss = () => {
      dismissTimer = setTimeout(() => {
        if (sharingRef.current) return;
        scrimOpacity.value = withTiming(0, { duration: ANIMATION.motion.quick });
        sheetTranslate.value = withTiming(480, { duration: ANIMATION.motion.quick }, () => {
          runOnJS(onDismiss)();
        });
      }, onShare ? 6000 : 2400);
    };

    if (reduceMotion) {
      // Reduced motion: no ring-draw — a 160ms crossfade to the final state.
      sealScale.value = withTiming(1, { duration: 160 });
      if (castState === undefined || castState === 'confirmed') {
        ringProgress.value = withTiming(1, { duration: 160 });
        checkScale.value = withTiming(1, { duration: 160 });
        heavyTap();
        startAutoDismiss();
      } else if (castState === 'pending') {
        ringProgress.value = withTiming(0.85, { duration: 160 });
        checkScale.value = withTiming(0, { duration: 160 });
      } else {
        // failed
        ringProgress.value = withTiming(0, { duration: 160 });
        checkScale.value = withTiming(0, { duration: 160 });
        errorNotification();
      }
    } else {
      // The seal circle settles in quickly while the ring draws around it.
      sealScale.value = withTiming(1, {
        duration: ANIMATION.motion.quick,
        easing: STANDARD_EASING,
      });

      if (castState === undefined) {
        // Legacy: draw the full ring over the momentous beat, then stamp.
        ringProgress.value = withTiming(
          1,
          { duration: ANIMATION.motion.momentous, easing: STANDARD_EASING },
          (finished) => {
            if (finished) runOnJS(stampCheckmark)();
          }
        );
        startAutoDismiss();
      } else if (castState === 'pending') {
        // Honest: draw to ~85% and hold — the ledger hasn't answered yet.
        checkScale.value = withTiming(0, { duration: ANIMATION.motion.instant });
        ringProgress.value = withTiming(0.85, {
          duration: Math.round(ANIMATION.motion.momentous * 0.85),
          easing: STANDARD_EASING,
        });
      } else if (castState === 'confirmed') {
        // Close the remaining arc, then stamp.
        ringProgress.value = withTiming(
          1,
          { duration: ANIMATION.motion.quick, easing: STANDARD_EASING },
          (finished) => {
            if (finished) runOnJS(stampCheckmark)();
          }
        );
        startAutoDismiss();
      } else {
        // Failed: the ring reverses — the seal visibly un-makes itself.
        checkScale.value = withTiming(0, { duration: ANIMATION.motion.instant });
        ringProgress.value = withTiming(0, {
          duration: ANIMATION.motion.deliberate,
          easing: STANDARD_EASING,
        });
        errorNotification();
      }
    }

    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [visible, phase, castState, reduceMotion]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslate.value }],
  }));

  const sealStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sealScale.value }],
    opacity: sealScale.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: Math.min(checkScale.value, 1),
  }));

  // The gold ring draws by animating strokeDashoffset in real time.
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  if (!visible) return null;

  const handleConfirm = () => {
    onConfirm?.();
    setPhase('cast');
  };

  const handleGoBack = () => {
    scrimOpacity.value = withTiming(0, { duration: ANIMATION.motion.quick });
    sheetTranslate.value = withTiming(480, { duration: ANIMATION.motion.quick }, () => {
      runOnJS(onDismiss)();
    });
  };

  const handleRetry = onRetry ?? onConfirm;

  const castTitle = isFailed
    ? 'Ballot not cast'
    : isPending
      ? `Casting ballot — ${sideLabel}`
      : `Ballot cast — ${sideLabel}`;
  const castSub = isFailed
    ? 'NOTHING WAS RECORDED ON THE LEDGER'
    : isPending
      ? 'WRITING TO THE PUBLIC LEDGER…'
      : 'RECORDED ON THE PUBLIC LEDGER · COUNTED EXACTLY ONCE';

  return (
    // Modal so the sheet renders above the floating tab bar — as a plain
    // absolute-positioned view it slides up BEHIND the tab bar, clipping the
    // seal's share pill and leaving the tabs tappable mid-cast.
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={phase === 'confirm' ? handleGoBack : undefined}>
    <View style={styles.root} pointerEvents="auto">
      {/* 75% scrim — the queue stays dimly visible behind the decision */}
      <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay }, scrimStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={phase === 'confirm' ? handleGoBack : undefined} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.backgroundElevated,
            borderColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          },
          sheetStyle,
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.surfaceHighlight }]} />

        {phase === 'confirm' ? (
          <>
            <View style={styles.headerBlock}>
              <Text style={[styles.eyebrow, { color: colors.gold }]}>CONFIRM YOUR BALLOT</Text>
              {!!question && (
                <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
              )}
            </View>

            {/* The chosen side — rendered in GOLD, the committed-ballot color */}
            <View
              style={[
                styles.ballotRow,
                { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.4)' },
              ]}
            >
              <View style={styles.ballotCol}>
                <Text style={[styles.ballotEyebrow, { color: colors.textTertiary }]}>YOUR BALLOT</Text>
                <Text style={[styles.ballotSide, { color: colors.gold }]}>{sideLabel}</Text>
              </View>
              <View style={[styles.ballotCheck, { backgroundColor: colors.goldFill }]}>
                <Ionicons name="checkmark" size={20} color="#040707" />
              </View>
            </View>

            {/* Permanence warning */}
            <View
              style={[
                styles.warningCard,
                { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle },
              ]}
            >
              <Ionicons name="lock-closed-outline" size={15} color={colors.textSecondary} style={styles.warningIcon} />
              <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                <Text style={[styles.warningStrong, { color: colors.text }]}>
                  This cannot be changed or recast.{' '}
                </Text>
                Your ballot is recorded on the public ledger the moment you cast it — permanent,
                public, and verifiable by anyone.
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.goldFill }]}
                onPress={handleConfirm}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Cast ballot, ${sideLabel}`}
              >
                <Ionicons name="checkmark-done-outline" size={17} color="#040707" />
                <Text style={styles.confirmText}>Cast Ballot — {sideLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.goBackBtn}
                onPress={handleGoBack}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Go back without casting"
              >
                <Text style={[styles.goBackText, { color: colors.textSecondary }]}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.castBlock}>
            {/* The Momentous ballot seal — gold ring draws around the circle,
                checkmark stamps when (and only when) the seal is truthfully
                complete. Failure reverses the ring in red. */}
            <Animated.View
              style={[
                styles.sealCircle,
                {
                  backgroundColor: isFailed ? colors.opposeSurface : colors.goldSurfaceStrong,
                  borderColor: isFailed ? colors.oppose : 'rgba(234, 186, 88, 0.4)',
                },
                sealStyle,
              ]}
            >
              <Svg
                width={SEAL_SIZE}
                height={SEAL_SIZE}
                style={styles.sealRing}
                pointerEvents="none"
              >
                <AnimatedCircle
                  cx={SEAL_SIZE / 2}
                  cy={SEAL_SIZE / 2}
                  r={RING_RADIUS}
                  stroke={isFailed ? colors.oppose : colors.goldFill}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  fill="none"
                  animatedProps={ringProps}
                />
              </Svg>
              {isFailed ? (
                <Ionicons name="close" size={34} color={colors.oppose} />
              ) : (
                <Animated.View style={checkStyle}>
                  <Ionicons name="checkmark" size={34} color={colors.gold} />
                </Animated.View>
              )}
            </Animated.View>
            <Text style={[styles.castTitle, { color: isFailed ? colors.oppose : isPending ? colors.text : colors.gold }]}>
              {castTitle}
            </Text>
            <Text style={[styles.castSub, { color: colors.textTertiary }]}>
              {castSub}
            </Text>
            {isFailed ? (
              <View style={styles.failedRow}>
                {handleRetry && (
                  <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: colors.goldFill }]}
                    onPress={handleRetry}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Try casting your ${sideLabel} ballot again`}
                  >
                    <Ionicons name="refresh-outline" size={15} color="#040707" />
                    <Text style={styles.retryText}>Try Again</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.dismissBtn, { borderColor: colors.borderStrong }]}
                  onPress={handleGoBack}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss without casting"
                >
                  <Text style={[styles.dismissText, { color: colors.textSecondary }]}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            ) : (
              isSealed &&
              onShare && (
                <TouchableOpacity
                  style={[styles.shareBtn, { borderColor: colors.gold }]}
                  onPress={async () => {
                    // Keep the sheet (and its Modal) alive while the native
                    // share dialog presents — dismissing first cancels the
                    // share presentation on iOS.
                    sharingRef.current = true;
                    try {
                      await Promise.resolve(onShare());
                    } finally {
                      sharingRef.current = false;
                      onDismiss();
                    }
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Share your vote"
                >
                  <Ionicons name="share-outline" size={15} color={colors.gold} />
                  <Text style={[styles.shareText, { color: colors.gold }]}>Share your vote</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}
      </Animated.View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 26,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 24,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  headerBlock: {
    gap: 6,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  question: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    lineHeight: 26,
  },
  ballotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 17,
  },
  ballotCol: {
    gap: 2,
  },
  ballotEyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.44,
    fontVariant: ['tabular-nums'],
  },
  ballotSide: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 19,
  },
  ballotCheck: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  warningIcon: {
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
  },
  warningStrong: {
    fontFamily: FONTS.sansSemiBold,
  },
  actions: {
    gap: 9,
  },
  confirmBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  confirmText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: '#040707',
  },
  goBackBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBackText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14.5,
  },
  castBlock: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  sealCircle: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    borderRadius: SEAL_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sealRing: {
    ...StyleSheet.absoluteFillObject,
    // Start the ring draw at 12 o'clock.
    transform: [{ rotate: '-90deg' }],
  },
  castTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 28,
  },
  castSub: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
  },
  retryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: '#040707',
  },
  dismissBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  dismissText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  shareText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
});

export default VoteConfirmationOverlay;
