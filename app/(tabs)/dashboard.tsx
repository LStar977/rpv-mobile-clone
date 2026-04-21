import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION, responsive } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi } from '../../lib/api';
import { BallotDisplay } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type UrgentProposal = {
  id: number;
  title: string;
  hoursLeft: number;
  category: string;
};

type Community = {
  id: string;
  name: string;
  type: 'country' | 'state' | 'city' | 'organization';
  proposalCount: number;
  unvotedCount: number;
};

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT HERO - The bold statement piece
// ═══════════════════════════════════════════════════════════════════════════
function ImpactHero({
  totalVotes,
  proposalsPassed,
  streak,
  ranking,
  percentile,
  location,
}: {
  totalVotes: number;
  proposalsPassed: number;
  streak: number;
  ranking?: number;
  percentile?: number;
  location?: string;
}) {
  const { colors } = useTheme();

  const counterValue = useSharedValue(0);

  useEffect(() => {
    counterValue.value = withDelay(300, withTiming(totalVotes, { duration: 1200 }));
  }, [totalVotes]);

  return (
    <Animated.View
      entering={FadeInDown.duration(600).springify()}
      style={[styles.impactHero, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <LinearGradient
        colors={[`${colors.gold}08`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Streak Badge */}
      {streak > 0 && (
        <View style={[styles.streakBadge, { backgroundColor: `${colors.warning}15` }]}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={[styles.streakText, { color: colors.warning }]}>{streak} day streak</Text>
        </View>
      )}

      {/* Main Impact Number */}
      <View style={styles.impactMain}>
        <Text style={[styles.impactNumber, { color: colors.text }]}>{totalVotes}</Text>
        <Text style={[styles.impactLabel, { color: colors.textSecondary }]}>votes cast</Text>
      </View>

      {/* Secondary Stats Row */}
      <View style={styles.impactStats}>
        <View style={styles.impactStat}>
          <Text style={[styles.impactStatValue, { color: colors.success }]}>{proposalsPassed}</Text>
          <Text style={[styles.impactStatLabel, { color: colors.textTertiary }]}>proposals passed</Text>
        </View>
        <View style={[styles.impactDivider, { backgroundColor: colors.border }]} />
        <View style={styles.impactStat}>
          {percentile ? (
            <>
              <Text style={[styles.impactStatValue, { color: colors.gold }]}>Top {percentile}%</Text>
              <Text style={[styles.impactStatLabel, { color: colors.textTertiary }]}>in {location || 'your area'}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.impactStatValue, { color: colors.gold }]}>#{ranking || '—'}</Text>
              <Text style={[styles.impactStatLabel, { color: colors.textTertiary }]}>local rank</Text>
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION CARD - Clear call to action
// ═══════════════════════════════════════════════════════════════════════════
function ActionCard({
  type,
  count,
  onPress,
}: {
  type: 'verify' | 'urgent' | 'pending';
  count?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const configs = {
    verify: {
      icon: 'shield-checkmark',
      title: 'Verify Your Identity',
      subtitle: 'Unlock voting in your community',
      gradient: [colors.gold, '#A68523'] as const,
      urgent: true,
    },
    urgent: {
      icon: 'flame',
      title: `${count} Closing Soon`,
      subtitle: 'These proposals need your vote',
      gradient: ['#EF4444', '#DC2626'] as const,
      urgent: true,
    },
    pending: {
      icon: 'document-text',
      title: `${count} Proposals Waiting`,
      subtitle: 'Your voice matters',
      gradient: [colors.gold, '#A68523'] as const,
      urgent: false,
    },
  };

  const config = configs[type];

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(200).duration(500).springify()}
      style={[styles.actionCard, { borderColor: `${config.gradient[0]}30` }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={config.gradient}
        style={styles.actionGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.actionContent}>
          <View style={styles.actionIcon}>
            <Ionicons name={config.icon as any} size={28} color="#fff" />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>{config.title}</Text>
            <Text style={styles.actionSubtitle}>{config.subtitle}</Text>
          </View>
          <View style={styles.actionArrow}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </View>
        </View>
      </LinearGradient>
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPOSAL ROW - Clean, minimal proposal item
// ═══════════════════════════════════════════════════════════════════════════
function ProposalRow({
  title,
  category,
  hoursLeft,
  index,
  onPress,
}: {
  title: string;
  category: string;
  hoursLeft: number;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const isUrgent = hoursLeft <= 24;
  const timeColor = hoursLeft <= 6 ? colors.error : hoursLeft <= 24 ? colors.warning : colors.textTertiary;
  const timeText = hoursLeft <= 24 ? `${hoursLeft}h left` : `${Math.ceil(hoursLeft / 24)}d left`;

  return (
    <AnimatedTouchable
      entering={FadeInRight.delay(index * 60).duration(400)}
      style={[styles.proposalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
    >
      {isUrgent && <View style={[styles.proposalUrgentBar, { backgroundColor: timeColor }]} />}
      <View style={styles.proposalContent}>
        <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.proposalMeta}>
          <Text style={[styles.proposalCategory, { color: colors.textTertiary }]}>{category}</Text>
          <View style={[styles.proposalTime, { backgroundColor: `${timeColor}15` }]}>
            <Ionicons name="time-outline" size={12} color={timeColor} />
            <Text style={[styles.proposalTimeText, { color: timeColor }]}>{timeText}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY PILL - Compact community indicator
// ═══════════════════════════════════════════════════════════════════════════
function CommunityPill({
  name,
  count,
  index,
  onPress,
}: {
  name: string;
  count: number;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <AnimatedTouchable
      entering={FadeInRight.delay(100 + index * 50).duration(300)}
      style={[styles.communityPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
    >
      <Text style={[styles.communityName, { color: colors.text }]}>{name}</Text>
      {count > 0 && (
        <View style={[styles.communityBadge, { backgroundColor: colors.gold }]}>
          <Text style={styles.communityBadgeText}>{count}</Text>
        </View>
      )}
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export default function DashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token, isAuthenticated } = useAuthStore();
  const { syncFromChain } = useBallotStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ voted: 0, pending: 0, created: 0, passed: 0 });
  const [streak, setStreak] = useState(0);
  const [urgentProposals, setUrgentProposals] = useState<UrgentProposal[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);

  const isVerified = user?.verified ?? false;
  const isDemoAccount = user?.email === 'demo@represent.app';
  const displayName = user?.name?.split(' ')[0] || 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch proposals
      const proposalsResult = await proposalsApi.getAll();
      const proposals = proposalsResult.data || [];

      // Calculate stats
      const now = Date.now();
      let voted = 0, pending = 0, created = 0;
      const urgent: UrgentProposal[] = [];

      proposals.forEach((p: any) => {
        const deadline = p.deadline ? new Date(p.deadline).getTime() : null;
        const hoursLeft = deadline ? Math.max(0, Math.floor((deadline - now) / (1000 * 60 * 60))) : 999;
        const isEnded = hoursLeft === 0;
        const isOwner = p.creatorId === user?.id;

        if (isOwner) created++;
        if (p.hasVoted || p.userVoted) {
          voted++;
        } else if (!isEnded) {
          pending++;
          if (hoursLeft <= 48) {
            urgent.push({
              id: p.id,
              title: p.title,
              hoursLeft,
              category: p.category || 'General',
            });
          }
        }
      });

      urgent.sort((a, b) => a.hoursLeft - b.hoursLeft);

      setStats({ voted, pending, created, passed: Math.floor(voted * 0.3) });
      setUrgentProposals(urgent.slice(0, 5));

      // Demo streak
      setStreak(isDemoAccount ? 7 : Math.min(voted, 14));

      // Build communities from user location
      const comms: Community[] = [];
      if (user?.country) {
        comms.push({ id: 'country', name: user.country, type: 'country', proposalCount: 12, unvotedCount: pending });
      }
      if (user?.state) {
        comms.push({ id: 'state', name: user.state, type: 'state', proposalCount: 8, unvotedCount: Math.floor(pending * 0.6) });
      }
      if (user?.city) {
        comms.push({ id: 'city', name: user.city, type: 'city', proposalCount: 5, unvotedCount: Math.floor(pending * 0.3) });
      }
      setCommunities(comms);

    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, isDemoAccount]);

  useEffect(() => {
    fetchDashboardData();
    if (user?.walletAddress) {
      syncFromChain(user.walletAddress);
    }
  }, [fetchDashboardData, user?.walletAddress, syncFromChain]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchDashboardData();
    if (user?.walletAddress) {
      syncFromChain(user.walletAddress);
    }
  }, [fetchDashboardData, user?.walletAddress, syncFromChain]);

  const navigateToProposals = () => router.push('/(tabs)/proposals');

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContent, { paddingTop: insets.top + SPACING.xl }]}>
          <SkeletonWelcome />
          <View style={{ marginTop: SPACING.xl }}>
            <SkeletonStats count={3} />
          </View>
          <View style={{ marginTop: SPACING.xl, gap: SPACING.md }}>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textTertiary }]}>{getGreeting()}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
          </View>
          <View style={styles.headerRight}>
            <BallotDisplay size="sm" />
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              style={[styles.avatar, { backgroundColor: colors.gold }]}
            >
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              {isVerified && (
                <View style={[styles.verifiedDot, { backgroundColor: colors.success, borderColor: colors.background }]}>
                  <Ionicons name="checkmark" size={8} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Impact Hero */}
        <ImpactHero
          totalVotes={stats.voted}
          proposalsPassed={stats.passed}
          streak={streak}
          percentile={isDemoAccount || stats.voted > 10 ? 5 : undefined}
          location={user?.city || user?.state}
        />

        {/* Primary Action */}
        {!isVerified && isAuthenticated && (
          <ActionCard
            type="verify"
            onPress={() => router.push('/(tabs)/identity')}
          />
        )}

        {urgentProposals.length > 0 && (
          <ActionCard
            type="urgent"
            count={urgentProposals.length}
            onPress={navigateToProposals}
          />
        )}

        {isVerified && urgentProposals.length === 0 && stats.pending > 0 && (
          <ActionCard
            type="pending"
            count={stats.pending}
            onPress={navigateToProposals}
          />
        )}

        {/* Needs Your Voice Section */}
        {urgentProposals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Needs Your Voice</Text>
              <TouchableOpacity onPress={navigateToProposals}>
                <Text style={[styles.sectionLink, { color: colors.gold }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {urgentProposals.slice(0, 3).map((proposal, idx) => (
              <ProposalRow
                key={proposal.id}
                title={proposal.title}
                category={proposal.category}
                hoursLeft={proposal.hoursLeft}
                index={idx}
                onPress={navigateToProposals}
              />
            ))}
          </View>
        )}

        {/* Your Communities */}
        {communities.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Communities</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.communityScroll}
            >
              {communities.map((community, idx) => (
                <CommunityPill
                  key={community.id}
                  name={community.name}
                  count={community.unvotedCount}
                  index={idx}
                  onPress={navigateToProposals}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Explore CTA */}
        <AnimatedTouchable
          entering={FadeInUp.delay(400).duration(400)}
          style={[styles.exploreCta, { borderColor: colors.border }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigateToProposals();
          }}
          activeOpacity={0.8}
        >
          <View style={styles.exploreContent}>
            <Ionicons name="compass-outline" size={24} color={colors.gold} />
            <View style={styles.exploreText}>
              <Text style={[styles.exploreTitle, { color: colors.text }]}>Explore All Proposals</Text>
              <Text style={[styles.exploreSubtitle, { color: colors.textTertiary }]}>
                Discover what's happening in your area
              </Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.textTertiary} />
        </AnimatedTouchable>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  loadingContent: {
    paddingHorizontal: SPACING.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },

  // Impact Hero
  impactHero: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.lg,
    gap: 6,
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '600',
  },
  impactMain: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  impactNumber: {
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -2,
    lineHeight: 80,
  },
  impactLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: -4,
  },
  impactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactStat: {
    flex: 1,
    alignItems: 'center',
  },
  impactStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  impactStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  impactDivider: {
    width: 1,
    height: 32,
    marginHorizontal: SPACING.lg,
  },

  // Action Card
  actionCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  actionGradient: {
    padding: SPACING.lg,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  actionArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Proposal Row
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  proposalUrgentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  proposalContent: {
    flex: 1,
    marginLeft: SPACING.xs,
  },
  proposalTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  proposalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  proposalCategory: {
    fontSize: 12,
    fontWeight: '500',
  },
  proposalTime: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.sm,
    gap: 4,
  },
  proposalTimeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Community Pills
  communityScroll: {
    paddingRight: SPACING.lg,
    gap: SPACING.sm,
  },
  communityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  communityName: {
    fontSize: 14,
    fontWeight: '600',
  },
  communityBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  communityBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },

  // Explore CTA
  exploreCta: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  exploreContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  exploreText: {
    flex: 1,
  },
  exploreTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  exploreSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
});
