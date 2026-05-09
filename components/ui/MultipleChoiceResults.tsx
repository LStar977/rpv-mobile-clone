import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

interface MultipleChoiceResultsProps {
  options: string[];
  counts: Record<string, number>;
}

export function MultipleChoiceResults({ options, counts }: MultipleChoiceResultsProps) {
  const { colors } = useTheme();

  const totalBallots = options.reduce((sum, opt) => sum + (counts[opt] ?? 0), 0);
  // Rank by descending count, stable on ties via original options order.
  const ranked = [...options].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
  const topCount = ranked.length > 0 ? counts[ranked[0]] ?? 0 : 0;
  // All options with the top count are "leaders" (handles ties).
  const leaders = new Set(ranked.filter((o) => (counts[o] ?? 0) === topCount && topCount > 0));

  if (totalBallots === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="document-text-outline" size={32} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No ballots cast yet. Results appear after the first vote.
        </Text>
      </View>
    );
  }

  const leaderLabel = leaders.size === 1 ? ranked[0] : `${leaders.size}-way tie`;
  const leaderPct = totalBallots > 0 ? Math.round((topCount / totalBallots) * 100) : 0;

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <View style={[styles.leaderCard, { backgroundColor: `${colors.gold}10`, borderColor: colors.gold }]}>
        <View style={styles.leaderHeader}>
          <Ionicons name="trophy" size={20} color={colors.gold} />
          <Text style={[styles.leaderLabel, { color: colors.gold }]}>
            {leaders.size === 1 ? 'LEADING' : 'TIED'}
          </Text>
        </View>
        <Text style={[styles.leaderName, { color: colors.text }]} numberOfLines={2}>
          {leaderLabel}
        </Text>
        <Text style={[styles.leaderSub, { color: colors.textSecondary }]}>
          {topCount} {topCount === 1 ? 'vote' : 'votes'} · {leaderPct}% · {totalBallots} ballot{totalBallots === 1 ? '' : 's'} total
        </Text>
      </View>

      <View style={[styles.resultsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {ranked.map((option) => {
          const count = counts[option] ?? 0;
          const pct = totalBallots > 0 ? Math.round((count / totalBallots) * 100) : 0;
          const isLeader = leaders.has(option) && topCount > 0;
          return (
            <View key={option} style={styles.optionRow}>
              <View style={styles.optionLabelRow}>
                <Text
                  style={[
                    styles.optionLabel,
                    {
                      color: isLeader ? colors.gold : colors.text,
                      fontWeight: isLeader ? '700' : '500',
                    },
                  ]}
                  numberOfLines={2}
                >
                  {option}
                </Text>
                <Text style={[styles.optionCount, { color: colors.textSecondary }]}>
                  {count} · {pct}%
                </Text>
              </View>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: isLeader ? colors.gold : colors.textSecondary,
                      width: `${pct}%`,
                      opacity: isLeader ? 1 : 0.6,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
  },
  leaderCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  leaderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  leaderLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '800',
    letterSpacing: 2,
  },
  leaderName: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
    marginBottom: 4,
  },
  leaderSub: {
    ...TYPOGRAPHY.bodySmall,
  },
  resultsCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  optionRow: {
    gap: 6,
  },
  optionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  optionLabel: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  optionCount: {
    ...TYPOGRAPHY.bodySmall,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});

export default MultipleChoiceResults;
