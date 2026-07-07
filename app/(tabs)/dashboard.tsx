import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { FONTS, SPACING, RADIUS, useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi, organizationsApi, veriffApi, type Proposal, type Organization, type OrganizationProposal } from '../../lib/api';
import { useModerationStore, useSyncMutes } from '../../lib/moderation';
import { useFocusEffect } from 'expo-router';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — M1 · Home · Civic Inbox (static fallbacks for StyleSheet;
// live values come from useDashboardColors so both themes work)
// ═══════════════════════════════════════════════════════════════════════════
const G_GOLD = '#EABA58';
const BG = '#040707';
const BG_CARD = '#141818';
const LINE = 'rgba(244,245,246,0.08)';
const LINE_SUBTLE = 'rgba(244,245,246,0.05)';
const FG = '#F4F5F6';
const FG_MUTED = '#B8BABB';
const FG_FAINT = '#7A7D7E';
// Text/icons sitting on the gold fill — goldFill is identical in both themes,
// so this stays a constant (mock: #040707 on #EABA58).
const ON_GOLD = '#040707';
const GOLD_BORDER = 'rgba(234,186,88,0.28)';
const GOLD_BORDER_STRONG = 'rgba(234,186,88,0.35)';
const TNUM = { fontVariant: ['tabular-nums'] as any };

// Dynamic hook for components to get theme-aware colors
function useDashboardColors() {
  const { colors, isDark } = useTheme();
  return {
    GOLD: colors.gold,
    GOLD_FILL: colors.goldFill,
    GOLD_SURFACE: colors.goldSurface,
    BG: colors.background,
    BG_CARD: colors.surface,
    BG_RAISED: colors.surfaceElevated,
    BG_HIGHLIGHT: colors.surfaceHighlight,
    LINE: colors.border,
    LINE_SUBTLE: colors.borderSubtle,
    LINE_STRONG: colors.borderStrong,
    FG: colors.text,
    FG_MUTED: colors.textSecondary,
    FG_FAINT: colors.textTertiary,
    GREEN: colors.success,
    SUPPORT: colors.support,
    OPPOSE: colors.oppose,
    // Level-split shades (identical in both themes — these are fills)
    SPLIT_FEDERAL: colors.goldGradientStart,
    SPLIT_PROVINCIAL: colors.goldGradientMiddle,
    SPLIT_MUNICIPAL: colors.goldGradientEnd,
    isDark,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════
function classifyScope(p: Proposal): 'global' | 'federal' | 'provincial' | 'municipal' {
  const len = (p.geoRestrictions || []).length;
  if (len === 0) return 'global';
  if (len >= 3) return 'municipal';
  if (len === 2) return 'provincial';
  return 'federal';
}

export default function DashboardScreen() {
  const dc = useDashboardColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>([]);
  const [orgProposalsByOrg, setOrgProposalsByOrg] = useState<Record<string, OrganizationProposal[]>>({});
  // UPDATE 30 (v3): "Where you can vote" detail page. Pure conditional
  // render — when true, the dashboard swaps its body to the detail
  // page instead of opening a modal/route. Avoids the StackRouter
  // crash entirely.
  const [communitiesPageOpen, setCommunitiesPageOpen] = useState(false);

  const displayName = user?.name?.split(' ')[0] || 'User';
  const userCity = user?.city || '';
  const userState = user?.state || '';
  const userCountry = user?.country || '';
  const isVerified = user?.verified ?? false;
  const isDemoAccount = user?.email === 'demo@represent.app';

  const loadData = useCallback(async () => {
    const [propRes, votedRes, orgsRes] = await Promise.all([
      proposalsApi.getAll(),
      userApi.getVotedProposals(),
      organizationsApi.getMyOrganizations(),
    ]);
    if (propRes.data) setProposals(propRes.data);
    if (votedRes.data) setVotedIds(new Set(votedRes.data.map(String)));
    if (orgsRes.data) {
      setUserOrganizations(orgsRes.data);
      const perOrg = await Promise.all(
        orgsRes.data.map(async (org) => {
          const r = await organizationsApi.getOrganizationProposals(org.id);
          return [org.id, (r.data || []) as OrganizationProposal[]] as const;
        })
      );
      setOrgProposalsByOrg(Object.fromEntries(perOrg));
    }
  }, []);

  // Lightweight refetch for tab refocus: proposals + votes only. The full
  // loadData() additionally fans out one request per org (N+1) — paying
  // that on every tab switch made navigation feel sluggish.
  const refreshLight = useCallback(async () => {
    const [propRes, votedRes] = await Promise.all([
      proposalsApi.getAll(),
      userApi.getVotedProposals(),
    ]);
    if (propRes.data) setProposals(propRes.data);
    if (votedRes.data) setVotedIds(new Set(votedRes.data.map(String)));
  }, []);

  // Mount: full load. Refocus: light refresh only (the mount also fires
  // useFocusEffect, so skip the first focus to avoid the double-fetch).
  const firstFocusRef = useRef(true);
  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => {
    if (firstFocusRef.current) { firstFocusRef.current = false; return; }
    refreshLight();
  }, [refreshLight]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleStartKyc = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Route to the verification picker so the user can choose Standard or
    // Citizen verification (instead of forcing one). The picker creates the
    // Didit session after they pick.
    router.push('/modals/verification-payment');
  }, []);

  const navigateToProposals = () => router.push('/(tabs)/proposals');

  // Derived data
  const now = Date.now();
  // Org proposals are surfaced in their own section below; the civic inbox
  // only counts non-org proposals so that org-scoped proposals don't get
  // bucketed as federal/provincial/etc.
  // Unverified users can only act on global proposals (geoRestrictions empty),
  // so filter geo-restricted ones out for them — see proposals.tsx:626.
  // Also exclude proposals from muted creators.
  const mutedUserIds = useModerationStore((s) => s.mutedUserIds);
  useSyncMutes();
  const civicProposals = proposals.filter(p => {
    if ((p as any).organizationId) return false;
    const creatorId = (p as any).creatorId || (p as any).userId;
    if (creatorId && mutedUserIds.includes(String(creatorId))) return false;
    if (isVerified) return true;
    return ((p as any).geoRestrictions || []).length === 0;
  });
  const activeProposals = civicProposals.filter(p => {
    if (!p.deadline) return true;
    return new Date(p.deadline).getTime() > now;
  });
  const pendingProposals = activeProposals.filter(p => !votedIds.has(String(p.id)));
  const pendingCount = pendingProposals.length;

  const breakdown = { global: 0, federal: 0, provincial: 0, municipal: 0 };
  pendingProposals.forEach(p => { breakdown[classifyScope(p)]++; });

  // Closing-tonight strip: pending proposals whose deadline lands before the
  // end of today. If none close tonight, fall back to the nearest-deadline
  // pending proposals so the strip stays useful.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const deadlined = pendingProposals
    .filter(p => p.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  const closingTonight = deadlined.filter(p => new Date(p.deadline!).getTime() <= endOfToday.getTime());
  const stripItems = closingTonight.length > 0 ? closingTonight : deadlined.slice(0, 2);
  const stripMode: 'tonight' | 'soon' = closingTonight.length > 0 ? 'tonight' : 'soon';

  // Civic record stats. Demo account gets a curated, engaged-citizen profile
  // so App Store reviewers see a populated Civic Record instead of zeroes.
  const realVotedCount = votedIds.size;
  const realDecidedCount = civicProposals.filter(p =>
    votedIds.has(String(p.id)) && p.deadline && new Date(p.deadline).getTime() <= now
  ).length;
  const votedCount = isDemoAccount ? 47 : realVotedCount;
  const decidedCount = isDemoAccount ? 31 : realDecidedCount;
  const participationDenom = isDemoAccount ? 47 + 3 : votedCount + pendingCount;
  const participationPct = participationDenom > 0 ? Math.round((votedCount / participationDenom) * 100) : null;

  // Sentinel digest: most-engaged active civic proposals (org proposals
  // surface in the Your Organizations section instead).
  const digestItems = civicProposals
    .filter(p => p.deadline && new Date(p.deadline).getTime() > now)
    .sort((a, b) => {
      const aVotes = a.supportVotes + a.opposeVotes;
      const bVotes = b.supportVotes + b.opposeVotes;
      if (aVotes !== bVotes) return bVotes - aVotes;
      return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
    })
    .slice(0, 3);

  // UPDATE 30 (v3): "Where you can vote" detail page renders as a
  // full-tab takeover when communitiesPageOpen is true. Conditional
  // render — no Modal, no navigation, no routing — bulletproof.
  if (communitiesPageOpen) {
    return (
      <CommunitiesDetailPage
        proposals={civicProposals}
        country={userCountry}
        state={userState}
        city={userCity}
        isVerified={isVerified}
        onClose={() => setCommunitiesPageOpen(false)}
        onVerify={handleStartKyc}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: dc.BG }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dc.GOLD} />}
      >
        <TopBar
          name={displayName}
          city={userCity}
          state={userState}
          profileImageUrl={user?.profileImageUrl || null}
          verified={isVerified}
          onAvatarPress={() => router.push('/(tabs)/profile')}
          onVerifyPress={handleStartKyc}
        />
        {isVerified ? (
          <InboxHero pendingCount={pendingCount} breakdown={breakdown} onBeginVoting={navigateToProposals} />
        ) : (
          <UnverifiedHero globalCount={pendingCount} onVerify={handleStartKyc} onViewProposals={navigateToProposals} />
        )}
        <ClosingStrip
          items={stripItems}
          mode={stripMode}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (stripItems.length > 0) {
              router.push({ pathname: '/(tabs)/proposals', params: { proposalId: String(stripItems[0].id) } });
            } else {
              navigateToProposals();
            }
          }}
        />
        {isVerified && (
          <CivicRecord voted={votedCount} decided={decidedCount} participationPct={participationPct} />
        )}
        {isVerified && userCountry && (
          <Communities
            proposals={civicProposals}
            votedIds={votedIds}
            country={userCountry}
            state={userState}
            city={userCity}
            isVerified={isVerified}
            onPrimaryPress={navigateToProposals}
            onOpenDetail={() => setCommunitiesPageOpen(true)}
            router={router}
          />
        )}
        {userOrganizations.length > 0 && (
          <YourOrganizations
            orgs={userOrganizations}
            orgProposalsByOrg={orgProposalsByOrg}
            votedIds={votedIds}
            router={router}
          />
        )}
        <SentinelDigest items={digestItems} />
        <FooterSig />
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP BAR — status dot + "VERIFIED · <PLACE>", date line, serif avatar
// ═══════════════════════════════════════════════════════════════════════════
function TopBar({ name, city, state, profileImageUrl, verified, onAvatarPress, onVerifyPress }: {
  name: string; city: string; state: string; profileImageUrl: string | null;
  verified: boolean; onAvatarPress: () => void; onVerifyPress?: () => void;
}) {
  const dc = useDashboardColors();
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const place = (city || state || '').toUpperCase();
  const statusText = verified ? (place ? `VERIFIED · ${place}` : 'VERIFIED') : 'UNVERIFIED · TAP TO VERIFY';
  const dotColor = verified ? dc.GREEN : dc.FG_FAINT;
  const StatusContainer: any = verified || !onVerifyPress ? View : TouchableOpacity;
  const statusContainerProps = verified || !onVerifyPress ? {} : { onPress: onVerifyPress, activeOpacity: 0.7, hitSlop: { top: 10, bottom: 10, left: 10, right: 10 } };
  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.topBar}>
      <View style={{ gap: 3 }}>
        <StatusContainer {...statusContainerProps}>
          <View style={styles.topBarLeftRow}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.topBarStatus, { color: verified ? dc.FG_MUTED : dc.GOLD }]}>{statusText}</Text>
          </View>
        </StatusContainer>
        <Text style={[styles.topBarDate, { color: dc.FG_FAINT }]}>{dateStr}</Text>
      </View>
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
        <View style={[styles.avatar, {
          backgroundColor: dc.BG_CARD,
          borderColor: verified ? GOLD_BORDER_STRONG : dc.LINE_STRONG,
        }]}>
          {profileImageUrl ? (
            <ExpoImage
              source={{ uri: profileImageUrl }}
              style={{ width: '100%', height: '100%', borderRadius: 22 }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <Text style={[styles.avatarLetter, { color: dc.GOLD }]}>{name.charAt(0).toUpperCase()}</Text>
          )}
        </View>
        {verified && <View style={[styles.avatarVerifiedDot, { backgroundColor: dc.GREEN, borderColor: dc.BG }]} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO — "N proposals awaiting your voice" + level split + Begin Voting
// ═══════════════════════════════════════════════════════════════════════════
function InboxHero({ pendingCount, breakdown, onBeginVoting }: {
  pendingCount: number;
  breakdown: { global: number; federal: number; provincial: number; municipal: number };
  onBeginVoting: () => void;
}) {
  const dc = useDashboardColors();
  const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\//g, ' · ');
  const isPlural = pendingCount !== 1;
  // Only render split segments/legend rows that actually have data. The mock
  // shows federal/provincial/municipal; `global` (no geo restrictions) is a
  // real bucket in this app, so it appears when populated.
  const levels = [
    { key: 'federal', label: 'federal', count: breakdown.federal, color: dc.SPLIT_FEDERAL },
    { key: 'provincial', label: 'provincial', count: breakdown.provincial, color: dc.SPLIT_PROVINCIAL },
    { key: 'municipal', label: 'municipal', count: breakdown.municipal, color: dc.SPLIT_MUNICIPAL },
    { key: 'global', label: 'global', count: breakdown.global, color: dc.FG_FAINT },
  ].filter(l => l.count > 0);

  return (
    <Animated.View entering={FadeInUp.duration(500).delay(100)} style={[styles.hero, { backgroundColor: dc.BG_CARD, borderColor: GOLD_BORDER }]}>
      <View style={styles.heroHeader}>
        <Text style={[styles.heroEyebrow, { color: dc.GOLD }]}>YOUR CIVIC INBOX</Text>
        <Text style={[styles.heroDate, { color: dc.FG_FAINT }]}>{dateStr}</Text>
      </View>

      <View style={styles.heroNumberRow}>
        <Text style={[styles.heroNumber, { color: dc.GOLD }]}>{pendingCount}</Text>
        <View style={styles.heroNumberLabel}>
          <Text style={[styles.heroNumberLabelText, { color: dc.FG }]}>{isPlural ? 'proposals' : 'proposal'}</Text>
          <Text style={[styles.heroNumberLabelSub, { color: dc.FG_MUTED }]}>awaiting your voice</Text>
        </View>
      </View>

      {levels.length > 0 && (
        <View style={{ gap: 8 }}>
          <View style={styles.splitBar}>
            {levels.map((l, i) => (
              <View
                key={l.key}
                style={{
                  flex: l.count,
                  backgroundColor: l.color,
                  borderTopLeftRadius: i === 0 ? 3 : 0,
                  borderBottomLeftRadius: i === 0 ? 3 : 0,
                  borderTopRightRadius: i === levels.length - 1 ? 3 : 0,
                  borderBottomRightRadius: i === levels.length - 1 ? 3 : 0,
                }}
              />
            ))}
          </View>
          <View style={styles.splitLegend}>
            {levels.map(l => (
              <View key={l.key} style={styles.splitLegendItem}>
                <View style={[styles.splitLegendDot, { backgroundColor: l.color }]} />
                <Text style={[styles.splitLegendText, { color: dc.FG_MUTED }]}>
                  <Text style={TNUM}>{l.count}</Text> {l.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBeginVoting(); }}
        activeOpacity={0.9}
        style={[styles.ctaBtn, { backgroundColor: dc.GOLD_FILL }]}
      >
        <Text style={styles.ctaBtnText}>Begin Voting</Text>
        <View style={styles.ctaArrowCircle}>
          <Ionicons name="arrow-forward" size={17} color={ON_GOLD} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function UnverifiedHero({ globalCount, onVerify, onViewProposals }: { globalCount: number; onVerify: () => void; onViewProposals: () => void }) {
  const dc = useDashboardColors();
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(100)} style={[styles.hero, { backgroundColor: dc.BG_CARD, borderColor: GOLD_BORDER }]}>
      <View style={styles.heroHeader}>
        <Text style={[styles.heroEyebrow, { color: dc.GOLD }]}>VERIFY YOUR IDENTITY</Text>
      </View>

      <Text style={[styles.unverifiedHeadline, { color: dc.FG }]}>Unlock your civic voice</Text>
      <Text style={[styles.unverifiedSubhead, { color: dc.FG_MUTED }]}>
        Verify once to vote on proposals in your country, province, and city. Free and takes about 2 minutes.
      </Text>

      <TouchableOpacity onPress={onVerify} activeOpacity={0.9} style={[styles.ctaBtn, { backgroundColor: dc.GOLD_FILL }]}>
        <Text style={styles.ctaBtnText}>Get Verified</Text>
        <View style={styles.ctaArrowCircle}>
          <Ionicons name="arrow-forward" size={17} color={ON_GOLD} />
        </View>
      </TouchableOpacity>

      {globalCount > 0 && (
        <TouchableOpacity onPress={onViewProposals} activeOpacity={0.7} style={[styles.unverifiedTease, { borderTopColor: dc.LINE }]}>
          <Text style={[styles.unverifiedTeaseText, { color: dc.FG_MUTED }]}>
            <Text style={TNUM}>{globalCount}</Text> global {globalCount === 1 ? 'proposal' : 'proposals'} you can vote on now
          </Text>
          <Ionicons name="arrow-forward" size={14} color={dc.GOLD} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOSING STRIP — "N ballots close tonight" (or nearest deadlines)
// ═══════════════════════════════════════════════════════════════════════════
function ClosingStrip({ items, mode, onPress }: { items: Proposal[]; mode: 'tonight' | 'soon'; onPress: () => void }) {
  const dc = useDashboardColors();
  if (items.length === 0) return null;
  const n = items.length;
  const titleList = items.slice(0, 2).map(p => p.title).join(' · ');
  const headline = mode === 'tonight'
    ? `${n} ${n === 1 ? 'ballot closes' : 'ballots close'} tonight`
    : `${n} ${n === 1 ? 'ballot' : 'ballots'} closing soonest`;
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.sectionPad}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View style={[styles.stripCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE_SUBTLE }]}>
          <View style={styles.stripCount}>
            <Text style={[styles.stripCountNum, { color: dc.FG }]}>{n}</Text>
            <Text style={[styles.stripCountLabel, { color: dc.FG_FAINT }]}>{mode === 'tonight' ? 'TONIGHT' : 'CLOSING'}</Text>
          </View>
          <View style={[styles.stripDivider, { backgroundColor: dc.LINE_SUBTLE }]} />
          <View style={styles.stripBody}>
            <Text style={[styles.stripHeadline, { color: dc.FG }]} numberOfLines={1}>{headline}</Text>
            <Text style={[styles.stripMeta, { color: dc.FG_FAINT }]} numberOfLines={1}>{titleList}</Text>
          </View>
          <Ionicons name="arrow-forward" size={15} color={dc.GOLD} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CIVIC RECORD — mono stat tiles: ballots cast / decided / participation
// ═══════════════════════════════════════════════════════════════════════════
function CivicRecord({ voted, decided, participationPct }: { voted: number; decided: number; participationPct: number | null }) {
  const dc = useDashboardColors();
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.sectionPad}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.eyebrow, { color: dc.FG_FAINT }]}>YOUR CIVIC RECORD</Text>
        <Text style={[styles.sectionMetaMono, { color: dc.FG_FAINT }]}>ON THE LEDGER</Text>
      </View>
      <View style={styles.recordGrid}>
        <RecordTile value={String(voted)} label="BALLOTS CAST" />
        <RecordTile value={String(decided)} label="DECIDED" />
        <RecordTile value={participationPct === null ? '—' : `${participationPct}%`} label="PARTICIPATION" gold={participationPct !== null} />
      </View>
    </Animated.View>
  );
}

function RecordTile({ value, label, gold }: { value: string; label: string; gold?: boolean }) {
  const dc = useDashboardColors();
  return (
    <View style={[styles.recordTile, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE_SUBTLE }]}>
      <Text style={[styles.recordTileValue, { color: gold ? dc.GOLD : dc.FG }]}>{value}</Text>
      <Text style={[styles.recordTileLabel, { color: dc.FG_FAINT }]}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNITIES — where you can vote (kept feature, restyled)
// ═══════════════════════════════════════════════════════════════════════════
function Communities({ proposals, votedIds, country, state, city, isVerified, onPrimaryPress, onOpenDetail, router }: {
  proposals: Proposal[]; votedIds: Set<string>; country: string; state: string; city: string;
  isVerified: boolean;
  onPrimaryPress: () => void;
  onOpenDetail: () => void;
  router: any;
}) {
  const dc = useDashboardColors();
  const now = Date.now();
  const countAt = (level: number, name: string) => {
    const matched = proposals.filter(p => {
      const geo = p.geoRestrictions || [];
      if (geo.length <= level) return false;
      return geo[level].toLowerCase() === name.toLowerCase();
    });
    const active = matched.filter(p => !p.deadline || new Date(p.deadline).getTime() > now).length;
    return { total: matched.length, active };
  };
  const fed = countAt(0, country);
  const prov = countAt(1, state);
  const mun = countAt(2, city);
  const flagCode = (s: string) => s.slice(0, 2).toUpperCase();
  // Only show tiers the user actually has a location for. A passport-only
  // standard verification yields country but no province/city, so those
  // rows would otherwise render blank. Federal always shows when verified.
  const items = [
    { tier: 'Federal', name: country, meta: `${fed.total} proposals · ${fed.active} active`, primary: true, flag: flagCode(country), scope: 'country' as const },
    { tier: 'Provincial', name: state, meta: `${prov.total} proposals · ${prov.active} active`, primary: false, flag: flagCode(state), scope: 'state' as const },
    { tier: 'Municipal', name: city, meta: `${mun.total} proposals · ${mun.active} active`, primary: false, flag: flagCode(city), scope: 'city' as const },
  ].filter((it) => !!it.name && it.name.trim().length > 0);
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.sectionPad}>
      <TouchableOpacity
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onOpenDetail(); }}
        activeOpacity={0.7}
        style={styles.sectionHeader}
      >
        <Text style={[styles.eyebrow, { color: dc.FG_FAINT }]}>YOUR COMMUNITIES</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: dc.FG_FAINT, letterSpacing: 0.5 }}>Details</Text>
          <Ionicons name="chevron-forward" size={12} color={dc.FG_FAINT} />
        </View>
      </TouchableOpacity>

      <View style={[styles.communityCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE_SUBTLE }]}>
        {items.map((it, i) => (
          <CommunityRow key={it.name} {...it} last={i === items.length - 1}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (it.primary) onPrimaryPress();
              else router.push({ pathname: '/modals/community-proposals', params: { scope: it.scope, scopeName: it.name, icon: it.flag } });
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function CommunityRow({ tier, name, meta, primary, flag, last, onPress }: {
  tier: string; name: string; meta: string; primary: boolean; flag: string; last: boolean; onPress: () => void;
}) {
  const dc = useDashboardColors();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.communityRow, !last && [styles.communityRowBorder, { borderBottomColor: dc.LINE_SUBTLE }]]}>
        {primary && <View style={[styles.communityPrimaryBar, { backgroundColor: dc.GOLD_FILL }]} />}
        <View style={[styles.communityFlag, {
          backgroundColor: primary ? dc.GOLD_SURFACE : dc.BG_RAISED,
          borderColor: primary ? GOLD_BORDER : dc.LINE_STRONG,
        }]}>
          <Text style={[styles.communityFlagText, { color: primary ? dc.GOLD : dc.FG_MUTED }]}>{flag}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.communityNameRow}>
            <Text style={[styles.communityName, { color: dc.FG }]}>{name}</Text>
            <Text style={[styles.communityTier, { color: dc.FG_FAINT }]}>{tier}</Text>
          </View>
          <Text style={[styles.communityMeta, { color: dc.FG_FAINT }]}>{meta}</Text>
        </View>
        <Svg width={7} height={12} viewBox="0 0 7 12">
          <Path d="M1 1 L6 6 L1 11" stroke={dc.FG_FAINT} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </TouchableOpacity>
  );
}

const ORG_COLLAPSED_LIMIT = 3;

function YourOrganizations({ orgs, orgProposalsByOrg, votedIds, router }: {
  orgs: Organization[];
  orgProposalsByOrg: Record<string, OrganizationProposal[]>;
  votedIds: Set<string>;
  router: any;
}) {
  const dc = useDashboardColors();
  const [expanded, setExpanded] = useState(false);
  const now = Date.now();

  const rows = orgs
    .map((org) => {
      const orgProps = orgProposalsByOrg[org.id] || [];
      const pendingCount = orgProps.filter((p) => {
        const active = !p.deadline || new Date(p.deadline).getTime() > now;
        return active && !votedIds.has(String(p.id));
      }).length;
      return { org, pendingCount };
    })
    .sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
      return a.org.name.localeCompare(b.org.name);
    });

  // Always show every org that has something awaiting the user; pad with
  // caught-up orgs up to the collapsed limit so the section stays useful
  // for users with mostly-quiet orgs too.
  const pendingRows = rows.filter((r) => r.pendingCount > 0);
  const restRows = rows.filter((r) => r.pendingCount === 0);
  const collapsedRows = expanded
    ? rows
    : [...pendingRows, ...restRows.slice(0, Math.max(0, ORG_COLLAPSED_LIMIT - pendingRows.length))];
  const hiddenCount = rows.length - collapsedRows.length;
  const totalPending = pendingRows.reduce((s, r) => s + r.pendingCount, 0);

  return (
    <Animated.View entering={FadeInUp.duration(500).delay(450)} style={styles.sectionPad}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.eyebrow, { color: dc.FG_FAINT }]}>YOUR ORGANIZATIONS</Text>
        <Text style={[styles.eyebrowMeta, { color: dc.FG_FAINT }]}>
          {orgs.length} {orgs.length === 1 ? 'community' : 'communities'}
          {totalPending > 0 ? ` · ${totalPending} pending` : ''}
        </Text>
      </View>

      <View style={[styles.communityCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE_SUBTLE }]}>
        {collapsedRows.map((row, i) => (
          <OrgRow
            key={row.org.id}
            org={row.org}
            pendingCount={row.pendingCount}
            last={i === collapsedRows.length - 1 && hiddenCount === 0 && !expanded}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({
                pathname: '/modals/organization-detail',
                params: { orgId: row.org.id, orgName: row.org.name, orgRole: row.org.role || 'member' },
              });
            }}
          />
        ))}
        {(hiddenCount > 0 || expanded) && (
          <TouchableOpacity
            onPress={() => {
              Haptics.selectionAsync();
              setExpanded((v) => !v);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.orgExpandRow, { borderTopColor: dc.LINE_SUBTLE }]}>
              <Text style={[styles.orgExpandText, { color: dc.GOLD }]}>
                {expanded
                  ? 'Show fewer'
                  : `Show all ${orgs.length} communities${hiddenCount > 0 ? ` (+${hiddenCount})` : ''}`}
              </Text>
              <Svg width={10} height={6} viewBox="0 0 10 6">
                <Path
                  d={expanded ? 'M1 5 L5 1 L9 5' : 'M1 1 L5 5 L9 1'}
                  stroke={dc.GOLD}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

function OrgRow({ org, pendingCount, last, onPress }: {
  org: Organization; pendingCount: number; last: boolean; onPress: () => void;
}) {
  const dc = useDashboardColors();
  const initial = org.name.charAt(0).toUpperCase();
  const memberLabel = `${org.memberCount} ${org.memberCount === 1 ? 'member' : 'members'}`;
  const pendingLabel =
    pendingCount === 0
      ? 'No proposals awaiting your voice'
      : `${pendingCount} ${pendingCount === 1 ? 'proposal' : 'proposals'} awaiting your voice`;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.communityRow, !last && [styles.communityRowBorder, { borderBottomColor: dc.LINE_SUBTLE }]]}>
        {pendingCount > 0 && <View style={[styles.communityPrimaryBar, { backgroundColor: dc.GOLD_FILL }]} />}
        <View style={[styles.communityFlag, {
          backgroundColor: pendingCount > 0 ? dc.GOLD_SURFACE : dc.BG_RAISED,
          borderColor: pendingCount > 0 ? GOLD_BORDER : dc.LINE_STRONG,
          overflow: 'hidden',
        }]}>
          {org.logoUrl ? (
            <ExpoImage
              source={{ uri: org.logoUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <Text style={[styles.communityFlagText, { color: pendingCount > 0 ? dc.GOLD : dc.FG_MUTED }]}>{initial}</Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.communityNameRow}>
            <Text style={[styles.communityName, { color: dc.FG }]} numberOfLines={1}>{org.name}</Text>
            <Text style={[styles.communityTier, { color: dc.FG_FAINT }]}>{memberLabel}</Text>
          </View>
          <Text style={[styles.communityMeta, { color: pendingCount > 0 ? dc.GOLD : dc.FG_FAINT }]}>{pendingLabel}</Text>
        </View>
        <Svg width={7} height={12} viewBox="0 0 7 12">
          <Path d="M1 1 L6 6 L1 11" stroke={dc.FG_FAINT} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRENDING DIGEST — most-engaged active proposals (kept feature, restyled)
// ═══════════════════════════════════════════════════════════════════════════
function SentinelDigest({ items }: { items: Proposal[] }) {
  const dc = useDashboardColors();
  const now = Date.now();
  const formatRemaining = (deadline: string) => {
    const ms = new Date(deadline).getTime() - now;
    if (ms <= 0) return 'closed';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days >= 2) return `${days}d left`;
    if (days === 1) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };
  const tagFor = (p: Proposal): string => {
    if (!p.deadline) return 'NEW';
    const remaining = new Date(p.deadline).getTime() - now;
    if (remaining <= 0) return 'PASS';
    if (remaining < 86400000 * 2) return 'VOTE';
    return 'NEW';
  };
  const tierLabel = (p: Proposal) => {
    const len = (p.geoRestrictions || []).length;
    if (len === 0) return 'Global';
    return len >= 3 ? 'Municipal' : len === 2 ? 'Provincial' : 'Federal';
  };
  const compact = (n: number) => {
    if (n >= 10000) return `${Math.round(n / 1000)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };
  const rows = items.map(p => {
    const totalVotes = p.supportVotes + p.opposeVotes;
    return {
      id: String(p.id),
      time: totalVotes > 0 ? compact(totalVotes) : '·',
      tag: tagFor(p),
      headline: p.title,
      meta: `${tierLabel(p)} · ${p.deadline ? formatRemaining(p.deadline) : 'open'}`,
    };
  });
  if (rows.length === 0) return null;
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(500)} style={styles.sectionPad}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.eyebrow, { color: dc.FG_FAINT }]}>TRENDING</Text>
        <Text style={[styles.sectionMetaMono, { color: dc.FG_FAINT }]}>BY BALLOTS</Text>
      </View>
      <View style={[styles.communityCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE_SUBTLE }]}>
        {rows.map((r, i) => (
          <View key={r.id}>
            <DigestRow {...r} />
            {i < rows.length - 1 && <View style={[styles.hairline, { backgroundColor: dc.LINE_SUBTLE }]} />}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function DigestRow({ time, tag, headline, meta }: { time: string; tag: string; headline: string; meta: string }) {
  const dc = useDashboardColors();
  const tagColor = tag === 'NEW' ? dc.GOLD : tag === 'PASS' ? dc.GREEN : dc.FG_MUTED;
  return (
    <View style={styles.digestRow}>
      <Text style={[styles.digestTime, { color: dc.FG_FAINT }]}>{time}</Text>
      <Text style={[styles.digestTag, { color: tagColor, backgroundColor: `${tagColor}1A` }]}>{tag}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.digestHeadline, { color: dc.FG }]}>{headline}</Text>
        <Text style={[styles.digestMeta, { color: dc.FG_FAINT }]}>{meta}</Text>
      </View>
    </View>
  );
}

function FooterSig() {
  const dc = useDashboardColors();
  return (
    <View style={styles.footerSig}>
      <View style={[styles.footerLine, { backgroundColor: dc.LINE_STRONG }]} />
      <Text style={[styles.footerTagline, { color: dc.FG_FAINT }]}>Verified civic infrastructure.</Text>
      <Text style={[styles.footerMark, { color: dc.FG_FAINT }]}>Represent · Est. 2026</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES — M1 mock values (24px screen padding, radius 22 hero / 18 cards)
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 0 },

  eyebrow: {
    fontFamily: FONTS.sansSemiBold, fontSize: 11,
    letterSpacing: 1.54, textTransform: 'uppercase', color: FG_FAINT,
  },
  hairline: { height: 1, backgroundColor: LINE_SUBTLE },

  // TopBar — mock: status dot + VERIFIED · PLACE / date · 44px avatar
  topBar: {
    paddingHorizontal: SPACING.screenPadding, paddingTop: 8, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topBarLeftRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  topBarStatus: {
    fontFamily: FONTS.sansSemiBold, fontSize: 10.5,
    letterSpacing: 1.68, color: FG_MUTED,
  },
  topBarDate: { fontFamily: FONTS.sans, fontSize: 13, color: FG_FAINT },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: BG_CARD, borderWidth: 1, borderColor: GOLD_BORDER_STRONG,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarLetter: { fontFamily: FONTS.serif, fontSize: 18, color: G_GOLD },
  avatarVerifiedDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: BG,
  },

  // Hero — mock: surface card, gold .28 border, radius 22, padding 22, gap 16
  hero: {
    marginHorizontal: SPACING.screenPadding, marginBottom: 16,
    borderRadius: 22, padding: 22, gap: 16,
    backgroundColor: BG_CARD, borderWidth: 1, borderColor: GOLD_BORDER,
  },
  heroHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  heroEyebrow: {
    fontFamily: FONTS.sansSemiBold, fontSize: 10.5,
    letterSpacing: 1.68, color: G_GOLD,
  },
  heroDate: {
    fontFamily: FONTS.mono, fontSize: 10.5, color: FG_FAINT,
    letterSpacing: 0.84, ...TNUM,
  },
  heroNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  heroNumber: {
    fontFamily: FONTS.serif, fontSize: 76, lineHeight: 70,
    letterSpacing: -1.5, color: G_GOLD, ...TNUM,
  },
  heroNumberLabel: { gap: 2 },
  heroNumberLabelText: {
    fontFamily: FONTS.serifMediumItalic, fontSize: 24, lineHeight: 26, color: FG,
  },
  heroNumberLabelSub: { fontFamily: FONTS.sans, fontSize: 14, color: FG_MUTED },

  // Level split — mock: 6px tri-tone bar, 3px gaps, dot legend
  splitBar: { flexDirection: 'row', height: 6, gap: 3 },
  splitLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, rowGap: 6 },
  splitLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  splitLegendDot: { width: 6, height: 6, borderRadius: 3 },
  splitLegendText: { fontFamily: FONTS.sans, fontSize: 11.5, color: FG_MUTED },

  // Gold CTA — mock: 54h, radius 15, label 16.5 semibold, 38px arrow circle
  ctaBtn: {
    height: 54, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 20, paddingRight: 8,
    backgroundColor: G_GOLD,
  },
  ctaBtnText: {
    fontFamily: FONTS.sansSemiBold, fontSize: 16.5, color: ON_GOLD, letterSpacing: -0.15,
  },
  ctaArrowCircle: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(4,7,7,0.15)',
  },

  // Unverified hero
  unverifiedHeadline: {
    fontFamily: FONTS.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.36,
  },
  unverifiedSubhead: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20 },
  unverifiedTease: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE,
  },
  unverifiedTeaseText: { fontFamily: FONTS.sansMedium, fontSize: 12 },

  // Closing strip — mock: mono count block · divider · headline/titles · arrow
  stripCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: RADIUS.card, borderWidth: 1,
    paddingVertical: 16, paddingHorizontal: 18,
    backgroundColor: BG_CARD, borderColor: LINE_SUBTLE,
  },
  stripCount: { alignItems: 'center' },
  stripCountNum: {
    fontFamily: FONTS.monoSemiBold, fontSize: 22, color: FG, ...TNUM,
  },
  stripCountLabel: {
    fontFamily: FONTS.mono, fontSize: 8, letterSpacing: 1.12, color: FG_FAINT,
  },
  stripDivider: { width: 1, alignSelf: 'stretch', backgroundColor: LINE_SUBTLE },
  stripBody: { flex: 1, gap: 2, minWidth: 0 },
  stripHeadline: { fontFamily: FONTS.sansSemiBold, fontSize: 12.5, color: FG },
  stripMeta: { fontFamily: FONTS.sans, fontSize: 11.5, color: FG_FAINT },

  // Civic record — mock: 3-up mono stat tiles, radius 16
  recordGrid: { flexDirection: 'row', gap: 10 },
  recordTile: {
    flex: 1, borderRadius: 16, borderWidth: 1,
    paddingVertical: 13, paddingHorizontal: 14, gap: 2,
    backgroundColor: BG_CARD, borderColor: LINE_SUBTLE,
  },
  recordTileValue: {
    fontFamily: FONTS.monoSemiBold, fontSize: 20, color: FG, ...TNUM,
  },
  recordTileLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 9, letterSpacing: 0.9, color: FG_FAINT,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingBottom: 12,
  },
  sectionPad: { paddingHorizontal: SPACING.screenPadding, paddingBottom: 20 },
  sectionMetaMono: {
    fontFamily: FONTS.mono, fontSize: 10.5, color: FG_FAINT,
    letterSpacing: 0.84, textTransform: 'uppercase', ...TNUM,
  },
  eyebrowMeta: {
    fontFamily: FONTS.sans, fontSize: 11, color: FG_FAINT, letterSpacing: 0.3,
  },
  orgExpandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: LINE_SUBTLE,
  },
  orgExpandText: { fontFamily: FONTS.sansMedium, fontSize: 13 },

  // Community / org list card
  communityCard: {
    backgroundColor: BG_CARD, borderWidth: 1, borderColor: LINE_SUBTLE,
    borderRadius: RADIUS.card, overflow: 'hidden',
  },
  communityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    position: 'relative',
  },
  communityRowBorder: { borderBottomWidth: 1, borderBottomColor: LINE_SUBTLE },
  communityPrimaryBar: {
    position: 'absolute', left: 0, top: 8, bottom: 8, width: 2,
    backgroundColor: G_GOLD, borderTopRightRadius: 2, borderBottomRightRadius: 2,
  },
  communityFlag: {
    width: 36, height: 36, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  communityFlagText: {
    fontFamily: FONTS.monoSemiBold, fontSize: 10, letterSpacing: 0.8, ...TNUM,
  },
  communityNameRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2,
  },
  communityName: {
    fontFamily: FONTS.sansSemiBold, fontSize: 15, color: FG, letterSpacing: -0.15,
  },
  communityTier: {
    fontFamily: FONTS.mono, fontSize: 9, color: FG_FAINT,
    letterSpacing: 1.26, textTransform: 'uppercase', ...TNUM,
  },
  communityMeta: { fontFamily: FONTS.sans, fontSize: 12, color: FG_FAINT },

  // Trending digest
  digestRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  digestTime: {
    fontFamily: FONTS.mono, fontSize: 10, color: FG_FAINT,
    letterSpacing: 0.6, paddingTop: 3, width: 38, ...TNUM,
  },
  digestTag: {
    fontFamily: FONTS.monoSemiBold, fontSize: 9,
    letterSpacing: 1.26, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 4, marginTop: 2, overflow: 'hidden',
  },
  digestHeadline: {
    fontFamily: FONTS.sansMedium, fontSize: 13.5, color: FG,
    letterSpacing: -0.135, lineHeight: 18, marginBottom: 3,
  },
  digestMeta: {
    fontFamily: FONTS.sans, fontSize: 11, color: FG_FAINT, letterSpacing: 0.22,
  },

  // Footer
  footerSig: {
    paddingHorizontal: SPACING.screenPadding, paddingTop: 8, paddingBottom: 18,
    alignItems: 'center', gap: 6,
  },
  footerLine: { width: 24, height: 1 },
  footerTagline: {
    fontFamily: FONTS.serifMediumItalic, fontSize: 13,
    color: FG_FAINT, letterSpacing: -0.065,
  },
  footerMark: {
    fontFamily: FONTS.mono, fontSize: 8.5, color: FG_FAINT,
    letterSpacing: 2.04, textTransform: 'uppercase', marginTop: 2,
  },
});

// UPDATE 30 — "Where you can vote" detail page. Renders as a
// dashboard tab takeover. No <Modal>, no navigation — pure
// conditional render driven by communitiesPageOpen state.
const COUNTRY_FLAG_EMOJI: Record<string, string> = {
  canada: '🇨🇦',
  'united states': '🇺🇸',
  'united kingdom': '🇬🇧',
  australia: '🇦🇺',
  france: '🇫🇷',
  germany: '🇩🇪',
};

function CommunitiesDetailPage({
  proposals, country, state, city, isVerified, onClose, onVerify,
}: {
  proposals: Proposal[];
  country: string;
  state: string;
  city: string;
  isVerified: boolean;
  onClose: () => void;
  onVerify: () => void;
}) {
  const dc = useDashboardColors();
  const insets = useSafeAreaInsets();
  const now = Date.now();

  const countAt = (level: number, name: string) => {
    const matched = proposals.filter(p => {
      const geo = p.geoRestrictions || [];
      if (geo.length <= level) return false;
      return geo[level].toLowerCase() === (name || '').toLowerCase();
    });
    const active = matched.filter(p => !p.deadline || new Date(p.deadline).getTime() > now).length;
    return { total: matched.length, active };
  };

  const globalProposals = proposals.filter(p => (p.geoRestrictions || []).length === 0);
  const globalActive = globalProposals.filter(p => !p.deadline || new Date(p.deadline).getTime() > now).length;
  const fed = countAt(0, country);
  const prov = countAt(1, state);
  const mun = countAt(2, city);

  const tiers = [
    {
      key: 'global',
      label: 'Global',
      scopeLabel: 'Open to everyone',
      locationName: 'Worldwide',
      flag: '🌍',
      total: globalProposals.length,
      active: globalActive,
      eligible: true,
    },
    {
      key: 'federal',
      label: 'Federal',
      scopeLabel: 'Country',
      locationName: country || null,
      flag: COUNTRY_FLAG_EMOJI[(country || '').toLowerCase()] ?? ((country || '').slice(0, 2).toUpperCase() || null),
      total: fed.total,
      active: fed.active,
      eligible: isVerified && !!country,
    },
    {
      key: 'provincial',
      label: 'Provincial',
      scopeLabel: 'Province or state',
      locationName: state || null,
      flag: state ? state.slice(0, 2).toUpperCase() : null,
      total: prov.total,
      active: prov.active,
      eligible: isVerified && !!state,
    },
    {
      key: 'municipal',
      label: 'Municipal',
      scopeLabel: 'City',
      locationName: city || null,
      flag: city ? city.slice(0, 2).toUpperCase() : null,
      total: mun.total,
      active: mun.active,
      eligible: isVerified && !!city,
    },
  ];

  const totalEligibleActive = tiers.reduce((sum, t) => sum + (t.eligible ? t.active : 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: dc.BG }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: insets.top + 12, paddingBottom: 14,
        borderBottomWidth: 1, borderBottomColor: dc.LINE,
      }}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, left: 8, right: 8, bottom: 8 }}>
          <Ionicons name="chevron-back" size={26} color={dc.FG} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontFamily: FONTS.serif, color: dc.FG, marginRight: 26 }}>
          Where you can vote
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.screenPadding, paddingBottom: insets.bottom + 32 }}>
        {/* Hero */}
        <Animated.View entering={FadeInUp.duration(400)} style={{
          backgroundColor: dc.BG_CARD,
          borderWidth: 1, borderColor: GOLD_BORDER,
          borderRadius: 22, padding: 20, alignItems: 'center',
          marginBottom: 18,
        }}>
          <Text style={{ fontSize: 10.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.68, textTransform: 'uppercase', color: dc.FG_FAINT, marginBottom: 6 }}>
            Your civic reach
          </Text>
          <Text style={{ fontSize: 44, fontFamily: FONTS.monoSemiBold, color: dc.GOLD, letterSpacing: -1, lineHeight: 50, ...TNUM }}>
            {totalEligibleActive}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: FONTS.sans, color: dc.FG_MUTED, marginTop: 4 }}>
            active proposal{totalEligibleActive === 1 ? '' : 's'} you can vote on
          </Text>
          {isVerified ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 }}>
              <Ionicons name="shield-checkmark" size={14} color={dc.GOLD} />
              <Text style={{ fontSize: 11.5, color: dc.GOLD, fontFamily: FONTS.sansSemiBold }}>
                Verified resident of {[city, state, country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: 12, gap: 6,
              paddingHorizontal: 12, paddingVertical: 5,
              backgroundColor: dc.GOLD_SURFACE,
              borderRadius: RADIUS.chip,
            }}>
              <Ionicons name="lock-closed" size={12} color={dc.GOLD} />
              <Text style={{ fontSize: 11.5, color: dc.GOLD, fontFamily: FONTS.sansSemiBold }}>
                Unverified — global only
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Section label */}
        <Text style={{ fontSize: 10.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.68, textTransform: 'uppercase', color: dc.FG_FAINT, marginBottom: 10, paddingHorizontal: 2 }}>
          Your eligibility
        </Text>

        {/* Tier rows */}
        {tiers.map((tier, idx) => {
          const isMuted = !tier.eligible;
          const accent = tier.eligible ? dc.GOLD : dc.FG_FAINT;
          const flag = tier.flag ?? '—';
          return (
            <Animated.View
              key={tier.key}
              entering={FadeInUp.delay(100 + idx * 80).duration(350)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                backgroundColor: dc.BG_CARD,
                borderColor: tier.eligible ? GOLD_BORDER : dc.LINE_SUBTLE,
                borderWidth: 1,
                borderRadius: RADIUS.card,
                marginBottom: 10,
                gap: 14,
                opacity: isMuted ? 0.7 : 1,
              }}
            >
              <View style={{
                width: 50, height: 50, borderRadius: 25,
                backgroundColor: tier.eligible ? dc.GOLD_SURFACE : dc.BG_RAISED,
                borderColor: tier.eligible ? GOLD_BORDER_STRONG : dc.LINE,
                borderWidth: 1,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{
                  fontSize: flag.length === 2 ? 13 : 22,
                  fontFamily: FONTS.monoSemiBold,
                  color: accent,
                  letterSpacing: 0.5,
                }}>
                  {flag}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontFamily: FONTS.sansSemiBold, color: isMuted ? dc.FG_FAINT : dc.FG, letterSpacing: -0.1 }} numberOfLines={1}>
                  {tier.locationName ?? '—'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={{ fontSize: 10, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.5, textTransform: 'uppercase', color: accent }}>
                    {tier.label}
                  </Text>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: dc.FG_FAINT }} />
                  <Text style={{ fontSize: 11, fontFamily: FONTS.sans, color: dc.FG_MUTED }}>{tier.scopeLabel}</Text>
                </View>
                {tier.eligible ? (
                  <Text style={{ fontSize: 12, fontFamily: FONTS.sans, color: dc.FG_MUTED, marginTop: 6 }}>
                    <Text style={{ color: dc.FG, fontFamily: FONTS.monoSemiBold, ...TNUM }}>{tier.active}</Text> active
                    <Text style={{ color: dc.FG_FAINT }}> · {tier.total} total</Text>
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Ionicons name="lock-closed" size={11} color={dc.FG_FAINT} />
                    <Text style={{ fontSize: 11, fontFamily: FONTS.sans, color: dc.FG_FAINT }}>
                      {tier.locationName ? 'Verify identity to unlock' : 'No location on file'}
                    </Text>
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })}

        {/* Explainer */}
        <View style={{
          marginTop: 14,
          padding: 14,
          backgroundColor: dc.GOLD_SURFACE,
          borderColor: GOLD_BORDER,
          borderWidth: 1,
          borderRadius: RADIUS.card,
          flexDirection: 'row',
          gap: 10,
        }}>
          <Ionicons name="information-circle-outline" size={20} color={dc.GOLD} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: FONTS.sansSemiBold, color: dc.FG, marginBottom: 4 }}>
              How geo-gating works
            </Text>
            <Text style={{ fontSize: 12, fontFamily: FONTS.sans, color: dc.FG_MUTED, lineHeight: 17 }}>
              Verifying your identity unlocks voting on proposals tied to your country, province, and city. Global proposals are open to anyone. One verified person, one ballot per proposal.
            </Text>
          </View>
        </View>

        {!isVerified && (
          <TouchableOpacity
            onPress={() => { onClose(); setTimeout(onVerify, 200); }}
            activeOpacity={0.85}
            style={{
              marginTop: 18,
              height: 54,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: dc.GOLD_FILL,
            }}
          >
            <Text style={{ fontSize: 16.5, fontFamily: FONTS.sansSemiBold, color: ON_GOLD }}>
              Verify identity to unlock
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
