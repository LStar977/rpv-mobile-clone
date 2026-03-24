import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme, SPACING, TYPOGRAPHY } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi } from '../../lib/api';
import { Badge, BallotDisplay } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT * 0.75;
const CARD_GAP = SPACING.md;

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

// ═══════════════════════════════════════════════════════════════════════════
// CARD 1: IDENTITY CARD - Who you are
// ═══════════════════════════════════════════════════════════════════════════
function IdentityCard({
  displayName,
  isVerified,
  user,
  stats,
  colors,
  onProfilePress,
  onVotePress,
}: any) {
  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  return (
    <Animated.View entering={FadeInDown.duration(600)} style={styles.card}>
      <LinearGradient
        colors={[`${colors.gold}15`, `${colors.gold}05`, colors.surface]}
        style={[StyleSheet.absoluteFill, styles.cardGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
      />

      {/* Top bar with ballot */}
      <View style={styles.cardTopBar}>
        <BallotDisplay size="sm" />
        <TouchableOpacity onPress={onProfilePress} activeOpacity={0.8}>
          <LinearGradient colors={[colors.gold, colors.goldDark || '#A68523']} style={styles.avatarLarge}>
            <Text style={[styles.avatarLargeText, { color: colors.background }]}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Main content - centered */}
      <View style={styles.identityContent}>
        <Text style={[styles.greeting, { color: colors.textTertiary }]}>{getGreeting()}</Text>
        <View style={styles.nameRow}>
          <Text style={[styles.heroName, { color: colors.text }]}>{displayName}</Text>
          {isVerified && (
            <View style={[styles.verifiedBadgeLarge, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark" size={14} color="#FFF" />
            </View>
          )}
        </View>

        {/* Impact stats */}
        <View style={styles.impactGrid}>
          <View style={styles.impactItem}>
            <Text style={[styles.impactNumber, { color: colors.gold }]}>{stats.voted}</Text>
            <Text style={[styles.impactLabel, { color: colors.textTertiary }]}>Votes Cast</Text>
          </View>
          <View style={[styles.impactDivider, { backgroundColor: colors.border }]} />
          <View style={styles.impactItem}>
            <Text style={[styles.impactNumber, { color: colors.success }]}>{stats.created}</Text>
            <Text style={[styles.impactLabel, { color: colors.textTertiary }]}>Created</Text>
          </View>
        </View>
      </View>

      {/* Bottom CTA */}
      {stats.pending > 0 && (
        <TouchableOpacity
          style={styles.cardBottomCTA}
          onPress={onVotePress}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[colors.gold, colors.goldDark || '#A68523']}
            style={styles.ctaGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[styles.ctaText, { color: colors.background }]}>
              {stats.pending} votes waiting
            </Text>
            <Ionicons name="arrow-forward" size={20} color={colors.background} />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Scroll indicator */}
      <View style={styles.scrollHint}>
        <Ionicons name="chevron-down" size={24} color={colors.textTertiary} />
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARD 2: URGENT VOTES - Time-sensitive proposals
// ═══════════════════════════════════════════════════════════════════════════
function UrgentVotesCard({ urgentProposals, colors, onProposalPress, onSeeAllPress }: any) {
  const formatTime = (hours: number) => {
    if (hours < 1) return '<1h';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (urgentProposals.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(100).duration(600)} style={styles.card}>
      <LinearGradient
        colors={[`${colors.warning}12`, `${colors.warning}04`, colors.surface]}
        style={[StyleSheet.absoluteFill, styles.cardGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
      />

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.warning}15` }]}>
          <Ionicons name="time" size={28} color={colors.warning} />
        </View>
        <View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Ending Soon</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>
            {urgentProposals.length} proposals need your vote
          </Text>
        </View>
      </View>

      {/* Proposals list */}
      <View style={styles.urgentList}>
        {urgentProposals.slice(0, 4).map((proposal: UrgentProposal, index: number) => (
          <Animated.View
            key={proposal.id}
            entering={SlideInRight.delay(200 + index * 80).duration(400)}
          >
            <TouchableOpacity
              style={[styles.urgentItem, { borderColor: colors.border }]}
              onPress={() => onProposalPress(proposal.id)}
              activeOpacity={0.8}
            >
              <View style={styles.urgentContent}>
                <View style={styles.urgentMeta}>
                  <Badge label={proposal.category} variant="default" size="sm" />
                  <View style={[styles.timeBadge, {
                    backgroundColor: proposal.hoursLeft < 12 ? `${colors.error}15` : `${colors.warning}15`
                  }]}>
                    <Ionicons
                      name="time-outline"
                      size={12}
                      color={proposal.hoursLeft < 12 ? colors.error : colors.warning}
                    />
                    <Text style={[styles.timeText, {
                      color: proposal.hoursLeft < 12 ? colors.error : colors.warning
                    }]}>
                      {formatTime(proposal.hoursLeft)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.urgentTitle, { color: colors.text }]} numberOfLines={2}>
                  {proposal.title}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      {/* Bottom action */}
      <TouchableOpacity style={styles.cardAction} onPress={onSeeAllPress} activeOpacity={0.7}>
        <Text style={[styles.cardActionText, { color: colors.gold }]}>See all proposals</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.gold} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARD 3: COMMUNITIES - Your jurisdictions
// ═══════════════════════════════════════════════════════════════════════════
function CommunitiesCard({ communities, colors, onCommunityPress }: any) {
  if (communities.length === 0) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'country': return 'Country';
      case 'state': return 'State/Province';
      case 'city': return 'City';
      default: return 'Community';
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(200).duration(600)} style={styles.card}>
      <LinearGradient
        colors={[`${colors.info || '#60A5FA'}10`, `${colors.info || '#60A5FA'}03`, colors.surface]}
        style={[StyleSheet.absoluteFill, styles.cardGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
      />

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.info || '#60A5FA'}15` }]}>
          <Ionicons name="globe" size={28} color={colors.info || '#60A5FA'} />
        </View>
        <View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your Communities</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>
            Where your voice matters
          </Text>
        </View>
      </View>

      {/* Communities grid */}
      <View style={styles.communitiesGrid}>
        {communities.map((community: Community, index: number) => {
          const progress = community.proposalCount > 0
            ? ((community.proposalCount - community.unvotedCount) / community.proposalCount) * 100
            : 0;

          return (
            <Animated.View
              key={community.id}
              entering={FadeInUp.delay(300 + index * 100).duration(500)}
            >
              <TouchableOpacity
                style={[styles.communityCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                onPress={onCommunityPress}
                activeOpacity={0.8}
              >
                <Text style={styles.communityIcon}>{community.icon}</Text>
                <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
                <Text style={[styles.communityType, { color: colors.textTertiary }]}>
                  {getTypeLabel(community.type)}
                </Text>

                {/* Progress bar */}
                <View style={styles.communityProgress}>
                  <View style={[styles.progressTrack, { backgroundColor: `${colors.gold}15` }]}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.gold }]} />
                  </View>
                  <Text style={[styles.progressText, { color: colors.textTertiary }]}>
                    {community.proposalCount - community.unvotedCount}/{community.proposalCount} voted
                  </Text>
                </View>

                {community.unvotedCount > 0 && (
                  <View style={[styles.communityBadge, { backgroundColor: colors.gold }]}>
                    <Text style={[styles.communityBadgeText, { color: colors.background }]}>
                      {community.unvotedCount} new
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CARD 4: QUICK ACTIONS - What you can do
// ═══════════════════════════════════════════════════════════════════════════
function ActionsCard({ colors, router }: any) {
  const actions = [
    { icon: 'compass', label: 'Explore', sublabel: 'Browse all', color: colors.gold, route: '/(tabs)/proposals' },
    { icon: 'add-circle', label: 'Create', sublabel: 'New proposal', color: colors.success, route: '/(tabs)/proposals' },
    { icon: 'time', label: 'History', sublabel: 'Past votes', color: colors.info || '#60A5FA', route: '/modals/voting-history' },
    { icon: 'shield-checkmark', label: 'Identity', sublabel: 'Verify', color: colors.accent || '#8B5CF6', route: '/(tabs)/identity' },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.card}>
      <LinearGradient
        colors={[`${colors.gold}08`, colors.surface]}
        style={[StyleSheet.absoluteFill, styles.cardGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.cardIcon, { backgroundColor: `${colors.gold}15` }]}>
          <Ionicons name="flash" size={28} color={colors.gold} />
        </View>
        <View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Quick Actions</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textTertiary }]}>
            Jump right in
          </Text>
        </View>
      </View>

      {/* Actions grid */}
      <View style={styles.actionsGrid}>
        {actions.map((action, index) => (
          <Animated.View
            key={action.label}
            entering={FadeInUp.delay(400 + index * 80).duration(400)}
          >
            <TouchableOpacity
              style={[styles.actionTile, { backgroundColor: `${action.color}08`, borderColor: `${action.color}20` }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(action.route);
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: `${action.color}15` }]}>
                <Ionicons name={action.icon as any} size={32} color={action.color} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
              <Text style={[styles.actionSublabel, { color: colors.textTertiary }]}>{action.sublabel}</Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
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

  // ─── Data fetching ───
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
      const createdCount = proposals.filter((p: any) => p.creatorId === user?.id).length;
      setStats({ pending: pendingCount, voted: votedIds.size, created: createdCount });
      const filteredCommunities = isDemoAccount ? Object.values(communityMap) : Object.values(communityMap).filter((c) => c.proposalCount > 0);
      setCommunities(filteredCommunities);
      setUrgentProposals(urgent.slice(0, 5));
      setIsVerified(isDemoAccount ? true : (verificationRes.data?.verified || false));
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
  const displayName = user?.name ? user.name.split(' ')[0] : 'there';

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        snapToInterval={CARD_HEIGHT + CARD_GAP}
        decelerationRate="fast"
        snapToAlignment="start"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* Card 1: Identity */}
        <IdentityCard
          displayName={displayName}
          isVerified={isVerified}
          user={user}
          stats={stats}
          colors={colors}
          onProfilePress={() => router.push('/(tabs)/profile')}
          onVotePress={navigateToProposals}
        />

        {/* Card 2: Urgent Votes */}
        <UrgentVotesCard
          urgentProposals={urgentProposals}
          colors={colors}
          onProposalPress={(id: number) => router.push({ pathname: '/(tabs)/proposals', params: { proposalId: id } })}
          onSeeAllPress={navigateToProposals}
        />

        {/* Card 3: Communities */}
        <CommunitiesCard
          communities={communities}
          colors={colors}
          onCommunityPress={navigateToProposals}
        />

        {/* Card 4: Quick Actions */}
        <ActionsCard colors={colors} router={router} />

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.md },
  loadingContent: { flex: 1, paddingHorizontal: SPACING.lg },
  loadingCards: { marginTop: SPACING.xl },
  loadingList: { marginTop: SPACING.xl, gap: SPACING.md },

  // ─── Card base ───
  card: {
    minHeight: CARD_HEIGHT,
    borderRadius: 32,
    marginBottom: CARD_GAP,
    padding: SPACING.xl,
    overflow: 'hidden',
  },
  cardGradient: {
    borderRadius: 32,
  },

  // ─── Card header ───
  cardTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
  },
  cardSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: 2,
  },

  // ─── Identity card ───
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: 22,
    fontWeight: '700',
  },
  identityContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    ...TYPOGRAPHY.bodyLarge,
    marginBottom: SPACING.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  heroName: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  verifiedBadgeLarge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xl * 2,
    gap: SPACING.xl,
  },
  impactItem: {
    alignItems: 'center',
  },
  impactNumber: {
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  impactLabel: {
    ...TYPOGRAPHY.labelMedium,
    marginTop: SPACING.xs,
  },
  impactDivider: {
    width: 1,
    height: 48,
  },
  cardBottomCTA: {
    marginTop: 'auto',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md + 4,
    borderRadius: 16,
    gap: SPACING.sm,
  },
  ctaText: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  scrollHint: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    opacity: 0.5,
  },

  // ─── Urgent votes ───
  urgentList: {
    flex: 1,
    gap: SPACING.sm,
  },
  urgentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  urgentContent: {
    flex: 1,
  },
  urgentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  urgentTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  cardActionText: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },

  // ─── Communities ───
  communitiesGrid: {
    flex: 1,
    gap: SPACING.md,
  },
  communityCard: {
    padding: SPACING.lg,
    borderRadius: 20,
    borderWidth: 1,
  },
  communityIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  communityName: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  communityType: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
  communityProgress: {
    marginTop: SPACING.md,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xs,
  },
  communityBadge: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 10,
  },
  communityBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '700',
  },

  // ─── Actions ───
  actionsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionTile: {
    width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.xl * 2 - SPACING.md) / 2,
    aspectRatio: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  actionLabel: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  actionSublabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
});
