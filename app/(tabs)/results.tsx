import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme, FONTS, SPACING, RADIUS } from '../../lib/theme';
import { proposalsApi, userApi, type Proposal } from '../../lib/api';
import { TallyBar, TALLY_THRESHOLD, Skeleton, EmptyState } from '../../components/ui';
import { useModerationStore, useSyncMutes } from '../../lib/moderation';

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS — mock 09a · live tallies (open) + final results (closed)
//
// The shadow-referendum board (mock 09b) renders ONLY when regional
// referendum data exists. The app has no referendum/regional endpoint today,
// so the board is intentionally omitted rather than faked — the list
// structure below (SectionHeader + cards + grouped closed rows) is the
// component skeleton it will slot into as its own section when data lands.
// ═══════════════════════════════════════════════════════════════════════════

const TNUM = { fontVariant: ['tabular-nums'] as any };

// ── outcome derivation (closed proposals) ────────────────────────────────
// PASSED / FAILED come from the final two-tone tally; below the 25-ballot
// threshold we never show a split — the outcome is honestly "below
// threshold". Non-yes/no ballots (multiple/ranked choice) can't be reduced
// to support-vs-oppose, so they close as neutral CLOSED and the detail
// screen shows their real per-option results.
type Outcome = 'passed' | 'failed' | 'below-threshold' | 'closed';

function isYesNo(p: Proposal): boolean {
  return !p.voteType || p.voteType === 'yes-no';
}

function deriveOutcome(p: Proposal): Outcome {
  if (!isYesNo(p)) return 'closed';
  const total = (p.supportVotes || 0) + (p.opposeVotes || 0);
  if (total < TALLY_THRESHOLD) return 'below-threshold';
  return (p.supportVotes || 0) > (p.opposeVotes || 0) ? 'passed' : 'failed';
}

function isClosed(p: Proposal, now: number): boolean {
  const s = (p.status || '').toLowerCase();
  if (['passed', 'approved', 'failed', 'rejected', 'closed', 'archived'].includes(s)) return true;
  if (!p.deadline) return false;
  const t = new Date(p.deadline).getTime();
  return !Number.isNaN(t) && t <= now;
}

function tierLabel(p: Proposal): string {
  const len = (p.geoRestrictions || []).length;
  if (len === 0) return 'GLOBAL';
  return len >= 3 ? 'MUNICIPAL' : len === 2 ? 'PROVINCIAL' : 'FEDERAL';
}

function formatCountdown(deadline: string, now: number): string {
  const ms = new Date(deadline).getTime() - now;
  if (ms <= 0) return 'CLOSING';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d >= 1) return `CLOSES IN ${d}D ${h}H`;
  if (h >= 1) return `CLOSES IN ${h}H ${m}M`;
  return `CLOSES IN ${m}M`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();
}

// ── atoms ────────────────────────────────────────────────────────────────
function LiveChip() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.liveChip,
        { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
      ]}
      accessibilityLabel="Live, open for voting"
    >
      <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
      <Text style={[styles.liveChipText, { color: colors.textSecondary }]}>LIVE</Text>
    </View>
  );
}

function OutcomeChip({ outcome }: { outcome: Outcome }) {
  const { colors } = useTheme();
  const cfg = {
    passed: { label: 'PASSED', color: colors.support, bg: colors.supportSurface },
    failed: { label: 'FAILED', color: colors.oppose, bg: colors.opposeSurface },
    'below-threshold': {
      label: 'BELOW THRESHOLD',
      color: colors.textTertiary,
      bg: colors.surfaceHighlight,
    },
    closed: { label: 'CLOSED', color: colors.textSecondary, bg: colors.surfaceHighlight },
  }[outcome];
  return (
    <View style={[styles.outcomeChip, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.outcomeChipText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function SectionHeader({ label, meta }: { label: string; meta: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>{label}</Text>
      <Text style={[styles.sectionMetaMono, { color: colors.textTertiary }]}>{meta}</Text>
    </View>
  );
}

// ── open (live) card — full two-tone TallyBar + mono closing time ────────
function LiveTallyCard({
  proposal,
  voted,
  now,
  index,
  onPress,
}: {
  proposal: Proposal;
  voted: boolean;
  now: number;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const yesNo = isYesNo(proposal);
  return (
    <Animated.View entering={FadeInUp.delay(Math.min(index, 6) * 50).duration(280)}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[
          styles.liveCard,
          { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
        ]}
      >
        <View style={styles.liveCardTop}>
          <Text style={[styles.cardEyebrow, { color: colors.textTertiary }]} numberOfLines={1}>
            {tierLabel(proposal)} · {(proposal.category || 'CIVIC').toUpperCase()}
          </Text>
          <LiveChip />
        </View>
        <View style={styles.titleRow}>
          {voted && (
            <Ionicons
              name="checkmark-circle"
              size={15}
              color={colors.gold}
              style={{ marginTop: 3 }}
              accessibilityLabel="Your ballot is recorded"
            />
          )}
          <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {proposal.title}
          </Text>
        </View>
        {yesNo ? (
          <TallyBar
            supportCount={proposal.supportVotes || 0}
            opposeCount={proposal.opposeVotes || 0}
            variant="full"
          />
        ) : (
          <Text style={[styles.mono, { color: colors.textTertiary }]}>
            {proposal.voteType === 'ranked-choice' ? 'RANKED-CHOICE' : 'MULTIPLE-CHOICE'} BALLOT ·
            RESULTS ON DETAIL →
          </Text>
        )}
        <View style={[styles.liveCardFooter, { borderTopColor: colors.borderSubtle }]}>
          <Text style={[styles.monoStrong, { color: colors.textSecondary }]}>
            {proposal.deadline ? formatCountdown(proposal.deadline, now) : 'NO DEADLINE · OPEN'}
          </Text>
          {proposal.deadline && (
            <Text style={[styles.mono, { color: colors.textTertiary }]}>
              {formatDateShort(proposal.deadline)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── closed row — outcome chip + final tally ──────────────────────────────
function ClosedRow({
  proposal,
  voted,
  last,
  onPress,
}: {
  proposal: Proposal;
  voted: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const outcome = deriveOutcome(proposal);
  const total = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const showFinalTally = isYesNo(proposal) && total >= TALLY_THRESHOLD;
  const metaParts = [
    proposal.deadline ? `CLOSED ${formatDateShort(proposal.deadline)}` : 'CLOSED',
    `${total.toLocaleString('en-CA')} ${total === 1 ? 'BALLOT' : 'BALLOTS'}`,
  ];
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.closedRow,
        !last && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={styles.titleRow}>
          {voted && (
            <Ionicons
              name="checkmark-circle"
              size={13}
              color={colors.gold}
              style={{ marginTop: 2 }}
              accessibilityLabel="Your ballot is recorded"
            />
          )}
          <Text style={[styles.closedTitle, { color: colors.text }]} numberOfLines={2}>
            {proposal.title}
          </Text>
        </View>
        <Text style={[styles.mono, { color: colors.textTertiary }]} numberOfLines={1}>
          {metaParts.join(' · ')}
        </Text>
        {showFinalTally && (
          <TallyBar
            supportCount={proposal.supportVotes || 0}
            opposeCount={proposal.opposeVotes || 0}
            variant="inline"
            applyThreshold={false}
          />
        )}
      </View>
      <OutcomeChip outcome={outcome} />
    </TouchableOpacity>
  );
}

// ── loading skeleton ─────────────────────────────────────────────────────
function ResultsSkeleton() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton width={140} height={12} borderRadius={4} />
      <Skeleton height={148} borderRadius={RADIUS.card} />
      <Skeleton height={148} borderRadius={RADIUS.card} />
      <View style={{ height: 8 }} />
      <Skeleton width={160} height={12} borderRadius={4} />
      <Skeleton height={170} borderRadius={RADIUS.card} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN
// ═══════════════════════════════════════════════════════════════════════════
export default function ResultsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutedUserIds = useModerationStore((s) => s.mutedUserIds);
  useSyncMutes();

  const loadData = useCallback(async () => {
    const [propRes, votedRes] = await Promise.all([
      proposalsApi.getAll(),
      userApi.getVotedProposals(),
    ]);
    if (propRes.data) {
      setProposals(propRes.data);
      setError(null);
    } else if (propRes.error) {
      setError(propRes.error);
    }
    if (votedRes.data) setVotedIds(new Set(votedRes.data.map(String)));
    setLoading(false);
  }, []);

  // Fetch on mount and refresh silently on every tab refocus so tallies
  // stay live without a manual pull.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const openProposal = useCallback((id: number | string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/(tabs)/proposals', params: { proposalId: String(id) } });
  }, []);

  const now = Date.now();
  const visible = proposals.filter((p) => {
    const creatorId = (p as any).creatorId || (p as any).userId;
    return !(creatorId && mutedUserIds.includes(String(creatorId)));
  });
  const openRows = visible
    .filter((p) => !isClosed(p, now))
    .sort((a, b) => {
      // Soonest-closing first; no-deadline proposals sink to the bottom.
      const at = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bt = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return at - bt;
    });
  const closedRows = visible
    .filter((p) => isClosed(p, now))
    .sort((a, b) => {
      // Most recently closed first.
      const at = a.deadline ? new Date(a.deadline).getTime() : 0;
      const bt = b.deadline ? new Date(b.deadline).getTime() : 0;
      return bt - at;
    });
  const isEmpty = openRows.length === 0 && closedRows.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Header — serif title + live-count pill (mock 09a status treatment) */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Results</Text>
          {!loading && openRows.length > 0 && (
            <View
              style={[
                styles.headerPill,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.headerPillText, { color: colors.textSecondary }]}>
                {openRows.length} LIVE
              </Text>
            </View>
          )}
        </Animated.View>
        <Animated.Text
          entering={FadeInDown.delay(50).duration(400)}
          style={[styles.headerSub, { color: colors.textSecondary }]}
        >
          Every tally counted on the public ledger.
        </Animated.Text>

        {loading ? (
          <ResultsSkeleton />
        ) : isEmpty ? (
          <View style={{ marginHorizontal: -SPACING.lg }}>
            <EmptyState
              icon="stats-chart-outline"
              title={error ? 'Couldn’t load results' : 'No tallies yet'}
              subtitle={
                error
                  ? 'The results feed didn’t load. Pull to refresh or try again.'
                  : 'When proposals open for voting, their live tallies appear here — recorded on the public ledger, verifiable by anyone.'
              }
              ctaLabel={error ? 'Try Again' : 'Go to Vote'}
              onCtaPress={error ? loadData : () => router.push('/(tabs)/proposals')}
            />
          </View>
        ) : (
          <>
            {/* OPEN — live tallies */}
            {openRows.length > 0 && (
              <View style={styles.section}>
                <SectionHeader
                  label="OPEN · LIVE TALLIES"
                  meta={`${openRows.length} ${openRows.length === 1 ? 'BALLOT' : 'BALLOTS'} OPEN`}
                />
                <View style={{ gap: 12 }}>
                  {openRows.map((p, i) => (
                    <LiveTallyCard
                      key={String(p.id)}
                      proposal={p}
                      voted={votedIds.has(String(p.id))}
                      now={now}
                      index={i}
                      onPress={() => openProposal(p.id)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* CLOSED — final results */}
            {closedRows.length > 0 && (
              <View style={styles.section}>
                <SectionHeader label="CLOSED · FINAL RESULTS" meta={`${closedRows.length} DECIDED`} />
                <Animated.View
                  entering={FadeInUp.delay(100).duration(280)}
                  style={[
                    styles.closedCard,
                    { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
                  ]}
                >
                  {closedRows.map((p, i) => (
                    <ClosedRow
                      key={String(p.id)}
                      proposal={p}
                      voted={votedIds.has(String(p.id))}
                      last={i === closedRows.length - 1}
                      onPress={() => openProposal(p.id)}
                    />
                  ))}
                </Animated.View>
              </View>
            )}

            {/* Ledger provenance footer — trust copy, verbatim */}
            <Text style={[styles.ledgerFooter, { color: colors.textTertiary }]}>
              Recorded on the public ledger · verifiable by anyone · one person, one ballot
            </Text>
          </>
        )}

        {/* Clearance for the absolute tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — mock 09a values (24px screen padding, radius 18 cards)
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SPACING.screenPadding },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.38,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  headerPillText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    ...TNUM,
  },
  headerSub: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
  },
  sectionMetaMono: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.84,
    textTransform: 'uppercase',
    ...TNUM,
  },

  // Open / live card
  liveCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  liveCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardEyebrow: {
    flex: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardTitle: {
    flex: 1,
    fontFamily: FONTS.serif,
    fontSize: 17.5,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  liveCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 11,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveChipText: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.26,
  },

  // Closed grouped card
  closedCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  closedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  closedTitle: {
    flex: 1,
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: -0.14,
  },
  outcomeChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
  },
  outcomeChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.08,
  },

  // Mono captions
  mono: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    ...TNUM,
  },
  monoStrong: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 10.5,
    letterSpacing: 0.84,
    ...TNUM,
  },
  ledgerFooter: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.9,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 8,
    ...TNUM,
  },
});
