import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path, Defs, LinearGradient as SvgLinearGradient, Stop, G as SvgG } from 'react-native-svg';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SPACING, useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi, organizationsApi, veriffApi, type Proposal, type Organization, type OrganizationProposal } from '../../lib/api';
import { useModerationStore, useSyncMutes } from '../../lib/moderation';
import { useFocusEffect } from 'expo-router';

// ═══════════════════════════════════════════════════════════════════════════
// DESIGN TOKENS — from Home Redesign.html (static fallbacks for StyleSheet)
// ═══════════════════════════════════════════════════════════════════════════
const G_GOLD = '#EABA58';
const G_GOLD_DARK = '#C89A3E';
const G_GOLD_LIGHT = '#F4D28C';
const BG = '#040707';
const BG_CARD = '#0D0F12';
const BG_RAISED = '#15181C';
const LINE = '#1E2228';
const LINE_STRONG = '#2A2F37';
const FG = '#F4F5F6';
const FG_MUTED = '#C7CACD';
const FG_FAINT = '#8E9297';
const GREEN = '#34C759';

const SERIF = 'Georgia';
const SANS = 'Onest';
const MONO = 'JetBrains Mono';

// Dynamic hook for components to get theme-aware colors
function useDashboardColors() {
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
  // (Hero, breakdown, featured, digest) only counts non-org proposals so
  // that org-scoped proposals don't get bucketed as federal/provincial/etc.
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

  // Featured: pending proposal with closest upcoming deadline
  const featured = pendingProposals
    .filter(p => p.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];

  // Impact stats. Demo account gets a curated, engaged-citizen profile so
  // App Store reviewers see a populated Civic Record instead of zeroes.
  const realVotedCount = votedIds.size;
  const realPassedCount = civicProposals.filter(p =>
    votedIds.has(String(p.id)) && p.deadline && new Date(p.deadline).getTime() <= now
  ).length;
  const votedCount = isDemoAccount ? 47 : realVotedCount;
  const passedCount = isDemoAccount ? 31 : realPassedCount;
  const ringPending = isDemoAccount ? 12 : pendingCount;

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
        <TopBar name={displayName} city={userCity} state={userState} verified={isVerified} onAvatarPress={() => router.push('/(tabs)/profile')} onVerifyPress={handleStartKyc} />
        {isVerified ? (
          <Hero pendingCount={pendingCount} breakdown={breakdown} onBeginVoting={navigateToProposals} />
        ) : (
          <UnverifiedHero globalCount={pendingCount} onVerify={handleStartKyc} onViewProposals={navigateToProposals} />
        )}
        <Featured
          proposal={featured}
          onPress={() => {
            if (featured) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push({ pathname: '/(tabs)/proposals', params: { proposalId: String(featured.id) } });
            } else {
              navigateToProposals();
            }
          }}
        />
        {isVerified && <ImpactRing pending={ringPending} voted={votedCount} passed={passedCount} />}
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
// PLACEHOLDER COMPONENTS (filled in via subsequent edits)
// ═══════════════════════════════════════════════════════════════════════════
function TopBar({ name, city, state, verified, onAvatarPress, onVerifyPress }: { name: string; city: string; state: string; verified: boolean; onAvatarPress: () => void; onVerifyPress?: () => void }) {
  const dc = useDashboardColors();
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const locationText = city && state ? ` · ${city}, ${state}` : '';
  const statusText = verified ? `Verified${locationText}` : 'Unverified · tap to verify';
  const dotColor = verified ? dc.GREEN : dc.FG_FAINT;
  const StatusContainer: any = verified || !onVerifyPress ? View : TouchableOpacity;
  const statusContainerProps = verified || !onVerifyPress ? {} : { onPress: onVerifyPress, activeOpacity: 0.7, hitSlop: { top: 10, bottom: 10, left: 10, right: 10 } };
  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.topBar}>
      <View>
        <StatusContainer {...statusContainerProps}>
          <View style={styles.topBarLeftRow}>
            <View style={[styles.greenDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.topBarStatus, { color: verified ? dc.FG_MUTED : dc.GOLD }]}>{statusText}</Text>
          </View>
        </StatusContainer>
        <Text style={[styles.topBarDate, { color: dc.FG_FAINT }]}>{dateStr}</Text>
      </View>
      <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
        <LinearGradient
          colors={[`${dc.GOLD}66`, `${dc.GOLD}0D`]}
          style={styles.avatarOuter}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <View style={[styles.avatarInner, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
            <Text style={[styles.avatarLetter, { color: dc.GOLD }]}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        </LinearGradient>
        {verified && <View style={[styles.avatarVerifiedDot, { backgroundColor: dc.GREEN }]} />}
      </TouchableOpacity>
    </Animated.View>
  );
}
function Hero({ pendingCount, breakdown, onBeginVoting }: { pendingCount: number; breakdown: { global: number; federal: number; provincial: number; municipal: number }; onBeginVoting: () => void }) {
  const dc = useDashboardColors();
  const dateStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }).replace(/\//g, ' · ');
  const total = Math.max(breakdown.federal + breakdown.provincial + breakdown.municipal, 1);
  const isPlural = pendingCount !== 1;
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(100)} style={[styles.hero, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
      <View style={styles.heroInner}>
        <View style={styles.heroHeader}>
          <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Your Civic Inbox</Text>
          <Text style={[styles.heroDate, { color: dc.FG_FAINT }]}>{dateStr}</Text>
        </View>

        <View style={styles.heroNumberRow}>
          <Text style={[styles.heroNumber, { color: dc.GOLD }]}>{pendingCount}</Text>
          <View style={styles.heroNumberLabel}>
            <Text style={[styles.heroNumberLabelText, { color: dc.FG }]}>{isPlural ? 'proposals' : 'proposal'}</Text>
            <Text style={[styles.heroNumberLabelSub, { color: dc.FG_MUTED }]}>awaiting your voice</Text>
          </View>
        </View>

        <View style={[styles.breakdownBarTrack, { backgroundColor: dc.LINE }]}>
          {breakdown.federal > 0 && <View style={{ flex: breakdown.federal, backgroundColor: dc.GOLD }} />}
          {breakdown.provincial > 0 && <View style={{ flex: breakdown.provincial, backgroundColor: dc.GOLD_LIGHT, opacity: 0.6 }} />}
          {breakdown.municipal > 0 && <View style={{ flex: breakdown.municipal, backgroundColor: dc.GOLD_DARK, opacity: 0.7 }} />}
          {total === 0 && <View style={{ flex: 1, backgroundColor: dc.LINE }} />}
        </View>
        <View style={styles.breakdownLegend}>
          <Text style={[styles.breakdownLegendItem, { color: dc.FG_FAINT }]}><Text style={{ color: dc.GOLD }}>● </Text>{breakdown.federal} federal</Text>
          <Text style={[styles.breakdownLegendItem, { color: dc.FG_FAINT }]}><Text style={{ color: dc.GOLD_LIGHT }}>● </Text>{breakdown.provincial} provincial</Text>
          <Text style={[styles.breakdownLegendItem, { color: dc.FG_FAINT }]}><Text style={{ color: dc.GOLD_DARK }}>● </Text>{breakdown.municipal} municipal</Text>
        </View>

        <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBeginVoting(); }} activeOpacity={0.9}>
          <LinearGradient
            colors={[dc.GOLD, dc.GOLD_DARK]}
            style={styles.ctaBtn}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          >
            <Text style={styles.ctaBtnText}>Begin voting</Text>
            <View style={styles.ctaArrowCircle}>
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d="M5 12 L19 12 M12 5 L19 12 L12 19" stroke="#1A1206" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
function UnverifiedHero({ globalCount, onVerify, onViewProposals }: { globalCount: number; onVerify: () => void; onViewProposals: () => void }) {
  const dc = useDashboardColors();
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(100)} style={[styles.hero, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
      <View style={styles.heroInner}>
        <View style={styles.heroHeader}>
          <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Verify Your Identity</Text>
        </View>

        <Text style={[styles.unverifiedHeadline, { color: dc.GOLD }]}>Unlock your civic voice</Text>
        <Text style={[styles.unverifiedSubhead, { color: dc.FG_MUTED }]}>
          Verify once to vote on proposals in your country, province, and city. Free and takes about 2 minutes.
        </Text>

        <TouchableOpacity onPress={onVerify} activeOpacity={0.9}>
          <LinearGradient
            colors={[dc.GOLD, dc.GOLD_DARK]}
            style={styles.ctaBtn}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          >
            <Text style={styles.ctaBtnText}>Get Verified</Text>
            <View style={styles.ctaArrowCircle}>
              <Svg width={14} height={14} viewBox="0 0 24 24">
                <Path d="M5 12 L19 12 M12 5 L19 12 L12 19" stroke="#1A1206" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </Svg>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {globalCount > 0 && (
          <TouchableOpacity onPress={onViewProposals} activeOpacity={0.7} style={[styles.unverifiedTease, { borderTopColor: dc.LINE }]}>
            <Text style={[styles.unverifiedTeaseText, { color: dc.FG_MUTED }]}>
              {globalCount} global {globalCount === 1 ? 'proposal' : 'proposals'} you can vote on now
            </Text>
            <Svg width={7} height={12} viewBox="0 0 7 12">
              <Path d="M1 1 L6 6 L1 11" stroke={dc.GOLD} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

function Featured({ proposal, onPress }: { proposal?: Proposal; onPress: () => void }) {
  const dc = useDashboardColors();
  if (!proposal) return null;
  const deadlineMs = proposal.deadline ? new Date(proposal.deadline).getTime() : Date.now() + 7 * 86400000;
  const remainingMs = Math.max(deadlineMs - Date.now(), 0);
  const days = Math.floor(remainingMs / 86400000);
  const hours = Math.floor((remainingMs % 86400000) / 3600000);
  const closeText = days > 1 ? `Closes in ${days} days` : days === 1 ? 'Closes in 1 day' : hours > 0 ? `Closes in ${hours}h` : 'Closing today';
  const totalVotes = proposal.supportVotes + proposal.opposeVotes;
  const supportPct = totalVotes > 0 ? Math.round((proposal.supportVotes / totalVotes) * 100) : 0;
  const opposePct = totalVotes > 0 ? 100 - supportPct : 0;
  const scope = (proposal.geoRestrictions || []).length;
  const tierLabel = scope === 0 ? 'GLBL' : scope >= 3 ? 'MUNI' : scope === 2 ? 'PROV' : 'FED';
  const idDigits = String(proposal.id).match(/\d+/g)?.join('') || '000';
  const refCode = `${tierLabel} · ${idDigits.slice(-3).padStart(3, '0')}`;

  return (
    <Animated.View entering={FadeInUp.duration(500).delay(200)} style={styles.sectionPad}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Featured This Week</Text>
        <Text style={[styles.sectionMetaMono, { color: dc.GOLD }]}>{refCode}</Text>
      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.92}>
        <View style={[styles.featuredCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
          <View style={styles.featuredImage}>
            {proposal.imageUrl ? (
              <>
                <ExpoImage
                  source={{ uri: proposal.imageUrl }}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={150}
                />
                <LinearGradient
                  colors={['rgba(4,7,7,0.2)', 'rgba(4,7,7,0.55)', 'rgba(13,15,18,0.95)']}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                />
                <View style={{
                  position: 'absolute', right: -40, top: -40,
                  width: 140, height: 140, borderRadius: 70,
                  backgroundColor: 'rgba(234,186,88,0.10)',
                }} />
              </>
            ) : (
              <>
                <LinearGradient
                  colors={['rgba(234,186,88,0.18)', 'transparent', '#0A0C10']}
                  start={{ x: 0.3, y: 0.3 }} end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                />
                <Svg width="100%" height={140} viewBox="0 0 360 140" preserveAspectRatio="xMidYMid slice">
                  <SvgG opacity={0.5}>
                    {[40, 60, 80, 100, 160, 180, 200, 260, 280, 300, 320].map((x, i) => {
                      const heights = [60, 50, 65, 55, 40, 20, 40, 55, 65, 50, 60];
                      return <Line key={i} x1={x} y1={120} x2={x} y2={heights[i]} stroke={G_GOLD} strokeWidth={0.7} />;
                    })}
                  </SvgG>
                  <Path d="M150 50 Q180 0 210 50" fill="none" stroke={G_GOLD} strokeWidth={1} opacity={0.7} />
                  <Line x1={0} y1={120} x2={360} y2={120} stroke={G_GOLD} strokeWidth={0.6} opacity={0.5} />
                </Svg>
                <View style={styles.featuredImageOverlay} />
              </>
            )}
            <View style={styles.featuredPill}>
              <View style={styles.featuredPillDot} />
              <Text style={styles.featuredPillText}>{closeText}</Text>
            </View>
          </View>

          <View style={styles.featuredBody}>
            <Text style={[styles.featuredTitle, { color: dc.FG }]} numberOfLines={2}>{proposal.title}</Text>
            <Text style={[styles.featuredDesc, { color: dc.FG_MUTED }]} numberOfLines={2}>{proposal.description}</Text>
            <View style={[styles.sentimentBar, { backgroundColor: dc.LINE }]}>
              {totalVotes > 0 ? (
                <>
                  <View style={{ flex: supportPct, backgroundColor: dc.GREEN }} />
                  <View style={{ flex: opposePct, backgroundColor: '#FF6B6B', opacity: 0.7 }} />
                </>
              ) : (
                <View style={{ flex: 1, backgroundColor: dc.LINE }} />
              )}
            </View>
            <View style={styles.sentimentLegend}>
              <Text style={[styles.sentimentLegendText, { color: dc.FG_FAINT }]}>{totalVotes > 0 ? `${supportPct}% support` : 'No votes yet'}</Text>
              <Text style={[styles.sentimentLegendText, { color: dc.FG_FAINT }]}>{totalVotes.toLocaleString()} {totalVotes === 1 ? 'voice' : 'voices'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
function ImpactRing({ pending, voted, passed }: { pending: number; voted: number; passed: number }) {
  const dc = useDashboardColors();
  const total = Math.max(pending + voted, 1);
  const r = 50, c = 2 * Math.PI * r;
  const votedDash = (voted / total) * c;
  const pct = Math.round((voted / total) * 100);

  return (
    <Animated.View entering={FadeInUp.duration(500).delay(300)} style={styles.sectionPad}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Your Civic Record</Text>
        <Text style={[styles.sectionMeta, { color: dc.FG_FAINT }]}>Since Mar 2026</Text>
      </View>

      <View style={[styles.impactCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
        <View style={styles.impactRow}>
          <View style={styles.impactRingWrap}>
            <Svg width={124} height={124} viewBox="0 0 124 124">
              <Defs>
                <SvgLinearGradient id="ringG" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0%" stopColor={dc.GOLD_LIGHT} />
                  <Stop offset="100%" stopColor={dc.GOLD_DARK} />
                </SvgLinearGradient>
              </Defs>
              <Circle cx={62} cy={62} r={r} fill="none" stroke={dc.LINE_STRONG} strokeWidth={3} />
              <Circle
                cx={62} cy={62} r={r} fill="none"
                stroke="url(#ringG)" strokeWidth={6}
                strokeDasharray={`${votedDash} ${c}`} strokeLinecap="round"
                transform="rotate(-90 62 62)"
              />
              {Array.from({ length: 24 }).map((_, i) => {
                const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
                const r1 = 56, r2 = 59;
                return (
                  <Line key={i}
                    x1={62 + Math.cos(a) * r1} y1={62 + Math.sin(a) * r1}
                    x2={62 + Math.cos(a) * r2} y2={62 + Math.sin(a) * r2}
                    stroke={dc.LINE_STRONG} strokeWidth={0.7}
                  />
                );
              })}
            </Svg>
            <View style={styles.impactRingCenter}>
              <Text style={[styles.impactRingPct, { color: dc.GOLD }]}>{pct}<Text style={[styles.impactRingPctSign, { color: dc.FG_MUTED }]}>%</Text></Text>
              <Text style={[styles.impactRingLabel, { color: dc.FG_FAINT }]}>Voted</Text>
            </View>
          </View>

          <View style={styles.impactLedger}>
            <LedgerRow label="Pending" value={String(pending)} tint={dc.GOLD} />
            <View style={[styles.hairline, { backgroundColor: dc.LINE }]} />
            <LedgerRow label="Voted" value={String(voted)} tint={dc.GREEN} />
            <View style={[styles.hairline, { backgroundColor: dc.LINE }]} />
            <LedgerRow label="Passed" value={String(passed)} tint={dc.FG_FAINT} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

function LedgerRow({ label, value, tint }: { label: string; value: string; tint: string }) {
  const dc = useDashboardColors();
  return (
    <View style={styles.ledgerRow}>
      <View style={styles.ledgerLabelRow}>
        <View style={[styles.ledgerDot, { backgroundColor: tint }]} />
        <Text style={[styles.ledgerLabel, { color: dc.FG_MUTED }]}>{label}</Text>
      </View>
      <Text style={[styles.ledgerValue, { color: dc.FG }]}>{value}</Text>
    </View>
  );
}
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
        style={[styles.sectionHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      >
        <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Your Communities</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 11, color: dc.FG_FAINT, letterSpacing: 0.5 }}>Details</Text>
          <Ionicons name="chevron-forward" size={12} color={dc.FG_FAINT} />
        </View>
      </TouchableOpacity>

      <View style={[styles.communityCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
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
      <View style={[styles.communityRow, !last && [styles.communityRowBorder, { borderBottomColor: dc.LINE }]]}>
        {primary && <View style={[styles.communityPrimaryBar, { backgroundColor: dc.GOLD }]} />}
        <View style={[styles.communityFlag, {
          backgroundColor: primary ? `${dc.GOLD}1A` : dc.BG_RAISED,
          borderColor: primary ? `${dc.GOLD}4D` : dc.LINE_STRONG,
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
        <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Your Organizations</Text>
        <Text style={[styles.eyebrowMeta, { color: dc.FG_FAINT }]}>
          {orgs.length} {orgs.length === 1 ? 'community' : 'communities'}
          {totalPending > 0 ? ` · ${totalPending} pending` : ''}
        </Text>
      </View>

      <View style={[styles.communityCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
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
            <View style={[styles.orgExpandRow, { borderTopColor: dc.LINE }]}>
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
      <View style={[styles.communityRow, !last && [styles.communityRowBorder, { borderBottomColor: dc.LINE }]]}>
        {pendingCount > 0 && <View style={[styles.communityPrimaryBar, { backgroundColor: dc.GOLD }]} />}
        <View style={[styles.communityFlag, {
          backgroundColor: pendingCount > 0 ? `${dc.GOLD}1A` : dc.BG_RAISED,
          borderColor: pendingCount > 0 ? `${dc.GOLD}4D` : dc.LINE_STRONG,
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
        <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Trending</Text>
        <Text style={[styles.sectionMetaMono, { color: dc.FG_FAINT }]}>Updated 2h ago</Text>
      </View>
      <View style={[styles.communityCard, { backgroundColor: dc.BG_CARD, borderColor: dc.LINE }]}>
        {rows.map((r, i) => (
          <View key={r.id}>
            <DigestRow {...r} />
            {i < rows.length - 1 && <View style={[styles.hairline, { backgroundColor: dc.LINE }]} />}
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
      <View style={[styles.footerLine, { backgroundColor: dc.LINE }]} />
      <Text style={[styles.footerTagline, { color: dc.FG_FAINT }]}>Verified civic infrastructure.</Text>
      <Text style={[styles.footerMark, { color: dc.FG_FAINT }]}>Represent · Est. 2026</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scrollContent: { paddingHorizontal: 0 },

  eyebrow: {
    fontFamily: SANS, fontSize: 11, fontWeight: '600',
    letterSpacing: 2.2, textTransform: 'uppercase',
  },
  hairline: { height: 1, backgroundColor: LINE },

  // TopBar
  topBar: {
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  topBarLeftRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  topBarStatus: {
    fontFamily: SANS, fontSize: 11, fontWeight: '500',
    letterSpacing: 1.98, textTransform: 'uppercase', color: FG_FAINT,
  },
  topBarDate: { fontFamily: SANS, fontSize: 13, color: FG_MUTED, fontWeight: '400' },
  avatarOuter: {
    width: 40, height: 40, borderRadius: 20,
    padding: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  avatarInner: {
    width: '100%', height: '100%', borderRadius: 20,
    backgroundColor: BG_RAISED, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontFamily: SERIF, fontSize: 16, fontWeight: '600', color: G_GOLD },
  avatarVerifiedDot: {
    position: 'absolute', bottom: -1, right: -1,
    width: 11, height: 11, borderRadius: 5.5,
    backgroundColor: GREEN, borderWidth: 2, borderColor: BG,
  },

  // Hero
  hero: {
    marginHorizontal: 16, marginBottom: 24,
    borderRadius: 22, overflow: 'hidden',
    backgroundColor: '#0F1115',
    borderWidth: 1, borderColor: LINE,
  },
  heroInner: { padding: 22 },
  heroHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24,
  },
  heroDate: { fontFamily: MONO, fontSize: 10, color: FG_FAINT, letterSpacing: 1 },
  heroNumberRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 8 },
  heroNumber: {
    fontFamily: SERIF, fontSize: 88, fontWeight: '500', color: FG,
    letterSpacing: -3.5, lineHeight: 75,
  },
  heroNumberLabel: { paddingBottom: 12 },
  heroNumberLabelText: {
    fontFamily: SERIF, fontSize: 22, fontWeight: '400', color: FG_MUTED,
    fontStyle: 'italic', lineHeight: 24,
  },
  heroNumberLabelSub: { fontFamily: SANS, fontSize: 13, color: FG_FAINT, marginTop: 2 },
  unverifiedHeadline: {
    fontFamily: SERIF, fontSize: 32, lineHeight: 38,
    marginTop: 12, marginBottom: 10, fontWeight: '500',
  },
  unverifiedSubhead: {
    fontFamily: SANS, fontSize: 14, lineHeight: 20,
    marginBottom: 22,
  },
  unverifiedTease: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 14, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  unverifiedTeaseText: { fontFamily: SANS, fontSize: 12, fontWeight: '500' },
  breakdownBarTrack: {
    flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden',
    backgroundColor: LINE, marginTop: 22,
  },
  breakdownLegend: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10,
    marginBottom: 18,
  },
  breakdownLegendItem: { fontFamily: SANS, fontSize: 11, color: FG_FAINT },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14,
  },
  ctaBtnText: {
    fontFamily: SANS, fontSize: 15, fontWeight: '600', color: '#1A1206', letterSpacing: -0.15,
  },
  ctaArrowCircle: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(26,18,6,0.18)',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, paddingBottom: 14,
  },
  sectionPad: { paddingHorizontal: 16, paddingBottom: 28 },
  sectionMeta: { fontFamily: SANS, fontSize: 11, color: FG_FAINT },
  sectionMetaMono: {
    fontFamily: MONO, fontSize: 9.5, color: FG_FAINT,
    letterSpacing: 1.3, textTransform: 'uppercase',
  },
  sectionMetaGold: { fontFamily: SANS, fontSize: 11, fontWeight: '500', color: G_GOLD },
  eyebrowMeta: {
    fontFamily: SANS, fontSize: 11, color: FG_FAINT,
    letterSpacing: 0.3,
  },
  orgExpandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  orgExpandText: { fontFamily: SANS, fontSize: 13, fontWeight: '500' },

  // Featured
  featuredCard: {
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: BG_CARD, borderWidth: 1, borderColor: LINE,
  },
  featuredImage: { height: 140, position: 'relative', backgroundColor: '#1A1A22' },
  featuredImageOverlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(13,15,18,0.5)',
  },
  featuredPill: {
    position: 'absolute', top: 14, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(4,7,7,0.6)',
    borderWidth: 1, borderColor: 'rgba(234,186,88,0.35)',
  },
  featuredPillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: GREEN },
  featuredPillText: {
    fontFamily: MONO, fontSize: 9.5, fontWeight: '500', color: FG,
    letterSpacing: 1.3, textTransform: 'uppercase',
  },
  featuredBody: { padding: 18 },
  featuredTitle: {
    fontFamily: SERIF, fontSize: 22, fontWeight: '500', color: FG,
    letterSpacing: -0.33, lineHeight: 26, marginBottom: 8,
  },
  featuredDesc: {
    fontFamily: SANS, fontSize: 13, color: FG_MUTED, lineHeight: 19, marginBottom: 16,
  },
  sentimentBar: {
    flexDirection: 'row', height: 3, borderRadius: 2, overflow: 'hidden',
    backgroundColor: LINE,
  },
  sentimentLegend: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
  },
  sentimentLegendText: {
    fontFamily: MONO, fontSize: 9.5, color: FG_FAINT, letterSpacing: 0.6,
  },

  // Impact ring
  impactCard: {
    backgroundColor: BG_CARD, borderWidth: 1, borderColor: LINE,
    borderRadius: 18, padding: 20,
  },
  impactRow: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  impactRingWrap: { width: 124, height: 124, position: 'relative' },
  impactRingCenter: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  impactRingPct: {
    fontFamily: SERIF, fontSize: 32, fontWeight: '500', color: FG,
    letterSpacing: -0.96, lineHeight: 32,
  },
  impactRingPctSign: { fontSize: 16, color: FG_FAINT },
  impactRingLabel: {
    fontFamily: SANS, fontSize: 9.5, fontWeight: '500',
    letterSpacing: 1.5, color: FG_FAINT, marginTop: 4,
    textTransform: 'uppercase',
  },
  impactLedger: { flex: 1, gap: 12 },
  ledgerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  ledgerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerDot: { width: 5, height: 5, borderRadius: 2.5 },
  ledgerLabel: { fontFamily: SANS, fontSize: 12, color: FG_FAINT, letterSpacing: 0.48 },
  ledgerValue: {
    fontFamily: SERIF, fontSize: 22, fontWeight: '500', color: FG,
    letterSpacing: -0.44, lineHeight: 22,
  },

  // Community
  communityCard: {
    backgroundColor: BG_CARD, borderWidth: 1, borderColor: LINE,
    borderRadius: 18, overflow: 'hidden',
  },
  communityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    position: 'relative',
  },
  communityRowBorder: { borderBottomWidth: 1, borderBottomColor: LINE },
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
    fontFamily: MONO, fontSize: 10, fontWeight: '600', letterSpacing: 0.8,
  },
  communityNameRow: {
    flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 2,
  },
  communityName: {
    fontFamily: SANS, fontSize: 15, fontWeight: '600', color: FG, letterSpacing: -0.15,
  },
  communityTier: {
    fontFamily: MONO, fontSize: 9, color: FG_FAINT,
    letterSpacing: 1.26, textTransform: 'uppercase',
  },
  communityMeta: { fontFamily: SANS, fontSize: 12, color: FG_FAINT },

  // Sentinel
  digestRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 18, paddingVertical: 14,
  },
  digestTime: {
    fontFamily: MONO, fontSize: 10, color: FG_FAINT,
    letterSpacing: 0.6, paddingTop: 3, width: 38,
  },
  digestTag: {
    fontFamily: MONO, fontSize: 9, fontWeight: '600',
    letterSpacing: 1.26, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 4, marginTop: 2, overflow: 'hidden',
  },
  digestHeadline: {
    fontFamily: SANS, fontSize: 13.5, fontWeight: '500', color: FG,
    letterSpacing: -0.135, lineHeight: 18, marginBottom: 3,
  },
  digestMeta: {
    fontFamily: SANS, fontSize: 11, color: FG_FAINT, letterSpacing: 0.22,
  },

  // Footer
  footerSig: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18,
    alignItems: 'center', gap: 6,
  },
  footerLine: { width: 24, height: 1, backgroundColor: LINE_STRONG },
  footerTagline: {
    fontFamily: SERIF, fontSize: 13, fontStyle: 'italic',
    color: FG_FAINT, letterSpacing: -0.065,
  },
  footerMark: {
    fontFamily: MONO, fontSize: 8.5, color: FG_FAINT,
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
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: dc.FG, marginRight: 26 }}>
          Where you can vote
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 32 }}>
        {/* Hero */}
        <Animated.View entering={FadeInUp.duration(400)} style={{
          backgroundColor: dc.BG_CARD,
          borderWidth: 1, borderColor: dc.LINE,
          borderRadius: 14, padding: 20, alignItems: 'center',
          marginBottom: 18,
        }}>
          <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: dc.FG_MUTED, marginBottom: 6 }}>
            Your civic reach
          </Text>
          <Text style={{ fontSize: 44, fontWeight: '700', color: dc.GOLD, letterSpacing: -1, lineHeight: 50 }}>
            {totalEligibleActive}
          </Text>
          <Text style={{ fontSize: 13, color: dc.FG_MUTED, marginTop: 4 }}>
            active proposal{totalEligibleActive === 1 ? '' : 's'} you can vote on
          </Text>
          {isVerified ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 6 }}>
              <Ionicons name="shield-checkmark" size={14} color={dc.GOLD} />
              <Text style={{ fontSize: 11.5, color: dc.GOLD, fontWeight: '600' }}>
                Verified resident of {[city, state, country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: 12, gap: 6,
              paddingHorizontal: 12, paddingVertical: 5,
              backgroundColor: 'rgba(255,200,0,0.12)',
              borderRadius: 100,
            }}>
              <Ionicons name="lock-closed" size={12} color={dc.GOLD} />
              <Text style={{ fontSize: 11.5, color: dc.GOLD, fontWeight: '600' }}>
                Unverified — global only
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Section label */}
        <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: dc.FG_MUTED, marginBottom: 10, paddingHorizontal: 2 }}>
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
                borderColor: tier.eligible ? 'rgba(212,175,55,0.30)' : dc.LINE,
                borderWidth: 1,
                borderRadius: 12,
                marginBottom: 10,
                gap: 14,
                opacity: isMuted ? 0.7 : 1,
              }}
            >
              <View style={{
                width: 50, height: 50, borderRadius: 25,
                backgroundColor: tier.eligible ? 'rgba(212,175,55,0.10)' : dc.BG_RAISED,
                borderColor: tier.eligible ? 'rgba(212,175,55,0.40)' : dc.LINE,
                borderWidth: 1,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{
                  fontSize: flag.length === 2 ? 13 : 22,
                  fontWeight: '700',
                  color: accent,
                  letterSpacing: 0.5,
                }}>
                  {flag}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: isMuted ? dc.FG_FAINT : dc.FG, letterSpacing: -0.1 }} numberOfLines={1}>
                  {tier.locationName ?? '—'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: accent }}>
                    {tier.label}
                  </Text>
                  <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: dc.FG_FAINT }} />
                  <Text style={{ fontSize: 11, color: dc.FG_MUTED }}>{tier.scopeLabel}</Text>
                </View>
                {tier.eligible ? (
                  <Text style={{ fontSize: 12, color: dc.FG_MUTED, marginTop: 6 }}>
                    <Text style={{ color: dc.FG, fontWeight: '600' }}>{tier.active}</Text> active
                    <Text style={{ color: dc.FG_FAINT }}> · {tier.total} total</Text>
                  </Text>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                    <Ionicons name="lock-closed" size={11} color={dc.FG_FAINT} />
                    <Text style={{ fontSize: 11, color: dc.FG_FAINT }}>
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
          backgroundColor: 'rgba(212,175,55,0.06)',
          borderColor: 'rgba(212,175,55,0.25)',
          borderWidth: 1,
          borderRadius: 12,
          flexDirection: 'row',
          gap: 10,
        }}>
          <Ionicons name="information-circle-outline" size={20} color={dc.GOLD} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: dc.FG, marginBottom: 4 }}>
              How geo-gating works
            </Text>
            <Text style={{ fontSize: 12, color: dc.FG_MUTED, lineHeight: 17 }}>
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
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: dc.GOLD,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>
              Verify identity to unlock
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
