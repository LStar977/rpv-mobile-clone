import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { organizationsApi } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

const SERIF_FONT = Platform.OS === 'ios' ? 'Georgia' : 'serif';

function getTimeRemaining(deadline: string | null): { text: string; urgent: boolean } {
  if (!deadline) return { text: 'Open indefinitely', urgent: false };
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return { text: 'Voting ended', urgent: false };
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return { text: `${days} day${days > 1 ? 's' : ''} remaining`, urgent: days <= 1 };
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return { text: `${hours} hour${hours > 1 ? 's' : ''} remaining`, urgent: true };
  const minutes = Math.floor(ms / 60000);
  return { text: `${minutes} minute${minutes > 1 ? 's' : ''} remaining`, urgent: true };
}

export default function OrgProposalDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    orgId: string;
    proposalId: string;
    title: string;
    description: string;
    category: string;
    supportVotes: string;
    opposeVotes: string;
    deadline: string;
    userVote: string;
    isOfficial: string;
    orgName: string;
  }>();

  const orgId = params.orgId || '';
  const proposalId = params.proposalId || '';
  const title = params.title || 'Proposal';
  const description = params.description || '';
  const category = params.category || 'General';
  const orgName = params.orgName || 'Organization';
  const isOfficial = params.isOfficial === 'true';
  const deadline = params.deadline || null;

  const [supportVotes, setSupportVotes] = useState(parseInt(params.supportVotes || '0', 10));
  const [opposeVotes, setOpposeVotes] = useState(parseInt(params.opposeVotes || '0', 10));
  const [userVote, setUserVote] = useState<'support' | 'oppose' | null>(
    params.userVote === 'support' || params.userVote === 'oppose' ? params.userVote : null
  );
  const [voting, setVoting] = useState(false);

  const timeInfo = getTimeRemaining(deadline);
  const isEnded = timeInfo.text === 'Voting ended';
  const total = supportVotes + opposeVotes;
  const supportPct = total > 0 ? (supportVotes / total) * 100 : 50;

  const supportScale = useSharedValue(1);
  const opposeScale = useSharedValue(1);

  const supportAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: supportScale.value }],
  }));

  const opposeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: opposeScale.value }],
  }));

  const handleVote = useCallback(async (vote: 'support' | 'oppose') => {
    if (userVote || isEnded || voting) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoting(true);

    // Animate the pressed button
    if (vote === 'support') {
      supportScale.value = withSpring(0.95, {}, () => {
        supportScale.value = withSpring(1);
      });
    } else {
      opposeScale.value = withSpring(0.95, {}, () => {
        opposeScale.value = withSpring(1);
      });
    }

    try {
      const result = await organizationsApi.voteOnProposal(orgId, proposalId, vote);
      console.log('[voteOnProposal] response:', JSON.stringify(result));

      if (result.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Vote Failed', result.error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUserVote(vote);
      // Optimistic local update — increment our side by 1. Server may also
      // return updated totals; if so, prefer them, but only when they're
      // actually numbers (deployed backend response shape varies).
      if (vote === 'support') {
        setSupportVotes((v) => (v ?? 0) + 1);
      } else {
        setOpposeVotes((v) => (v ?? 0) + 1);
      }
      const d: any = result.data;
      if (d && typeof d.supportVotes === 'number') setSupportVotes(d.supportVotes);
      if (d && typeof d.opposeVotes === 'number') setOpposeVotes(d.opposeVotes);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to submit vote. Please try again.');
    } finally {
      setVoting(false);
    }
  }, [orgId, proposalId, userVote, isEnded, voting, supportScale, opposeScale]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {orgName}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Badges Row */}
        <Animated.View entering={FadeInDown.duration(300)} style={styles.badgesRow}>
          {isOfficial && (
            <View style={[styles.badge, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="ribbon" size={14} color={colors.gold} />
              <Text style={[styles.badgeText, { color: colors.gold }]}>Official</Text>
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: `${colors.info}15` }]}>
            <Text style={[styles.badgeText, { color: colors.info }]}>{category}</Text>
          </View>
          {userVote && (
            <View style={[styles.badge, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success }]}>Voted</Text>
            </View>
          )}
        </Animated.View>

        {/* Title */}
        <Animated.Text
          entering={FadeInDown.delay(50).duration(300)}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Animated.Text>

        {/* Time Remaining */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(300)}
          style={[
            styles.timeCard,
            {
              backgroundColor: timeInfo.urgent ? `${colors.error}10` : `${colors.gold}10`,
              borderColor: timeInfo.urgent ? `${colors.error}30` : `${colors.gold}30`,
            },
          ]}
        >
          <Ionicons
            name="time-outline"
            size={18}
            color={timeInfo.urgent ? colors.error : colors.gold}
          />
          <Text
            style={[
              styles.timeText,
              { color: timeInfo.urgent ? colors.error : colors.gold },
            ]}
          >
            {timeInfo.text}
          </Text>
        </Animated.View>

        {/* Description */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(300)}
          style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.descriptionLabel, { color: colors.textSecondary }]}>
            Proposal Details
          </Text>
          <Text style={[styles.description, { color: colors.text }]}>
            {description}
          </Text>
        </Animated.View>

        {/* Vote Stats */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(300)}
          style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>
            Current Results
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressBg, { backgroundColor: colors.error + '30' }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${supportPct}%`, backgroundColor: colors.success },
                ]}
              />
            </View>
          </View>

          {/* Vote Counts */}
          <View style={styles.voteCountsRow}>
            <View style={styles.voteCount}>
              <Ionicons name="thumbs-up" size={20} color={colors.success} />
              <Text style={[styles.voteCountNumber, { color: colors.success }]}>
                {(supportVotes ?? 0).toLocaleString()}
              </Text>
              <Text style={[styles.voteCountLabel, { color: colors.textSecondary }]}>
                Support ({total > 0 ? Math.round(supportPct) : 0}%)
              </Text>
            </View>
            <View style={styles.voteCount}>
              <Ionicons name="thumbs-down" size={20} color={colors.error} />
              <Text style={[styles.voteCountNumber, { color: colors.error }]}>
                {(opposeVotes ?? 0).toLocaleString()}
              </Text>
              <Text style={[styles.voteCountLabel, { color: colors.textSecondary }]}>
                Oppose ({total > 0 ? Math.round(100 - supportPct) : 0}%)
              </Text>
            </View>
          </View>

          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
              Total votes
            </Text>
            <Text style={[styles.totalValue, { color: colors.text }]}>
              {total.toLocaleString()}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Vote Buttons */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(400)}
        style={[
          styles.voteContainer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + SPACING.md,
          },
        ]}
      >
        {userVote ? (
          <View style={[styles.votedMessage, { backgroundColor: `${colors.success}15` }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.votedText, { color: colors.success }]}>
              You voted to {userVote === 'support' ? 'support' : 'oppose'} this proposal
            </Text>
          </View>
        ) : isEnded ? (
          <View style={[styles.votedMessage, { backgroundColor: `${colors.textTertiary}15` }]}>
            <Ionicons name="time" size={24} color={colors.textTertiary} />
            <Text style={[styles.votedText, { color: colors.textTertiary }]}>
              Voting has ended for this proposal
            </Text>
          </View>
        ) : (
          <View style={styles.voteButtonsRow}>
            <Animated.View style={[styles.voteButtonWrapper, supportAnimStyle]}>
              <TouchableOpacity
                style={[styles.voteButton, styles.supportButton]}
                onPress={() => handleVote('support')}
                disabled={voting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.success, '#1a7a3a']}
                  style={styles.voteButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {voting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="thumbs-up" size={24} color="#fff" />
                      <Text style={styles.voteButtonText}>Support</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.voteButtonWrapper, opposeAnimStyle]}>
              <TouchableOpacity
                style={[styles.voteButton, styles.opposeButton]}
                onPress={() => handleVote('oppose')}
                disabled={voting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.error, '#8B0000']}
                  style={styles.voteButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {voting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="thumbs-down" size={24} color="#fff" />
                      <Text style={styles.voteButtonText}>Oppose</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  badgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  title: {
    ...TYPOGRAPHY.headlineMedium,
    fontFamily: SERIF_FONT,
    marginBottom: SPACING.md,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  timeText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  descriptionCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  descriptionLabel: {
    ...TYPOGRAPHY.labelSmall,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  description: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },
  statsCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  statsLabel: {
    ...TYPOGRAPHY.labelSmall,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  progressContainer: {
    marginBottom: SPACING.lg,
  },
  progressBg: {
    height: 12,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  voteCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.lg,
  },
  voteCount: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  voteCountNumber: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  voteCountLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  totalLabel: {
    ...TYPOGRAPHY.bodyMedium,
  },
  totalValue: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  voteContainer: {
    padding: SPACING.lg,
    borderTopWidth: 1,
  },
  votedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.md,
  },
  votedText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
    flex: 1,
  },
  voteButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  voteButtonWrapper: {
    flex: 1,
  },
  voteButton: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  supportButton: {},
  opposeButton: {},
  voteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  voteButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#fff',
    fontWeight: '700',
  },
});
