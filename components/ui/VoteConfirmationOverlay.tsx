import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FONTS, ANIMATION } from '../../lib/theme';

// ═══════════════════════════════════════════════════════════════════════════════
// X1 · CONFIRM-BEFORE-CAST SHEET
//
// The mandatory stop between choosing a side and writing it to the ledger.
// A bottom sheet over a 75% scrim: the ballot question VERBATIM in serif,
// the chosen side rendered in GOLD (the committed-ballot color — never
// green/red), the permanence warning, then Confirm (gold) / Go Back.
//
// After Confirm the sheet transitions to a brief "ballot cast" seal state
// (gold check + optional "Share your vote" pill) and auto-dismisses — this
// preserves the previous post-vote celebration + share entry point.
//
// Back-compat: when `onConfirm` is not provided the sheet skips straight to
// the cast/seal state, behaving like the old post-vote overlay.
// ═══════════════════════════════════════════════════════════════════════════════

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
  onShare?: () => void;
}

export function VoteConfirmationOverlay({
  visible,
  voteType,
  onDismiss,
  question,
  onConfirm,
  onShare,
}: VoteConfirmationOverlayProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [phase, setPhase] = useState<'confirm' | 'cast'>(onConfirm ? 'confirm' : 'cast');

  const scrimOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(480);
  const sealScale = useSharedValue(0);

  const sideLabel = voteType === 'support' ? 'Support' : 'Oppose';

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
    }
  }, [visible]);

  // Cast state: draw the gold seal, then auto-dismiss (longer when the share
  // pill is showing, so there's actually time to tap it).
  useEffect(() => {
    if (!visible || phase !== 'cast') return;
    sealScale.value = 0;
    sealScale.value = withDelay(120, withSpring(1, ANIMATION.spring.bouncy));

    const timeout = setTimeout(() => {
      scrimOpacity.value = withTiming(0, { duration: ANIMATION.motion.quick });
      sheetTranslate.value = withTiming(480, { duration: ANIMATION.motion.quick }, () => {
        runOnJS(onDismiss)();
      });
    }, onShare ? 2800 : 1600);

    return () => clearTimeout(timeout);
  }, [visible, phase]);

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

  return (
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
            <Animated.View
              style={[
                styles.sealCircle,
                { backgroundColor: colors.goldSurfaceStrong, borderColor: 'rgba(234, 186, 88, 0.4)' },
                sealStyle,
              ]}
            >
              <Ionicons name="checkmark" size={34} color={colors.gold} />
            </Animated.View>
            <Text style={[styles.castTitle, { color: colors.gold }]}>
              Ballot cast — {sideLabel}
            </Text>
            <Text style={[styles.castSub, { color: colors.textTertiary }]}>
              RECORDED ON THE PUBLIC LEDGER · COUNTED EXACTLY ONCE
            </Text>
            {onShare && (
              <TouchableOpacity
                style={[styles.shareBtn, { borderColor: colors.gold }]}
                onPress={() => {
                  onShare();
                  onDismiss();
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Share your vote"
              >
                <Ionicons name="share-outline" size={15} color={colors.gold} />
                <Text style={[styles.shareText, { color: colors.gold }]}>Share your vote</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>
    </View>
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
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
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
