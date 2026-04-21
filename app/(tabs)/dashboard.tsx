import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
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
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi } from '../../lib/api';
import { BallotDisplay } from '../../components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ═══════════════════════════════════════════════════════════════════════════
// BRAND COLORS
// ═══════════════════════════════════════════════════════════════════════════
const BRAND = {
  black: '#040707',
  gold: '#EABA58',
  goldDark: '#C9A043',
  white: '#F4F5F6',
  steel: '#007BFF',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassLight: 'rgba(255,255,255,0.06)',
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER COUNTER
// ═══════════════════════════════════════════════════════════════════════════
function AnimatedNumber({ value, delay = 0 }: { value: number; delay?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animatedValue = useSharedValue(0);

  useEffect(() => {
    animatedValue.value = withDelay(
      delay,
      withTiming(value, { duration: 1200, easing: Easing.out(Easing.cubic) })
    );

    const interval = setInterval(() => {
      const current = Math.round(animatedValue.value);
      setDisplayValue(current);
      if (current >= value) clearInterval(interval);
    }, 16);

    return () => clearInterval(interval);
  }, [value, delay]);

  return (
    <Text style={styles.statNumber}>{displayValue}</Text>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROGRESS RING
// ═══════════════════════════════════════════════════════════════════════════
function ProgressRing({ progress, size = 52, strokeWidth = 2.5 }: { progress: number; size?: number; strokeWidth?: number }) {
  const animatedProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    animatedProgress.value = withDelay(400, withTiming(progress, { duration: 1000 }));
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const strokeDashoffset = circumference * (1 - animatedProgress.value);
    return {
      strokeDashoffset,
    };
  });

  return (
    <View style={{ width: size, height: size, position: 'absolute' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <View style={StyleSheet.absoluteFill}>
          {/* Background ring */}
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: 'rgba(234,186,88,0.15)',
            }}
          />
        </View>
        {/* Progress ring - simplified without SVG */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: BRAND.gold,
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
              transform: [{ rotate: `${progress * 360}deg` }],
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHIMMER BORDER EFFECT
// ═══════════════════════════════════════════════════════════════════════════
function ShimmerBorder({ children }: { children: React.ReactNode }) {
  const shimmerPosition = useSharedValue(0);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmerPosition.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]) }],
  }));

  return (
    <View style={styles.shimmerContainer}>
      {/* Base border */}
      <View style={styles.shimmerBorderBase} />
      {/* Shimmer overlay */}
      <View style={styles.shimmerOverflow}>
        <Animated.View style={[styles.shimmerBar, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', `${BRAND.gold}40`, BRAND.gold, `${BRAND.gold}40`, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      {/* Content */}
      <View style={styles.shimmerContent}>{children}</View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PREMIUM HEADER
// ═══════════════════════════════════════════════════════════════════════════
function PremiumHeader({
  name,
  isVerified,
  onAvatarPress,
  onNotificationPress,
}: {
  name: string;
  isVerified: boolean;
  onAvatarPress: () => void;
  onNotificationPress?: () => void;
}) {
  const letter = name.charAt(0).toUpperCase();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Animated.View entering={FadeInDown.duration(500).delay(0)} style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>Represent</Text>
          <View style={styles.goldUnderline} />
        </View>
      </View>

      <View style={styles.headerRight}>
        <BallotDisplay size="sm" />

        {onNotificationPress && (
          <TouchableOpacity onPress={onNotificationPress} style={styles.notificationBtn} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={22} color={BRAND.white} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
          <LinearGradient
            colors={[BRAND.gold, BRAND.goldDark]}
            style={styles.avatarRing}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.avatarInner}>
              <Text style={styles.avatarLetter}>{letter}</Text>
            </View>
          </LinearGradient>
          {isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURED PROPOSAL HERO
// ═══════════════════════════════════════════════════════════════════════════
function FeaturedProposalHero({
  title,
  institution,
  deadline,
  participants,
  totalPending,
  onVotePress,
  onSeeMorePress,
}: {
  title: string;
  institution: string;
  deadline: number; // epoch ms
  participants: number;
  totalPending: number;
  onVotePress: () => void;
  onSeeMorePress: () => void;
}) {
  const participationPercent = Math.min((participants / 20000) * 100, 100);
  const progressWidth = useSharedValue(0);

  // Live countdown — recompute every 30s
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(deadline - now, 0);
  const days = Math.floor(remainingMs / 86400000);
  const hours = Math.floor((remainingMs % 86400000) / 3600000);
  const minutes = Math.floor((remainingMs % 3600000) / 60000);
  const isUrgent = remainingMs > 0 && remainingMs < 3600000; // <1h
  const isEnded = remainingMs === 0;

  // Urgency pulse
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (isUrgent) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 700, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 700, easing: Easing.in(Easing.quad) })
        ),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isUrgent]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => {
    progressWidth.value = withDelay(600, withTiming(participationPercent, { duration: 1200 }));
  }, [participationPercent]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const urgencyColor = isUrgent ? '#FF4D4F' : BRAND.gold;

  return (
    <Animated.View entering={FadeInUp.duration(500).delay(100)}>
      <ShimmerBorder>
        <View style={styles.heroCard}>
          {/* Institution badge */}
          <View style={styles.institutionBadge}>
            <Ionicons name="business-outline" size={12} color={BRAND.gold} />
            <Text style={styles.institutionText}>{institution}</Text>
          </View>

          {/* Title */}
          <Text style={styles.heroTitle}>{title}</Text>

          {/* Countdown */}
          <Animated.View style={[styles.countdownRow, pulseStyle]}>
            <Ionicons
              name={isEnded ? 'lock-closed-outline' : 'time-outline'}
              size={16}
              color={urgencyColor}
            />
            <Text style={[styles.countdownText, isUrgent && { color: urgencyColor }]}>
              {isEnded ? (
                'Voting closed'
              ) : days >= 1 ? (
                <>
                  <Text style={[styles.countdownNumber, isUrgent && { color: urgencyColor }]}>{days}</Text>d{' '}
                  <Text style={[styles.countdownNumber, isUrgent && { color: urgencyColor }]}>{hours}</Text>h remaining
                </>
              ) : hours >= 1 ? (
                <>
                  <Text style={[styles.countdownNumber, isUrgent && { color: urgencyColor }]}>{hours}</Text>h{' '}
                  <Text style={[styles.countdownNumber, isUrgent && { color: urgencyColor }]}>{minutes}</Text>m remaining
                </>
              ) : (
                <>
                  <Text style={[styles.countdownNumber, { color: urgencyColor }]}>{minutes}</Text>m remaining
                </>
              )}
            </Text>
          </Animated.View>

          {/* Participation bar */}
          <View style={styles.participationSection}>
            <View style={styles.participationHeader}>
              <Text style={styles.participationLabel}>Participation</Text>
              <Text style={styles.participationCount}>
                {participants.toLocaleString()} <Text style={styles.participationUnit}>voices</Text>
              </Text>
            </View>
            <View style={styles.participationTrack}>
              <Animated.View style={[styles.participationFill, progressStyle]} />
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onVotePress();
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[BRAND.gold, BRAND.goldDark]}
              style={styles.voteButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.voteButtonText}>Vote Now</Text>
              <Ionicons name="arrow-forward" size={18} color={BRAND.black} />
            </LinearGradient>
          </TouchableOpacity>

          {/* See more link */}
          <TouchableOpacity onPress={onSeeMorePress} style={styles.seeMoreBtn}>
            <Text style={styles.seeMoreText}>{totalPending} more proposals waiting</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </ShimmerBorder>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPACT STAT CARD
// ═══════════════════════════════════════════════════════════════════════════
function ImpactStatCard({
  icon,
  value,
  label,
  progress,
  delay,
}: {
  icon: string;
  value: number;
  label: string;
  progress: number;
  delay: number;
}) {
  const scale = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 12 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.statCard, animatedStyle]}>
      {/* Icon with glow and progress ring */}
      <View style={styles.statIconWrapper}>
        <View style={styles.statIconGlow} />
        <ProgressRing progress={progress} size={52} />
        <View style={styles.statIconCircle}>
          <Ionicons name={icon as any} size={20} color={BRAND.gold} />
        </View>
      </View>

      {/* Number */}
      <AnimatedNumber value={value} delay={delay + 200} />

      {/* Label */}
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RECENT ACTIVITY FEED
// ═══════════════════════════════════════════════════════════════════════════
function ActivityFeed({ items }: { items: Array<{ icon: string; text: string; time: string }> }) {
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.activitySection}>
      <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
      <View style={styles.activityList}>
        {items.map((item, idx) => (
          <Animated.View
            key={idx}
            entering={FadeInRight.duration(400).delay(350 + idx * 80)}
            style={styles.activityItem}
          >
            <View style={styles.activityIcon}>
              <Ionicons name={item.icon as any} size={16} color={BRAND.gold} />
            </View>
            <Text style={styles.activityText} numberOfLines={1}>{item.text}</Text>
            <Text style={styles.activityTime}>{item.time}</Text>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITY CARD
// ═══════════════════════════════════════════════════════════════════════════
function CommunityCard({
  name,
  icon,
  proposalCount,
  activeCount,
  isPrimary,
  gradientColors,
  index,
  onPress,
}: {
  name: string;
  icon: string;
  proposalCount: number;
  activeCount: number;
  isPrimary?: boolean;
  gradientColors?: readonly [string, string];
  index: number;
  onPress: () => void;
}) {
  return (
    <AnimatedTouchable
      entering={FadeInRight.duration(400).delay(400 + index * 60)}
      style={[styles.communityCard, isPrimary && styles.communityCardPrimary]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.85}
    >
      {isPrimary && gradientColors && (
        <LinearGradient
          colors={gradientColors}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <View style={styles.communityContent}>
        <View style={styles.communityIconCircle}>
          <Text style={styles.communityEmoji}>{icon}</Text>
        </View>
        <View style={styles.communityInfo}>
          <Text style={[styles.communityName, isPrimary && styles.communityNamePrimary]}>{name}</Text>
          <Text style={styles.communityMeta}>{proposalCount} proposals</Text>
        </View>
        {activeCount > 0 && (
          <View style={styles.communityBadge}>
            <Text style={styles.communityBadgeText}>{activeCount}</Text>
          </View>
        )}
      </View>
    </AnimatedTouchable>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export default function DashboardScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { syncFromChain } = useBallotStore();

  const [refreshing, setRefreshing] = useState(false);

  const isVerified = user?.verified ?? true; // Demo: verified
  const displayName = user?.name?.split(' ')[0] || 'Lance';

  // Mock data as specified
  const featuredDeadline = useRef(Date.now() + 3 * 86400000 + 14 * 3600000).current;
  const mockData = {
    featured: {
      title: 'Downtown Arena District Plan',
      institution: 'City of Calgary',
      deadline: featuredDeadline,
      participants: 12847,
    },
    stats: {
      awaiting: 64,
      voted: 23,
      created: 2,
    },
    activity: [
      { icon: 'trending-up', text: 'Calgary Transit Proposal reached 10,000 votes', time: '2h ago' },
      { icon: 'document-text', text: 'New proposal in your ward', time: '5h ago' },
      { icon: 'checkmark-circle', text: 'Your vote on School Board Budget was recorded', time: '1d ago' },
    ],
    communities: [
      { name: 'Canada', icon: '🇨🇦', proposalCount: 29, activeCount: 7, isPrimary: true, scope: 'country' as const },
      { name: 'Alberta', icon: '🏔️', proposalCount: 12, activeCount: 4, scope: 'state' as const },
      { name: 'Calgary', icon: '🌆', proposalCount: 8, activeCount: 3, scope: 'city' as const },
    ],
  };

  useEffect(() => {
    if (user?.walletAddress) {
      syncFromChain(user.walletAddress);
    }
  }, [user?.walletAddress, syncFromChain]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const navigateToProposals = () => router.push('/(tabs)/proposals');

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND.gold} />
        }
      >
        {/* Header */}
        <PremiumHeader
          name={displayName}
          isVerified={isVerified}
          onAvatarPress={() => router.push('/(tabs)/profile')}
          onNotificationPress={() => {}}
        />

        {/* Featured Proposal Hero */}
        <FeaturedProposalHero
          title={mockData.featured.title}
          institution={mockData.featured.institution}
          deadline={mockData.featured.deadline}
          participants={mockData.featured.participants}
          totalPending={mockData.stats.awaiting - 1}
          onVotePress={navigateToProposals}
          onSeeMorePress={navigateToProposals}
        />

        {/* Impact Stats */}
        <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.statsSection}>
          <Text style={styles.sectionTitle}>YOUR IMPACT</Text>
          <View style={styles.statsRow}>
            <ImpactStatCard
              icon="hourglass-outline"
              value={mockData.stats.awaiting}
              label="Awaiting You"
              progress={0.3}
              delay={250}
            />
            <ImpactStatCard
              icon="checkmark-done-outline"
              value={mockData.stats.voted}
              label="Voted"
              progress={0.65}
              delay={350}
            />
            <ImpactStatCard
              icon="create-outline"
              value={mockData.stats.created}
              label="Created"
              progress={0.15}
              delay={450}
            />
          </View>
        </Animated.View>

        {/* Recent Activity */}
        <ActivityFeed items={mockData.activity} />

        {/* Communities */}
        <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.communitiesSection}>
          <Text style={styles.sectionTitle}>YOUR COMMUNITIES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.communitiesScroll}
          >
            {mockData.communities.map((community, idx) => (
              <CommunityCard
                key={community.name}
                name={community.name}
                icon={community.icon}
                proposalCount={community.proposalCount}
                activeCount={community.activeCount}
                isPrimary={community.isPrimary}
                gradientColors={community.isPrimary ? [BRAND.gold, BRAND.goldDark] : undefined}
                index={idx}
                onPress={() => {
                  if (community.isPrimary) {
                    navigateToProposals();
                  } else {
                    router.push({
                      pathname: '/modals/community-proposals',
                      params: {
                        scope: community.scope,
                        scopeName: community.name,
                        icon: community.icon,
                      },
                    });
                  }
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed bottom nav blur - handled by tab layout */}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.black,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {},
  greeting: {
    fontFamily: 'Onest',
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(244,245,246,0.6)',
    marginBottom: 4,
  },
  brandRow: {
    position: 'relative',
  },
  brandName: {
    fontFamily: 'Onest',
    fontSize: 28,
    fontWeight: '700',
    color: BRAND.white,
    letterSpacing: -0.5,
  },
  goldUnderline: {
    position: 'absolute',
    bottom: -2,
    left: 0,
    width: 80,
    height: 3,
    backgroundColor: BRAND.gold,
    borderRadius: 1.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BRAND.glass,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.gold,
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    padding: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 21,
    backgroundColor: BRAND.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: 'Onest',
    fontSize: 18,
    fontWeight: '700',
    color: BRAND.gold,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: BRAND.black,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Shimmer border
  shimmerContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  shimmerBorderBase: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
  },
  shimmerOverflow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  shimmerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: '100%',
  },
  shimmerContent: {
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Hero card
  heroCard: {
    backgroundColor: BRAND.glass,
    padding: 24,
    borderRadius: 20,
  },
  institutionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(234,186,88,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 16,
  },
  institutionText: {
    fontFamily: 'Onest',
    fontSize: 12,
    fontWeight: '600',
    color: BRAND.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontFamily: 'Onest',
    fontSize: 24,
    fontWeight: '700',
    color: BRAND.white,
    lineHeight: 30,
    marginBottom: 16,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  countdownText: {
    fontFamily: 'Onest',
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(244,245,246,0.7)',
  },
  countdownNumber: {
    fontFamily: 'JetBrains Mono',
    fontWeight: '600',
    color: BRAND.gold,
  },
  participationSection: {
    marginBottom: 20,
  },
  participationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  participationLabel: {
    fontFamily: 'Onest',
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(244,245,246,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  participationCount: {
    fontFamily: 'JetBrains Mono',
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.white,
  },
  participationUnit: {
    fontWeight: '400',
    color: 'rgba(244,245,246,0.5)',
  },
  participationTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  participationFill: {
    height: '100%',
    backgroundColor: BRAND.gold,
    borderRadius: 3,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  voteButtonText: {
    fontFamily: 'Onest',
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.black,
  },
  seeMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    gap: 4,
  },
  seeMoreText: {
    fontFamily: 'Onest',
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(244,245,246,0.5)',
  },

  // Section
  sectionTitle: {
    fontFamily: 'Onest',
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(244,245,246,0.4)',
    letterSpacing: 1.5,
    marginBottom: 16,
  },

  // Stats
  statsSection: {
    marginBottom: 28,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: BRAND.glass,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statIconWrapper: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND.gold,
    opacity: 0.15,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(234,186,88,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontFamily: 'JetBrains Mono',
    fontSize: 28,
    fontWeight: '700',
    color: BRAND.white,
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: 'Onest',
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(244,245,246,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Activity
  activitySection: {
    marginBottom: 28,
  },
  activityList: {
    backgroundColor: BRAND.glass,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    borderRadius: 16,
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.glassBorder,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(234,186,88,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityText: {
    flex: 1,
    fontFamily: 'Onest',
    fontSize: 13,
    fontWeight: '500',
    color: BRAND.white,
  },
  activityTime: {
    fontFamily: 'JetBrains Mono',
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(244,245,246,0.4)',
    marginLeft: 8,
  },

  // Communities
  communitiesSection: {
    marginBottom: 24,
  },
  communitiesScroll: {
    paddingRight: 20,
    gap: 12,
  },
  communityCard: {
    backgroundColor: BRAND.glass,
    borderWidth: 1,
    borderColor: BRAND.glassBorder,
    borderRadius: 16,
    padding: 16,
    minWidth: 140,
    overflow: 'hidden',
  },
  communityCardPrimary: {
    minWidth: 180,
    minHeight: 100,
  },
  communityContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  communityEmoji: {
    fontSize: 18,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontFamily: 'Onest',
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.white,
    marginBottom: 2,
  },
  communityNamePrimary: {
    fontSize: 16,
    fontWeight: '700',
  },
  communityMeta: {
    fontFamily: 'Onest',
    fontSize: 11,
    fontWeight: '400',
    color: 'rgba(244,245,246,0.5)',
  },
  communityBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  communityBadgeText: {
    fontFamily: 'JetBrains Mono',
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.black,
  },
});
