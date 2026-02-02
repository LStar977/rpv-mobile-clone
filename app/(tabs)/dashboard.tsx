import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi } from '../../lib/api';
import { Button, Badge, CountBadge, SectionHeader } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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

// --- Premium Stat Card ---
function StatCard({
  icon,
  value,
  label,
  accent,
  delay = 0,
}: {
  icon: string;
  value: string;
  label: string;
  accent: string;
  delay?: number;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, ANIMATION.spring.gentle));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }, animatedStyle]}
    >
      <LinearGradient
        colors={[`${accent}08`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[styles.statIconContainer, { backgroundColor: `${accent}15` }]}>
        <Ionicons name={icon as any} size={18} color={accent} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </Animated.View>
  );
}

// --- Premium Welcome Header ---
function WelcomeHeader({
  name,
  isVerified,
  onAvatarPress,
  onNotificationPress,
}: {
  name?: string;
  isVerified: boolean;
  onAvatarPress: () => void;
  onNotificationPress?: () => void;
}) {
  const { colors } = useTheme();
  const displayName = name ? name.split(' ')[0] : 'there';
  const letter = name ? name.charAt(0).toUpperCase() : 'U';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    if (isVerified) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
    }
  }, [isVerified]);

  const verifiedPulse = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(500).springify()} style={styles.welcomeContainer}>
      <View style={styles.welcomeContent}>
        <Text style={[styles.welcomeGreeting, { color: colors.textTertiary }]}>
          {getGreeting()}
        </Text>
        <Text style={[styles.welcomeName, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      <View style={styles.welcomeActions}>
        {onNotificationPress && (
          <TouchableOpacity
            onPress={onNotificationPress}
            style={[styles.notificationButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.gold, colors.goldDark || '#A68523']}
            style={styles.avatarGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.avatarFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.avatarText, { color: colors.background }]}>{letter}</Text>
              </LinearGradient>
            </View>
          </LinearGradient>
          {isVerified && (
            <Animated.View style={[styles.verifiedBadge, { backgroundColor: colors.success }, verifiedPulse]}>
              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// --- Premium Priority Card ---
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
  const { colors, isDark } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2500 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]) }],
  }));

  const mode: 'verify' | 'urgent' | 'explore' = useMemo(() => {
    if (isAuthenticated && !isVerified) return 'verify';
    if (urgentCount > 0) return 'urgent';
    return 'explore';
  }, [isAuthenticated, isVerified, urgentCount]);

  const config = {
    verify: {
      icon: 'shield-checkmark',
      gradientColors: [colors.warning, '#D4A318'] as const,
      bgColor: `${colors.warning}12`,
      title: 'Complete Verification',
      subtitle: 'Verify your identity to unlock voting on proposals in your community.',
      cta: 'Start Verification',
      chip: 'Required',
      onPress: onVerify,
    },
    urgent: {
      icon: 'flame',
      gradientColors: [colors.error, '#E84545'] as const,
      bgColor: `${colors.error}12`,
      title: 'Time-Sensitive Votes',
      subtitle: `${urgentCount} proposal${urgentCount === 1 ? '' : 's'} closing within 48 hours need your attention.`,
      cta: 'Vote Now',
      chip: `${urgentCount} urgent`,
      onPress: onSeeUrgent,
    },
    explore: {
      icon: 'compass',
      gradientColors: [colors.gold, colors.goldDark || '#A68523'] as const,
      bgColor: `${colors.gold}08`,
      title: pendingCount > 0 ? 'Pending Proposals' : 'Stay Engaged',
      subtitle: pendingCount > 0
        ? `You have ${pendingCount} proposal${pendingCount === 1 ? '' : 's'} waiting for your vote.`
        : 'Explore new proposals and make your voice heard in your community.',
      cta: 'Explore Proposals',
      chip: pendingCount > 0 ? `${pendingCount} pending` : 'Discover',
      onPress: onExplore,
    },
  };

  const { icon, gradientColors, bgColor, title, subtitle, cta, chip, onPress } = config[mode];

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(150).duration(500).springify()}
      activeOpacity={0.92}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={[styles.priorityCard, { backgroundColor: bgColor, borderColor: `${gradientColors[0]}30` }]}
    >
      {/* Shimmer effect */}
      <View style={styles.shimmerContainer}>
        <Animated.View style={[styles.shimmerBar, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', `${gradientColors[0]}15`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
        </Animated.View>
      </View>

      {/* Header row */}
      <View style={styles.priorityHeader}>
        <LinearGradient
          colors={gradientColors}
          style={styles.priorityIconContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={icon as any} size={22} color="#FFFFFF" />
        </LinearGradient>

        <View style={[styles.priorityChip, { backgroundColor: `${gradientColors[0]}20` }]}>
          <View style={[styles.priorityChipDot, { backgroundColor: gradientColors[0] }]} />
          <Text style={[styles.priorityChipText, { color: gradientColors[0] }]}>{chip}</Text>
        </View>
      </View>

      {/* Content */}
      <Text style={[styles.priorityTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.prioritySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

      {/* Urgent proposal preview */}
      {mode === 'urgent' && topUrgent?.title && (
        <View style={[styles.urgentPreview, { backgroundColor: `${colors.error}10`, borderColor: `${colors.error}25` }]}>
          <Ionicons name="document-text-outline" size={16} color={colors.error} />
          <Text style={[styles.urgentPreviewText, { color: colors.text }]} numberOfLines={1}>
            {topUrgent.title}
          </Text>
          <View style={[styles.urgentTimeChip, { backgroundColor: `${colors.error}20` }]}>
            <Ionicons name="time-outline" size={12} color={colors.error} />
            <Text style={[styles.urgentTimeText, { color: colors.error }]}>{topUrgent.hoursLeft}h</Text>
          </View>
        </View>
      )}

      {/* CTA Button */}
      <View style={styles.priorityCta}>
        <LinearGradient
          colors={gradientColors}
          style={styles.priorityCtaButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.priorityCtaText}>{cta}</Text>
          <View style={styles.priorityCtaIconContainer}>
            <Ionicons name="arrow-forward" size={16} color={gradientColors[0]} />
          </View>
        </LinearGradient>
      </View>
    </AnimatedTouchable>
  );
}

// --- Urgent Proposal Card ---
function UrgentProposalCard({
  proposal,
  index,
  onPress,
}: {
  proposal: UrgentProposal;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const getUrgencyColor = (hours: number) => {
    if (hours <= 6) return colors.error;
    if (hours <= 24) return colors.warning;
    return colors.gold;
  };

  const urgencyColor = getUrgencyColor(proposal.hoursLeft);

  return (
    <AnimatedTouchable
      entering={FadeInRight.delay(index * 80).duration(350)}
      style={[styles.urgentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.75}
    >
      <View style={[styles.urgentCardAccent, { backgroundColor: urgencyColor }]} />
      <View style={styles.urgentCardContent}>
        <View style={styles.urgentCardHeader}>
          <Badge label={proposal.category} variant="default" size="sm" />
          <View style={[styles.urgentCardTime, { backgroundColor: `${urgencyColor}15` }]}>
            <Ionicons name="time-outline" size={14} color={urgencyColor} />
            <Text style={[styles.urgentCardTimeText, { color: urgencyColor }]}>{proposal.hoursLeft}h left</Text>
          </View>
        </View>
        <Text style={[styles.urgentCardTitle, { color: colors.text }]} numberOfLines={2}>
          {proposal.title}
        </Text>
      </View>
      <View style={[styles.urgentCardArrow, { backgroundColor: colors.surfaceHover || `${colors.gold}08` }]}>
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </View>
    </AnimatedTouchable>
  );
}

// --- Community Card ---
function CommunityCard({
  community,
  index,
  onPress,
}: {
  community: Community;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <AnimatedTouchable
      entering={FadeInRight.delay(index * 70).duration(300)}
      style={[styles.communityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.75}
    >
      <View style={[styles.communityIcon, { backgroundColor: `${colors.gold}10` }]}>
        <Text style={styles.communityIconText}>{community.icon}</Text>
      </View>
      <View style={styles.communityContent}>
        <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
        <Text style={[styles.communityMeta, { color: colors.textTertiary }]}>
          {community.proposalCount} proposal{community.proposalCount !== 1 ? 's' : ''}
        </Text>
      </View>
      {community.unvotedCount > 0 && (
        <View style={[styles.communityBadge, { backgroundColor: colors.gold }]}>
          <Text style={[styles.communityBadgeText, { color: colors.background }]}>
            {community.unvotedCount}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </AnimatedTouchable>
  );
}

// --- Activity Card ---
function ActivityCard({
  activity,
  index,
}: {
  activity: ActivityItem;
  index: number;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 60).duration(280)}
      style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.activityIcon, { backgroundColor: `${activity.color}12` }]}>
        <Ionicons name={activity.icon as any} size={18} color={activity.color} />
      </View>
      <View style={styles.activityContent}>
        <Text style={[styles.activityMessage, { color: colors.text }]} numberOfLines={1}>
          {activity.message}
        </Text>
        <Text style={[styles.activityTime, { color: colors.textTertiary }]}>{activity.time}</Text>
      </View>
    </Animated.View>
  );
}

// --- Main Dashboard Screen ---
export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ pending: 0, voted: 0, passed: 0 });
  const [communities, setCommunities] = useState<Community[]>([]);
  const [urgentProposals, setUrgentProposals] = useState<UrgentProposal[]>([]);
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
          icon: 'document-text-outline',
          color: colors.gold,
        });
      }
      if (votedIds.size > 0) {
        recentActivities.push({
          id: '2',
          type: 'badge_earned',
          message: `You've cast ${votedIds.size} vote${votedIds.size > 1 ? 's' : ''}`,
          time: 'Recent',
          icon: 'trophy-outline',
          color: colors.success,
        });
      }
      setActivities(recentActivities);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user, colors.gold, colors.success]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const navigateToProposals = () => router.push('/(tabs)/proposals');

  // Loading skeleton
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContent}>
          <SkeletonWelcome />
          <View style={styles.loadingCards}>
            <SkeletonStats count={3} />
          </View>
          <View style={styles.loadingList}>
            <SkeletonListItem />
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Welcome Header */}
        <WelcomeHeader
          name={user?.name ?? undefined}
          isVerified={isVerified}
          onAvatarPress={() => router.push('/(tabs)/profile')}
        />

        {/* Priority Card */}
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

        {/* Stats Section */}
        <View style={styles.section}>
          <SectionHeader title="YOUR IMPACT" style={styles.sectionHeader} />
          <View style={styles.statsGrid}>
            <StatCard
              icon="hourglass-outline"
              value={stats.pending.toString()}
              label="Pending"
              accent={colors.warning}
              delay={0}
            />
            <StatCard
              icon="checkmark-circle-outline"
              value={stats.voted.toString()}
              label="Voted"
              accent={colors.success}
              delay={80}
            />
            <StatCard
              icon="trophy-outline"
              value={stats.passed.toString()}
              label="Passed"
              accent={colors.gold}
              delay={160}
            />
          </View>
        </View>

        {/* Urgent Proposals */}
        {urgentProposals.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="CLOSING SOON"
              icon="flame-outline"
              iconColor={colors.error}
              style={styles.sectionHeader}
            />
            {urgentProposals.map((proposal, idx) => (
              <UrgentProposalCard
                key={proposal.id}
                proposal={proposal}
                index={idx}
                onPress={navigateToProposals}
              />
            ))}
          </View>
        )}

        {/* Communities */}
        {communities.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="YOUR COMMUNITIES" style={styles.sectionHeader} />
            {communities.map((community, idx) => (
              <CommunityCard
                key={community.id}
                community={community}
                index={idx}
                onPress={navigateToProposals}
              />
            ))}
          </View>
        )}

        {/* Activity Feed */}
        {activities.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="RECENT ACTIVITY" style={styles.sectionHeader} />
            {activities.map((activity, idx) => (
              <ActivityCard key={activity.id} activity={activity} index={idx} />
            ))}
          </View>
        )}

        {/* Bottom CTA */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.ctaSection}>
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

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
  },
  loadingContent: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
  },
  loadingCards: {
    marginTop: SPACING.xl,
  },
  loadingList: {
    marginTop: SPACING.xxl,
    gap: SPACING.md,
  },

  // Welcome Header
  welcomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeGreeting: {
    ...TYPOGRAPHY.labelMedium,
    letterSpacing: 0.5,
  },
  welcomeName: {
    ...TYPOGRAPHY.displaySmall,
    marginTop: SPACING.xxs,
  },
  welcomeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 24,
    padding: 2,
  },
  avatarFill: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
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
    borderColor: '#0A0A0C',
  },

  // Priority Card
  priorityCard: {
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shimmerBar: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  priorityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  priorityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  priorityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  priorityChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityChipText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  priorityTitle: {
    ...TYPOGRAPHY.headlineLarge,
    marginBottom: SPACING.sm,
  },
  prioritySubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 22,
  },
  urgentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  urgentPreviewText: {
    ...TYPOGRAPHY.labelMedium,
    flex: 1,
  },
  urgentTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  urgentTimeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  priorityCta: {
    marginTop: SPACING.xl,
  },
  priorityCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  priorityCtaText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  priorityCtaIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sections
  section: {
    marginTop: SPACING.xxl,
  },
  sectionHeader: {
    paddingHorizontal: SPACING.lg,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    marginTop: 2,
  },

  // Urgent Cards
  urgentCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  urgentCardAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderBottomLeftRadius: BORDER_RADIUS.xl,
  },
  urgentCardContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  urgentCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  urgentCardTime: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  urgentCardTimeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  urgentCardTitle: {
    ...TYPOGRAPHY.labelLarge,
    lineHeight: 22,
  },
  urgentCardArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },

  // Community Cards
  communityCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
  },
  communityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityIconText: {
    fontSize: 24,
  },
  communityContent: {
    flex: 1,
  },
  communityName: {
    ...TYPOGRAPHY.labelLarge,
  },
  communityMeta: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  communityBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  communityBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '700',
  },

  // Activity Cards
  activityCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    ...TYPOGRAPHY.labelLarge,
  },
  activityTime: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },

  // CTA Section
  ctaSection: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
  },

  bottomSpacer: {
    height: 120,
  },
});
