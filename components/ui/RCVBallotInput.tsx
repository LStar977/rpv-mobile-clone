import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, SPACING, FONTS } from '../../lib/theme';

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
      <Text style={[styles.helper, { color: colors.textSecondary }]}>
        Tap to order the options — your first choice carries the most weight. You can stop early; partial ballots are fine.
      </Text>

      <Animated.View layout={LinearTransition.duration(200)} style={styles.list}>
        {/* Ranked rows */}
        {rankings.map((option, idx) => {
          const first = idx === 0;
          return (
            <Animated.View
              key={option}
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(150)}
              layout={LinearTransition.duration(200)}
              style={[
                styles.row,
                {
                  backgroundColor: colors.surface,
                  borderColor: first ? 'rgba(234,186,88,0.4)' : colors.border,
                  borderWidth: first ? 1.5 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.rankBadge,
                  { backgroundColor: first ? colors.goldFill : colors.surfaceHighlight },
                ]}
              >
                <Text
                  style={[
                    styles.rankBadgeText,
                    { color: first ? '#040707' : colors.text },
                  ]}
                >
                  {idx + 1}
                </Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                  {option}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textTertiary }]}>
                  {first ? 'First choice' : `Choice ${idx + 1}`}
                </Text>
              </View>
              <Ionicons name="reorder-two-outline" size={18} color={colors.textTertiary} />
              <TouchableOpacity
                onPress={() => remove(option)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                style={[styles.clearButton, { backgroundColor: colors.surfaceHighlight }]}
                accessibilityLabel={`Clear rank for ${option}`}
              >
                <Ionicons name="close" size={15} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Unranked rows */}
        {remainingOptions.map((option) => (
          <Animated.View
            key={option}
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            layout={LinearTransition.duration(200)}
          >
            <TouchableOpacity
              style={[styles.row, styles.rowUnranked, { borderColor: colors.borderStrong }]}
              onPress={() => add(option)}
              activeOpacity={0.6}
            >
              <View style={[styles.rankBadge, styles.rankBadgeUnranked, { borderColor: colors.borderStrong }]}>
                <Text style={[styles.rankBadgeText, { color: colors.textTertiary, fontSize: 15 }]}>—</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {option}
                </Text>
                <Text style={[styles.rowSub, { color: colors.textTertiary }]}>
                  Not ranked · tap to rank next
                </Text>
              </View>
              <Ionicons name="reorder-two-outline" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: canSubmit ? colors.goldFill : `${colors.goldFill}40` },
        ]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#040707" />
        ) : (
          <Text style={styles.submitButtonText}>
            {rankings.length === 0
              ? `Rank at least ${minRankings} option${minRankings === 1 ? '' : 's'}`
              : `Cast ballot (${rankings.length} ranked)`}
          </Text>
        )}
      </TouchableOpacity>
      <Text style={[styles.footnote, { color: colors.textTertiary }]}>
        You can reorder until you cast your ballot
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  helper: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  list: {
    gap: 9,
    marginBottom: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  rowUnranked: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeUnranked: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  rankBadgeText: {
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
    fontSize: 16,
  },
  rowBody: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14.5,
  },
  rowSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
  },
  clearButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: '#040707',
  },
  footnote: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});

export default RCVBallotInput;
