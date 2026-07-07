import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, Proposal } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, FONTS } from '../../lib/theme';

export default function MyProposalsScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const result = await proposalsApi.getAll();
      if (result.data) {
        // Filter to only show proposals created by the current user
        const myProposals = result.data.filter((p: any) => p.creatorId === user?.id);
        setProposals(myProposals);
      }
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const getProposalStatus = (proposal: Proposal) => {
    if (proposal.deadline) {
      const deadline = new Date(proposal.deadline);
      if (deadline < new Date()) {
        return 'ended';
      }
    }
    return proposal.status || 'active';
  };

  const getTotalVotes = (proposal: Proposal) => {
    return (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  };

  const getWinningPosition = (proposal: Proposal) => {
    const support = proposal.supportVotes || 0;
    const oppose = proposal.opposeVotes || 0;
    if (support > oppose) return 'support';
    if (oppose > support) return 'oppose';
    return 'tied';
  };

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Sign in to view your proposals
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              fetchData();
            }}
            tintColor={colors.gold}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>My Proposals</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Proposals you've created
          </Text>
        </Animated.View>

        {/* Stats Card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statsNumber, { color: colors.gold }]}>{proposals.length}</Text>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Total</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statsNumber, { color: colors.success }]}>
                {proposals.filter(p => getProposalStatus(p) === 'active').length}
              </Text>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Active</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statsNumber, { color: colors.textTertiary }]}>
                {proposals.filter(p => getProposalStatus(p) === 'ended').length}
              </Text>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Ended</Text>
            </View>
          </View>
        </Animated.View>

        {/* Proposals List */}
        {proposals.length === 0 ? (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.emptyIconContainer, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="create-outline" size={32} color={colors.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No proposals yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Create your first proposal to start making an impact
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.gold }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(tabs)/proposals');
              }}
            >
              <Ionicons name="add" size={20} color="#000" />
              <Text style={styles.createButtonText}>Create Proposal</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.proposalsList}>
            {proposals.map((proposal, index) => {
              const status = getProposalStatus(proposal);
              const totalVotes = getTotalVotes(proposal);
              const winning = getWinningPosition(proposal);

              return (
                <Animated.View
                  key={proposal.id}
                  entering={FadeInUp.delay(200 + index * 50).duration(400)}
                >
                  <TouchableOpacity
                    style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      // Navigate to proposal detail or voting screen
                      router.push('/(tabs)/proposals');
                    }}
                    activeOpacity={0.8}
                  >
                    {/* Status Badge */}
                    <View style={styles.proposalHeader}>
                      <View style={[
                        styles.statusBadge,
                        {
                          backgroundColor: status === 'active' ? `${colors.success}20` : `${colors.textTertiary}20`,
                        }
                      ]}>
                        <View style={[
                          styles.statusDot,
                          { backgroundColor: status === 'active' ? colors.success : colors.textTertiary }
                        ]} />
                        <Text style={[
                          styles.statusText,
                          { color: status === 'active' ? colors.success : colors.textTertiary }
                        ]}>
                          {status === 'active' ? 'Active' : 'Ended'}
                        </Text>
                      </View>
                      <Text style={[styles.proposalDate, { color: colors.textTertiary }]}>
                        {formatDate(proposal.createdAt)}
                      </Text>
                    </View>

                    {/* Title */}
                    <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>
                      {proposal.title}
                    </Text>

                    {/* Category */}
                    <View style={[styles.categoryBadge, { backgroundColor: `${colors.gold}15` }]}>
                      <Text style={[styles.categoryText, { color: colors.gold }]}>{proposal.category}</Text>
                    </View>

                    {/* Vote Stats */}
                    <View style={styles.voteStats}>
                      <View style={styles.voteStat}>
                        <Ionicons name="thumbs-up" size={14} color={colors.support} />
                        <Text style={[styles.voteCount, { color: colors.support }]}>
                          {proposal.supportVotes || 0}
                        </Text>
                      </View>
                      <View style={styles.voteStat}>
                        <Ionicons name="thumbs-down" size={14} color={colors.oppose} />
                        <Text style={[styles.voteCount, { color: colors.oppose }]}>
                          {proposal.opposeVotes || 0}
                        </Text>
                      </View>
                      <Text style={[styles.totalVotes, { color: colors.textTertiary }]}>
                        {totalVotes} total vote{totalVotes !== 1 ? 's' : ''}
                      </Text>
                    </View>

                    {/* Progress Bar */}
                    {totalVotes > 0 && (
                      <View style={styles.progressContainer}>
                        <View style={[styles.progressBar, { backgroundColor: colors.oppose }]}>
                          <View
                            style={[
                              styles.progressFill,
                              {
                                backgroundColor: colors.support,
                                width: `${((proposal.supportVotes || 0) / totalVotes) * 100}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
  },
  statsCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  statsNumber: {
    fontFamily: FONTS.mono,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  statsLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    marginBottom: SPACING.xs,
  },
  emptySubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.md,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  createButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
  proposalsList: {
    gap: SPACING.md,
  },
  proposalCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...TYPOGRAPHY.labelSmall,
  },
  proposalDate: {
    ...TYPOGRAPHY.labelSmall,
  },
  proposalTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    marginBottom: SPACING.sm,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    marginBottom: SPACING.md,
  },
  categoryText: {
    ...TYPOGRAPHY.labelSmall,
  },
  voteStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  voteStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteCount: {
    ...TYPOGRAPHY.labelMedium,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  totalVotes: {
    ...TYPOGRAPHY.labelSmall,
    marginLeft: 'auto',
  },
  progressContainer: {
    marginTop: SPACING.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
