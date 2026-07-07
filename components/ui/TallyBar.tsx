import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme, FONTS, ANIMATION } from '../../lib/theme';

// ═══════════════════════════════════════════════════════════════════════════════
// THE TALLY BAR — signature viz of the redesign
//
// Product rules enforced here:
// - Green = Support, Red = Oppose: an equal-weight two-tone bar (green fill
//   on a red track), ALWAYS paired with a text label + exact count so the
//   result reads in grayscale.
// - Tallies appear at 25 ballots. Below the threshold we render one dot per
//   ballot toward a 25-dot row — never percentages, never an empty bar.
// - At zero ballots: "Be the first verified ballot →".
// - Counts are always mono, always tabular, always exact.
// ═══════════════════════════════════════════════════════════════════════════════

export const TALLY_THRESHOLD = 25;

type TallyBarVariant = 'full' | 'compact' | 'inline';

interface TallyBarProps {
  supportCount: number;
  opposeCount: number;
  variant?: TallyBarVariant;
  /** Overrides the SUPPORT/OPPOSE side labels (e.g. YES/NO). */
  supportLabel?: string;
  opposeLabel?: string;
  /** Set false to skip the 25-ballot threshold treatment (e.g. closed results). */
  applyThreshold?: boolean;
  /** Animate the fill from this previous share (0–1) — never from zero. */
  previousShare?: number;
  style?: ViewStyle;
}

function formatCount(n: number): string {
  return n.toLocaleString('en-CA');
}

export function TallyBar({
  supportCount,
  opposeCount,
  variant = 'full',
  supportLabel = 'SUPPORT',
  opposeLabel = 'OPPOSE',
  applyThreshold = true,
  previousShare,
  style,
}: TallyBarProps) {
  const { colors } = useTheme();
  const total = supportCount + opposeCount;
  const share = total > 0 ? supportCount / total : 0;
  const pct = Math.round(share * 100);

  // Deliberate (480ms): the fill re-draws from its previous value, never
  // from zero, so live tallies read as movement rather than a reset.
  const fill = useSharedValue(previousShare ?? share);
  useEffect(() => {
    fill.value = withTiming(share, {
      duration: ANIMATION.motion.deliberate,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
  }, [share]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const a11yLabel =
    total === 0
      ? 'No ballots yet. Be the first verified ballot.'
      : total < TALLY_THRESHOLD && applyThreshold
        ? `${total} of ${TALLY_THRESHOLD} ballots toward the public tally threshold.`
        : `${supportLabel} ${formatCount(supportCount)} ballots, ${pct} percent. ${opposeLabel} ${formatCount(opposeCount)} ballots, ${100 - pct} percent.`;

  // ── Below threshold: dot-per-ballot row, never a bar ──────────────────────
  if (applyThreshold && total < TALLY_THRESHOLD) {
    if (variant === 'inline') {
      return (
        <Text
          accessibilityLabel={a11yLabel}
          style={[styles.mono, { color: colors.textTertiary }, style as any]}
        >
          {total === 0 ? 'BE THE FIRST →' : `${total}/${TALLY_THRESHOLD} BALLOTS`}
        </Text>
      );
    }
    return (
      <View accessible accessibilityLabel={a11yLabel} style={style}>
        <View style={styles.dotRow}>
          {Array.from({ length: TALLY_THRESHOLD }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i < total ? colors.gold : colors.surfaceHighlight,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.mono, { color: colors.textTertiary, marginTop: 6 }]}>
          {total === 0
            ? 'BE THE FIRST VERIFIED BALLOT →'
            : `${total} OF ${TALLY_THRESHOLD} BALLOTS · TALLY SHOWN AT ${TALLY_THRESHOLD}`}
        </Text>
      </View>
    );
  }

  // ── Inline: tiny bar + % (boards & lists) ──────────────────────────────────
  if (variant === 'inline') {
    return (
      <View accessible accessibilityLabel={a11yLabel} style={[styles.inlineRow, style]}>
        <View style={[styles.inlineTrack, { backgroundColor: colors.oppose }]}>
          <Animated.View
            style={[styles.inlineFill, { backgroundColor: colors.support }, fillStyle]}
          />
        </View>
        <Text style={[styles.mono, { color: colors.textSecondary }]}>{pct}%</Text>
      </View>
    );
  }

  // ── Compact: 6px bar + one summary line (feed cards) ──────────────────────
  if (variant === 'compact') {
    return (
      <View accessible accessibilityLabel={a11yLabel} style={style}>
        <View style={[styles.compactTrack, { backgroundColor: colors.oppose }]}>
          <Animated.View
            style={[styles.compactFill, { backgroundColor: colors.support }, fillStyle]}
          />
        </View>
        <View style={styles.countsRow}>
          <Text style={[styles.monoSmall, { color: colors.support }]}>
            {supportLabel} {pct}%
          </Text>
          <Text style={[styles.monoSmall, { color: colors.textTertiary }]}>
            {formatCount(total)} BALLOTS
          </Text>
        </View>
      </View>
    );
  }

  // ── Full: label row + 10px bar with midline + exact counts per side ───────
  return (
    <View accessible accessibilityLabel={a11yLabel} style={style}>
      <View style={styles.labelRow}>
        <Text style={[styles.sideLabel, { color: colors.support }]}>{supportLabel}</Text>
        <Text style={[styles.monoSmall, { color: colors.textTertiary }]}>
          {formatCount(total)} VERIFIED BALLOTS
        </Text>
      </View>
      <View style={[styles.fullTrack, { backgroundColor: colors.oppose }]}>
        <Animated.View
          style={[styles.fullFill, { backgroundColor: colors.support }, fillStyle]}
        />
        <View style={[styles.midline, { backgroundColor: colors.text }]} />
      </View>
      <View style={styles.countsRow}>
        <Text style={[styles.monoCount, { color: colors.support }]}>
          {formatCount(supportCount)} · {pct}%
        </Text>
        <Text style={[styles.monoCount, { color: colors.oppose }]}>
          {formatCount(opposeCount)} · {100 - pct}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  sideLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.33,
  },
  fullTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  fullFill: {
    height: '100%',
  },
  midline: {
    position: 'absolute',
    left: '50%',
    top: -2,
    bottom: -2,
    width: 1.5,
    opacity: 0.4,
  },
  compactTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compactFill: {
    height: '100%',
    borderRadius: 3,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineTrack: {
    width: 52,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  inlineFill: {
    height: '100%',
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  monoCount: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  mono: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  monoSmall: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  dotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
