import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi } from '../../lib/api';
import { BallotDisplay } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

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

// --- Jurisdiction Chip (State/City) ---
function JurisdictionChip({
  community,
  onPress,
  index,
}: {
  community: Community;
  onPress: () => void;
  index: number;
}) {
  const { colors, isDark } = useTheme();
  const hasUnvoted = community.unvotedCount > 0;

  return (
    <AnimatedTouchable
      entering={FadeInRight.delay(400 + index * 60).duration(350)}
      style={[
        styles.jurisdictionChip,
        {
          backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
          borderColor: hasUnvoted ? colors.gold : colors.border,
          borderWidth: hasUnvoted ? 1.5 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.jurisdictionIcon}>{community.icon}</Text>
      <Text style={[styles.jurisdictionName, { color: colors.text }]} numberOfLines={1}>
        {community.name}
      </Text>
      {hasUnvoted && (
        <View style={[styles.jurisdictionBadge, { backgroundColor: colors.gold }]}>
          <Text style={styles.jurisdictionBadgeText}>{community.unvotedCount}</Text>
        </View>
      )}
    </AnimatedTouchable>
  );
}

// --- Attention Card (Urgent Proposal) ---
function AttentionCard({
  proposal,
  onPress,
  index,
}: {
  proposal: UrgentProposal;
  onPress: () => void;
  index: number;
}) {
  const { colors, isDark } = useTheme();
  const isUrgent = proposal.hoursLeft < 12;
  const accentColor = isUrgent ? colors.warning : colors.gold;

  const formatTime = (hours: number) => {
    if (hours < 1) return 'Less than 1 hour';
    if (hours === 1) return '1 hour remains';
    if (hours < 24) return `${hours} hours remain`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 day remains' : `${days} days remain`;
  };

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(500 + index * 80).duration(400)}
      style={[
        styles.attentionCard,
        {
          backgroundColor: isDark ? colors.surfaceElevated : colors.surface,
          borderLeftColor: accentColor,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.attentionContent}>
        <Text style={[styles.attentionTitle, { color: colors.text }]} numberOfLines={2}>
          {proposal.title}
        </Text>
        <View style={styles.attentionMeta}>
          <View style={[styles.categoryTag, { backgroundColor: `${accentColor}15` }]}>
            <Text style={[styles.categoryText, { color: accentColor }]}>{proposal.category}</Text>
          </View>
          <Text style={[styles.attentionTime, { color: colors.textTertiary }]}>
            {formatTime(proposal.hoursLeft)}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </AnimatedTouchable>
  );
}

// --- Main Dashboard Screen ---
export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
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

  // Subtle pulse for pending badges
  const badgePulse = useSharedValue(1);
  useEffect(() => {
    badgePulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200 }),
        withTiming(1, { duration: 1200 })
      ),
      -1,
      true
    );
  }, []);

  const badgePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

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
      setUrgentProposals(urgent.slice(0, 4));
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

  const displayName = user?.name ? user.name.split(' ')[0] : 'Citizen';
  const primaryCommunity = communities.find(c => c.type === 'country');
  const secondaryCommunities = communities.filter(c => c.type !== 'country');

  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* ═══ CIVIC IDENTITY HEADER ═══ */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.textTertiary }]}>{getGreeting()}</Text>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
              {isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.gold }]}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.background} />
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <BallotDisplay size="sm" />
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
              <LinearGradient colors={[colors.gold, colors.goldDark || '#A68523']} style={styles.avatar}>
                <Text style={[styles.avatarText, { color: colors.background }]}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Gold accent line */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={[styles.accentLine, { backgroundColor: colors.gold }]} />

        {/* ═══ VOICE CARD (HERO) ═══ */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.voiceCard}>
          <LinearGradient
            colors={[`${colors.gold}08`, colors.surface, colors.surface]}
            style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <View style={[styles.voiceCardBorder, { borderColor: `${colors.gold}20` }]}>
            {stats.pending === 0 ? (
              // Caught up state
              <View style={styles.voiceContent}>
                <View style={[styles.caughtUpIcon, { backgroundColor: `${colors.success}15` }]}>
                  <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                </View>
                <Text style={[styles.voiceHeadline, { color: colors.text }]}>All voices heard</Text>
                <Text style={[styles.voiceSubtext, { color: colors.textSecondary }]}>
                  You've voted on every proposal available to you
                </Text>
                <View style={styles.voiceStats}>
                  <Text style={[styles.voiceStatNumber, { color: colors.gold }]}>{stats.voted}</Text>
                  <Text style={[styles.voiceStatLabel, { color: colors.textTertiary }]}>voices raised</Text>
                </View>
              </View>
            ) : (
              // Pending votes state
              <View style={styles.voiceContent}>
                <Text style={[styles.voiceCount, { color: colors.text }]}>{stats.voted}</Text>
                <Text style={[styles.voiceLabel, { color: colors.textSecondary }]}>voices raised</Text>
                <Text style={[styles.voiceSubtext, { color: colors.textTertiary, marginTop: SPACING.md }]}>
                  Your voice shapes {primaryCommunity?.name || 'democracy'}'s future
                </Text>
                <Animated.View style={[styles.pendingBadge, { backgroundColor: colors.gold }, badgePulseStyle]}>
                  <Text style={[styles.pendingText, { color: colors.background }]}>
                    {stats.pending} awaiting your vote
                  </Text>
                </Animated.View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ═══ JURISDICTION STACK ═══ */}
        {communities.length > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>YOUR JURISDICTIONS</Text>

            {/* Primary (Country) */}
            {primaryCommunity && (
              <TouchableOpacity
                style={[styles.primaryJurisdiction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={navigateToProposals}
                activeOpacity={0.8}
              >
                <View style={styles.jurisdictionHeader}>
                  <Text style={styles.primaryFlag}>{primaryCommunity.icon}</Text>
                  <View style={styles.primaryInfo}>
                    <Text style={[styles.primaryName, { color: colors.text }]}>{primaryCommunity.name}</Text>
                    <Text style={[styles.primaryMeta, { color: colors.textTertiary }]}>
                      {primaryCommunity.proposalCount} proposals · {primaryCommunity.proposalCount - primaryCommunity.unvotedCount} voted
                    </Text>
                  </View>
                  {primaryCommunity.unvotedCount > 0 && (
                    <View style={[styles.primaryBadge, { backgroundColor: colors.gold }]}>
                      <Text style={[styles.primaryBadgeText, { color: colors.background }]}>{primaryCommunity.unvotedCount}</Text>
                    </View>
                  )}
                </View>
                {/* Participation bar */}
                <View style={[styles.participationTrack, { backgroundColor: `${colors.gold}15` }]}>
                  <View
                    style={[
                      styles.participationFill,
                      {
                        backgroundColor: colors.gold,
                        width: `${primaryCommunity.proposalCount > 0 ? ((primaryCommunity.proposalCount - primaryCommunity.unvotedCount) / primaryCommunity.proposalCount) * 100 : 0}%`,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Secondary (State/City chips) */}
            {secondaryCommunities.length > 0 && (
              <View style={styles.secondaryRow}>
                {secondaryCommunities.map((c, idx) => (
                  <JurisdictionChip key={c.id} community={c} onPress={navigateToProposals} index={idx} />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ═══ REQUIRING ATTENTION ═══ */}
        {urgentProposals.length > 0 && (
          <Animated.View entering={FadeInUp.delay(350).duration(500)} style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>REQUIRING YOUR VOTE</Text>
            {urgentProposals.map((p, idx) => (
              <AttentionCard
                key={p.id}
                proposal={p}
                onPress={() => router.push({ pathname: '/(tabs)/proposals', params: { proposalId: p.id } })}
                index={idx}
              />
            ))}
          </Animated.View>
        )}

        {/* ═══ YOUR IMPACT ═══ */}
        <Animated.View entering={FadeInUp.delay(450).duration(500)} style={styles.impactRow}>
          <TouchableOpacity
            style={[styles.impactPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/modals/voting-history')}
            activeOpacity={0.7}
          >
            <Text style={[styles.impactNumber, { color: colors.success }]}>{stats.voted}</Text>
            <Text style={[styles.impactLabel, { color: colors.textTertiary }]}>Voted</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.impactPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/modals/my-proposals')}
            activeOpacity={0.7}
          >
            <Text style={[styles.impactNumber, { color: colors.gold }]}>{stats.created}</Text>
            <Text style={[styles.impactLabel, { color: colors.textTertiary }]}>Created</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.impactPill, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={navigateToProposals}
            activeOpacity={0.7}
          >
            <Text style={[styles.impactNumber, { color: colors.info || '#60A5FA' }]}>{communities.length}</Text>
            <Text style={[styles.impactLabel, { color: colors.textTertiary }]}>Communities</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ═══ PRIMARY CTA ═══ */}
        {stats.pending > 0 && (
          <Animated.View entering={FadeInUp.delay(550).duration(500)} style={styles.ctaSection}>
            <TouchableOpacity
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.ctaButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={[styles.ctaText, { color: colors.background }]}>Cast Your Vote</Text>
                <View style={styles.ctaBadge}>
                  <Text style={[styles.ctaBadgeText, { color: colors.gold }]}>{stats.pending}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg },
  loadingContent: { flex: 1, paddingHorizontal: SPACING.lg },
  loadingCards: { marginTop: SPACING.xl },
  loadingList: { marginTop: SPACING.xl, gap: SPACING.md },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  headerLeft: {},
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  greeting: { ...TYPOGRAPHY.labelMedium },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  displayName: { ...TYPOGRAPHY.headlineMedium, fontWeight: '700' },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700' },

  // Accent line
  accentLine: {
    height: 2,
    width: 40,
    borderRadius: 1,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    opacity: 0.6,
  },

  // Voice Card
  voiceCard: {
    borderRadius: 20,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  voiceCardBorder: {
    borderWidth: 1,
    borderRadius: 20,
    padding: SPACING.xl,
  },
  voiceContent: { alignItems: 'center' },
  voiceCount: { fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 72 },
  voiceLabel: { ...TYPOGRAPHY.bodyLarge, marginTop: -SPACING.xs },
  voiceHeadline: { ...TYPOGRAPHY.headlineMedium, fontWeight: '700', marginTop: SPACING.md },
  voiceSubtext: { ...TYPOGRAPHY.bodyMedium, textAlign: 'center', marginTop: SPACING.xs },
  voiceStats: { flexDirection: 'row', alignItems: 'baseline', gap: SPACING.xs, marginTop: SPACING.lg },
  voiceStatNumber: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  voiceStatLabel: { ...TYPOGRAPHY.bodyMedium },
  caughtUpIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  pendingText: { ...TYPOGRAPHY.labelMedium, fontWeight: '600' },

  // Section
  section: { marginBottom: SPACING.xl },
  sectionLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },

  // Primary Jurisdiction
  primaryJurisdiction: {
    borderRadius: 16,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  jurisdictionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryFlag: { fontSize: 32, marginRight: SPACING.md },
  primaryInfo: { flex: 1 },
  primaryName: { ...TYPOGRAPHY.headlineSmall, fontWeight: '700' },
  primaryMeta: { ...TYPOGRAPHY.labelSmall, marginTop: 2 },
  primaryBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  primaryBadgeText: { fontSize: 13, fontWeight: '700' },
  participationTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  participationFill: { height: '100%', borderRadius: 2 },

  // Secondary jurisdictions
  secondaryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  jurisdictionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 12,
    gap: SPACING.xs,
  },
  jurisdictionIcon: { fontSize: 18 },
  jurisdictionName: { ...TYPOGRAPHY.labelMedium, fontWeight: '600', flex: 1 },
  jurisdictionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  jurisdictionBadgeText: { fontSize: 11, fontWeight: '700', color: '#000' },

  // Attention Card
  attentionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 12,
    borderLeftWidth: 3,
    marginBottom: SPACING.sm,
  },
  attentionContent: { flex: 1 },
  attentionTitle: { ...TYPOGRAPHY.bodyMedium, fontWeight: '600' },
  attentionMeta: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, gap: SPACING.sm },
  categoryTag: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: { ...TYPOGRAPHY.labelSmall, fontWeight: '600' },
  attentionTime: { ...TYPOGRAPHY.labelSmall },

  // Impact Row
  impactRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  impactPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  impactNumber: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  impactLabel: { ...TYPOGRAPHY.labelSmall, marginTop: 2 },

  // CTA
  ctaSection: { marginTop: SPACING.sm },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md + 2,
    borderRadius: 14,
    gap: SPACING.sm,
  },
  ctaText: { ...TYPOGRAPHY.headlineSmall, fontWeight: '700' },
  ctaBadge: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ctaBadgeText: { fontSize: 13, fontWeight: '700' },
});
