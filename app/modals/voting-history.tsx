import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth';
import { limitsApi, UsageLimits } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

interface VotedProposal {
  id: number;
  title: string;
  position: 'support' | 'oppose';
  supportVotes: number;
  opposeVotes: number;
  votedAt: string;
}

type TimeFilter = 'all' | 'week' | 'month';
type VoteFilter = 'all' | 'support' | 'oppose';

// Filter Chip Component
function FilterChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.gold : colors.surface,
          borderColor: selected ? colors.gold : colors.border,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      {icon && (
        <Ionicons name={icon as any} size={14} color={selected ? '#000' : colors.textSecondary} />
      )}
      <Text style={[styles.filterChipText, { color: selected ? '#000' : colors.text }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function VotingHistoryScreen() {
  const { colors } = useTheme();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [votedProposals, setVotedProposals] = useState<VotedProposal[]>([]);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);

  // Filter state
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Fetch voting history and usage limits in parallel
      const [historyResponse, limitsResult] = await Promise.all([
        fetch(`${API_URL}/api/user/voted-proposals`, { headers }),
        limitsApi.getUsageLimits(),
      ]);

      if (historyResponse.ok) {
        const data = await historyResponse.json();
        const proposals = data.votedProposals || data || [];
        setVotedProposals(
          proposals.map((p: any) => ({
            id: p.proposalId || p.id,
            title: p.title || 'Untitled Proposal',
            position: p.position,
            supportVotes: p.supportVotes || 0,
            opposeVotes: p.opposeVotes || 0,
            votedAt: p.votedAt || p.timestamp,
          }))
        );
      }

      if (limitsResult.data) {
        setUsageLimits(limitsResult.data);
      }
    } catch (error) {
      console.error('Failed to fetch voting history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter proposals based on selected filters
  const filteredProposals = useMemo(() => {
    return votedProposals.filter((proposal) => {
      // Time filter
      if (timeFilter !== 'all' && proposal.votedAt) {
        const votedDate = new Date(proposal.votedAt);
        const now = new Date();

        if (timeFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (votedDate < weekAgo) return false;
        } else if (timeFilter === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (votedDate < monthAgo) return false;
        }
      }

      // Vote type filter
      if (voteFilter !== 'all' && proposal.position !== voteFilter) {
        return false;
      }

      return true;
    });
  }, [votedProposals, timeFilter, voteFilter]);

  // Stats
  const supportCount = useMemo(
    () => filteredProposals.filter((p) => p.position === 'support').length,
    [filteredProposals]
  );
  const opposeCount = useMemo(
    () => filteredProposals.filter((p) => p.position === 'oppose').length,
    [filteredProposals]
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={colors.gold}
          />
        }
      >
        {/* Vote Limits Card (for non-premium users) */}
        {usageLimits && usageLimits.votes.limit !== 'unlimited' && (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[styles.limitsCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}
          >
            <View style={styles.limitsHeader}>
              <View style={[styles.limitsIconBg, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="ticket-outline" size={20} color={colors.gold} />
              </View>
              <View style={styles.limitsInfo}>
                <Text style={[styles.limitsTitle, { color: colors.text }]}>Votes Remaining</Text>
                <Text style={[styles.limitsSubtitle, { color: colors.textSecondary }]}>
                  {usageLimits.tier === 'free' ? 'Free tier limit' : 'Monthly limit'}
                </Text>
              </View>
              <View style={styles.limitsCount}>
                <Text style={[styles.limitsCountValue, { color: colors.gold }]}>
                  {Math.max(0, (usageLimits.votes.limit as number) - usageLimits.votes.used)}
                </Text>
                <Text style={[styles.limitsCountLabel, { color: colors.textTertiary }]}>
                  of {usageLimits.votes.limit}
                </Text>
              </View>
            </View>
            <View style={[styles.limitsProgressBg, { backgroundColor: `${colors.gold}20` }]}>
              <View
                style={[
                  styles.limitsProgressFill,
                  {
                    backgroundColor: colors.gold,
                    width: `${Math.min(100, (usageLimits.votes.used / (usageLimits.votes.limit as number)) * 100)}%`,
                  },
                ]}
              />
            </View>
          </Animated.View>
        )}

        {/* Stats Card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statsNumber, { color: colors.gold }]}>{filteredProposals.length}</Text>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Total Votes</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statsNumber, { color: colors.success }]}>{supportCount}</Text>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Supported</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statsNumber, { color: colors.error }]}>{opposeCount}</Text>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Opposed</Text>
            </View>
          </View>
        </Animated.View>

        {/* Filters */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.filtersSection}>
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>Time Period</Text>
            <View style={styles.filterChips}>
              <FilterChip
                label="All Time"
                selected={timeFilter === 'all'}
                onPress={() => setTimeFilter('all')}
              />
              <FilterChip
                label="This Week"
                selected={timeFilter === 'week'}
                onPress={() => setTimeFilter('week')}
              />
              <FilterChip
                label="This Month"
                selected={timeFilter === 'month'}
                onPress={() => setTimeFilter('month')}
              />
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>Vote Type</Text>
            <View style={styles.filterChips}>
              <FilterChip
                label="All"
                selected={voteFilter === 'all'}
                onPress={() => setVoteFilter('all')}
              />
              <FilterChip
                label="Supported"
                icon="thumbs-up"
                selected={voteFilter === 'support'}
                onPress={() => setVoteFilter('support')}
              />
              <FilterChip
                label="Opposed"
                icon="thumbs-down"
                selected={voteFilter === 'oppose'}
                onPress={() => setVoteFilter('oppose')}
              />
            </View>
          </View>
        </Animated.View>

        {/* Votes List */}
        {filteredProposals.length > 0 ? (
          filteredProposals.map((proposal, index) => {
            const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
            const supportPercent = totalVotes > 0 ? ((proposal.supportVotes || 0) / totalVotes) * 100 : 0;
            const isSupport = proposal.position === 'support';

            return (
              <TouchableOpacity
                key={proposal.id}
                activeOpacity={0.7}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({ pathname: '/(tabs)/proposals', params: { proposalId: String(proposal.id) } });
                }}
              >
              <Animated.View
                entering={FadeInUp.delay(300 + index * 50).duration(400)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>
                    {proposal.title}
                  </Text>
                  <View
                    style={[
                      styles.voteBadge,
                      { backgroundColor: isSupport ? `${colors.success}15` : `${colors.error}15` },
                    ]}
                  >
                    <Ionicons
                      name={isSupport ? 'thumbs-up' : 'thumbs-down'}
                      size={12}
                      color={isSupport ? colors.success : colors.error}
                    />
                    <Text
                      style={[styles.voteBadgeText, { color: isSupport ? colors.success : colors.error }]}
                    >
                      {isSupport ? 'SUPPORTED' : 'OPPOSED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressContainer}>
                  <View style={[styles.progressBar, { backgroundColor: colors.error }]}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${supportPercent}%`, backgroundColor: colors.success },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    {supportPercent.toFixed(0)}% support
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.stat}>
                    <Ionicons name="thumbs-up-outline" size={14} color={colors.success} />
                    <Text style={[styles.statText, { color: colors.success }]}>
                      {proposal.supportVotes || 0}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Ionicons name="thumbs-down-outline" size={14} color={colors.error} />
                    <Text style={[styles.statText, { color: colors.error }]}>
                      {proposal.opposeVotes || 0}
                    </Text>
                  </View>
                  {proposal.votedAt && (
                    <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                      {formatDate(proposal.votedAt)}
                    </Text>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} style={{ marginLeft: 'auto' }} />
                </View>
              </Animated.View>
              </TouchableOpacity>
            );
          })
        ) : (
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="document-text-outline" size={40} color={colors.gold} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {votedProposals.length > 0 ? 'No votes match filters' : 'No votes cast yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {votedProposals.length > 0
                ? 'Try adjusting your filters to see more votes'
                : 'Vote on proposals to see your history here'}
            </Text>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: SPACING.lg },

  // Limits Card
  limitsCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  limitsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  limitsIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitsInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  limitsTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  limitsSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  limitsCount: {
    alignItems: 'flex-end',
  },
  limitsCountValue: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
  },
  limitsCountLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  limitsProgressBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  limitsProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Stats Card
  statsCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  statsNumber: {
    ...TYPOGRAPHY.headlineLarge,
    fontWeight: '700',
  },
  statsLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xxs,
  },

  // Filters
  filtersSection: {
    marginBottom: SPACING.lg,
  },
  filterRow: {
    marginBottom: SPACING.md,
  },
  filterLabel: {
    ...TYPOGRAPHY.labelSmall,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  filterChipText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '500',
  },

  // Card
  card: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  proposalTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
    flex: 1,
    marginRight: SPACING.md,
  },
  voteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xxs,
  },
  voteBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 10,
    fontWeight: '700',
  },
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xs,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  dateText: {
    ...TYPOGRAPHY.bodySmall,
    marginLeft: 'auto',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyText: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
  },
});
