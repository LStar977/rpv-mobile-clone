import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi } from '../../lib/api';
import { Button, Card, Badge, CountBadge, SectionHeader } from '../../components/ui';
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

// Animated Stat Card Component
function StatCard({
  icon,
  value,
  label,
  color,
  delay = 0,
}: {
  icon: string;
  value: string;
  label: string;
  color: string;
  delay?: number;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 100 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, animatedStyle]}>
      <View style={[styles.statIconBg, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </Animated.View>
  );
}

// Premium Welcome Header
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
    <Animated.View
      entering={FadeInDown.duration(500)}
      style={[styles.welcomeContainer, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}
    >
      <LinearGradient
        colors={[`${colors.gold}08`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeTextSection}>
          <Text style={[styles.welcomeGreeting, { color: colors.gold }]}>Welcome back,</Text>
          <Text style={[styles.welcomeName, { color: colors.text }]}>{displayName}!</Text>
          <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            Your voice matters in civic governance
          </Text>
        </View>
        <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.gold, ...SHADOWS.glow }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>{letter}</Text>
          </View>
          {isVerified && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
      <View style={[styles.citizenBadge, { backgroundColor: isVerified ? colors.gold : colors.goldLight }]}>
        <Ionicons
          name={isVerified ? 'shield-checkmark' : 'shield-outline'}
          size={14}
          color={isVerified ? colors.background : colors.gold}
        />
        <Text style={[styles.citizenText, { color: isVerified ? colors.background : colors.gold }]}>
          {isVerified ? 'Verified Citizen' : 'Active Citizen'}
        </Text>
      </View>
    </Animated.View>
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
      const votedIds = new Set((votedRes.data || []).map((v: any) => typeof v === 'object' ? v.proposalId : v));
      const claimedIds = new Set((claimedRes.data || []).map((c: any) => typeof c === 'object' ? c.proposalId : c));

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
                urgent.push({ id: p.id, title: p.title || 'Untitled', hoursLeft, category: p.category || 'General' });
              }
            }
          } catch { }
        }
      });

      urgent.sort((a, b) => a.hoursLeft - b.hoursLeft);

      const unclaimed = proposals.filter((p: any) => !claimedIds.has(p.id) && !votedIds.has(p.id)).length;

      const profile = profileRes.data;
      const userCountry = profile?.country || user?.country || '';
      const userState = profile?.state || user?.state || '';
      const userCity = profile?.city || user?.city || '';

      const countryFlags: Record<string, string> = {
        'Canada': '🇨🇦', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧', 'Australia': '🇦🇺',
        'Germany': '🇩🇪', 'France': '🇫🇷', 'Japan': '🇯🇵', 'India': '🇮🇳',
        'Brazil': '🇧🇷', 'Mexico': '🇲🇽', 'Spain': '🇪🇸', 'Italy': '🇮🇹',
      };

      const communityMap: Record<string, Community> = {};

      if (userCountry) {
        communityMap['country'] = { id: 'country', name: userCountry, type: 'country', icon: countryFlags[userCountry] || '🌍', proposalCount: 0, unvotedCount: 0 };
      }
      if (userState) {
        communityMap['state'] = { id: 'state', name: userState, type: 'state', icon: '🏛️', proposalCount: 0, unvotedCount: 0 };
      }
      if (userCity) {
        communityMap['city'] = { id: 'city', name: userCity, type: 'city', icon: '🏙️', proposalCount: 0, unvotedCount: 0 };
      }

      proposals.forEach((p: any) => {
        const geoRestrictions: string[] = p.geoRestrictions || [];
        const isGlobal = geoRestrictions.length === 0;
        const matchesCountry = isGlobal || (geoRestrictions.length >= 1 && geoRestrictions[0] === userCountry);

        if (userCountry && communityMap['country'] && matchesCountry && geoRestrictions.length <= 1) {
          communityMap['country'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['country'].unvotedCount++;
        }

        if (userState && communityMap['state'] && geoRestrictions.length === 2 && geoRestrictions[0] === userCountry && geoRestrictions[1] === userState) {
          communityMap['state'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['state'].unvotedCount++;
        }

        if (userCity && communityMap['city'] && geoRestrictions.length === 3 && geoRestrictions[0] === userCountry && geoRestrictions[1] === userState && geoRestrictions[2] === userCity) {
          communityMap['city'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['city'].unvotedCount++;
        }
      });

      const passedCount = proposals.filter((p: any) => {
        const total = (p.supportVotes || 0) + (p.opposeVotes || 0);
        return total > 0 && (p.supportVotes || 0) > (p.opposeVotes || 0) && votedIds.has(p.id);
      }).length;

      setStats({ pending: pendingCount, voted: votedIds.size, passed: passedCount });
      setCommunities(Object.values(communityMap).filter(c => c.proposalCount > 0));
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
          message: `New: ${title.length > 35 ? title.substring(0, 35) + '...' : title}`,
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

  // Loading State with Skeleton
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.skeletonHeader}>
          <View style={[styles.skeletonWelcome, { backgroundColor: colors.cardBg }]} />
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* Welcome Header */}
        <WelcomeHeader
          name={user?.name}
          isVerified={isVerified}
          onAvatarPress={() => router.push('/(tabs)/profile')}
        />

        {/* Verification Banner */}
        {!isVerified && isAuthenticated && (
          <AnimatedTouchable
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.alertBanner, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}
            onPress={() => router.push('/(tabs)/identity')}
            activeOpacity={0.8}
          >
            <View style={[styles.alertIconBg, { backgroundColor: colors.warning }]}>
              <Ionicons name="shield-outline" size={20} color="#fff" />
            </View>
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: colors.text }]}>Verify Your Identity</Text>
              <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>
                Complete verification to vote on proposals
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.warning} />
          </AnimatedTouchable>
        )}

        {/* Voting Streak */}
        {votingStreak > 0 && (
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={[styles.streakCard, { backgroundColor: colors.goldLight, borderColor: colors.gold }]}
          >
            <LinearGradient
              colors={[`${colors.gold}15`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.streakEmoji}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={[styles.streakTitle, { color: colors.gold }]}>{votingStreak} Day Voting Streak!</Text>
              <Text style={[styles.streakSubtitle, { color: colors.text }]}>Keep voting to maintain your streak</Text>
            </View>
          </Animated.View>
        )}

        {/* Unclaimed Tokens */}
        {unclaimedTokens > 0 && (
          <AnimatedTouchable
            entering={FadeInUp.delay(400).duration(400)}
            style={[styles.alertBanner, { backgroundColor: colors.successLight, borderColor: colors.success }]}
            onPress={navigateToProposals}
            activeOpacity={0.8}
          >
            <View style={[styles.alertIconBg, { backgroundColor: colors.success }]}>
              <Ionicons name="ticket" size={20} color="#fff" />
            </View>
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: colors.text }]}>
                {unclaimedTokens} Vote Token{unclaimedTokens > 1 ? 's' : ''} Available
              </Text>
              <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>Claim now to participate</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.success} />
          </AnimatedTouchable>
        )}

        {/* Stats */}
        <SectionHeader title="YOUR STATS" style={{ marginTop: SPACING.lg }} />
        <View style={styles.statsGrid}>
          <StatCard icon="time-outline" value={stats.pending.toString()} label="Pending" color={colors.warning} delay={0} />
          <StatCard icon="checkmark-done-outline" value={stats.voted.toString()} label="Voted" color={colors.success} delay={100} />
          <StatCard icon="trophy-outline" value={stats.passed.toString()} label="Passed" color={colors.gold} delay={200} />
        </View>

        {/* Urgent Proposals */}
        {urgentProposals.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="CLOSING SOON" icon="alarm" iconColor={colors.error} />
            {urgentProposals.map((proposal, index) => (
              <AnimatedTouchable
                key={proposal.id}
                entering={FadeInRight.delay(index * 100).duration(300)}
                style={[styles.urgentCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={navigateToProposals}
                activeOpacity={0.7}
              >
                <View style={styles.urgentInfo}>
                  <Text style={[styles.urgentTitle, { color: colors.text }]} numberOfLines={1}>
                    {proposal.title}
                  </Text>
                  <Badge label={proposal.category} variant="gold" size="sm" />
                </View>
                <View style={[styles.urgentTime, { backgroundColor: colors.errorLight }]}>
                  <Ionicons name="time" size={14} color={colors.error} />
                  <Text style={[styles.urgentTimeText, { color: colors.error }]}>{proposal.hoursLeft}h</Text>
                </View>
              </AnimatedTouchable>
            ))}
          </View>
        )}

        {/* Communities */}
        {communities.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="YOUR COMMUNITIES" />
            {communities.map((community, index) => (
              <AnimatedTouchable
                key={community.id}
                entering={FadeInRight.delay(index * 100).duration(300)}
                style={[styles.communityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={navigateToProposals}
                activeOpacity={0.7}
              >
                <Text style={styles.communityIcon}>{community.icon}</Text>
                <View style={styles.communityInfo}>
                  <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
                  <Text style={[styles.communityMeta, { color: colors.textSecondary }]}>
                    {community.proposalCount} proposal{community.proposalCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                {community.unvotedCount > 0 ? (
                  <CountBadge count={community.unvotedCount} />
                ) : (
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                )}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: SPACING.sm }} />
              </AnimatedTouchable>
            ))}
          </View>
        )}

        {/* Recent Activity */}
        {activities.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="RECENT ACTIVITY" />
            {activities.map((activity, index) => (
              <Animated.View
                key={activity.id}
                entering={FadeInRight.delay(index * 100).duration(300)}
                style={[styles.activityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              >
                <View style={[styles.activityIconBg, { backgroundColor: `${activity.color}15` }]}>
                  <Ionicons name={activity.icon as any} size={18} color={activity.color} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={[styles.activityMessage, { color: colors.text }]}>{activity.message}</Text>
                  <Text style={[styles.activityTime, { color: colors.textMuted }]}>{activity.time}</Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )}

        {/* CTA Button */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.ctaContainer}>
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

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 60,
  },
  // Skeleton Loading
  skeletonHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
  },
  skeletonWelcome: {
    height: 160,
    borderRadius: BORDER_RADIUS.xxl,
  },
  skeletonContent: {
    padding: SPACING.lg,
  },
  // Welcome Header
  welcomeContainer: {
    marginHorizontal: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  welcomeTextSection: {
    flex: 1,
  },
  welcomeGreeting: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },
  welcomeName: {
    ...TYPOGRAPHY.headlineLarge,
    marginTop: SPACING.xxs,
  },
  welcomeSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xs,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F0F12',
  },
  citizenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  citizenText: {
    ...TYPOGRAPHY.labelMedium,
  },
  // Alert Banners
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  alertIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  alertTitle: {
    ...TYPOGRAPHY.labelLarge,
  },
  alertSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  // Streak Card
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  streakEmoji: {
    fontSize: 32,
  },
  streakInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  streakTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  streakSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
  },
  statLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xxs,
  },
  // Sections
  section: {
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  // Urgent Cards
  urgentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  urgentInfo: {
    flex: 1,
    gap: SPACING.sm,
  },
  urgentTitle: {
    ...TYPOGRAPHY.labelLarge,
  },
  urgentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  urgentTimeText: {
    ...TYPOGRAPHY.labelMedium,
  },
  // Community Cards
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  communityIcon: {
    fontSize: 28,
    marginRight: SPACING.md,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    ...TYPOGRAPHY.labelLarge,
  },
  communityMeta: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  // Activity Cards
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
  activityInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  activityMessage: {
    ...TYPOGRAPHY.labelLarge,
  },
  activityTime: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  // CTA
  ctaContainer: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },
  bottomPadding: {
    height: 120,
  },
});
