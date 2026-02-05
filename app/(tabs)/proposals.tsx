import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  runOnJS,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { proposalsApi, userApi, uploadsApi, limitsApi, Proposal, UsageLimits } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { shareProposal } from '../../lib/share';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';
import { showVoteConfirmation } from '../../lib/notifications';
import { VoteConfirmationOverlay, UpgradeModal } from '../../components/ui';
import { checkForNewBadges } from '../../lib/badgeNotification';
import * as ImagePicker from 'expo-image-picker';
import { useTutorialTarget } from '../../components/tutorial';
import { useTutorialStore } from '../../lib/tutorial';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const CATEGORIES = [
  'All',
  'Transportation',
  'Environment',
  'Housing',
  'Education',
  'Healthcare',
  'Economy',
  'Public Safety',
  'Infrastructure',
  'Other',
];
const STATUS_FILTERS = ['All', 'Active', 'Ended', 'My Proposals'];
const GEO_LEVELS = ['All', 'National', 'State/Province', 'City/Local'];
const COUNTRIES = ['Canada', 'United States', 'United Kingdom', 'Australia'];
const AGE_GROUPS = ['All Ages', '18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
const GENDERS = ['All Genders', 'Male', 'Female'];

// Category-themed gradient colors for proposal cards
const categoryThemes: Record<string, { primary: string; secondary: string; icon: string }> = {
  'Transportation': { primary: '#3B82F6', secondary: '#1D4ED8', icon: 'car-outline' },
  'Environment': { primary: '#22C55E', secondary: '#15803D', icon: 'leaf-outline' },
  'Housing': { primary: '#F59E0B', secondary: '#D97706', icon: 'home-outline' },
  'Education': { primary: '#8B5CF6', secondary: '#6D28D9', icon: 'school-outline' },
  'Healthcare': { primary: '#EF4444', secondary: '#DC2626', icon: 'medkit-outline' },
  'Economy': { primary: '#10B981', secondary: '#059669', icon: 'trending-up-outline' },
  'Public Safety': { primary: '#F97316', secondary: '#EA580C', icon: 'shield-checkmark-outline' },
  'Infrastructure': { primary: '#6366F1', secondary: '#4F46E5', icon: 'construct-outline' },
  'Other': { primary: '#D4AF37', secondary: '#A68523', icon: 'ellipsis-horizontal-outline' },
  'General': { primary: '#D4AF37', secondary: '#A68523', icon: 'ellipsis-horizontal-outline' },
};

const SWIPE_THRESHOLD = 120;

// Helper to check if a proposal is a seed proposal (for local-only voting)
const isSeedProposal = (id: number | string): boolean =>
  typeof id === 'string' && id.startsWith('seed-');

function getTimeRemaining(deadline: string | null): string {
  if (!deadline) return '';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

function isProposalEnded(p: Proposal) {
  return getTimeRemaining(p.deadline) === 'Ended';
}

// Check if user can vote on a proposal based on geo restrictions
// Global proposals (no geo): anyone can vote
// Geo-restricted: only verified users with matching location
const canUserVoteOnProposal = (
  proposal: Proposal,
  userCountry: string,
  userState: string,
  userCity: string,
  isVerified: boolean
): boolean => {
  const proposalGeo = proposal.geoRestrictions || [];

  // Global proposals: anyone can vote
  if (proposalGeo.length === 0) return true;

  // Geo-restricted proposals require verification
  if (!isVerified) return false;

  // Check hierarchical location match
  const userLocation = [userCountry, userState, userCity].filter(Boolean);
  return proposalGeo.every((restriction, index) => {
    const userLevel = userLocation[index];
    return userLevel && userLevel.toLowerCase() === restriction.toLowerCase();
  });
};

// Premium Filter Chip
function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1, ANIMATION.spring.snappy)
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.gold : colors.surface,
          borderColor: selected ? colors.gold : colors.border,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      activeOpacity={1}
    >
      {selected && (
        <LinearGradient
          colors={[colors.gold, colors.goldDark || '#A68523']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <Text style={[styles.filterChipText, { color: selected ? '#000' : colors.text }]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

// --- Swipe Card Component (Full-Screen Tinder-Style) ---
interface SwipeCardProps {
  proposal: Proposal;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onTap: () => void;
  isTopCard: boolean;
  cardIndex: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT - 420; // Shorter card with space below for tab bar

function SwipeCard({ proposal, onSwipeLeft, onSwipeRight, onSwipeUp, onTap, isTopCard, cardIndex }: SwipeCardProps) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(isTopCard ? 1 : 0.95 - cardIndex * 0.02);

  // Use refs to avoid stale callback issues with gesture handler worklets
  const onSwipeRightRef = useRef(onSwipeRight);
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeUpRef = useRef(onSwipeUp);
  const onTapRef = useRef(onTap);

  useEffect(() => {
    onSwipeRightRef.current = onSwipeRight;
    onSwipeLeftRef.current = onSwipeLeft;
    onSwipeUpRef.current = onSwipeUp;
    onTapRef.current = onTap;
  }, [onSwipeRight, onSwipeLeft, onSwipeUp, onTap]);

  const category = proposal.category || 'General';
  const theme = categoryThemes[category] || categoryThemes['General'];
  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isEnded = timeRemaining === 'Ended';
  const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const supportPercent = totalVotes > 0 ? Math.round(((proposal.supportVotes || 0) / totalVotes) * 100) : 50;

  useEffect(() => {
    scale.value = withSpring(isTopCard ? 1 : 0.95 - cardIndex * 0.02, { damping: 15 });
  }, [isTopCard, cardIndex]);

  // Wrapper functions that use the refs - prevents stale closure in worklets
  const handleSwipeRight = useCallback(() => {
    onSwipeRightRef.current();
  }, []);

  const handleSwipeLeft = useCallback(() => {
    onSwipeLeftRef.current();
  }, []);

  const handleSwipeUp = useCallback(() => {
    onSwipeUpRef.current();
  }, []);

  const handleTap = useCallback(() => {
    onTapRef.current();
  }, []);

  const gesture = Gesture.Pan()
    .enabled(isTopCard && !isEnded)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      // Allow full Y movement when swiping up, dampen when swiping down
      translateY.value = event.translationY < 0 ? event.translationY : event.translationY * 0.2;
      rotation.value = interpolate(event.translationX, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-12, 0, 12]);
    })
    .onEnd((event) => {
      // Swipe UP to skip (check first, negative Y = upward)
      if (event.translationY < -SWIPE_THRESHOLD) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 300 });
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        runOnJS(handleSwipeUp)();
      } else if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        rotation.value = withTiming(20, { duration: 300 });
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        runOnJS(handleSwipeRight)();
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        rotation.value = withTiming(-20, { duration: 300 });
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Warning);
        runOnJS(handleSwipeLeft)();
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
        rotation.value = withSpring(0, { damping: 15 });
      }
    });

  const tapGesture = Gesture.Tap()
    .enabled(isTopCard)
    .onEnd(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      runOnJS(handleTap)();
    });

  const composedGesture = Gesture.Race(gesture, tapGesture);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + cardIndex * 12 },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    zIndex: 100 - cardIndex,
    opacity: isTopCard ? 1 : 0.85 - cardIndex * 0.15,
  }));

  const supportIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const opposeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const skipIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.swipeCard, { backgroundColor: colors.surface, borderColor: colors.border, height: CARD_HEIGHT }, cardStyle]}>
        {/* Hero Image */}
        {proposal.imageUrl ? (
          <View style={styles.swipeCardImageContainer}>
            <Image source={{ uri: proposal.imageUrl }} style={styles.swipeCardImage} resizeMode="cover" />
            {/* Category-themed gradient overlay on image */}
            <LinearGradient
              colors={[`${theme.primary}40`, 'transparent']}
              style={styles.swipeCardImageOverlayTop}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.9)']}
              locations={[0, 0.5, 1]}
              style={styles.swipeCardImageOverlay}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
          </View>
        ) : (
          <View style={[styles.swipeCardImageContainer, { backgroundColor: theme.primary + '20' }]}>
            <LinearGradient
              colors={[`${theme.primary}30`, `${theme.secondary}20`]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name={theme.icon as any} size={80} color={`${theme.primary}50`} />
          </View>
        )}

        {/* Geo scope badge - top left */}
        <View style={[styles.swipeGeoBadgeTopLeft, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <Ionicons
            name={proposal.geoRestrictions && proposal.geoRestrictions.length > 0 ? 'location' : 'globe-outline'}
            size={14}
            color="#fff"
          />
          <Text style={styles.swipeGeoText}>
            {proposal.geoRestrictions && proposal.geoRestrictions.length > 0
              ? proposal.geoRestrictions[proposal.geoRestrictions.length - 1]
              : 'Global'}
          </Text>
        </View>

        {/* Swipe Indicators */}
        {isTopCard && !isEnded && (
          <>
            <Animated.View style={[styles.swipeIndicatorFullScreen, styles.swipeIndicatorRight, supportIndicatorStyle]}>
              <View style={[styles.swipeIndicatorCircle, { backgroundColor: colors.success }]}>
                <Ionicons name="checkmark" size={48} color="#fff" />
              </View>
              <Text style={[styles.swipeIndicatorTextLarge, { color: colors.success }]}>SUPPORT</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeIndicatorFullScreen, styles.swipeIndicatorLeft, opposeIndicatorStyle]}>
              <View style={[styles.swipeIndicatorCircle, { backgroundColor: colors.error }]}>
                <Ionicons name="close" size={48} color="#fff" />
              </View>
              <Text style={[styles.swipeIndicatorTextLarge, { color: colors.error }]}>OPPOSE</Text>
            </Animated.View>
            <Animated.View style={[styles.swipeIndicatorFullScreen, styles.swipeIndicatorTop, skipIndicatorStyle]}>
              <View style={[styles.swipeIndicatorCircle, { backgroundColor: colors.gold }]}>
                <Ionicons name="arrow-up" size={48} color="#fff" />
              </View>
              <Text style={[styles.swipeIndicatorTextLarge, { color: colors.gold }]}>SKIP</Text>
            </Animated.View>
          </>
        )}

        {/* Content Overlay at Bottom */}
        <View style={styles.swipeCardContentOverlay}>
          {/* Category & Time badges */}
          <View style={styles.swipeCardBadgeRow}>
            <View style={[styles.swipeCategoryBadgeLarge, { backgroundColor: theme.primary }]}>
              <Ionicons name={theme.icon as any} size={14} color="#fff" />
              <Text style={styles.swipeCategoryTextLight}>{category}</Text>
            </View>
            {timeRemaining && (
              <View style={[styles.swipeTimeBadgeLarge, { backgroundColor: isEnded ? colors.error : 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="time-outline" size={14} color="#fff" />
                <Text style={styles.swipeTimeTextLight}>{timeRemaining}</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.swipeCardTitleLarge} numberOfLines={2}>{proposal.title}</Text>

          {/* Creator info */}
          <View style={styles.swipeCreatorRow}>
            <Ionicons name="person-circle-outline" size={14} color="rgba(255,255,255,0.6)" />
            <Text style={styles.swipeCreatorText}>
              Proposed by Community Member
            </Text>
          </View>

          {/* Description */}
          <Text style={styles.swipeCardDescLarge} numberOfLines={2}>{proposal.description}</Text>

          {/* Vote Progress */}
          <View style={styles.swipeVoteSectionLarge}>
            <View style={styles.swipeVoteBarBgLarge}>
              <View style={[styles.swipeVoteBarFillLarge, { width: `${supportPercent}%`, backgroundColor: colors.success }]} />
              <View style={[styles.swipeVoteBarOpposeSection, { width: `${100 - supportPercent}%`, backgroundColor: colors.error }]} />
            </View>
            <View style={styles.swipeVoteStatsLarge}>
              <View style={styles.swipeVoteStatLarge}>
                <Ionicons name="thumbs-up" size={18} color={colors.success} />
                <Text style={[styles.swipeVoteCountLarge, { color: colors.success }]}>{(proposal.supportVotes || 0).toLocaleString()}</Text>
              </View>
              <Text style={styles.swipeVotePercentLarge}>{supportPercent}% support</Text>
              <View style={styles.swipeVoteStatLarge}>
                <Ionicons name="thumbs-down" size={18} color={colors.error} />
                <Text style={[styles.swipeVoteCountLarge, { color: colors.error }]}>{(proposal.opposeVotes || 0).toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Ended Banner (shown inside card) */}
          {isEnded && (
            <View style={styles.swipeEndedBannerLarge}>
              <Ionicons name="flag-outline" size={18} color="#fff" />
              <Text style={styles.swipeEndedTextLarge}>Voting has ended</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// --- View Mode Toggle ---
function ViewModeToggle({ mode, onToggle }: { mode: 'swipe' | 'list'; onToggle: () => void }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.viewModeBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
    >
      <Ionicons
        name={mode === 'swipe' ? 'list-outline' : 'layers-outline'}
        size={18}
        color={colors.text}
      />
    </TouchableOpacity>
  );
}

// Premium Proposal Card
interface ProposalCardProps {
  proposal: Proposal;
  hasVoted: boolean;
  onVote: (id: number, vote: 'support' | 'oppose') => Promise<void>;
  isVoting: boolean;
  onPress: () => void;
  index: number;
  isUserVerified: boolean;
  userCountry: string;
  userState: string;
  userCity: string;
}

function ProposalCard({
  proposal,
  hasVoted,
  onVote,
  isVoting,
  onPress,
  index,
  isUserVerified,
  userCountry,
  userState,
  userCity,
}: ProposalCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const shimmer = useSharedValue(0);

  // Check if user's location matches for voting on geo-restricted proposals
  const userLocation = [userCountry, userState, userCity].filter(Boolean);
  const proposalGeo = proposal.geoRestrictions || [];
  const canVoteByLocation = proposalGeo.length === 0 ||
    proposalGeo.every((restriction, i) =>
      userLocation[i]?.toLowerCase() === restriction.toLowerCase()
    );

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]) }],
  }));

  const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const supportPercent =
    totalVotes > 0 ? Math.round(((proposal.supportVotes || 0) / totalVotes) * 100) : 50;

  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isEnded = timeRemaining === 'Ended';
  const geoTags = proposal.geoRestrictions || [];

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.98, ANIMATION.spring.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, ANIMATION.spring.snappy);
  };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    shareProposal({
      id: proposal.id as number,
      title: proposal.title,
      description: proposal.description,
    });
  };

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(index * 60).duration(400).springify()}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, animatedCardStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Subtle shimmer */}
      <View style={styles.shimmerContainer}>
        <Animated.View style={[styles.shimmerBar, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', `${colors.gold}06`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
        </Animated.View>
      </View>

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: `${colors.gold}15` }]}>
          <Text style={[styles.categoryText, { color: colors.gold }]}>
            {proposal.category || 'General'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {timeRemaining ? (
            <View
              style={[
                styles.timeBadge,
                { backgroundColor: isEnded ? `${colors.error}15` : `${colors.gold}15` },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={isEnded ? colors.error : colors.gold}
              />
              <Text style={[styles.timeText, { color: isEnded ? colors.error : colors.gold }]}>
                {timeRemaining}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.surfaceHover || `${colors.gold}08` }]}
            onPress={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Geo tags */}
      {geoTags.length > 0 && (
        <View style={styles.geoTags}>
          {geoTags.slice(0, 3).map((tag, i) => (
            <View key={i} style={[styles.geoTag, { backgroundColor: `${colors.info}12` }]}>
              <Ionicons name="location-outline" size={10} color={colors.info} />
              <Text style={[styles.geoTagText, { color: colors.info }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Verification required badge for unverified users on geo-restricted proposals */}
      {geoTags.length > 0 && !isUserVerified && (
        <View style={[styles.restrictionBadge, { backgroundColor: `${colors.warning}12` }]}>
          <Ionicons name="lock-closed" size={12} color={colors.warning} />
          <Text style={[styles.restrictionText, { color: colors.warning }]}>
            Verification required to vote
          </Text>
        </View>
      )}

      {/* Location mismatch badge for verified users outside the proposal's region */}
      {geoTags.length > 0 && isUserVerified && !canVoteByLocation && (
        <View style={[styles.restrictionBadge, { backgroundColor: `${colors.error}12` }]}>
          <Ionicons name="location-outline" size={12} color={colors.error} />
          <Text style={[styles.restrictionText, { color: colors.error }]}>
            Not in your region
          </Text>
        </View>
      )}

      {/* Content */}
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {proposal.title}
      </Text>
      <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
        {proposal.description}
      </Text>

      {/* Image */}
      {proposal.imageUrl && (
        <View style={styles.imageWrapper}>
          <Image source={{ uri: proposal.imageUrl }} style={styles.proposalImage} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.imageOverlay}
          />
        </View>
      )}

      {/* Vote Bar */}
      <View style={styles.voteSection}>
        <View style={[styles.voteBarBg, { backgroundColor: colors.error }]}>
          <Animated.View
            style={[
              styles.voteBarFill,
              { width: `${supportPercent}%`, backgroundColor: colors.success },
            ]}
          />
        </View>

        <View style={styles.voteStats}>
          <View style={styles.voteStat}>
            <View style={[styles.voteIconBg, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="thumbs-up" size={12} color={colors.success} />
            </View>
            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
              {(proposal.supportVotes || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.voteStat}>
            <View style={[styles.voteIconBg, { backgroundColor: `${colors.error}15` }]}>
              <Ionicons name="thumbs-down" size={12} color={colors.error} />
            </View>
            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
              {(proposal.opposeVotes || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      {isEnded ? (
        <View style={[styles.statusBanner, { backgroundColor: `${colors.error}10` }]}>
          <Ionicons name="flag-outline" size={16} color={colors.error} />
          <Text style={[styles.statusText, { color: colors.error }]}>Voting has ended</Text>
        </View>
      ) : hasVoted ? (
        <View style={[styles.statusBanner, { backgroundColor: `${colors.success}10` }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>You have voted</Text>
        </View>
      ) : (
        <View style={styles.voteActions}>
          <TouchableOpacity
            style={[styles.voteBtn, { backgroundColor: colors.success }, isVoting && styles.btnDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onVote(proposal.id as number, 'support');
            }}
            disabled={isVoting}
            activeOpacity={0.85}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.voteBtnText}>Support</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteBtn, { backgroundColor: colors.error }, isVoting && styles.btnDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onVote(proposal.id as number, 'oppose');
            }}
            disabled={isVoting}
            activeOpacity={0.85}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle" size={16} color="#fff" />
                <Text style={styles.voteBtnText}>Oppose</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </AnimatedTouchable>
  );
}

// Skeleton Card
function ProposalSkeleton({ index }: { index: number }) {
  const { colors } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.7, 0.3]),
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(300)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.cardHeader}>
        <Animated.View style={[styles.skeletonBadge, { backgroundColor: `${colors.gold}15` }, shimmerStyle]} />
        <Animated.View style={[styles.skeletonSmall, { backgroundColor: `${colors.gold}15` }, shimmerStyle]} />
      </View>
      <Animated.View style={[styles.skeletonTitle, { backgroundColor: `${colors.gold}10` }, shimmerStyle]} />
      <Animated.View style={[styles.skeletonLine, { backgroundColor: `${colors.gold}10` }, shimmerStyle]} />
      <Animated.View style={[styles.skeletonLine, { backgroundColor: `${colors.gold}10`, width: '70%' }, shimmerStyle]} />
      <Animated.View style={[styles.skeletonBtn, { backgroundColor: `${colors.gold}10` }, shimmerStyle]} />
    </Animated.View>
  );
}

export default function ProposalsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuthStore();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [claimedTokens, setClaimedTokens] = useState<Set<number | string>>(new Set());
  const [votedProposals, setVotedProposals] = useState<Set<number | string>>(new Set());
  const [votingProposalId, setVotingProposalId] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);

  const [userCountry, setUserCountry] = useState('');
  const [userState, setUserState] = useState('');
  const [userCity, setUserCity] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationModalType, setVerificationModalType] = useState<'vote' | 'proposal' | 'limit'>('vote');
  const [pendingLimitTier, setPendingLimitTier] = useState<'free' | 'verified'>('free');

  // Vote confirmation overlay state
  const [showVoteOverlay, setShowVoteOverlay] = useState(false);
  const [lastVoteType, setLastVoteType] = useState<'support' | 'oppose'>('support');

  // Swipe mode state
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');
  const [swipeIndex, setSwipeIndex] = useState(0);

  // Tutorial target ref
  const swipeCardRef = useTutorialTarget('swipe-card');

  // Tutorial state for action detection
  const { isActive: tutorialActive, completeAction: completeTutorialAction } = useTutorialStore();

  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    category: 'Other',
    country: '',
    state: '',
    city: '',
    geoScope: 'global' as 'global' | 'national' | 'state' | 'city',
    ageGroup: 'All Ages',
    gender: 'All Genders',
    imageUri: '' as string,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedGeoLevel, setSelectedGeoLevel] = useState('All');
  const [selectedFilterAge, setSelectedFilterAge] = useState('All Ages');
  const [selectedFilterGender, setSelectedFilterGender] = useState('All Genders');
  const [showFilters, setShowFilters] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewProposal((p) => ({ ...p, imageUri: result.assets[0].uri }));
    }
  };

  useEffect(() => {
    setNewProposal((p) => ({ ...p, country: userCountry, state: userState, city: userCity }));
  }, [userCountry, userState, userCity]);

  const filteredProposals = useMemo(() => {
    // Reverse to show most recent proposals first
    return [...proposals].reverse().filter((proposal) => {
      const matchesSearch =
        searchQuery === '' ||
        proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proposal.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'All' || (proposal.category || 'Other') === selectedCategory;

      const ended = isProposalEnded(proposal);
      let matchesStatus = selectedStatus === 'All';
      if (selectedStatus === 'Active') matchesStatus = !ended;
      if (selectedStatus === 'Ended') matchesStatus = ended;
      if (selectedStatus === 'My Proposals') {
        const creatorId = (proposal as any).creatorId || (proposal as any).userId;
        matchesStatus = creatorId === user?.id || creatorId === String(user?.id);
      }

      let matchesGeo = true;
      if (selectedGeoLevel !== 'All') {
        const geoTags = proposal.geoRestrictions || [];
        if (selectedGeoLevel === 'National') matchesGeo = geoTags.length === 0 || geoTags.some((t) => COUNTRIES.includes(t));
        else if (selectedGeoLevel === 'State/Province') matchesGeo = geoTags.length >= 2;
        else if (selectedGeoLevel === 'City/Local') matchesGeo = geoTags.length >= 3;
      }

      let matchesAge = true;
      let matchesGender = true;
      const demoRestrictions = (proposal as any).demographicRestrictions;
      if (selectedFilterAge !== 'All Ages') {
        matchesAge = !demoRestrictions?.ageGroup || demoRestrictions.ageGroup === selectedFilterAge;
      }
      if (selectedFilterGender !== 'All Genders') {
        matchesGender = !demoRestrictions?.gender || demoRestrictions.gender === selectedFilterGender;
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesGeo && matchesAge && matchesGender;
    });
  }, [
    proposals,
    searchQuery,
    selectedCategory,
    selectedStatus,
    selectedGeoLevel,
    selectedFilterAge,
    selectedFilterGender,
    user?.id,
  ]);

  const activeCount = useMemo(() => filteredProposals.filter((p) => !isProposalEnded(p)).length, [filteredProposals]);

  // Proposals available for swiping (not voted, not ended, user can vote)
  const swipeableProposals = useMemo(() => {
    return filteredProposals.filter((p) => {
      // Handle both string and number IDs for seed proposals
      const hasVoted = votedProposals.has(p.id as number) || votedProposals.has(p.id as any);
      const isEnded = isProposalEnded(p);
      // Filter out proposals user can't vote on (geo-restricted)
      const canVote = canUserVoteOnProposal(p, userCountry, userState, userCity, isVerified);
      return !hasVoted && !isEnded && canVote;
    });
  }, [filteredProposals, votedProposals, userCountry, userState, userCity, isVerified]);

  // Reset swipe index when filters change or proposals update
  useEffect(() => {
    setSwipeIndex(0);
  }, [selectedCategory, selectedStatus, selectedGeoLevel, searchQuery]);

  // Infinite rotation for seed proposals - when all proposals swiped, reset
  useEffect(() => {
    const hasSeedProposals = proposals.some((p) => isSeedProposal(p.id));
    if (hasSeedProposals && swipeIndex > 0 && swipeableProposals.length === 0) {
      // All proposals have been voted on, reset for infinite loop
      const timer = setTimeout(() => {
        // Clear seed proposal IDs from voted set, keep real votes
        setVotedProposals((prev) => {
          const newSet = new Set<number | string>();
          prev.forEach((id) => {
            if (!isSeedProposal(id)) {
              newSet.add(id);
            }
          });
          return newSet;
        });
        setSwipeIndex(0);
      }, 500); // Small delay for smooth transition
      return () => clearTimeout(timer);
    }
  }, [swipeIndex, swipeableProposals.length, proposals]);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      try {
        // Fetch proposals from API (falls back to seed proposals when backend is empty)
        const [proposalsRes, claimedRes, votedRes, profileRes, limitsRes] = await Promise.all([
          proposalsApi.getAll(),
          isAuthenticated ? userApi.getClaimedTokens() : Promise.resolve({ data: [], error: null }),
          isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [], error: null }),
          isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null, error: null }),
          isAuthenticated ? limitsApi.getUsageLimits() : Promise.resolve({ data: null, error: null }),
        ]);

        if (proposalsRes.data) setProposals(proposalsRes.data);

        if (claimedRes.data) {
          setClaimedTokens(new Set(claimedRes.data.map((c: any) => (typeof c === 'object' ? c.proposalId : c))));
        }

        if (votedRes.data) {
          setVotedProposals(new Set(votedRes.data.map((v: any) => (typeof v === 'object' ? v.proposalId : v))));
        }

        if (profileRes.data) {
          setUserCountry(profileRes.data.country || '');
          setUserState(profileRes.data.state || '');
          setUserCity(profileRes.data.city || '');
          setIsVerified(profileRes.data.verified || false);
        }

        if (limitsRes.data) {
          setUsageLimits(limitsRes.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVote = async (proposalId: number | string, vote: 'support' | 'oppose') => {
    // Seed proposals: local-only voting (no auth/API required)
    if (isSeedProposal(proposalId)) {
      setVotedProposals((prev) => new Set([...prev, proposalId as any]));
      setProposals((prev) =>
        prev.map((p) =>
          p.id === proposalId
            ? {
                ...p,
                supportVotes: vote === 'support' ? (p.supportVotes || 0) + 1 : p.supportVotes,
                opposeVotes: vote === 'oppose' ? (p.opposeVotes || 0) + 1 : p.opposeVotes,
              }
            : p
        )
      );
      setLastVoteType(vote);
      setShowVoteOverlay(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    // Real proposals: require authentication
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to vote.');
      return;
    }

    // Check if proposal has geo restrictions
    const proposal = proposals.find((p) => p.id === proposalId);
    const proposalGeo = proposal?.geoRestrictions || [];
    const hasGeoRestrictions = proposalGeo.length > 0;

    // Gate geo-restricted proposals for unverified users
    if (hasGeoRestrictions && !isVerified) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setVerificationModalType('vote');
      setShowVerificationModal(true);
      return;
    }

    // For verified users: check if their location matches proposal restrictions
    if (hasGeoRestrictions && isVerified) {
      const userLocation = [userCountry, userState, userCity].filter(Boolean);

      // Check hierarchical match: proposal geo must match user's location at each level
      // proposalGeo = ["Canada", "Alberta", "Calgary"] means only Calgary, AB, Canada can vote
      // proposalGeo = ["Canada", "Alberta"] means all of Alberta can vote
      // proposalGeo = ["Canada"] means all of Canada can vote
      const locationMatches = proposalGeo.every((restriction, index) => {
        const userLocationAtLevel = userLocation[index];
        return userLocationAtLevel && userLocationAtLevel.toLowerCase() === restriction.toLowerCase();
      });

      if (!locationMatches) {
        const locationDescription = proposalGeo.join(', ');
        Alert.alert(
          'Location Restricted',
          `This proposal is only for voters in ${locationDescription}. Your verified location does not match.`,
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setVotingProposalId(proposalId as number);
    try {
      // First claim the token if not already claimed
      if (!claimedTokens.has(proposalId as number)) {
        const claimResult = await proposalsApi.claimVoteToken(proposalId as number);
        if (claimResult.error) {
          Alert.alert('Error', claimResult.error);
          setVotingProposalId(null);
          return;
        }
        setClaimedTokens((prev) => new Set([...prev, proposalId]));
      }

      // Then submit the vote
      const result = await proposalsApi.submitVote(proposalId, vote);
      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      setVotedProposals((prev) => new Set([...prev, proposalId]));

      setProposals((prev) =>
        prev.map((p) =>
          (p.id as number) === proposalId
            ? {
                ...p,
                supportVotes: vote === 'support' ? (p.supportVotes || 0) + 1 : p.supportVotes,
                opposeVotes: vote === 'oppose' ? (p.opposeVotes || 0) + 1 : p.opposeVotes,
              }
            : p
        )
      );

      setSelectedProposal((sp) => {
        if (!sp) return sp;
        if ((sp.id as number) !== proposalId) return sp;
        return {
          ...sp,
          supportVotes: vote === 'support' ? (sp.supportVotes || 0) + 1 : sp.supportVotes,
          opposeVotes: vote === 'oppose' ? (sp.opposeVotes || 0) + 1 : sp.opposeVotes,
        };
      });

      // Get proposal title for notification
      const proposal = proposals.find((p) => p.id === proposalId);
      const proposalTitle = proposal?.title || 'Proposal';

      // Show vote confirmation notification
      showVoteConfirmation(proposalTitle, vote);

      // Show animated confirmation overlay
      setLastVoteType(vote);
      setShowVoteOverlay(true);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Check for newly earned badges (async, non-blocking)
      setTimeout(() => checkForNewBadges(), 1500);
    } catch {
      Alert.alert('Error', 'Failed to submit vote. Please try again.');
    } finally {
      setVotingProposalId(null);
    }
  };

  // Swipe vote handler
  const handleSwipeVote = useCallback(async (proposal: Proposal, vote: 'support' | 'oppose') => {
    // Get fresh tutorial state directly from store (not from stale closure)
    const { isActive, completeAction, currentStepIndex, steps } = useTutorialStore.getState();

    // Check if this is a tutorial action
    if (isActive) {
      // During tutorial, show vote confirmation overlay
      setLastVoteType(vote);
      setShowVoteOverlay(true);

      // Advance the card
      setSwipeIndex((prev) => prev + 1);

      // Complete the tutorial action after overlay animation (1.7s delay)
      // This gives user time to see the confirmation before moving to next step
      const action = vote === 'support' ? 'swipe-right' : 'swipe-left';
      setTimeout(() => {
        completeAction(action);
      }, 1700);
      return;
    }

    // Move to next card
    setSwipeIndex((prev) => prev + 1);

    // Submit the vote (blockchain transaction - cannot be undone)
    await handleVote(proposal.id as number, vote);
  }, [handleVote]);

  // Skip handler - move to next card without voting
  const handleSkip = useCallback(() => {
    setSwipeIndex((prev) => prev + 1);
  }, []);

  // Get current cards to display in stack (max 3)
  const visibleSwipeCards = useMemo(() => {
    return swipeableProposals.slice(swipeIndex, swipeIndex + 3);
  }, [swipeableProposals, swipeIndex]);

  const handleCreateProposal = async () => {
    if (!newProposal.title.trim()) {
      Alert.alert('Error', 'Please enter a proposal title.');
      return;
    }
    if (!newProposal.description.trim()) {
      Alert.alert('Error', 'Please enter a proposal description.');
      return;
    }

    // Check proposal limits (skip for premium users with unlimited)
    if (usageLimits && usageLimits.proposals.limit !== 'unlimited') {
      if (usageLimits.proposals.used >= usageLimits.proposals.limit) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setVerificationModalType('limit');
        setPendingLimitTier(usageLimits.tier === 'free' ? 'free' : 'verified');
        setShowCreateModal(false);
        setShowVerificationModal(true);
        return;
      }
    }

    // Require verification for geo-restricted proposals
    if (newProposal.geoScope !== 'global' && !isVerified) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setVerificationModalType('proposal');
      setShowCreateModal(false);
      setShowVerificationModal(true);
      return;
    }

    setCreating(true);
    try {
      // Build geo restrictions - empty for global, populated for geo-restricted
      const geoRestrictions: string[] = [];
      if (newProposal.geoScope !== 'global' && userCountry) {
        geoRestrictions.push(userCountry);
        if ((newProposal.geoScope === 'state' || newProposal.geoScope === 'city') && userState) {
          geoRestrictions.push(userState);
        }
        if (newProposal.geoScope === 'city' && userCity) {
          geoRestrictions.push(userCity);
        }
      }

      const demographicRestrictions: any = {};
      if (newProposal.ageGroup !== 'All Ages') demographicRestrictions.ageGroup = newProposal.ageGroup;
      if (newProposal.gender !== 'All Genders') demographicRestrictions.gender = newProposal.gender;

      let imageUrl: string | undefined;
      if (newProposal.imageUri) {
        const fileName = newProposal.imageUri.split('/').pop() || 'proposal-image.jpg';
        const uploadedUrl = await uploadsApi.uploadImage({
          uri: newProposal.imageUri,
          name: fileName,
          type: 'image/jpeg',
        });
        if (uploadedUrl) imageUrl = uploadedUrl;
      }

      const result = await proposalsApi.create({
        title: newProposal.title.trim(),
        description: newProposal.description.trim(),
        category: newProposal.category,
        geoRestrictions: geoRestrictions.length > 0 ? geoRestrictions : undefined,
        demographicRestrictions: Object.keys(demographicRestrictions).length > 0 ? demographicRestrictions : undefined,
        imageUrl,
      });

      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Your proposal has been created!');
      setShowCreateModal(false);
      setNewProposal({
        title: '',
        description: '',
        category: 'Other',
        country: userCountry,
        state: userState,
        city: userCity,
        geoScope: 'global',
        ageGroup: 'All Ages',
        gender: 'All Genders',
        imageUri: '',
      });
      fetchData(true);

      // Check for newly earned badges (async, non-blocking)
      setTimeout(() => checkForNewBadges(), 1500);
    } catch {
      Alert.alert('Error', 'Failed to create proposal. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSelectedGeoLevel('All');
    setSelectedFilterAge('All Ages');
    setSelectedFilterGender('All Genders');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedCategory !== 'All' ||
    selectedStatus !== 'All' ||
    selectedGeoLevel !== 'All' ||
    selectedFilterAge !== 'All Ages' ||
    selectedFilterGender !== 'All Genders';

  const openProposal = (p: Proposal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProposal(p);
    setShowDetailModal(true);
  };

  const closeProposal = () => {
    setShowDetailModal(false);
    setTimeout(() => setSelectedProposal(null), 150);
  };

  const detail = selectedProposal;
  const detailHasVoted = detail ? votedProposals.has(detail.id as number) : false;
  const detailIsVoting = detail ? votingProposalId === (detail.id as number) : false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Proposals</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
              {activeCount} active proposal{activeCount !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <ViewModeToggle
              mode={viewMode}
              onToggle={() => setViewMode((m) => (m === 'swipe' ? 'list' : 'swipe'))}
            />

            <TouchableOpacity
              style={[
                styles.filterBtn,
                {
                  backgroundColor: hasActiveFilters ? colors.gold : colors.surface,
                  borderColor: hasActiveFilters ? colors.gold : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFilters(!showFilters);
              }}
            >
              <Ionicons name="options-outline" size={18} color={hasActiveFilters ? '#000' : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCreateModal(true);
              }}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.createBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add" size={22} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search proposals..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* Filter Panel */}
      {showFilters && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {CATEGORIES.map((cat) => (
                  <FilterChip
                    key={cat}
                    label={cat}
                    selected={selectedCategory === cat}
                    onPress={() => setSelectedCategory(cat)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>STATUS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {STATUS_FILTERS.map((s) => (
                  <FilterChip key={s} label={s} selected={selectedStatus === s} onPress={() => setSelectedStatus(s)} />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>GEOGRAPHIC LEVEL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {GEO_LEVELS.map((g) => (
                  <FilterChip key={g} label={g} selected={selectedGeoLevel === g} onPress={() => setSelectedGeoLevel(g)} />
                ))}
              </View>
            </ScrollView>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <Ionicons name="close-circle" size={16} color={colors.error} />
              <Text style={[styles.clearBtnText, { color: colors.error }]}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Content */}
      {loading ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <ProposalSkeleton key={i} index={i} />
          ))}
        </ScrollView>
      ) : filteredProposals.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.gold} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No proposals found</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {hasActiveFilters ? 'Try adjusting your filters' : 'Be the first to create one!'}
          </Text>
          {!hasActiveFilters && (
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={styles.emptyBtn}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.emptyBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#000" />
                <Text style={styles.emptyBtnText}>Create Proposal</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : viewMode === 'swipe' ? (
        /* Swipe Mode */
        <GestureHandlerRootView style={styles.swipeContainer}>
          {visibleSwipeCards.length === 0 ? (
            <Animated.View entering={FadeIn.duration(400)} style={styles.swipeEmptyState}>
              <View style={[styles.swipeEmptyIcon, { backgroundColor: `${colors.success}15` }]}>
                <Ionicons name="checkmark-done-circle" size={64} color={colors.success} />
              </View>
              <Text style={[styles.swipeEmptyTitle, { color: colors.text }]}>All caught up!</Text>
              <Text style={[styles.swipeEmptyDesc, { color: colors.textSecondary }]}>
                You've voted on all available proposals.{'\n'}Check back later for new ones.
              </Text>
              <TouchableOpacity
                style={[styles.swipeRefreshBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  fetchData(true);
                }}
              >
                <Ionicons name="refresh-outline" size={20} color={colors.text} />
                <Text style={[styles.swipeRefreshText, { color: colors.text }]}>Refresh</Text>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <>
              {/* Progress indicator */}
              <View style={styles.swipeProgress}>
                <Text style={[styles.swipeProgressText, { color: colors.textTertiary }]}>
                  {swipeIndex + 1} of {swipeableProposals.length} proposals
                </Text>
                <View style={[styles.swipeProgressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.swipeProgressFill,
                      { backgroundColor: colors.gold, width: `${((swipeIndex + 1) / swipeableProposals.length) * 100}%` },
                    ]}
                  />
                </View>
              </View>

              {/* Card stack */}
              <View ref={swipeCardRef} style={styles.cardStack} collapsable={false}>
                {visibleSwipeCards.map((proposal, idx) => (
                  <SwipeCard
                    key={proposal.id}
                    proposal={proposal}
                    onSwipeLeft={() => handleSwipeVote(proposal, 'oppose')}
                    onSwipeRight={() => handleSwipeVote(proposal, 'support')}
                    onSwipeUp={handleSkip}
                    onTap={() => openProposal(proposal)}
                    isTopCard={idx === 0}
                    cardIndex={idx}
                  />
                )).reverse()}
              </View>

            </>
          )}
        </GestureHandlerRootView>
      ) : (
        /* List Mode */
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={colors.gold}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {filteredProposals.map((proposal, index) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              hasVoted={votedProposals.has(proposal.id as number)}
              onVote={handleVote}
              isVoting={votingProposalId === proposal.id}
              onPress={() => openProposal(proposal)}
              index={index}
              isUserVerified={isVerified}
              userCountry={userCountry}
              userState={userState}
              userCity={userCity}
            />
          ))}
          <View style={styles.listSpacer} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeProposal}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeProposal} style={styles.modalClose}>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: colors.text }]}>Proposal</Text>

            <TouchableOpacity
              onPress={() => {
                if (!detail) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                shareProposal({ id: detail.id as number, title: detail.title, description: detail.description });
              }}
              style={[styles.modalShare, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="share-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {detail && (
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <LinearGradient
                  colors={[`${colors.gold}08`, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />

                <View style={styles.detailHeaderRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: `${colors.gold}15` }]}>
                    <Text style={[styles.categoryText, { color: colors.gold }]}>{detail.category || 'General'}</Text>
                  </View>

                  {detail.deadline && (
                    <View
                      style={[
                        styles.timeBadge,
                        { backgroundColor: isProposalEnded(detail) ? `${colors.error}15` : `${colors.gold}15` },
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={isProposalEnded(detail) ? colors.error : colors.gold}
                      />
                      <Text
                        style={[styles.timeText, { color: isProposalEnded(detail) ? colors.error : colors.gold }]}
                      >
                        {getTimeRemaining(detail.deadline)}
                      </Text>
                    </View>
                  )}
                </View>

                {(detail.geoRestrictions || []).length > 0 && (
                  <View style={[styles.geoTags, { marginTop: SPACING.sm }]}>
                    {(detail.geoRestrictions || []).slice(0, 6).map((tag, i) => (
                      <View key={i} style={[styles.geoTag, { backgroundColor: `${colors.info}12` }]}>
                        <Ionicons name="location-outline" size={10} color={colors.info} />
                        <Text style={[styles.geoTagText, { color: colors.info }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.detailTitle, { color: colors.text }]}>{detail.title}</Text>
                <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>{detail.description}</Text>

                {detail.imageUrl && (
                  <View style={[styles.imageWrapper, { marginTop: SPACING.lg }]}>
                    <Image source={{ uri: detail.imageUrl }} style={styles.proposalImage} resizeMode="cover" />
                  </View>
                )}

                {/* Vote Progress */}
                <View style={[styles.voteSection, { marginTop: SPACING.xl }]}>
                  {(() => {
                    const total = (detail.supportVotes || 0) + (detail.opposeVotes || 0);
                    const pct = total > 0 ? Math.round(((detail.supportVotes || 0) / total) * 100) : 50;
                    return (
                      <>
                        <View style={[styles.voteBarBg, { backgroundColor: colors.error }]}>
                          <Animated.View style={[styles.voteBarFill, { width: `${pct}%`, backgroundColor: colors.success }]} />
                        </View>
                        <View style={styles.voteStats}>
                          <View style={styles.voteStat}>
                            <View style={[styles.voteIconBg, { backgroundColor: `${colors.success}15` }]}>
                              <Ionicons name="thumbs-up" size={12} color={colors.success} />
                            </View>
                            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
                              {(detail.supportVotes || 0).toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.voteStat}>
                            <View style={[styles.voteIconBg, { backgroundColor: `${colors.error}15` }]}>
                              <Ionicons name="thumbs-down" size={12} color={colors.error} />
                            </View>
                            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
                              {(detail.opposeVotes || 0).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Actions */}
                <View style={{ marginTop: SPACING.xl }}>
                  {isProposalEnded(detail) ? (
                    <View style={[styles.statusBanner, { backgroundColor: `${colors.error}10` }]}>
                      <Ionicons name="flag-outline" size={16} color={colors.error} />
                      <Text style={[styles.statusText, { color: colors.error }]}>Voting has ended</Text>
                    </View>
                  ) : detailHasVoted ? (
                    <View style={[styles.statusBanner, { backgroundColor: `${colors.success}10` }]}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={[styles.statusText, { color: colors.success }]}>You have voted</Text>
                    </View>
                  ) : (
                    <View style={styles.voteActions}>
                      <TouchableOpacity
                        style={[styles.voteBtn, { backgroundColor: colors.success }, detailIsVoting && styles.btnDisabled]}
                        onPress={() => detail && handleVote(detail.id as number, 'support')}
                        disabled={detailIsVoting}
                        activeOpacity={0.85}
                      >
                        {detailIsVoting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={styles.voteBtnText}>Support</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.voteBtn, { backgroundColor: colors.error }, detailIsVoting && styles.btnDisabled]}
                        onPress={() => detail && handleVote(detail.id as number, 'oppose')}
                        disabled={detailIsVoting}
                        activeOpacity={0.85}
                      >
                        {detailIsVoting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="close-circle" size={16} color="#fff" />
                            <Text style={styles.voteBtnText}>Oppose</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: colors.text }]}>New Proposal</Text>

            <TouchableOpacity
              onPress={handleCreateProposal}
              disabled={creating}
              style={[creating && styles.btnDisabled]}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.submitBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>Create</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Usage Limits Display */}
            {usageLimits && (
              <View style={[styles.limitsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="analytics-outline" size={18} color={colors.gold} />
                <View style={styles.limitsContent}>
                  {usageLimits.proposals.limit === 'unlimited' ? (
                    <Text style={[styles.limitsText, { color: colors.gold }]}>
                      Unlimited proposals (Premium)
                    </Text>
                  ) : (
                    <>
                      <Text style={[styles.limitsText, { color: colors.textSecondary }]}>
                        {usageLimits.proposals.used} of {usageLimits.proposals.limit} proposals this {usageLimits.proposals.period}
                      </Text>
                      <View style={[styles.limitsProgressBg, { backgroundColor: `${colors.gold}20` }]}>
                        <View
                          style={[
                            styles.limitsProgressFill,
                            {
                              backgroundColor: colors.gold,
                              width: `${Math.min(100, (usageLimits.proposals.used / (usageLimits.proposals.limit as number)) * 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </>
                  )}
                </View>
                {usageLimits.tier !== 'premium' && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowCreateModal(false);
                      router.push('/modals/subscription');
                    }}
                    style={[styles.upgradeChip, { backgroundColor: `${colors.gold}15` }]}
                  >
                    <Text style={[styles.upgradeChipText, { color: colors.gold }]}>Upgrade</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Title</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter proposal title..."
                placeholderTextColor={colors.textTertiary}
                value={newProposal.title}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, title: t }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Description</Text>
              <TextInput
                style={[
                  styles.formInput,
                  styles.formTextArea,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Describe your proposal..."
                placeholderTextColor={colors.textTertiary}
                value={newProposal.description}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, description: t }))}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Image (Optional)</Text>
              <TouchableOpacity
                style={[styles.imagePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
              >
                {newProposal.imageUri ? (
                  <Image source={{ uri: newProposal.imageUri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePickerContent}>
                    <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
                    <Text style={[styles.imagePickerText, { color: colors.textTertiary }]}>Tap to add image</Text>
                  </View>
                )}
              </TouchableOpacity>

              {newProposal.imageUri && (
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setNewProposal((p) => ({ ...p, imageUri: '' }))}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[styles.removeImageText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <FilterChip
                      key={cat}
                      label={cat}
                      selected={newProposal.category === cat}
                      onPress={() => setNewProposal((p) => ({ ...p, category: cat }))}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.formDivider, { borderTopColor: colors.border }]}>
              <View style={[styles.formDividerIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="location-outline" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.formDividerLabel, { color: colors.gold }]}>Geographic Scope</Text>
            </View>

            {/* Global scope - available to all users */}
            <View style={styles.scopeGrid}>
              <TouchableOpacity
                style={[
                  styles.scopeCard,
                  {
                    backgroundColor: newProposal.geoScope === 'global' ? `${colors.gold}15` : colors.surface,
                    borderColor: newProposal.geoScope === 'global' ? colors.gold : colors.border,
                  },
                ]}
                onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'global' }))}
              >
                <Ionicons
                  name="earth-outline"
                  size={24}
                  color={newProposal.geoScope === 'global' ? colors.gold : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.scopeTitle,
                    { color: newProposal.geoScope === 'global' ? colors.gold : colors.text },
                  ]}
                >
                  Global
                </Text>
                <Text style={[styles.scopeDesc, { color: colors.textTertiary }]}>Anyone can vote</Text>
              </TouchableOpacity>

            {userCountry ? (
              <>
                {/* Geo-restricted options for verified users */}
                <TouchableOpacity
                  style={[
                    styles.scopeCard,
                    {
                      backgroundColor: newProposal.geoScope === 'national' ? `${colors.gold}15` : colors.surface,
                      borderColor: newProposal.geoScope === 'national' ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'national' }))}
                >
                  <Ionicons
                    name="globe-outline"
                    size={24}
                    color={newProposal.geoScope === 'national' ? colors.gold : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.scopeTitle,
                      { color: newProposal.geoScope === 'national' ? colors.gold : colors.text },
                    ]}
                  >
                    National
                  </Text>
                  <Text style={[styles.scopeDesc, { color: colors.textTertiary }]}>All of {userCountry}</Text>
                </TouchableOpacity>

                  {userState && (
                    <TouchableOpacity
                      style={[
                        styles.scopeCard,
                        {
                          backgroundColor: newProposal.geoScope === 'state' ? `${colors.gold}15` : colors.surface,
                          borderColor: newProposal.geoScope === 'state' ? colors.gold : colors.border,
                        },
                      ]}
                      onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'state' }))}
                    >
                      <Ionicons
                        name="map-outline"
                        size={24}
                        color={newProposal.geoScope === 'state' ? colors.gold : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.scopeTitle,
                          { color: newProposal.geoScope === 'state' ? colors.gold : colors.text },
                        ]}
                      >
                        State
                      </Text>
                      <Text style={[styles.scopeDesc, { color: colors.textTertiary }]}>{userState} only</Text>
                    </TouchableOpacity>
                  )}

                  {userCity && (
                    <TouchableOpacity
                      style={[
                        styles.scopeCard,
                        {
                          backgroundColor: newProposal.geoScope === 'city' ? `${colors.gold}15` : colors.surface,
                          borderColor: newProposal.geoScope === 'city' ? colors.gold : colors.border,
                        },
                      ]}
                      onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'city' }))}
                    >
                      <Ionicons
                        name="business-outline"
                        size={24}
                        color={newProposal.geoScope === 'city' ? colors.gold : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.scopeTitle,
                          { color: newProposal.geoScope === 'city' ? colors.gold : colors.text },
                        ]}
                      >
                        City
                      </Text>
                      <Text style={[styles.scopeDesc, { color: colors.textTertiary }]}>{userCity} only</Text>
                    </TouchableOpacity>
                  )}
              </>
            ) : (
              /* Unverified users only see Global option with upgrade prompt */
              <View style={[styles.infoBanner, { backgroundColor: `${colors.info}10`, borderColor: `${colors.info}25` }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.info} />
                <View style={styles.warningContent}>
                  <Text style={[styles.infoTitle, { color: colors.info }]}>Global Proposals Only</Text>
                  <Text style={[styles.warningDesc, { color: colors.textSecondary }]}>
                    Verify your identity ($4.99) to create proposals for your specific region.
                  </Text>
                </View>
              </View>
            )}
            </View>

            <View style={[styles.formDivider, { borderTopColor: colors.border }]}>
              <View style={[styles.formDividerIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="people-outline" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.formDividerLabel, { color: colors.gold }]}>Demographics (Optional)</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formSubLabel, { color: colors.textSecondary }]}>Age Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {AGE_GROUPS.map((age) => (
                    <FilterChip
                      key={age}
                      label={age}
                      selected={newProposal.ageGroup === age}
                      onPress={() => setNewProposal((p) => ({ ...p, ageGroup: age }))}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formSubLabel, { color: colors.textSecondary }]}>Gender</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {GENDERS.map((g) => (
                    <FilterChip
                      key={g}
                      label={g}
                      selected={newProposal.gender === g}
                      onPress={() => setNewProposal((p) => ({ ...p, gender: g }))}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vote Confirmation Overlay */}
      <VoteConfirmationOverlay
        visible={showVoteOverlay}
        voteType={lastVoteType}
        onDismiss={() => setShowVoteOverlay(false)}
      />

      {/* Verification/Upgrade Modal */}
      <UpgradeModal
        visible={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        type={verificationModalType === 'limit' && pendingLimitTier === 'verified' ? 'premium' : 'verification'}
        title={
          verificationModalType === 'vote'
            ? 'Verification Required'
            : verificationModalType === 'proposal'
            ? 'Verification Required'
            : 'Proposal Limit Reached'
        }
        message={
          verificationModalType === 'vote'
            ? 'This proposal is restricted to verified users in specific regions. Complete identity verification to vote on geo-restricted proposals.'
            : verificationModalType === 'proposal'
            ? 'You must verify your identity to create geo-restricted proposals. Global proposals are available to all users.'
            : pendingLimitTier === 'free'
            ? "You've reached your monthly proposal limit. Get verified to create more proposals each week."
            : "You've reached your weekly proposal limit. Upgrade to Premium for unlimited proposals."
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: { ...TYPOGRAPHY.displaySmall },
  headerSubtitle: { ...TYPOGRAPHY.labelMedium, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: { flex: 1, ...TYPOGRAPHY.bodyMedium, paddingVertical: SPACING.xs },

  // Filter Panel
  filterPanel: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
  },
  filterSection: { marginBottom: SPACING.md },
  filterLabel: { ...TYPOGRAPHY.labelSmall, letterSpacing: 1, marginBottom: SPACING.sm },
  filterRow: { flexDirection: 'row', gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterChipText: { ...TYPOGRAPHY.labelSmall, fontWeight: '500' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  clearBtnText: { ...TYPOGRAPHY.labelMedium },

  // List
  list: { flex: 1 },
  listContent: { padding: SPACING.lg, gap: SPACING.md },
  listSpacer: { height: 100 },

  // Card
  card: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shimmerBar: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  categoryBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: { ...TYPOGRAPHY.labelSmall, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  timeText: { ...TYPOGRAPHY.labelSmall, fontWeight: '500' },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  geoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  geoTagText: { ...TYPOGRAPHY.labelSmall, fontSize: 10 },
  restrictionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
  },
  restrictionText: { ...TYPOGRAPHY.labelSmall, fontSize: 11 },
  cardTitle: { ...TYPOGRAPHY.headlineSmall, marginBottom: SPACING.sm },
  cardDesc: { ...TYPOGRAPHY.bodyMedium, lineHeight: 22, marginBottom: SPACING.lg },

  imageWrapper: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  proposalImage: { width: '100%', height: 180 },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Vote Section
  voteSection: { marginBottom: SPACING.lg },
  voteBarBg: {
    height: 8,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  voteBarFill: { height: '100%', borderRadius: BORDER_RADIUS.full },
  voteStats: { flexDirection: 'row', justifyContent: 'space-between' },
  voteStat: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  voteIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCount: { ...TYPOGRAPHY.labelMedium },

  // Actions
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
  },
  statusText: { ...TYPOGRAPHY.labelMedium, fontWeight: '500' },
  voteActions: { flexDirection: 'row', gap: SPACING.md },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.xs,
  },
  voteBtnText: { color: '#fff', ...TYPOGRAPHY.labelMedium, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  // Skeleton
  skeletonBadge: { width: 80, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonSmall: { width: 60, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonTitle: { height: 24, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.sm },
  skeletonLine: { height: 16, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.xs },
  skeletonBtn: { height: 48, borderRadius: BORDER_RADIUS.xl, marginTop: SPACING.md },

  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxxl },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  emptyTitle: { ...TYPOGRAPHY.headlineSmall, marginBottom: SPACING.xs },
  emptyDesc: { ...TYPOGRAPHY.bodyMedium, textAlign: 'center', marginBottom: SPACING.xl },
  emptyBtn: { overflow: 'hidden', borderRadius: BORDER_RADIUS.full },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  emptyBtnText: { color: '#000', ...TYPOGRAPHY.labelLarge, fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  modalClose: { padding: SPACING.xs },
  modalTitle: { ...TYPOGRAPHY.headlineSmall },
  modalShare: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalContent: { padding: SPACING.lg },

  // Detail Card
  detailCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { ...TYPOGRAPHY.headlineLarge, marginTop: SPACING.lg },
  detailDesc: { ...TYPOGRAPHY.bodyLarge, marginTop: SPACING.md, lineHeight: 26 },

  // Create Form
  submitBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 80,
    alignItems: 'center',
  },
  submitBtnText: { color: '#000', ...TYPOGRAPHY.labelMedium, fontWeight: '600' },
  formScroll: { flex: 1, padding: SPACING.lg },
  formSection: { marginBottom: SPACING.lg },
  formLabel: { ...TYPOGRAPHY.labelMedium, marginBottom: SPACING.sm },
  formSubLabel: { ...TYPOGRAPHY.labelSmall, marginBottom: SPACING.sm },
  formInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.bodyMedium,
  },
  formTextArea: { minHeight: 140, paddingTop: SPACING.md },
  imagePicker: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderStyle: 'dashed',
  },
  imagePreview: { width: '100%', height: 180 },
  imagePickerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl },
  imagePickerText: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.sm },
  removeImageBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  removeImageText: { ...TYPOGRAPHY.labelMedium },

  formDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    paddingTop: SPACING.xl,
    borderTopWidth: 1,
  },
  formDividerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  formDividerLabel: { ...TYPOGRAPHY.headlineSmall, fontSize: 16 },
  formHelper: { ...TYPOGRAPHY.bodySmall, marginBottom: SPACING.md },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  locationText: { ...TYPOGRAPHY.bodyMedium, fontWeight: '500' },
  scopeGrid: { gap: SPACING.md },
  scopeCard: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
  },
  scopeTitle: { ...TYPOGRAPHY.labelLarge, marginTop: SPACING.sm },
  scopeDesc: { ...TYPOGRAPHY.bodySmall, marginTop: 2 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  infoTitle: { ...TYPOGRAPHY.labelMedium, marginBottom: SPACING.xxs },
  warningContent: { flex: 1 },
  warningTitle: { ...TYPOGRAPHY.labelMedium, marginBottom: SPACING.xxs },
  warningDesc: { ...TYPOGRAPHY.bodySmall, lineHeight: 20 },

  // Limits Display
  limitsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  limitsContent: {
    flex: 1,
  },
  limitsText: {
    ...TYPOGRAPHY.bodySmall,
    marginBottom: SPACING.xs,
  },
  limitsProgressBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  limitsProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  upgradeChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  upgradeChipText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },

  // View Mode Toggle
  viewModeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },

  // Swipe Container
  swipeContainer: {
    flex: 1,
    paddingTop: SPACING.md,
  },
  swipeProgress: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  swipeProgressText: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  swipeProgressBar: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  swipeProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Card Stack
  cardStack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: SPACING.lg,
  },

  // Swipe Card
  swipeCard: {
    position: 'absolute',
    width: SCREEN_WIDTH - SPACING.lg * 2,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  swipeCardContent: {
    padding: SPACING.xl,
  },
  swipeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  swipeCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  swipeCategoryText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swipeTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  swipeTimeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '500',
  },
  swipeGeoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  swipeGeoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  swipeGeoTagText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 10,
  },
  swipeCardTitle: {
    ...TYPOGRAPHY.headlineMedium,
    marginBottom: SPACING.sm,
  },
  swipeCardDesc: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  swipeImageWrapper: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  swipeImage: {
    width: '100%',
    height: 160,
  },
  swipeVoteSection: {
    marginBottom: SPACING.lg,
  },
  swipeVoteBarBg: {
    height: 10,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  swipeVoteBarFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  swipeVoteStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swipeVoteStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  swipeVoteCount: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  swipeVotePercent: {
    ...TYPOGRAPHY.labelSmall,
  },
  swipeEndedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
  },
  swipeEndedText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },
  swipeInstructions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  swipeInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  swipeInstructionText: {
    ...TYPOGRAPHY.labelSmall,
  },
  swipeTapHint: {
    ...TYPOGRAPHY.labelSmall,
    fontStyle: 'italic',
  },

  // Swipe Indicators
  swipeIndicator: {
    position: 'absolute',
    top: SPACING.xl,
    zIndex: 10,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  swipeIndicatorLeft: {
    right: SPACING.xl,
  },
  swipeIndicatorRight: {
    left: SPACING.xl,
  },
  swipeIndicatorTop: {
    top: SPACING.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  swipeIndicatorGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  swipeIndicatorText: {
    color: '#fff',
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Swipe Empty State
  swipeEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxxl,
  },
  swipeEmptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  swipeEmptyTitle: {
    ...TYPOGRAPHY.headlineMedium,
    marginBottom: SPACING.sm,
  },
  swipeEmptyDesc: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  swipeRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  swipeRefreshText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },

  // Full-Screen Swipe Card Styles
  swipeCardImageContainer: {
    width: '100%',
    height: '55%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeCardImage: {
    width: '100%',
    height: '100%',
  },
  swipeCardImageOverlayTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  swipeCardImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
  },
  swipeCardContentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  swipeCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  swipeCategoryBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  swipeCategoryTextLight: {
    color: '#fff',
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swipeTimeBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  swipeTimeTextLight: {
    color: '#fff',
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '500',
  },
  swipeGeoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  swipeGeoText: {
    color: '#fff',
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '500',
  },
  swipeGeoBadgeTopLeft: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    zIndex: 5,
  },
  swipeCardTitleLarge: {
    color: '#fff',
    ...TYPOGRAPHY.headlineMedium,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  swipeCardDescLarge: {
    color: 'rgba(255,255,255,0.9)',
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 22,
    marginBottom: SPACING.lg,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  swipeVoteSectionLarge: {
    marginBottom: SPACING.md,
  },
  swipeVoteBarBgLarge: {
    height: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    marginBottom: SPACING.sm,
    flexDirection: 'row',
  },
  swipeVoteBarFillLarge: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  swipeVoteBarOpposeSection: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  swipeVoteStatsLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swipeVoteStatLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  swipeVoteCountLarge: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  swipeVotePercentLarge: {
    color: '#fff',
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '500',
  },
  swipeEndedBannerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
  },
  swipeEndedTextLarge: {
    color: '#fff',
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },
  swipeInstructionsLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  swipeInstructionLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  swipeInstructionTextLarge: {
    color: 'rgba(255,255,255,0.8)',
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '500',
  },
  swipeTapHintLarge: {
    color: 'rgba(255,255,255,0.6)',
    ...TYPOGRAPHY.labelSmall,
    fontStyle: 'italic',
  },

  // Creator Info
  swipeCreatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  swipeCreatorText: {
    color: 'rgba(255,255,255,0.6)',
    ...TYPOGRAPHY.labelSmall,
  },

  // Full-Screen Swipe Indicators
  swipeIndicatorFullScreen: {
    position: 'absolute',
    top: '25%',
    zIndex: 10,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  swipeIndicatorCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  swipeIndicatorTextLarge: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
