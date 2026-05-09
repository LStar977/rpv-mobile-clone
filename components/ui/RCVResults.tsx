import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

interface RCVRound {
  round: number;
  counts: Record<string, number>;
  eliminated: string[];
  exhaustedThisRound: number;
  activeBallots: number;
}

interface RCVResultsProps {
  totalBallots: number;
  exhaustedBallots: number;
  rounds: RCVRound[];
  winner: string | null;
  winningRound: number | null;
}

export function RCVResults({ totalBallots, exhaustedBallots, rounds, winner, winningRound }: RCVResultsProps) {
  const { colors } = useTheme();
  // Default-collapsed all rounds except the winning one. Voters care about
  // the result; auditors expand the rest.
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set(winningRound ? [winningRound] : [rounds.length]),
  );

  const toggle = (round: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });
  };

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

  return (
    <View>
      {/* Winner card */}
      <View style={[styles.winnerCard, { backgroundColor: `${colors.gold}10`, borderColor: colors.gold }]}>
        <View style={styles.winnerHeader}>
          <Ionicons name="trophy" size={20} color={colors.gold} />
          <Text style={[styles.winnerLabel, { color: colors.gold }]}>WINNER</Text>
        </View>
        <Text style={[styles.winnerName, { color: colors.text }]}>
          {winner ?? '—'}
        </Text>
        <Text style={[styles.winnerSub, { color: colors.textSecondary }]}>
          {winner && winningRound
            ? `Decided in round ${winningRound} of ${rounds.length}`
            : 'Awaiting more ballots'}
          {totalBallots > 0 && ` · ${totalBallots} ballot${totalBallots === 1 ? '' : 's'}`}
          {exhaustedBallots > 0 && ` · ${exhaustedBallots} exhausted`}
        </Text>
      </View>

      {/* Rounds */}
      {rounds.map((round) => {
        const isOpen = expanded.has(round.round);
        const optionsByCount = Object.entries(round.counts).sort((a, b) => b[1] - a[1]);
        const maxCount = round.activeBallots > 0 ? round.activeBallots : 1;
        return (
          <Animated.View
            key={round.round}
            entering={FadeIn.duration(200)}
            layout={LinearTransition.duration(200)}
            style={[styles.roundCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <TouchableOpacity
              onPress={() => toggle(round.round)}
              activeOpacity={0.7}
              style={styles.roundHeader}
            >
              <Text style={[styles.roundTitle, { color: colors.text }]}>
                Round {round.round}
              </Text>
              <Text style={[styles.roundMeta, { color: colors.textSecondary }]}>
                {round.activeBallots} active
                {round.eliminated.length > 0 && ` · ${round.eliminated.join(', ')} out`}
              </Text>
              <Ionicons
                name={isOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
            {isOpen && (
              <Animated.View entering={FadeIn.duration(150)} style={styles.optionList}>
                {optionsByCount.map(([opt, count]) => {
                  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
                  const isWinner = winner === opt && round.round === winningRound;
                  const isEliminated = round.eliminated.includes(opt);
                  return (
                    <View key={opt} style={styles.optionRow}>
                      <View style={styles.optionLabelRow}>
                        <Text
                          style={[
                            styles.optionLabel,
                            {
                              color: isEliminated
                                ? colors.textTertiary
                                : isWinner
                                ? colors.gold
                                : colors.text,
                              textDecorationLine: isEliminated ? 'line-through' : 'none',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {opt}
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
                              backgroundColor: isWinner
                                ? colors.gold
                                : isEliminated
                                ? colors.textTertiary
                                : colors.gold,
                              width: `${pct}%`,
                              opacity: isEliminated ? 0.4 : 1,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
                {round.exhaustedThisRound > 0 && (
                  <Text style={[styles.exhaustedNote, { color: colors.textTertiary }]}>
                    {round.exhaustedThisRound} ballot{round.exhaustedThisRound === 1 ? '' : 's'} exhausted this round
                  </Text>
                )}
              </Animated.View>
            )}
          </Animated.View>
        );
      })}

      <Text style={[styles.footnote, { color: colors.textTertiary }]}>
        Tie-break rule: when two options tie for fewest first-choice votes, the option whose label sorts last alphabetically is eliminated.
      </Text>
    </View>
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
  winnerCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  winnerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  winnerLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '800',
    letterSpacing: 2,
  },
  winnerName: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
    marginBottom: 4,
  },
  winnerSub: {
    ...TYPOGRAPHY.bodySmall,
  },
  roundCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  roundTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
  },
  roundMeta: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
  },
  optionList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
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
    fontWeight: '500',
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
  exhaustedNote: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  footnote: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.md,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default RCVResults;
