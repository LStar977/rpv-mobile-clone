import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

interface RCVBallotInputProps {
  options: string[];
  onSubmit: (rankings: string[]) => void | Promise<void>;
  submitting?: boolean;
  // Minimum number of options the voter must rank before they can submit.
  // Default 1 (partial ballots allowed). Set to options.length for
  // "must rank everything" elections.
  minRankings?: number;
}

export function RCVBallotInput({ options, onSubmit, submitting, minRankings = 1 }: RCVBallotInputProps) {
  const { colors } = useTheme();
  const [rankings, setRankings] = useState<string[]>([]);

  const isRanked = (option: string) => rankings.includes(option);

  const add = (option: string) => {
    if (isRanked(option)) return;
    Haptics.selectionAsync();
    setRankings([...rankings, option]);
  };

  const remove = (option: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRankings(rankings.filter((r) => r !== option));
  };

  const handleSubmit = async () => {
    if (rankings.length < minRankings) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await onSubmit(rankings);
  };

  const canSubmit = !submitting && rankings.length >= minRankings;
  const remainingOptions = options.filter((o) => !isRanked(o));

  return (
    <View>
      {/* Ranked list (header) */}
      <View style={[styles.rankedCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}>
        <Text style={[styles.label, { color: colors.gold }]}>YOUR RANKING</Text>
        {rankings.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            Tap options below to rank in your order of preference. You can stop early — partial ballots are fine.
          </Text>
        ) : (
          <Animated.View layout={LinearTransition.duration(200)}>
            {rankings.map((option, idx) => (
              <Animated.View
                key={option}
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                layout={LinearTransition.duration(200)}
                style={[styles.rankedRow, { borderBottomColor: colors.border }]}
              >
                <View style={[styles.rankBadge, { backgroundColor: colors.gold }]}>
                  <Text style={styles.rankBadgeText}>{idx + 1}</Text>
                </View>
                <Text style={[styles.rankedOption, { color: colors.text }]} numberOfLines={2}>
                  {option}
                </Text>
                <TouchableOpacity
                  onPress={() => remove(option)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.removeButton, { backgroundColor: colors.surfaceHighlight }]}
                >
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </View>

      {/* Available options */}
      {remainingOptions.length > 0 && (
        <View style={[styles.poolCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {rankings.length === 0 ? 'OPTIONS' : 'TAP TO ADD NEXT CHOICE'}
          </Text>
          <Animated.View layout={LinearTransition.duration(200)}>
            {remainingOptions.map((option) => (
              <Animated.View
                key={option}
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(150)}
                layout={LinearTransition.duration(200)}
              >
                <TouchableOpacity
                  style={[styles.poolRow, { borderBottomColor: colors.border }]}
                  onPress={() => add(option)}
                  activeOpacity={0.6}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
                  <Text style={[styles.poolOption, { color: colors.text }]} numberOfLines={2}>
                    {option}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </Animated.View>
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          {
            backgroundColor: canSubmit ? colors.gold : `${colors.gold}40`,
          },
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#000" />
            <Text style={styles.submitButtonText}>
              {rankings.length === 0
                ? 'Rank at least 1 option'
                : `Cast ballot (${rankings.length} ranked)`}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  rankedCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  poolCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  empty: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 18,
  },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '800',
    color: '#000',
    fontSize: 13,
  },
  rankedOption: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
    fontWeight: '500',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  poolOption: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.sm,
  },
  submitButtonText: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
    color: '#000',
  },
});

export default RCVBallotInput;
