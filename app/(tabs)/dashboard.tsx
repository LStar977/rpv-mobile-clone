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
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, responsive } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi } from '../../lib/api';
import { Badge, BallotDisplay } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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

// --- Animated Progress Ring ---
function ProgressRing({ size, strokeWidth, progress, color, trackColor }: {
  size: number; strokeWidth: number; progress: number; color: string; trackColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useSharedValue(0);
  useEffect(() => {
    animatedProgress.value = withDelay(400, withTiming(progress, { duration: 1400 }));
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
  const { syncFromChain } = useBallotStore();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, voted: 0, created: 0 });
  const [communities, setCommunities] = useState<Community[]>([]);
  const [urgentProposals, setUrgentProposals] = useState<UrgentProposal[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [liveVoters, setLiveVoters] = useState(0);
  const [allProposals, setAllProposals] = useState<any[]>([]);

  // ─── Data fetching (identical to all other versions) ───
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
              if (hoursLeft <= 48 && hoursLeft > 0 && !votedIds.has(p.id))
                urgent.push({ id: p.id, title: p.title || 'Untitled', hoursLeft, category: p.category || 'General' });
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
        if (userCountry && communityMap['country'] && (isGlobal || (geo.length >= 1 && geo[0] === userCountry)) && geo.length <= 1) {
          communityMap['country'].proposalCount++; if (!votedIds.has(p.id)) communityMap['country'].unvotedCount++;
        }
        if (userState && communityMap['state'] && geo.length === 2 && geo[0] === userCountry && geo[1] === userState) {
          communityMap['state'].proposalCount++; if (!votedIds.has(p.id)) communityMap['state'].unvotedCount++;
        }
        if (userCity && communityMap['city'] && geo.length === 3 && geo[0] === userCountry && geo[1] === userState && geo[2] === userCity) {
          communityMap['city'].proposalCount++; if (!votedIds.has(p.id)) communityMap['city'].unvotedCount++;
        }
      });
      const nonSeedProposals = proposals.filter((p: any) => p.creatorId !== 'system');
      const createdCount = proposals.filter((p: any) => p.creatorId === user?.id).length;
      setStats({ pending: pendingCount, voted: votedIds.size, created: createdCount });
      const filteredCommunities = isDemoAccount ? Object.values(communityMap) : Object.values(communityMap).filter((c) => c.proposalCount > 0);
      setCommunities(filteredCommunities);
      setUrgentProposals(urgent.slice(0, 5));
      setIsVerified(isDemoAccount ? true : (verificationRes.data?.verified || false));
      setLiveVoters(Math.floor(Math.random() * 15) + 3);
      setAllProposals(proposals);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally { setLoading(false); setRefreshing(false); }
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

  // ─── Computed ───
  const totalVotable = stats.voted + stats.pending;
  const voteProgress = totalVotable > 0 ? stats.voted / totalVotable : 0;
  const displayName = user?.name ? user.name.split(' ')[0] : 'there';
  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  // Top urgent proposal for the hero card
  const topUrgent = urgentProposals[0];
  const topUrgentProposal = topUrgent ? allProposals.find((p: any) => p.id === topUrgent.id) : null;

  // Recent non-seed proposals
  const recentProposals = useMemo(() =>
    allProposals
      .filter((p: any) => p.creatorId !== 'system' && p.createdAt)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3),
    [allProposals]
  );

  // Pulsing animation for live dot
  const livePulse = useSharedValue(1);
  useEffect(() => {
    livePulse.value = withRepeat(withSequence(withTiming(1.4, { duration: 800 }), withTiming(1, { duration: 800 })), -1, false);
  }, []);
  const livePulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: livePulse.value }] }));

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContent, { paddingTop: insets.top + 20 }]}>
          <SkeletonWelcome />
          <View style={styles.loadingCards}><SkeletonStats count={3} /></View>
          <View style={styles.loadingList}><SkeletonListItem /><SkeletonListItem /></View>
        </View>
      </View>
    );
  }

  const CARD_MIN_HEIGHT = SCREEN_HEIGHT * 0.38;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        snapToAlignment="start"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* ═══ CARD 1: Hero / Your Impact ═══ */}
        <Animated.View entering={FadeInDown.duration(500)} style={[styles.card, { minHeight: CARD_MIN_HEIGHT }]}>
          <LinearGradient
            colors={[`${colors.gold}12`, colors.surface, colors.surface]}
            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          {/* Header */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.cardHeaderGreeting, { color: colors.textTertiary }]}>{getGreeting()}</Text>
              <View style={styles.cardHeaderNameRow}>
                <Text style={[styles.cardHeaderName, { color: colors.text }]}>{displayName}</Text>
                {isVerified && (
                  <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
                    <Ionicons name="checkmark" size={10} color="#FFF" />
                  </View>
                )}
              </View>
            </View>
            <View style={styles.cardHeaderRight}>
              <BallotDisplay size="sm" />
              <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
                <LinearGradient colors={[colors.gold, colors.goldDark || '#A68523']} style={styles.avatar}>
                  <Text style={[styles.avatarText, { color: colors.background }]}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Ring + Stats */}
          <View style={styles.heroContent}>
            <View style={styles.heroRingWrap}>
              <ProgressRing size={140} strokeWidth={10} progress={voteProgress} color={colors.gold} trackColor={`${colors.gold}12`} />
              <View style={styles.heroRingInner}>
                <Text style={[styles.heroNumber, { color: colors.text }]}>{Math.round(voteProgress * 100)}%</Text>
                <Text style={[styles.heroNumberLabel, { color: colors.textTertiary }]}>voted</Text>
              </View>
            </View>
            <View style={styles.heroStatsCol}>
              <TouchableOpacity style={styles.heroStat} onPress={navigateToProposals} activeOpacity={0.7}>
                <Text style={[styles.heroStatValue, { color: colors.warning }]}>{stats.pending}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textTertiary }]}>Pending</Text>
              </TouchableOpacity>
              <View style={[styles.heroStatLine, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.heroStat} onPress={() => router.push('/modals/voting-history')} activeOpacity={0.7}>
                <Text style={[styles.heroStatValue, { color: colors.success }]}>{stats.voted}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textTertiary }]}>Voted</Text>
              </TouchableOpacity>
              <View style={[styles.heroStatLine, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.heroStat} onPress={() => router.push('/modals/my-proposals')} activeOpacity={0.7}>
                <Text style={[styles.heroStatValue, { color: colors.gold }]}>{stats.created}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textTertiary }]}>Created</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={[colors.gold, colors.goldDark || '#A68523']} style={styles.heroCta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.heroCtaText}>Vote Now</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ═══ CARD 2: Closing Soon ═══ */}
        {urgentProposals.length > 0 && (
          <Animated.View entering={FadeInUp.delay(150).duration(500)} style={[styles.card, { borderColor: `${colors.error}20` }]}>
            <LinearGradient
              colors={[`${colors.error}08`, colors.surface]}
              style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardTitleIcon, { backgroundColor: `${colors.error}15` }]}>
                <Ionicons name="flame" size={20} color={colors.error} />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Closing Soon</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>
                  {urgentProposals.length} proposal{urgentProposals.length !== 1 ? 's' : ''} need your vote
                </Text>
              </View>
            </View>

            {urgentProposals.slice(0, 3).map((p, idx) => {
              const urgColor = p.hoursLeft <= 6 ? colors.error : p.hoursLeft <= 24 ? colors.warning : colors.gold;
              const proposal = allProposals.find((ap: any) => ap.id === p.id);
              const total = (proposal?.supportVotes || 0) + (proposal?.opposeVotes || 0);
              const pct = total > 0 ? Math.round(((proposal?.supportVotes || 0) / total) * 100) : 0;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.urgentItem, { borderColor: colors.border }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigateToProposals(); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.urgentItemTop}>
                    <Text style={[styles.urgentItemTitle, { color: colors.text }]} numberOfLines={1}>{p.title}</Text>
                    <View style={[styles.urgentTimeBadge, { backgroundColor: `${urgColor}15` }]}>
                      <Ionicons name="time-outline" size={12} color={urgColor} />
                      <Text style={[styles.urgentTimeText, { color: urgColor }]}>{p.hoursLeft}h</Text>
                    </View>
                  </View>
                  <View style={styles.urgentItemBottom}>
                    <View style={[styles.urgentBar, { backgroundColor: `${colors.error}15` }]}>
                      <View style={[styles.urgentBarFill, { width: `${pct}%`, backgroundColor: colors.success }]} />
                    </View>
                    <Text style={[styles.urgentPct, { color: colors.textTertiary }]}>{pct}%</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* ═══ CARD 3: Your Communities ═══ */}
        {communities.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(500)} style={[styles.card, { padding: SPACING.lg }]}>
            <View style={[styles.cardTitleRow, { paddingHorizontal: SPACING.xs }]}>
              <View style={[styles.cardTitleIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="globe-outline" size={20} color={colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Your Communities</Text>
                {liveVoters > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Animated.View style={[styles.liveDotInline, { backgroundColor: colors.success }, livePulseStyle]} />
                    <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>{liveVoters} active now</Text>
                  </View>
                )}
              </View>
            </View>

            {communities.map((c, idx) => {
              const accent = c.type === 'country'
                ? (countryThemes[c.name] || colors.gold)
                : c.type === 'state' ? (colors.accent || '#8B5CF6')
                : (colors.info || '#60A5FA');
              const votedPct = c.proposalCount > 0 ? Math.round(((c.proposalCount - c.unvotedCount) / c.proposalCount) * 100) : 0;
              const typeLabel = c.type === 'country' ? 'Your country' : c.type === 'state' ? 'Your province' : 'Your city';
              return (
                <AnimatedTouchable
                  key={c.id}
                  entering={FadeInUp.delay(350 + idx * 100).duration(400).springify()}
                  style={[styles.communityTile, { borderColor: `${accent}25` }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
                  activeOpacity={0.85}
                >
                  {/* Themed gradient background */}
                  <LinearGradient
                    colors={[`${accent}20`, `${accent}08`, 'transparent']}
                    style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <LinearGradient
                    colors={['transparent', `${accent}12`]}
                    style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />

                  {/* Unvoted badge — top right */}
                  {c.unvotedCount > 0 && (
                    <View style={[styles.communityTileBadge, { backgroundColor: accent, ...SHADOWS.sm }]}>
                      <Text style={styles.communityTileBadgeText}>{c.unvotedCount} new</Text>
                    </View>
                  )}

                  {/* Top row: emoji + ring */}
                  <View style={styles.communityTileTop}>
                    <Text style={styles.communityTileFlag}>{c.icon}</Text>

                    <View style={styles.communityTileRingWrap}>
                      <ProgressRing
                        size={56}
                        strokeWidth={5}
                        progress={votedPct / 100}
                        color={accent}
                        trackColor={`${accent}15`}
                      />
                      <Text style={[styles.communityTileRingText, { color: colors.text }]}>
                        {votedPct}%
                      </Text>
                    </View>
                  </View>

                  {/* Name and meta */}
                  <Text style={[styles.communityTileName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[styles.communityTileMeta, { color: colors.textSecondary }]}>
                    {typeLabel} · {c.proposalCount} proposals
                  </Text>

                  {/* Action */}
                  <View style={styles.communityTileAction}>
                    <Text style={[styles.communityTileActionText, { color: accent }]}>See proposals</Text>
                    <Ionicons name="arrow-forward" size={14} color={accent} />
                  </View>
                </AnimatedTouchable>
              );
            })}
          </Animated.View>
        )}

        {/* ═══ CARD 4: Recent Proposals ═══ */}
        {recentProposals.length > 0 && (
          <Animated.View entering={FadeInUp.delay(450).duration(500)} style={styles.card}>
            <LinearGradient
              colors={[`${colors.info || '#60A5FA'}06`, colors.surface]}
              style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardTitleIcon, { backgroundColor: `${colors.info || '#60A5FA'}15` }]}>
                <Ionicons name="sparkles" size={20} color={colors.info || '#60A5FA'} />
              </View>
              <View>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Latest Proposals</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>Recently created by the community</Text>
              </View>
            </View>

            {recentProposals.map((p: any, idx: number) => {
              const total = (p.supportVotes || 0) + (p.opposeVotes || 0);
              const pct = total > 0 ? Math.round(((p.supportVotes || 0) / total) * 100) : 0;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.recentItem, { borderColor: colors.border }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigateToProposals(); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.recentItemHeader}>
                    <Badge label={p.category || 'General'} variant="default" size="sm" />
                    {total > 0 && (
                      <Text style={[styles.recentItemVotes, { color: colors.textTertiary }]}>{total} votes</Text>
                    )}
                  </View>
                  <Text style={[styles.recentItemTitle, { color: colors.text }]} numberOfLines={2}>{p.title}</Text>
                  {p.description && (
                    <Text style={[styles.recentItemDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                      {p.description}
                    </Text>
                  )}
                  {total > 0 && (
                    <View style={[styles.recentBar, { backgroundColor: `${colors.error}15` }]}>
                      <View style={[styles.recentBarFill, { width: `${pct}%`, backgroundColor: colors.success }]} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* ═══ CARD 5: Quick Actions ═══ */}
        <Animated.View entering={FadeInUp.delay(600).duration(500)} style={[styles.card, { borderColor: `${colors.gold}20` }]}>
          <LinearGradient
            colors={[`${colors.gold}10`, colors.surface]}
            style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={[styles.actionsTitle, { color: colors.text }]}>Quick Actions</Text>

          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: `${colors.gold}10`, borderColor: `${colors.gold}25` }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="compass-outline" size={28} color={colors.gold} />
              <Text style={[styles.actionCardLabel, { color: colors.text }]}>Explore</Text>
              <Text style={[styles.actionCardSub, { color: colors.textTertiary }]}>Browse proposals</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: `${colors.success}08`, borderColor: `${colors.success}20` }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={28} color={colors.success} />
              <Text style={[styles.actionCardLabel, { color: colors.text }]}>Create</Text>
              <Text style={[styles.actionCardSub, { color: colors.textTertiary }]}>New proposal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: `${colors.info || '#60A5FA'}08`, borderColor: `${colors.info || '#60A5FA'}20` }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/modals/voting-history'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={28} color={colors.info || '#60A5FA'} />
              <Text style={[styles.actionCardLabel, { color: colors.text }]}>History</Text>
              <Text style={[styles.actionCardSub, { color: colors.textTertiary }]}>Past votes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: `${colors.accent || '#8B5CF6'}08`, borderColor: `${colors.accent || '#8B5CF6'}20` }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/(tabs)/identity'); }}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark-outline" size={28} color={colors.accent || '#8B5CF6'} />
              <Text style={[styles.actionCardLabel, { color: colors.text }]}>Identity</Text>
              <Text style={[styles.actionCardSub, { color: colors.textTertiary }]}>Verification</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, gap: SPACING.lg },
  loadingContent: { paddingHorizontal: SPACING.xl },
  loadingCards: { marginTop: SPACING.xl },
  loadingList: { marginTop: 32, gap: SPACING.md },

  // ─── Full-width immersive cards ───
  card: {
    backgroundColor: 'transparent',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.md,
  },

  // Card 1: Header
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  cardHeaderGreeting: { ...TYPOGRAPHY.labelMedium, letterSpacing: 0.3 },
  cardHeaderNameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 2 },
  cardHeaderName: { fontSize: responsive(28, 32, 36), fontWeight: '800' },
  verifiedBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },

  // Hero content
  heroContent: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl },
  heroRingWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  heroRingInner: { position: 'absolute', alignItems: 'center' },
  heroNumber: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroNumberLabel: { ...TYPOGRAPHY.labelMedium, marginTop: -2 },
  heroStatsCol: { flex: 1, marginLeft: SPACING.xl, gap: SPACING.md },
  heroStat: { alignItems: 'center' },
  heroStatValue: { fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] },
  heroStatLabel: { ...TYPOGRAPHY.labelSmall, marginTop: 1 },
  heroStatLine: { height: 1, width: '60%', alignSelf: 'center' },

  // Hero CTA
  heroCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: BORDER_RADIUS.full, gap: SPACING.sm,
    ...SHADOWS.lg,
  },
  heroCtaText: { ...TYPOGRAPHY.labelLarge, color: '#FFF', fontWeight: '700' },

  // Card title row
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.lg },
  cardTitleIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...TYPOGRAPHY.headlineSmall, fontWeight: '700' },
  cardSubtitle: { ...TYPOGRAPHY.labelSmall, marginTop: 1 },

  // Urgent items
  urgentItem: {
    paddingVertical: SPACING.md, borderBottomWidth: 1, gap: SPACING.sm,
  },
  urgentItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  urgentItemTitle: { ...TYPOGRAPHY.labelLarge, fontWeight: '600', flex: 1, marginRight: SPACING.md },
  urgentTimeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full,
  },
  urgentTimeText: { fontSize: 11, fontWeight: '700' },
  urgentItemBottom: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  urgentBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  urgentBarFill: { height: '100%', borderRadius: 2 },
  urgentPct: { ...TYPOGRAPHY.labelSmall, fontWeight: '600', width: 32, textAlign: 'right' },

  // Community tiles
  communityTile: {
    borderRadius: 20, borderWidth: 1, padding: SPACING.lg,
    marginTop: SPACING.md, overflow: 'hidden', position: 'relative',
  },
  communityTileBadge: {
    position: 'absolute', top: SPACING.md, right: SPACING.md, zIndex: 1,
    paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: BORDER_RADIUS.full,
  },
  communityTileBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  communityTileTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  communityTileFlag: { fontSize: 48 },
  communityTileIconCircle: {
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
  },
  communityTileRingWrap: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  communityTileRingText: { position: 'absolute', fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  communityTileName: { ...TYPOGRAPHY.headlineSmall, fontWeight: '700' },
  communityTileMeta: { ...TYPOGRAPHY.labelSmall, marginTop: 2 },
  communityTileAction: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.md,
  },
  communityTileActionText: { ...TYPOGRAPHY.labelMedium, fontWeight: '600' },
  liveDotInline: { width: 6, height: 6, borderRadius: 3 },

  // Card bottom action
  cardBottomAction: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.xs, paddingTop: SPACING.lg,
  },
  cardBottomActionText: { ...TYPOGRAPHY.labelMedium, fontWeight: '600' },

  // Recent proposals
  recentItem: { paddingVertical: SPACING.md, borderBottomWidth: 1, gap: SPACING.sm },
  recentItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentItemVotes: { ...TYPOGRAPHY.labelSmall },
  recentItemTitle: { ...TYPOGRAPHY.labelLarge, fontWeight: '600', lineHeight: 22 },
  recentItemDesc: { ...TYPOGRAPHY.bodySmall, lineHeight: 18 },
  recentBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  recentBarFill: { height: '100%', borderRadius: 2 },

  // Quick Actions
  actionsTitle: { ...TYPOGRAPHY.headlineSmall, fontWeight: '700', marginBottom: SPACING.lg },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md },
  actionCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.xl * 2 - SPACING.md) / 2,
    paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl, borderWidth: 1, alignItems: 'center', gap: SPACING.sm,
  },
  actionCardLabel: { ...TYPOGRAPHY.labelLarge, fontWeight: '700' },
  actionCardSub: { ...TYPOGRAPHY.labelSmall },

  bottomSpacer: { height: 100 },
});
