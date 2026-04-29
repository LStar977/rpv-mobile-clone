import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path, Defs, LinearGradient as SvgLinearGradient, Stop, G as SvgG } from 'react-native-svg';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SPACING, useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { useBallotStore } from '../../lib/ballots';
import { proposalsApi, userApi, type Proposal } from '../../lib/api';
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
function classifyScope(p: Proposal): 'federal' | 'provincial' | 'municipal' {
  const len = (p.geoRestrictions || []).length;
  if (len >= 3) return 'municipal';
  if (len === 2) return 'provincial';
  return 'federal';
}

export default function DashboardScreen() {
  const dc = useDashboardColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { syncFromChain } = useBallotStore();
  const [refreshing, setRefreshing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());

  const displayName = user?.name?.split(' ')[0] || 'User';
  const userCity = user?.city || '';
  const userState = user?.state || '';
  const userCountry = user?.country || '';
  const isVerified = user?.verified ?? false;

  const loadData = useCallback(async () => {
    const [propRes, votedRes] = await Promise.all([
      proposalsApi.getAll(),
      userApi.getVotedProposals(),
    ]);
    if (propRes.data) setProposals(propRes.data);
    if (votedRes.data) setVotedIds(new Set(votedRes.data.map(String)));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    if (user?.walletAddress) syncFromChain(user.walletAddress);
  }, [user?.walletAddress, syncFromChain]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const navigateToProposals = () => router.push('/(tabs)/proposals');

  // Derived data
  const now = Date.now();
  const activeProposals = proposals.filter(p => {
    if (!p.deadline) return true;
    return new Date(p.deadline).getTime() > now;
  });
  const pendingProposals = activeProposals.filter(p => !votedIds.has(String(p.id)));
  const pendingCount = pendingProposals.length;

  const breakdown = { federal: 0, provincial: 0, municipal: 0 };
  pendingProposals.forEach(p => { breakdown[classifyScope(p)]++; });

  // Featured: pending proposal with closest upcoming deadline
  const featured = pendingProposals
    .filter(p => p.deadline)
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())[0];

  // Impact stats
  const votedCount = votedIds.size;
  const passedCount = proposals.filter(p =>
    votedIds.has(String(p.id)) && p.deadline && new Date(p.deadline).getTime() <= now
  ).length;

  // Sentinel digest: most-engaged active proposals (highest vote count, then closing soonest)
  const digestItems = proposals
    .filter(p => p.deadline && new Date(p.deadline).getTime() > now)
    .sort((a, b) => {
      const aVotes = a.supportVotes + a.opposeVotes;
      const bVotes = b.supportVotes + b.opposeVotes;
      if (aVotes !== bVotes) return bVotes - aVotes;
      return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime();
    })
    .slice(0, 3);

  return (
    <View style={[styles.container, { backgroundColor: dc.BG }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + SPACING.md }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={dc.GOLD} />}
      >
        <TopBar name={displayName} city={userCity} state={userState} verified={isVerified} onAvatarPress={() => router.push('/(tabs)/profile')} />
        <Hero pendingCount={pendingCount} breakdown={breakdown} onBeginVoting={navigateToProposals} />
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
        <ImpactRing pending={pendingCount} voted={votedCount} passed={passedCount} />
        {isVerified && userCountry && (
          <Communities
            proposals={proposals}
            votedIds={votedIds}
            country={userCountry}
            state={userState}
            city={userCity}
            onPrimaryPress={navigateToProposals}
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
function TopBar({ name, city, state, verified, onAvatarPress }: { name: string; city: string; state: string; verified: boolean; onAvatarPress: () => void }) {
  const dc = useDashboardColors();
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const locationText = city && state ? ` · ${city}, ${state}` : '';
  const statusText = verified ? `Verified${locationText}` : 'Unverified';
  const dotColor = verified ? dc.GREEN : dc.FG_FAINT;
  return (
    <Animated.View entering={FadeInDown.duration(500)} style={styles.topBar}>
      <View>
        <View style={styles.topBarLeftRow}>
          <View style={[styles.greenDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.topBarStatus, { color: dc.FG_MUTED }]}>{statusText}</Text>
        </View>
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
function Hero({ pendingCount, breakdown, onBeginVoting }: { pendingCount: number; breakdown: { federal: number; provincial: number; municipal: number }; onBeginVoting: () => void }) {
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
  const tierLabel = scope >= 3 ? 'MUNI' : scope === 2 ? 'PROV' : 'FED';
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
                <Image
                  source={{ uri: proposal.imageUrl }}
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' }}
                  resizeMode="cover"
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
function Communities({ proposals, votedIds, country, state, city, onPrimaryPress, router }: {
  proposals: Proposal[]; votedIds: Set<string>; country: string; state: string; city: string;
  onPrimaryPress: () => void; router: any;
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
  const items = [
    { tier: 'Federal', name: country, meta: `${fed.total} proposals · ${fed.active} active`, primary: true, flag: flagCode(country), scope: 'country' as const },
    { tier: 'Provincial', name: state, meta: `${prov.total} proposals · ${prov.active} active`, primary: false, flag: flagCode(state), scope: 'state' as const },
    { tier: 'Municipal', name: city, meta: `${mun.total} proposals · ${mun.active} active`, primary: false, flag: flagCode(city), scope: 'city' as const },
  ];
  return (
    <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.sectionPad}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.eyebrow, { color: dc.GOLD }]}>Your Communities</Text>
      </View>

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
          <View key={r.time}>
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
