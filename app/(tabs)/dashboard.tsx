import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
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
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION, responsive } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi } from '../../lib/api';
import { Badge, SectionHeader, BallotDisplay } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

// --- Circular Progress Ring ---
function ProgressRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
}: {
  size: number;
  strokeWidth: number;
  progress: number; // 0-1
  color: string;
  trackColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withDelay(300, withTiming(progress, { duration: 1200 }));
  }, [progress]);

  const animatedProps = useAnimatedStyle(() => {
    const offset = circumference * (1 - animatedProgress.value);
    return { strokeDashoffset: offset } as any;
  });

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={`${circumference}`}
        strokeLinecap="round"
        style={animatedProps}
      />
    </Svg>
  );
}

// --- Quick Action Button ---
function QuickAction({
  icon,
  label,
  onPress,
  isPrimary,
  accentColor,
  delay = 0,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  isPrimary?: boolean;
  accentColor?: string;
  delay?: number;
}) {
  const { colors } = useTheme();

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(delay).duration(400).springify()}
      style={[
        styles.quickAction,
        isPrimary
          ? { borderColor: `${colors.gold}40` }
          : { borderColor: colors.border },
        { backgroundColor: colors.surface },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      activeOpacity={0.8}
    >
      {isPrimary && (
        <LinearGradient
          colors={[`${colors.gold}15`, `${colors.gold}05`]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <View style={[
        styles.quickActionIcon,
        { backgroundColor: isPrimary ? `${colors.gold}20` : `${accentColor || colors.textTertiary}15` },
      ]}>
        <Ionicons
          name={icon as any}
          size={22}
          color={isPrimary ? colors.gold : (accentColor || colors.textSecondary)}
        />
      </View>
      <Text style={[
        styles.quickActionLabel,
        { color: isPrimary ? colors.gold : colors.text },
      ]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

// --- Urgent Card (horizontal scroll) ---
function UrgentScrollCard({
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
      style={[styles.urgentScrollCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[`${urgencyColor}10`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.urgentScrollCardHeader}>
        <Badge label={proposal.category} variant="default" size="sm" />
        <View style={[styles.urgentScrollCardTime, { backgroundColor: `${urgencyColor}15` }]}>
          <Ionicons name="time-outline" size={12} color={urgencyColor} />
          <Text style={[styles.urgentScrollCardTimeText, { color: urgencyColor }]}>
            {proposal.hoursLeft}h
          </Text>
        </View>
      </View>
      <Text style={[styles.urgentScrollCardTitle, { color: colors.text }]} numberOfLines={2}>
        {proposal.title}
      </Text>
      <View style={styles.urgentScrollCardFooter}>
        <Text style={[styles.urgentScrollCardCta, { color: urgencyColor }]}>Vote now</Text>
        <Ionicons name="arrow-forward" size={14} color={urgencyColor} />
      </View>
    </AnimatedTouchable>
  );
}

// --- Community Compact Card ---
function CommunityCompactCard({
  community,
  index,
  onPress,
  accentColor,
}: {
  community: Community;
  index: number;
  onPress: () => void;
  accentColor?: string;
}) {
  const { colors } = useTheme();
  const color = accentColor || colors.gold;
  const votedPercent = community.proposalCount > 0
    ? (community.proposalCount - community.unvotedCount) / community.proposalCount
    : 0;

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(400 + index * 80).duration(350).springify()}
      style={[styles.communityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[`${color}08`, 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.communityCardLeft}>
        <Text style={styles.communityCardEmoji}>{community.icon}</Text>
        <View style={styles.communityCardInfo}>
          <Text style={[styles.communityCardName, { color: colors.text }]} numberOfLines={1}>
            {community.name}
          </Text>
          <Text style={[styles.communityCardMeta, { color: colors.textTertiary }]}>
            {community.proposalCount} proposals · {Math.round(votedPercent * 100)}% voted
          </Text>
        </View>
      </View>
      <View style={styles.communityCardRight}>
        {community.unvotedCount > 0 && (
          <View style={[styles.communityCardBadge, { backgroundColor: color }]}>
            <Text style={styles.communityCardBadgeText}>{community.unvotedCount}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </AnimatedTouchable>
  );
}

// Country-themed colors
const countryThemes: Record<string, string> = {
  'Canada': '#FF0000',
  'United States': '#3C3B6E',
  'United Kingdom': '#012169',
  'Australia': '#00843D',
  'Germany': '#000000',
  'France': '#0055A4',
  'Japan': '#BC002D',
  'India': '#FF9933',
  'Brazil': '#009C3B',
  'Mexico': '#006847',
};

// --- Main Dashboard Screen ---
export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { balance: ballotBalance, syncFromChain, tier: ballotTier } = useBallotStore();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ pending: 0, voted: 0, created: 0 });
  const [communities, setCommunities] = useState<Community[]>([]);
  const [urgentProposals, setUrgentProposals] = useState<UrgentProposal[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [liveVoters, setLiveVoters] = useState(0);

  // Separate communities by type for visual hierarchy
  const primaryCommunity = useMemo(() =>
    communities.find(c => c.type === 'country'), [communities]);
  const secondaryCommunities = useMemo(() =>
    communities.filter(c => c.type !== 'country'), [communities]);

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

      // Demo account should use hardcoded location for App Store review
      const isDemoAccount = user?.email === 'demo@represent.app';
      const userCountry = isDemoAccount ? 'Canada' : (profile?.country || user?.country || '');
      const userState = isDemoAccount ? 'Ontario' : (profile?.state || user?.state || '');
      const userCity = isDemoAccount ? 'Toronto' : (profile?.city || user?.city || '');

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
          id: 'country', name: userCountry, type: 'country',
          icon: countryFlags[userCountry] || '🌍', proposalCount: 0, unvotedCount: 0,
        };
      }
      if (userState) {
        communityMap['state'] = {
          id: 'state', name: userState, type: 'state',
          icon: '🏛️', proposalCount: 0, unvotedCount: 0,
        };
      }
      if (userCity) {
        communityMap['city'] = {
          id: 'city', name: userCity, type: 'city',
          icon: '🏙️', proposalCount: 0, unvotedCount: 0,
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
        if (userState && communityMap['state'] && geoRestrictions.length === 2 &&
            geoRestrictions[0] === userCountry && geoRestrictions[1] === userState) {
          communityMap['state'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['state'].unvotedCount++;
        }
        if (userCity && communityMap['city'] && geoRestrictions.length === 3 &&
            geoRestrictions[0] === userCountry && geoRestrictions[1] === userState &&
            geoRestrictions[2] === userCity) {
          communityMap['city'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['city'].unvotedCount++;
        }
      });

      // Count proposals created by the current user
      const nonSeedProposals = proposals.filter((p: any) => p.creatorId !== 'system');
      console.log('[Dashboard] User ID:', user?.id);
      console.log('[Dashboard] Total proposals:', proposals.length, '| Non-seed:', nonSeedProposals.length);
      console.log('[Dashboard] Non-seed creatorIds:', nonSeedProposals.map((p: any) => p.creatorId));
      const createdCount = proposals.filter((p: any) => p.creatorId === user?.id).length;
      console.log('[Dashboard] Created count:', createdCount);

      setStats({ pending: pendingCount, voted: votedIds.size, created: createdCount });
      const filteredCommunities = isDemoAccount
        ? Object.values(communityMap)
        : Object.values(communityMap).filter((c) => c.proposalCount > 0);
      setCommunities(filteredCommunities);
      setUrgentProposals(urgent.slice(0, 5));
      setIsVerified(isDemoAccount ? true : (verificationRes.data?.verified || false));
      setLiveVoters(Math.floor(Math.random() * 15) + 3);

    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user]);

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

  // Computed values
  const totalVotable = stats.voted + stats.pending;
  const voteProgress = totalVotable > 0 ? stats.voted / totalVotable : 0;
  const displayName = user?.name ? user.name.split(' ')[0] : 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Loading skeleton
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContent, { paddingTop: insets.top + 20 }]}>
          <SkeletonWelcome />
          <View style={styles.loadingCards}>
            <SkeletonStats count={3} />
          </View>
          <View style={styles.loadingList}>
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
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
        {/* Compact Header Row */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerRow}>
          <View>
            <Text style={[styles.headerGreeting, { color: colors.textTertiary }]}>
              {getGreeting()}
            </Text>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.text }]}>{displayName}</Text>
              {isVerified && (
                <View style={[styles.verifiedDot, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            <BallotDisplay size="sm" />
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.avatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.avatarText, { color: colors.background }]}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Hero — Circular Progress Ring */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.heroSection}>
          <View style={styles.heroRingContainer}>
            <ProgressRing
              size={180}
              strokeWidth={12}
              progress={voteProgress}
              color={colors.gold}
              trackColor={`${colors.gold}15`}
            />
            <View style={styles.heroRingContent}>
              <Text style={[styles.heroPercentage, { color: colors.text }]}>
                {Math.round(voteProgress * 100)}%
              </Text>
              <Text style={[styles.heroPercentageLabel, { color: colors.textTertiary }]}>
                voted
              </Text>
            </View>
          </View>

          {/* Mini Stats Row */}
          <View style={styles.miniStatsRow}>
            <TouchableOpacity
              style={styles.miniStat}
              onPress={() => router.push('/(tabs)/proposals')}
              activeOpacity={0.7}
            >
              <View style={[styles.miniStatDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.miniStatValue, { color: colors.text }]}>{stats.pending}</Text>
              <Text style={[styles.miniStatLabel, { color: colors.textTertiary }]}>Pending</Text>
            </TouchableOpacity>

            <View style={[styles.miniStatDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.miniStat}
              onPress={() => router.push('/modals/voting-history')}
              activeOpacity={0.7}
            >
              <View style={[styles.miniStatDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.miniStatValue, { color: colors.text }]}>{stats.voted}</Text>
              <Text style={[styles.miniStatLabel, { color: colors.textTertiary }]}>Voted</Text>
            </TouchableOpacity>

            <View style={[styles.miniStatDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={styles.miniStat}
              onPress={() => router.push('/modals/my-proposals')}
              activeOpacity={0.7}
            >
              <View style={[styles.miniStatDot, { backgroundColor: colors.gold }]} />
              <Text style={[styles.miniStatValue, { color: colors.text }]}>{stats.created}</Text>
              <Text style={[styles.miniStatLabel, { color: colors.textTertiary }]}>Created</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="compass-outline"
            label="Vote Now"
            onPress={navigateToProposals}
            isPrimary
            delay={200}
          />
          <QuickAction
            icon="create-outline"
            label="Create"
            onPress={navigateToProposals}
            accentColor={colors.gold}
            delay={280}
          />
          <QuickAction
            icon="time-outline"
            label="History"
            onPress={() => router.push('/modals/voting-history')}
            accentColor={colors.info || colors.textSecondary}
            delay={360}
          />
        </View>

        {/* Closing Soon — Horizontal Scroll */}
        {urgentProposals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderPad}>
              <SectionHeader
                title="CLOSING SOON"
                icon="flame-outline"
                iconColor={colors.error}
                count={urgentProposals.length}
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.urgentScrollContainer}
            >
              {urgentProposals.map((proposal, idx) => (
                <UrgentScrollCard
                  key={proposal.id}
                  proposal={proposal}
                  index={idx}
                  onPress={navigateToProposals}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Communities */}
        {communities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderPad}>
              <SectionHeader title="YOUR COMMUNITIES" />
            </View>
            {communities.map((community, idx) => (
              <CommunityCompactCard
                key={community.id}
                community={community}
                index={idx}
                onPress={navigateToProposals}
                accentColor={community.type === 'country' ? countryThemes[community.name] : undefined}
              />
            ))}
          </View>
        )}

        {/* Bottom CTA */}
        <View style={styles.ctaDivider}>
          <LinearGradient
            colors={['transparent', `${colors.gold}25`, 'transparent']}
            style={{ height: 1 }}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>

        <AnimatedTouchable
          entering={FadeInUp.delay(500).duration(400)}
          style={styles.ctaSection}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigateToProposals();
          }}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[colors.gold, colors.goldDark || '#A68523']}
            style={styles.ctaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.ctaText}>Explore All Proposals</Text>
            <View style={styles.ctaIconCircle}>
              <Ionicons name="arrow-forward" size={18} color={colors.gold} />
            </View>
          </LinearGradient>
        </AnimatedTouchable>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {},
  loadingContent: {
    paddingHorizontal: SPACING.lg,
  },
  loadingCards: {
    marginTop: SPACING.xl,
  },
  loadingList: {
    marginTop: 32,
    gap: SPACING.md,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  headerGreeting: {
    ...TYPOGRAPHY.labelMedium,
    letterSpacing: 0.3,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  headerName: {
    ...TYPOGRAPHY.headlineLarge,
    fontWeight: '700',
  },
  verifiedDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
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
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.md,
  },
  heroRingContainer: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRingContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  heroPercentage: {
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  heroPercentageLabel: {
    ...TYPOGRAPHY.labelMedium,
    marginTop: -2,
  },

  // Mini Stats
  miniStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl,
    gap: SPACING.lg,
  },
  miniStat: {
    alignItems: 'center',
    gap: 2,
  },
  miniStatDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 4,
  },
  miniStatValue: {
    fontSize: 20,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  miniStatLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  miniStatDivider: {
    width: 1,
    height: 32,
  },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
    marginBottom: 8,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionLabel: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginTop: 28,
  },
  sectionHeaderPad: {
    paddingHorizontal: SPACING.xl,
  },

  // Urgent Scroll Cards
  urgentScrollContainer: {
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
    paddingTop: SPACING.sm,
  },
  urgentScrollCard: {
    width: 220,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  urgentScrollCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  urgentScrollCardTime: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: 3,
  },
  urgentScrollCardTimeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  urgentScrollCardTitle: {
    ...TYPOGRAPHY.labelLarge,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  urgentScrollCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  urgentScrollCardCta: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '700',
  },

  // Community Cards
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  communityCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  communityCardEmoji: {
    fontSize: 32,
  },
  communityCardInfo: {
    flex: 1,
  },
  communityCardName: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  communityCardMeta: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
  communityCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  communityCardBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  communityCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // CTA
  ctaDivider: {
    marginHorizontal: 48,
    marginTop: 28,
  },
  ctaSection: {
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.md,
    ...SHADOWS.lg,
  },
  ctaText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  ctaIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bottomSpacer: {
    height: 120,
  },
});
