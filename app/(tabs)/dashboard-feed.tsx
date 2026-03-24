import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, responsive } from '../../lib/theme';
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

type FeedItem = {
  id: string;
  type: 'urgent' | 'proposal' | 'community' | 'milestone';
  title: string;
  subtitle?: string;
  description?: string;
  category?: string;
  timestamp: string;
  timeAgo: string;
  supportVotes?: number;
  opposeVotes?: number;
  hoursLeft?: number;
  icon: string;
  accentColor: string;
  communityIcon?: string;
  unvotedCount?: number;
  votedPercent?: number;
};

// --- Mini Progress Ring ---
function MiniRing({ size, strokeWidth, progress, color, trackColor }: {
  size: number; strokeWidth: number; progress: number; color: string; trackColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withDelay(200, withTiming(progress, { duration: 1000 }));
  }, [progress]);

  const animatedProps = useAnimatedStyle(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  } as any));

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="transparent" />
      <AnimatedCircle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={`${circumference}`} strokeLinecap="round" style={animatedProps} />
    </Svg>
  );
}

// --- Feed Item Card ---
function FeedCard({ item, index, onPress }: { item: FeedItem; index: number; onPress: () => void }) {
  const { colors } = useTheme();
  const totalVotes = (item.supportVotes || 0) + (item.opposeVotes || 0);
  const supportPercent = totalVotes > 0 ? ((item.supportVotes || 0) / totalVotes) * 100 : 0;

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(200 + index * 60).duration(350)}
      style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      activeOpacity={0.8}
    >
      {/* Left accent */}
      <View style={[styles.feedCardAccent, { backgroundColor: item.accentColor }]} />

      {/* Content */}
      <View style={styles.feedCardBody}>
        {/* Header row */}
        <View style={styles.feedCardHeader}>
          <View style={styles.feedCardTypeRow}>
            <View style={[styles.feedCardDot, { backgroundColor: item.accentColor }]} />
            <Text style={[styles.feedCardType, { color: item.accentColor }]}>
              {item.type === 'urgent' ? 'Closing Soon' :
               item.type === 'proposal' ? 'New Proposal' :
               item.type === 'community' ? 'Community' : 'Milestone'}
            </Text>
            {item.category && (
              <Badge label={item.category} variant="default" size="sm" />
            )}
          </View>
          <Text style={[styles.feedCardTime, { color: colors.textTertiary }]}>{item.timeAgo}</Text>
        </View>

        {/* Title */}
        <Text style={[styles.feedCardTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Description */}
        {item.description && (
          <Text style={[styles.feedCardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {/* Vote bar for proposals */}
        {totalVotes > 0 && (
          <View style={styles.feedCardVoteSection}>
            <View style={[styles.feedCardVoteBarBg, { backgroundColor: `${colors.error}20` }]}>
              <View style={[styles.feedCardVoteBarFill, { width: `${supportPercent}%`, backgroundColor: colors.success }]} />
            </View>
            <View style={styles.feedCardVoteMeta}>
              <Text style={[styles.feedCardVoteText, { color: colors.textTertiary }]}>
                {supportPercent.toFixed(0)}% support · {totalVotes} votes
              </Text>
              {item.hoursLeft !== undefined && (
                <View style={[styles.feedCardTimeBadge, { backgroundColor: `${item.accentColor}15` }]}>
                  <Ionicons name="time-outline" size={11} color={item.accentColor} />
                  <Text style={[styles.feedCardTimeBadgeText, { color: item.accentColor }]}>
                    {item.hoursLeft}h left
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Community variant */}
        {item.type === 'community' && (
          <View style={styles.feedCardCommunityMeta}>
            <Text style={[styles.feedCardCommunityText, { color: colors.textSecondary }]}>
              {item.unvotedCount} unvoted · {item.votedPercent}% participation
            </Text>
          </View>
        )}

        {/* Action */}
        <View style={styles.feedCardAction}>
          <Text style={[styles.feedCardActionText, { color: item.accentColor }]}>
            {item.type === 'urgent' ? 'Vote now' :
             item.type === 'proposal' ? 'View proposal' :
             item.type === 'community' ? 'See all' : 'View'}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={item.accentColor} />
        </View>
      </View>
    </AnimatedTouchable>
  );
}

// --- Relative Time Helper ---
function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Country-themed colors
const countryThemes: Record<string, string> = {
  'Canada': '#FF0000', 'United States': '#3C3B6E', 'United Kingdom': '#012169',
  'Australia': '#00843D', 'Germany': '#000000', 'France': '#0055A4',
  'Japan': '#BC002D', 'India': '#FF9933', 'Brazil': '#009C3B', 'Mexico': '#006847',
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
  const [allProposals, setAllProposals] = useState<any[]>([]);

  const primaryCommunity = useMemo(() => communities.find(c => c.type === 'country'), [communities]);
  const secondaryCommunities = useMemo(() => communities.filter(c => c.type !== 'country'), [communities]);

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
          } catch {}
        }
      });

      urgent.sort((a, b) => a.hoursLeft - b.hoursLeft);

      const profile = profileRes.data;
      const isDemoAccount = user?.email === 'demo@represent.app';
      const userCountry = isDemoAccount ? 'Canada' : (profile?.country || user?.country || '');
      const userState = isDemoAccount ? 'Ontario' : (profile?.state || user?.state || '');
      const userCity = isDemoAccount ? 'Toronto' : (profile?.city || user?.city || '');

      const countryFlags: Record<string, string> = {
        Canada: '🇨🇦', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧', Australia: '🇦🇺',
        Germany: '🇩🇪', France: '🇫🇷', Japan: '🇯🇵', India: '🇮🇳', Brazil: '🇧🇷',
        Mexico: '🇲🇽', Spain: '🇪🇸', Italy: '🇮🇹',
      };

      const communityMap: Record<string, Community> = {};
      if (userCountry) communityMap['country'] = { id: 'country', name: userCountry, type: 'country', icon: countryFlags[userCountry] || '🌍', proposalCount: 0, unvotedCount: 0 };
      if (userState) communityMap['state'] = { id: 'state', name: userState, type: 'state', icon: '🏛️', proposalCount: 0, unvotedCount: 0 };
      if (userCity) communityMap['city'] = { id: 'city', name: userCity, type: 'city', icon: '🏙️', proposalCount: 0, unvotedCount: 0 };

      proposals.forEach((p: any) => {
        const geo: string[] = p.geoRestrictions || [];
        const isGlobal = geo.length === 0;
        const matchesCountry = isGlobal || (geo.length >= 1 && geo[0] === userCountry);
        if (userCountry && communityMap['country'] && matchesCountry && geo.length <= 1) {
          communityMap['country'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['country'].unvotedCount++;
        }
        if (userState && communityMap['state'] && geo.length === 2 && geo[0] === userCountry && geo[1] === userState) {
          communityMap['state'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['state'].unvotedCount++;
        }
        if (userCity && communityMap['city'] && geo.length === 3 && geo[0] === userCountry && geo[1] === userState && geo[2] === userCity) {
          communityMap['city'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['city'].unvotedCount++;
        }
      });

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
      setAllProposals(proposals);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchDashboardData();
    if (user?.walletAddress) syncFromChain(user.walletAddress);
  }, [fetchDashboardData, user?.walletAddress, syncFromChain]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchDashboardData();
    if (user?.walletAddress) syncFromChain(user.walletAddress);
  }, [fetchDashboardData, user?.walletAddress, syncFromChain]);

  const navigateToProposals = () => router.push('/(tabs)/proposals');

  // Build feed items
  const feedItems = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];

    // Urgent proposals
    urgentProposals.forEach((p) => {
      const proposal = allProposals.find((ap: any) => ap.id === p.id);
      items.push({
        id: `urgent-${p.id}`,
        type: 'urgent',
        title: p.title,
        description: proposal?.description?.substring(0, 120),
        category: p.category,
        timestamp: proposal?.deadline || new Date().toISOString(),
        timeAgo: `${p.hoursLeft}h left`,
        supportVotes: proposal?.supportVotes || 0,
        opposeVotes: proposal?.opposeVotes || 0,
        hoursLeft: p.hoursLeft,
        icon: 'flame',
        accentColor: p.hoursLeft <= 6 ? colors.error : p.hoursLeft <= 24 ? colors.warning : colors.gold,
      });
    });

    // Community updates
    communities.forEach((c) => {
      if (c.unvotedCount > 0) {
        const votedPct = c.proposalCount > 0
          ? Math.round(((c.proposalCount - c.unvotedCount) / c.proposalCount) * 100) : 0;
        items.push({
          id: `community-${c.id}`,
          type: 'community',
          title: `${c.icon} ${c.name}`,
          subtitle: `${c.unvotedCount} new proposals waiting for your vote`,
          timestamp: new Date().toISOString(),
          timeAgo: 'Now',
          icon: 'globe-outline',
          accentColor: countryThemes[c.name] || colors.gold,
          communityIcon: c.icon,
          unvotedCount: c.unvotedCount,
          votedPercent: votedPct,
        });
      }
    });

    // Recent non-seed proposals (newest first)
    const recentProposals = allProposals
      .filter((p: any) => p.creatorId !== 'system' && p.createdAt)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    recentProposals.forEach((p: any) => {
      // Skip if already in urgent
      if (items.some((i) => i.id === `urgent-${p.id}`)) return;
      items.push({
        id: `proposal-${p.id}`,
        type: 'proposal',
        title: p.title || 'Untitled Proposal',
        description: p.description?.substring(0, 120),
        category: p.category,
        timestamp: p.createdAt,
        timeAgo: getTimeAgo(p.createdAt),
        supportVotes: p.supportVotes || 0,
        opposeVotes: p.opposeVotes || 0,
        icon: 'document-text-outline',
        accentColor: colors.info || '#60A5FA',
      });
    });

    // Milestone
    if (stats.voted > 0 && stats.voted % 5 === 0) {
      items.push({
        id: 'milestone-votes',
        type: 'milestone',
        title: `You've cast ${stats.voted} votes!`,
        subtitle: 'Keep making your voice heard.',
        timestamp: new Date().toISOString(),
        timeAgo: '',
        icon: 'trophy',
        accentColor: colors.gold,
      });
    }

    return items;
  }, [urgentProposals, communities, allProposals, stats, colors]);

  // Computed
  const totalVotable = stats.voted + stats.pending;
  const voteProgress = totalVotable > 0 ? stats.voted / totalVotable : 0;
  const displayName = user?.name ? user.name.split(' ')[0] : 'there';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContent, { paddingTop: insets.top + 20 }]}>
          <SkeletonWelcome />
          <View style={styles.loadingCards}><SkeletonStats count={3} /></View>
          <View style={styles.loadingList}>
            <SkeletonListItem /><SkeletonListItem /><SkeletonListItem />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} progressBackgroundColor={colors.surface} />
        }
      >
        {/* Compact Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.headerRow}>
          <View>
            <Text style={[styles.headerGreeting, { color: colors.textTertiary }]}>{getGreeting()}</Text>
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
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
              <LinearGradient colors={[colors.gold, colors.goldDark || '#A68523']} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={[styles.avatarText, { color: colors.background }]}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Pinned Stats Card */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={[styles.pinnedCard, { backgroundColor: colors.surface, borderColor: `${colors.gold}25` }]}>
          <LinearGradient colors={[`${colors.gold}08`, 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />

          <View style={styles.pinnedCardTop}>
            {/* Mini ring */}
            <View style={styles.pinnedRingContainer}>
              <MiniRing size={56} strokeWidth={5} progress={voteProgress} color={colors.gold} trackColor={`${colors.gold}15`} />
              <Text style={[styles.pinnedRingText, { color: colors.text }]}>
                {Math.round(voteProgress * 100)}%
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.pinnedStats}>
              <TouchableOpacity style={styles.pinnedStat} onPress={() => router.push('/(tabs)/proposals')} activeOpacity={0.7}>
                <Text style={[styles.pinnedStatValue, { color: colors.warning }]}>{stats.pending}</Text>
                <Text style={[styles.pinnedStatLabel, { color: colors.textTertiary }]}>Pending</Text>
              </TouchableOpacity>
              <View style={[styles.pinnedStatDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.pinnedStat} onPress={() => router.push('/modals/voting-history')} activeOpacity={0.7}>
                <Text style={[styles.pinnedStatValue, { color: colors.success }]}>{stats.voted}</Text>
                <Text style={[styles.pinnedStatLabel, { color: colors.textTertiary }]}>Voted</Text>
              </TouchableOpacity>
              <View style={[styles.pinnedStatDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.pinnedStat} onPress={() => router.push('/modals/my-proposals')} activeOpacity={0.7}>
                <Text style={[styles.pinnedStatValue, { color: colors.gold }]}>{stats.created}</Text>
                <Text style={[styles.pinnedStatLabel, { color: colors.textTertiary }]}>Created</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.pinnedActions}>
            <TouchableOpacity
              style={[styles.pinnedActionBtn, styles.pinnedActionPrimary]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[colors.gold, colors.goldDark || '#A68523']} style={[StyleSheet.absoluteFill, { borderRadius: BORDER_RADIUS.lg }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
              <Ionicons name="compass-outline" size={16} color="#FFFFFF" />
              <Text style={styles.pinnedActionPrimaryText}>Vote Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pinnedActionBtn, { backgroundColor: colors.surfaceHighlight || `${colors.gold}08`, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigateToProposals(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={16} color={colors.text} />
              <Text style={[styles.pinnedActionText, { color: colors.text }]}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pinnedActionBtn, { backgroundColor: colors.surfaceHighlight || `${colors.gold}08`, borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/modals/voting-history'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={16} color={colors.text} />
              <Text style={[styles.pinnedActionText, { color: colors.text }]}>History</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Feed */}
        <View style={styles.feedSection}>
          <View style={styles.sectionHeaderPad}>
            <SectionHeader title="YOUR FEED" icon="newspaper-outline" iconColor={colors.gold} />
          </View>

          {feedItems.length > 0 ? (
            feedItems.map((item, idx) => (
              <FeedCard
                key={item.id}
                item={item}
                index={idx}
                onPress={navigateToProposals}
              />
            ))
          ) : (
            <Animated.View entering={FadeInUp.delay(300).duration(400)} style={[styles.emptyFeed, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="newspaper-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyFeedTitle, { color: colors.text }]}>Your feed is empty</Text>
              <Text style={[styles.emptyFeedSubtitle, { color: colors.textTertiary }]}>
                New proposals and community updates will appear here
              </Text>
            </Animated.View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {},
  loadingContent: { paddingHorizontal: SPACING.xl },
  loadingCards: { marginTop: SPACING.xl },
  loadingList: { marginTop: 32, gap: SPACING.md },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg,
  },
  headerGreeting: { ...TYPOGRAPHY.labelMedium, letterSpacing: 0.3 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  headerName: { ...TYPOGRAPHY.headlineLarge, fontWeight: '700' },
  verifiedDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },

  // Pinned Stats Card
  pinnedCard: {
    marginHorizontal: SPACING.xl, borderRadius: BORDER_RADIUS.xxl || 24,
    borderWidth: 1.5, padding: SPACING.lg, overflow: 'hidden', marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  pinnedCardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  pinnedRingContainer: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  pinnedRingText: { position: 'absolute', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pinnedStats: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  pinnedStat: { alignItems: 'center' },
  pinnedStatValue: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  pinnedStatLabel: { ...TYPOGRAPHY.labelSmall, marginTop: 1 },
  pinnedStatDivider: { width: 1, height: 28 },

  // Quick Actions in pinned card
  pinnedActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  pinnedActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: BORDER_RADIUS.lg, gap: 6, overflow: 'hidden',
  },
  pinnedActionPrimary: {},
  pinnedActionPrimaryText: { ...TYPOGRAPHY.labelMedium, color: '#FFFFFF', fontWeight: '700' },
  pinnedActionText: { ...TYPOGRAPHY.labelMedium, fontWeight: '600' },

  // Feed
  feedSection: { marginTop: SPACING.md },
  sectionHeaderPad: { paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm },

  // Feed Card
  feedCard: {
    marginHorizontal: SPACING.xl, marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.xl, borderWidth: 1, overflow: 'hidden',
    flexDirection: 'row',
  },
  feedCardAccent: { width: 4 },
  feedCardBody: { flex: 1, padding: SPACING.lg },
  feedCardHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  feedCardTypeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  feedCardDot: { width: 8, height: 8, borderRadius: 4 },
  feedCardType: { ...TYPOGRAPHY.labelSmall, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  feedCardTime: { ...TYPOGRAPHY.labelSmall },
  feedCardTitle: { ...TYPOGRAPHY.labelLarge, fontWeight: '600', lineHeight: 22, marginBottom: 4 },
  feedCardDescription: { ...TYPOGRAPHY.bodySmall, lineHeight: 18, marginBottom: SPACING.sm },

  // Vote bar
  feedCardVoteSection: { marginBottom: SPACING.sm },
  feedCardVoteBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  feedCardVoteBarFill: { height: '100%', borderRadius: 2 },
  feedCardVoteMeta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  feedCardVoteText: { ...TYPOGRAPHY.labelSmall },
  feedCardTimeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full,
  },
  feedCardTimeBadgeText: { fontSize: 10, fontWeight: '700' },

  // Community meta
  feedCardCommunityMeta: { marginBottom: SPACING.sm },
  feedCardCommunityText: { ...TYPOGRAPHY.bodySmall },

  // Action
  feedCardAction: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  feedCardActionText: { ...TYPOGRAPHY.labelSmall, fontWeight: '700' },

  // Empty state
  emptyFeed: {
    marginHorizontal: SPACING.xl, padding: SPACING.xxxl || 40,
    borderRadius: BORDER_RADIUS.xxl || 24, borderWidth: 1, alignItems: 'center',
  },
  emptyFeedTitle: { ...TYPOGRAPHY.headlineSmall, marginTop: SPACING.md },
  emptyFeedSubtitle: { ...TYPOGRAPHY.bodyMedium, textAlign: 'center', marginTop: SPACING.xs },

  bottomSpacer: { height: 120 },
});
