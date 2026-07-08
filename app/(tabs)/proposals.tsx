import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
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
import { router, useLocalSearchParams } from 'expo-router';
import { proposalsApi, userApi, uploadsApi, limitsApi, Proposal, UsageLimits } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { shareProposal, shareVoteAchievement } from '../../lib/share';
import { useTheme, FONTS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION, responsive } from '../../lib/theme';
import { getTierLabel, getLocationLabel, canUserVoteOnProposal, meetsCitizenshipRequirement } from '../../lib/proposalGeo';
import { useModerationStore, useSyncMutes } from '../../lib/moderation';
import { ProposalModerationMenu } from '../../components/moderation/ProposalModerationMenu';
import { CommentsSection } from '../../components/comments/CommentsSection';

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM DESIGN CONSTANTS - Institutional gold-on-black (static fallbacks)
// ═══════════════════════════════════════════════════════════════════════════════
const GOLD = '#EABA58';
const GOLD_DARK = '#C89A3E';
const GOLD_LIGHT = '#F4D28C';
const BG = '#040707';
const BG_CARD = '#0D0F12';
const BG_RAISED = '#15181C';
const LINE_COLOR = '#1E2228';
const LINE_STRONG = '#2A2F37';
const FG = '#F4F5F6';
const FG_MUTED = '#C7CACD';
const FG_FAINT = '#8E9297';
const GREEN = '#34C759';
const RED = '#FF6B6B';
const BLUE = '#5B8FF9';
const SERIF_FONT = FONTS.serif;
const MONO_FONT = FONTS.mono;

// Dynamic hook for components to get theme-aware colors
function useProposalColors() {
  const { colors, isDark } = useTheme();
  return {
    GOLD: colors.gold,
    GOLD_DARK: colors.goldDark,
    GOLD_LIGHT: colors.goldLight,
    BG: colors.background,
    BG_CARD: colors.surface,
    BG_RAISED: colors.surfaceElevated,
    LINE: colors.border,
    LINE_STRONG: colors.borderStrong,
    FG: colors.text,
    FG_MUTED: colors.textSecondary,
    FG_FAINT: colors.textTertiary,
    GREEN: colors.success,
    RED: colors.error,
    SUPPORT: colors.support,
    OPPOSE: colors.oppose,
    BLUE: '#5B8FF9',
    isDark,
  };
}
import { showVoteConfirmation } from '../../lib/notifications';
import { VoteConfirmationOverlay, UpgradeModal, BallotDisplay, TallyBar, TrustChip, HowVotingWorksSheet } from '../../components/ui';
import { checkForNewBadges } from '../../lib/badgeNotification';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SWIPE_HINT_KEY = '@represent_swipe_hint_shown';

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


const SWIPE_THRESHOLD = 120;



// Generate dossier ref code from proposal
function getDossierRef(proposal: Proposal): string {
  const tier = getTierLabel(proposal.geoRestrictions);
  const prefix = tier === 'FEDERAL' ? 'FED' : tier === 'PROVINCIAL' ? 'PROV' : 'MUN';
  const idNum = String(proposal.id).match(/\d+/g)?.join('') || '0000';
  return `${prefix}-${idNum.slice(-4).padStart(4, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// M2 · VOTE QUEUE HEADER — filter rail, mono queue counter, 4px gold progress
// ═══════════════════════════════════════════════════════════════════════════════
function VoteHeader({
  index,
  total,
  activeCount,
  closingSoon,
  selectedFilter,
  onFilterChange,
  insetTop,
  onCreate,
  onToggleView,
  onHowVotingWorks,
}: {
  index: number;
  total: number;
  activeCount: number;
  closingSoon: number;
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
  insetTop: number;
  onCreate: () => void;
  onToggleView: () => void;
  onHowVotingWorks?: () => void;
}) {
  const { colors } = useTheme();
  const filters = ['All', 'Federal', 'Provincial', 'Municipal', 'Closing'];
  const reviewed = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;

  return (
    <View style={{ paddingTop: insetTop + 8, backgroundColor: colors.background }}>
      {/* Filter rail + queue actions (list toggle / create kept from the old header) */}
      <View style={voteHeaderStyles.railRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={voteHeaderStyles.filterRail}
          style={{ flex: 1 }}
        >
          {filters.map((label) => {
            const isActive = selectedFilter === label;
            return (
              <TouchableOpacity
                key={label}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onFilterChange(label);
                }}
                style={[
                  voteHeaderStyles.filterChip,
                  isActive
                    ? { backgroundColor: colors.goldFill }
                    : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    isActive ? voteHeaderStyles.filterChipTextActive : voteHeaderStyles.filterChipText,
                    { color: isActive ? '#040707' : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={voteHeaderStyles.actionsRow}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleView();
            }}
            style={[voteHeaderStyles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            accessibilityLabel="Switch to list view"
          >
            <Ionicons name="list-outline" size={17} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onCreate();
            }}
            style={[voteHeaderStyles.actionBtn, { backgroundColor: colors.goldFill, borderColor: 'transparent' }]}
            accessibilityLabel="Create proposal"
          >
            <Ionicons name="add" size={20} color="#040707" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Queue progress — everything counted is mono + tabular. Hidden when
          the queue is empty (E1 queue-clear state owns that layout). */}
      {total > 0 && (
        <View style={voteHeaderStyles.progressSection}>
          <View style={voteHeaderStyles.progressRow}>
            <Text style={[voteHeaderStyles.counterNum, { color: colors.text }]}>
              {String(Math.min(index + 1, total)).padStart(2, '0')} / {String(total).padStart(2, '0')} IN QUEUE
            </Text>
            <View style={voteHeaderStyles.progressRight}>
              <Text style={[voteHeaderStyles.percentText, { color: colors.textTertiary }]}>
                {reviewed}% REVIEWED
              </Text>
              {onHowVotingWorks && (
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onHowVotingWorks();
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="How voting works"
                >
                  <Ionicons name="information-circle-outline" size={15} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={[voteHeaderStyles.progressBar, { backgroundColor: colors.surfaceHighlight }]}>
            <View
              style={[
                voteHeaderStyles.progressFill,
                { backgroundColor: colors.goldFill, width: `${reviewed}%` },
              ]}
            />
          </View>
          {(activeCount > 0 || closingSoon > 0) && (
            <Text style={[voteHeaderStyles.metaText, { color: colors.textTertiary }]}>
              {activeCount} OPEN{closingSoon > 0 ? ` · ${closingSoon} CLOSING SOON` : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const voteHeaderStyles = StyleSheet.create({
  railRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 6,
    paddingBottom: 14,
    gap: 8,
  },
  filterRail: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 100,
  },
  filterChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
  },
  filterChipTextActive: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSection: {
    paddingHorizontal: 24,
    paddingBottom: 14,
    gap: 7,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  counterNum: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
  },
  progressRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  percentText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.84,
    fontVariant: ['tabular-nums'],
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  metaText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
});

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
          backgroundColor: selected ? colors.text : colors.surface,
          borderColor: selected ? colors.text : colors.border,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      activeOpacity={1}
    >
      <Text style={[styles.filterChipText, { color: selected ? colors.background : colors.textSecondary }]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

// ── M2 · QUEUE PROPOSAL CARD ────────────────────────────────────────────────
// Scope chips · serif question · description · captioned attachment ·
// proposer · TallyBar with ledger line. M2 is button-driven: the tinted
// Support/Oppose buttons below the stack are the only way to cast, and
// tapping the card opens the full proposal detail.
interface SwipeCardProps {
  proposal: Proposal;
  onTap: () => void;
  isTopCard: boolean;
  cardIndex: number;
  cardHeight: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Space reserved for the header, vote buttons, skip control and tab bar.
const BASE_CARD_HEIGHT_OFFSET = 420;

function SwipeCard({ proposal, onTap, isTopCard, cardIndex, cardHeight }: SwipeCardProps) {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(isTopCard ? 1 : 0.95 - cardIndex * 0.02);

  // Ref avoids stale callback issues in the gesture worklet
  const onTapRef = useRef(onTap);

  useEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);

  const category = proposal.category || 'General';
  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isEnded = timeRemaining === 'Ended';

  useEffect(() => {
    scale.value = withSpring(isTopCard ? 1 : 0.95 - cardIndex * 0.02, { damping: 15 });
  }, [isTopCard, cardIndex]);

  // Wrapper uses the ref — prevents stale closure in the worklet
  const handleTap = useCallback(() => {
    onTapRef.current();
  }, []);

  // M2 is button-driven: the tinted Support/Oppose buttons and Skip below
  // the card are the only way to act. Swipe-to-vote is gone — tapping the
  // card opens the full proposal detail.
  const composedGesture = Gesture.Tap()
    .enabled(isTopCard)
    .onEnd(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      runOnJS(handleTap)();
    });

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

  const tierLabel = getTierLabel(proposal.geoRestrictions);
  const location = getLocationLabel(proposal.geoRestrictions);
  const scopeLabel = tierLabel === 'GLOBAL' ? 'GLOBAL' : `${location} · ${tierLabel}`;
  const voteType = (proposal as any).voteType || 'yes-no';
  const optionCount = ((proposal as any).options || []).length;
  const totalBallots = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const creatorName = proposal.creatorName || 'Community Member';

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          premiumCardStyles.card,
          { height: cardHeight, backgroundColor: colors.surface, borderColor: colors.border },
          cardStyle,
        ]}
      >
        {/* Scope chips + time left */}
        <View style={premiumCardStyles.chipRow}>
          <View style={premiumCardStyles.chipGroup}>
            {proposal.source === 'civic-desk' ? (
              <TrustChip label="CIVIC DESK" variant="gold" />
            ) : null}
            <TrustChip label={scopeLabel} variant="neutral" />
            <TrustChip label={category} variant="outline" />
            {proposal.requiresCitizenship && (
              <TrustChip label="CITIZENS ONLY" variant="outline" icon="shield-outline" />
            )}
          </View>
          {timeRemaining ? (
            <Text style={[premiumCardStyles.timeText, { color: isEnded ? colors.oppose : colors.textTertiary }]}>
              {timeRemaining.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* Serif ballot question */}
        <Text style={[premiumCardStyles.serifTitle, { color: colors.text }]} numberOfLines={3}>
          {proposal.title}
        </Text>

        {/* Description */}
        <Text style={[premiumCardStyles.description, { color: colors.textSecondary }]} numberOfLines={4}>
          {proposal.description}
        </Text>

        {/* Attachment — captioned document, not decoration */}
        {proposal.imageUrl ? (
          <View style={premiumCardStyles.attachmentBlock}>
            <ExpoImage
              source={{ uri: proposal.imageUrl }}
              style={[premiumCardStyles.attachmentImage, { borderColor: colors.borderSubtle }]}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
            <View style={premiumCardStyles.attachmentCaptionRow}>
              <Ionicons name="document-attach-outline" size={11} color={colors.textTertiary} />
              <Text style={[premiumCardStyles.attachmentCaption, { color: colors.textTertiary }]}>
                ATTACHMENT · FILED WITH THIS PROPOSAL
              </Text>
            </View>
          </View>
        ) : null}

        {/* Proposer */}
        <View style={premiumCardStyles.proposerRow}>
          <View
            style={[
              premiumCardStyles.proposerAvatar,
              { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.25)' },
            ]}
          >
            <Text style={[premiumCardStyles.proposerInitial, { color: colors.gold }]}>
              {creatorName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[premiumCardStyles.proposerText, { color: colors.textTertiary }]}>
            Proposed by <Text style={{ color: colors.textSecondary }}>{creatorName}</Text>
          </Text>
        </View>

        {/* Tally — compact treatment per the 25-ballot threshold rules */}
        <View style={premiumCardStyles.tallySection}>
          {voteType !== 'yes-no' ? (
            <View style={premiumCardStyles.optionsRow}>
              <Text style={[premiumCardStyles.optionsText, { color: colors.textSecondary }]}>
                {optionCount || 2} OPTIONS · {voteType === 'ranked-choice' ? 'RANK YOUR CHOICES' : 'PICK ONE'}
              </Text>
              <Text style={[premiumCardStyles.optionsText, { color: colors.textTertiary }]}>
                {totalBallots.toLocaleString('en-CA')} VERIFIED BALLOTS
              </Text>
            </View>
          ) : (
            <TallyBar
              supportCount={proposal.supportVotes || 0}
              opposeCount={proposal.opposeVotes || 0}
              variant="full"
              applyThreshold={!isEnded}
            />
          )}
          <Text style={[premiumCardStyles.ledgerLine, { color: colors.textTertiary }]}>
            ON THE PUBLIC LEDGER · ONE PERSON, ONE BALLOT
          </Text>
        </View>

        {/* Ended Banner — failure/closure must look like what it is */}
        {isEnded && (
          <View style={[premiumCardStyles.endedBanner, { backgroundColor: colors.opposeSurface }]}>
            <Ionicons name="flag-outline" size={13} color={colors.oppose} />
            <Text style={[premiumCardStyles.endedText, { color: colors.oppose }]}>VOTING CLOSED</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// M2 queue card styles
const premiumCardStyles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 0,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
    gap: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 48,
    elevation: 20,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chipGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  serifTitle: {
    fontFamily: FONTS.serif,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.18,
  },
  description: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  attachmentBlock: {
    gap: 6,
  },
  attachmentImage: {
    width: '100%',
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
  },
  attachmentCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  attachmentCaption: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 0.85,
    fontVariant: ['tabular-nums'],
  },
  proposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  proposerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposerInitial: {
    fontFamily: FONTS.serif,
    fontSize: 10,
  },
  proposerText: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
  },
  tallySection: {
    marginTop: 'auto',
    gap: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  optionsText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  ledgerLine: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 0.95,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  swipeVeil: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  swipeVeilTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 5,
  },
  swipeStamp: {
    position: 'absolute',
    top: 32,
    left: 24,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.3)',
    transform: [{ rotate: '-8deg' }],
  },
  swipeStampText: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    letterSpacing: 3,
  },
  endedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  endedText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.32,
  },
});

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

// 05 · FEED PROPOSAL CARD — scope chips, serif question, compact tally
interface ProposalCardProps {
  proposal: Proposal;
  hasVoted: boolean;
  onVote: (id: number, vote: 'support' | 'oppose') => Promise<void>;
  isVoting: boolean;
  onPress: () => void;
  index: number;
  isUserVerified: boolean;
  isUserCitizen: boolean;
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
  isUserCitizen,
  userCountry,
  userState,
  userCity,
}: ProposalCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  // Check if user's location matches for voting on geo-restricted proposals
  const userLocation = [userCountry, userState, userCity].filter(Boolean);
  const proposalGeo = proposal.geoRestrictions || [];
  const canVoteByLocation = proposalGeo.length === 0 ||
    proposalGeo.every((restriction, i) =>
      userLocation[i]?.toLowerCase() === restriction.toLowerCase()
    );

  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isEnded = timeRemaining === 'Ended';
  const geoTags = proposal.geoRestrictions || [];
  const tierLabel = getTierLabel(proposal.geoRestrictions);
  const location = getLocationLabel(proposal.geoRestrictions);
  const scopeLabel = tierLabel === 'GLOBAL' ? 'GLOBAL' : `${location} · ${tierLabel}`;
  const isCivicDesk = proposal.source === 'civic-desk';
  const voteType = (proposal as any).voteType || 'yes-no';
  const optionCount = ((proposal as any).options || []).length;
  const totalBallots = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);

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
      style={[
        feedCardStyles.card,
        {
          backgroundColor: colors.surface,
          // The civic-desk (referendum) card carries a gold-tinted border, per 05.
          borderColor: isCivicDesk ? 'rgba(234, 186, 88, 0.24)' : colors.borderSubtle,
        },
        animatedCardStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Chip row + deadline */}
      <View style={feedCardStyles.chipRow}>
        <View style={feedCardStyles.chipGroup}>
          {isCivicDesk && <TrustChip label="CIVIC DESK" variant="gold" />}
          <TrustChip label={scopeLabel} variant="neutral" />
          {voteType === 'ranked-choice' && <TrustChip label="RANKED" variant="outline" />}
          {voteType === 'multiple-choice' && <TrustChip label="PICK ONE" variant="outline" />}
          {proposal.requiresCitizenship && (
            <TrustChip label="CITIZENS ONLY" variant="outline" icon="shield-outline" />
          )}
        </View>
        <View style={feedCardStyles.chipRight}>
          {timeRemaining ? (
            <Text style={[feedCardStyles.timeText, { color: isEnded ? colors.oppose : colors.textTertiary }]}>
              {timeRemaining.toUpperCase()}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Share ${proposal.title}`}
          >
            <Ionicons name="share-outline" size={15} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Eligibility notices — restyled, all conditions preserved */}
      {geoTags.length > 0 && !isUserVerified && (
        <View style={[feedCardStyles.noticeChip, { backgroundColor: colors.warningSurface }]}>
          <Ionicons name="lock-closed" size={11} color={colors.warning} />
          <Text style={[feedCardStyles.noticeText, { color: colors.warning }]}>
            Verification required to vote
          </Text>
        </View>
      )}
      {geoTags.length > 0 && isUserVerified && !canVoteByLocation && (
        <View style={[feedCardStyles.noticeChip, { backgroundColor: colors.errorSurface }]}>
          <Ionicons name="location-outline" size={11} color={colors.error} />
          <Text style={[feedCardStyles.noticeText, { color: colors.error }]}>Not in your region</Text>
        </View>
      )}
      {proposal.requiresCitizenship && !isUserCitizen && (
        <View style={[feedCardStyles.noticeChip, { backgroundColor: colors.warningSurface }]}>
          <Ionicons name="shield-checkmark" size={11} color={colors.warning} />
          <Text style={[feedCardStyles.noticeText, { color: colors.warning }]}>
            Citizens only — verify to vote
          </Text>
        </View>
      )}

      {/* Serif ballot question */}
      <Text style={[feedCardStyles.title, { color: colors.text }]} numberOfLines={3}>
        {proposal.title}
      </Text>

      {/* Attachment — captioned document */}
      {proposal.imageUrl && (
        <View style={feedCardStyles.attachmentBlock}>
          <ExpoImage
            source={{ uri: proposal.imageUrl }}
            style={[feedCardStyles.attachmentImage, { borderColor: colors.borderSubtle }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
          <View style={feedCardStyles.attachmentCaptionRow}>
            <Ionicons name="document-attach-outline" size={11} color={colors.textTertiary} />
            <Text style={[feedCardStyles.attachmentCaption, { color: colors.textTertiary }]}>
              ATTACHMENT · FILED WITH THIS PROPOSAL
            </Text>
          </View>
        </View>
      )}

      {/* Tally — TallyBar enforces the 25-ballot threshold */}
      {voteType !== 'yes-no' ? (
        <View style={feedCardStyles.optionsRow}>
          <Text style={[feedCardStyles.optionsText, { color: colors.textSecondary }]}>
            {optionCount || 2} OPTIONS · {voteType === 'ranked-choice' ? 'RANK YOUR CHOICES' : 'PICK ONE'}
          </Text>
          <Text style={[feedCardStyles.optionsText, { color: colors.textTertiary }]}>
            {totalBallots.toLocaleString('en-CA')} VERIFIED BALLOTS
          </Text>
        </View>
      ) : (
        <TallyBar
          supportCount={proposal.supportVotes || 0}
          opposeCount={proposal.opposeVotes || 0}
          variant="compact"
          applyThreshold={!isEnded}
        />
      )}

      {/* Status / actions */}
      {isEnded ? (
        <View style={[feedCardStyles.statusBanner, { backgroundColor: colors.opposeSurface }]}>
          <Ionicons name="flag-outline" size={13} color={colors.oppose} />
          <Text style={[feedCardStyles.statusText, { color: colors.oppose }]}>VOTING CLOSED</Text>
        </View>
      ) : hasVoted ? (
        // Committed ballot state is GOLD — never green/red
        <View
          style={[
            feedCardStyles.votedBanner,
            { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.3)' },
          ]}
        >
          <View style={[feedCardStyles.votedCheck, { backgroundColor: colors.goldSurfaceStrong }]}>
            <Ionicons name="checkmark" size={13} color={colors.gold} />
          </View>
          <View>
            <Text style={[feedCardStyles.votedTitle, { color: colors.text }]}>Your ballot is recorded</Text>
            <Text style={[feedCardStyles.votedSub, { color: colors.textTertiary }]}>ON THE PUBLIC LEDGER</Text>
          </View>
        </View>
      ) : !canVoteByLocation && proposalGeo.length > 0 && isUserVerified ? (
        <View style={[feedCardStyles.statusBanner, { backgroundColor: colors.errorSurface }]}>
          <Ionicons name="lock-closed" size={13} color={colors.error} />
          <Text style={[feedCardStyles.statusText, { color: colors.error }]}>
            OPEN TO {String(proposalGeo[proposalGeo.length - 1] ?? 'REGION').toUpperCase()} RESIDENTS ONLY
          </Text>
        </View>
      ) : !isUserVerified && proposalGeo.length > 0 ? (
        <View style={[feedCardStyles.statusBanner, { backgroundColor: colors.warningSurface }]}>
          <Ionicons name="lock-closed" size={13} color={colors.warning} />
          <Text style={[feedCardStyles.statusText, { color: colors.warning }]}>
            VERIFY YOUR IDENTITY TO VOTE
          </Text>
        </View>
      ) : voteType !== 'yes-no' ? (
        // Non-binary ballots open the dedicated ballot screen (X2 / ranked)
        <TouchableOpacity
          style={[feedCardStyles.openBallotBtn, { backgroundColor: colors.goldFill }]}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPress();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Open ballot for ${proposal.title}`}
        >
          <Text style={feedCardStyles.openBallotText}>Open Ballot</Text>
        </TouchableOpacity>
      ) : (
        <View style={feedCardStyles.voteActions}>
          <TouchableOpacity
            style={[
              feedCardStyles.voteBtn,
              { backgroundColor: colors.supportSurface, borderColor: colors.support },
              isVoting && feedCardStyles.btnDisabled,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onVote(proposal.id as number, 'support');
            }}
            disabled={isVoting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Vote support on ${proposal.title}`}
            accessibilityState={{ disabled: isVoting }}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color={colors.support} />
            ) : (
              <Text style={[feedCardStyles.voteBtnText, { color: colors.support }]}>Support</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              feedCardStyles.voteBtn,
              { backgroundColor: colors.opposeSurface, borderColor: colors.oppose },
              isVoting && feedCardStyles.btnDisabled,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onVote(proposal.id as number, 'oppose');
            }}
            disabled={isVoting}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Vote oppose on ${proposal.title}`}
            accessibilityState={{ disabled: isVoting }}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color={colors.oppose} />
            ) : (
              <Text style={[feedCardStyles.voteBtnText, { color: colors.oppose }]}>Oppose</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </AnimatedTouchable>
  );
}

const feedCardStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 17,
    paddingHorizontal: 18,
    gap: 12,
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  chipGroup: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  noticeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  noticeText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    lineHeight: 24,
  },
  attachmentBlock: {
    gap: 6,
  },
  attachmentImage: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    borderWidth: 1,
  },
  attachmentCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  attachmentCaption: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 0.85,
    fontVariant: ['tabular-nums'],
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  optionsText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
  },
  statusText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.1,
  },
  votedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  votedCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  votedTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
  },
  votedSub: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 0.85,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  openBallotBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBallotText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: '#040707',
  },
  voteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  voteBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBtnText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.6 },
});

// Memoized list-item wrapper: without this, every parent re-render (vote
// counts, filters, swipe index) re-renders every visible card. Re-render
// only when the card's own proposal data / vote state changes.
const MemoProposalCard = React.memo(ProposalCard, (prev, next) => (
  prev.proposal === next.proposal &&
  prev.hasVoted === next.hasVoted &&
  prev.isVoting === next.isVoting &&
  prev.isUserVerified === next.isUserVerified &&
  prev.isUserCitizen === next.isUserCitizen &&
  prev.userCountry === next.userCountry &&
  prev.userState === next.userState &&
  prev.userCity === next.userCity
));

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
  const { proposalId: deepLinkProposalId } = useLocalSearchParams<{ proposalId?: string }>();
  const insets = useSafeAreaInsets();

  // Calculate card height dynamically based on safe area insets
  const cardHeight = SCREEN_HEIGHT - insets.top - insets.bottom - BASE_CARD_HEIGHT_OFFSET;

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [claimedTokens, setClaimedTokens] = useState<Set<number | string>>(new Set());
  const [votedProposals, setVotedProposals] = useState<Set<number | string>>(new Set());
  const [votingProposalId, setVotingProposalId] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  // Create form: which field is focused (drives the gold active-field border).
  const [createFocusField, setCreateFocusField] = useState<'question' | 'details' | null>(null);
  // P3 · How voting works rules sheet (opened from the vote queue).
  const [showHowVoting, setShowHowVoting] = useState(false);

  const [userCountry, setUserCountry] = useState('');
  const [userState, setUserState] = useState('');
  const [userCity, setUserCity] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [citizenshipVerified, setCitizenshipVerified] = useState(false);

  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationModalType, setVerificationModalType] = useState<'vote' | 'proposal' | 'limit'>('vote');
  const [pendingLimitTier, setPendingLimitTier] = useState<'free' | 'verified'>('free');
  const [showModerationMenu, setShowModerationMenu] = useState(false);

  // Pull the muted-user list (persistent, hydrates locally on mount).
  const mutedUserIds = useModerationStore((s) => s.mutedUserIds);
  useSyncMutes();

  // X1 confirm-before-cast sheet state. EVERY cast — swipe, queue buttons,
  // list card, detail modal — must pass through this pending state; nothing
  // is submitted until the user confirms on the sheet.
  const [pendingVote, setPendingVote] = useState<{
    proposal: Proposal;
    vote: 'support' | 'oppose';
    source: 'swipe' | 'list' | 'detail';
  } | null>(null);
  const [lastVoteType, setLastVoteType] = useState<'support' | 'oppose'>('support');
  // Context for the post-vote "Share your vote" pill on the confirmation
  // overlay — the user's just-cast vote is the highest-motivation share
  // moment in the app.
  const lastVotedRef = useRef<{ id: number | string; title: string } | null>(null);

  // Vote queue for sequential processing of real (non-seed) votes
  const voteQueueRef = useRef<Array<{ proposalId: number | string; vote: 'support' | 'oppose'; title: string }>>([]);
  const isProcessingQueueRef = useRef(false);

  // Swipe mode state
  const [viewMode, setViewMode] = useState<'swipe' | 'list'>('swipe');
  const [swipeIndex, setSwipeIndex] = useState(0);

  // Swipe hint overlay (shows once for new users)
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeCardRef = useRef<View>(null);

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
    voteType: 'yes-no' as 'yes-no' | 'multiple-choice' | 'ranked-choice',
    options: ['', ''] as string[],
    requiresCitizenship: false,
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

  // Check if swipe hint should be shown (first time in swipe mode).
  // Read from disk at most once per screen lifetime, and guard the async
  // setState against unmount (toggling view modes used to re-hit disk every
  // time and could setState after the screen was gone).
  const swipeHintCheckedRef = useRef(false);
  useEffect(() => {
    if (viewMode !== 'swipe' || swipeHintCheckedRef.current) return;
    swipeHintCheckedRef.current = true;
    let alive = true;
    AsyncStorage.getItem(SWIPE_HINT_KEY)
      .then((value) => {
        if (alive && !value) setShowSwipeHint(true);
      })
      .catch(() => { /* hint is cosmetic — never block on storage errors */ });
    return () => { alive = false; };
  }, [viewMode]);

  const dismissSwipeHint = useCallback(async () => {
    setShowSwipeHint(false);
    try {
      await AsyncStorage.setItem(SWIPE_HINT_KEY, 'shown');
    } catch { /* cosmetic */ }
  }, []);

  const filteredProposals = useMemo(() => {
    const mutedSet = new Set(mutedUserIds);
    // Reverse to show most recent proposals first
    return [...proposals].reverse().filter((proposal) => {
      // Hide proposals from muted creators. Backend should filter too once the
      // mute endpoint is live; this is the client-side belt for offline + lag.
      const creatorId = (proposal as any).creatorId || (proposal as any).userId;
      if (creatorId && mutedSet.has(String(creatorId))) return false;

      // Unverified users can only act on global proposals (geoRestrictions
      // empty), so hide geo-restricted ones from the list to keep the view
      // honest. canUserVoteOnProposal still gates the vote button as a
      // belt-and-suspenders measure.
      if (!isVerified && (proposal.geoRestrictions || []).length > 0) return false;

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
    isVerified,
    mutedUserIds,
  ]);

  const activeCount = useMemo(() => filteredProposals.filter((p) => !isProposalEnded(p)).length, [filteredProposals]);

  // Proposals available for swiping (not voted, not ended, user can vote)
  const swipeableProposals = useMemo(() => {
    const eligible = filteredProposals.filter((p) => {
      // Handle both string and number IDs for seed proposals
      const hasVoted = votedProposals.has(p.id as number) || votedProposals.has(p.id as any);
      const isEnded = isProposalEnded(p);
      // Filter out proposals user can't vote on (geo-restricted)
      const canVote = canUserVoteOnProposal(p, userCountry, userState, userCity, isVerified);
      return !hasVoted && !isEnded && canVote;
    });
    // Bring the deep-linked proposal to the front of the swipe stack so when
    // the user backs out of the detail modal it's the next card to vote on.
    if (deepLinkProposalId) {
      const idx = eligible.findIndex((p) => String(p.id) === String(deepLinkProposalId));
      if (idx > 0) {
        const [target] = eligible.splice(idx, 1);
        eligible.unshift(target);
      }
    }
    return eligible;
  }, [filteredProposals, votedProposals, userCountry, userState, userCity, isVerified, deepLinkProposalId]);

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

        // Demo account should use hardcoded location and be verified (for App Store review)
        const isDemoAccount = user?.email === 'demo@represent.app';
        if (isDemoAccount) {
          setUserCountry('Canada');
          setUserState('Ontario');
          setUserCity('Toronto');
          setIsVerified(true);
          setCitizenshipVerified(true);
        } else if (profileRes.data) {
          setUserCountry(profileRes.data.country || '');
          setUserState(profileRes.data.state || '');
          setUserCity(profileRes.data.city || '');
          setIsVerified(profileRes.data.verified || false);
          setCitizenshipVerified(
            !!(profileRes.data.citizenshipVerified || profileRes.data.citizenship_verified),
          );
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
    // Geo / verification gate. Apply BEFORE the demo + seed bypass so the
    // demo account (used by App Store reviewers) can't register votes on
    // proposals that show the "Not in your region" badge — the gate badge
    // and the actual behaviour have to agree. Server enforces this too,
    // but the demo path skips the API entirely so client-side enforcement
    // is the only thing standing in the way for that flow.
    const target = proposals.find((p) => String(p.id) === String(proposalId));
    if (target && !canUserVoteOnProposal(target, userCountry, userState, userCity, isVerified)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const geo = target.geoRestrictions ?? [];
      const isUnverifiedGeo = geo.length > 0 && !isVerified;
      Alert.alert(
        isUnverifiedGeo ? 'Verification required' : 'Not eligible',
        isUnverifiedGeo
          ? 'Verify your identity to vote on geo-restricted proposals.'
          : `This proposal is restricted to ${geo[geo.length - 1] ?? 'a specific region'}. Voting is only open to residents.`,
        [{ text: 'OK', style: 'cancel' }],
      );
      return;
    }

    // Citizens-only gate. Runs before the demo/seed bypass so the eligibility
    // badge and behaviour agree. Server enforces CITIZENSHIP_REQUIRED too.
    if (target && !meetsCitizenshipRequirement(target, citizenshipVerified)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Citizens only',
        'This proposal is open to verified citizens. Verify your citizenship (passport + proof of address) to vote.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Verify citizenship',
            onPress: () => router.push('/modals/verification-payment'),
          },
        ],
      );
      return;
    }

    // Seed proposals + demo account votes: local-only, never hit the API.
    // Demo account is sandboxed so App Store reviewers don't pollute real proposal counts.
    const isDemoAccount = user?.email === 'demo@represent.app';
    if (isSeedProposal(proposalId) || isDemoAccount) {
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
      // The X1 sheet (already open in its cast state) is the confirmation UI.
      setLastVoteType(vote);
      lastVotedRef.current = { id: proposalId, title: target?.title || 'Proposal' };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    // Real proposals: require authentication
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to vote.');
      return;
    }

    // Daily ballot cap check (premium users have unlimited).
    // Server enforces the same cap; the local check is a fast UX path so
    // we don't even attempt the network call when the user is out.
    const { spendBallot, tier: ballotTier } = useBallotStore.getState();
    if (ballotTier !== 'premium') {
      const canSpend = spendBallot();
      if (!canSpend) {
        // Explain the cap before routing — a silent redirect to the paywall
        // reads as a bug. This is also the single best Premium conversion
        // moment in the app: the user is mid-action and motivated.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
          "You're out of ballots for today",
          'Free accounts get 20 votes per day. Your ballots refresh at midnight — or go Premium for unlimited voting.',
          [
            { text: 'Tomorrow then', style: 'cancel' },
            { text: 'Go unlimited', onPress: () => router.push('/modals/subscription') },
          ],
        );
        return;
      }
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
    const { restoreBallot, tier: currentTier } = useBallotStore.getState();

    try {
      // First claim the token if not already claimed
      if (!claimedTokens.has(proposalId as number)) {
        const claimResult = await proposalsApi.claimVoteToken(proposalId as number);
        if (claimResult.error) {
          if (currentTier !== 'premium') restoreBallot();
          Alert.alert('Error', claimResult.error);
          setVotingProposalId(null);
          return;
        }
        setClaimedTokens((prev) => new Set([...prev, proposalId]));
      }

      // Then submit the vote
      const result = await proposalsApi.submitVote(proposalId, vote);
      if (result.error) {
        if (currentTier !== 'premium') restoreBallot();
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

      // The X1 sheet (already open in its cast state) is the confirmation UI;
      // keep the share context fresh for its "Share your vote" pill.
      setLastVoteType(vote);
      lastVotedRef.current = { id: proposalId, title: proposalTitle };

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Check for newly earned badges (async, non-blocking)
      setTimeout(() => checkForNewBadges(), 1500);

      // Daily counter was already incremented by spendBallot() before the vote.
      // No on-chain balance sync needed — the daily counter is the source of
      // truth for the UI; the user's on-chain RPV balance is just "ammo".
    } catch {
      if (currentTier !== 'premium') restoreBallot();
      Alert.alert('Error', 'Failed to submit vote. Please try again.');
    } finally {
      setVotingProposalId(null);
    }
  };

  // Process vote queue sequentially to avoid blockchain nonce collisions
  const processVoteQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (voteQueueRef.current.length > 0) {
      const { proposalId, vote, title } = voteQueueRef.current[0];
      try {
        await handleVote(proposalId, vote);
      } catch {
        Alert.alert('Vote Failed', `Your vote on "${title}" couldn't be submitted. Please find it and try again.`);
      }
      voteQueueRef.current.shift();
    }

    isProcessingQueueRef.current = false;
  }, [handleVote]);

  // ── X1 confirm-before-cast flow ────────────────────────────────────────────
  // Step 1: any vote intent (swipe, queue button, list card, detail modal)
  // lands here and opens the mandatory confirm sheet. Non-binary ballots are
  // routed to their dedicated ballot screen instead — a support/oppose sheet
  // would misrepresent a ranked or multiple-choice ballot.
  const requestVote = (
    proposal: Proposal,
    vote: 'support' | 'oppose',
    source: 'swipe' | 'list' | 'detail',
  ) => {
    const voteType = (proposal as any).voteType;
    if (voteType && voteType !== 'yes-no') {
      openProposal(proposal);
      return;
    }
    setLastVoteType(vote);
    lastVotedRef.current = { id: proposal.id, title: proposal.title || 'Proposal' };
    setPendingVote({ proposal, vote, source });
  };

  // Step 2: the user pressed "Cast Ballot" on the X1 sheet — only now does
  // anything get submitted. Swipe-sourced casts advance the queue and go
  // through the sequential vote queue (blockchain nonce collisions).
  const confirmPendingVote = () => {
    const pending = pendingVote;
    if (!pending) return;
    const { proposal, vote, source } = pending;

    if (source === 'swipe') {
      setSwipeIndex((prev) => prev + 1);
      if (!isSeedProposal(proposal.id)) {
        voteQueueRef.current.push({ proposalId: proposal.id, vote, title: proposal.title || 'Untitled' });
        processVoteQueue();
      } else {
        handleVote(proposal.id, vote);
      }
    } else {
      handleVote(proposal.id, vote);
    }
  };

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

    // Demo account bypasses all limits (for App Store review)
    const isDemoAccount = user?.email === 'demo@represent.app';

    // Free accounts run one active proposal at a time; premium is
    // unlimited. /api/user/limits doesn't exist on the backend yet (the
    // limitsApi fallback always reports used: 0), so count the user's
    // live proposals from the already-loaded list. The server enforces
    // the same rule (PROPOSAL_LIMIT) — this pre-check is the upsell UX.
    const isPremiumUser = !!user?.isPremium || user?.subscriptionStatus === 'active';
    if (!isDemoAccount && !isPremiumUser) {
      const now = Date.now();
      const myActiveProposals = proposals.filter((p) =>
        String(p.creatorId) === String(user?.id ?? '') &&
        !String(p.id).startsWith('seed-') &&
        (!p.deadline || new Date(p.deadline).getTime() > now)
      ).length;
      if (myActiveProposals >= 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
          'One active proposal at a time',
          'Free accounts can run one active proposal at a time. Upgrade to Premium for unlimited proposals, or wait for your current one to close.',
          [
            { text: 'Not now', style: 'cancel' },
            {
              text: 'Upgrade',
              onPress: () => {
                setShowCreateModal(false);
                router.push('/modals/subscription');
              },
            },
          ],
        );
        return;
      }
    }

    // Check proposal limits (skip for premium users with unlimited, or demo account)
    if (!isDemoAccount && usageLimits && usageLimits.proposals.limit !== 'unlimited') {
      if (usageLimits.proposals.used >= usageLimits.proposals.limit) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setVerificationModalType('limit');
        setPendingLimitTier(usageLimits.tier === 'free' ? 'free' : 'verified');
        setShowCreateModal(false);
        setShowVerificationModal(true);
        return;
      }
    }

    // Require verification for geo-restricted proposals (skip for demo account)
    if (!isDemoAccount && newProposal.geoScope !== 'global' && !isVerified) {
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

      // Validate options when voteType is non-binary. Mirrors backend
      // validation in POST /api/proposals.
      if (newProposal.voteType !== 'yes-no') {
        const cleanedOpts = newProposal.options.map((o) => o.trim()).filter(Boolean);
        if (cleanedOpts.length < 2) {
          Alert.alert('Need more options', `${newProposal.voteType === 'ranked-choice' ? 'Ranked-choice' : 'Multiple-choice'} proposals need at least 2 options.`);
          return;
        }
        if (new Set(cleanedOpts).size !== cleanedOpts.length) {
          Alert.alert('Duplicate options', 'Each option must be unique.');
          return;
        }
      }

      const result = await proposalsApi.create({
        title: newProposal.title.trim(),
        description: newProposal.description.trim(),
        category: newProposal.category,
        geoRestrictions: geoRestrictions.length > 0 ? geoRestrictions : undefined,
        demographicRestrictions: Object.keys(demographicRestrictions).length > 0 ? demographicRestrictions : undefined,
        imageUrl,
        voteType: newProposal.voteType,
        options: newProposal.voteType === 'yes-no'
          ? undefined
          : newProposal.options.map((o) => o.trim()).filter(Boolean),
        requiresCitizenship: newProposal.requiresCitizenship,
      });

      if (result.error) {
        if (result.errorCode === 'PROPOSAL_LIMIT') {
          Alert.alert(
            'One active proposal at a time',
            'Free accounts can run one active proposal at a time. Upgrade to Premium for unlimited proposals.',
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Upgrade',
                onPress: () => {
                  setShowCreateModal(false);
                  router.push('/modals/subscription');
                },
              },
            ],
          );
          return;
        }
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
        voteType: 'yes-no',
        options: ['', ''],
        requiresCitizenship: false,
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
    // Non-yes-no proposals need a dedicated ballot screen — the in-screen
    // detail modal only knows how to render support/oppose. Route to
    // /modals/proposal-detail for RCV / multiple-choice.
    const voteType = (p as any).voteType;
    if (voteType && voteType !== 'yes-no') {
      router.push({
        pathname: '/modals/proposal-detail',
        params: {
          proposalId: String(p.id),
          title: p.title || '',
          description: p.description || '',
          category: p.category || 'General',
          deadline: p.deadline || '',
          voteType,
          options: JSON.stringify((p as any).options ?? []),
          creatorId: String((p as any).creatorId ?? (p as any).userId ?? ''),
          creatorName: p.creatorName || 'Community Member',
          requiresCitizenship: (p as any).requiresCitizenship ? '1' : '',
        },
      });
      return;
    }
    setSelectedProposal(p);
    setShowDetailModal(true);
  };

  const closeProposal = () => {
    setShowDetailModal(false);
    setTimeout(() => setSelectedProposal(null), 150);
  };

  // Auto-open a proposal when navigated with proposalId param (e.g. from voting history)
  useEffect(() => {
    if (deepLinkProposalId && proposals.length > 0 && !loading) {
      const match = proposals.find((p) => String(p.id) === String(deepLinkProposalId));
      if (match && !showDetailModal) {
        openProposal(match);
      }
    }
  }, [deepLinkProposalId, proposals, loading]);

  const detail = selectedProposal;
  const detailHasVoted = detail ? votedProposals.has(detail.id as number) : false;
  const detailIsVoting = detail ? votingProposalId === (detail.id as number) : false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header - only show in list mode */}
      {viewMode !== 'swipe' && (
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 16 }]}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Proposals</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
                {activeCount} active proposal{activeCount !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <BallotDisplay size="sm" />

              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewMode('swipe');
                }}
                accessibilityLabel="Switch to swipe view"
              >
                <Ionicons name="layers-outline" size={18} color={colors.text} />
              </TouchableOpacity>

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
      )}

      {/* Filter Panel */}
      {showFilters && viewMode !== 'swipe' && (
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
            <Ionicons name={!isVerified && !hasActiveFilters ? 'shield-checkmark-outline' : 'document-text-outline'} size={48} color={colors.gold} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {!isVerified && !hasActiveFilters ? 'No global proposals open' : 'No proposals found'}
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : !isVerified
                ? 'There are no global proposals open right now. Verify your identity to vote on proposals in your country, province, and city.'
                : 'Be the first to create one!'}
          </Text>
          {!hasActiveFilters && (
            <TouchableOpacity
              onPress={() => {
                if (!isVerified) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setVerificationModalType('vote');
                  setShowVerificationModal(true);
                } else {
                  setShowCreateModal(true);
                }
              }}
              style={styles.emptyBtn}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.emptyBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name={!isVerified ? 'shield-checkmark' : 'add-circle-outline'} size={20} color="#000" />
                <Text style={styles.emptyBtnText}>{!isVerified ? 'Get Verified' : 'Create Proposal'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : viewMode === 'swipe' ? (
        /* M2 · Vote Queue — review session */
        <GestureHandlerRootView style={[styles.swipeContainer, { backgroundColor: colors.background }]}>
          {visibleSwipeCards.length === 0 ? (
            /* E1 · Queue Complete — the header stays so filters, list view,
               and the create button remain reachable from the empty queue. */
            <View style={{ flex: 1 }}>
              <VoteHeader
                index={0}
                total={0}
                activeCount={activeCount}
                closingSoon={0}
                selectedFilter={selectedGeoLevel === 'All' ? 'All' :
                  selectedGeoLevel === 'National' ? 'Federal' :
                  selectedGeoLevel === 'State/Province' ? 'Provincial' :
                  selectedGeoLevel === 'City/Local' ? 'Municipal' : 'All'}
                onFilterChange={(filter) => {
                  const geoMap: Record<string, string> = {
                    'All': 'All',
                    'Federal': 'National',
                    'Provincial': 'State/Province',
                    'Municipal': 'City/Local',
                    'Closing': 'All',
                  };
                  setSelectedGeoLevel(geoMap[filter] || 'All');
                  if (filter === 'Closing') setSelectedStatus('Active');
                }}
                insetTop={insets.top}
                onCreate={() => setShowCreateModal(true)}
                onToggleView={() => setViewMode('list')}
              />
              <Animated.View entering={FadeIn.duration(400)} style={styles.queueClearBody}>
                <View style={styles.queueClearCenter}>
                  <View style={[styles.queueClearSeal, { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.35)' }]}>
                    <Ionicons name="checkmark-done-outline" size={44} color={colors.gold} />
                  </View>
                  <Text style={[styles.queueClearTitle, { color: colors.text }]}>Queue clear.</Text>
                  <Text style={[styles.queueClearDesc, { color: colors.textSecondary }]}>
                    {votedProposals.size > 0
                      ? `You've voted on every open proposal in your scope. Your voice is on the record, ${votedProposals.size} ${votedProposals.size === 1 ? 'time' : 'times'} over.`
                      : 'No open proposals in your scope right now.'}
                  </Text>
                  <View style={[styles.queueClearStats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.queueClearStatRow}>
                      <Text style={[styles.queueClearStatLabel, { color: colors.textTertiary }]}>YOUR RECORD</Text>
                      <Text style={[styles.queueClearStatValue, { color: colors.text }]}>
                        {votedProposals.size} {votedProposals.size === 1 ? 'BALLOT' : 'BALLOTS'}
                      </Text>
                    </View>
                    <View style={styles.queueClearStatRow}>
                      <Text style={[styles.queueClearStatLabel, { color: colors.textTertiary }]}>ALL RECORDED</Text>
                      <View style={styles.queueClearStatCheck}>
                        <Ionicons name="checkmark" size={12} color={colors.support} />
                        <Text style={[styles.queueClearStatValue, { color: colors.support }]}>ON THE PUBLIC LEDGER</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.queueClearNote, { color: colors.textTertiary }]}>
                    We'll let you know the moment a new proposal opens in your scope.
                  </Text>
                </View>
                <View style={styles.queueClearActions}>
                  <TouchableOpacity
                    style={[styles.queueClearCta, { backgroundColor: colors.goldFill }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setViewMode('list');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="See live results"
                  >
                    <Text style={styles.queueClearCtaText}>See Live Results</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.queueClearGhost}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push('/modals/voting-history');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Share your record"
                  >
                    <Ionicons name="share-outline" size={15} color={colors.textSecondary} />
                    <Text style={[styles.queueClearGhostText, { color: colors.textSecondary }]}>Your Record</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.queueClearGhost}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSwipeIndex(0);
                      fetchData(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Check for new proposals"
                  >
                    <Ionicons name="refresh-outline" size={15} color={colors.textSecondary} />
                    <Text style={[styles.queueClearGhostText, { color: colors.textSecondary }]}>Check for New Proposals</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Premium Vote Header */}
              <VoteHeader
                index={swipeIndex}
                total={swipeableProposals.length}
                activeCount={activeCount}
                closingSoon={filteredProposals.filter(p => {
                  const tr = getTimeRemaining(p.deadline);
                  return tr && tr.includes('d') && parseInt(tr) <= 3;
                }).length}
                selectedFilter={selectedGeoLevel === 'All' ? 'All' :
                  selectedGeoLevel === 'National' ? 'Federal' :
                  selectedGeoLevel === 'State/Province' ? 'Provincial' :
                  selectedGeoLevel === 'City/Local' ? 'Municipal' : 'All'}
                onFilterChange={(filter) => {
                  const geoMap: Record<string, string> = {
                    'All': 'All',
                    'Federal': 'National',
                    'Provincial': 'State/Province',
                    'Municipal': 'City/Local',
                    'Closing': 'All',
                  };
                  setSelectedGeoLevel(geoMap[filter] || 'All');
                  if (filter === 'Closing') setSelectedStatus('Active');
                }}
                insetTop={insets.top}
                onCreate={() => setShowCreateModal(true)}
                onToggleView={() => setViewMode('list')}
                onHowVotingWorks={() => setShowHowVoting(true)}
              />

              {/* Card stack — tap opens the full detail; the buttons below cast */}
              <View ref={swipeCardRef} style={[styles.cardStack, { marginTop: 8 }]} collapsable={false}>
                {visibleSwipeCards.map((proposal, idx) => (
                  <SwipeCard
                    key={proposal.id}
                    proposal={proposal}
                    onTap={() => openProposal(proposal)}
                    isTopCard={idx === 0}
                    cardIndex={idx}
                    cardHeight={cardHeight}
                  />
                )).reverse()}
              </View>

              {/* M2 vote controls — big tinted Support / Oppose + skip.
                  Bottom padding clears the floating tab bar. */}
              {(() => {
                const topCard = visibleSwipeCards[0];
                const topVoteType = topCard ? ((topCard as any).voteType || 'yes-no') : 'yes-no';
                return (
                  <View style={[styles.voteControls, { paddingBottom: insets.bottom + 74 }]}>
                    {topVoteType !== 'yes-no' ? (
                      <TouchableOpacity
                        style={[styles.openBallotBtn, { backgroundColor: colors.goldFill }]}
                        onPress={() => {
                          if (!topCard) return;
                          dismissSwipeHint();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          openProposal(topCard);
                        }}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Open ballot"
                      >
                        <Text style={styles.openBallotText}>
                          Open Ballot — {topVoteType === 'ranked-choice' ? 'Rank Your Choices' : 'Pick One'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.voteButtonRow}>
                        <TouchableOpacity
                          style={[
                            styles.queueVoteBtn,
                            { backgroundColor: colors.supportSurface, borderColor: colors.support },
                          ]}
                          onPress={() => {
                            if (!topCard) return;
                            dismissSwipeHint();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            requestVote(topCard, 'support', 'swipe');
                          }}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel="Support this proposal"
                        >
                          <Text style={[styles.queueVoteText, { color: colors.support }]}>Support</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.queueVoteBtn,
                            { backgroundColor: colors.opposeSurface, borderColor: colors.oppose },
                          ]}
                          onPress={() => {
                            if (!topCard) return;
                            dismissSwipeHint();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            requestVote(topCard, 'oppose', 'swipe');
                          }}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel="Oppose this proposal"
                        >
                          <Text style={[styles.queueVoteText, { color: colors.oppose }]}>Oppose</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.skipBtn}
                      onPress={() => {
                        dismissSwipeHint();
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleSkip();
                      }}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Skip, decide later"
                    >
                      <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip — decide later</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </View>
          )}
        </GestureHandlerRootView>
      ) : (
        /* List Mode — virtualized so memory + first-paint scale to thousands of proposals */
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          data={filteredProposals}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item, index }) => (
            <MemoProposalCard
              proposal={item}
              hasVoted={votedProposals.has(item.id as number)}
              onVote={handleVote}
              isVoting={votingProposalId === item.id}
              onPress={() => openProposal(item)}
              index={index}
              isUserVerified={isVerified}
              isUserCitizen={citizenshipVerified}
              userCountry={userCountry}
              userState={userState}
              userCity={userCity}
            />
          )}
          ListFooterComponent={<View style={styles.listSpacer} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={colors.gold}
              progressBackgroundColor={colors.surface}
            />
          }
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={10}
        />
      )}

      {/* Detail Modal — premium institutional redesign */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeProposal}>
        <View style={[detailStyles.container, { backgroundColor: BG }]}>
          {/* Minimal floating header */}
          <View style={detailStyles.header}>
            <TouchableOpacity onPress={closeProposal} style={detailStyles.headerBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={20} color={FG} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => {
                  if (!detail) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  shareProposal({ id: detail.id as number, title: detail.title, description: detail.description });
                }}
                style={detailStyles.headerBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={16} color={FG} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (!detail) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowModerationMenu(true);
                }}
                style={detailStyles.headerBtn}
                activeOpacity={0.7}
                accessibilityLabel="Proposal options"
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={FG} />
              </TouchableOpacity>
            </View>
          </View>

          {detail && (() => {
            const total = (detail.supportVotes || 0) + (detail.opposeVotes || 0);
            const pct = total > 0 ? Math.round(((detail.supportVotes || 0) / total) * 100) : 0;
            const tierLabel = getTierLabel(detail.geoRestrictions);
            const category = detail.category || 'General';
            const location = getLocationLabel(detail.geoRestrictions);
            const timeRemaining = getTimeRemaining(detail.deadline);
            const ended = isProposalEnded(detail);
            const cat = category.toLowerCase();
            const categoryColor =
              cat === 'economy' ? GREEN :
              cat === 'housing' ? GOLD :
              cat === 'transportation' || cat === 'infrastructure' ? BLUE :
              cat === 'environment' ? '#22C55E' :
              cat === 'healthcare' ? '#EF4444' : GOLD;

            return (
              <ScrollView contentContainerStyle={detailStyles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Hero image with overlays */}
                <View style={detailStyles.hero}>
                  {detail.imageUrl ? (
                    <ExpoImage source={{ uri: detail.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: BG_RAISED }]} />
                  )}
                  <LinearGradient
                    colors={['rgba(4,7,7,0.25)', 'rgba(4,7,7,0.6)', 'rgba(4,7,7,1)']}
                    locations={[0, 0.55, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={detailStyles.heroLocationPill}>
                    <Ionicons name="location" size={11} color={FG} />
                    <Text style={detailStyles.heroLocationText}>{location}</Text>
                  </View>
                  {!ended && timeRemaining ? (
                    <View style={detailStyles.heroTimePill}>
                      <Ionicons name="time-outline" size={11} color={GOLD} />
                      <Text style={detailStyles.heroTimePillText}>{timeRemaining}</Text>
                    </View>
                  ) : null}
                  <View style={[detailStyles.heroCategoryTag, { borderColor: `${categoryColor}66` }]}>
                    <View style={[detailStyles.heroCategoryDot, { backgroundColor: categoryColor }]} />
                    <Text style={[detailStyles.heroCategoryText, { color: categoryColor }]}>{category.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Body */}
                <View style={detailStyles.body}>
                  <Text style={detailStyles.tierLabel}>{tierLabel}</Text>
                  <Text style={detailStyles.title}>{detail.title}</Text>

                  <View style={detailStyles.proposerRow}>
                    <View style={detailStyles.proposerAvatar}>
                      <Text style={detailStyles.proposerDot}>·</Text>
                    </View>
                    <Text style={detailStyles.proposerText}>
                      Proposed by <Text style={{ color: FG }}>{detail.creatorName || 'Community Member'}</Text>
                    </Text>
                  </View>

                  <Text style={detailStyles.description}>{detail.description}</Text>

                  {/* Sentiment ledger */}
                  {total === 0 ? (
                    <View style={detailStyles.sentimentSection}>
                      <View style={detailStyles.sentimentBarEmpty} />
                      <Text style={detailStyles.noVotesText}>No votes yet</Text>
                    </View>
                  ) : (
                    <View style={detailStyles.sentimentSection}>
                      <View style={detailStyles.sentimentBar}>
                        <View style={[detailStyles.sentimentFillSupport, { width: `${pct}%` }]} />
                        <View style={[detailStyles.sentimentFillOppose, { width: `${100 - pct}%` }]} />
                      </View>
                      <View style={detailStyles.sentimentStats}>
                        <View style={detailStyles.sentimentStat}>
                          <Text style={[detailStyles.sentimentNum, { color: GREEN }]}>{(detail.supportVotes || 0).toLocaleString()}</Text>
                          <Text style={detailStyles.sentimentLabel}>SUPPORT</Text>
                        </View>
                        <View style={detailStyles.sentimentPct}>
                          <Text style={detailStyles.sentimentPctText}>{pct}%</Text>
                        </View>
                        <View style={detailStyles.sentimentStatRight}>
                          <Text style={[detailStyles.sentimentNum, { color: RED }]}>{(detail.opposeVotes || 0).toLocaleString()}</Text>
                          <Text style={detailStyles.sentimentLabel}>OPPOSE</Text>
                        </View>
                      </View>
                      <Text style={detailStyles.totalVoices}>{total.toLocaleString()} total voices</Text>
                    </View>
                  )}

                  {/* Vote actions */}
                  <View style={detailStyles.actionRow}>
                    {ended ? (
                      <View style={detailStyles.statusBanner}>
                        <Ionicons name="flag-outline" size={14} color={RED} />
                        <Text style={[detailStyles.statusBannerText, { color: RED }]}>Voting has ended</Text>
                      </View>
                    ) : detailHasVoted ? (
                      <View style={detailStyles.statusBanner}>
                        {/* Committed ballot renders gold — the act, per the design's color rules. */}
                        <Ionicons name="checkmark-circle" size={14} color={GOLD} />
                        <Text style={[detailStyles.statusBannerText, { color: GOLD }]}>Ballot cast · on the public ledger</Text>
                      </View>
                    ) : (
                      <View style={detailStyles.voteActions}>
                        <TouchableOpacity
                          style={[detailStyles.voteBtn, detailStyles.voteBtnSupport, detailIsVoting && { opacity: 0.5 }]}
                          onPress={() => {
                            if (!detail) return;
                            const p = detail;
                            closeProposal();
                            // Route through the mandatory X1 confirm sheet — never cast directly.
                            requestVote(p, 'support', 'detail');
                          }}
                          disabled={detailIsVoting}
                          activeOpacity={0.7}
                        >
                          {detailIsVoting ? (
                            <ActivityIndicator size="small" color={GREEN} />
                          ) : (
                            <>
                              <Ionicons name="checkmark" size={16} color={GREEN} />
                              <Text style={[detailStyles.voteBtnText, { color: GREEN }]}>Support</Text>
                            </>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[detailStyles.voteBtn, detailStyles.voteBtnOppose, detailIsVoting && { opacity: 0.5 }]}
                          onPress={() => {
                            if (!detail) return;
                            const p = detail;
                            closeProposal();
                            // Route through the mandatory X1 confirm sheet — never cast directly.
                            requestVote(p, 'oppose', 'detail');
                          }}
                          disabled={detailIsVoting}
                          activeOpacity={0.7}
                        >
                          {detailIsVoting ? (
                            <ActivityIndicator size="small" color={RED} />
                          ) : (
                            <>
                              <Ionicons name="close" size={16} color={RED} />
                              <Text style={[detailStyles.voteBtnText, { color: RED }]}>Oppose</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {/* Discussion */}
                {detail?.id != null && (
                  <View style={{ paddingHorizontal: SPACING.lg }}>
                    <CommentsSection proposalId={detail.id} />
                  </View>
                )}

                <View style={{ height: 80 }} />
              </ScrollView>
            );
          })()}

          <ProposalModerationMenu
            visible={showModerationMenu}
            onClose={() => setShowModerationMenu(false)}
            proposalId={detail?.id ?? null}
            creatorId={(detail as any)?.creatorId ?? (detail as any)?.userId ?? null}
            creatorName={detail?.creatorName || 'Community Member'}
            isOwnProposal={(() => {
              const cid = (detail as any)?.creatorId ?? (detail as any)?.userId;
              return !!(cid && user?.id && String(cid) === String(user.id));
            })()}
            onMuted={() => {
              // Close the detail view too — user just hid the creator
              closeProposal();
            }}
            onDeleted={() => {
              // Remove locally so the list updates without waiting for refetch
              const id = detail?.id;
              if (id != null) {
                setProposals((prev) => prev.filter((p) => String(p.id) !== String(id)));
              }
              closeProposal();
            }}
          />
        </View>
      </Modal>

      {/* Create Modal — 12 · New Proposal. Full re-skin of the form; every
          piece of creation logic (newProposal state shape, validation,
          limits/upsell alerts, verification gating, image upload, options,
          handleCreateProposal, creating state) is unchanged. */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={[createStyles.container, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Top bar — circular close, proposal allowance in mono on the right */}
          <View style={createStyles.topBar}>
            <TouchableOpacity
              onPress={() => setShowCreateModal(false)}
              style={[createStyles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {usageLimits &&
              (usageLimits.proposals.limit === 'unlimited' ? (
                <Text style={[createStyles.topMeta, { color: colors.textTertiary }]}>
                  UNLIMITED · PREMIUM
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setShowCreateModal(false);
                    router.push('/modals/subscription');
                  }}
                  style={createStyles.topMetaRow}
                  accessibilityRole="button"
                  accessibilityLabel="Proposal allowance — tap to upgrade"
                >
                  <Text style={[createStyles.topMeta, { color: colors.textTertiary }]}>
                    {usageLimits.proposals.used} OF {usageLimits.proposals.limit} THIS{' '}
                    {String(usageLimits.proposals.period).toUpperCase()}
                  </Text>
                  <Text style={[createStyles.topMetaUpgrade, { color: colors.gold }]}>UPGRADE</Text>
                </TouchableOpacity>
              ))}
          </View>

          <ScrollView
            style={createStyles.scroll}
            contentContainerStyle={createStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[createStyles.pageTitle, { color: colors.text }]}>New Proposal</Text>

            {/* THE QUESTION — serif input, gold border while focused */}
            <View style={createStyles.section}>
              <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>THE QUESTION</Text>
              <View
                style={[
                  createStyles.questionCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: createFocusField === 'question' ? 'rgba(234, 186, 88, 0.4)' : colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[
                    createStyles.questionInput,
                    { color: colors.text, fontFamily: newProposal.title ? FONTS.serif : FONTS.serifItalic },
                  ]}
                  placeholder="Should your community…?"
                  placeholderTextColor={colors.textTertiary}
                  value={newProposal.title}
                  onChangeText={(t) => setNewProposal((p) => ({ ...p, title: t }))}
                  onFocus={() => setCreateFocusField('question')}
                  onBlur={() => setCreateFocusField(null)}
                  multiline
                  maxLength={140}
                />
                <Text style={[createStyles.questionMeta, { color: colors.textTertiary }]}>
                  {newProposal.title.length} / 140 · PHRASED AS A NEUTRAL QUESTION
                </Text>
              </View>
            </View>

            {/* THE DETAILS — description, unchanged wiring */}
            <View style={createStyles.section}>
              <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>THE DETAILS</Text>
              <View
                style={[
                  createStyles.detailsCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: createFocusField === 'details' ? 'rgba(234, 186, 88, 0.4)' : colors.border,
                  },
                ]}
              >
                <TextInput
                  style={[createStyles.detailsInput, { color: colors.text }]}
                  placeholder="Add the context voters need — what changes, what it costs, who decides."
                  placeholderTextColor={colors.textTertiary}
                  value={newProposal.description}
                  onChangeText={(t) => setNewProposal((p) => ({ ...p, description: t }))}
                  onFocus={() => setCreateFocusField('details')}
                  onBlur={() => setCreateFocusField(null)}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            {/* IMAGE — optional, same picker logic */}
            <View style={createStyles.section}>
              <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>IMAGE · OPTIONAL</Text>
              <TouchableOpacity
                style={[createStyles.imageCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Add an image"
              >
                {newProposal.imageUri ? (
                  <Image source={{ uri: newProposal.imageUri }} style={createStyles.imagePreview} />
                ) : (
                  <View style={createStyles.imageEmpty}>
                    <Ionicons name="image-outline" size={26} color={colors.textTertiary} />
                    <Text style={[createStyles.imageEmptyText, { color: colors.textTertiary }]}>
                      Tap to add image
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {!!newProposal.imageUri && (
                <TouchableOpacity
                  style={createStyles.imageRemoveBtn}
                  onPress={() => setNewProposal((p) => ({ ...p, imageUri: '' }))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove image"
                >
                  <Ionicons name="trash-outline" size={14} color={colors.error} />
                  <Text style={[createStyles.imageRemoveText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* SCOPE — geo reach chips; non-global scopes still gate on verification */}
            <View style={createStyles.section}>
              <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>SCOPE</Text>
              <View style={createStyles.chipRow}>
                {[
                  { key: 'global' as const, label: 'Global' },
                  ...(userCountry ? [{ key: 'national' as const, label: userCountry }] : []),
                  ...(userCountry && userState ? [{ key: 'state' as const, label: userState }] : []),
                  ...(userCountry && userCity ? [{ key: 'city' as const, label: userCity }] : []),
                ].map((scope) => {
                  const active = newProposal.geoScope === scope.key;
                  return (
                    <TouchableOpacity
                      key={scope.key}
                      onPress={() => setNewProposal((p) => ({ ...p, geoScope: scope.key }))}
                      style={[
                        createStyles.scopeChip,
                        active
                          ? { backgroundColor: colors.goldFill, borderColor: 'transparent' }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          active ? createStyles.scopeChipTextActive : createStyles.scopeChipText,
                          { color: active ? '#040707' : colors.textSecondary },
                        ]}
                      >
                        {scope.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[createStyles.scopeHint, { color: colors.textTertiary }]}>
                {newProposal.geoScope === 'global'
                  ? 'Anyone can vote'
                  : newProposal.geoScope === 'national'
                  ? `All of ${userCountry}`
                  : newProposal.geoScope === 'state'
                  ? `${userState} only`
                  : `${userCity} only`}
              </Text>
              {!userCountry && (
                <View
                  style={[createStyles.infoBanner, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                >
                  <Ionicons name="information-circle-outline" size={18} color={colors.info} />
                  <View style={createStyles.infoBannerText}>
                    <Text style={[createStyles.infoBannerTitle, { color: colors.text }]}>Global proposals only</Text>
                    <Text style={[createStyles.infoBannerDesc, { color: colors.textSecondary }]}>
                      Verify your identity ($4.99) to create proposals for your specific region.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* BALLOT TYPE — segmented control; defaults to yes-no for backward compat */}
            <View style={createStyles.section}>
              <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>BALLOT TYPE</Text>
              <View
                style={[
                  createStyles.segmentWrap,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle },
                ]}
              >
                {[
                  { value: 'yes-no' as const, label: 'Support / Oppose' },
                  { value: 'ranked-choice' as const, label: 'Ranked' },
                  { value: 'multiple-choice' as const, label: 'Multiple' },
                ].map((seg) => {
                  const active = newProposal.voteType === seg.value;
                  return (
                    <TouchableOpacity
                      key={seg.value}
                      onPress={() => setNewProposal((p) => ({ ...p, voteType: seg.value }))}
                      style={[createStyles.segmentCell, active && { backgroundColor: colors.surfaceHighlight }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          active ? createStyles.segmentTextActive : createStyles.segmentText,
                          { color: active ? colors.text : colors.textTertiary },
                        ]}
                      >
                        {seg.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {newProposal.voteType === 'ranked-choice' && (
                <Text style={[createStyles.scopeHint, { color: colors.textTertiary }]}>
                  Voters rank options in order of preference. Winner determined by instant-runoff (IRV).
                </Text>
              )}
            </View>

            {/* Options list — required for ranked / multiple ballots */}
            {newProposal.voteType !== 'yes-no' && (
              <View style={createStyles.section}>
                <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>OPTIONS</Text>
                {newProposal.options.map((opt, idx) => (
                  <View key={idx} style={createStyles.optionRow}>
                    <TextInput
                      style={[
                        createStyles.optionInput,
                        { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                      ]}
                      placeholder={`Option ${idx + 1}`}
                      placeholderTextColor={colors.textTertiary}
                      value={opt}
                      onChangeText={(t) =>
                        setNewProposal((p) => {
                          const next = [...p.options];
                          next[idx] = t;
                          return { ...p, options: next };
                        })
                      }
                      maxLength={120}
                    />
                    {newProposal.options.length > 2 && (
                      <TouchableOpacity
                        onPress={() =>
                          setNewProposal((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }))
                        }
                        style={createStyles.optionRemove}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove option ${idx + 1}`}
                      >
                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {newProposal.options.length < 10 && (
                  <TouchableOpacity
                    onPress={() => setNewProposal((p) => ({ ...p, options: [...p.options, ''] }))}
                    style={createStyles.addOptionBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Add option"
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colors.gold} />
                    <Text style={[createStyles.addOptionText, { color: colors.gold }]}>Add option</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* CATEGORY — same chips, same wiring */}
            <View style={createStyles.section}>
              <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>CATEGORY</Text>
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

            {/* Eligibility & deadline settings card */}
            <View style={[createStyles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={[createStyles.settingRow, { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                <View style={createStyles.settingText}>
                  <Text style={[createStyles.settingTitle, { color: colors.text }]}>Citizens only</Text>
                  <Text style={[createStyles.settingSub, { color: colors.textTertiary }]}>
                    Verified citizenship (passport + proof of address) required to vote
                  </Text>
                </View>
                <Switch
                  value={newProposal.requiresCitizenship}
                  onValueChange={(v) => setNewProposal((p) => ({ ...p, requiresCitizenship: v }))}
                  trackColor={{ false: colors.border, true: colors.goldFill }}
                  thumbColor={newProposal.requiresCitizenship ? '#040707' : '#f4f3f4'}
                />
              </View>
              <View style={createStyles.settingRow}>
                <View style={createStyles.settingText}>
                  <Text style={[createStyles.settingTitle, { color: colors.text }]}>Deadline</Text>
                  <Text style={[createStyles.settingSub, { color: colors.textTertiary }]}>
                    Voting closes automatically
                  </Text>
                </View>
                <Text
                  style={[
                    createStyles.settingValue,
                    { color: colors.textSecondary, backgroundColor: colors.surfaceHighlight },
                  ]}
                >
                  SET ON PUBLISH
                </Text>
              </View>
            </View>

            {/* WHO CAN VOTE — demographics, optional (unchanged wiring) */}
            <View style={createStyles.section}>
              <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>WHO CAN VOTE · OPTIONAL</Text>
              <Text style={[createStyles.subLabel, { color: colors.textSecondary }]}>Age group</Text>
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
              <Text style={[createStyles.subLabel, { color: colors.textSecondary, marginTop: 8 }]}>Gender</Text>
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
          </ScrollView>

          {/* Pinned gold CTA — the one gold moment on this screen */}
          <View
            style={[
              createStyles.footer,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.borderSubtle,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <TouchableOpacity
              style={[createStyles.submitBtn, { backgroundColor: colors.goldFill }, creating && createStyles.btnDisabled]}
              onPress={handleCreateProposal}
              disabled={creating}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Create proposal"
            >
              {creating ? (
                <ActivityIndicator size="small" color="#040707" />
              ) : (
                <Text style={createStyles.submitText}>Create Proposal</Text>
              )}
            </TouchableOpacity>
            <Text style={[createStyles.footerNote, { color: colors.textTertiary }]}>
              Published proposals cannot be edited — only withdrawn
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* X1 confirm-before-cast sheet — mandatory before every cast. Driven
          by pendingVote: requestVote opens it in its confirm phase, Cast
          Ballot fires confirmPendingVote (the only path that submits), then
          the same sheet transitions to its gold seal + share state and
          auto-dismisses by clearing pendingVote. */}
      <VoteConfirmationOverlay
        visible={!!pendingVote}
        voteType={pendingVote?.vote ?? lastVoteType}
        question={pendingVote?.proposal.title}
        onConfirm={confirmPendingVote}
        onDismiss={() => setPendingVote(null)}
        onShare={() => {
          const last = lastVotedRef.current;
          if (last) shareVoteAchievement(last.title, lastVoteType, last.id);
        }}
      />

      {/* P3 · How voting works — rules sheet, opened from the queue's info glyph */}
      <HowVotingWorksSheet visible={showHowVoting} onClose={() => setShowHowVoting(false)} />

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

// Premium proposal detail modal styles
const detailStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(4,7,7,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Hero
  hero: {
    width: '100%',
    height: 320,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: BG_RAISED,
  },
  heroLocationPill: {
    position: 'absolute',
    top: 64,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(4,7,7,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroLocationText: {
    fontSize: 11,
    fontFamily: FONTS.sansMedium,
    color: FG,
    letterSpacing: -0.2,
  },
  heroTimePill: {
    position: 'absolute',
    top: 64,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(4,7,7,0.55)',
    borderWidth: 1,
    borderColor: `${GOLD}55`,
  },
  heroTimePillText: {
    fontSize: 10.5,
    fontFamily: FONTS.sansSemiBold,
    color: GOLD,
    letterSpacing: 0.3,
  },
  heroCategoryTag: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: 'rgba(4,7,7,0.7)',
    borderWidth: 1,
  },
  heroCategoryDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  heroCategoryText: {
    fontFamily: MONO_FONT,
    fontSize: 9.5,
    letterSpacing: 1.4,
  },
  // Body
  body: {
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  tierLabel: {
    fontFamily: MONO_FONT,
    fontSize: 9.5,
    color: FG_FAINT,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontFamily: SERIF_FONT,
    fontSize: 30,
    lineHeight: 36,
    color: FG,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  proposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 18,
  },
  proposerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BG_RAISED,
    borderWidth: 1,
    borderColor: LINE_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposerDot: {
    fontSize: 16,
    color: GOLD,
    lineHeight: 16,
    marginTop: -4,
  },
  proposerText: {
    fontSize: 12.5,
    color: FG_MUTED,
    letterSpacing: -0.1,
  },
  description: {
    fontSize: 14.5,
    lineHeight: 22,
    color: FG_MUTED,
    letterSpacing: -0.1,
    marginBottom: 26,
  },
  // Sentiment
  sentimentSection: {
    paddingTop: 18,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: LINE_COLOR,
    marginBottom: 22,
  },
  sentimentBar: {
    height: 7,
    borderRadius: 3.5,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: LINE_COLOR,
    marginBottom: 12,
  },
  sentimentBarEmpty: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: LINE_COLOR,
    marginBottom: 12,
  },
  sentimentFillSupport: {
    height: '100%',
    backgroundColor: GREEN,
  },
  sentimentFillOppose: {
    height: '100%',
    backgroundColor: RED,
    opacity: 0.85,
  },
  sentimentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sentimentStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  sentimentStatRight: {
    flexDirection: 'row-reverse',
    alignItems: 'baseline',
    gap: 7,
  },
  sentimentNum: {
    fontFamily: SERIF_FONT,
    fontSize: 22,
    letterSpacing: -0.5,
  },
  sentimentLabel: {
    fontSize: 10.5,
    fontFamily: FONTS.sansMedium,
    color: FG_FAINT,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sentimentPct: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: BG_RAISED,
    borderWidth: 1,
    borderColor: LINE_STRONG,
  },
  sentimentPctText: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: FG,
    letterSpacing: 0.3,
  },
  noVotesText: {
    fontSize: 12,
    fontFamily: FONTS.sansMedium,
    color: FG_FAINT,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 4,
  },
  totalVoices: {
    fontFamily: MONO_FONT,
    fontSize: 10.5,
    color: FG_FAINT,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginTop: 14,
  },
  // Actions
  actionRow: {
    marginTop: 4,
  },
  voteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  voteBtnSupport: {
    borderColor: GREEN,
    backgroundColor: `${GREEN}10`,
  },
  voteBtnOppose: {
    borderColor: RED,
    backgroundColor: `${RED}10`,
  },
  voteBtnText: {
    fontSize: 14,
    fontFamily: FONTS.sansSemiBold,
    letterSpacing: 0.3,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: BG_RAISED,
    borderWidth: 1,
    borderColor: LINE_STRONG,
  },
  statusBannerText: {
    fontSize: 13,
    fontFamily: FONTS.sansSemiBold,
    letterSpacing: 0.3,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Swipe Hint Overlay
  swipeHintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  swipeHintCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    width: '85%',
    maxWidth: 320,
  },
  swipeHintTitle: {
    fontFamily: SERIF_FONT,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  swipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  swipeHintIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  swipeHintText: {
    fontSize: 16,
    fontFamily: FONTS.sansMedium,
  },
  swipeHintDismiss: {
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontSize: 14,
  },

  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    // paddingTop is set dynamically via insets
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: { ...TYPOGRAPHY.displaySmall, fontSize: responsive(28, 32, 36) },
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
    borderRadius: BORDER_RADIUS['2xl'],
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
  filterChipText: { ...TYPOGRAPHY.labelSmall,},
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
    borderRadius: BORDER_RADIUS['2xl'],
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
  categoryText: { ...TYPOGRAPHY.labelSmall, textTransform: 'uppercase', letterSpacing: 0.5 },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  civicDeskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  civicDeskText: { ...TYPOGRAPHY.labelSmall, fontSize: 10 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  timeText: { ...TYPOGRAPHY.labelSmall,},
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
  statusText: { ...TYPOGRAPHY.labelMedium,},
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
  voteBtnText: { color: '#fff', ...TYPOGRAPHY.labelMedium,},
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
  emptyBtnText: { color: '#000', ...TYPOGRAPHY.labelLarge,},

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

  // M2 vote controls — big tinted Support / Oppose buttons + skip.
  voteControls: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 14,
    gap: 12,
  },
  voteButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  queueVoteBtn: {
    flex: 1,
    height: 58,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueVoteText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    letterSpacing: 0.1,
  },
  // Non-binary ballots (ranked / multiple-choice) open their dedicated
  // ballot screen instead of a support/oppose pair.
  openBallotBtn: {
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  openBallotText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  skipBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13.5,
    letterSpacing: 0.2,
  },

  // Swipe Card
  swipeCard: {
    position: 'absolute',
    width: SCREEN_WIDTH - SPACING.lg * 2,
    borderRadius: BORDER_RADIUS['2xl'],
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
    letterSpacing: 1,
  },

  // Swipe Empty State
  // E1 · Queue Complete
  queueClearBody: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
    gap: 18,
  },
  queueClearCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  queueClearSeal: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueClearTitle: {
    fontFamily: FONTS.serif,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.48,
  },
  queueClearDesc: {
    fontFamily: FONTS.sans,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 290,
  },
  queueClearStats: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  queueClearStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueClearStatLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  queueClearStatValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  queueClearStatCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  queueClearNote: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  queueClearActions: {
    gap: 4,
  },
  queueClearCta: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueClearCtaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: '#040707',
  },
  queueClearGhost: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  queueClearGhostText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },

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
    fontSize: responsive(20, 22, 24),
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
  },
  swipeVotePercentLarge: {
    color: '#fff',
    ...TYPOGRAPHY.labelSmall,
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
    letterSpacing: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12 · CREATE PROPOSAL — form re-skin styles (serif question, mono metadata,
// chip scope selector, segmented ballot type, settings card, pinned gold CTA)
// ═══════════════════════════════════════════════════════════════════════════════
const createStyles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 14,
    paddingBottom: 6,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.68,
    fontVariant: ['tabular-nums'],
  },
  topMetaUpgrade: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.26,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  pageTitle: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.36,
  },
  section: { gap: 7 },
  sectionLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47,
  },
  subLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    marginTop: 2,
  },
  questionCard: {
    borderWidth: 1.5,
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  questionInput: {
    fontSize: 15.5,
    lineHeight: 22,
    padding: 0,
    minHeight: 44,
  },
  questionMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  detailsCard: {
    borderWidth: 1.5,
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailsInput: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
    padding: 0,
    minHeight: 96,
  },
  imageCard: {
    borderWidth: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  imageEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
    gap: 7,
  },
  imageEmptyText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
  },
  imagePreview: { width: '100%', height: 180 },
  imageRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  imageRemoveText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  scopeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  scopeChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  scopeChipTextActive: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
  },
  scopeHint: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 13,
    padding: 13,
    marginTop: 3,
  },
  infoBannerText: { flex: 1, gap: 2 },
  infoBannerTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
  },
  infoBannerDesc: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
  },
  segmentWrap: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 13,
    padding: 3,
  },
  segmentCell: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
  },
  segmentTextActive: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: FONTS.sans,
    fontSize: 13.5,
  },
  optionRemove: { padding: 6 },
  addOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  addOptionText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
  },
  settingsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 13,
  },
  settingText: { flex: 1, gap: 1 },
  settingTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13.5,
  },
  settingSub: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  settingValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 12,
    gap: 9,
    borderTopWidth: 1,
  },
  submitBtn: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  submitText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  footerNote: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    textAlign: 'center',
  },
});
