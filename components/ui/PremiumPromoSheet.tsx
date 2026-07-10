import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FONTS, ANIMATION } from '../../lib/theme';

// ═══════════════════════════════════════════════════════════════════════════════
// S2 · PREMIUM PROMO SHEET — momentum / sentinel-gate / creation-gate
// S3 · APP-OPEN INTERSTITIAL
//
// Bottom sheet over a 75% scrim (same sheet language as HowVotingWorksSheet /
// the X1 confirm sheet). One gold CTA, an equal-weight ghost dismiss named for
// what it does, and the frequency cap printed on the surface itself.
//
// Frequency rules (single global AsyncStorage timestamp):
//   · Max ONE promo of any kind per 7 days (momentum, app-open).
//   · The app-open interstitial additionally promises "once a month" on its
//     face, so it requires 30 days since the last promo of any kind.
//   · Gate-triggered variants (sentinel-gate, creation-gate) bypass the cap —
//     they are contextual explanations of a limit the user just hit, not ads —
//     but callers must still never show them to premium users.
// ═══════════════════════════════════════════════════════════════════════════════

// Real limits from backend/server/routes.ts (SENTINEL_FREE_DAILY /
// SENTINEL_PREMIUM_DAILY). Keep in sync with the server constants.
export const SENTINEL_FREE_PER_DAY = 5;
export const SENTINEL_PREMIUM_PER_DAY = 50;

const PROMO_LAST_SHOWN_KEY = '@represent_promo_last_shown';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * True when a promo of `kind` may be shown. Single global timestamp: at most
 * one promo of ANY kind per 7 days ('app-open' requires 30 days, since the
 * interstitial states "shown at most once a month" on its face).
 * Gate-triggered kinds ('sentinel-gate', 'creation-gate') always pass — they
 * may only be requested when the user directly hits the gate, and callers
 * must never request them for premium users.
 */
export async function shouldShowPromo(kind: string): Promise<boolean> {
  if (kind === 'sentinel-gate' || kind === 'creation-gate') return true;
  try {
    const raw = await AsyncStorage.getItem(PROMO_LAST_SHOWN_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    const windowMs = kind === 'app-open' ? MONTH_MS : WEEK_MS;
    return Date.now() - last >= windowMs;
  } catch {
    // Storage failure: stay quiet rather than risk over-showing promos.
    return false;
  }
}

/** Record that a promo was shown just now (any kind updates the global cap). */
export async function markPromoShown(_kind: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PROMO_LAST_SHOWN_KEY, String(Date.now()));
  } catch {
    // Non-fatal — worst case the next shouldShowPromo errs on the quiet side.
  }
}

export type PremiumPromoVariant = 'momentum' | 'sentinel-gate' | 'creation-gate';

export interface PremiumPromoContext {
  /** Real ballot count for the momentum statement (mono-true, never guessed). */
  ballotsThisMonth?: number;
  /** Total recorded ballot count when a month-scoped figure isn't available. */
  ballotCount?: number;
  /** Creation gate: the user's currently open proposal, named as fact. */
  activeProposalTitle?: string;
  /** Creation gate: mono close date, e.g. "AUG 15" (omit when undated). */
  activeProposalCloses?: string;
}

interface PremiumPromoSheetProps {
  visible: boolean;
  variant: PremiumPromoVariant;
  context?: PremiumPromoContext;
  onClose: () => void;
  /** Routes to /modals/subscription — the caller owns navigation. */
  onSeePremium: () => void;
}

export function PremiumPromoSheet({
  visible,
  variant,
  context,
  onClose,
  onSeePremium,
}: PremiumPromoSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const scrimOpacity = useSharedValue(0);
  const sheetTranslate = useSharedValue(620);

  useEffect(() => {
    if (visible) {
      scrimOpacity.value = withTiming(1, { duration: ANIMATION.motion.quick });
      sheetTranslate.value = withSpring(0, ANIMATION.spring.gentle);
    } else {
      scrimOpacity.value = 0;
      sheetTranslate.value = 620;
    }
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslate.value }],
  }));

  const dismiss = () => {
    scrimOpacity.value = withTiming(0, { duration: ANIMATION.motion.quick });
    sheetTranslate.value = withTiming(620, { duration: ANIMATION.motion.quick }, () => {
      runOnJS(onClose)();
    });
  };

  const goldBorder = 'rgba(234, 186, 88, 0.3)';

  // ── Variant content ────────────────────────────────────────────────────────
  const momentumCount = context?.ballotsThisMonth ?? context?.ballotCount;
  let icon: keyof typeof Ionicons.glyphMap = 'file-tray-full-outline';
  let statement = '';
  let sub = '';
  let dismissLabel = 'Not now';

  if (variant === 'momentum') {
    icon = 'file-tray-full-outline';
    statement =
      context?.ballotsThisMonth != null
        ? `That's ${context.ballotsThisMonth} ballots this month.`
        : `That's ${momentumCount ?? 0} ballots on your record.`;
    sub = 'See what your record says — and understand every question before you cast it.';
    dismissLabel = 'Not now';
  } else if (variant === 'sentinel-gate') {
    icon = 'scan-outline';
    statement = "You've used today's free analyses.";
    sub = 'Your next free Sentinel runs unlock at midnight — or go deeper now.';
    dismissLabel = 'Wait for tomorrow';
  } else {
    icon = 'pencil-outline';
    statement = 'Your proposal slot is in use.';
    sub = context?.activeProposalTitle
      ? `"${context.activeProposalTitle}" is still open. Free accounts run one proposal at a time — Premium runs as many as you can champion.`
      : 'Free accounts run one proposal at a time — Premium runs as many as you can champion.';
    dismissLabel = context?.activeProposalCloses
      ? `Wait until ${context.activeProposalCloses}`
      : 'Not now';
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.root}>
        {/* 75% scrim — tapping it dismisses */}
        <Animated.View style={[styles.scrim, { backgroundColor: colors.overlay }, scrimStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismiss} />
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

          {/* Icon tile */}
          <View style={[styles.iconTile, { backgroundColor: colors.goldSurface, borderColor: goldBorder }]}>
            <Ionicons name={icon} size={24} color={colors.gold} />
          </View>

          {/* Serif statement + sub */}
          <View style={styles.copyCol}>
            <Text style={[styles.statement, { color: colors.text }]}>{statement}</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{sub}</Text>
          </View>

          {/* Variant middle block */}
          {variant === 'momentum' && (
            <View style={styles.featureCol}>
              {[
                `SENTINEL ANALYSIS · ${SENTINEL_PREMIUM_PER_DAY}/DAY`,
                'GEO + DEMOGRAPHIC ANALYTICS',
                'YOUR RECORD · CSV + PDF EXPORT',
              ].map((line) => (
                <View key={line} style={styles.featureRow}>
                  <Ionicons name="checkmark" size={13} color={colors.gold} />
                  <Text style={[styles.featureText, { color: colors.textSecondary }]}>{line}</Text>
                </View>
              ))}
            </View>
          )}

          {variant === 'sentinel-gate' && (
            <View style={[styles.compareCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={styles.compareCol}>
                <Text style={[styles.compareNum, { color: colors.textTertiary }]}>
                  {SENTINEL_FREE_PER_DAY}
                </Text>
                <Text style={[styles.compareLabel, { color: colors.textTertiary }]}>FREE / DAY</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.gold} />
              <View style={styles.compareCol}>
                <Text style={[styles.compareNum, { color: colors.gold }]}>
                  {SENTINEL_PREMIUM_PER_DAY}
                </Text>
                <Text style={[styles.compareLabel, { color: colors.gold }]}>PREMIUM / DAY</Text>
              </View>
            </View>
          )}

          {variant === 'creation-gate' && (
            <View style={[styles.factsCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={styles.factsRow}>
                <Text style={[styles.factsKey, { color: colors.textTertiary }]}>ACTIVE NOW</Text>
                <Text style={[styles.factsVal, { color: colors.text }]}>
                  {context?.activeProposalCloses
                    ? `1 OF 1 · CLOSES ${context.activeProposalCloses}`
                    : '1 OF 1'}
                </Text>
              </View>
              <View style={styles.factsRow}>
                <Text style={[styles.factsKey, { color: colors.textTertiary }]}>WITH PREMIUM</Text>
                <Text style={[styles.factsVal, { color: colors.gold }]}>UNLIMITED ACTIVE</Text>
              </View>
            </View>
          )}

          {/* One gold CTA + equal-weight ghost dismiss */}
          <View style={styles.ctaCol}>
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.goldFill }]}
              onPress={onSeePremium}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="See Premium"
            >
              <Text style={styles.ctaText}>See Premium</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ghost, { borderColor: colors.border }]}
              onPress={dismiss}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={dismissLabel}
            >
              <Text style={[styles.ghostText, { color: colors.textSecondary }]}>{dismissLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* Frequency cap, stated on the sheet itself */}
          <Text style={[styles.frequencyNote, { color: colors.textTertiary }]}>
            SHOWN AT MOST ONCE A WEEK
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// S3a · APP-OPEN INTERSTITIAL — full-screen takeover with Represent manners:
// the ✕ is present and full-size from frame one, the dismiss is a real button
// named for where it goes, and the frequency rule is printed on the surface.
// ═══════════════════════════════════════════════════════════════════════════════

interface AppOpenInterstitialProps {
  visible: boolean;
  onClose: () => void;
  onSeePremium: () => void;
}

export function AppOpenInterstitial({ visible, onClose, onSeePremium }: AppOpenInterstitialProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[inter.root, { backgroundColor: colors.background, paddingTop: insets.top + 6, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}>
        {/* ✕ — full size from frame one, no delay */}
        <View style={inter.closeRow}>
          <TouchableOpacity
            style={[inter.closeBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Animated.View entering={FadeIn.duration(ANIMATION.motion.deliberate)} style={inter.center}>
          {/* Sentinel glyph in a gold progress ring */}
          <View style={inter.ringWrap}>
            <Svg width={96} height={96} viewBox="0 0 96 96" style={{ transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={48} cy={48} r={43} fill="none" stroke={colors.surfaceHighlight} strokeWidth={4} />
              <Circle
                cx={48}
                cy={48}
                r={43}
                fill="none"
                stroke={colors.goldFill}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="189 270"
              />
            </Svg>
            <View style={inter.ringIcon}>
              {/* The Sentinel lens per the S3a mock: crosshair circle with
                  four tick marks and a center dot — not scan brackets. */}
              <Svg width={38} height={38} viewBox="0 0 24 24">
                <Line x1={12} y1={3} x2={12} y2={5} stroke={colors.gold} strokeWidth={1.7} strokeLinecap="round" />
                <Line x1={12} y1={19} x2={12} y2={21} stroke={colors.gold} strokeWidth={1.7} strokeLinecap="round" />
                <Line x1={3} y1={12} x2={5} y2={12} stroke={colors.gold} strokeWidth={1.7} strokeLinecap="round" />
                <Line x1={19} y1={12} x2={21} y2={12} stroke={colors.gold} strokeWidth={1.7} strokeLinecap="round" />
                <Circle cx={12} cy={12} r={5} fill="none" stroke={colors.gold} strokeWidth={1.7} />
                <Circle cx={12} cy={12} r={1.6} fill={colors.gold} />
              </Svg>
            </View>
          </View>

          <View style={inter.copyCol}>
            <Text style={[inter.eyebrow, { color: colors.gold }]}>REPRESENT PREMIUM</Text>
            <Text style={[inter.headline, { color: colors.text }]}>
              Know every ballot cold before you cast it.
            </Text>
            <Text style={[inter.sub, { color: colors.textSecondary }]}>
              Sentinel reads every question with you — fiscal, legal, and precedent context from
              primary sources.
            </Text>
          </View>

          <View style={inter.featureCol}>
            {[
              `SENTINEL · ${SENTINEL_PREMIUM_PER_DAY}/DAY`,
              'UNLIMITED PROPOSALS · FULL ANALYTICS',
              '$7.99/MO · CANCEL ANYTIME',
            ].map((line) => (
              <View key={line} style={inter.featureRow}>
                <Ionicons name="checkmark" size={13} color={colors.gold} />
                <Text style={[inter.featureText, { color: colors.textSecondary }]}>{line}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(ANIMATION.motion.deliberate)} style={inter.ctaCol}>
          <TouchableOpacity
            style={[inter.cta, { backgroundColor: colors.goldFill }]}
            onPress={onSeePremium}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="See Premium"
          >
            <Text style={inter.ctaText}>See Premium</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[inter.ghost, { borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Continue to my ballots"
          >
            <Text style={[inter.ghostText, { color: colors.textSecondary }]}>Continue to my ballots</Text>
          </TouchableOpacity>
          <Text style={[inter.frequencyNote, { color: colors.textTertiary }]}>
            SHOWN AT MOST ONCE A MONTH · NEVER BEFORE A DEADLINE VOTE
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 14,
    paddingHorizontal: 28,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -24 },
    shadowOpacity: 0.65,
    shadowRadius: 70,
    elevation: 24,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyCol: {
    gap: 6,
  },
  statement: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    lineHeight: 31,
    letterSpacing: -0.26,
  },
  sub: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  featureCol: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  compareCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  compareCol: {
    alignItems: 'center',
    gap: 2,
  },
  compareNum: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 26,
    fontVariant: ['tabular-nums'],
  },
  compareLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.19,
    fontVariant: ['tabular-nums'],
  },
  factsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 9,
  },
  factsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  factsKey: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  factsVal: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  ctaCol: {
    gap: 9,
  },
  cta: {
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  ghost: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14.5,
  },
  frequencyNote: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

const inter = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 28,
    gap: 20,
  },
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  ringWrap: {
    width: 96,
    height: 96,
    alignSelf: 'center',
  },
  ringIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyCol: {
    gap: 10,
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 2.1,
  },
  headline: {
    fontFamily: FONTS.serif,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -0.43,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FONTS.sans,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  featureCol: {
    gap: 8,
    alignItems: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  ctaCol: {
    gap: 9,
  },
  cta: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16.5,
    color: '#040707',
  },
  ghost: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
  },
  frequencyNote: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.26,
    textAlign: 'center',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});

export default PremiumPromoSheet;
