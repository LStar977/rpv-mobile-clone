import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';

import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { userApi, veriffApi } from '../../lib/api';
import { Button } from '../../components/ui';
import { useTutorialTarget } from '../../components/tutorial';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;
const CARD_HEIGHT = CARD_WIDTH * 0.63; // Credit card ratio

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type VerificationState = {
  verified: boolean;
  status?: 'unverified' | 'pending' | 'verified' | 'failed';
  provider?: 'veriff' | string;
  verifiedAt?: string | null;
};

type ProfileState = {
  name?: string;
  email?: string;
  country?: string;
  state?: string;
  city?: string;
};

// Badge tier colors matching the badges modal
const TIER_COLORS = {
  common: { bg: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)' },
  rare: { bg: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  epic: { bg: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.5)' },
  legendary: { bg: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)' },
};

// All badges - same as badges modal for consistency
const ALL_BADGES = [
  { id: 'first_vote', name: 'First Vote', description: 'Cast your first vote on a proposal', icon: '🗳️', tier: 'common' as const, category: 'voting' },
  { id: 'first_vote_country', name: 'National Voice', description: 'Cast your first vote on a national proposal', icon: '🏛️', tier: 'common' as const, category: 'voting' },
  { id: 'first_vote_state', name: 'State Advocate', description: 'Cast your first vote on a state proposal', icon: '🗺️', tier: 'rare' as const, category: 'voting' },
  { id: 'first_vote_city', name: 'Local Champion', description: 'Cast your first vote on a city proposal', icon: '🏙️', tier: 'rare' as const, category: 'voting' },
  { id: 'vote_streak_5', name: 'Consistent Voter', description: 'Vote on 5 different proposals', icon: '🔥', tier: 'common' as const, category: 'streak' },
  { id: 'vote_streak_25', name: 'Dedicated Citizen', description: 'Vote on 25 different proposals', icon: '⭐', tier: 'rare' as const, category: 'streak' },
  { id: 'vote_streak_100', name: 'Democracy Hero', description: 'Vote on 100 different proposals', icon: '🏆', tier: 'legendary' as const, category: 'streak' },
  { id: 'first_proposal', name: 'Proposal Pioneer', description: 'Create your first proposal', icon: '📝', tier: 'common' as const, category: 'creator' },
  { id: 'proposal_5', name: 'Active Legislator', description: 'Create 5 proposals', icon: '📋', tier: 'epic' as const, category: 'creator' },
  { id: 'referral_5', name: 'Community Builder', description: 'Refer 5 new users', icon: '🤝', tier: 'rare' as const, category: 'social' },
  { id: 'referral_20', name: 'Movement Leader', description: 'Refer 20 new users', icon: '👥', tier: 'epic' as const, category: 'social' },
  { id: 'passport_minted', name: 'Verified Citizen', description: 'Mint your Represent Passport NFT', icon: '🛂', tier: 'epic' as const, category: 'identity' },
  { id: 'early_adopter', name: 'Early Adopter', description: 'Join during the beta period', icon: '🚀', tier: 'legendary' as const, category: 'special' },
  { id: 'democratic_spirit', name: 'Democratic Spirit', description: 'Vote on both sides of the aisle', icon: '⚖️', tier: 'rare' as const, category: 'special' },
  { id: 'global_citizen', name: 'Global Citizen', description: 'Participate in governance across multiple regions', icon: '🌍', tier: 'legendary' as const, category: 'special' },
];

// Show first 6 badges on identity page (sorted by tier importance)
const PREVIEW_BADGES = [...ALL_BADGES].sort((a, b) => {
  const tierOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
  return tierOrder[a.tier] - tierOrder[b.tier];
}).slice(0, 6);

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatShortDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

// Digital ID Card Component - Wallet Style
function DigitalIDCard({
  name,
  location,
  verified,
  verifiedAt,
  memberSince,
  onPress,
}: {
  name: string;
  location: string;
  verified: boolean;
  verifiedAt?: string | null;
  memberSince?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const shimmer = useSharedValue(0);
  const holographicRotation = useSharedValue(0);

  useEffect(() => {
    // Holographic shimmer effect
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );

    if (verified) {
      holographicRotation.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 2000 }),
          withTiming(-5, { duration: 2000 })
        ),
        -1,
        true
      );
    }
  }, [verified]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [0, 1], [-CARD_WIDTH, CARD_WIDTH]) },
    ],
    opacity: verified ? 0.3 : 0.1,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${holographicRotation.value}deg` },
    ],
  }));

  // Generate a pseudo ID number based on name
  const idNumber = useMemo(() => {
    if (!name) return 'RW-XXXX-XXXX';
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `RW-${(hash % 10000).toString().padStart(4, '0')}-${((hash * 7) % 10000).toString().padStart(4, '0')}`;
  }, [name]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.95} disabled={!onPress}>
      <Animated.View style={[styles.idCard, cardStyle]}>
        {/* Card Background */}
        <LinearGradient
          colors={verified
            ? ['#1a1a2e', '#16213e', '#1a1a2e']
            : ['#2d2d2d', '#1f1f1f', '#2d2d2d']
          }
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Holographic Overlay for Verified */}
        {verified && (
          <LinearGradient
            colors={['transparent', 'rgba(212,175,55,0.1)', 'rgba(138,109,186,0.1)', 'rgba(52,199,89,0.1)', 'transparent']}
            style={[StyleSheet.absoluteFill, { opacity: 0.5 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}

        {/* Shimmer Effect */}
        <Animated.View style={[styles.shimmerOverlay, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
            style={styles.shimmerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>

        {/* Card Content */}
        <View style={styles.idCardContent}>
          {/* Header Row */}
          <View style={styles.idCardHeader}>
            <View style={styles.idCardLogo}>
              <Ionicons name="wallet" size={20} color={colors.gold} />
              <Text style={styles.idCardLogoText}>REPRESENT</Text>
            </View>
            {verified && (
              <View style={styles.verifiedChip}>
                <Ionicons name="shield-checkmark" size={12} color="#34C759" />
                <Text style={styles.verifiedChipText}>VERIFIED</Text>
              </View>
            )}
          </View>

          {/* Avatar & Name Section */}
          <View style={styles.idCardMain}>
            <View style={styles.avatarContainer}>
              <LinearGradient
                colors={verified ? [colors.gold, '#A68523'] : ['#555', '#333']}
                style={styles.avatarGradient}
              >
                <Ionicons name="person" size={32} color="#fff" />
              </LinearGradient>
              {verified && (
                <View style={styles.avatarBadge}>
                  <Ionicons name="checkmark" size={10} color="#fff" />
                </View>
              )}
            </View>

            <View style={styles.idCardInfo}>
              <Text style={styles.idCardName} numberOfLines={1}>
                {name || 'Your Name'}
              </Text>
              <Text style={styles.idCardLocation} numberOfLines={1}>
                <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.6)" />
                {' '}{location || 'Location not set'}
              </Text>
            </View>
          </View>

          {/* Footer Row */}
          <View style={styles.idCardFooter}>
            <View style={styles.idCardMeta}>
              <Text style={styles.idCardMetaLabel}>MEMBER SINCE</Text>
              <Text style={styles.idCardMetaValue}>{memberSince || '—'}</Text>
            </View>
            <View style={styles.idCardMeta}>
              <Text style={styles.idCardMetaLabel}>ID NUMBER</Text>
              <Text style={styles.idCardMetaValue}>{idNumber}</Text>
            </View>
            <View style={[styles.idCardMeta, { alignItems: 'flex-end' }]}>
              <Text style={styles.idCardMetaLabel}>STATUS</Text>
              <Text style={[styles.idCardMetaValue, { color: verified ? '#34C759' : colors.gold }]}>
                {verified ? 'ACTIVE' : 'PENDING'}
              </Text>
            </View>
          </View>

          {/* Decorative Pattern */}
          <View style={styles.cardPattern}>
            {[...Array(5)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.patternLine,
                  { opacity: 0.03 + i * 0.01, top: 10 + i * 25 }
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Civic Badge Component
function CivicBadge({
  badge,
  earned,
  onPress,
}: {
  badge: typeof ALL_BADGES[0];
  earned: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const tierColor = TIER_COLORS[badge.tier];

  return (
    <TouchableOpacity
      style={[
        styles.civicBadge,
        {
          backgroundColor: earned ? `${tierColor.bg}15` : colors.surface,
          borderColor: earned ? `${tierColor.bg}40` : colors.border,
          shadowColor: earned ? tierColor.bg : 'transparent',
          shadowOpacity: earned ? 0.4 : 0,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: earned ? 4 : 0,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[
        styles.badgeIconContainer,
        { backgroundColor: earned ? `${tierColor.bg}20` : `${colors.textTertiary}10` },
      ]}>
        <Text style={[styles.badgeEmoji, { opacity: earned ? 1 : 0.4 }]}>
          {badge.icon}
        </Text>
      </View>
      <Text style={[
        styles.badgeLabel,
        { color: earned ? colors.text : colors.textTertiary },
      ]} numberOfLines={1}>
        {badge.name}
      </Text>
      <View style={[styles.tierBadge, { backgroundColor: `${tierColor.bg}${earned ? '30' : '15'}` }]}>
        <Text style={[styles.tierText, { color: earned ? tierColor.bg : colors.textTertiary }]}>
          {badge.tier.toUpperCase()}
        </Text>
      </View>
      {!earned && (
        <View style={styles.badgeLock}>
          <Ionicons name="lock-closed" size={10} color={colors.textTertiary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// Quick Stats Component
function QuickStats({
  votesCount,
  proposalsCount,
  streakDays,
}: {
  votesCount: number;
  proposalsCount: number;
  streakDays: number;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.quickStats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.text }]}>{votesCount}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Votes</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.text }]}>{proposalsCount}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Proposals</Text>
      </View>
      <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
      <View style={styles.statItem}>
        <Text style={[styles.statValue, { color: colors.text }]}>{streakDays}</Text>
        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Day Streak</Text>
      </View>
    </View>
  );
}

export default function IdentityScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user, token } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [verification, setVerification] = useState<VerificationState>({
    verified: false,
    status: 'unverified',
    provider: 'veriff',
    verifiedAt: null,
  });

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [startingKyc, setStartingKyc] = useState(false);

  // Payment/subscription state for gating verification
  const [hasPaidVerification, setHasPaidVerification] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  // Mock stats - in real app, fetch from API
  const [stats, setStats] = useState({ votes: 0, proposals: 0, streak: 0 });

  // Tutorial target refs
  const idCardRef = useTutorialTarget('id-card');
  const verifyButtonRef = useTutorialTarget('verify-button');

  const fetchIdentity = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        isAuthenticated ? userApi.getVerificationStatus() : Promise.resolve({ data: { verified: false } }),
        isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null }),
      ]);

      const verificationRes =
        results[0].status === 'fulfilled' ? results[0].value : { data: { verified: false } };
      const profileRes = results[1].status === 'fulfilled' ? results[1].value : { data: null };

      const v = verificationRes?.data || {};
      const p = profileRes?.data || null;

      setVerification({
        verified: !!v.verified,
        status: (v.status as any) || (v.verified ? 'verified' : 'unverified'),
        provider: v.provider || 'veriff',
        verifiedAt: v.verifiedAt || v.verified_at || null,
      });

      setProfile(p);

      // Check subscription status (for premium users, verification is included)
      if (isAuthenticated && token) {
        try {
          const subResponse = await fetch(`${API_URL}/api/stripe/subscription`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (subResponse.ok) {
            const subData = await subResponse.json();
            const userIsPremium = subData.tier === 'premium' && subData.status === 'active';
            const userHasPaid = subData.verificationPaid === true || userIsPremium;
            setIsPremium(userIsPremium);
            setHasPaidVerification(userHasPaid);
          }
        } catch (subError) {
          console.error('Subscription check error:', subError);
        }
      }

      // Mock stats - replace with real API call
      setStats({
        votes: Math.floor(Math.random() * 50),
        proposals: Math.floor(Math.random() * 5),
        streak: Math.floor(Math.random() * 14)
      });
    } catch (e) {
      console.error('Identity fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchIdentity();
  }, [fetchIdentity]);

  const handleStartKyc = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to begin verification.');
      return;
    }

    // Check if user has paid for verification or is premium
    if (!hasPaidVerification && !isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Payment Required',
        'Identity verification requires a one-time payment of $4.99, or is included free with Premium membership.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Get Verified ($4.99)',
            onPress: () => router.push('/modals/verification-payment'),
          },
          {
            text: 'View Premium',
            onPress: () => router.push('/modals/subscription'),
          },
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStartingKyc(true);

    try {
      const response = await veriffApi.createSession();

      if (response.data?.sessionUrl && response.data?.verificationId) {
        router.push({
          pathname: '/modals/veriff',
          params: {
            sessionUrl: response.data.sessionUrl,
            verificationId: response.data.verificationId,
          },
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Verification Error',
          response.data?.error || 'Could not start verification session. Please try again.'
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Veriff session error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the verification service. Please check your connection and try again.'
      );
    } finally {
      setStartingKyc(false);
    }
  };

  // Calculate earned badges
  // State for API-fetched earned badges
  const [apiBadges, setApiBadges] = useState<Set<string>>(new Set());

  // Fetch earned badges from API
  useEffect(() => {
    const fetchBadges = async () => {
      if (!isAuthenticated || !user?.id || !token) return;
      try {
        const response = await fetch(`${API_URL}/api/badges/user/${user.id}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const earnedBadgesData = await response.json();
          const earnedIds = new Set<string>(
            earnedBadgesData.map((b: any) => b.badgeId || b.badge?.id || b.id)
          );
          setApiBadges(earnedIds);
        }
      } catch (error) {
        console.error('Error fetching badges:', error);
      }
    };
    fetchBadges();
  }, [isAuthenticated, user?.id, token]);

  // Combine API badges with local computed badges
  const earnedBadges = useMemo(() => {
    const earned = new Set<string>(apiBadges);
    // Add computed badges based on stats
    if (stats.votes >= 1) earned.add('first_vote');
    if (stats.votes >= 5) earned.add('vote_streak_5');
    if (stats.votes >= 25) earned.add('vote_streak_25');
    if (stats.votes >= 100) earned.add('vote_streak_100');
    if (stats.proposals >= 1) earned.add('first_proposal');
    if (stats.proposals >= 5) earned.add('proposal_5');
    if (verification.verified) earned.add('passport_minted');
    return earned;
  }, [verification.verified, stats, apiBadges]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading identity...</Text>
        </View>
      </View>
    );
  }

  const displayName = profile?.name || user?.name || '';
  const displayEmail = profile?.email || user?.email || '';
  const displayCountry = profile?.country || user?.country || '';
  const displayState = profile?.state || user?.state || '';
  const displayCity = profile?.city || user?.city || '';

  // Build location string
  const locationParts = [displayCity, displayState, displayCountry].filter(Boolean);
  const displayLocation = locationParts.length > 0 ? locationParts.join(', ') : '';

  // Member since date (mock - use user creation date in real app)
  const memberSince = formatShortDate(verification.verifiedAt) || 'Feb 2026';

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
          <Text style={[styles.pageTitle, { color: colors.text }]}>Identity</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Your civic identity and achievements
          </Text>
        </Animated.View>

        {/* Digital ID Card */}
        <View ref={idCardRef} collapsable={false}>
          <Animated.View entering={FadeInUp.delay(100).duration(500)}>
            <DigitalIDCard
              name={displayName}
              location={displayLocation}
              verified={verification.verified}
              verifiedAt={verification.verifiedAt}
              memberSince={memberSince}
            />
          </Animated.View>
        </View>

        {/* Verification CTA for unverified users */}
        {!verification.verified && isAuthenticated && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.verifyCta, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <LinearGradient
              colors={[`${colors.gold}10`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.verifyCtaContent}>
              <View style={[styles.verifyCtaIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.gold} />
              </View>
              <View style={styles.verifyCtaText}>
                <Text style={[styles.verifyCtaTitle, { color: colors.text }]}>
                  {verification.status === 'pending' ? 'Verification Pending' : 'Verify Your Identity'}
                </Text>
                <Text style={[styles.verifyCtaSubtitle, { color: colors.textSecondary }]}>
                  {verification.status === 'pending'
                    ? 'Your verification is being processed'
                    : 'Unlock voting and earn the Verified badge'
                  }
                </Text>
              </View>
            </View>
            <View ref={verifyButtonRef} collapsable={false}>
              <Button
                title={startingKyc ? 'Starting...' : verification.status === 'pending' ? 'Refresh' : 'Verify Now'}
                onPress={verification.status === 'pending' ? onRefresh : handleStartKyc}
                variant="primary"
                size="md"
                loading={startingKyc}
                disabled={startingKyc}
              />
            </View>
          </Animated.View>
        )}

        {/* Sign In CTA for unauthenticated users */}
        {!isAuthenticated && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.verifyCta, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.verifyCtaContent}>
              <View style={[styles.verifyCtaIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="log-in-outline" size={24} color={colors.gold} />
              </View>
              <View style={styles.verifyCtaText}>
                <Text style={[styles.verifyCtaTitle, { color: colors.text }]}>Sign In Required</Text>
                <Text style={[styles.verifyCtaSubtitle, { color: colors.textSecondary }]}>
                  Sign in to access your civic identity
                </Text>
              </View>
            </View>
            <Button
              title="Sign In"
              onPress={() => router.replace('/')}
              variant="primary"
              size="md"
            />
          </Animated.View>
        )}

        {/* Quick Stats */}
        {isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <QuickStats
              votesCount={stats.votes}
              proposalsCount={stats.proposals}
              streakDays={stats.streak}
            />
          </Animated.View>
        )}

        {/* Civic Badges Section */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={styles.badgesSection}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
            <TouchableOpacity
              onPress={() => router.push('/modals/badges')}
              style={styles.viewAllButton}
            >
              <Text style={[styles.viewAllText, { color: colors.gold }]}>
                View All {ALL_BADGES.length}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <View style={styles.badgesGrid}>
            {PREVIEW_BADGES.map((badge) => (
              <CivicBadge
                key={badge.id}
                badge={badge}
                earned={earnedBadges.has(badge.id)}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert(
                    badge.name,
                    earnedBadges.has(badge.id)
                      ? `You've earned this badge! ${badge.description}`
                      : `${badge.description} to earn this badge.`
                  );
                }}
              />
            ))}
          </View>

          {/* Progress summary */}
          <View style={[styles.badgeProgress, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.badgeProgressInfo}>
              <Text style={[styles.badgeProgressLabel, { color: colors.textSecondary }]}>Progress</Text>
              <Text style={[styles.badgeProgressValue, { color: colors.text }]}>
                {earnedBadges.size}/{ALL_BADGES.length} badges earned
              </Text>
            </View>
            <View style={[styles.badgeProgressBar, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.badgeProgressFill,
                  {
                    backgroundColor: colors.gold,
                    width: `${(earnedBadges.size / ALL_BADGES.length) * 100}%`
                  }
                ]}
              />
            </View>
          </View>
        </Animated.View>

        {/* Account Details */}
        {isAuthenticated && (
          <Animated.View
            entering={FadeInUp.delay(500).duration(400)}
            style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.detailsHeader}>
              <Text style={[styles.detailsTitle, { color: colors.text }]}>Account Details</Text>
              {verification.verified && (
                <View style={[styles.verifiedTag, { backgroundColor: `${colors.success}15` }]}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={[styles.verifiedTagText, { color: colors.success }]}>Verified</Text>
                </View>
              )}
            </View>

            <View style={styles.detailsContent}>
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.detailIcon, { backgroundColor: `${colors.gold}12` }]}>
                  <Ionicons name="person-outline" size={16} color={colors.gold} />
                </View>
                <View style={styles.detailText}>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Name</Text>
                  <Text style={[styles.detailValue, { color: displayName ? colors.text : colors.textTertiary }]}>
                    {displayName || '—'}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.detailIcon, { backgroundColor: `${colors.gold}12` }]}>
                  <Ionicons name="mail-outline" size={16} color={colors.gold} />
                </View>
                <View style={styles.detailText}>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Email</Text>
                  <Text style={[styles.detailValue, { color: displayEmail ? colors.text : colors.textTertiary }]}>
                    {displayEmail || '—'}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.detailIcon, { backgroundColor: `${colors.gold}12` }]}>
                  <Ionicons name="location-outline" size={16} color={colors.gold} />
                </View>
                <View style={styles.detailText}>
                  <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>Location</Text>
                  <Text style={[styles.detailValue, { color: displayLocation ? colors.text : colors.textTertiary }]}>
                    {displayLocation || '—'}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Verification Info */}
        {verification.verified && (
          <Animated.View
            entering={FadeInUp.delay(600).duration(400)}
            style={[styles.verificationInfo, { backgroundColor: `${colors.success}08`, borderColor: `${colors.success}20` }]}
          >
            <Ionicons name="shield-checkmark" size={20} color={colors.success} />
            <View style={styles.verificationInfoText}>
              <Text style={[styles.verificationInfoTitle, { color: colors.success }]}>
                Identity Verified
              </Text>
              <Text style={[styles.verificationInfoSubtitle, { color: colors.textSecondary }]}>
                Verified via {verification.provider?.toUpperCase()} on {formatDate(verification.verifiedAt)}
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
  },

  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Header
  header: {
    marginBottom: SPACING.xl,
  },
  pageTitle: {
    ...TYPOGRAPHY.displaySmall,
  },
  pageSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xs,
  },

  // Digital ID Card
  idCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BORDER_RADIUS.xxl,
    overflow: 'hidden',
    ...SHADOWS.lg,
    marginBottom: SPACING.lg,
  },
  idCardContent: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'space-between',
  },
  idCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idCardLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  idCardLogoText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52,199,89,0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  verifiedChipText: {
    color: '#34C759',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  idCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
  idCardInfo: {
    flex: 1,
  },
  idCardName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  idCardLocation: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  idCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  idCardMeta: {
    flex: 1,
  },
  idCardMetaLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 2,
  },
  idCardMetaValue: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: CARD_WIDTH * 0.5,
  },
  shimmerGradient: {
    flex: 1,
    width: '100%',
  },
  cardPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  patternLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#fff',
  },

  // Verify CTA
  verifyCta: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  verifyCtaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  verifyCtaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyCtaText: {
    flex: 1,
  },
  verifyCtaTitle: {
    ...TYPOGRAPHY.labelLarge,
    marginBottom: 2,
  },
  verifyCtaSubtitle: {
    ...TYPOGRAPHY.bodySmall,
  },

  // Quick Stats
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  statLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  statDivider: {
    width: 1,
    height: 32,
    marginHorizontal: SPACING.md,
  },

  // Badges Section
  badgesSection: {
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.labelSmall,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  civicBadge: {
    width: (CARD_WIDTH - SPACING.sm * 2) / 3,
    aspectRatio: 1,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.sm,
  },
  badgeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  badgeLabel: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  badgeEmoji: {
    fontSize: 28,
  },
  tierBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.xs,
  },
  tierText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badgeLock: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  badgeProgress: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  badgeProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  badgeProgressLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  badgeProgressValue: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  badgeProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  badgeProgressFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Details Card
  detailsCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  detailsTitle: {
    ...TYPOGRAPHY.labelLarge,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  verifiedTagText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  detailsContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginBottom: 2,
  },
  detailValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },

  // Verification Info
  verificationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  verificationInfoText: {
    flex: 1,
  },
  verificationInfoTitle: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  verificationInfoSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },

  bottomSpacer: {
    height: 100,
  },
});
