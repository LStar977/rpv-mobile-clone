import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  useAnimatedProps,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi } from '../../lib/api';
import { BallotDisplay } from '../../components/ui';
import { SkeletonStats, SkeletonListItem, SkeletonWelcome } from '../../components/ui/Skeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Gamification colors
const GAME_COLORS = {
  streak: '#FF9500',
  streakGlow: '#FFD60A',
  xp: '#AF52DE',
  xpGlow: '#BF5AF2',
  goal: '#34C759',
  goalGlow: '#30D158',
  badge: '#007AFF',
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

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

type Achievement = {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
};

// --- Animated Progress Ring ---
function GoalRing({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
}: {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withDelay(300, withSpring(progress, { damping: 15, stiffness: 80 }));
  }, [progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

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
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

// --- Streak Fire Component ---
function StreakFire({ streak, isActive }: { streak: number; isActive: boolean }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
    }
  }, [isActive]);

  const fireStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 1 + glow.value * 0.2 }],
  }));

  return (
    <View style={styles.streakFireContainer}>
      {isActive && (
        <Animated.View style={[styles.streakGlow, glowStyle, { backgroundColor: GAME_COLORS.streakGlow }]} />
      )}
      <Animated.View style={fireStyle}>
        <Text style={styles.fireEmoji}>{isActive ? '🔥' : '❄️'}</Text>
      </Animated.View>
      <Text style={[styles.streakCount, { color: isActive ? GAME_COLORS.streak : colors.textTertiary }]}>
        {streak}
      </Text>
      <Text style={[styles.streakLabel, { color: colors.textTertiary }]}>
        {streak === 1 ? 'day' : 'days'}
      </Text>
    </View>
  );
}

// --- XP Progress Bar ---
function XPBar({ currentXP, levelXP, level }: { currentXP: number; levelXP: number; level: number }) {
  const { colors, isDark } = useTheme();
  const progress = currentXP / levelXP;
  const animatedWidth = useSharedValue(0);

  useEffect(() => {
    animatedWidth.value = withDelay(400, withSpring(progress, { damping: 15 }));
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value * 100}%`,
  }));

  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpHeader}>
        <View style={styles.xpLevelBadge}>
          <LinearGradient
            colors={[GAME_COLORS.xp, GAME_COLORS.xpGlow]}
            style={styles.xpLevelGradient}
          >
            <Text style={styles.xpLevelText}>{level}</Text>
          </LinearGradient>
        </View>
        <Text style={[styles.xpText, { color: colors.textSecondary }]}>
          <Text style={{ color: GAME_COLORS.xp, fontWeight: '700' }}>{currentXP}</Text> / {levelXP} XP
        </Text>
      </View>
      <View style={[styles.xpTrack, { backgroundColor: isDark ? 'rgba(175,82,222,0.2)' : 'rgba(175,82,222,0.15)' }]}>
        <Animated.View style={[styles.xpFill, barStyle]}>
          <LinearGradient
            colors={[GAME_COLORS.xp, GAME_COLORS.xpGlow]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// --- Achievement Badge ---
function AchievementBadge({ achievement, index }: { achievement: Achievement; index: number }) {
  const { colors, isDark } = useTheme();
  const tierColor = {
    bronze: GAME_COLORS.bronze,
    silver: GAME_COLORS.silver,
    gold: GAME_COLORS.gold,
    platinum: GAME_COLORS.platinum,
  }[achievement.tier];

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(500 + index * 100).duration(400).springify()}
      style={[
        styles.achievementBadge,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          borderColor: achievement.unlocked ? tierColor : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
          opacity: achievement.unlocked ? 1 : 0.5,
        }
      ]}
      activeOpacity={0.7}
    >
      <Text style={[styles.achievementIcon, { opacity: achievement.unlocked ? 1 : 0.4 }]}>
        {achievement.icon}
      </Text>
      <Text style={[styles.achievementTitle, { color: achievement.unlocked ? colors.text : colors.textTertiary }]} numberOfLines={1}>
        {achievement.title}
      </Text>
      {achievement.unlocked && (
        <View style={[styles.achievementCheck, { backgroundColor: tierColor }]}>
          <Ionicons name="checkmark" size={10} color="#FFF" />
        </View>
      )}
    </AnimatedTouchable>
  );
}

// --- Quest Card ---
function QuestCard({
  title,
  description,
  progress,
  total,
  xpReward,
  icon,
  color,
  onPress,
  index,
}: {
  title: string;
  description: string;
  progress: number;
  total: number;
  xpReward: number;
  icon: string;
  color: string;
  onPress: () => void;
  index: number;
}) {
  const { colors, isDark } = useTheme();
  const isComplete = progress >= total;
  const pct = Math.min(progress / total, 1);

  return (
    <AnimatedTouchable
      entering={FadeInRight.delay(300 + index * 80).duration(400)}
      style={[
        styles.questCard,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surface,
          borderColor: isComplete ? GAME_COLORS.goal : (isDark ? 'rgba(255,255,255,0.08)' : colors.border),
        }
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {isComplete && (
        <LinearGradient
          colors={[`${GAME_COLORS.goal}15`, 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[styles.questIconWrap, { backgroundColor: `${color}20` }]}>
        <Text style={styles.questIcon}>{icon}</Text>
      </View>
      <View style={styles.questContent}>
        <Text style={[styles.questTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.questDesc, { color: colors.textTertiary }]} numberOfLines={1}>{description}</Text>
        <View style={styles.questProgressRow}>
          <View style={[styles.questTrack, { backgroundColor: `${color}20` }]}>
            <View style={[styles.questFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
          </View>
          <Text style={[styles.questProgressText, { color: colors.textSecondary }]}>
            {progress}/{total}
          </Text>
        </View>
      </View>
      <View style={[styles.questXP, { backgroundColor: `${GAME_COLORS.xp}15` }]}>
        <Text style={[styles.questXPText, { color: GAME_COLORS.xp }]}>+{xpReward}</Text>
        <Text style={[styles.questXPLabel, { color: GAME_COLORS.xp }]}>XP</Text>
      </View>
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

  // Gamification state (would come from backend in production)
  const [gameStats, setGameStats] = useState({
    streak: 7,
    streakActive: true,
    dailyGoal: 3,
    dailyProgress: 2,
    xp: 1250,
    level: 12,
    levelXP: 2000,
  });

  const achievements: Achievement[] = useMemo(() => [
    { id: '1', icon: '🗳️', title: 'First Vote', description: 'Cast your first vote', unlocked: true, tier: 'bronze' },
    { id: '2', icon: '🔥', title: 'Week Warrior', description: '7 day streak', unlocked: true, tier: 'silver' },
    { id: '3', icon: '💡', title: 'Idea Maker', description: 'Create a proposal', unlocked: stats.created > 0, tier: 'bronze' },
    { id: '4', icon: '🏆', title: 'Century Club', description: '100 votes cast', unlocked: stats.voted >= 100, tier: 'gold' },
    { id: '5', icon: '⚡', title: 'Speed Voter', description: 'Vote within 1 hour', unlocked: false, tier: 'silver' },
    { id: '6', icon: '🌟', title: 'Influencer', description: '10 proposals pass', unlocked: false, tier: 'platinum' },
  ], [stats]);

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

      // Update game stats based on real data
      setGameStats(prev => ({
        ...prev,
        dailyProgress: Math.min(votedIds.size % 3, 3), // Simulated daily progress
      }));
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

  const displayName = user?.name ? user.name.split(' ')[0] : 'Voter';

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

  const dailyGoalProgress = gameStats.dailyProgress / gameStats.dailyGoal;
  const dailyGoalComplete = gameStats.dailyProgress >= gameStats.dailyGoal;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GAME_COLORS.xp} />}
      >
        {/* ═══ Header ═══ */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.text }]}>Hey, {displayName}!</Text>
            <View style={styles.levelRow}>
              <LinearGradient colors={[GAME_COLORS.xp, GAME_COLORS.xpGlow]} style={styles.levelPill}>
                <Text style={styles.levelPillText}>Lvl {gameStats.level}</Text>
              </LinearGradient>
              {isVerified && (
                <View style={[styles.verifiedPill, { backgroundColor: GAME_COLORS.goal }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#FFF" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <BallotDisplay size="sm" />
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.8}>
              <LinearGradient colors={[GAME_COLORS.xp, GAME_COLORS.xpGlow]} style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ═══ Stats Bar: Streak + Daily Goal ═══ */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} style={styles.statsBar}>
          {/* Streak */}
          <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(255,149,0,0.1)' : 'rgba(255,149,0,0.08)' }]}>
            <StreakFire streak={gameStats.streak} isActive={gameStats.streakActive} />
          </View>

          {/* Daily Goal Ring */}
          <View style={[styles.statBox, styles.goalBox, { backgroundColor: isDark ? 'rgba(52,199,89,0.1)' : 'rgba(52,199,89,0.08)' }]}>
            <View style={styles.goalRingWrap}>
              <GoalRing
                size={70}
                strokeWidth={6}
                progress={dailyGoalProgress}
                color={GAME_COLORS.goal}
                trackColor={isDark ? 'rgba(52,199,89,0.2)' : 'rgba(52,199,89,0.15)'}
              />
              <View style={styles.goalRingInner}>
                {dailyGoalComplete ? (
                  <Ionicons name="checkmark" size={24} color={GAME_COLORS.goal} />
                ) : (
                  <Text style={[styles.goalRingText, { color: colors.text }]}>
                    {gameStats.dailyProgress}/{gameStats.dailyGoal}
                  </Text>
                )}
              </View>
            </View>
            <Text style={[styles.goalLabel, { color: colors.textSecondary }]}>
              {dailyGoalComplete ? 'Goal complete!' : 'Daily Goal'}
            </Text>
          </View>

          {/* Total Votes */}
          <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(0,122,255,0.1)' : 'rgba(0,122,255,0.08)' }]}>
            <Text style={[styles.statNumber, { color: GAME_COLORS.badge }]}>{stats.voted}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Votes</Text>
          </View>
        </Animated.View>

        {/* ═══ XP Progress ═══ */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <XPBar currentXP={gameStats.xp} levelXP={gameStats.levelXP} level={gameStats.level} />
        </Animated.View>

        {/* ═══ Daily Quests ═══ */}
        <Animated.View entering={FadeInUp.delay(250).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Quests</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>+XP</Text>
            </View>
          </View>

          <QuestCard
            title="Cast 3 Votes"
            description="Vote on any 3 proposals today"
            progress={gameStats.dailyProgress}
            total={3}
            xpReward={50}
            icon="🗳️"
            color={GAME_COLORS.goal}
            onPress={navigateToProposals}
            index={0}
          />

          {urgentProposals.length > 0 && (
            <QuestCard
              title="Beat the Clock"
              description={`Vote on "${urgentProposals[0].title.slice(0, 25)}..."`}
              progress={0}
              total={1}
              xpReward={25}
              icon="⏰"
              color={GAME_COLORS.streak}
              onPress={() => router.push({ pathname: '/(tabs)/proposals', params: { proposalId: urgentProposals[0].id } })}
              index={1}
            />
          )}

          <QuestCard
            title="Community Explorer"
            description="View all proposals in your country"
            progress={1}
            total={1}
            xpReward={15}
            icon="🌍"
            color={GAME_COLORS.badge}
            onPress={navigateToProposals}
            index={2}
          />
        </Animated.View>

        {/* ═══ Achievements ═══ */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: GAME_COLORS.xp }]}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsScroll}
          >
            {achievements.map((achievement, idx) => (
              <AchievementBadge key={achievement.id} achievement={achievement} index={idx} />
            ))}
          </ScrollView>
        </Animated.View>

        {/* ═══ Vote CTA ═══ */}
        {stats.pending > 0 && (
          <Animated.View entering={FadeInUp.delay(500).duration(500)} style={styles.ctaSection}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigateToProposals(); }}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[GAME_COLORS.goal, GAME_COLORS.goalGlow]}
                style={styles.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaText}>Start Voting</Text>
                <View style={styles.ctaBadge}>
                  <Text style={styles.ctaBadgeText}>{stats.pending} pending</Text>
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
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerLeft: {},
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  greeting: { ...TYPOGRAPHY.headlineMedium, fontWeight: '800' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 4 },
  levelPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 10,
  },
  levelPillText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: 10,
  },
  verifiedText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 16,
  },
  goalBox: { flex: 1.3 },
  statNumber: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statLabel: { ...TYPOGRAPHY.labelSmall, marginTop: 2 },

  // Streak Fire
  streakFireContainer: { alignItems: 'center' },
  streakGlow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    top: -5,
  },
  fireEmoji: { fontSize: 32 },
  streakCount: { fontSize: 20, fontWeight: '800', marginTop: -4 },
  streakLabel: { ...TYPOGRAPHY.labelSmall },

  // Goal Ring
  goalRingWrap: { alignItems: 'center', justifyContent: 'center' },
  goalRingInner: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  goalRingText: { fontSize: 14, fontWeight: '700' },
  goalLabel: { ...TYPOGRAPHY.labelSmall, marginTop: SPACING.xs },

  // XP Bar
  xpContainer: { marginBottom: SPACING.lg },
  xpHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  xpLevelBadge: { marginRight: SPACING.sm },
  xpLevelGradient: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpLevelText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  xpText: { ...TYPOGRAPHY.bodySmall },
  xpTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 5 },

  // Section
  section: { marginBottom: SPACING.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: { ...TYPOGRAPHY.headlineSmall, fontWeight: '700' },
  sectionBadge: {
    backgroundColor: GAME_COLORS.xp,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sectionBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  seeAll: { ...TYPOGRAPHY.labelMedium, fontWeight: '600' },

  // Quest Card
  questCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  questIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  questIcon: { fontSize: 22 },
  questContent: { flex: 1 },
  questTitle: { ...TYPOGRAPHY.bodyMedium, fontWeight: '700' },
  questDesc: { ...TYPOGRAPHY.labelSmall, marginTop: 1 },
  questProgressRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, gap: SPACING.xs },
  questTrack: { flex: 1, height: 6, borderRadius: 3 },
  questFill: { height: '100%', borderRadius: 3 },
  questProgressText: { ...TYPOGRAPHY.labelSmall, fontWeight: '600', minWidth: 28 },
  questXP: {
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 10,
    marginLeft: SPACING.sm,
  },
  questXPText: { fontSize: 14, fontWeight: '800' },
  questXPLabel: { fontSize: 9, fontWeight: '600' },

  // Achievements
  achievementsScroll: { paddingRight: SPACING.lg },
  achievementBadge: {
    width: 90,
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: 14,
    borderWidth: 2,
    marginRight: SPACING.sm,
  },
  achievementIcon: { fontSize: 32, marginBottom: 4 },
  achievementTitle: { ...TYPOGRAPHY.labelSmall, fontWeight: '600', textAlign: 'center' },
  achievementCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA
  ctaSection: { marginTop: SPACING.sm },
  ctaButton: { borderRadius: 16, overflow: 'hidden' },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md + 4,
    gap: SPACING.sm,
  },
  ctaText: { color: '#FFF', ...TYPOGRAPHY.headlineSmall, fontWeight: '700' },
  ctaBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 10,
  },
  ctaBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
