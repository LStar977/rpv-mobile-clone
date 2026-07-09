import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, RADIUS, FONTS } from '../../lib/theme';

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

const TALLY_THRESHOLD = 25;

// Filter Chip Component
function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.surfaceHighlight : colors.transparent,
          borderColor: selected ? colors.borderStrong : colors.border,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, { color: selected ? colors.text : colors.textSecondary }]}>
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
    new Date(dateStr)
      .toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
      .replace(',', '')
      .toUpperCase();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Your Record</Text>
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
        {/* Ledger line — counts, always mono */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={[styles.ledgerLine, { color: colors.textTertiary }]}>
            {filteredProposals.length} {filteredProposals.length === 1 ? 'BALLOT' : 'BALLOTS'} · {supportCount} SUPPORT · {opposeCount} OPPOSE
          </Text>
          <Text style={[styles.ledgerSubline, { color: colors.textTertiary }]}>
            ALL ON THE PUBLIC LEDGER
          </Text>
        </Animated.View>

        {/* Filters */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.filtersSection}>
          <View style={styles.filterChips}>
            <FilterChip
              label="ALL TIME"
              selected={timeFilter === 'all'}
              onPress={() => setTimeFilter('all')}
            />
            <FilterChip
              label="THIS WEEK"
              selected={timeFilter === 'week'}
              onPress={() => setTimeFilter('week')}
            />
            <FilterChip
              label="THIS MONTH"
              selected={timeFilter === 'month'}
              onPress={() => setTimeFilter('month')}
            />
          </View>
          <View style={styles.filterChips}>
            <FilterChip
              label="ALL"
              selected={voteFilter === 'all'}
              onPress={() => setVoteFilter('all')}
            />
            <FilterChip
              label="SUPPORTED"
              selected={voteFilter === 'support'}
              onPress={() => setVoteFilter('support')}
            />
            <FilterChip
              label="OPPOSED"
              selected={voteFilter === 'oppose'}
              onPress={() => setVoteFilter('oppose')}
            />
          </View>
        </Animated.View>

        {/* Record ledger */}
        {filteredProposals.length > 0 ? (
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={[styles.recordCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          >
            {filteredProposals.map((proposal, index) => {
              const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
              const supportPercent = totalVotes > 0 ? ((proposal.supportVotes || 0) / totalVotes) * 100 : 0;
              const isSupport = proposal.position === 'support';
              const sidePercent = isSupport ? supportPercent : 100 - supportPercent;
              const tallyVisible = totalVotes >= TALLY_THRESHOLD;
              const withMajority = tallyVisible && sidePercent > 50;
              const inMinority = tallyVisible && sidePercent <= 50;
              const positionLabel = isSupport ? 'SUPPORT' : 'OPPOSE';
              const isLast = index === filteredProposals.length - 1;

              return (
                <TouchableOpacity
                  key={proposal.id}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({ pathname: '/(tabs)/proposals', params: { proposalId: String(proposal.id) } });
                  }}
                  style={[
                    styles.recordRow,
                    { borderBottomColor: colors.borderSubtle },
                    isLast && { borderBottomWidth: 0 },
                  ]}
                >
                  {/* Top row — side chip + mono date */}
                  <View style={styles.recordTopRow}>
                    <View
                      style={[
                        styles.sideChip,
                        { backgroundColor: isSupport ? colors.supportSurface : colors.opposeSurface },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sideChipText,
                          { color: isSupport ? colors.support : colors.oppose },
                        ]}
                      >
                        {positionLabel}
                      </Text>
                    </View>
                    {proposal.votedAt ? (
                      <Text style={[styles.recordDate, { color: colors.textTertiary }]}>
                        {formatDate(proposal.votedAt)}
                      </Text>
                    ) : null}
                  </View>

                  {/* Serif proposal title */}
                  <Text style={[styles.recordTitle, { color: colors.text }]} numberOfLines={2}>
                    {proposal.title}
                  </Text>

                  {/* Bottom mono row — your side + outcome tally */}
                  <View style={styles.recordBottomRow}>
                    <Text
                      style={[
                        styles.recordSideLine,
                        { color: withMajority ? colors.gold : colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {withMajority
                        ? `YOU · ${positionLabel} ✓ WITH MAJORITY`
                        : inMinority
                          ? `YOU · ${positionLabel} · IN MINORITY`
                          : `YOU · ${positionLabel} · ON THE PUBLIC LEDGER`}
                    </Text>
                    <Text style={[styles.recordTally, { color: colors.textTertiary }]}>
                      {tallyVisible
                        ? `${supportPercent.toFixed(0)}% SUPPORT · ${totalVotes.toLocaleString()}`
                        : `TALLY AT ${TALLY_THRESHOLD}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: colors.goldSurface }]}>
              <Ionicons name="document-text-outline" size={36} color={colors.gold} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {votedProposals.length > 0 ? 'No ballots match filters' : 'No ballots cast yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {votedProposals.length > 0
                ? 'Try adjusting your filters to see more of your record'
                : 'Cast a ballot on a proposal and it will appear here'}
            </Text>
            {votedProposals.length === 0 && (
              <TouchableOpacity
                style={[styles.emptyCtaButton, { backgroundColor: colors.goldFill }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.back();
                  setTimeout(() => router.push('/(tabs)/proposals'), 100);
                }}
              >
                <Text style={[styles.emptyCtaText, { color: colors.black }]}>Start Voting</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Ledger trust note */}
        {filteredProposals.length > 0 && (
          <Animated.View
            entering={FadeInUp.delay(400).duration(400)}
            style={[styles.trustCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle }]}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.gold} style={{ flexShrink: 0 }} />
            <Text style={[styles.trustText, { color: colors.textSecondary }]}>
              Every ballot here is independently checkable on the public ledger — your record is yours to prove.
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
  contentContainer: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.xs,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.34,
  },

  // Ledger count line
  ledgerLine: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.88,
    fontVariant: ['tabular-nums'],
  },
  ledgerSubline: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.88,
    fontVariant: ['tabular-nums'],
    marginTop: 4,
  },

  // Filters
  filtersSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  filterChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.95,
  },

  // Record ledger card
  recordCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  recordRow: {
    paddingVertical: 14,
    gap: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sideChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.chip,
  },
  sideChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.08,
  },
  recordDate: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  recordTitle: {
    fontFamily: FONTS.serif,
    fontSize: 15,
    lineHeight: 20,
  },
  recordBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  recordSideLine: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  recordTally: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },

  // Trust note
  trustCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: SPACING.lg,
  },
  trustText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: SPACING['3xl'],
    borderRadius: RADIUS.card,
    borderWidth: 1,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyText: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    lineHeight: 25,
    marginBottom: SPACING.xs,
  },
  emptySubtext: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  emptyCtaButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.chip,
    marginTop: SPACING.sm,
  },
  emptyCtaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
  },
});
