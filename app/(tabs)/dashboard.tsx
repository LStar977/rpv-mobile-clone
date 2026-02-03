import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
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
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi } from '../../lib/api';
import { Button, Badge, SectionHeader } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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

// ═══════════════════════════════════════════════════════════════════════════════
// IMPACT HERO - Animated participation display (no SVG required)
// ═══════════════════════════════════════════════════════════════════════════════
function ImpactHero({
  votesCount,
  pendingCount,
  totalReach,
  onPress,
}: {
  votesCount: number;
  pendingCount: number;
  totalReach: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const pulseScale = useSharedValue(1);
  const progressWidth = useSharedValue(0);

  // Calculate progress (votes out of votes + pending)
  const total = votesCount + pendingCount;
  const progress = total > 0 ? votesCount / total : 0;
  const progressPercent = Math.round(progress * 100);

  useEffect(() => {
    // Animate progress bar
    progressWidth.value = withDelay(
      300,
      withTiming(progress, { duration: 1200, easing: Easing.bezierFn(0.4, 0, 0.2, 1) })
    );

    // Pulse animation for the vote count
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2000 }),
        withTiming(1, { duration: 2000 })
      ),
      -1,
      true
    );
  }, [progress, votesCount]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as any,
  }));

  return (
    <AnimatedTouchable
      entering={FadeInDown.duration(600).springify()}
      activeOpacity={0.95}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.impactHero, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {/* Background gradient */}
      <LinearGradient
        colors={[`${colors.gold}08`, 'transparent', `${colors.gold}04`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.impactContent}>
        {/* Left side - Big Vote Count */}
        <Animated.View style={[styles.voteCountContainer, animatedPulseStyle]}>
          <LinearGradient
            colors={[colors.gold, colors.goldDark || colors.gold]}
            style={styles.voteCountGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.voteCountValue}>{votesCount}</Text>
            <Text style={styles.voteCountLabel}>votes cast</Text>
          </LinearGradient>
        </Animated.View>

        {/* Right side - Stats */}
        <View style={styles.impactStats}>
          <Text style={[styles.impactTitle, { color: colors.text }]}>Your Impact</Text>

          <View style={styles.impactMetric}>
            <View style={[styles.metricIcon, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            </View>
            <View>
              <Text style={[styles.metricValue, { color: colors.text }]}>{progressPercent}%</Text>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>participation</Text>
            </View>
          </View>

          <View style={styles.impactMetric}>
            <View style={[styles.metricIcon, { backgroundColor: `${colors.warning}15` }]}>
              <Ionicons name="hourglass-outline" size={16} color={colors.warning} />
            </View>
            <View>
              <Text style={[styles.metricValue, { color: colors.text }]}>{pendingCount}</Text>
              <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>pending votes</Text>
            </View>
          </View>

          {totalReach > 0 && (
            <View style={styles.reachBadge}>
              <Ionicons name="people" size={12} color={colors.gold} />
              <Text style={[styles.reachText, { color: colors.gold }]}>
                Reached {totalReach.toLocaleString()} citizens
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            { backgroundColor: colors.gold },
            animatedProgressStyle,
          ]}
        />
      </View>

      {/* Bottom action hint */}
      <View style={[styles.impactFooter, { borderTopColor: colors.border }]}>
        <Text style={[styles.impactFooterText, { color: colors.textTertiary }]}>
          Tap to see your full civic profile
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </View>
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE PULSE - Social proof indicator
// ═══════════════════════════════════════════════════════════════════════════════
function LivePulse({ count }: { count: number }) {
  const { colors } = useTheme();
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const animatedDotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  if (count <= 0) return null;

  return (
    <Animated.View
      entering={FadeIn.delay(800).duration(400)}
      style={[styles.livePulse, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Animated.View style={[styles.liveDot, { backgroundColor: colors.success }, animatedDotStyle]} />
      <Text style={[styles.liveText, { color: colors.textSecondary }]}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{count}</Text> citizens voting now
      </Text>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUICK ACTION CARD - Primary CTA based on user state
// ═══════════════════════════════════════════════════════════════════════════════
function QuickActionCard({
  isVerified,
  urgentCount,
  pendingCount,
  onVerify,
  onVote,
}: {
  isVerified: boolean;
  urgentCount: number;
  pendingCount: number;
  onVerify: () => void;
  onVote: () => void;
}) {
  const { colors } = useTheme();

  // Determine the primary action
  const needsVerification = !isVerified;
  const hasUrgent = urgentCount > 0;

  const config = needsVerification
    ? {
        icon: 'shield-checkmark',
        title: 'Verify Your Identity',
        subtitle: 'Complete verification to start voting on proposals',
        cta: 'Start Verification',
        color: colors.warning,
        onPress: onVerify,
      }
    : hasUrgent
    ? {
        icon: 'flame',
        title: `${urgentCount} Urgent Vote${urgentCount > 1 ? 's' : ''}`,
        subtitle: 'Proposals closing within 48 hours need your attention',
        cta: 'Vote Now',
        color: colors.error,
        onPress: onVote,
      }
    : pendingCount > 0
    ? {
        icon: 'document-text',
        title: `${pendingCount} Pending Proposal${pendingCount > 1 ? 's' : ''}`,
        subtitle: 'New proposals are waiting for your vote',
        cta: 'Review & Vote',
        color: colors.gold,
        onPress: onVote,
      }
    : {
        icon: 'compass',
        title: 'All Caught Up!',
        subtitle: "You've voted on all available proposals",
        cta: 'Explore',
        color: colors.success,
        onPress: onVote,
      };

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(200).duration(500).springify()}
      activeOpacity={0.9}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        config.onPress();
      }}
      style={[styles.quickAction, { backgroundColor: `${config.color}10`, borderColor: `${config.color}30` }]}
    >
      <View style={styles.quickActionContent}>
        <View style={[styles.quickActionIcon, { backgroundColor: config.color }]}>
          <Ionicons name={config.icon as any} size={24} color="#FFFFFF" />
        </View>
        <View style={styles.quickActionText}>
          <Text style={[styles.quickActionTitle, { color: colors.text }]}>{config.title}</Text>
          <Text style={[styles.quickActionSubtitle, { color: colors.textSecondary }]}>
            {config.subtitle}
          </Text>
        </View>
      </View>
      <View style={[styles.quickActionCta, { backgroundColor: config.color }]}>
        <Text style={styles.quickActionCtaText}>{config.cta}</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </View>
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY CHIP - Compact community indicator
// ═══════════════════════════════════════════════════════════════════════════════
function CommunityChip({
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
      entering={FadeInRight.delay(index * 60).duration(300)}
      style={[styles.communityChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.75}
    >
      <Text style={styles.communityIcon}>{community.icon}</Text>
      <View style={styles.communityChipContent}>
        <Text style={[styles.communityChipName, { color: colors.text }]} numberOfLines={1}>
          {community.name}
        </Text>
        <Text style={[styles.communityChipMeta, { color: colors.textTertiary }]}>
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
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// URGENT PROPOSAL ROW - Compact urgent indicator
// ═══════════════════════════════════════════════════════════════════════════════
function UrgentProposalRow({
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
      style={[styles.urgentRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.75}
    >
      <View style={[styles.urgentAccent, { backgroundColor: urgencyColor }]} />
      <View style={styles.urgentContent}>
        <Text style={[styles.urgentTitle, { color: colors.text }]} numberOfLines={1}>
          {proposal.title}
        </Text>
        <View style={styles.urgentMeta}>
          <Badge label={proposal.category} variant="default" size="sm" />
          <View style={[styles.urgentTime, { backgroundColor: `${urgencyColor}15` }]}>
            <Ionicons name="time-outline" size={12} color={urgencyColor} />
            <Text style={[styles.urgentTimeText, { color: urgencyColor }]}>{proposal.hoursLeft}h</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ pending: 0, voted: 0, passed: 0 });
  const [communities, setCommunities] = useState<Community[]>([]);
  const [urgentProposals, setUrgentProposals] = useState<UrgentProposal[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [liveVoters, setLiveVoters] = useState(0);

  const fetchDashboardData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        proposalsApi.getAll(),
        isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [] }),
        isAuthenticated ? userApi.getVerificationStatus() : Promise.resolve({ data: { verified: false } }),
        isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null }),
      ]);

      const proposalsRes = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
      const votedRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
      const verificationRes = results[2].status === 'fulfilled' ? results[2].value : { data: { verified: false } };
      const profileRes = results[3].status === 'fulfilled' ? results[3].value : { data: null };

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
        Canada: '🇨🇦', 'United States': '🇺🇸', 'United Kingdom': '🇬🇧',
        Australia: '🇦🇺', Germany: '🇩🇪', France: '🇫🇷',
        Japan: '🇯🇵', India: '🇮🇳', Brazil: '🇧🇷',
        Mexico: '🇲🇽', Spain: '🇪🇸', Italy: '🇮🇹',
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
            geoRestrictions[0] === userCountry && geoRestrictions[1] === userState && geoRestrictions[2] === userCity) {
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

      // Simulate live voters (in production, this would come from backend)
      setLiveVoters(Math.floor(Math.random() * 200) + 50);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const navigateToProposals = () => router.push('/(tabs)/proposals');
  const navigateToProfile = () => router.push('/(tabs)/profile');
  const navigateToVerify = () => router.push('/(tabs)/identity');

  // Get greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = user?.name ? user.name.split(' ')[0] : 'there';

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
          </View>
        </View>
      </View>
    );
  }

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
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textTertiary }]}>{getGreeting()}</Text>
            <Text style={[styles.name, { color: colors.text }]}>{displayName}</Text>
          </View>
          <TouchableOpacity
            onPress={navigateToProfile}
            style={[styles.avatarButton, { backgroundColor: colors.gold }]}
          >
            <Text style={[styles.avatarText, { color: colors.background }]}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
            {isVerified && (
              <View style={[styles.verifiedDot, { backgroundColor: colors.success, borderColor: colors.background }]}>
                <Ionicons name="checkmark" size={8} color="#FFF" />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Live Pulse */}
        <LivePulse count={liveVoters} />

        {/* Impact Hero */}
        <ImpactHero
          votesCount={stats.voted}
          pendingCount={stats.pending}
          totalReach={stats.voted * 12} // Simulated reach
          onPress={navigateToProfile}
        />

        {/* Quick Action */}
        <QuickActionCard
          isVerified={isVerified}
          urgentCount={urgentProposals.length}
          pendingCount={stats.pending}
          onVerify={navigateToVerify}
          onVote={navigateToProposals}
        />

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
              <UrgentProposalRow
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
            <View style={styles.communitiesGrid}>
              {communities.map((community, idx) => (
                <CommunityChip
                  key={community.id}
                  community={community}
                  index={idx}
                  onPress={navigateToProposals}
                />
              ))}
            </View>
          </View>
        )}

        {/* Bottom CTA */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.ctaSection}>
          <Button
            title="Explore All Proposals"
            onPress={navigateToProposals}
            variant="outline"
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
    paddingHorizontal: SPACING.lg,
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  greeting: {
    ...TYPOGRAPHY.labelMedium,
    letterSpacing: 0.3,
  },
  name: {
    ...TYPOGRAPHY.displaySmall,
    marginTop: 2,
  },
  avatarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },

  // Live Pulse
  livePulse: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    ...TYPOGRAPHY.labelSmall,
  },

  // Impact Hero
  impactHero: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  impactContent: {
    flexDirection: 'row',
    padding: SPACING.xl,
    gap: SPACING.xl,
  },
  voteCountContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCountGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#000',
    letterSpacing: -1,
  },
  voteCountLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
    opacity: 0.7,
    marginTop: 2,
  },
  progressBarContainer: {
    height: 4,
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.md,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  impactStats: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.md,
  },
  impactTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.xs,
  },
  impactMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  metricLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  reachBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  reachText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '500',
  },
  impactFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    gap: SPACING.xs,
  },
  impactFooterText: {
    ...TYPOGRAPHY.labelSmall,
  },

  // Quick Action
  quickAction: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  quickActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    flex: 1,
  },
  quickActionTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  quickActionSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  quickActionCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  quickActionCtaText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Sections
  section: {
    marginBottom: SPACING.xl,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },

  // Community Chips
  communitiesGrid: {
    gap: SPACING.sm,
  },
  communityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  communityIcon: {
    fontSize: 24,
  },
  communityChipContent: {
    flex: 1,
  },
  communityChipName: {
    ...TYPOGRAPHY.labelLarge,
  },
  communityChipMeta: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 1,
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

  // Urgent Row
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  urgentAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  urgentContent: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  urgentTitle: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.xs,
  },
  urgentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  urgentTime: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  urgentTimeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },

  // CTA Section
  ctaSection: {
    marginTop: SPACING.md,
  },

  bottomSpacer: {
    height: 120,
  },
});
