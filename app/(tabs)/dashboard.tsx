import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi } from '../../lib/api';
import { Button, Badge, CountBadge, SectionHeader } from '../../components/ui';
import { SkeletonStats, SkeletonListItem } from '../../components/ui/Skeleton';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type Community = {
  id: string;
  name: string;
  type: 'country' | 'state' | 'city' | 'organization';
  icon: string;
  proposalCount: number;
  unvotedCount: number;
};

type UrgentProposal = {
  id: number;
  title: string;
  hoursLeft: number;
  category: string;
};

type ActivityItem = {
  id: string;
  type: 'new_proposal' | 'vote_result' | 'badge_earned' | 'proposal_closed';
  message: string;
  time: string;
  icon: string;
  color: string;
};

// --- Small animated stat pill (demoted visually) ---
function MiniStat({
  icon,
  value,
  label,
  tone,
  delay = 0,
}: {
  icon: string;
  value: string;
  label: string;
  tone: 'gold' | 'success' | 'warning';
  delay?: number;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.95);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 14, stiffness: 120 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const toneColor =
    tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.gold;

  return (
    <Animated.View
      style={[
        styles.miniStat,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
        animatedStyle,
      ]}
    >
      <View style={[styles.miniStatIcon, { backgroundColor: `${toneColor}18` }]}>
        <Ionicons name={icon as any} size={14} color={toneColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.miniStatValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.miniStatLabel, { color: colors.textMuted }]}>{label}</Text>
      </View>
    </Animated.View>
  );
}

// --- Premium Welcome (kept but visually secondary) ---
function WelcomeHeader({
  name,
  isVerified,
  onAvatarPress,
}: {
  name?: string;
  isVerified: boolean;
  onAvatarPress: () => void;
}) {
  const { colors } = useTheme();
  const displayName = name ? name.split(' ')[0] : 'there';
  const letter = name ? name.charAt(0).toUpperCase() : 'U';

  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.welcomeRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.welcomeKicker, { color: colors.textMuted }]}>Good to see you</Text>
        <Text style={[styles.welcomeName, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer} activeOpacity={0.8}>
        <View style={[styles.avatar, { backgroundColor: colors.gold, ...SHADOWS.glow }]}>
          <Text style={[styles.avatarText, { color: colors.background }]}>{letter}</Text>
        </View>
        {isVerified && (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// --- HERO Priority Card (Momentum & urgency) ---
function PriorityCard({
  isAuthenticated,
  isVerified,
  urgentCount,
  topUrgent,
  pendingCount,
  onVerify,
  onSeeUrgent,
  onExplore,
}: {
  isAuthenticated: boolean;
  isVerified: boolean;
  urgentCount: number;
  topUrgent?: UrgentProposal | null;
  pendingCount: number;
  onVerify: () => void;
  onSeeUrgent: () => void;
  onExplore: () => void;
}) {
  const { colors } = useTheme();

  const mode: 'verify' | 'urgent' | 'explore' = useMemo(() => {
    if (isAuthenticated && !isVerified) return 'verify';
    if (urgentCount > 0) return 'urgent';
    return 'explore';
  }, [isAuthenticated, isVerified, urgentCount]);

  const accent =
    mode === 'verify' ? colors.warning : mode === 'urgent' ? colors.error : colors.gold;

  const bg =
    mode === 'verify'
      ? colors.warningLight
      : mode === 'urgent'
      ? colors.errorLight
      : colors.goldLight;

  const title =
    mode === 'verify'
      ? 'Verify to unlock voting'
      : mode === 'urgent'
      ? 'Closing soon'
      : 'What’s next';

  const subtitle =
    mode === 'verify'
      ? 'Identity verification is required to vote on proposals.'
      : mode === 'urgent'
      ? `${urgentCount} proposal${urgentCount === 1 ? '' : 's'} need your vote within 48 hours.`
      : pendingCount > 0
      ? `${pendingCount} proposal${pendingCount === 1 ? '' : 's'} waiting for your vote.`
      : 'Explore new proposals and see what your community thinks.';

  const cta =
    mode === 'verify' ? 'Start verification' : mode === 'urgent' ? 'Review now' : 'Explore proposals';

  const onPress = mode === 'verify' ? onVerify : mode === 'urgent' ? onSeeUrgent : onExplore;

  const icon =
    mode === 'verify' ? 'shield-checkmark' : mode === 'urgent' ? 'alarm' : 'sparkles';

  const rightChip =
    mode === 'urgent'
      ? `${topUrgent?.hoursLeft ?? ''}h`
      : mode === 'verify'
      ? 'Required'
      : pendingCount > 0
      ? `${pendingCount} pending`
      : 'New';

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(120).duration(420)}
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.hero, { borderColor: accent, backgroundColor: bg }]}
    >
      <LinearGradient
        colors={[`${accent}24`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.heroTopRow}>
        <View style={[styles.heroIcon, { backgroundColor: `${accent}18` }]}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>

        <View style={[styles.heroChip, { backgroundColor: `${accent}18` }]}>
          <Text style={[styles.heroChipText, { color: accent }]}>{rightChip}</Text>
        </View>
      </View>

      <Text style={[styles.heroTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

      {mode === 'urgent' && topUrgent?.title ? (
        <View style={[styles.heroUrgentRow, { borderColor: `${accent}40` }]}>
          <Ionicons name="document-text" size={14} color={colors.textSecondary} />
          <Text style={[styles.heroUrgentText, { color: colors.text }]} numberOfLines={1}>
            {topUrgent.title}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      ) : null}

      <View style={styles.heroCtaRow}>
        <View style={[styles.heroCtaButton, { backgroundColor: accent }]}>
          <Text style={[styles.heroCtaText, { color: colors.background }]}>{cta}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.background} />
        </View>
      </View>
    </AnimatedTouchable>
  );
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ pending: 0, voted: 0, passed: 0 });
  const [communities, setCommunities] = useState<Community[]>([]);
  const [urgentProposals, setUrgentProposals] = useState<UrgentProposal[]>([]);
  const [unclaimedTokens, setUnclaimedTokens] = useState(0);
  const [votingStreak, setVotingStreak] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isVerified, setIsVerified] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        proposalsApi.getAll(),
        isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [] }),
        isAuthenticated ? userApi.getClaimedTokens() : Promise.resolve({ data: [] }),
        isAuthenticated ? userApi.getVerificationStatus() : Promise.resolve({ data: { verified: false } }),
        isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null }),
      ]);

      const proposalsRes = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
      const votedRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
      const claimedRes = results[2].status === 'fulfilled' ? results[2].value : { data: [] };
      const verificationRes = results[3].status === 'fulfilled' ? results[3].value : { data: { verified: false } };
      const profileRes = results[4].status === 'fulfilled' ? results[4].value : { data: null };

      const proposals = Array.isArray(proposalsRes.data) ? proposalsRes.data : [];
      const votedIds = new Set((votedRes.data || []).map((v: any) => (typeof v === 'object' ? v.proposalId : v)));
      const claimedIds = new Set((claimedRes.data || []).map((c: any) => (typeof c === 'object' ? c.proposalId : c)));

      const now = new Date();
      const urgent: UrgentProposal[] = [];
      let pendingCount = 0;

      proposals.forEach((p: any) => {
        if (!votedIds.has(p.id)) pendingCount++;
        if (p.deadline && typeof p.deadline === 'string') {
          try {
            const deadline = new Date(p.deadline);
            if (!isNaN(deadline.getTime()) && deadline > now) {
              const hoursLeft = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
              if (hoursLeft <= 48 && hoursLeft > 0 && !votedIds.has(p.id)) {
                urgent.push({
                  id: p.id,
                  title: p.title || 'Untitled',
                  hoursLeft,
                  category: p.category || 'General',
                });
              }
            }
          } catch {}
        }
      });

      urgent.sort((a, b) => a.hoursLeft - b.hoursLeft);

      const unclaimed = proposals.filter((p: any) => !claimedIds.has(p.id) && !votedIds.has(p.id)).length;

      const profile = profileRes.data;
      const userCountry = profile?.country || user?.country || '';
      const userState = profile?.state || user?.state || '';
      const userCity = profile?.city || user?.city || '';

      const countryFlags: Record<string, string> = {
        Canada: '🇨🇦',
        'United States': '🇺🇸',
        'United Kingdom': '🇬🇧',
        Australia: '🇦🇺',
        Germany: '🇩🇪',
        France: '🇫🇷',
        Japan: '🇯🇵',
        India: '🇮🇳',
        Brazil: '🇧🇷',
        Mexico: '🇲🇽',
        Spain: '🇪🇸',
        Italy: '🇮🇹',
      };

      const communityMap: Record<string, Community> = {};

      if (userCountry) {
        communityMap['country'] = {
          id: 'country',
          name: userCountry,
          type: 'country',
          icon: countryFlags[userCountry] || '🌍',
          proposalCount: 0,
          unvotedCount: 0,
        };
      }
      if (userState) {
        communityMap['state'] = {
          id: 'state',
          name: userState,
          type: 'state',
          icon: '🏛️',
          proposalCount: 0,
          unvotedCount: 0,
        };
      }
      if (userCity) {
        communityMap['city'] = {
          id: 'city',
          name: userCity,
          type: 'city',
          icon: '🏙️',
          proposalCount: 0,
          unvotedCount: 0,
        };
      }

      proposals.forEach((p: any) => {
        const geoRestrictions: string[] = p.geoRestrictions || [];
        const isGlobal = geoRestrictions.length === 0;
        const matchesCountry = isGlobal || (geoRestrictions.length >= 1 && geoRestrictions[0] === userCountry);

        if (userCountry && communityMap['country'] && matchesCountry && geoRestrictions.length <= 1) {
          communityMap['country'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['country'].unvotedCount++;
        }

        if (
          userState &&
          communityMap['state'] &&
          geoRestrictions.length === 2 &&
          geoRestrictions[0] === userCountry &&
          geoRestrictions[1] === userState
        ) {
          communityMap['state'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['state'].unvotedCount++;
        }

        if (
          userCity &&
          communityMap['city'] &&
          geoRestrictions.length === 3 &&
          geoRestrictions[0] === userCountry &&
          geoRestrictions[1] === userState &&
          geoRestrictions[2] === userCity
        ) {
          communityMap['city'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['city'].unvotedCount++;
        }
      });

      const passedCount = proposals
        .filter((p: any) => {
          const total = (p.supportVotes || 0) + (p.opposeVotes || 0);
          return total > 0 && (p.supportVotes || 0) > (p.opposeVotes || 0) && votedIds.has(p.id);
        })
        .length;

      setStats({ pending: pendingCount, voted: votedIds.size, passed: passedCount });
      setCommunities(Object.values(communityMap).filter((c) => c.proposalCount > 0));
      setUrgentProposals(urgent.slice(0, 3));
      setUnclaimedTokens(unclaimed);
      setVotingStreak(Math.min(votedIds.size, 7));
      setIsVerified(verificationRes.data?.verified || false);

      const recentActivities: ActivityItem[] = [];
      if (proposals.length > 0) {
        const newest = proposals[0];
        const title = newest.title || 'New proposal';
        recentActivities.push({
          id: '1',
          type: 'new_proposal',
          message: `New: ${title.length > 38 ? title.substring(0, 38) + '...' : title}`,
          time: '2h ago',
          icon: 'document-text',
          color: colors.gold,
        });
      }
      if (votedIds.size > 0) {
        recentActivities.push({
          id: '2',
          type: 'badge_earned',
          message: `You've cast ${votedIds.size} vote${votedIds.size > 1 ? 's' : ''}!`,
          time: 'Recent',
          icon: 'trophy',
          color: colors.gold,
        });
      }
      setActivities(recentActivities);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user, colors.gold]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const navigateToProposals = () => router.push('/(tabs)/proposals');

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.skeletonHeader}>
          <View style={[styles.skeletonHero, { backgroundColor: colors.cardBg }]} />
        </View>
        <View style={styles.skeletonContent}>
          <SkeletonStats count={3} />
          <View style={{ marginTop: SPACING.xxl }}>
            <SkeletonListItem />
            <SkeletonListItem />
          </View>
        </View>
      </View>
    );
  }

  const topUrgent = urgentProposals?.[0] ?? null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* Subtle welcome */}
        <WelcomeHeader
          name={user?.name ?? undefined}
          isVerified={isVerified}
          onAvatarPress={() => router.push('/(tabs)/profile')}
        />

        {/* HERO: single priority moment */}
        <PriorityCard
          isAuthenticated={isAuthenticated}
          isVerified={isVerified}
          urgentCount={urgentProposals.length}
          topUrgent={topUrgent}
          pendingCount={stats.pending}
          onVerify={() => router.push('/(tabs)/identity')}
          onSeeUrgent={navigateToProposals}
          onExplore={navigateToProposals}
        />

        {/* Optional: Unclaimed tokens (kept, but subordinate) */}
        {unclaimedTokens > 0 && (
          <AnimatedTouchable
            entering={FadeInUp.delay(180).duration(350)}
            style={[styles.subAlert, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={navigateToProposals}
            activeOpacity={0.8}
          >
            <View style={[styles.subAlertIcon, { backgroundColor: `${colors.success}18` }]}>
              <Ionicons name="ticket" size={18} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.subAlertTitle, { color: colors.text }]}>
                {unclaimedTokens} token{unclaimedTokens > 1 ? 's' : ''} available
              </Text>
              <Text style={[styles.subAlertSub, { color: colors.textMuted }]}>Claim and vote</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </AnimatedTouchable>
        )}

        {/* Demoted stats */}
        <SectionHeader title="AT A GLANCE" style={{ marginTop: SPACING.lg, paddingHorizontal: SPACING.lg }} />
        <View style={styles.miniStatsRow}>
          <MiniStat icon="time-outline" value={stats.pending.toString()} label="Pending" tone="warning" delay={0} />
          <MiniStat icon="checkmark-done-outline" value={stats.voted.toString()} label="Voted" tone="success" delay={80} />
          <MiniStat icon="trophy-outline" value={stats.passed.toString()} label="Passed" tone="gold" delay={160} />
        </View>

        {/* Closing soon section stays, but feels urgent */}
        {urgentProposals.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="CLOSING SOON" icon="alarm" iconColor={colors.error} />
            {urgentProposals.map((proposal, idx) => (
              <AnimatedTouchable
                key={proposal.id}
                entering={FadeInRight.delay(idx * 90).duration(280)}
                style={[styles.urgentCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={navigateToProposals}
                activeOpacity={0.75}
              >
                <View style={[styles.urgentLeftBar, { backgroundColor: `${colors.error}35` }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.urgentTitle, { color: colors.text }]} numberOfLines={1}>
                    {proposal.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xs }}>
                    <Badge label={proposal.category} variant="gold" size="sm" />
                    <View style={[styles.urgentTimeChip, { backgroundColor: colors.errorLight }]}>
                      <Ionicons name="time" size={14} color={colors.error} />
                      <Text style={[styles.urgentTimeText, { color: colors.error }]}>{proposal.hoursLeft}h</Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </AnimatedTouchable>
            ))}
          </View>
        )}

        {/* Communities */}
        {communities.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="YOUR COMMUNITIES" />
            {communities.map((community, idx) => (
              <AnimatedTouchable
                key={community.id}
                entering={FadeInRight.delay(idx * 80).duration(260)}
                style={[styles.communityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={navigateToProposals}
                activeOpacity={0.75}
              >
                <Text style={styles.communityIcon}>{community.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
                  <Text style={[styles.communityMeta, { color: colors.textMuted }]}>
                    {community.proposalCount} proposal{community.proposalCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                {community.unvotedCount > 0 ? <CountBadge count={community.unvotedCount} /> : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: SPACING.sm }} />
              </AnimatedTouchable>
            ))}
          </View>
        )}

        {/* Activity (quiet) */}
        {activities.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="RECENT" />
            {activities.map((activity, idx) => (
              <Animated.View
                key={activity.id}
                entering={FadeInRight.delay(idx * 70).duration(240)}
                style={[styles.activityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              >
                <View style={[styles.activityIconBg, { backgroundColor: `${activity.color}15` }]}>
                  <Ionicons name={activity.icon as any} size={18} color={activity.color} />
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md }}>
                  <Text style={[styles.activityMessage, { color: colors.text }]} numberOfLines={1}>
                    {activity.message}
                  </Text>
                  <Text style={[styles.activityTime, { color: colors.textMuted }]}>{activity.time}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Bottom CTA */}
        <Animated.View entering={FadeInUp.delay(500).duration(320)} style={styles.ctaContainer}>
          <Button
            title="Explore All Proposals"
            onPress={navigateToProposals}
            variant="primary"
            size="lg"
            fullWidth
            icon="arrow-forward"
            iconPosition="right"
          />
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: 60 },

  // Skeleton
  skeletonHeader: { paddingHorizontal: SPACING.lg, paddingTop: 60 },
  skeletonHero: { height: 190, borderRadius: BORDER_RADIUS.xxl },
  skeletonContent: { padding: SPACING.lg },

  // Welcome row (subtle)
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  welcomeKicker: { ...TYPOGRAPHY.labelSmall },
  welcomeName: { ...TYPOGRAPHY.headlineLarge, marginTop: SPACING.xxs },

  avatarContainer: { position: 'relative' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  verifiedBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F0F12',
  },

  // HERO priority card
  hero: {
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  heroChipText: { ...TYPOGRAPHY.labelMedium },

  heroTitle: { ...TYPOGRAPHY.headlineLarge },
  heroSubtitle: { ...TYPOGRAPHY.bodyMedium, marginTop: SPACING.sm, maxWidth: 520 },

  heroUrgentRow: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroUrgentText: { ...TYPOGRAPHY.labelLarge, flex: 1 },

  heroCtaRow: { marginTop: SPACING.lg, alignItems: 'flex-start' },
  heroCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.full,
  },
  heroCtaText: { ...TYPOGRAPHY.labelLarge },

  // Sub alert (tokens)
  subAlert: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  subAlertIcon: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subAlertTitle: { ...TYPOGRAPHY.labelLarge },
  subAlertSub: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xxs },

  // Mini stats
  miniStatsRow: {
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  miniStat: {
    flex: 1,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  miniStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStatValue: { ...TYPOGRAPHY.labelLarge, fontWeight: '800' },
  miniStatLabel: { ...TYPOGRAPHY.labelSmall },

  // Sections
  section: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },

  // Urgent
  urgentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  urgentLeftBar: {
    width: 6,
    borderRadius: 999,
    marginRight: SPACING.md,
    height: 46,
  },
  urgentTitle: { ...TYPOGRAPHY.labelLarge },
  urgentTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  urgentTimeText: { ...TYPOGRAPHY.labelMedium },

  // Communities
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  communityIcon: { fontSize: 28, marginRight: SPACING.md },
  communityName: { ...TYPOGRAPHY.labelLarge },
  communityMeta: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xxs },

  // Activity
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  activityIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityMessage: { ...TYPOGRAPHY.labelLarge },
  activityTime: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xxs },

  ctaContainer: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },
});
