import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { proposalsApi, Proposal } from '../../lib/api';

const GOLD = '#EABA58';
const BG = '#040707';
const FG = '#F4F5F6';
const FG_MUTED = '#C7CACD';
const FG_FAINT = '#8E9297';
const GREEN = '#34C759';
const RED = '#FF6B6B';
const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.3;
const SKIP_THRESHOLD = SCREEN_H * 0.18;

const CATEGORY_IMAGES: Record<string, string> = {
  Economy: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800',
  Environment: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800',
  Education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
  Health: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800',
  Housing: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
  Transportation: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=800',
  'Public Safety': 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800',
  Curriculum: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800',
  Facilities: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
  Programs: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800',
  'Campus Operations': 'https://images.unsplash.com/photo-1607237138185-eedd9c632b0b?w=800',
  General: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800',
};

function imageFor(category?: string) {
  if (!category) return CATEGORY_IMAGES.General;
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.General;
}

function timeLeft(deadline: string | null | undefined): string {
  if (!deadline) return '';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

function govLevelFor(p: Proposal): string {
  if ((p as any).source === 'civic-desk') return 'CIVIC DESK';
  return (p.category || 'GENERAL').toUpperCase();
}

// ──────────────────────────────────────────────────────────────────────────
// Peek card — the next proposal sitting behind the active card. No gestures,
// just a static reduced-scale preview so the user can see what's coming.
// ──────────────────────────────────────────────────────────────────────────
function PeekCard({ proposal }: { proposal: Proposal }) {
  return (
    <View style={[styles.card, styles.peekCard]} pointerEvents="none">
      <ExpoImage
        source={imageFor(proposal.category)}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        transition={150}
      />
      <LinearGradient
        colors={['rgba(4,7,7,0.0)', 'rgba(4,7,7,0.65)', 'rgba(4,7,7,0.95)']}
        locations={[0.25, 0.55, 0.85]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.peekBottom}>
        <Text style={styles.peekGovLevel}>{govLevelFor(proposal)}</Text>
        <Text style={styles.peekTitle} numberOfLines={2}>{proposal.title}</Text>
      </View>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Active card — gestures, animations, the whole experience.
// ──────────────────────────────────────────────────────────────────────────
interface CardProps {
  proposal: Proposal;
  onVote: (position: 'support' | 'oppose') => void;
  onSkip: () => void;
  onExpand: () => void;
}

function ReelsCard({ proposal, onVote, onSkip, onExpand }: CardProps) {
  const insets = useSafeAreaInsets();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  const supportVotes = proposal.supportVotes ?? 0;
  const opposeVotes = proposal.opposeVotes ?? 0;
  const total = supportVotes + opposeVotes;
  const supportPct = total > 0 ? Math.round((supportVotes / total) * 100) : 50;

  const commit = useCallback((kind: 'support' | 'oppose' | 'skip') => {
    if (kind === 'skip') onSkip();
    else onVote(kind);
  }, [onVote, onSkip]);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        tx.value = withTiming(SCREEN_W * 1.5, { duration: 300 });
        cardOpacity.value = withTiming(0, { duration: 300 }, () => {
          runOnJS(commit)('support');
        });
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        tx.value = withTiming(-SCREEN_W * 1.5, { duration: 300 });
        cardOpacity.value = withTiming(0, { duration: 300 }, () => {
          runOnJS(commit)('oppose');
        });
      } else if (e.translationY < -SKIP_THRESHOLD) {
        ty.value = withTiming(-SCREEN_H * 1.2, { duration: 300 });
        cardOpacity.value = withTiming(0, { duration: 300 }, () => {
          runOnJS(commit)('skip');
        });
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((_e, success) => {
      if (success) runOnJS(onExpand)();
    });

  // Pan wins if there's any drag; tap fires only on a clean tap with no movement.
  const composed = Gesture.Exclusive(pan, tap);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotate: `${interpolate(tx.value, [-SCREEN_W, 0, SCREEN_W], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
    ],
    opacity: cardOpacity.value,
  }));

  const supportStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [40, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const opposeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-SWIPE_THRESHOLD, -40], [1, 0], Extrapolation.CLAMP),
  }));

  const skipStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ty.value, [-SKIP_THRESHOLD, -40], [1, 0], Extrapolation.CLAMP),
  }));

  const tintStyle = useAnimatedStyle(() => {
    const greenAlpha = interpolate(tx.value, [0, SWIPE_THRESHOLD * 1.4], [0, 0.18], Extrapolation.CLAMP);
    const redAlpha = interpolate(tx.value, [-SWIPE_THRESHOLD * 1.4, 0], [0.18, 0], Extrapolation.CLAMP);
    const alpha = greenAlpha + redAlpha;
    return {
      backgroundColor: tx.value > 0 ? `rgba(52, 199, 89, ${greenAlpha})` : `rgba(255, 107, 107, ${redAlpha})`,
      opacity: alpha > 0 ? 1 : 0,
    };
  });

  // Top pills sit BELOW the chrome (close/counter), not on top of it.
  const TOP_PILL_TOP = insets.top + 64;
  const geo = (proposal as any).geoRestrictions?.[0];

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.card, cardStyle]}>
        <ExpoImage
          source={imageFor(proposal.category)}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
          transition={200}
        />
        <Animated.View style={[StyleSheet.absoluteFillObject, tintStyle]} pointerEvents="none" />
        <LinearGradient
          colors={['rgba(4,7,7,0.0)', 'rgba(4,7,7,0.55)', 'rgba(4,7,7,0.95)']}
          locations={[0.25, 0.55, 0.85]}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />

        <View style={[styles.topRow, { top: TOP_PILL_TOP }]}>
          {geo ? (
            <View style={styles.pill}>
              <Ionicons name="location-outline" size={13} color={FG} />
              <Text style={styles.pillText}>{geo}</Text>
            </View>
          ) : <View />}
          <View style={[styles.pill, styles.pillGold]}>
            <Ionicons name="time-outline" size={13} color={GOLD} />
            <Text style={[styles.pillText, { color: GOLD }]}>{timeLeft(proposal.deadline)}</Text>
          </View>
        </View>

        <Animated.View style={[styles.stamp, styles.stampSupport, supportStampStyle]}>
          <Text style={styles.stampText}>SUPPORT</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampOppose, opposeStampStyle]}>
          <Text style={styles.stampText}>OPPOSE</Text>
        </Animated.View>
        <Animated.View style={[styles.stamp, styles.stampSkip, skipStampStyle]}>
          <Text style={styles.stampText}>SKIP</Text>
        </Animated.View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 32 }]}>
          <Text style={styles.govLevel}>{govLevelFor(proposal)}</Text>
          <Text style={styles.title} numberOfLines={3}>{proposal.title}</Text>

          <View style={styles.proposedByRow}>
            <View style={styles.proposedByDot} />
            <Text style={styles.proposedByText}>
              Proposed by <Text style={{ color: FG, fontWeight: '600' }}>{proposal.creatorName || 'Represent Civic Desk'}</Text>
            </Text>
          </View>

          <Text style={styles.description} numberOfLines={3}>{proposal.description}</Text>

          <View style={styles.voteBar}>
            <View style={[styles.voteBarSupport, { flex: total > 0 ? supportVotes : 1 }]} />
            <View style={[styles.voteBarOppose, { flex: total > 0 ? opposeVotes : 1 }]} />
          </View>
          <View style={styles.voteRow}>
            <View style={styles.voteSide}>
              <Text style={styles.voteCount}>{supportVotes.toLocaleString()}</Text>
              <Text style={styles.voteLabel}>SUPPORT</Text>
            </View>
            <View style={styles.pctChip}>
              <Text style={styles.pctText}>{supportPct}%</Text>
            </View>
            <View style={[styles.voteSide, { alignItems: 'flex-end' }]}>
              <Text style={styles.voteLabelOppose}>OPPOSE</Text>
              <Text style={[styles.voteCount, { color: RED }]}>{opposeVotes.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.hintRow}>
            <Ionicons name="arrow-back" size={14} color={RED} />
            <Text style={styles.hintText}>oppose · </Text>
            <Ionicons name="arrow-up" size={14} color={FG_FAINT} />
            <Text style={styles.hintText}> skip · </Text>
            <Text style={styles.hintText}>support</Text>
            <Ionicons name="arrow-forward" size={14} color={GREEN} />
            <Text style={[styles.hintText, { marginLeft: 10, color: GOLD }]}>· tap to expand</Text>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Expanded sheet — slides up over the card with full proposal details.
// Tap-to-vote at the bottom so users can decide without dismissing.
// ──────────────────────────────────────────────────────────────────────────
interface SheetProps {
  proposal: Proposal;
  onClose: () => void;
  onVote: (p: 'support' | 'oppose') => void;
  onSkip: () => void;
}

function ExpandedSheet({ proposal, onClose, onVote, onSkip }: SheetProps) {
  const insets = useSafeAreaInsets();
  const supportVotes = proposal.supportVotes ?? 0;
  const opposeVotes = proposal.opposeVotes ?? 0;
  const total = supportVotes + opposeVotes;
  const supportPct = total > 0 ? Math.round((supportVotes / total) * 100) : 50;
  const tl = timeLeft(proposal.deadline);
  const geo = (proposal as any).geoRestrictions?.[0];

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
    >
      <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        exiting={SlideOutDown.duration(220)}
        style={[styles.sheet, { paddingBottom: insets.bottom + 24, maxHeight: SCREEN_H * 0.85 }]}
      >
        <View style={styles.sheetHandle} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sheetMetaRow}>
            <Text style={styles.govLevel}>{govLevelFor(proposal)}</Text>
            {tl ? (
              <View style={[styles.pill, styles.pillGold, { paddingVertical: 5 }]}>
                <Ionicons name="time-outline" size={12} color={GOLD} />
                <Text style={[styles.pillText, { color: GOLD, fontSize: 11 }]}>{tl}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.title, { fontSize: 26, lineHeight: 32 }]}>{proposal.title}</Text>

          <View style={[styles.proposedByRow, { marginTop: 8, marginBottom: 16 }]}>
            <View style={styles.proposedByDot} />
            <Text style={styles.proposedByText}>
              Proposed by <Text style={{ color: FG, fontWeight: '600' }}>{proposal.creatorName || 'Represent Civic Desk'}</Text>
            </Text>
          </View>

          {geo ? (
            <View style={[styles.pill, { alignSelf: 'flex-start', marginBottom: 16 }]}>
              <Ionicons name="location-outline" size={13} color={FG} />
              <Text style={styles.pillText}>{geo}</Text>
            </View>
          ) : null}

          <Text style={styles.sheetSectionLabel}>Description</Text>
          <Text style={[styles.description, { marginBottom: 22 }]}>{proposal.description}</Text>

          <Text style={styles.sheetSectionLabel}>Current results</Text>
          <View style={[styles.voteBar, { marginTop: 6 }]}>
            <View style={[styles.voteBarSupport, { flex: total > 0 ? supportVotes : 1 }]} />
            <View style={[styles.voteBarOppose, { flex: total > 0 ? opposeVotes : 1 }]} />
          </View>
          <View style={[styles.voteRow, { marginBottom: 28 }]}>
            <View style={styles.voteSide}>
              <Text style={styles.voteCount}>{supportVotes.toLocaleString()}</Text>
              <Text style={styles.voteLabel}>SUPPORT</Text>
            </View>
            <View style={styles.pctChip}>
              <Text style={styles.pctText}>{supportPct}%</Text>
            </View>
            <View style={[styles.voteSide, { alignItems: 'flex-end' }]}>
              <Text style={styles.voteLabelOppose}>OPPOSE</Text>
              <Text style={[styles.voteCount, { color: RED }]}>{opposeVotes.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnOppose, pressed && { opacity: 0.85 }]}
              onPress={() => onVote('oppose')}
            >
              <Ionicons name="close" size={18} color={RED} />
              <Text style={[styles.actionBtnText, { color: RED }]}>Oppose</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnSkip, pressed && { opacity: 0.85 }]}
              onPress={onSkip}
            >
              <Ionicons name="play-skip-forward-outline" size={16} color={FG_MUTED} />
              <Text style={[styles.actionBtnText, { color: FG_MUTED }]}>Skip</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionBtn, styles.actionBtnSupport, pressed && { opacity: 0.85 }]}
              onPress={() => onVote('support')}
            >
              <Ionicons name="checkmark" size={18} color="#000" />
              <Text style={[styles.actionBtnText, { color: '#000' }]}>Support</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main screen
// ──────────────────────────────────────────────────────────────────────────
export default function VoteReelsScreen() {
  const insets = useSafeAreaInsets();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await proposalsApi.getAll();
      if (cancelled) return;
      const list = (res.data || []).filter((p: Proposal) => timeLeft(p.deadline) !== 'Ended');
      setProposals(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const advance = useCallback(() => {
    setExpanded(false);
    setIndex((i) => i + 1);
  }, []);

  const onVote = useCallback((position: 'support' | 'oppose') => {
    Haptics.impactAsync(position === 'support' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
    const current = proposals[index];
    if (current) {
      proposalsApi.submitVote(current.id, position).catch(() => { /* prototype: silent */ });
    }
    advance();
  }, [proposals, index, advance]);

  const onSkip = useCallback(() => {
    Haptics.selectionAsync();
    advance();
  }, [advance]);

  const current = proposals[index];
  const next = proposals[index + 1];

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root}>
        {/* Chrome — single row at very top so close + counter can never collide with card pills. */}
        <View style={[styles.chromeRow, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable
            style={styles.closeBtn}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="close" size={22} color={FG} />
          </Pressable>
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {Math.min(index + 1, proposals.length)} / {proposals.length}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={GOLD} />
          </View>
        ) : !current ? (
          <View style={styles.center}>
            <Ionicons name="checkmark-done" size={48} color={GOLD} />
            <Text style={styles.doneTitle}>You're all caught up</Text>
            <Text style={styles.doneSubtitle}>
              {proposals.length > 0 ? `You reviewed ${proposals.length} proposals` : 'No active proposals right now'}
            </Text>
            <Pressable style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Peek card sits behind, no key change so no remount when expanded toggles. */}
            {next ? <PeekCard proposal={next} /> : null}

            {/* Active card on top, keyed on id so it remounts cleanly each time index advances. */}
            <Animated.View
              key={String(current.id)}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(120)}
              style={StyleSheet.absoluteFillObject}
            >
              <ReelsCard
                proposal={current}
                onVote={onVote}
                onSkip={onSkip}
                onExpand={() => setExpanded(true)}
              />
            </Animated.View>

            {expanded ? (
              <ExpandedSheet
                proposal={current}
                onClose={() => setExpanded(false)}
                onVote={onVote}
                onSkip={onSkip}
              />
            ) : null}
          </>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const PEEK_SCALE = 0.93;
const PEEK_TRANSLATE = 14;
const PEEK_OPACITY = 0.55;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneTitle: { color: FG, fontSize: 22, fontFamily: SERIF, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  doneSubtitle: { color: FG_MUTED, fontSize: 14, marginTop: 8, textAlign: 'center' },
  doneBtn: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: GOLD, borderRadius: 999 },
  doneBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },

  // Chrome row holds close + counter, pinned to top
  chromeRow: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    zIndex: 20,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(13,15,18,0.78)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  counter: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(13,15,18,0.78)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  counterText: { color: FG_FAINT, fontSize: 12, fontFamily: 'Menlo', letterSpacing: 1 },

  // Card
  card: { flex: 1, backgroundColor: BG, overflow: 'hidden' },

  // Peek card — same dimensions as card, but scaled and translated to sit behind
  peekCard: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    transform: [{ scale: PEEK_SCALE }, { translateY: PEEK_TRANSLATE }],
    opacity: PEEK_OPACITY,
    borderRadius: 24,
  },
  peekBottom: {
    position: 'absolute', bottom: 80, left: 22, right: 22,
  },
  peekGovLevel: { color: GOLD, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 6, opacity: 0.9 },
  peekTitle: { color: FG, fontSize: 22, fontFamily: SERIF, fontWeight: '700', lineHeight: 27 },

  // Active card top pills (location, timer)
  topRow: {
    position: 'absolute', left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(13,15,18,0.75)',
    borderWidth: 1, borderColor: 'rgba(244,245,246,0.18)',
  },
  pillGold: { borderColor: 'rgba(234,186,88,0.5)' },
  pillText: { color: FG, fontSize: 12, fontWeight: '600' },

  // Vote stamps
  stamp: {
    position: 'absolute',
    paddingHorizontal: 18, paddingVertical: 8,
    borderRadius: 8, borderWidth: 3,
    transform: [{ rotate: '-12deg' }],
  },
  stampSupport: { top: '38%', right: 32, borderColor: GREEN },
  stampOppose: { top: '38%', left: 32, borderColor: RED },
  stampSkip: { top: '14%', alignSelf: 'center', borderColor: FG_FAINT, transform: [{ rotate: '0deg' }] },
  stampText: { color: FG, fontSize: 22, fontWeight: '900', letterSpacing: 2 },

  // Bottom content area
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 22 },
  govLevel: { color: GOLD, fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 8 },
  title: { color: FG, fontSize: 28, fontFamily: SERIF, fontWeight: '700', lineHeight: 34, marginBottom: 12 },
  proposedByRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  proposedByDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: GOLD, marginRight: 8, opacity: 0.3 },
  proposedByText: { color: FG_MUTED, fontSize: 13 },
  description: { color: FG_MUTED, fontSize: 14, lineHeight: 21, marginBottom: 18 },

  voteBar: { height: 5, borderRadius: 999, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 },
  voteBarSupport: { backgroundColor: GREEN },
  voteBarOppose: { backgroundColor: RED },
  voteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  voteSide: { flex: 1 },
  voteCount: { color: GREEN, fontSize: 22, fontFamily: SERIF, fontWeight: '700' },
  voteLabel: { color: FG_FAINT, fontSize: 11, letterSpacing: 1.5, marginTop: 2 },
  voteLabelOppose: { color: FG_FAINT, fontSize: 11, letterSpacing: 1.5, marginBottom: 2 },
  pctChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  pctText: { color: FG_MUTED, fontSize: 13, fontWeight: '600' },

  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
  hintText: { color: FG_FAINT, fontSize: 11, letterSpacing: 0.5 },

  // Expanded sheet
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#0D0F12',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 8,
  },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetSectionLabel: { color: FG_FAINT, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },

  actionRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1,
  },
  actionBtnOppose: { backgroundColor: 'rgba(255,107,107,0.08)', borderColor: 'rgba(255,107,107,0.4)' },
  actionBtnSkip: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)', flex: 0.7 },
  actionBtnSupport: { backgroundColor: GOLD, borderColor: GOLD },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
});
