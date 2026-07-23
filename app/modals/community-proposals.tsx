import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { normalizeBallotOptions } from '../../lib/ballotOptions';
import { proposalsApi, Proposal } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { canUserVoteOnProposal, getTierLabel, getLocationLabel } from '../../lib/proposalGeo';
import { useTheme, SPACING, RADIUS, FONTS } from '../../lib/theme';
import { SkeletonProposal, EmptyState, TallyBar } from '../../components/ui';
import { ErrorState } from '../../components/ui/EmptyState';

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY · ALL PROPOSALS — screen 17 (Across Canada / discovery)
// You can watch any public ballot, but only vote where you're eligible.
// Proposals outside the viewer's votable scope render watch-only — no vote
// affordance, a WATCH-ONLY · OUTSIDE YOUR SCOPE chip. Tallies go through
// TallyBar, which enforces the 25-ballot threshold rules.
// ═══════════════════════════════════════════════════════════════════════════════

type Scope = 'country' | 'state' | 'city' | 'ward';

function getTimeRemaining(deadline: string | null): string {
  if (!deadline) return 'Open';
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Ended';
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.floor(ms / 60000);
  return `${minutes}m left`;
}

function matchesScope(proposal: Proposal, scope: Scope, scopeName: string): boolean {
  const geo = proposal.geoRestrictions || [];
  if (geo.length === 0) {
    // Global proposals appear in Country scope only (avoid drowning city views)
    return scope === 'country';
  }
  const target = scopeName.toLowerCase();
  return geo.some((r) => r.toLowerCase() === target);
}

// "BC · PROVINCIAL"-style region chip text.
function regionChipLabel(geoRestrictions?: string[]): string {
  const tier = getTierLabel(geoRestrictions);
  const loc = getLocationLabel(geoRestrictions).toUpperCase();
  return loc === tier ? tier : `${loc} · ${tier}`;
}

export default function CommunityProposalsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scope?: string; scopeName?: string; icon?: string }>();
  const { user } = useAuthStore();

  const scope = (params.scope as Scope) || 'country';
  const scopeName = params.scopeName || 'Community';
  const icon = params.icon || '🌐';

  const userCountry = user?.country || '';
  const userState = user?.state || '';
  const userCity = user?.city || '';
  const isVerified = user?.verified ?? false;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const result = await proposalsApi.getAll();
      if (result.data) {
        const filtered = result.data.filter((p) => matchesScope(p, scope, scopeName));
        // Active first, then ended
        filtered.sort((a, b) => {
          const aEnded = getTimeRemaining(a.deadline) === 'Ended';
          const bEnded = getTimeRemaining(b.deadline) === 'Ended';
          if (aEnded && !bEnded) return 1;
          if (!aEnded && bEnded) return -1;
          return 0;
        });
        setProposals(filtered);
      } else if (result.error) {
        setError(result.error);
      }
    } catch (e) {
      setError('Unable to load proposals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope, scopeName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  };

  const visibleProposals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return proposals;
    return proposals.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q),
    );
  }, [proposals, searchQuery]);

  // In-scope non-yes-no proposals open the shared detail/ballot modal — the
  // same target the Proposals tab routes to. Yes-no cards on this screen have
  // never navigated (the tab's inline detail modal owns that flow), so they
  // stay static. Watch-only cards never navigate.
  const openProposal = (p: Proposal) => {
    const voteType = (p as any).voteType;
    if (!voteType || voteType === 'yes-no') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/modals/proposal-detail',
      params: {
        proposalId: String(p.id),
        title: p.title || '',
        description: p.description || '',
        category: p.category || 'General',
        deadline: p.deadline || '',
        voteType,
        options: JSON.stringify(normalizeBallotOptions((p as any).options)),
        creatorId: String((p as any).creatorId ?? (p as any).userId ?? ''),
        creatorName: p.creatorName || 'Community Member',
        requiresCitizenship: (p as any).requiresCitizenship ? '1' : '',
      },
    });
  };

  const renderItem = ({ item, index }: { item: Proposal; index: number }) => {
    const support = item.supportVotes || 0;
    const oppose = item.opposeVotes || 0;
    const timeLabel = getTimeRemaining(item.deadline).toUpperCase();
    const canVote = canUserVoteOnProposal(item, userCountry, userState, userCity, isVerified);
    const voteType = (item as any).voteType;
    const navigable = canVote && voteType && voteType !== 'yes-no';

    const card = (
      <View
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
      >
        {/* Region chip + eligibility / deadline */}
        <View style={styles.cardHeader}>
          <View style={[styles.regionChip, { backgroundColor: colors.surfaceHighlight }]}>
            <Text style={[styles.regionChipText, { color: colors.textTertiary }]}>
              {regionChipLabel(item.geoRestrictions)}
            </Text>
          </View>
          {canVote ? (
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>{timeLabel}</Text>
          ) : (
            <View style={[styles.watchChip, { borderColor: colors.border }]}>
              <Ionicons name="eye-outline" size={10} color={colors.textTertiary} />
              <Text style={[styles.watchChipText, { color: colors.textTertiary }]}>
                WATCH-ONLY · OUTSIDE YOUR SCOPE
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
          {item.title}
        </Text>
        {!!item.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          <View style={[styles.categoryChip, { backgroundColor: colors.surfaceHighlight }]}>
            <Text style={[styles.categoryText, { color: colors.textTertiary }]}>
              {(item.category || 'General').toUpperCase()}
            </Text>
          </View>
          {!canVote && (
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>{timeLabel}</Text>
          )}
        </View>

        {/* Two-tone tally — TallyBar enforces the 25-ballot threshold */}
        <TallyBar supportCount={support} opposeCount={oppose} variant="compact" />
      </View>
    );

    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 8) * 50).duration(350)}>
        {navigable ? (
          <TouchableOpacity activeOpacity={0.85} onPress={() => openProposal(item)}>
            {card}
          </TouchableOpacity>
        ) : (
          card
        )}
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header — 40px circular back button + serif title (mock 17) */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[styles.header, { paddingTop: insets.top + SPACING.md }]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={[
            styles.backButton,
            { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerIcon}>{icon}</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {scopeName}
        </Text>
      </Animated.View>

      {/* Search + scope note */}
      <View style={styles.topBlock}>
        <View
          style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="search" size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search all public proposals"
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.scopeNote, { color: colors.textSecondary }]}>
          Beyond your scope — you can watch any public ballot, but only vote where you're eligible.
        </Text>
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <SkeletonProposal key={i} style={{ marginBottom: SPACING.md, opacity: 1 - i * 0.3 }} />
          ))}
          <Text style={[styles.fetchingText, { color: colors.textTertiary }]}>
            FETCHING THE VERIFIED COUNT…
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ErrorState
            title="Couldn't load proposals"
            message="That was on our side, not yours. Nothing was lost — you can safely try again."
            errorRef={error}
            onRetry={() => {
              setLoading(true);
              fetchData();
            }}
          />
        </View>
      ) : proposals.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="document-text-outline"
            title={`Nothing on the ballot in ${scopeName}`}
            subtitle="No proposals have been posted here yet. New public ballots appear the moment they open."
          />
        </View>
      ) : visibleProposals.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="search-outline"
            title="No matches"
            subtitle={`No proposals in ${scopeName} match "${searchQuery.trim()}".`}
            ctaLabel="Clear Search"
            onCtaPress={() => setSearchQuery('')}
          />
        </View>
      ) : (
        <FlatList
          data={visibleProposals}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + SPACING.xxxl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
          }
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.textTertiary }]}>
              {visibleProposals.length} PROPOSAL{visibleProposals.length !== 1 ? 'S' : ''} IN THIS
              JURISDICTION
            </Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 22,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.serif,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.34,
  },
  topBlock: {
    paddingHorizontal: SPACING.screenPadding,
    gap: SPACING.md,
    paddingBottom: SPACING.md,
  },
  searchBar: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 14,
    paddingVertical: 0,
  },
  scopeNote: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
  },
  listContent: {
    paddingHorizontal: SPACING.screenPadding,
    gap: SPACING.md,
  },
  listHeader: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    fontVariant: ['tabular-nums'],
    marginBottom: SPACING.xs,
  },
  skeletonList: {
    padding: SPACING.screenPadding,
    paddingTop: SPACING.md,
  },
  fetchingText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    textAlign: 'center',
    marginTop: SPACING.sm,
    fontVariant: ['tabular-nums'],
  },
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 11,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  regionChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: RADIUS.chip,
    flexShrink: 1,
  },
  regionChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.14,
  },
  watchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
    flexShrink: 1,
  },
  watchChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.76,
  },
  timeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 17,
    lineHeight: 22,
  },
  description: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
  },
  categoryText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.08,
  },
});
