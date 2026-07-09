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
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { proposalsApi, userApi, uploadsApi, limitsApi, Proposal, UsageLimits } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { shareProposal, shareVoteAchievement } from '../../lib/share';
import { useTheme, FONTS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';
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
import { VoteConfirmationOverlay, UpgradeModal, TallyBar, HowVotingWorksSheet } from '../../components/ui';
import { checkForNewBadges } from '../../lib/badgeNotification';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ═══════════════════════════════════════════════════════════════════════════════
// 1b · INLINE BALLOT FEED helpers — deadline chips, observer display region
// ═══════════════════════════════════════════════════════════════════════════════

// Observer-picked display region (2a). NEVER affects voting eligibility —
// only what the unverified feed/hero is scoped to. Persisted in AsyncStorage.
type ObserverRegion = { country?: string; state?: string; city?: string };
type VoteReceipt = { side?: 'support' | 'oppose'; at?: number };
type FeedFilter = 'main' | 'city' | 'province' | 'country' | 'voted';

const OBSERVER_REGION_KEY = '@represent_observer_region';

// Hierarchical display-region match: a proposal "belongs" to the region when
// its geoRestrictions prefix-match [country, state, city]. Global proposals
// (no restrictions) always count. An empty region ({} = "Everywhere") or a
// missing region (null = unknown) matches everything.
function proposalMatchesRegion(p: Proposal, region: ObserverRegion | null): boolean {
  const geo = p.geoRestrictions || [];
  if (geo.length === 0) return true;
  if (!region || (!region.country && !region.state && !region.city)) return true;
  const levels = [region.country, region.state, region.city];
  return geo.every((restriction, i) => {
    const level = levels[i];
    return !!level && level.toLowerCase() === restriction.toLowerCase();
  });
}

// Deadline falls before the end of today (local time) and hasn't passed yet.
function isClosingTonight(p: Proposal): boolean {
  if (!p.deadline) return false;
  const t = new Date(p.deadline).getTime();
  if (Number.isNaN(t) || t <= Date.now()) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return t <= endOfToday.getTime();
}

function formatClockTime(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Mono deadline chip: "CLOSES 10:00 PM" tonight, else "21D LEFT" / "5H LEFT".
function deadlineChipLabel(p: Proposal): string {
  if (!p.deadline) return '';
  const t = new Date(p.deadline).getTime();
  if (Number.isNaN(t)) return '';
  const diff = t - Date.now();
  if (diff <= 0) return 'ENDED';
  if (isClosingTonight(p)) return `CLOSES ${formatClockTime(t)}`;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}D LEFT`;
  return `${Math.max(1, Math.floor(diff / (1000 * 60 * 60)))}H LEFT`;
}

// Deadline-ascending sort key; undated proposals sink to the bottom.
function deadlineMs(p: Proposal): number {
  if (!p.deadline) return Number.MAX_SAFE_INTEGER;
  const t = new Date(p.deadline).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

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

// ── 1b · BALLOT FEED CARD ───────────────────────────────────────────────────
// Scope chip · serif question · compact tally · inline Support / Oppose / "…"
// (verified) or one locked "Verify to cast your ballot" row (observer, 2a).
interface BallotCardProps {
  proposal: Proposal;
  observer: boolean;
  isVoting: boolean;
  onSupport: () => void;
  onOppose: () => void;
  onOpen: () => void;
  onVerify: () => void;
  index: number;
}

function BallotCard({
  proposal,
  observer,
  isVoting,
  onSupport,
  onOppose,
  onOpen,
  onVerify,
  index,
}: BallotCardProps) {
  const { colors } = useTheme();

  const closingTonight = isClosingTonight(proposal);
  const tierLabel = getTierLabel(proposal.geoRestrictions);
  const location = getLocationLabel(proposal.geoRestrictions);
  const scopeLabel = (tierLabel === 'GLOBAL' ? 'GLOBAL' : `${location} · ${tierLabel}`).toUpperCase();
  const voteType = (proposal as any).voteType || 'yes-no';
  const optionCount = ((proposal as any).options || []).length;
  const totalBallots = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const ended = isProposalEnded(proposal);
  const deadlineLabel = deadlineChipLabel(proposal);

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(Math.min(index, 8) * 50).duration(350)}
      style={[
        ballotStyles.card,
        {
          backgroundColor: colors.surface,
          // Gold-tinted border for ballots that close tonight, per 1b.
          borderColor: closingTonight ? 'rgba(234, 186, 88, 0.3)' : colors.borderSubtle,
        },
      ]}
      onPress={onOpen}
      activeOpacity={0.94}
      accessibilityRole="button"
      accessibilityLabel={`Open ${proposal.title}`}
    >
      {/* Scope chip + deadline (mono, gold when closing tonight) */}
      <View style={ballotStyles.topRow}>
        <View style={ballotStyles.topLeft}>
          <Text style={[ballotStyles.scopeChip, { color: colors.textTertiary, backgroundColor: colors.surfaceHighlight }]}>
            {scopeLabel}
          </Text>
          {proposal.requiresCitizenship && (
            <Text style={[ballotStyles.scopeChip, { color: colors.textTertiary, backgroundColor: colors.surfaceHighlight }]}>
              CITIZENS ONLY
            </Text>
          )}
        </View>
        {deadlineLabel ? (
          closingTonight ? (
            <View style={ballotStyles.deadlineRow}>
              <View style={[ballotStyles.deadlineDot, { backgroundColor: colors.gold }]} />
              <Text style={[ballotStyles.deadlineTextUrgent, { color: colors.gold }]}>{deadlineLabel}</Text>
            </View>
          ) : (
            <Text style={[ballotStyles.deadlineText, { color: deadlineLabel === 'ENDED' ? colors.oppose : colors.textTertiary }]}>
              {deadlineLabel}
            </Text>
          )
        ) : null}
      </View>

      {/* Serif ballot question */}
      <Text style={[ballotStyles.question, { color: colors.text }]} numberOfLines={3}>
        {proposal.title}
      </Text>

      {/* Tally — TallyBar enforces the 25-ballot threshold (dots below it) */}
      {voteType !== 'yes-no' ? (
        <View style={ballotStyles.optionsRow}>
          <Text style={[ballotStyles.optionsText, { color: colors.textSecondary }]}>
            {optionCount || 2} OPTIONS · {voteType === 'ranked-choice' ? 'RANK YOUR CHOICES' : 'PICK ONE'}
          </Text>
          <Text style={[ballotStyles.optionsText, { color: colors.textTertiary }]}>
            {totalBallots.toLocaleString('en-CA')} VERIFIED BALLOTS
          </Text>
        </View>
      ) : (
        <TallyBar
          supportCount={proposal.supportVotes || 0}
          opposeCount={proposal.opposeVotes || 0}
          variant="compact"
          applyThreshold={!ended}
        />
      )}

      {/* Action row — 2a observers get one locked verification row instead */}
      {observer ? (
        <TouchableOpacity
          style={[ballotStyles.lockedRow, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={(e) => {
            e.stopPropagation();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onVerify();
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Verify to cast your ballot"
        >
          <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
          <Text style={[ballotStyles.lockedText, { color: colors.textSecondary }]}>Verify to cast your ballot</Text>
        </TouchableOpacity>
      ) : ended ? (
        <View style={[ballotStyles.endedBanner, { backgroundColor: colors.opposeSurface }]}>
          <Ionicons name="flag-outline" size={13} color={colors.oppose} />
          <Text style={[ballotStyles.endedText, { color: colors.oppose }]}>VOTING CLOSED</Text>
        </View>
      ) : voteType !== 'yes-no' ? (
        // Non-binary ballots: one full-width gold entry into the ballot screen
        <View style={ballotStyles.actionRow}>
          <TouchableOpacity
            style={[ballotStyles.openBallotBtn, { backgroundColor: colors.goldFill }]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onOpen();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Open ballot for ${proposal.title}`}
          >
            <Text style={ballotStyles.openBallotText} numberOfLines={1}>
              Open Ballot — {voteType === 'ranked-choice' ? 'Rank Your Choices' : 'Pick One'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[ballotStyles.moreBtn, { backgroundColor: colors.surfaceHighlight }]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOpen();
            }}
            accessibilityRole="button"
            accessibilityLabel={`More about ${proposal.title}`}
          >
            <Text style={[ballotStyles.moreText, { color: colors.textSecondary }]}>…</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={ballotStyles.actionRow}>
          <TouchableOpacity
            style={[
              ballotStyles.voteBtn,
              { backgroundColor: colors.supportSurface, borderColor: colors.support },
              isVoting && ballotStyles.btnDisabled,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onSupport();
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
              <Text style={[ballotStyles.voteBtnText, { color: colors.support }]}>Support</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              ballotStyles.voteBtn,
              { backgroundColor: colors.opposeSurface, borderColor: colors.oppose },
              isVoting && ballotStyles.btnDisabled,
            ]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onOppose();
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
              <Text style={[ballotStyles.voteBtnText, { color: colors.oppose }]}>Oppose</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[ballotStyles.moreBtn, { backgroundColor: colors.surfaceHighlight }]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onOpen();
            }}
            accessibilityRole="button"
            accessibilityLabel={`More about ${proposal.title}`}
          >
            <Text style={[ballotStyles.moreText, { color: colors.textSecondary }]}>…</Text>
          </TouchableOpacity>
        </View>
      )}
    </AnimatedTouchable>
  );
}

// Voted cards collapse into a compact gold receipt row (1b). The side/time
// only render when the user's actual ballot data is available — never guessed.
function VotedReceiptRow({
  proposal,
  receipt,
  onOpen,
}: {
  proposal: Proposal;
  receipt?: VoteReceipt;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const parts = ['YOUR BALLOT'];
  if (receipt?.side) parts.push(receipt.side.toUpperCase());
  parts.push(receipt?.at ? `RECORDED ${formatClockTime(receipt.at)}` : 'RECORDED');

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <TouchableOpacity
        style={[ballotStyles.receiptCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
        onPress={onOpen}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Receipt for ${proposal.title}`}
      >
        <View style={[ballotStyles.receiptCheck, { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.25)' }]}>
          <Ionicons name="checkmark" size={17} color={colors.gold} />
        </View>
        <View style={ballotStyles.receiptBody}>
          <Text style={[ballotStyles.receiptTitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {proposal.title}
          </Text>
          <Text style={[ballotStyles.receiptMeta, { color: colors.gold }]} numberOfLines={1}>
            {parts.join(' · ')}
          </Text>
        </View>
        <Text style={[ballotStyles.receiptLink, { color: colors.textTertiary }]}>Receipt →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const ballotStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 17,
    paddingHorizontal: 18,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  topLeft: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scopeChip: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.14,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
    overflow: 'hidden',
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  deadlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deadlineTextUrgent: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  deadlineText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  question: {
    fontFamily: FONTS.serif,
    fontSize: 18.5,
    lineHeight: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  optionsText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  actionRow: {
    flexDirection: 'row',
    gap: 9,
  },
  voteBtn: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBtnText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14.5,
  },
  moreBtn: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 16,
    marginTop: -6,
  },
  openBallotBtn: {
    flex: 1,
    height: 46,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  openBallotText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14.5,
    color: '#040707',
  },
  lockedRow: {
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  lockedText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
  },
  endedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 13,
  },
  endedText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.1,
  },
  btnDisabled: { opacity: 0.6 },
  // Receipt row (voted)
  receiptCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    opacity: 0.85,
  },
  receiptCheck: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptBody: {
    flex: 1,
    gap: 1,
  },
  receiptTitle: {
    fontFamily: FONTS.serif,
    fontSize: 14.5,
    lineHeight: 19,
  },
  receiptMeta: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 0.57,
    fontVariant: ['tabular-nums'],
  },
  receiptLink: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
});

// Memoized feed card: without this, every parent re-render (vote counts,
// filters) re-renders every visible card. Callback props are intentionally
// ignored — they close over the item and are stable per data identity.
const MemoBallotCard = React.memo(BallotCard, (prev, next) => (
  prev.proposal === next.proposal &&
  prev.observer === next.observer &&
  prev.isVoting === next.isVoting
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
  const { colors, isDark } = useTheme();
  const { isAuthenticated, user } = useAuthStore();
  const { proposalId: deepLinkProposalId } = useLocalSearchParams<{ proposalId?: string }>();
  const insets = useSafeAreaInsets();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [claimedTokens, setClaimedTokens] = useState<Set<number | string>>(new Set());
  const [votedProposals, setVotedProposals] = useState<Set<number | string>>(new Set());
  // Receipt metadata (side / recorded-at) for the collapsed voted rows. Only
  // populated from the user's actual ballots — never guessed.
  const [voteReceipts, setVoteReceipts] = useState<Map<string, VoteReceipt>>(new Map());
  const [votingProposalId, setVotingProposalId] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  // Create form: which field is focused (drives the gold active-field border).
  const [createFocusField, setCreateFocusField] = useState<'question' | 'details' | null>(null);
  // CP1/CP2 · create flow step — 1 = composer, 2 = preview & publish.
  // Reset to 1 every time the modal opens.
  const [createStep, setCreateStep] = useState<1 | 2>(1);
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

  // X1 confirm-before-cast sheet state. EVERY cast — feed card, detail
  // modal — must pass through this pending state; nothing is submitted
  // until the user confirms on the sheet.
  const [pendingVote, setPendingVote] = useState<{
    proposal: Proposal;
    vote: 'support' | 'oppose';
    source: 'list' | 'detail';
  } | null>(null);
  const [lastVoteType, setLastVoteType] = useState<'support' | 'oppose'>('support');
  // Context for the post-vote "Share your vote" pill on the confirmation
  // overlay — the user's just-cast vote is the highest-motivation share
  // moment in the app.
  const lastVotedRef = useRef<{ id: number | string; title: string } | null>(null);

  // Vote queue for sequential processing of real (non-seed) votes
  const voteQueueRef = useRef<Array<{ proposalId: number | string; vote: 'support' | 'oppose'; title: string }>>([]);
  const isProcessingQueueRef = useRef(false);

  // 1b feed state — active filter chip, header search toggle, receipts that
  // just collapsed in place this session (so a fresh vote stays visible in
  // the To Vote feed as a receipt instead of vanishing).
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('main');
  const [showSearch, setShowSearch] = useState(false);
  const [sessionVotedIds, setSessionVotedIds] = useState<Set<string>>(new Set());

  // 2a observer display region (picked, persisted). Display scoping only.
  const [observerRegion, setObserverRegion] = useState<ObserverRegion | null>(null);
  const [showRegionPicker, setShowRegionPicker] = useState(false);

  // D1 · verified-residence mismatch sheet. Once a user is verified their
  // declared (onboarding-picked) region is consumed exactly once: deleted
  // from storage either way, and surfaced as a calm, factual sheet only
  // when it named a different city/state than the verified residence.
  const [mismatchDeclared, setMismatchDeclared] = useState<ObserverRegion | null>(null);
  const observerRegionConsumedRef = useRef(false);

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

  // Hydrate the observer-picked display region (2a). Guard the async
  // setState against unmount; a missing/corrupt value just means "unset".
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(OBSERVER_REGION_KEY)
      .then((value) => {
        if (!alive || !value) return;
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object') setObserverRegion(parsed as ObserverRegion);
        } catch { /* display-only preference — never block on bad data */ }
      })
      .catch(() => { /* display-only preference */ });
    return () => { alive = false; };
  }, []);

  // D1 trigger — runs on feed mount/focus once both the profile (isVerified,
  // verified city/state) and the stored declared region have loaded. Verified
  // users never use the observer region again, so it's deleted either way;
  // the sheet only shows when the declared region named a DIFFERENT
  // city/state than the verified residence. Matches are consumed silently.
  useEffect(() => {
    if (!isVerified || !observerRegion || observerRegionConsumedRef.current) return;
    observerRegionConsumedRef.current = true;
    const same = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
    const cityDiffers = !!observerRegion.city && !!userCity && !same(observerRegion.city, userCity);
    const stateDiffers = !!observerRegion.state && !!userState && !same(observerRegion.state, userState);
    if (cityDiffers || stateDiffers) setMismatchDeclared(observerRegion);
    setObserverRegion(null);
    AsyncStorage.removeItem(OBSERVER_REGION_KEY).catch(() => { /* display-only */ });
  }, [isVerified, observerRegion, userCity, userState]);

  const pickObserverRegion = useCallback((region: ObserverRegion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setObserverRegion(region);
    setShowRegionPicker(false);
    AsyncStorage.setItem(OBSERVER_REGION_KEY, JSON.stringify(region)).catch(() => { /* display-only */ });
  }, []);

  // LOCATION LOGIC for the observer hero + feed scoping.
  // Tier 1: the user's own city/state/country from their profile, if set.
  // Tier 2: the observer-picked region persisted under OBSERVER_REGION_KEY.
  // Tier 3 (device locale via expo-localization) is skipped — the package
  // isn't installed and timezone heuristics aren't reliable enough to name
  // a region. Tier 4: null → unscoped totals, no region ever named.
  const displayRegion = useMemo<ObserverRegion | null>(() => {
    if (userCountry || userState || userCity) {
      return {
        country: userCountry || undefined,
        state: userState || undefined,
        city: userCity || undefined,
      };
    }
    return observerRegion;
  }, [userCountry, userState, userCity, observerRegion]);

  const filteredProposals = useMemo(() => {
    const mutedSet = new Set(mutedUserIds);
    // Reverse to show most recent proposals first
    return [...proposals].reverse().filter((proposal) => {
      // Hide proposals from muted creators. Backend should filter too once the
      // mute endpoint is live; this is the client-side belt for offline + lag.
      const creatorId = (proposal as any).creatorId || (proposal as any).userId;
      if (creatorId && mutedSet.has(String(creatorId))) return false;

      // Observer mode (2a): counts are public, so unverified users see the
      // real feed scoped to their display region (global ballots always
      // show). The region NEVER affects eligibility — canUserVoteOnProposal
      // and the locked action row still gate every cast.
      if (!isVerified && !proposalMatchesRegion(proposal, displayRegion)) return false;

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
    displayRegion,
  ]);

  const hasVotedOn = useCallback(
    (p: Proposal) => votedProposals.has(p.id as number) || votedProposals.has(p.id as any),
    [votedProposals],
  );

  // Open, unmuted proposals — the raw pool behind the observer hero count,
  // the region picker counts, and the "To Vote" chip badge.
  const openBallots = useMemo(() => {
    const mutedSet = new Set(mutedUserIds);
    return proposals.filter((p) => {
      const creatorId = (p as any).creatorId || (p as any).userId;
      if (creatorId && mutedSet.has(String(creatorId))) return false;
      return !isProposalEnded(p);
    });
  }, [proposals, mutedUserIds]);

  // Hero count (2a): open ballots matching the display region hierarchically
  // (global ones always count).
  const heroCount = useMemo(
    () => openBallots.filter((p) => proposalMatchesRegion(p, displayRegion)).length,
    [openBallots, displayRegion],
  );

  // "To Vote" chip badge — unvoted, open, eligible (the queue-clear truth).
  const toVoteCount = useMemo(() => {
    if (!isVerified) return heroCount;
    return openBallots.filter(
      (p) => !hasVotedOn(p) && canUserVoteOnProposal(p, userCountry, userState, userCity, isVerified),
    ).length;
  }, [openBallots, hasVotedOn, userCountry, userState, userCity, isVerified, heroCount]);

  // ── The 1b feed ────────────────────────────────────────────────────────────
  // To Vote (default): unvoted + open + eligible (the old queue logic) —
  // plus any ballot cast this session, which collapses in place to a receipt.
  // City/Province/Country chips narrow the same feed by geo level (via
  // selectedGeoLevel inside filteredProposals). Voted: the user's ballots.
  // Observer: every open ballot in the display region, votable or not.
  const feedData = useMemo(() => {
    let base: Proposal[];
    if (isVerified && feedFilter === 'voted') {
      base = filteredProposals.filter((p) => hasVotedOn(p));
    } else if (!isVerified) {
      base = filteredProposals.filter((p) => !isProposalEnded(p));
    } else {
      base = filteredProposals.filter((p) => {
        if (hasVotedOn(p)) return sessionVotedIds.has(String(p.id));
        return (
          !isProposalEnded(p) &&
          canUserVoteOnProposal(p, userCountry, userState, userCity, isVerified)
        );
      });
    }
    // Sorted by deadline — closing soonest first; undated ballots last.
    const sorted = [...base].sort((a, b) => deadlineMs(a) - deadlineMs(b));
    // Bring the deep-linked proposal to the top of the feed so it's the
    // first card when the user backs out of the detail modal.
    if (deepLinkProposalId) {
      const idx = sorted.findIndex((p) => String(p.id) === String(deepLinkProposalId));
      if (idx > 0) {
        const [target] = sorted.splice(idx, 1);
        sorted.unshift(target);
      }
    }
    return sorted;
  }, [
    filteredProposals,
    feedFilter,
    isVerified,
    hasVotedOn,
    sessionVotedIds,
    userCountry,
    userState,
    userCity,
    deepLinkProposalId,
  ]);

  // Gold meta count: unvoted feed ballots whose deadline lands before the
  // end of today.
  const closeTonightCount = useMemo(
    () => feedData.filter((p) => !hasVotedOn(p) && isClosingTonight(p)).length,
    [feedData, hasVotedOn],
  );

  // Region rows for the observer picker — derived ONLY from the open
  // proposals' actual geoRestrictions (distinct cities, provinces, then
  // "All of {country}" and "Everywhere"), each with its open-ballot count.
  const regionOptions = useMemo(() => {
    if (isVerified) return [];
    const cities: { key: string; label: string; region: ObserverRegion }[] = [];
    const states: { key: string; label: string; region: ObserverRegion }[] = [];
    const countries: { key: string; label: string; region: ObserverRegion }[] = [];
    const seen = new Set<string>();
    for (const p of openBallots) {
      const geo = p.geoRestrictions || [];
      if (geo.length >= 3) {
        const key = `city:${geo[0]}|${geo[1]}|${geo[2]}`;
        if (!seen.has(key)) {
          seen.add(key);
          cities.push({ key, label: geo[2], region: { country: geo[0], state: geo[1], city: geo[2] } });
        }
      }
      if (geo.length >= 2) {
        const key = `state:${geo[0]}|${geo[1]}`;
        if (!seen.has(key)) {
          seen.add(key);
          states.push({ key, label: geo[1], region: { country: geo[0], state: geo[1] } });
        }
      }
      if (geo.length >= 1) {
        const key = `country:${geo[0]}`;
        if (!seen.has(key)) {
          seen.add(key);
          countries.push({ key, label: `All of ${geo[0]}`, region: { country: geo[0] } });
        }
      }
    }
    const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label);
    cities.sort(byLabel);
    states.sort(byLabel);
    countries.sort(byLabel);
    const rows = [...cities, ...states, ...countries, { key: 'everywhere', label: 'Everywhere', region: {} as ObserverRegion }];
    return rows.map((row) => ({
      ...row,
      count: openBallots.filter((p) => proposalMatchesRegion(p, row.region)).length,
    }));
  }, [isVerified, openBallots]);

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
          // Capture receipt metadata (side / recorded-at) when the API
          // provides it — the receipt row only claims what we actually know.
          const receipts = new Map<string, VoteReceipt>();
          for (const v of votedRes.data as any[]) {
            if (!v || typeof v !== 'object') continue;
            const id = v.proposalId ?? v.id;
            if (id == null) continue;
            const rawSide = v.vote ?? v.side ?? v.voteChoice;
            const side = rawSide === 'support' || rawSide === 'oppose' ? rawSide : undefined;
            const rawAt = v.votedAt ?? v.createdAt ?? v.timestamp;
            const at = rawAt ? Date.parse(String(rawAt)) : NaN;
            receipts.set(String(id), { side, at: Number.isFinite(at) ? at : undefined });
          }
          setVoteReceipts((prev) => {
            const next = new Map(receipts);
            // Keep richer session-local receipts (we always know side + time).
            prev.forEach((val, key) => {
              const server = next.get(key);
              if (!server || (!server.side && val.side)) next.set(key, val);
            });
            return next;
          });
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
      setVoteReceipts((prev) => new Map(prev).set(String(proposalId), { side: vote, at: Date.now() }));
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
      setVoteReceipts((prev) => new Map(prev).set(String(proposalId), { side: vote, at: Date.now() }));

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
  // Step 1: any vote intent (feed card, detail modal) lands here and opens
  // the mandatory confirm sheet. Non-binary ballots are
  // routed to their dedicated ballot screen instead — a support/oppose sheet
  // would misrepresent a ranked or multiple-choice ballot.
  const requestVote = (
    proposal: Proposal,
    vote: 'support' | 'oppose',
    source: 'list' | 'detail',
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
  // anything get submitted. Real (non-seed) casts go through the sequential
  // vote queue (blockchain nonce collisions) — inline feed voting makes
  // rapid back-to-back casts the normal case.
  const confirmPendingVote = () => {
    const pending = pendingVote;
    if (!pending) return;
    const { proposal, vote } = pending;

    // Keep the just-voted card in place in the To Vote feed, collapsed to a
    // receipt row. (The receipt itself only renders once votedProposals
    // confirms the ballot landed — a failed cast leaves the card actionable.)
    setSessionVotedIds((prev) => new Set([...prev, String(proposal.id)]));

    if (!isSeedProposal(proposal.id)) {
      voteQueueRef.current.push({ proposalId: proposal.id, vote, title: proposal.title || 'Untitled' });
      processVoteQueue();
    } else {
      handleVote(proposal.id, vote);
    }
  };

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

  // CP1 → CP2 · "Preview Ballot" — the required-field validation runs BEFORE
  // the preview step; every limit/verification gate stays on final publish
  // (handleCreateProposal, unchanged).
  const handlePreviewBallot = () => {
    if (!newProposal.title.trim()) {
      Alert.alert('Error', 'Please enter a proposal title.');
      return;
    }
    if (!newProposal.description.trim()) {
      Alert.alert('Error', 'Please enter a proposal description.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreateStep(2);
  };

  // CP2 preview derivations — built from the SAME inputs handleCreateProposal
  // publishes (geoRestrictions construction mirrors it exactly), so the
  // preview card is honest. No voter counts are invented: the app has no
  // eligible-voter data, so the facts strip states the scope instead.
  const previewGeo: string[] =
    newProposal.geoScope === 'global' || !userCountry
      ? []
      : newProposal.geoScope === 'national'
      ? [userCountry]
      : newProposal.geoScope === 'state'
      ? [userCountry, userState].filter(Boolean)
      : [userCountry, userState, userCity].filter(Boolean);
  const previewScopeLabel = (
    getTierLabel(previewGeo) === 'GLOBAL'
      ? 'GLOBAL'
      : `${getLocationLabel(previewGeo)} · ${getTierLabel(previewGeo)}`
  ).toUpperCase();
  const previewScopeName =
    newProposal.geoScope === 'city' && userCity
      ? userCity
      : newProposal.geoScope === 'state' && userState
      ? userState
      : newProposal.geoScope === 'national' && userCountry
      ? userCountry
      : '';
  const previewOptionCount = newProposal.options.map((o) => o.trim()).filter(Boolean).length;
  // Live neutrality coaching for the composer — purely client-side checks
  // (ends in "?", no loaded words). Never blocks publishing.
  const loadedWordHit = ['finally', 'wasteful', 'obviously', 'corrupt', 'disgraceful', 'ridiculous', 'insane'].find(
    (w) => newProposal.title.toLowerCase().includes(w)
  );
  const questionNeutral = newProposal.title.trim().endsWith('?') && !loadedWordHit;

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

  // Auto-open a proposal when navigated with proposalId param (e.g. from
  // voting history). Consumed exactly once — tab params persist across tab
  // switches, so without clearing it the detail modal would reopen on every
  // return to the Vote tab.
  const consumedDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkProposalId || proposals.length === 0 || loading) return;
    if (consumedDeepLinkRef.current === String(deepLinkProposalId)) return;
    const match = proposals.find((p) => String(p.id) === String(deepLinkProposalId));
    if (match && !showDetailModal) {
      consumedDeepLinkRef.current = String(deepLinkProposalId);
      openProposal(match);
      router.setParams({ proposalId: undefined });
    }
  }, [deepLinkProposalId, proposals, loading]);

  // 2a: every locked affordance (hero CTA, locked card rows) routes into the
  // existing verification flow.
  const goToVerification = useCallback(() => {
    router.push('/modals/verification-payment');
  }, []);

  // Filter chips: To Vote/Open · the user's levels · Voted (verified only).
  // Only levels that actually exist for the user (or observer region) render.
  const filterChips = useMemo(() => {
    const chips: { key: FeedFilter; label: string }[] = [
      { key: 'main', label: isVerified ? 'To Vote' : 'Open' },
    ];
    const chipRegion: ObserverRegion = isVerified
      ? { country: userCountry || undefined, state: userState || undefined, city: userCity || undefined }
      : displayRegion ?? {};
    if (chipRegion.city) chips.push({ key: 'city', label: chipRegion.city });
    if (chipRegion.state) chips.push({ key: 'province', label: chipRegion.state });
    if (chipRegion.country) chips.push({ key: 'country', label: chipRegion.country });
    if (isVerified) chips.push({ key: 'voted', label: 'Voted' });
    return chips;
  }, [isVerified, userCountry, userState, userCity, displayRegion]);

  // Geo chips reuse the existing selectedGeoLevel machinery.
  const selectFeedFilter = useCallback((key: FeedFilter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFeedFilter(key);
    setSelectedGeoLevel(
      key === 'city' ? 'City/Local' : key === 'province' ? 'State/Province' : key === 'country' ? 'National' : 'All',
    );
  }, []);

  // 2a hero copy — a region is only ever named when tiers 1–2 supplied one.
  const heroPlace = displayRegion?.city || displayRegion?.state || displayRegion?.country || null;
  const heroHeadline = heroPlace
    ? `${heroCount} ${heroCount === 1 ? 'ballot is' : 'ballots are'} open in ${heroPlace}`
    : `${heroCount} ${heroCount === 1 ? 'ballot is' : 'ballots are'} open right now`;
  const heroSub = heroPlace
    ? 'Verify once with your ID to cast every one of them.'
    : 'Verify once with your ID to cast yours.';
  const profileHasRegion = !!(userCountry || userState || userCity);

  const detail = selectedProposal;
  const detailHasVoted = detail ? votedProposals.has(detail.id as number) : false;
  const detailIsVoting = detail ? votingProposalId === (detail.id as number) : false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1b · Feed header — serif "Vote" + search / gold New pill; observers
          (2a) get the OBSERVING pill instead (creation requires verification) */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[feedStyles.headerWrap, { paddingTop: insets.top + 14, backgroundColor: colors.background }]}
      >
        <View style={feedStyles.headerRow}>
          <Text style={[feedStyles.headerTitle, { color: colors.text }]}>Vote</Text>
          {isVerified ? (
            <View style={feedStyles.headerActions}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (showSearch) {
                    setSearchQuery('');
                    setShowFilters(false);
                  }
                  setShowSearch(!showSearch);
                }}
                style={[feedStyles.roundBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                accessibilityRole="button"
                accessibilityLabel={showSearch ? 'Close search' : 'Search proposals'}
              >
                <Ionicons name={showSearch ? 'close' : 'search-outline'} size={17} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setCreateStep(1);
                  setShowCreateModal(true);
                }}
                style={[feedStyles.newBtn, { backgroundColor: colors.goldFill }]}
                accessibilityRole="button"
                accessibilityLabel="Create proposal"
              >
                <Ionicons name="add" size={15} color="#040707" />
                <Text style={feedStyles.newBtnText}>New</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[feedStyles.observingPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="eye-outline" size={11} color={colors.textTertiary} />
              <Text style={[feedStyles.observingText, { color: colors.textTertiary }]}>OBSERVING</Text>
            </View>
          )}
        </View>

        {/* Search — toggled from the header. The options glyph opens the
            existing category/status/geo filter panel, wiring unchanged. */}
        {isVerified && showSearch && (
          <Animated.View entering={FadeInDown.duration(220)} style={feedStyles.searchRow}>
            <View style={[feedStyles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
              <TextInput
                style={[feedStyles.searchInput, { color: colors.text }]}
                placeholder="Search proposals..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFilters((v) => !v);
              }}
              style={[
                feedStyles.roundBtn,
                {
                  backgroundColor: hasActiveFilters ? colors.goldSurface : colors.surface,
                  borderColor: hasActiveFilters ? 'rgba(234, 186, 88, 0.4)' : colors.borderSubtle,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="More filters"
            >
              <Ionicons name="options-outline" size={17} color={hasActiveFilters ? colors.gold : colors.textSecondary} />
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>

      {/* Filter Panel — category/status/geo level, unchanged wiring */}
      {isVerified && showSearch && showFilters && (
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

      {/* Feed — one virtualized list for every mode. The hero (2a), filter
          chips, and the SORTED BY DEADLINE meta line scroll with the feed. */}
      {loading ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <ProposalSkeleton key={i} index={i} />
          ))}
        </ScrollView>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={feedStyles.feedContent}
          showsVerticalScrollIndicator={false}
          data={feedData}
          keyExtractor={(p) => String(p.id)}
          ListHeaderComponent={
            <View style={feedStyles.feedHeader}>
              {/* 2a · Verification hero — the one gold moment for observers */}
              {!isVerified && (
                <LinearGradient
                  colors={isDark ? ['#141818', '#0A0D0D', '#040707'] : [colors.surface, colors.backgroundSecondary, colors.background]}
                  locations={[0, 0.6, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.7, y: 1 }}
                  style={[feedStyles.hero, { borderColor: 'rgba(234, 186, 88, 0.4)' }]}
                >
                  <View style={feedStyles.heroTop}>
                    <View style={[feedStyles.heroShield, { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.3)' }]}>
                      <Ionicons name="shield-checkmark-outline" size={22} color={colors.gold} />
                    </View>
                    <View style={feedStyles.heroTextCol}>
                      <Text style={[feedStyles.heroHeadline, { color: colors.text }]}>{heroHeadline}</Text>
                      <Text style={[feedStyles.heroSub, { color: colors.textSecondary }]}>{heroSub}</Text>
                      {!profileHasRegion && (
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowRegionPicker(true);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Change region"
                        >
                          <Text style={[feedStyles.heroRegionLink, { color: colors.textTertiary }]}>
                            {heroPlace ? `Not in ${heroPlace}? Change region →` : 'Choose your region →'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[feedStyles.heroCta, { backgroundColor: colors.goldFill }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      goToVerification();
                    }}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Verify my identity"
                  >
                    <Text style={feedStyles.heroCtaText}>Verify My Identity</Text>
                    <Text style={feedStyles.heroCtaSuffix}>~2 MIN</Text>
                  </TouchableOpacity>
                  <Text style={[feedStyles.heroTrust, { color: colors.textTertiary }]}>
                    CHECKED, NEVER KEPT · ONE PERSON, ONE BALLOT
                  </Text>
                </LinearGradient>
              )}

              {/* Filter chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={feedStyles.chipsScroll}
                contentContainerStyle={feedStyles.chipsRow}
              >
                {filterChips.map((chip) => {
                  const active = feedFilter === chip.key;
                  return (
                    <TouchableOpacity
                      key={chip.key}
                      onPress={() => selectFeedFilter(chip.key)}
                      style={[
                        feedStyles.chip,
                        active
                          ? { backgroundColor: colors.text }
                          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          active ? feedStyles.chipTextActive : feedStyles.chipText,
                          { color: active ? colors.background : colors.textSecondary },
                        ]}
                      >
                        {chip.label}
                      </Text>
                      {chip.key === 'main' && (
                        <Text
                          style={[
                            feedStyles.chipCount,
                            active
                              ? { color: colors.background, backgroundColor: `${colors.background}26` }
                              : { color: colors.textTertiary, backgroundColor: colors.surfaceHighlight },
                          ]}
                        >
                          {toVoteCount}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Meta line — sort order, rules glyph, tonight's closings */}
              <View style={feedStyles.metaRow}>
                <View style={feedStyles.metaLeft}>
                  <Text style={[feedStyles.metaText, { color: colors.textTertiary }]}>SORTED BY DEADLINE</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowHowVoting(true);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel="How voting works"
                  >
                    <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                {closeTonightCount > 0 && (
                  <Text style={[feedStyles.metaTonight, { color: colors.gold }]}>
                    {closeTonightCount} CLOSE TONIGHT
                  </Text>
                )}
              </View>
            </View>
          }
          renderItem={({ item, index }) =>
            hasVotedOn(item) ? (
              <VotedReceiptRow
                proposal={item}
                receipt={voteReceipts.get(String(item.id))}
                onOpen={() => openProposal(item)}
              />
            ) : (
              <MemoBallotCard
                proposal={item}
                observer={!isVerified}
                isVoting={votingProposalId === item.id}
                onSupport={() => requestVote(item, 'support', 'list')}
                onOppose={() => requestVote(item, 'oppose', 'list')}
                onOpen={() => openProposal(item)}
                onVerify={goToVerification}
                index={index}
              />
            )
          }
          ListEmptyComponent={
            feedFilter === 'voted' && isVerified ? (
              <Animated.View entering={FadeIn.duration(300)} style={feedStyles.simpleEmpty}>
                <Text style={[feedStyles.simpleEmptyTitle, { color: colors.text }]}>No ballots yet.</Text>
                <Text style={[feedStyles.simpleEmptyDesc, { color: colors.textSecondary }]}>
                  Ballots you cast collapse into gold receipts here — each one recorded on the public ledger.
                </Text>
              </Animated.View>
            ) : hasActiveFilters ? (
              <Animated.View entering={FadeIn.duration(300)} style={feedStyles.simpleEmpty}>
                <Text style={[feedStyles.simpleEmptyTitle, { color: colors.text }]}>No proposals found</Text>
                <Text style={[feedStyles.simpleEmptyDesc, { color: colors.textSecondary }]}>
                  Nothing matches your search and filters.
                </Text>
                <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                  <Ionicons name="close-circle" size={16} color={colors.error} />
                  <Text style={[styles.clearBtnText, { color: colors.error }]}>Clear all filters</Text>
                </TouchableOpacity>
              </Animated.View>
            ) : !isVerified ? (
              <Animated.View entering={FadeIn.duration(300)} style={feedStyles.simpleEmpty}>
                <Text style={[feedStyles.simpleEmptyTitle, { color: colors.text }]}>No open ballots here.</Text>
                <Text style={[feedStyles.simpleEmptyDesc, { color: colors.textSecondary }]}>
                  {regionOptions.length > 1
                    ? 'Try a different region — or check back soon.'
                    : 'Check back soon.'}
                </Text>
              </Animated.View>
            ) : (
              /* E1 · Queue clear — reused inside the feed area */
              <Animated.View entering={FadeIn.duration(400)} style={feedStyles.queueClearWrap}>
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
                      router.push('/(tabs)/results');
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
            )
          }
          ListFooterComponent={
            <View>
              {!isVerified && feedData.length > 0 && (
                <Text style={[feedStyles.observerFootnote, { color: colors.textTertiary }]}>
                  Counts are public — anyone can watch. Only verified citizens are counted.
                </Text>
              )}
              <View style={styles.listSpacer} />
            </View>
          }
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
          {/* Step chrome — 40px circular close/back, STEP X OF 2 mono label,
              2-segment progress bar (same pattern as onboarding). */}
          <View style={createStyles.topBar}>
            {createStep === 1 ? (
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={[createStyles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCreateStep(1);
                }}
                style={[createStyles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                accessibilityRole="button"
                accessibilityLabel="Back to editing"
              >
                <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            <Text style={[createStyles.stepLabel, { color: colors.textTertiary }]}>
              STEP {createStep} OF 2
            </Text>
          </View>
          <View style={createStyles.progressRow}>
            <View style={[createStyles.progressSeg, { backgroundColor: colors.goldFill }]} />
            <View
              style={[
                createStyles.progressSeg,
                { backgroundColor: createStep === 2 ? colors.goldFill : colors.surfaceHighlight },
              ]}
            />
          </View>

          {/* Proposal allowance — mono meta, kept from the old top bar. */}
          {createStep === 1 && usageLimits && (
            <View style={createStyles.allowanceRow}>
              {usageLimits.proposals.limit === 'unlimited' ? (
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
              )}
            </View>
          )}

          {createStep === 1 ? (
            <>
          <ScrollView
            style={createStyles.scroll}
            contentContainerStyle={createStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[createStyles.pageTitle, { color: colors.text }]}>New Proposal</Text>

            {/* THE QUESTION — serif input, gold border while focused, live
                neutrality coaching (client-side only; never blocks). */}
            <View style={createStyles.section}>
              <View style={createStyles.sectionHeadRow}>
                <Text style={[createStyles.sectionLabel, { color: colors.textTertiary }]}>THE QUESTION</Text>
                <Text style={[createStyles.questionMeta, { color: colors.textTertiary }]}>
                  {newProposal.title.length} / 140
                </Text>
              </View>
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
                {newProposal.title.trim().length > 0 && (
                  <View style={createStyles.neutralRow}>
                    <Ionicons
                      name={questionNeutral ? 'checkmark' : loadedWordHit ? 'alert-circle-outline' : 'ellipse-outline'}
                      size={12}
                      color={questionNeutral ? colors.support : loadedWordHit ? colors.oppose : colors.textTertiary}
                    />
                    <Text
                      style={[
                        createStyles.questionMeta,
                        {
                          color: questionNeutral
                            ? colors.support
                            : loadedWordHit
                            ? colors.oppose
                            : colors.textTertiary,
                        },
                      ]}
                    >
                      {questionNeutral
                        ? 'READS AS A NEUTRAL QUESTION'
                        : loadedWordHit
                        ? `LOADED WORD: "${loadedWordHit.toUpperCase()}"`
                        : 'END WITH A QUESTION MARK'}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[createStyles.scopeHint, { color: colors.textTertiary }]}>
                Ends in a question mark, no loaded words ("finally", "wasteful"), one decision only.
                Voters see it verbatim, forever.
              </Text>
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

          {/* CP1 pinned gold CTA — validation runs here, gates stay on publish */}
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
              style={[createStyles.submitBtn, { backgroundColor: colors.goldFill }]}
              onPress={handlePreviewBallot}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Preview ballot"
            >
              <Text style={createStyles.submitText}>Preview Ballot</Text>
            </TouchableOpacity>
            <Text style={[createStyles.footerNote, { color: colors.textTertiary }]}>
              Published proposals cannot be edited — only withdrawn
            </Text>
          </View>
            </>
          ) : (
            <>
          {/* ═══════════ CP2 · PREVIEW & PUBLISH ═══════════ */}
          <ScrollView
            style={createStyles.scroll}
            contentContainerStyle={createStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={createStyles.previewHead}>
              <Text style={[createStyles.pageTitle, { color: colors.text }]}>This is your ballot.</Text>
              <Text style={[createStyles.previewSub, { color: colors.textSecondary }]}>
                {previewScopeName
                  ? `Exactly what every eligible voter in ${previewScopeName} will see.`
                  : 'Exactly what every eligible voter worldwide will see.'}
              </Text>
            </View>

            {/* The preview IS the real 1b ballot card (ballotStyles), rendered
                from the draft — visually real, non-interactive. */}
            <View
              style={[
                ballotStyles.card,
                { backgroundColor: colors.surface, borderColor: 'rgba(234, 186, 88, 0.35)' },
              ]}
            >
              <View style={ballotStyles.topRow}>
                <View style={ballotStyles.topLeft}>
                  <Text
                    style={[
                      ballotStyles.scopeChip,
                      { color: colors.textTertiary, backgroundColor: colors.surfaceHighlight },
                    ]}
                  >
                    {previewScopeLabel}
                  </Text>
                  {newProposal.requiresCitizenship && (
                    <Text
                      style={[
                        ballotStyles.scopeChip,
                        { color: colors.textTertiary, backgroundColor: colors.surfaceHighlight },
                      ]}
                    >
                      CITIZENS ONLY
                    </Text>
                  )}
                </View>
                {/* The deadline is assigned server-side at publish — stated
                    honestly instead of inventing a date. */}
                <Text style={[ballotStyles.deadlineText, { color: colors.textTertiary }]}>
                  CLOSES · SET ON PUBLISH
                </Text>
              </View>

              <Text style={[ballotStyles.question, { color: colors.text }]}>
                {newProposal.title.trim()}
              </Text>

              <View style={createStyles.proposedByRow}>
                <Text style={[createStyles.proposedByLabel, { color: colors.textTertiary }]}>
                  PROPOSED BY
                </Text>
                <Text style={[createStyles.proposedByName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {user?.name?.trim() || 'You'}
                </Text>
                {(isVerified || !!user?.verified) && (
                  <Ionicons name="shield-checkmark" size={12} color={colors.gold} />
                )}
              </View>

              {newProposal.voteType === 'yes-no' ? (
                <View style={ballotStyles.actionRow}>
                  <View
                    style={[
                      ballotStyles.voteBtn,
                      { backgroundColor: colors.supportSurface, borderColor: colors.support },
                    ]}
                  >
                    <Text style={[ballotStyles.voteBtnText, { color: colors.support }]}>Support</Text>
                  </View>
                  <View
                    style={[
                      ballotStyles.voteBtn,
                      { backgroundColor: colors.opposeSurface, borderColor: colors.oppose },
                    ]}
                  >
                    <Text style={[ballotStyles.voteBtnText, { color: colors.oppose }]}>Oppose</Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={ballotStyles.optionsRow}>
                    <Text style={[ballotStyles.optionsText, { color: colors.textSecondary }]}>
                      {previewOptionCount} OPTIONS ·{' '}
                      {newProposal.voteType === 'ranked-choice' ? 'RANK YOUR CHOICES' : 'PICK ONE'}
                    </Text>
                  </View>
                  {/* Dimmed so the pinned Publish CTA stays the screen's one
                      live gold moment. */}
                  <View style={[ballotStyles.openBallotBtn, { backgroundColor: colors.goldFill, opacity: 0.55 }]}>
                    <Text style={ballotStyles.openBallotText} numberOfLines={1}>
                      Open Ballot — {newProposal.voteType === 'ranked-choice' ? 'Rank Your Choices' : 'Pick One'}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Mono facts strip — no eligible-voter data exists, so the strip
                states the scope instead of inventing a count. */}
            <View
              style={[
                createStyles.factsCard,
                { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle },
              ]}
            >
              <View style={[createStyles.factsRow, { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                <Text style={[createStyles.factsLabel, { color: colors.textTertiary }]}>OPEN TO</Text>
                <Text style={[createStyles.factsValue, { color: colors.text }]} numberOfLines={1}>
                  {previewScopeLabel}
                </Text>
              </View>
              {newProposal.requiresCitizenship && (
                <View style={[createStyles.factsRow, { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[createStyles.factsLabel, { color: colors.textTertiary }]}>ELIGIBILITY</Text>
                  <Text style={[createStyles.factsValue, { color: colors.text }]}>CITIZENS ONLY</Text>
                </View>
              )}
              <View style={[createStyles.factsRow, { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                <Text style={[createStyles.factsLabel, { color: colors.textTertiary }]}>TALLY VISIBLE AT</Text>
                <Text style={[createStyles.factsValue, { color: colors.text }]}>25 BALLOTS</Text>
              </View>
              <View style={createStyles.factsRow}>
                <Text style={[createStyles.factsLabel, { color: colors.textTertiary }]}>RECORDED ON</Text>
                <Text style={[createStyles.factsValue, { color: colors.text }]}>PUBLIC LEDGER · PERMANENT</Text>
              </View>
            </View>

            {/* Permanence note — verbatim trust copy */}
            <View
              style={[
                createStyles.noteCard,
                { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.18)' },
              ]}
            >
              <Ionicons name="shield-outline" size={16} color={colors.gold} style={createStyles.noteIcon} />
              <Text style={[createStyles.noteText, { color: colors.textSecondary }]}>
                Publishing is permanent and carries your verified name. You can withdraw a proposal,
                but the record that it existed stays on the ledger.
              </Text>
            </View>
          </ScrollView>

          {/* CP2 pinned actions — gold publish (existing handleCreateProposal,
              unchanged) + ghost back to editing. */}
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
              accessibilityLabel={previewScopeName ? `Publish to ${previewScopeName}` : 'Publish worldwide'}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#040707" />
              ) : (
                <Text style={createStyles.submitText} numberOfLines={1}>
                  {previewScopeName ? `Publish to ${previewScopeName}` : 'Publish Worldwide'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={createStyles.ghostBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setCreateStep(1);
              }}
              disabled={creating}
              accessibilityRole="button"
              accessibilityLabel="Back to editing"
            >
              <Text style={[createStyles.ghostText, { color: colors.textSecondary }]}>Back to Editing</Text>
            </TouchableOpacity>
          </View>
            </>
          )}
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

      {/* 2a · Observer region picker — regions derived from the open
          proposals' actual geoRestrictions. Display scoping ONLY; it never
          touches voting eligibility. */}
      <Modal
        visible={showRegionPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRegionPicker(false)}
      >
        <View style={feedStyles.sheetBackdrop}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setShowRegionPicker(false)}
            accessibilityRole="button"
            accessibilityLabel="Close region picker"
          />
          <View style={[feedStyles.sheet, { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + 20 }]}>
            <View style={[feedStyles.sheetHandle, { backgroundColor: colors.surfaceHighlight }]} />
            <Text style={[feedStyles.sheetTitle, { color: colors.text }]}>Choose your region</Text>
            <Text style={[feedStyles.sheetSub, { color: colors.textTertiary }]}>
              Scopes what you see while observing. It never changes who can vote.
            </Text>
            <ScrollView style={feedStyles.sheetList} showsVerticalScrollIndicator={false}>
              {regionOptions.map((opt) => {
                const selected =
                  !!observerRegion &&
                  (observerRegion.country ?? '') === (opt.region.country ?? '') &&
                  (observerRegion.state ?? '') === (opt.region.state ?? '') &&
                  (observerRegion.city ?? '') === (opt.region.city ?? '');
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[feedStyles.sheetRow, { borderBottomColor: colors.borderSubtle }]}
                    onPress={() => pickObserverRegion(opt.region)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[feedStyles.sheetRowLabel, { color: selected ? colors.gold : colors.text }]}>
                      {opt.label}
                    </Text>
                    <View style={feedStyles.sheetRowRight}>
                      <Text style={[feedStyles.sheetRowCount, { color: colors.textTertiary }]}>{opt.count} OPEN</Text>
                      {selected && <Ionicons name="checkmark" size={15} color={colors.gold} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              {regionOptions.length === 1 && (
                <Text style={[feedStyles.sheetSub, { color: colors.textTertiary, paddingTop: 10 }]}>
                  Every open ballot is global right now — no regional ballots to scope to.
                </Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* D1 · Verified-residence mismatch — calm and factual, never an error.
          The trust system working: the verified ID's residence wins over the
          declared observer region, stated once, then dismissed. */}
      <Modal
        visible={!!mismatchDeclared}
        transparent
        animationType="slide"
        onRequestClose={() => setMismatchDeclared(null)}
      >
        <View style={[mismatchStyles.backdrop, { backgroundColor: colors.overlay }]}>
          <View
            style={[
              mismatchStyles.sheet,
              {
                backgroundColor: colors.backgroundElevated,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16) + 24,
              },
            ]}
          >
            <View style={[mismatchStyles.grabber, { backgroundColor: colors.surfaceHighlight }]} />

            <View style={mismatchStyles.headRow}>
              <View style={[mismatchStyles.shieldTile, { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.3)' }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.gold} />
              </View>
              <View style={mismatchStyles.headCol}>
                <Text style={[mismatchStyles.headline, { color: colors.text }]}>
                  Your verified residence is {userCity || userState || userCountry}.
                </Text>
                <Text style={[mismatchStyles.headMeta, { color: colors.textTertiary }]}>
                  FROM YOUR VERIFIED ID
                </Text>
              </View>
            </View>

            <Text style={[mismatchStyles.sub, { color: colors.textSecondary }]}>
              {[userCity, userState, userCountry].filter(Boolean).length > 0
                ? `Your feed now shows your real scope — ${[userCity, userState, userCountry]
                    .filter(Boolean)
                    .join(', ')}. That's where your ballot counts.`
                : "Your feed now shows your real scope — where your ballot actually counts."}
            </Text>

            {/* Declared vs verified, mono and factual */}
            <View style={[mismatchStyles.scopeCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={mismatchStyles.scopeCol}>
                <Text style={[mismatchStyles.scopeLabel, { color: colors.textTertiary }]}>YOUR SCOPE</Text>
                <Text style={[mismatchStyles.scopeValue, { color: colors.text }]} numberOfLines={1}>
                  {[userCity, userState, userCountry].filter(Boolean).join(' · ')}
                </Text>
                {!!mismatchDeclared && (
                  <Text style={[mismatchStyles.scopeWas, { color: colors.textTertiary }]} numberOfLines={1}>
                    WAS WATCHING ·{' '}
                    {[mismatchDeclared.city, mismatchDeclared.state, mismatchDeclared.country]
                      .filter(Boolean)
                      .join(' · ')
                      .toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={[mismatchStyles.scopeCount, { color: colors.gold }]}>{heroCount} OPEN</Text>
            </View>

            <TouchableOpacity
              style={[mismatchStyles.cta, { backgroundColor: colors.goldFill }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setMismatchDeclared(null);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Got it"
            >
              <Text style={mismatchStyles.ctaText}>Got It</Text>
            </TouchableOpacity>

            <Text style={[mismatchStyles.footer, { color: colors.textTertiary }]}>
              Moved? Update your ID with your province, then re-verify — takes two minutes.
            </Text>
          </View>
        </View>
      </Modal>

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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  // Skeleton
  skeletonBadge: { width: 80, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonSmall: { width: 60, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonTitle: { height: 24, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.sm },
  skeletonLine: { height: 16, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.xs },
  skeletonBtn: { height: 48, borderRadius: BORDER_RADIUS.xl, marginTop: SPACING.md },
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
  // ── CP1/CP2 step chrome (mirrors the onboarding pattern) ──
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.68, // .16em
    fontVariant: ['tabular-nums'],
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 12,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  allowanceRow: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  // ── CP1 question coaching ──
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  neutralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // ── CP2 preview & publish ──
  previewHead: {
    gap: 5,
  },
  previewSub: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  proposedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  proposedByLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  proposedByName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    flexShrink: 1,
  },
  factsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingVertical: 4,
  },
  factsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
  },
  factsLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  factsValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  noteIcon: {
    marginTop: 1,
  },
  noteText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  ghostBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1b / 2a · FEED CHROME — header, chips, meta line, observer hero, region sheet
// ═══════════════════════════════════════════════════════════════════════════════
const feedStyles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 14,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.38,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newBtn: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newBtnText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
    color: '#040707',
  },
  observingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  observingText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  feedContent: {
    paddingHorizontal: SPACING.screenPadding,
    gap: 14,
  },
  feedHeader: {
    gap: 14,
  },
  chipsScroll: {
    marginHorizontal: -SPACING.screenPadding,
  },
  chipsRow: {
    paddingHorizontal: SPACING.screenPadding,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
  },
  chipTextActive: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
  },
  chipCount: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 11,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 100,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.05,
    fontVariant: ['tabular-nums'],
  },
  metaTonight: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.63,
    fontVariant: ['tabular-nums'],
  },
  // 2a · Verification hero
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  heroShield: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
    gap: 2,
  },
  heroHeadline: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    lineHeight: 24,
  },
  heroSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  heroRegionLink: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11.5,
    marginTop: 4,
  },
  heroCta: {
    height: 52,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  heroCtaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  heroCtaSuffix: {
    fontFamily: FONTS.mono,
    fontSize: 12.5,
    color: '#040707',
    opacity: 0.75,
    fontVariant: ['tabular-nums'],
  },
  heroTrust: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 0.95,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  observerFootnote: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingTop: 14,
    paddingHorizontal: 10,
  },
  // Empty states
  simpleEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    gap: 8,
  },
  simpleEmptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    textAlign: 'center',
  },
  simpleEmptyDesc: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  queueClearWrap: {
    paddingTop: 20,
    paddingHorizontal: 4,
    gap: 18,
  },
  // Region picker sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 10,
    gap: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 26,
  },
  sheetSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  sheetList: {
    maxHeight: 380,
    marginTop: 8,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetRowLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    flex: 1,
  },
  sheetRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetRowCount: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.63,
    fontVariant: ['tabular-nums'],
  },
});

// D1 · verified-residence mismatch sheet — matches the X1 confirm sheet's
// bottom-sheet treatment (VoteConfirmationOverlay): 28px top radius,
// hairline border, grabber, deep upward shadow.
const mismatchStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 28,
    gap: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 24,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  shieldTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCol: {
    flex: 1,
    gap: 2,
  },
  headline: {
    fontFamily: FONTS.serif,
    fontSize: 23,
    lineHeight: 26.5, // 1.15
  },
  headMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.05, // .1em
    fontVariant: ['tabular-nums'],
  },
  sub: {
    fontFamily: FONTS.sans,
    fontSize: 14.5,
    lineHeight: 22, // 1.55
  },
  scopeCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scopeCol: {
    flex: 1,
    gap: 2,
  },
  scopeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.4, // .14em
    fontVariant: ['tabular-nums'],
  },
  scopeValue: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
  },
  scopeWas: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 0.95,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  scopeCount: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  cta: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  footer: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16.5, // 1.5
    textAlign: 'center',
  },
});
