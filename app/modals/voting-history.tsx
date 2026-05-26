import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
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
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [votedProposals, setVotedProposals] = useState<VotedProposal[]>([]);

  // Filter state
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Demo account — show seeded voting history for App Store review.
      if (user?.email === 'demo@represent.app') {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        setVotedProposals([
          { id: 1001, title: 'Extend library hours to 24/7 during finals week', position: 'support', supportVotes: 1336, opposeVotes: 184, votedAt: new Date(now - 2 * day).toISOString() },
          { id: 1002, title: 'Mandate AI ethics course in CS curriculum', position: 'support', supportVotes: 479, opposeVotes: 92, votedAt: new Date(now - 5 * day).toISOString() },
          { id: 1003, title: 'Replace dining hall vendor with local sustainable provider', position: 'support', supportVotes: 1125, opposeVotes: 312, votedAt: new Date(now - 8 * day).toISOString() },
          { id: 1004, title: 'Build new engineering lab in Bessemer Hall', position: 'oppose', supportVotes: 567, opposeVotes: 491, votedAt: new Date(now - 12 * day).toISOString() },
          { id: 1005, title: 'Move CS 101 to online-first format', position: 'oppose', supportVotes: 248, opposeVotes: 612, votedAt: new Date(now - 18 * day).toISOString() },
          { id: 1006, title: 'Increase funding for student mental health services', position: 'support', supportVotes: 2104, opposeVotes: 88, votedAt: new Date(now - 24 * day).toISOString() },
          { id: 1007, title: 'Adopt 4-day class week pilot for spring semester', position: 'support', supportVotes: 891, opposeVotes: 423, votedAt: new Date(now - 32 * day).toISOString() },
          { id: 1008, title: 'Require carbon-offset purchases for university travel', position: 'support', supportVotes: 654, opposeVotes: 287, votedAt: new Date(now - 45 * day).toISOString() },
        ]);
        setLoading(false);
        return;
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const historyResponse = await fetch(`${API_URL}/api/user/voted-proposals`, { headers });

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
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Georgia', fontSize: 20, fontWeight: '600', color: colors.text }}>Voting History</Text>
        <View style={{ width: 40 }} />
      </View>
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
            {votedProposals.length === 0 && (
              <TouchableOpacity
                style={[styles.emptyCtaButton, { backgroundColor: colors.gold }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.back();
                  setTimeout(() => router.push('/(tabs)/proposals'), 100);
                }}
              >
                <Ionicons name="hand-right-outline" size={18} color="#000" />
                <Text style={styles.emptyCtaText}>Start Voting</Text>
              </TouchableOpacity>
            )}
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

  // Stats Card
  statsCard: {
    borderRadius: BORDER_RADIUS['2xl'],
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
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '500',
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
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: '500',
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
    borderRadius: BORDER_RADIUS['2xl'],
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
    marginBottom: SPACING.md,
  },
  emptyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  emptyCtaText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },
});
