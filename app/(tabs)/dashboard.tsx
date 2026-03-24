import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi } from '../../lib/api';
import { BallotDisplay } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
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

// --- Glass Card Component ---
function GlassCard({
  children,
  style,
  intensity = 40,
  entering,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  entering?: any;
}) {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View entering={entering} style={[styles.glassCardOuter, style]}>
      <BlurView
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        style={styles.glassCardBlur}
      >
        <View style={[
          styles.glassCardInner,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)',
          }
        ]}>
          {children}
        </View>
      </BlurView>
    </Animated.View>
  );
}

// --- Stat Pill Component ---
function StatPill({
  value,
  label,
  color,
  onPress,
  delay = 0,
}: {
  value: number;
  label: string;
  color: string;
  onPress?: () => void;
  delay?: number;
}) {
  const { colors, isDark } = useTheme();

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(delay).duration(400)}
      style={[
        styles.statPill,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={[styles.statPillLabel, { color: colors.textTertiary }]}>{label}</Text>
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
  const [allProposals, setAllProposals] = useState<any[]>([]);

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
  const displayName = user?.name ? user.name.split(' ')[0] : 'there';
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
      {/* Background Gradient */}
      <LinearGradient
        colors={isDark
          ? [`${colors.gold}08`, colors.background, `${colors.accent || '#8B5CF6'}05`, colors.background]
          : [`${colors.gold}15`, colors.background, `${colors.accent || '#8B5CF6'}08`, colors.background]
        }
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating orbs for depth */}
      <View style={[styles.orb, styles.orbTopRight, { backgroundColor: `${colors.gold}12` }]} />
      <View style={[styles.orb, styles.orbBottomLeft, { backgroundColor: `${colors.accent || '#8B5CF6'}10` }]} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* ═══ Header ═══ */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.textTertiary }]}>{getGreeting()}</Text>
            <View style={styles.nameRow}>
              <Text style={[styles.displayName, { color: colors.text }]}>{displayName}</Text>
              {isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark" size={10} color="#FFF" />
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <BallotDisplay size="sm" />
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
              <LinearGradient colors={[colors.gold, colors.goldDark || '#A68523']} style={styles.avatar}>
                <Text style={[styles.avatarText, { color: colors.background }]}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ═══ Hero Status Card ═══ */}
        <GlassCard entering={FadeInUp.delay(100).duration(500)} style={styles.heroCard}>
          <View style={styles.heroContent}>
            {stats.pending === 0 ? (
              <View style={styles.heroCaughtUp}>
                <View style={[styles.heroCaughtUpIcon, { backgroundColor: `${colors.success}15` }]}>
                  <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                </View>
                <Text style={[styles.heroCaughtUpText, { color: colors.success }]}>All caught up!</Text>
                <Text style={[styles.heroCaughtUpSub, { color: colors.textTertiary }]}>
                  You've voted on all available proposals
                </Text>
              </View>
            ) : (
              <View style={styles.heroPending}>
                <Text style={[styles.heroPendingNumber, { color: colors.text }]}>{stats.pending}</Text>
                <Text style={[styles.heroPendingLabel, { color: colors.textSecondary }]}>proposals awaiting your vote</Text>
                <TouchableOpacity
                  style={[styles.heroCtaButton, { backgroundColor: colors.gold }]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.heroCtaText}>Vote Now</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </GlassCard>

        {/* ═══ Stats Row ═══ */}
        <View style={styles.statsRow}>
          <StatPill value={stats.pending} label="Pending" color={colors.warning} onPress={navigateToProposals} delay={200} />
          <StatPill value={stats.voted} label="Voted" color={colors.success} onPress={() => router.push('/modals/voting-history')} delay={250} />
          <StatPill value={stats.created} label="Created" color={colors.gold} onPress={() => router.push('/modals/my-proposals')} delay={300} />
        </View>

        {/* ═══ Urgent Proposals ═══ */}
        {urgentProposals.length > 0 && (
          <GlassCard entering={FadeInUp.delay(350).duration(500)} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: `${colors.error}15` }]}>
                <Ionicons name="flame" size={20} color={colors.error} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Closing Soon</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
                  {urgentProposals.length} need your vote
                </Text>
              </View>
            </View>

            {urgentProposals.slice(0, 3).map((p, idx) => {
              const urgColor = p.hoursLeft <= 6 ? colors.error : p.hoursLeft <= 24 ? colors.warning : colors.gold;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.urgentItem,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
                    idx === Math.min(2, urgentProposals.length - 1) && { borderBottomWidth: 0 }
                  ]}
                  onPress={() => router.push({ pathname: '/(tabs)/proposals', params: { proposalId: p.id } })}
                  activeOpacity={0.7}
                >
                  <View style={styles.urgentItemLeft}>
                    <Text style={[styles.urgentTitle, { color: colors.text }]} numberOfLines={1}>{p.title}</Text>
                    <Text style={[styles.urgentCategory, { color: colors.textTertiary }]}>{p.category}</Text>
                  </View>
                  <View style={[styles.urgentTimeBadge, { backgroundColor: `${urgColor}15` }]}>
                    <Ionicons name="time-outline" size={12} color={urgColor} />
                    <Text style={[styles.urgentTimeText, { color: urgColor }]}>{p.hoursLeft}h</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </GlassCard>
        )}

        {/* ═══ Communities ═══ */}
        {communities.length > 0 && (
          <GlassCard entering={FadeInUp.delay(400).duration(500)} style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="globe-outline" size={20} color={colors.gold} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Communities</Text>
              </View>
            </View>

            <View style={styles.communitiesGrid}>
              {communities.map((c, idx) => (
                <AnimatedTouchable
                  key={c.id}
                  entering={FadeInRight.delay(450 + idx * 80).duration(350)}
                  style={[
                    styles.communityChip,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    }
                  ]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigateToProposals(); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.communityEmoji}>{c.icon}</Text>
                  <View style={styles.communityInfo}>
                    <Text style={[styles.communityName, { color: colors.text }]} numberOfLines={1}>{c.name}</Text>
                    <Text style={[styles.communityMeta, { color: colors.textTertiary }]}>
                      {c.proposalCount - c.unvotedCount}/{c.proposalCount} voted
                    </Text>
                  </View>
                  {c.unvotedCount > 0 && (
                    <View style={[styles.communityBadge, { backgroundColor: colors.gold }]}>
                      <Text style={styles.communityBadgeText}>{c.unvotedCount}</Text>
                    </View>
                  )}
                </AnimatedTouchable>
              ))}
            </View>
          </GlassCard>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg },

  // Loading
  loadingContent: { flex: 1, paddingHorizontal: SPACING.lg },
  loadingCards: { marginTop: SPACING.xl },
  loadingList: { marginTop: SPACING.xl, gap: SPACING.md },

  // Background orbs
  orb: {
    position: 'absolute',
    borderRadius: 999,
    ...Platform.select({ ios: { }, android: { opacity: 0.8 } }),
  },
  orbTopRight: { width: 300, height: 300, top: -100, right: -100 },
  orbBottomLeft: { width: 250, height: 250, bottom: 100, left: -80 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerLeft: {},
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  greeting: { ...TYPOGRAPHY.labelMedium },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  displayName: { ...TYPOGRAPHY.headlineMedium, fontWeight: '700' },
  verifiedBadge: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },

  // Glass Card
  glassCardOuter: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  glassCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  glassCardInner: {
    borderRadius: 24,
    borderWidth: 1,
    padding: SPACING.lg,
  },

  // Hero Card
  heroCard: { marginTop: SPACING.sm },
  heroContent: { alignItems: 'center', paddingVertical: SPACING.md },

  heroCaughtUp: { alignItems: 'center' },
  heroCaughtUpIcon: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroCaughtUpText: { ...TYPOGRAPHY.headlineMedium, fontWeight: '700' },
  heroCaughtUpSub: { ...TYPOGRAPHY.bodyMedium, marginTop: SPACING.xs, textAlign: 'center' },

  heroPending: { alignItems: 'center' },
  heroPendingNumber: { fontSize: 72, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 80 },
  heroPendingLabel: { ...TYPOGRAPHY.bodyLarge, marginTop: -SPACING.xs },
  heroCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 50,
    marginTop: SPACING.lg,
  },
  heroCtaText: { color: '#FFF', ...TYPOGRAPHY.labelLarge, fontWeight: '700' },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 16,
    borderWidth: 1,
  },
  statPillValue: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statPillLabel: { ...TYPOGRAPHY.labelSmall, marginTop: 2 },

  // Section Card
  sectionCard: {},
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  sectionTitleWrap: { flex: 1 },
  sectionTitle: { ...TYPOGRAPHY.headlineSmall, fontWeight: '700' },
  sectionSubtitle: { ...TYPOGRAPHY.labelSmall, marginTop: 1 },

  // Urgent Items
  urgentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  urgentItemLeft: { flex: 1, marginRight: SPACING.sm },
  urgentTitle: { ...TYPOGRAPHY.bodyMedium, fontWeight: '600' },
  urgentCategory: { ...TYPOGRAPHY.labelSmall, marginTop: 2 },
  urgentTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  urgentTimeText: { ...TYPOGRAPHY.labelSmall, fontWeight: '600' },

  // Communities
  communitiesGrid: { gap: SPACING.sm },
  communityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
  },
  communityEmoji: { fontSize: 28, marginRight: SPACING.sm },
  communityInfo: { flex: 1 },
  communityName: { ...TYPOGRAPHY.bodyMedium, fontWeight: '600' },
  communityMeta: { ...TYPOGRAPHY.labelSmall, marginTop: 1 },
  communityBadge: {
    minWidth: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8,
  },
  communityBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
