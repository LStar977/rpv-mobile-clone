import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { proposalsApi, Proposal } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, FONTS } from '../../lib/theme';
import { SkeletonProposal, EmptyState } from '../../components/ui';

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

export default function CommunityProposalsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ scope?: string; scopeName?: string; icon?: string }>();

  const scope = (params.scope as Scope) || 'country';
  const scopeName = params.scopeName || 'Community';
  const icon = params.icon || '🌐';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const renderItem = ({ item, index }: { item: Proposal; index: number }) => {
    const support = item.supportVotes || 0;
    const oppose = item.opposeVotes || 0;
    const total = support + oppose;
    const supportPct = total > 0 ? (support / total) * 100 : 50;
    const ended = getTimeRemaining(item.deadline) === 'Ended';

    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(350)}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: ended
                    ? `${colors.textTertiary}20`
                    : `${colors.success}20`,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: ended ? colors.textTertiary : colors.success },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: ended ? colors.textTertiary : colors.success },
                ]}
              >
                {ended ? 'Ended' : 'Active'}
              </Text>
            </View>
            <Text style={[styles.timeText, { color: colors.textTertiary }]}>
              {getTimeRemaining(item.deadline)}
            </Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={[styles.categoryBadge, { backgroundColor: `${colors.gold}15` }]}>
            <Text style={[styles.categoryText, { color: colors.gold }]}>{item.category}</Text>
          </View>

          {/* Support / Oppose bar */}
          <View style={styles.voteBarContainer}>
            <View style={styles.voteBarLabels}>
              <View style={styles.voteLabelLeft}>
                <Ionicons name="thumbs-up" size={12} color={colors.support} />
                <Text style={[styles.voteLabelText, { color: colors.support }]}>
                  {support} ({Math.round(supportPct)}%)
                </Text>
              </View>
              <View style={styles.voteLabelRight}>
                <Text style={[styles.voteLabelText, { color: colors.oppose }]}>
                  ({Math.round(100 - supportPct)}%) {oppose}
                </Text>
                <Ionicons name="thumbs-down" size={12} color={colors.oppose} />
              </View>
            </View>
            <View style={[styles.voteBar, { backgroundColor: colors.oppose }]}>
              <View
                style={[
                  styles.voteBarFill,
                  {
                    backgroundColor: colors.support,
                    width: total > 0 ? `${supportPct}%` : '0%',
                  },
                ]}
              />
            </View>
            <Text style={[styles.participantText, { color: colors.textTertiary }]}>
              {total.toLocaleString()} participant{total !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[
          styles.header,
          {
            paddingTop: insets.top + SPACING.md,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={styles.closeButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerIcon}>{icon}</Text>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {scopeName}
            </Text>
          </View>
          <View style={[styles.readOnlyPill, { backgroundColor: `${colors.gold}18` }]}>
            <Ionicons name="eye-outline" size={12} color={colors.gold} />
            <Text style={[styles.readOnlyText, { color: colors.gold }]}>
              Read-only — observing
            </Text>
          </View>
        </View>
        <View style={{ width: 24 }} />
      </Animated.View>

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <SkeletonProposal key={i} style={{ marginBottom: SPACING.md }} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load proposals"
            subtitle={error}
            ctaLabel="Try again"
            ctaIcon="refresh"
            onCtaPress={() => {
              setLoading(true);
              fetchData();
            }}
          />
        </View>
      ) : proposals.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="document-text-outline"
            title={`No active proposals in ${scopeName}`}
            subtitle="Check back soon — this community hasn't posted anything yet."
          />
        </View>
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
          ListHeaderComponent={
            <Text style={[styles.listHeader, { color: colors.textSecondary }]}>
              {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} in this jurisdiction
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
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 24,
    alignItems: 'flex-start',
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineSmall,
    maxWidth: 200,
  },
  readOnlyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  readOnlyText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 11,
  },
  listContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  listHeader: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.sm,
  },
  skeletonList: {
    padding: SPACING.lg,
  },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    ...SHADOWS.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statusPill: {
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
  timeText: {
    ...TYPOGRAPHY.labelSmall,
  },
  title: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.xs,
  },
  description: {
    ...TYPOGRAPHY.bodyMedium,
    marginBottom: SPACING.sm,
    lineHeight: 20,
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
  voteBarContainer: {
    gap: 6,
  },
  voteBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  voteLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteLabelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteLabelText: {
    ...TYPOGRAPHY.labelSmall,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  voteBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  voteBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  participantText: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
});
