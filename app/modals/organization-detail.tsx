import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Switch, Clipboard } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect, Defs, Pattern, G, Text as SvgText, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, Organization, OrganizationProposal } from '../../lib/api';
import { UpgradeModal } from '../../components/ui/UpgradeModal';
import { FONTS } from '../../lib/theme';

// ─── design tokens (matches PassportCard / Groups dossier) ────────────
const O_GOLD = '#EABA58';
const O_GOLD_D = '#C89A3E';
const O_GOLD_L = '#F4D28C';
const O_BG = '#040707';
const O_BG_CARD = '#0D0F12';
const O_BG_RAISED = '#15181C';
const O_LINE = '#1E2228';
const O_LINE_STRONG = '#2A2F37';
const O_FG = '#F4F5F6';
const O_FG_MUTED = '#C7CACD';
const O_FG_FAINT = '#8E9297';
const O_GREEN = '#34C759';
const O_RED = '#FF6B5B';

const SERIF = FONTS.serif;
const MONO = FONTS.mono;

const CATEGORIES = ['Transportation', 'Environment', 'Housing', 'Education', 'Healthcare', 'Economy', 'Public Safety', 'Infrastructure', 'Other'];
const ORG_TYPES: Array<{ value: string; label: string }> = [
  { value: 'school', label: 'School / Class' },
  { value: 'corporation', label: 'Company / Department' },
  { value: 'union', label: 'Union / Local' },
  { value: 'nonprofit', label: 'Nonprofit / Chapter' },
  { value: 'other', label: 'Other' },
];

type TabType = 'proposals' | 'announcements' | 'members' | 'subOrders' | 'insights' | 'settings';

interface OrgInsights {
  totalMembers: number;
  subOrgCount: number;
  totalProposals: number;
  totalVotes: number;
  participationRate: number;
  subOrgs?: Array<{ id: string; name: string; memberCount: number; proposalCount: number; voteCount: number; participationRate: number }>;
  voteTimeSeries?: Array<{ date: string; count: number }>;
  periodDays: number;
}

// ─── helpers ──────────────────────────────────────────────────────────
function formatRomanYM(iso?: string | null): string {
  // (legacy name kept for callers; renders short month/year)
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}
function formatRomanDate(iso?: string | null): string {
  // (legacy name kept for callers; renders human date)
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatTimeMono(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function folioFromOrg(name: string, id: string): string {
  const safeName = name || '';
  const safeId = id ? String(id) : '';
  const initials = safeName.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'ORG';
  let h = 0;
  for (let i = 0; i < safeId.length; i++) h = (h * 31 + safeId.charCodeAt(i)) >>> 0;
  return `${initials}·${(h % 9000) + 1000}`;
}
function monogramFromName(n: string): string {
  const p = (n || '').split(/\s+/).filter(Boolean);
  if (!p.length) return 'O';
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
}

// ─── atoms ────────────────────────────────────────────────────────────
function Guilloche({ opacity = 0.05, color = O_GOLD, id = 'oguil' }: { opacity?: number; color?: string; id?: string }) {
  return (
    <Svg
      width="100%" height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
      preserveAspectRatio="none"
      viewBox="0 0 400 600"
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={id} x={0} y={0} width={40} height={40} patternUnits="userSpaceOnUse">
          <Path d="M 0 20 Q 10 0, 20 20 T 40 20" stroke={color} fill="none" strokeWidth={0.5} />
          <Path d="M 0 20 Q 10 40, 20 20 T 40 20" stroke={color} fill="none" strokeWidth={0.5} />
        </Pattern>
      </Defs>
      <Rect width={400} height={600} fill={`url(#${id})`} />
    </Svg>
  );
}

function CornerTicks({ color = O_GOLD, size = 8, weight = 1.2 }: { color?: string; size?: number; weight?: number }) {
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', top: -1, left: -1, width: size, height: size, borderTopWidth: weight, borderLeftWidth: weight, borderColor: color }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: -1, right: -1, width: size, height: size, borderTopWidth: weight, borderRightWidth: weight, borderColor: color }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -1, left: -1, width: size, height: size, borderBottomWidth: weight, borderLeftWidth: weight, borderColor: color }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -1, right: -1, width: size, height: size, borderBottomWidth: weight, borderRightWidth: weight, borderColor: color }} />
    </>
  );
}

function Eyebrow({ children, color = O_FG_FAINT, size = 9.5, ls = 2, style }: { children: React.ReactNode; color?: string; size?: number; ls?: number; style?: any }) {
  return (
    <Text style={[{ fontSize: size, fontFamily: FONTS.sansSemiBold, letterSpacing: ls, textTransform: 'uppercase', color }, style]}>{children}</Text>
  );
}

function Hairline({ inset = 0, gold = false, style }: { inset?: number; gold?: boolean; style?: any }) {
  return <View style={[{ height: 1, marginLeft: inset, marginRight: inset, backgroundColor: gold ? 'rgba(234,186,88,0.45)' : O_LINE }, style]} />;
}

function VerifiedTick({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={6.4} fill="rgba(52,199,89,0.12)" stroke={O_GREEN} strokeWidth={0.6} />
      <Path d="M4.2 7.2l2 2 3.6-4" stroke={O_GREEN} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function TierSeal({ tier, size = 36 }: { tier: Organization['tier']; size?: number }) {
  // 'plus' is the new ladder position that was 'professional' before
  // Stage 3 — gold seal goes to plus or business (sophisticated tiers).
  const isCommunity = tier !== 'plus' && tier !== 'business';
  const ring = isCommunity ? O_LINE_STRONG : O_GOLD_D;
  const inner = isCommunity ? '#16191D' : '#1A1612';
  const glyph = isCommunity ? O_FG_MUTED : O_GOLD_L;
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle cx={18} cy={18} r={17} fill={inner} stroke={ring} strokeWidth={0.6} />
      <Circle cx={18} cy={18} r={14} fill="none" stroke={ring} strokeWidth={0.4} strokeDasharray={isCommunity ? '0.8 1.6' : '0'} />
      {[0, 90, 180, 270].map((a) => {
        const r1 = 15, r2 = 17;
        const ar = ((a - 90) * Math.PI) / 180;
        return (
          <Line
            key={a}
            x1={18 + r1 * Math.cos(ar)} y1={18 + r1 * Math.sin(ar)}
            x2={18 + r2 * Math.cos(ar)} y2={18 + r2 * Math.sin(ar)}
            stroke={ring} strokeWidth={0.6}
          />
        );
      })}
      <SvgText x="18" y="22" textAnchor="middle" fontFamily={FONTS.serifMediumItalic} fontSize="11" fill={glyph}>
        {isCommunity ? 'I' : 'II'}
      </SvgText>
    </Svg>
  );
}

function OrgPortrait({ name, logoUrl, size = 72 }: { name: string; logoUrl?: string; size?: number }) {
  if (logoUrl) {
    return (
      <ExpoImage
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: 12, backgroundColor: O_BG_RAISED }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: 12,
      backgroundColor: O_BG_RAISED,
      borderWidth: 1, borderColor: O_LINE,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Text style={{
        fontFamily: FONTS.serifMediumItalic, fontSize: size * 0.46, 
        color: O_GOLD_L, letterSpacing: -0.5,
      }}>{monogramFromName(name)}</Text>
    </View>
  );
}

type PillKind = 'open' | 'closed' | 'passed' | 'failed' | 'active' | 'forming';
function Pill({ kind, children }: { kind: PillKind; children: React.ReactNode }) {
  const map: Record<PillKind, { color: string; border: string; bg: string; dot: string }> = {
    open:    { color: O_GOLD,     border: O_GOLD_D,                  bg: 'rgba(234,186,88,0.06)',  dot: O_GOLD },
    active:  { color: O_GOLD,     border: O_GOLD_D,                  bg: 'rgba(234,186,88,0.06)',  dot: O_GOLD },
    closed:  { color: O_FG_FAINT, border: O_LINE_STRONG,             bg: 'transparent',            dot: O_FG_FAINT },
    forming: { color: O_FG_FAINT, border: O_LINE_STRONG,             bg: 'transparent',            dot: O_FG_FAINT },
    passed:  { color: O_GREEN,    border: 'rgba(52,199,89,0.3)',     bg: 'rgba(52,199,89,0.08)',   dot: O_GREEN },
    failed:  { color: O_FG_MUTED, border: O_LINE_STRONG,             bg: 'rgba(255,255,255,0.02)', dot: O_FG_MUTED },
  };
  const m = map[kind];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 8, paddingVertical: 3,
      borderWidth: 1, borderColor: m.border, backgroundColor: m.bg,
      borderRadius: 2, alignSelf: 'flex-start',
    }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: m.dot }} />
      <Text style={{
        fontSize: 8.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.6,
        textTransform: 'uppercase', color: m.color,
      }}>{children}</Text>
    </View>
  );
}

// ─── top bar ──────────────────────────────────────────────────────────
function TopBar({ title, isAdmin, onBack, onOverflow, insetTop }: { title: string; isAdmin: boolean; onBack: () => void; onOverflow: () => void; insetTop: number }) {
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
      paddingTop: insetTop + 8, paddingBottom: 10, paddingHorizontal: 14,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: 'rgba(4,7,7,0.92)',
      borderBottomWidth: 1, borderBottomColor: O_LINE,
    }}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={{
        width: 36, height: 36, borderRadius: 8,
        borderWidth: 1, borderColor: O_LINE,
        backgroundColor: O_BG_RAISED,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="chevron-back" size={16} color={O_FG_MUTED} />
      </TouchableOpacity>
      <View style={{ flex: 1, paddingHorizontal: 12, alignItems: 'center' }}>
        <Text numberOfLines={1} style={{ fontFamily: SERIF, fontSize: 17, color: O_FG, letterSpacing: -0.2 }}>
          {title}
        </Text>
      </View>
      <TouchableOpacity onPress={onOverflow} activeOpacity={0.7} style={{
        width: 36, height: 36, borderRadius: 8,
        borderWidth: 1, borderColor: O_LINE,
        backgroundColor: O_BG_RAISED,
        alignItems: 'center', justifyContent: 'center',
        opacity: isAdmin ? 1 : 0.4,
      }}>
        <Ionicons name="ellipsis-horizontal" size={16} color={O_FG_MUTED} />
      </TouchableOpacity>
    </View>
  );
}

// ─── hero ─────────────────────────────────────────────────────────────
function Hero({ org, proposalCount, actualMemberCount }: { org: Organization; proposalCount: number; actualMemberCount: number }) {
  // The deployed backend doesn't always increment org.memberCount when a
  // user accepts an invite, so prefer the larger of the two when we've
  // actually loaded the members list.
  const memberCount = Math.max(org.memberCount ?? 0, actualMemberCount);
  const memberLabel = `${memberCount.toLocaleString()} ${memberCount === 1 ? 'member' : 'members'}`;
  const isAdmin = org.role === 'admin';

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 14, marginBottom: 16 }}>
      <View style={{
        backgroundColor: O_BG_CARD,
        borderRadius: 16,
        borderWidth: 1, borderColor: O_LINE,
        paddingHorizontal: 14, paddingVertical: 14,
        flexDirection: 'row', alignItems: 'center', gap: 13,
      }}>
        <OrgPortrait name={org.name} logoUrl={org.logoUrl} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: SERIF, fontSize: 18,
                color: O_FG, lineHeight: 22, letterSpacing: -0.2,
              }}
            >{org.name}</Text>
            {org.verified && <VerifiedTick size={13} />}
          </View>
          <Text style={{ fontSize: 12.5, color: O_FG_FAINT, letterSpacing: -0.05 }}>
            {memberLabel}
            {isAdmin && (
              <Text>
                <Text style={{ color: O_FG_FAINT }}>  ·  </Text>
                <Text style={{ color: O_GOLD_L, fontFamily: FONTS.sansMedium}}>Admin</Text>
              </Text>
            )}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── section tabs ─────────────────────────────────────────────────────
function SectionTabs({ active, onChange, isAdmin, hasSubOrgs }: { active: TabType; onChange: (t: TabType) => void; isAdmin: boolean; hasSubOrgs: boolean }) {
  const tabs: Array<{ key: TabType; label: string }> = [
    { key: 'proposals',     label: 'Proposals' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'members',       label: 'Members' },
  ];
  if (hasSubOrgs) tabs.push({ key: 'subOrders', label: 'Sub-orgs' });
  if (isAdmin) {
    tabs.push({ key: 'insights', label: 'Insights' });
    tabs.push({ key: 'settings', label: 'Settings' });
  }
  return (
    <View style={{ paddingHorizontal: 14, marginBottom: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ borderBottomWidth: 1, borderBottomColor: O_LINE }}>
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.7}
              onPress={() => { Haptics.selectionAsync(); onChange(t.key); }}
              style={{
                paddingHorizontal: 12, paddingVertical: 10,
                borderBottomWidth: 1.5,
                borderBottomColor: isActive ? O_GOLD : 'transparent',
                marginBottom: -1,
              }}
            >
              <Text style={{
                fontSize: 11, fontFamily: FONTS.sansSemiBold, letterSpacing: 2.2,
                textTransform: 'uppercase',
                color: isActive ? O_GOLD : O_FG_FAINT,
              }}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── stub sections (filled in subsequent passes) ──────────────────────
function StubSection({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 24 }}>
      <Text style={{ fontFamily: MONO, fontSize: 10, color: O_FG_FAINT, letterSpacing: 1.4, textAlign: 'center', textTransform: 'uppercase' }}>
        {label} · pending implementation
      </Text>
    </View>
  );
}

// ─── Proposals section ────────────────────────────────────────────────
type ProposalKind = 'open' | 'passed' | 'closed' | 'failed';
function classifyProposal(p: OrganizationProposal): ProposalKind {
  const s = (p.status || '').toLowerCase();
  if (s === 'passed' || s === 'approved') return 'passed';
  if (s === 'failed' || s === 'rejected') return 'failed';
  if (s === 'closed' || s === 'archived') return 'closed';
  if (p.deadline) {
    const d = new Date(p.deadline);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return 'closed';
  }
  return 'open';
}
function proposalFolio(p: OrganizationProposal): string {
  const idStr = String(p.id);
  const numeric = idStr.replace(/\D/g, '');
  const num = numeric ? numeric.slice(-3).padStart(3, '0') : idStr.slice(-3).toUpperCase().padStart(3, '0');
  const yr = p.createdAt ? new Date(p.createdAt).getFullYear().toString().slice(-2) : '26';
  return `P·${num}/${yr}`;
}
function proposalTime(p: OrganizationProposal, kind: ProposalKind): string {
  if (kind === 'open' && p.deadline) {
    const ms = new Date(p.deadline).getTime() - Date.now();
    if (ms <= 0) return 'Closing';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 1) return `${d} days left`;
    if (d === 1) return '1 day left';
    if (h > 1) return `${h} hours left`;
    if (h === 1) return '1 hour left';
    return 'Closing soon';
  }
  const seal = p.deadline || p.createdAt;
  if (seal) return `Closed ${formatRomanYM(seal)}`;
  return '';
}

function FilterChip({ children, active, onPress }: { children: React.ReactNode; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={{
      paddingHorizontal: 12, paddingVertical: 7,
      borderWidth: 1, borderColor: active ? O_GOLD : O_LINE,
      backgroundColor: active ? 'rgba(234,186,88,0.1)' : 'transparent',
      borderRadius: 999, marginRight: 6,
    }}>
      <Text style={{
        fontSize: 12, fontFamily: FONTS.sansMedium,
        color: active ? O_GOLD : O_FG_MUTED,
      }}>{children}</Text>
    </TouchableOpacity>
  );
}

function ProposalsEmpty() {
  return (
    <View style={{ paddingHorizontal: 14 }}>
      <View style={{
        backgroundColor: O_BG_CARD,
        borderWidth: 1, borderColor: O_LINE, borderRadius: 14,
        paddingHorizontal: 24, paddingVertical: 36,
        alignItems: 'center',
      }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: O_BG_RAISED,
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Ionicons name="document-text-outline" size={24} color={O_GOLD_L} />
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 19, color: O_FG, letterSpacing: -0.1, marginBottom: 6 }}>
          No proposals yet
        </Text>
        <Text style={{ fontSize: 13, color: O_FG_MUTED, lineHeight: 18, textAlign: 'center', maxWidth: 260 }}>
          The first proposal from your group will appear here.
        </Text>
      </View>
    </View>
  );
}

// ─── Settings section ─────────────────────────────────────────────────
function SettingsRow({ label, value, mono, gold, onPress, action }: {
  label: string; value: string; mono?: boolean; gold?: boolean; onPress?: () => void; action?: string;
}) {
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.6 : 1} onPress={onPress} disabled={!onPress} style={{
      paddingHorizontal: 14, paddingVertical: 13,
      borderBottomWidth: 1, borderBottomColor: O_LINE,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 8.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 2, textTransform: 'uppercase', color: O_FG_FAINT, marginBottom: 3 }}>
          {label}
        </Text>
        <Text numberOfLines={1} style={{
          fontFamily: mono ? MONO : FONTS.serifMediumItalic,
          fontSize: mono ? 12 : 14,
          color: gold ? O_GOLD : O_FG,
          letterSpacing: mono ? 0.5 : -0.05,
        }}>{value}</Text>
      </View>
      {action && (
        <Text style={{ fontSize: 9, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.6, textTransform: 'uppercase', color: O_FG_FAINT }}>
          {action}
        </Text>
      )}
      {onPress && <Ionicons name="chevron-forward" size={12} color={O_FG_FAINT} />}
    </TouchableOpacity>
  );
}

// UPDATE 26 — admin-only verification settings card.
// Toggle controls whether members must complete Veriff/Didit before voting
// in this org. Toggling ON requires the org to have paid the one-time
// tier-priced unlock fee ($199/$499/$999). If unpaid, we route to the
// verification-unlock-checkout modal; if paid, the toggle just flips.
// Free orgs flipping it ON get the existing UpgradeModal (Pro+ only).
function VerificationSettingsCard({ org, onUpgradePrompt, onOrgUpdated }: {
  org: Organization;
  onUpgradePrompt: () => void;
  onOrgUpdated: (patch: Partial<Organization>) => void;
}) {
  const [enabled, setEnabled] = useState<boolean>(!!org.requireMemberVerification);
  const [savingToggle, setSavingToggle] = useState(false);
  const isUnlocked = !!org.verificationUnlockedAt;

  // Re-sync local state when org prop changes (e.g., after refresh / unlock).
  useEffect(() => {
    setEnabled(!!org.requireMemberVerification);
  }, [org.requireMemberVerification]);

  const handleToggle = async (next: boolean) => {
    setEnabled(next); // optimistic
    setSavingToggle(true);
    try {
      const result = await organizationsApi.setRequireVerification(org.id, next);
      if (result.error) {
        setEnabled(!next); // revert
        if (result.errorCode === 'FEATURE_NOT_AVAILABLE_ON_TIER') {
          onUpgradePrompt();
          return;
        }
        if (result.errorCode === 'VERIFICATION_UNLOCK_REQUIRED') {
          // Admin tried to flip ON but hasn't paid the unlock. Route to the
          // unlock-checkout modal; on successful unlock the modal flips
          // requireMemberVerification ON itself before dismissing.
          router.push({
            pathname: '/modals/verification-unlock-checkout',
            params: { orgId: org.id },
          });
          return;
        }
        Alert.alert('Error', result.error);
        return;
      }
      onOrgUpdated({ requireMemberVerification: next });
    } finally {
      setSavingToggle(false);
    }
  };

  const unlockedCaption = isUnlocked && org.verificationUnlockedAt
    ? `Unlocked ${formatRomanDate(org.verificationUnlockedAt)}`
    : null;

  return (
    <View style={{ backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: O_LINE, backgroundColor: O_BG_RAISED }}>
        <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold}}>Verification</Text>
      </View>
      <View style={{
        paddingHorizontal: 14, paddingVertical: 13,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 8.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 2, textTransform: 'uppercase', color: O_FG_FAINT, marginBottom: 3 }}>
            Require verification
          </Text>
          <Text style={{ fontSize: 13, color: O_FG, lineHeight: 18 }}>
            Members must complete identity check before voting.
          </Text>
          <Text style={{ fontSize: 11, color: O_FG_FAINT, marginTop: 4, lineHeight: 15 }}>
            {isUnlocked
              ? 'Verification covered for your members at no per-vote cost.'
              : 'Pro plan or higher · One-time unlock fee.'}
          </Text>
          {unlockedCaption && (
            <Text style={{ fontSize: 11, color: O_GOLD, marginTop: 4, fontFamily: MONO, letterSpacing: 0.3 }}>
              {unlockedCaption}
            </Text>
          )}
        </View>
        {savingToggle ? (
          <ActivityIndicator size="small" color={O_FG_MUTED} />
        ) : (
          <Switch value={enabled} onValueChange={handleToggle} />
        )}
      </View>
    </View>
  );
}

function SettingsSection({
  org, inviteCodes, generating, onCopy, onGenerate, onRevoke, onLeave, canDelete, onDelete, actualMemberCount, onUpgradePrompt, onOrgUpdated,
}: {
  org: Organization;
  inviteCodes: any[];
  generating: boolean;
  onCopy: (code: string) => void;
  onGenerate: () => void;
  onRevoke: (code: string) => void;
  onLeave: () => void;
  canDelete: boolean;
  onDelete: () => void;
  actualMemberCount: number;
  onUpgradePrompt: () => void;
  onOrgUpdated: (patch: Partial<Organization>) => void;
}) {
  const activeCode = inviteCodes.find((c) => !c.revokedAt && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now())) || inviteCodes[0];
  const codeText = activeCode?.code || activeCode?.inviteCode || 'NO·ACTIVE·CODE';
  const expRoman = activeCode?.expiresAt ? formatRomanDate(activeCode.expiresAt) : null;
  // Stage 3 names. Gold seal at Plus and above; Free/Pro show as Community.
  const tierText =
    org.tier === 'business' ? 'Business · gold seal' :
    org.tier === 'plus' ? 'Plus · gold seal' :
    org.tier === 'government' ? 'Government · gold seal' :
    org.tier === 'legacy' ? 'Legacy · gold seal' :
    org.tier === 'pro' ? 'Pro · hairline seal' :
    'Community · hairline seal';

  return (
    <View style={{ paddingHorizontal: 14 }}>
      {/* active invite code panel */}
      <View style={{
        backgroundColor: O_BG_CARD,
        borderWidth: 1, borderColor: O_LINE,
        borderRadius: 14, marginBottom: 16,
      }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: O_GOLD, letterSpacing: -0.05, fontFamily: FONTS.sansMedium}}>Active invite code</Text>
            {expRoman && (
              <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>Expires {expRoman}</Text>
            )}
          </View>
          <View style={{
            marginVertical: 10, paddingVertical: 14,
            backgroundColor: O_BG_RAISED, borderRadius: 10,
            alignItems: 'center',
          }}>
            <Text style={{
              fontFamily: MONO, fontSize: 22,
              color: O_GOLD_L, letterSpacing: 4, textAlign: 'center',
            }}>{codeText.replace(/(.{4})/g, '$1·').replace(/·$/, '')}</Text>
          </View>
          <Text style={{
            fontSize: 12, color: O_FG_FAINT, textAlign: 'center', marginBottom: 12, lineHeight: 17,
          }}>Anyone with this code can join your organization.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity activeOpacity={0.75} onPress={() => onCopy(codeText)} style={{
              flex: 1, paddingVertical: 10,
              borderWidth: 1, borderColor: O_GOLD_D,
              backgroundColor: 'rgba(234,186,88,0.05)',
              borderRadius: 4,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Ionicons name="checkmark" size={11} color={O_GOLD} />
              <Text style={{ fontSize: 13, fontFamily: FONTS.sansSemiBold, color: O_GOLD }}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} onPress={onGenerate} disabled={generating} style={{
              flex: 1, paddingVertical: 10,
              borderWidth: 1, borderColor: O_LINE_STRONG,
              borderRadius: 4,
              alignItems: 'center', justifyContent: 'center',
              opacity: generating ? 0.6 : 1,
            }}>
              {generating
                ? <ActivityIndicator size="small" color={O_FG_MUTED} />
                : <Text style={{ fontSize: 13, fontFamily: FONTS.sansSemiBold, color: O_FG_MUTED }}>New code</Text>
              }
            </TouchableOpacity>
          </View>
          {activeCode?.code && (
            <TouchableOpacity onPress={() => onRevoke(codeText)} style={{ marginTop: 10, alignSelf: 'center' }}>
              <Text style={{ fontSize: 12, color: O_FG_FAINT, letterSpacing: -0.05, textDecorationLine: 'underline' }}>
                Revoke this code
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Organization details */}
      <View style={{ backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: O_LINE, backgroundColor: O_BG_RAISED }}>
          <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold}}>Organization details</Text>
        </View>
        <SettingsRow label="Name" value={org.name} />
        <SettingsRow label="Description" value={org.description || '—'} />
        <SettingsRow
          label="Verification"
          value={org.verified ? `Verified ${formatRomanYM(org.createdAt)}` : 'Not verified'}
          gold={org.verified}
        />
        <SettingsRow
          label="Plan"
          value={tierText}
          gold={org.tier === 'plus' || org.tier === 'business' || org.tier === 'government' || org.tier === 'legacy'}
          // Only admins see the chevron and can navigate into billing.
          // Non-admins keep the read-only display.
          onPress={org.role === 'admin' ? () => router.push({
            pathname: '/modals/organization-billing',
            params: { orgId: org.id, orgName: org.name },
          }) : undefined}
        />
      </View>

      {/* Members & roles */}
      <View style={{ backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: O_LINE, backgroundColor: O_BG_RAISED }}>
          <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold}}>Members & roles</Text>
        </View>
        <SettingsRow label="Total members" value={Math.max(org.memberCount ?? 0, actualMemberCount).toLocaleString()} mono />
        <SettingsRow label="Active invite codes" value={`${inviteCodes.filter((c) => !c.revokedAt).length}`} mono />
      </View>

      {/* Verification — admin only. Pro+ feature. The toggle ON requires a
          Pro+ tier; backend returns 402 with FEATURE_NOT_AVAILABLE_ON_TIER
          for Free orgs, which surfaces the UpgradeModal via onUpgradePrompt. */}
      {org.role === 'admin' && (
        <VerificationSettingsCard org={org} onUpgradePrompt={onUpgradePrompt} onOrgUpdated={onOrgUpdated} />
      )}

      {/* Reports & Exports — admin only. Tier-gated server-side; the screen
          itself shows the Premium upgrade modal if the export is blocked. */}
      {org.role === 'admin' && (
        <View style={{ backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: O_LINE, backgroundColor: O_BG_RAISED }}>
            <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold}}>Reports & exports</Text>
          </View>
          <SettingsRow
            label="Audit log"
            value="Tamper-evident vote record"
            onPress={() => router.push({
              pathname: '/modals/audit-export',
              params: { orgId: org.id, orgName: org.name },
            })}
          />
        </View>
      )}

      {/* Manage */}
      <View style={{ backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE, borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
        <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: O_LINE, backgroundColor: O_BG_RAISED }}>
          <Text style={{ fontSize: 11, color: O_RED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold}}>Manage</Text>
        </View>
        <SettingsRow label="Leave" value="Leave this organization" onPress={onLeave} />
        {canDelete && (
          <SettingsRow label="Delete" value="Delete this organization permanently" onPress={onDelete} />
        )}
      </View>
    </View>
  );
}

// ─── Insights section ─────────────────────────────────────────────────
function LineChart({ data, w, h, gradId }: { data: number[]; w: number; h: number; gradId: string }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 14) - 4;
    return [x, y] as [number, number];
  });
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = path + ` L ${w} ${h} L 0 ${h} Z`;
  return (
    <Svg width={w} height={h}>
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={O_GOLD} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={O_GOLD} stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <Line key={t} x1={0} y1={h * t} x2={w} y2={h * t} stroke={O_LINE} strokeWidth={0.5} strokeDasharray="1 3" />
      ))}
      <Path d={area} fill={`url(#${gradId})`} />
      <Path d={path} fill="none" stroke={O_GOLD} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 2.4 : 1.2} fill={i === pts.length - 1 ? O_GOLD : O_GOLD_D} />
      ))}
    </Svg>
  );
}

function InsightsSection({ insights, subOrgs, loading, sealedAt }: { insights: OrgInsights | null; subOrgs: any[]; loading: boolean; sealedAt: string }) {
  if (loading && !insights) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={O_GOLD} />
      </View>
    );
  }
  if (!insights) {
    return (
      <View style={{ paddingHorizontal: 14, paddingVertical: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 14,  color: O_FG_MUTED }}>
          No data yet
        </Text>
      </View>
    );
  }

  const series = (insights.voteTimeSeries || []).map((s) => s.count);
  const seriesLabels = (insights.voteTimeSeries || []).map((s) => {
    const d = new Date(s.date);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short' })[0];
  });
  const totalVotes = insights.totalVotes ?? 0;
  const totalMembers = Math.max(1, insights.totalMembers ?? 0);
  const participationPct = Math.max(0, Math.min(100, (insights.participationRate ?? 0) * (insights.participationRate > 1 ? 1 : 100)));
  const participationDisplay = participationPct.toFixed(1);
  const quorumThreshold = Math.ceil(totalMembers * 0.5);
  const quorumMet = totalVotes >= quorumThreshold;
  const quorumPct = Math.min(100, (totalVotes / Math.max(1, quorumThreshold)) * 50);
  const quarter = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
  const sealedRoman = formatRomanDate(sealedAt);

  const ringR = 22;
  const circ = 2 * Math.PI * ringR;
  const ringFilled = (participationPct / 100) * circ;

  const wardData = (insights.subOrgs && insights.subOrgs.length > 0 ? insights.subOrgs : subOrgs)
    .map((s: any) => {
      const n = (s.memberCount ?? s.members ?? 0) as number;
      const pct = totalMembers > 0 ? (n / totalMembers) * 100 : 0;
      return { ward: s.name || 'Sub-org', n, pct };
    })
    .filter((w: any) => w.n > 0)
    .slice(0, 5);
  const showWardTable = wardData.length > 0;

  return (
    <View style={{ paddingHorizontal: 14 }}>
      {/* summary header */}
      <View style={{
        position: 'relative', marginBottom: 14,
        paddingHorizontal: 14, paddingVertical: 11,
        borderWidth: 1, borderColor: O_LINE_STRONG, borderRadius: 8,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <LinearGradient colors={['rgba(234,186,88,0.04)', 'transparent']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
        <View>
          <Text style={{ fontSize: 11, color: O_GOLD, letterSpacing: -0.05, marginBottom: 2 }}>This quarter</Text>
          <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 14, color: O_FG }}>
            {quarter} {new Date().getFullYear()}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 10.5, color: O_FG_FAINT, letterSpacing: -0.05 }}>Updated</Text>
          <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05 }}>{sealedRoman || formatRomanDate(new Date().toISOString())}</Text>
        </View>
      </View>

      {/* recent activity chart */}
      <View style={{
        backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE,
        borderRadius: 12, padding: 14, paddingBottom: 16, marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05 }}>Recent activity</Text>
          <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>
            Last {insights.periodDays} days
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 36, color: O_FG, letterSpacing: -1, lineHeight: 36, marginBottom: 4 }}>
          {totalVotes.toLocaleString()}
        </Text>
        <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05, marginBottom: 12 }}>
          {(insights.totalProposals || 0).toLocaleString()} proposals · {(insights.totalMembers || 0).toLocaleString()} {insights.totalMembers === 1 ? 'member' : 'members'}
        </Text>
        {series.length > 0 ? (
          <>
            <LineChart data={series} w={300} h={96} gradId="chart-act" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 }}>
              {seriesLabels.filter((_, i) => i % Math.ceil(seriesLabels.length / 12) === 0).map((m, i) => (
                <Text key={i} style={{ fontFamily: MONO, fontSize: 8, color: O_FG_FAINT, letterSpacing: 1 }}>{m}</Text>
              ))}
            </View>
          </>
        ) : (
          <View style={{ height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: MONO, fontSize: 9, color: O_FG_FAINT, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              No activity recorded in this period
            </Text>
          </View>
        )}
      </View>

      {/* 2-up: participation ring + quorum bar */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{
          flex: 1, backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE,
          borderRadius: 10, padding: 12,
        }}>
          <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05 }}>Participation</Text>
          <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 26, color: O_FG, letterSpacing: -0.5, lineHeight: 26, marginTop: 6 }}>
            {participationDisplay.split('.')[0]}
            <Text style={{ fontSize: 16, color: O_FG_FAINT }}>.{participationDisplay.split('.')[1] || '0'}%</Text>
          </Text>
          <View style={{ marginTop: 10, height: 56, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={56} height={56} viewBox="0 0 56 56">
              <Circle cx={28} cy={28} r={ringR} fill="none" stroke={O_LINE_STRONG} strokeWidth={2} />
              <Circle
                cx={28} cy={28} r={ringR} fill="none" stroke={O_GOLD} strokeWidth={2}
                strokeDasharray={`${ringFilled} ${circ - ringFilled}`}
                strokeDashoffset={0}
                transform="rotate(-90 28 28)"
                strokeLinecap="butt"
              />
              <Circle cx={28} cy={28} r={17} fill="none" stroke={O_GOLD_D} strokeWidth={0.4} strokeDasharray="1 2" />
            </Svg>
          </View>
          <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05, textAlign: 'center', marginTop: 6 }}>
            {totalVotes} of {totalMembers} {totalMembers === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE,
          borderRadius: 10, padding: 12,
        }}>
          <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05 }}>Quorum</Text>
          <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 26, color: quorumMet ? O_GREEN : O_FG_MUTED, letterSpacing: -0.5, lineHeight: 26, marginTop: 6 }}>
            {quorumMet ? 'Met' : 'Below'}
          </Text>
          <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, marginTop: 4 }}>
            {quorumThreshold} required
          </Text>
          <View style={{ marginTop: 12, height: 6, backgroundColor: O_LINE_STRONG, borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
            <View style={{
              position: 'absolute', top: 0, bottom: 0, left: 0,
              width: `${Math.min(100, quorumPct * 2)}%`,
              backgroundColor: O_GOLD,
            }} />
            <View style={{
              position: 'absolute', top: -3, bottom: -3, left: '50%',
              width: 1, backgroundColor: quorumMet ? O_GREEN : O_FG_FAINT,
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontSize: 9, color: O_FG_FAINT }}>0%</Text>
            <Text style={{ fontSize: 9, color: quorumMet ? O_GREEN : O_FG_FAINT }}>50% needed</Text>
            <Text style={{ fontSize: 9, color: O_FG_FAINT }}>100%</Text>
          </View>
        </View>
      </View>

      {/* ward distribution (uses subOrgs as wards when present) */}
      {showWardTable && (
        <View style={{
          backgroundColor: O_BG_CARD, borderWidth: 1, borderColor: O_LINE,
          borderRadius: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, marginBottom: 12,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05 }}>Members by sub-org</Text>
            <Text style={{ fontFamily: MONO, fontSize: 8, color: O_FG_FAINT, letterSpacing: 1.4 }}>
              {String(wardData.length).padStart(2, '0')} OF {String(subOrgs.length || wardData.length).padStart(2, '0')}
            </Text>
          </View>
          {wardData.map((r: any, i: number) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 6,
              borderBottomWidth: i < wardData.length - 1 ? 1 : 0, borderBottomColor: O_LINE,
            }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.serifMediumItalic, fontSize: 11.5,  color: O_FG, letterSpacing: -0.05 }}>
                {r.ward}
              </Text>
              <View style={{ width: 60, height: 3, backgroundColor: O_LINE_STRONG, position: 'relative', overflow: 'hidden' }}>
                <View style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${Math.min(100, (r.pct / 22) * 100)}%`,
                  backgroundColor: O_GOLD,
                }} />
              </View>
              <Text style={{ fontFamily: MONO, fontSize: 9.5, color: O_FG, width: 28, textAlign: 'right' }}>
                {r.n}
              </Text>
              <Text style={{ fontFamily: MONO, fontSize: 8.5, color: O_FG_FAINT, letterSpacing: 1, width: 36, textAlign: 'right' }}>
                {r.pct.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Sub-orders section ───────────────────────────────────────────────
function SubOrdersSection({ subOrgs, totalMembers, onPress, onLongPress, isAdmin }: {
  subOrgs: any[];
  totalMembers: number;
  onPress: (s: any) => void;
  onLongPress: (s: any) => void;
  isAdmin: boolean;
}) {
  return (
    <View style={{ paddingHorizontal: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <Text style={{ fontSize: 13, color: O_FG_MUTED, letterSpacing: -0.05 }}>
          {subOrgs.length} {subOrgs.length === 1 ? 'sub-org' : 'sub-orgs'} · {totalMembers.toLocaleString()} total members
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {subOrgs.map((c, i) => {
          const monogram = monogramFromName(c.name || 'Sub-org');
          const founded = formatRomanYM(c.createdAt || c.created_at);
          const status = (c.status || 'active').toLowerCase();
          const memberCount = (c.memberCount ?? c.members ?? 0) as number;
          return (
            <TouchableOpacity
              key={c.id || i}
              activeOpacity={0.85}
              onPress={() => onPress(c)}
              onLongPress={isAdmin ? () => onLongPress(c) : undefined}
              style={{
                backgroundColor: O_BG_CARD,
                borderWidth: 1, borderColor: O_LINE,
                borderRadius: 10,
                paddingHorizontal: 13, paddingVertical: 11,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                position: 'relative', overflow: 'hidden',
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                backgroundColor: O_BG_RAISED,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 16,  color: O_GOLD_L, letterSpacing: -0.5 }}>
                  {monogram}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{
                  fontFamily: SERIF, fontSize: 14,
                  color: O_FG, letterSpacing: -0.05, lineHeight: 16, marginBottom: 3,
                }}>{c.name || 'Untitled sub-org'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>
                    <Text style={{ color: O_FG_MUTED }}>{memberCount}</Text> {memberCount === 1 ? 'member' : 'members'}
                  </Text>
                  <View style={{ width: 2, height: 2, borderRadius: 1, backgroundColor: O_FG_FAINT }} />
                  <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>
                    Founded {founded}
                  </Text>
                </View>
              </View>
              <Pill kind={status === 'forming' ? 'forming' : 'active'}>
                {status === 'forming' ? 'forming' : 'active'}
              </Pill>
              <Ionicons name="chevron-forward" size={14} color={O_FG_FAINT} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Members section ──────────────────────────────────────────────────
function MembersSection({ members, totalCount, search, onSearch, isAdmin, onMemberPress, onImportRoster }: {
  members: any[];
  totalCount: number;
  search: string;
  onSearch: (s: string) => void;
  isAdmin: boolean;
  onMemberPress: (m: any) => void;
  onImportRoster: () => void;
}) {
  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      const n = (m.name || m.userName || m.user?.name || '').toLowerCase();
      if (n.includes(q)) return true;
      // Email search is admin-only — prevents non-admins from enumerating
      // emails by typing partial matches.
      if (!isAdmin) return false;
      const e = (m.email || m.user?.email || '').toLowerCase();
      return e.includes(q);
    });
  }, [members, search, isAdmin]);

  const showList = members.length > 0;

  return (
    <View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <View style={{
          position: 'relative',
          backgroundColor: O_BG_CARD,
          borderWidth: 1, borderColor: O_LINE,
          borderRadius: 10,
          paddingLeft: 36, paddingRight: 12, paddingVertical: 10,
          flexDirection: 'row', alignItems: 'center',
        }}>
          <View style={{ position: 'absolute', left: 12, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search" size={14} color={O_FG_FAINT} />
          </View>
          <TextInput
            style={{ flex: 1, fontSize: 13, color: O_FG, paddingVertical: 0 }}
            placeholder="Search members"
            placeholderTextColor={O_FG_FAINT}
            value={search}
            onChangeText={onSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>
            {totalCount.toLocaleString()}
          </Text>
        </View>

        {isAdmin && (
          <TouchableOpacity
            onPress={onImportRoster}
            activeOpacity={0.7}
            style={{
              marginTop: 10,
              backgroundColor: O_BG_CARD,
              borderWidth: 1, borderColor: O_LINE,
              borderRadius: 10,
              paddingHorizontal: 12, paddingVertical: 10,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={O_GOLD} />
            <Text style={{ flex: 1, fontSize: 13, color: O_FG, letterSpacing: -0.05 }}>Import members from CSV</Text>
            <Ionicons name="chevron-forward" size={14} color={O_FG_FAINT} />
          </TouchableOpacity>
        )}
      </View>

      {!showList ? (
        <View style={{ paddingHorizontal: 14, paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 15,  color: O_FG_MUTED, textAlign: 'center', marginBottom: 6 }}>
            No members yet
          </Text>
          <Text style={{ fontSize: 12, color: O_FG_FAINT, textAlign: 'center' }}>
            {totalCount > 0 ? `${totalCount.toLocaleString()} ${totalCount === 1 ? 'member' : 'members'}` : ''}
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14 }}>
          <View style={{
            backgroundColor: O_BG_CARD,
            borderWidth: 1, borderColor: O_LINE,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {filtered.map((m, i) => {
              const memberRole = (m.role || 'member').toString().toLowerCase();
              const isAdminRow = memberRole === 'admin';
              const fullName = m.name || m.userName || m.user?.name || 'Unknown member';
              const monogram = monogramFromName(fullName);
              const joined = formatRomanYM(m.joinedAt || m.createdAt || m.created_at);
              const roleColor = isAdminRow ? O_GOLD : O_FG_MUTED;
              return (
                <TouchableOpacity
                  key={m.id || m.userId || i}
                  activeOpacity={isAdmin ? 0.7 : 1}
                  disabled={!isAdmin}
                  onPress={() => onMemberPress(m)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 11,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    borderBottomWidth: i < filtered.length - 1 ? 1 : 0,
                    borderBottomColor: O_LINE,
                    position: 'relative',
                  }}
                >
                  {isAdminRow && (
                    <View style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                      backgroundColor: O_GOLD,
                    }} />
                  )}
                  <View style={{
                    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                    backgroundColor: O_BG_RAISED,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 13,  color: isAdminRow ? O_GOLD_L : O_FG_MUTED }}>
                      {monogram}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: FONTS.sansMedium, color: O_FG, letterSpacing: -0.05, lineHeight: 18 }}>
                      {fullName}
                    </Text>
                    <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05, marginTop: 2 }}>
                      Joined {joined}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontFamily: FONTS.sansMedium, color: roleColor }}>
                    {isAdminRow ? 'Admin' : 'Member'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Announcements section ────────────────────────────────────────────
function AnnouncementsEmpty() {
  return (
    <View style={{ paddingHorizontal: 14 }}>
      <View style={{
        backgroundColor: O_BG_CARD,
        borderWidth: 1, borderColor: O_LINE, borderRadius: 14,
        paddingHorizontal: 24, paddingVertical: 36,
        alignItems: 'center',
      }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: O_BG_RAISED,
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Ionicons name="megaphone-outline" size={24} color={O_GOLD_L} />
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 18, color: O_FG, letterSpacing: -0.1, marginBottom: 6 }}>
          No announcements yet
        </Text>
        <Text style={{ fontSize: 13, color: O_FG_MUTED, textAlign: 'center', maxWidth: 240, lineHeight: 18 }}>
          Updates from admins will appear here.
        </Text>
      </View>
    </View>
  );
}

function AnnouncementsSection({ announcements, isAdmin, onDelete }: { announcements: any[]; isAdmin: boolean; onDelete: (id: string, title: string) => void }) {
  if (!announcements.length) return <AnnouncementsEmpty />;
  return (
    <View style={{ paddingHorizontal: 14 }}>
      {announcements.map((d, i) => {
        const date = d.createdAt || d.created_at || d.publishedAt;
        const headline = d.title || d.headline || 'Untitled announcement';
        const body = d.content || d.body || '';
        const author = d.authorName || d.author?.name || d.signedBy || '';
        const role = d.authorRole || 'Admin';
        const isMostRecent = i === 0;
        const isLast = i === announcements.length - 1;
        return (
          <View
            key={String(d.id || i)}
            style={{
              backgroundColor: O_BG_CARD,
              borderWidth: 1, borderColor: O_LINE,
              borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 14,
              marginBottom: isLast ? 0 : 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {isMostRecent && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: O_GOLD }} />
              )}
              <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>
                {formatRomanDate(date)}
              </Text>
              {d.pinned && (
                <Text style={{ fontSize: 11, color: O_GOLD_L, letterSpacing: -0.05 }}>· Pinned</Text>
              )}
              {isAdmin && d.id && (
                <TouchableOpacity onPress={() => onDelete(String(d.id), headline)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="trash-outline" size={13} color={O_FG_FAINT} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={{
              fontFamily: SERIF, fontSize: 16,
              color: O_FG, letterSpacing: -0.1, lineHeight: 20, marginBottom: 6,
            }}>{headline}</Text>
            {!!body && (
              <Text style={{ fontSize: 12.5, color: O_FG_MUTED, letterSpacing: -0.05, lineHeight: 17, marginBottom: 6 }}>
                {body}
              </Text>
            )}
            <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>
              {author ? `${author} · ${role}` : role}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ProposalsSection({ proposals, onPress }: { proposals: OrganizationProposal[]; onPress: (p: OrganizationProposal) => void }) {
  const [filter, setFilter] = useState<'all' | ProposalKind>('all');
  const counts = useMemo(() => {
    const c = { all: proposals.length, open: 0, passed: 0, closed: 0, failed: 0 };
    proposals.forEach((p) => { c[classifyProposal(p)]++; });
    return c;
  }, [proposals]);

  const visible = useMemo(() => {
    if (filter === 'all') return proposals;
    return proposals.filter((p) => classifyProposal(p) === filter);
  }, [proposals, filter]);

  if (!proposals.length) return <ProposalsEmpty />;

  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip active={filter === 'all'} onPress={() => setFilter('all')}>All · {counts.all}</FilterChip>
          <FilterChip active={filter === 'open'} onPress={() => setFilter('open')}>Active · {counts.open}</FilterChip>
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 14, gap: 10 }}>
        {visible.map((p, i) => {
          const kind = classifyProposal(p);
          const total = (p.supportVotes || 0) + (p.opposeVotes || 0);
          const isOpen = kind === 'open';
          const supportPercent = total > 0 ? Math.round(((p.supportVotes || 0) / total) * 100) : 50;
          const timeText = proposalTime(p, kind);
          const timeColor = isOpen ? O_GOLD : O_RED;
          const timeBg = isOpen ? 'rgba(234,186,88,0.15)' : 'rgba(255,107,91,0.15)';
          return (
            <Animated.View key={String(p.id)} entering={FadeInUp.delay(i * 40).duration(300)}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(p)}>
                <View style={{
                  backgroundColor: O_BG_CARD,
                  borderWidth: 1, borderColor: O_LINE,
                  borderRadius: 14,
                  paddingHorizontal: 16, paddingVertical: 14,
                }}>
                  {/* header: category + time */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(234,186,88,0.15)' }}>
                      <Text style={{ fontSize: 11, fontFamily: FONTS.sansSemiBold, color: O_GOLD, letterSpacing: 0.2 }}>
                        {p.category || 'General'}
                      </Text>
                    </View>
                    {!!timeText && (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                        backgroundColor: timeBg,
                      }}>
                        <Ionicons name="time-outline" size={11} color={timeColor} />
                        <Text style={{ fontSize: 11, fontFamily: FONTS.sansMedium, color: timeColor }}>
                          {timeText}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* title + description */}
                  <Text numberOfLines={2} style={{
                    fontFamily: SERIF, fontSize: 17,
                    color: O_FG, letterSpacing: -0.2, lineHeight: 22, marginBottom: 6,
                  }}>
                    {p.title}
                  </Text>
                  {!!p.description && (
                    <Text numberOfLines={3} style={{
                      fontSize: 13, color: O_FG_MUTED, letterSpacing: -0.05, lineHeight: 18, marginBottom: 12,
                    }}>
                      {p.description}
                    </Text>
                  )}

                  {/* support / oppose split bar */}
                  <View style={{ height: 4, backgroundColor: O_RED, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
                    <View style={{
                      position: 'absolute', top: 0, bottom: 0, left: 0,
                      width: `${supportPercent}%`,
                      backgroundColor: O_GREEN,
                    }} />
                  </View>

                  {/* vote stats */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: 'rgba(52,199,89,0.15)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="thumbs-up" size={11} color={O_GREEN} />
                      </View>
                      <Text style={{ fontSize: 12.5, color: O_FG_MUTED, letterSpacing: -0.05 }}>
                        {(p.supportVotes || 0).toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={{
                        width: 22, height: 22, borderRadius: 11,
                        backgroundColor: 'rgba(255,107,91,0.15)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name="thumbs-down" size={11} color={O_RED} />
                      </View>
                      <Text style={{ fontSize: 12.5, color: O_FG_MUTED, letterSpacing: -0.05 }}>
                        {(p.opposeVotes || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// Bottom sheet wrapper used by both redesigned modals.
function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(2,4,6,0.72)' }]} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: O_BG_CARD,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        borderTopWidth: 1, borderTopColor: O_LINE,
        paddingTop: 14,
        paddingBottom: 28 + insets.bottom,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 24,
      }}>
        <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: O_LINE_STRONG, alignSelf: 'center', marginBottom: 14 }} />
        {children}
      </View>
    </View>
  );
}

function InviteCodeModal({ visible, onClose, onConfirm, generating }: { visible: boolean; onClose: () => void; onConfirm: () => void; generating: boolean }) {
  const [validity, setValidity] = useState<'24h' | '07d' | '30d' | '90d'>('30d');
  const [singleUse, setSingleUse] = useState(true);
  if (!visible) return null;
  return (
    <BottomSheet onClose={onClose}>
      <View style={{ paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Circle cx={7} cy={7} r={6.4} fill="none" stroke={O_GOLD} strokeWidth={0.5} />
            <Path d="M7 3v8M3 7h8" stroke={O_GOLD} strokeWidth={0.6} fill="none" />
          </Svg>
          <Text style={{ fontSize: 12, color: O_GOLD, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold}}>New invite code</Text>
        </View>
        <Text style={{ fontSize: 13, color: O_FG_MUTED, lineHeight: 19, marginBottom: 16, maxWidth: 320 }}>
          Anyone with this code can join your organization.
        </Text>

        <View style={{
          paddingHorizontal: 16, paddingVertical: 18,
          backgroundColor: O_BG_RAISED,
          borderRadius: 10, marginBottom: 14, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05, marginBottom: 8 }}>
            Your new code
          </Text>
          <Text style={{
            fontFamily: MONO, fontSize: 18,
            color: O_GOLD_L, letterSpacing: 3,
          }}>
            {generating ? 'Generating…' : 'Tap to create'}
          </Text>
        </View>

        <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold, marginBottom: 8 }}>Expires after</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {(['24h', '07d', '30d', '90d'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              activeOpacity={0.75}
              onPress={() => { Haptics.selectionAsync(); setValidity(p); }}
              style={{
                flex: 1, paddingVertical: 9, alignItems: 'center',
                borderWidth: 1, borderColor: validity === p ? O_GOLD_D : O_LINE_STRONG,
                backgroundColor: validity === p ? 'rgba(234,186,88,0.08)' : 'transparent',
                borderRadius: 3,
              }}
            >
              <Text style={{ fontFamily: MONO, fontSize: 11, color: validity === p ? O_GOLD : O_FG_MUTED, letterSpacing: 0.9 }}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold, marginBottom: 8 }}>Single use</Text>
        <View style={{
          paddingHorizontal: 12, paddingVertical: 11,
          borderWidth: 1, borderColor: O_LINE_STRONG, borderRadius: 6,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
        }}>
          <Text style={{ fontSize: 14, color: O_FG }}>
            One person only
          </Text>
          <Switch
            value={singleUse}
            onValueChange={(v) => { Haptics.selectionAsync(); setSingleUse(v); }}
            trackColor={{ false: O_LINE_STRONG, true: O_GOLD_D }}
            thumbColor={singleUse ? O_GOLD : '#FFF'}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={{
            flex: 1, paddingVertical: 13,
            borderWidth: 1, borderColor: O_LINE_STRONG, borderRadius: 4, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, fontFamily: FONTS.sansSemiBold, letterSpacing: 2.2, textTransform: 'uppercase', color: O_FG_MUTED }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => { onConfirm(); onClose(); }}
            disabled={generating}
            style={{
              flex: 1.4, paddingVertical: 13, position: 'relative',
              borderWidth: 1, borderColor: O_GOLD_D,
              borderRadius: 4, alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(234,186,88,0.18)',
              shadowColor: O_GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 12,
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? (
              <ActivityIndicator size="small" color={O_GOLD_L} />
            ) : (
              <Text style={{ fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 2.2, textTransform: 'uppercase', color: O_GOLD_L }}>
                Generate code
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

function MemberRoleModal({ visible, onClose, member, onConfirm }: { visible: boolean; onClose: () => void; member: any | null; onConfirm: (role: 'admin' | 'member') => void }) {
  const [selected, setSelected] = useState<'admin' | 'member'>('member');
  useEffect(() => {
    if (member) setSelected((member.role || 'member').toLowerCase() === 'admin' ? 'admin' : 'member');
  }, [member?.id, member?.userId, visible]);
  if (!visible || !member) return null;

  const fullName = member.name || member.userName || member.user?.name || 'Member';
  const monogram = monogramFromName(fullName);
  const folio = `M·${String(member.id || member.userId || '0000').toString().slice(-4).toUpperCase().padStart(4, '0')}`;
  const joined = formatRomanYM(member.joinedAt || member.createdAt || member.created_at);

  const options: Array<{ role: 'admin' | 'member'; label: string; desc: string }> = [
    { role: 'admin',  label: 'Admin',  desc: 'Can manage members, post announcements, and edit settings' },
    { role: 'member', label: 'Member', desc: 'Can vote on proposals and view announcements' },
  ];

  return (
    <BottomSheet onClose={onClose}>
      <View style={{ paddingHorizontal: 18 }}>
        {/* member header card */}
        <View style={{
          paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
          borderWidth: 1, borderColor: O_LINE_STRONG, borderRadius: 6,
          backgroundColor: 'rgba(234,186,88,0.025)',
          flexDirection: 'row', alignItems: 'center', gap: 12,
          position: 'relative',
        }}>
          <View style={{
            width: 44, height: 44,
            borderWidth: 1, borderColor: O_GOLD_D, backgroundColor: '#0A0C0F',
            alignItems: 'center', justifyContent: 'center', position: 'relative',
          }}>
            <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 16,  color: O_GOLD_L }}>{monogram}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05 }}>Edit role</Text>
            <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 16, color: O_FG,  letterSpacing: -0.05, marginTop: 2 }}>
              {fullName}
            </Text>
            <Text style={{ fontSize: 11, color: O_FG_FAINT, letterSpacing: -0.05, marginTop: 1 }}>
              Joined {joined}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 11, color: O_FG_MUTED, letterSpacing: -0.05, fontFamily: FONTS.sansSemiBold, marginBottom: 10 }}>Choose a role</Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {options.map((opt) => {
            const active = selected === opt.role;
            return (
              <TouchableOpacity
                key={opt.role}
                activeOpacity={0.75}
                onPress={() => { Haptics.selectionAsync(); setSelected(opt.role); }}
                style={{
                  paddingHorizontal: 12, paddingVertical: 11,
                  borderWidth: 1, borderColor: active ? O_GOLD_D : O_LINE_STRONG,
                  backgroundColor: active ? 'rgba(234,186,88,0.06)' : 'transparent',
                  borderRadius: 4,
                  flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                  position: 'relative',
                }}
              >
                <View style={{
                  width: 14, height: 14, borderRadius: 7,
                  borderWidth: 1, borderColor: active ? O_GOLD : O_LINE_STRONG,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
                }}>
                  {active && (
                    <View style={{
                      width: 6, height: 6, borderRadius: 3, backgroundColor: O_GOLD,
                      shadowColor: O_GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4,
                    }} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 9.5, fontFamily: FONTS.sansBold, letterSpacing: 2.2, textTransform: 'uppercase', color: active ? O_GOLD : O_FG_MUTED, marginBottom: 3 }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontFamily: FONTS.serifMediumItalic, fontSize: 12,  color: O_FG, lineHeight: 16 }}>
                    {opt.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={{
            flex: 1, paddingVertical: 13,
            borderWidth: 1, borderColor: O_LINE_STRONG, borderRadius: 4, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, fontFamily: FONTS.sansSemiBold, letterSpacing: 2.2, textTransform: 'uppercase', color: O_FG_MUTED }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onConfirm(selected)}
            style={{
              flex: 1.4, paddingVertical: 13, position: 'relative',
              borderWidth: 1, borderColor: O_GOLD_D,
              borderRadius: 4, alignItems: 'center',
              backgroundColor: 'rgba(234,186,88,0.18)',
              shadowColor: O_GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.25, shadowRadius: 12,
            }}
          >
            <Text style={{ fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 2.2, textTransform: 'uppercase', color: O_GOLD_L }}>
              Save changes
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Org Detail screen ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export default function OrganizationDetailScreen() {
  const { token, user, isLoading: authLoading } = useAuthStore();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ orgId: string; orgName: string; orgRole?: string }>();

  // ── state (preserved verbatim from previous version) ────────────────
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [proposals, setProposals] = useState<OrganizationProposal[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('proposals');
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [proposalLimits, setProposalLimits] = useState<{ created: number; limit: number; period: 'month' | 'week'; resetDate: string } | null>(null);
  const [newProposal, setNewProposal] = useState<{
    title: string;
    description: string;
    category: string;
    isOfficial: boolean;
    voteType: 'yes-no' | 'multiple-choice' | 'ranked-choice';
    options: string[];
    requiresCitizenship: boolean;
  }>({ title: '', description: '', category: 'Other', isOfficial: false, voteType: 'yes-no', options: ['', ''], requiresCitizenship: false });

  const [members, setMembers] = useState<any[]>([]);
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', pinned: false });

  const [subOrgs, setSubOrgs] = useState<any[]>([]);
  const [subOrgsLoading, setSubOrgsLoading] = useState(false);
  const [showCreateSubOrgModal, setShowCreateSubOrgModal] = useState(false);
  const [creatingSubOrg, setCreatingSubOrg] = useState(false);
  const [newSubOrg, setNewSubOrg] = useState({ name: '', type: 'school', description: '' });

  const [insights, setInsights] = useState<OrgInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  // New modal state for redesigned interactions
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  // UPDATE 24: surfaced when an admin toggles ON require-verification on a
  // Free org (backend returns 402 + FEATURE_NOT_AVAILABLE_ON_TIER).
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);

  // Search state for members tab
  const [memberSearch, setMemberSearch] = useState('');

  // ── fetch hooks (preserved) ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (authLoading) return;
    if (!token || !params.orgId) { setLoading(false); return; }
    try {
      const [orgResult, proposalsResult, announcementsResult, limitsResult] = await Promise.all([
        organizationsApi.getOrganization(params.orgId),
        organizationsApi.getOrganizationProposals(params.orgId),
        organizationsApi.getOrganizationAnnouncements(params.orgId),
        organizationsApi.getProposalLimits(params.orgId),
      ]);
      if (orgResult.data) {
        const isDemoUser = user?.email === 'demo@represent.app';
        const role = isDemoUser ? 'admin' : (orgResult.data.role || (params.orgRole as 'admin' | 'member' | undefined));
        setOrganization({ ...orgResult.data, role });
      } else if (params.orgId && params.orgName) {
        const isDemoUser = user?.email === 'demo@represent.app';
        setOrganization({
          id: params.orgId as string,
          name: params.orgName as string,
          description: '',
          memberCount: 1,
          tier: 'free',
          verified: false,
          createdAt: new Date().toISOString(),
          role: isDemoUser ? 'admin' : ((params.orgRole as 'admin' | 'member') || 'member'),
        });
      }
      if (proposalsResult.data) setProposals(proposalsResult.data);
      if (announcementsResult.data) setAnnouncements(announcementsResult.data);
      if (limitsResult.data) setProposalLimits(limitsResult.data);
    } catch (error) {
      console.error('Failed to fetch organization data:', error);
      if (params.orgId && params.orgName) {
        const isDemoUser = user?.email === 'demo@represent.app';
        setOrganization({
          id: params.orgId as string,
          name: params.orgName as string,
          description: '',
          memberCount: 1,
          tier: 'free',
          verified: false,
          createdAt: new Date().toISOString(),
          role: isDemoUser ? 'admin' : ((params.orgRole as 'admin' | 'member') || 'member'),
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, params.orgId, params.orgName, params.orgRole, user, authLoading]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const fetchAdminData = useCallback(async () => {
    if (!params.orgId || organization?.role !== 'admin') return;
    setAdminLoading(true);
    try {
      const [membersResult, codesResult] = await Promise.all([
        organizationsApi.getMembers(params.orgId),
        organizationsApi.getInviteCodes(params.orgId),
      ]);
      if (membersResult.data) setMembers(membersResult.data);
      if (codesResult.data) setInviteCodes(codesResult.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setAdminLoading(false);
    }
  }, [params.orgId, organization?.role]);

  // Members tab visible to everyone now; fetch members on tab open if admin
  useEffect(() => {
    if ((activeTab === 'members' || activeTab === 'settings') && organization?.role === 'admin') {
      fetchAdminData();
    }
  }, [activeTab, fetchAdminData, organization?.role]);

  const fetchSubOrgs = useCallback(async () => {
    if (!params.orgId) return;
    setSubOrgsLoading(true);
    try {
      const result = await organizationsApi.getSubOrganizations(params.orgId);
      if (result.data) setSubOrgs(result.data);
    } catch (error) {
      console.error('Failed to fetch sub-orgs:', error);
    } finally {
      setSubOrgsLoading(false);
    }
  }, [params.orgId]);

  const fetchInsights = useCallback(async () => {
    if (!params.orgId) return;
    setInsightsLoading(true);
    try {
      const result = await organizationsApi.getOrganizationInsights(params.orgId, 30);
      if (result.data) setInsights(result.data as OrgInsights);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  }, [params.orgId]);

  // Always fetch sub-orgs once we have an org so we can decide if the tab is visible
  useEffect(() => {
    if (organization?.id) fetchSubOrgs();
  }, [organization?.id, fetchSubOrgs]);

  useEffect(() => {
    if (activeTab === 'insights') {
      fetchInsights();
      fetchSubOrgs();
    }
    if (activeTab === 'subOrders') {
      fetchSubOrgs();
    }
  }, [activeTab, fetchSubOrgs, fetchInsights]);

  // ── handlers (preserved verbatim) ───────────────────────────────────
  const handleCreateSubOrg = async () => {
    if (!params.orgId || !newSubOrg.name.trim()) {
      Alert.alert('Required', 'Please enter a name for the sub-organization.');
      return;
    }
    setCreatingSubOrg(true);
    try {
      const result = await organizationsApi.createSubOrganization(
        params.orgId,
        newSubOrg.name.trim(),
        newSubOrg.type,
        { description: newSubOrg.description.trim() || undefined },
      );
      if (result.error) { Alert.alert('Error', result.error); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setNewSubOrg({ name: '', type: 'school', description: '' });
      setShowCreateSubOrgModal(false);
      await fetchSubOrgs();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to create sub-organization');
    } finally {
      setCreatingSubOrg(false);
    }
  };

  const handleDeleteSubOrg = (subOrg: any) => {
    Alert.alert('Delete Sub-organization', `Permanently delete "${subOrg.name}"? Its members, proposals, and voting history will be removed. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!params.orgId) return;
          try {
            const result = await organizationsApi.deleteSubOrganization(params.orgId, subOrg.id);
            if (result.error) { Alert.alert('Error', result.error); return; }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await fetchSubOrgs();
          } catch (error: any) {
            Alert.alert('Error', error?.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleOpenSubOrg = (subOrg: any) => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/modals/organization-detail',
      params: { orgId: subOrg.id, orgName: subOrg.name, orgRole: 'admin' },
    });
  };

  const handleLeaveOrganization = () => {
    if (!organization) return;
    Alert.alert('Leave Organization', `Are you sure you want to leave ${organization.name}? You'll need a new invite code to rejoin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setLeaving(true);
          try {
            const result = await organizationsApi.leaveOrganization(params.orgId);
            if (result.error) { Alert.alert('Error', result.error); return; }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch (error) {
            Alert.alert('Error', 'Failed to leave organization. Please try again.');
          } finally {
            setLeaving(false);
          }
        },
      },
    ]);
  };

  const canDeleteOrganization = () => {
    if (!organization) return false;
    if (organization.role !== 'admin') return false;
    if (organization.id === 'demo-org-001') return false;
    return true;
  };

  const handleDeleteOrganization = () => {
    if (!organization || !canDeleteOrganization()) return;
    Alert.alert('Delete Organization', `Are you sure you want to permanently delete "${organization.name}"?\n\nThis cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setDeleting(true);
          try {
            const result = await organizationsApi.deleteOrganization(params.orgId);
            if (result.error) { Alert.alert('Error', result.error); return; }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete organization.');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleCreateProposal = async () => {
    if (!newProposal.title.trim() || !newProposal.description.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both title and description.');
      return;
    }
    if (newProposal.voteType !== 'yes-no') {
      const cleaned = newProposal.options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) {
        Alert.alert('Need more options', 'Multiple-choice and ranked-choice proposals need at least 2 options.');
        return;
      }
      if (new Set(cleaned).size !== cleaned.length) {
        Alert.alert('Duplicate options', 'Each option must be unique.');
        return;
      }
    }
    if (proposalLimits && proposalLimits.created >= proposalLimits.limit) {
      Alert.alert('Limit Reached', `You've reached your ${proposalLimits.period}ly proposal limit. Limits reset on ${new Date(proposalLimits.resetDate).toLocaleDateString()}.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);
    try {
      const cleanedOptions = newProposal.voteType === 'yes-no'
        ? undefined
        : newProposal.options.map((o) => o.trim()).filter(Boolean);
      const result = await organizationsApi.createProposal(params.orgId, {
        title: newProposal.title.trim(),
        description: newProposal.description.trim(),
        category: newProposal.category,
        isOfficial: newProposal.isOfficial,
        voteType: newProposal.voteType,
        options: cleanedOptions,
        requiresCitizenship: newProposal.requiresCitizenship,
      });
      if (result.error) { Alert.alert('Error', result.error); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateModal(false);
      setNewProposal({ title: '', description: '', category: 'Other', isOfficial: false, voteType: 'yes-no', options: ['', ''], requiresCitizenship: false });
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to create proposal. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleGenerateInviteCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratingCode(true);
    try {
      const result = await organizationsApi.generateInviteCode(params.orgId);
      if (result.error) { Alert.alert('Error', result.error); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchAdminData();
    } catch (error) {
      Alert.alert('Error', 'Failed to generate invite code.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setString(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const handleRevokeCode = (code: string) => {
    Alert.alert('Revoke Code', `Are you sure you want to revoke the invite code "${code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke', style: 'destructive', onPress: async () => {
          try {
            await organizationsApi.revokeInviteCode(params.orgId, code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchAdminData();
          } catch (error) {
            Alert.alert('Error', 'Failed to revoke code.');
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (userId: string, name: string) => {
    Alert.alert('Remove Member', `Are you sure you want to remove ${name} from this organization?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await organizationsApi.removeMember(params.orgId, userId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchAdminData();
          } catch (error) {
            Alert.alert('Error', 'Failed to remove member.');
          }
        },
      },
    ]);
  };

  const handleToggleMemberRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await organizationsApi.updateMemberRole(params.orgId, userId, newRole);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchAdminData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update role.');
    }
  };

  const handleSetMemberRole = async (userId: string, newRole: 'admin' | 'member') => {
    try {
      await organizationsApi.updateMemberRole(params.orgId, userId, newRole);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchAdminData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update role.');
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both title and content.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreatingAnnouncement(true);
    try {
      const result = await organizationsApi.createAnnouncement(params.orgId, {
        title: newAnnouncement.title.trim(),
        content: newAnnouncement.content.trim(),
        pinned: newAnnouncement.pinned,
      });
      if (result.error) { Alert.alert('Error', result.error); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAnnouncementModal(false);
      setNewAnnouncement({ title: '', content: '', pinned: false });
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to create announcement.');
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = (announcementId: string, title: string) => {
    Alert.alert('Delete Announcement', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await organizationsApi.deleteAnnouncement(params.orgId, announcementId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete announcement.');
          }
        },
      },
    ]);
  };

  const handleDeleteProposal = (proposalId: string) => {
    const proposal = proposals.find(p => String(p.id) === proposalId);
    const proposalTitle = proposal?.title || 'this proposal';
    Alert.alert('Delete Proposal', `Are you sure you want to delete "${proposalTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            const result = await organizationsApi.deleteProposal(params.orgId, proposalId);
            if (result.error) { Alert.alert('Error', result.error); return; }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setProposals(prev => prev.filter(p => String(p.id) !== proposalId));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete proposal.');
          }
        },
      },
    ]);
  };

  const handleProposalPress = (p: OrganizationProposal) => {
    Haptics.selectionAsync();
    // The detail screen hydrates from route params (no API fetch on its end),
    // so we need to pass every field it reads — otherwise title falls back
    // to "Proposal", description is empty, votes are 0, etc.
    router.push({
      pathname: '/modals/org-proposal-detail',
      params: {
        orgId: params.orgId,
        proposalId: String(p.id),
        title: p.title || '',
        description: p.description || '',
        category: p.category || 'General',
        supportVotes: String(p.supportVotes ?? 0),
        opposeVotes: String(p.opposeVotes ?? 0),
        deadline: p.deadline || '',
        userVote: (p as any).userVote || '',
        isOfficial: String((p as any).isOfficial ?? false),
        orgName: organization?.name || (params.orgName as string) || '',
        // RCV/multi-choice metadata. Defaulted so existing yes-no proposals
        // are unaffected. Options is JSON-encoded (URL params can't carry arrays).
        voteType: ((p as any).voteType as string) || 'yes-no',
        options: JSON.stringify((p as any).options ?? []),
        creatorId: String((p as any).creatorId ?? (p as any).userId ?? ''),
        creatorName: (p as any).creatorName || 'Community Member',
      },
    });
  };

  // Overflow menu — admin gets manage actions; member gets leave
  const handleOverflow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (organization?.role === 'admin' && canDeleteOrganization()) {
      Alert.alert('Manage Organization', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave Organization', style: 'destructive', onPress: handleLeaveOrganization },
        { text: 'Delete Organization', style: 'destructive', onPress: handleDeleteOrganization },
      ]);
    } else {
      handleLeaveOrganization();
    }
  };

  // ── render ──────────────────────────────────────────────────────────
  const isAdmin = organization?.role === 'admin';
  const hasSubOrgs = subOrgs.length > 0;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: O_BG, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={O_GOLD} />
        <Text style={{ fontFamily: MONO, fontSize: 10, color: O_FG_FAINT, letterSpacing: 1.4, marginTop: 12, textTransform: 'uppercase' }}>
          Loading
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: O_BG }]}>
      <TopBar
        title={organization?.name || params.orgName || 'Organization'}
        isAdmin={!!isAdmin}
        onBack={() => router.back()}
        onOverflow={handleOverflow}
        insetTop={insets.top}
      />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: 64 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={O_GOLD} />}
      >
        {organization && <Hero org={organization} proposalCount={proposals.length} actualMemberCount={members.length} />}

        <SectionTabs
          active={activeTab}
          onChange={setActiveTab}
          isAdmin={!!isAdmin}
          hasSubOrgs={hasSubOrgs}
        />

        {activeTab === 'proposals' && <ProposalsSection proposals={proposals} onPress={handleProposalPress} />}
        {activeTab === 'announcements' && <AnnouncementsSection announcements={announcements} isAdmin={!!isAdmin} onDelete={handleDeleteAnnouncement} />}
        {activeTab === 'members' && (
          <MembersSection
            members={members}
            totalCount={Math.max(organization?.memberCount ?? 0, members.length)}
            search={memberSearch}
            onSearch={setMemberSearch}
            isAdmin={!!isAdmin}
            onMemberPress={(m) => {
              if (isAdmin) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingMember(m);
                setShowRoleModal(true);
              }
            }}
            onImportRoster={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: '/modals/import-roster',
                params: { orgId: organization?.id ?? '', orgName: organization?.name ?? '' },
              });
            }}
          />
        )}
        {activeTab === 'subOrders' && (
          <SubOrdersSection
            subOrgs={subOrgs}
            totalMembers={subOrgs.reduce((s: number, c: any) => s + ((c.memberCount ?? c.members ?? 0) as number), 0)}
            onPress={handleOpenSubOrg}
            onLongPress={handleDeleteSubOrg}
            isAdmin={!!isAdmin}
          />
        )}
        {activeTab === 'insights' && (
          <InsightsSection
            insights={insights}
            subOrgs={subOrgs}
            loading={insightsLoading}
            sealedAt={new Date().toISOString()}
          />
        )}
        {activeTab === 'settings' && organization && (
          <SettingsSection
            org={organization}
            inviteCodes={inviteCodes}
            generating={generatingCode}
            onCopy={handleCopyCode}
            onGenerate={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInviteCodeModal(true); }}
            onRevoke={handleRevokeCode}
            onLeave={handleLeaveOrganization}
            canDelete={canDeleteOrganization()}
            onDelete={handleDeleteOrganization}
            actualMemberCount={members.length}
            onUpgradePrompt={() => setShowUpgradeModal(true)}
            onOrgUpdated={(patch) => setOrganization((cur) => (cur ? { ...cur, ...patch } : cur))}
          />
        )}
      </ScrollView>

      {/* Floating action button for create proposal (visible to all on proposals tab) */}
      {activeTab === 'proposals' && organization && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateModal(true); }}
          style={{
            position: 'absolute', right: 18, bottom: 24 + insets.bottom,
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: O_GOLD,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
          }}
        >
          <Ionicons name="add" size={22} color="#0A0C0F" />
        </TouchableOpacity>
      )}
      {activeTab === 'announcements' && isAdmin && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAnnouncementModal(true); }}
          style={{
            position: 'absolute', right: 18, bottom: 24 + insets.bottom,
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: O_GOLD,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
          }}
        >
          <Ionicons name="add" size={22} color="#0A0C0F" />
        </TouchableOpacity>
      )}
      {activeTab === 'subOrders' && isAdmin && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateSubOrgModal(true); }}
          style={{
            position: 'absolute', right: 18, bottom: 24 + insets.bottom,
            width: 52, height: 52, borderRadius: 26,
            backgroundColor: O_GOLD,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
          }}
        >
          <Ionicons name="add" size={22} color="#0A0C0F" />
        </TouchableOpacity>
      )}

      {/* Existing Create Proposal modal (preserved verbatim, restyled lightly) */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView style={[styles.modalContainer, { backgroundColor: O_BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalHeader, { borderBottomColor: O_LINE }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={O_FG} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: O_FG, fontFamily: FONTS.serifMediumItalic,  }]}>New proposal</Text>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: creating ? O_FG_FAINT : O_GOLD }]}
              onPress={handleCreateProposal} disabled={creating}
            >
              {creating ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.modalSubmitBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {proposalLimits && (
              <View style={[styles.limitsCard, { backgroundColor: O_BG_CARD, borderColor: O_LINE }]}>
                <Ionicons name="analytics-outline" size={16} color={O_GOLD} />
                <Text style={[styles.limitsText, { color: O_FG_MUTED }]}>
                  {proposalLimits.created} of {proposalLimits.limit} proposals this {proposalLimits.period}
                </Text>
              </View>
            )}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: O_FG_FAINT }]}>Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG, color: O_FG }]}
                placeholder="What are you proposing?"
                placeholderTextColor={O_FG_FAINT}
                value={newProposal.title}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, title: t }))}
                maxLength={100}
              />
              <Text style={[styles.charCount, { color: O_FG_FAINT }]}>{newProposal.title.length}/100</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: O_FG_FAINT }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG, color: O_FG }]}
                placeholder="Provide details about your proposal..."
                placeholderTextColor={O_FG_FAINT}
                value={newProposal.description}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, description: t }))}
                multiline numberOfLines={6} textAlignVertical="top" maxLength={1000}
              />
              <Text style={[styles.charCount, { color: O_FG_FAINT }]}>{newProposal.description.length}/1000</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: O_FG_FAINT }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, {
                      backgroundColor: newProposal.category === cat ? O_GOLD : O_BG_CARD,
                      borderColor: newProposal.category === cat ? O_GOLD : O_LINE_STRONG,
                    }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewProposal((p) => ({ ...p, category: cat })); }}
                  >
                    <Text style={[styles.categoryChipText, { color: newProposal.category === cat ? '#000' : O_FG_MUTED }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Vote type picker. Defaults to yes-no for backward compat. */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: O_FG_FAINT }]}>Ballot type</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['yes-no', 'multiple-choice', 'ranked-choice'] as const).map((vt) => {
                  const active = newProposal.voteType === vt;
                  const label = vt === 'yes-no' ? 'Yes / No' : vt === 'multiple-choice' ? 'Multiple choice' : 'Ranked choice';
                  return (
                    <TouchableOpacity
                      key={vt}
                      onPress={() => setNewProposal((p) => ({ ...p, voteType: vt }))}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 8,
                        backgroundColor: active ? O_GOLD : O_BG_CARD,
                        borderColor: active ? O_GOLD : O_LINE_STRONG,
                        borderWidth: 1,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: active ? '#000' : O_FG_MUTED, fontSize: 12, fontFamily: FONTS.sansSemiBold}}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {newProposal.voteType === 'ranked-choice' && (
                <Text style={{ color: O_FG_FAINT, fontSize: 11, marginTop: 6, lineHeight: 16 }}>
                  Voters rank options in order of preference. Winner determined by instant-runoff (IRV).
                </Text>
              )}
            </View>

            {/* Options list, shown for non-yes-no ballots. */}
            {newProposal.voteType !== 'yes-no' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: O_FG_FAINT }]}>Options</Text>
                {newProposal.options.map((opt, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG, color: O_FG, flex: 1 }]}
                      placeholder={`Option ${idx + 1}`}
                      placeholderTextColor={O_FG_FAINT}
                      value={opt}
                      onChangeText={(t) => setNewProposal((p) => {
                        const next = [...p.options];
                        next[idx] = t;
                        return { ...p, options: next };
                      })}
                      maxLength={120}
                    />
                    {newProposal.options.length > 2 && (
                      <TouchableOpacity
                        onPress={() => setNewProposal((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }))}
                        style={{ padding: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color={O_FG_FAINT} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {newProposal.options.length < 10 && (
                  <TouchableOpacity
                    onPress={() => setNewProposal((p) => ({ ...p, options: [...p.options, ''] }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={O_GOLD} />
                    <Text style={{ color: O_GOLD, fontSize: 12, fontFamily: FONTS.sansSemiBold}}>Add option</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {organization?.role === 'admin' && (
              <View style={[styles.officialToggleRow, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG }]}>
                <View style={styles.officialToggleInfo}>
                  <View style={[styles.officialToggleIcon, { backgroundColor: 'rgba(234,186,88,0.15)' }]}>
                    <Ionicons name="ribbon" size={16} color={O_GOLD} />
                  </View>
                  <View style={styles.officialToggleText}>
                    <Text style={[styles.officialToggleTitle, { color: O_FG }]}>Official Proposal</Text>
                    <Text style={[styles.officialToggleSubtitle, { color: O_FG_MUTED }]}>
                      Mark as an official proposal from {organization?.name}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={newProposal.isOfficial}
                  onValueChange={(v) => setNewProposal((p) => ({ ...p, isOfficial: v }))}
                  trackColor={{ false: O_LINE_STRONG, true: O_GOLD }}
                  thumbColor="#FFF"
                />
              </View>
            )}

            {organization?.role === 'admin' && (
              <View style={[styles.officialToggleRow, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG }]}>
                <View style={styles.officialToggleInfo}>
                  <View style={[styles.officialToggleIcon, { backgroundColor: 'rgba(234,186,88,0.15)' }]}>
                    <Ionicons name="shield-checkmark" size={16} color={O_GOLD} />
                  </View>
                  <View style={styles.officialToggleText}>
                    <Text style={[styles.officialToggleTitle, { color: O_FG }]}>Citizens only</Text>
                    <Text style={[styles.officialToggleSubtitle, { color: O_FG_MUTED }]}>
                      Only voters who verify citizenship (passport + proof of address) can vote
                    </Text>
                  </View>
                </View>
                <Switch
                  value={newProposal.requiresCitizenship}
                  onValueChange={(v) => setNewProposal((p) => ({ ...p, requiresCitizenship: v }))}
                  trackColor={{ false: O_LINE_STRONG, true: O_GOLD }}
                  thumbColor="#FFF"
                />
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Existing Create Announcement modal (preserved) */}
      <Modal visible={showAnnouncementModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAnnouncementModal(false)}>
        <KeyboardAvoidingView style={[styles.modalContainer, { backgroundColor: O_BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalHeader, { borderBottomColor: O_LINE }]}>
            <TouchableOpacity onPress={() => setShowAnnouncementModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={O_FG} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: O_FG, fontFamily: FONTS.serifMediumItalic,  }]}>New announcement</Text>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: creatingAnnouncement ? O_FG_FAINT : O_GOLD }]}
              onPress={handleCreateAnnouncement} disabled={creatingAnnouncement}
            >
              {creatingAnnouncement ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.modalSubmitBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: O_FG_FAINT }]}>Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG, color: O_FG }]}
                placeholder="Announcement title"
                placeholderTextColor={O_FG_FAINT}
                value={newAnnouncement.title}
                onChangeText={(t) => setNewAnnouncement((p) => ({ ...p, title: t }))}
                maxLength={100}
              />
              <Text style={[styles.charCount, { color: O_FG_FAINT }]}>{newAnnouncement.title.length}/100</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: O_FG_FAINT }]}>Content</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG, color: O_FG }]}
                placeholder="Write your announcement..."
                placeholderTextColor={O_FG_FAINT}
                value={newAnnouncement.content}
                onChangeText={(t) => setNewAnnouncement((p) => ({ ...p, content: t }))}
                multiline numberOfLines={6} textAlignVertical="top" maxLength={2000}
              />
              <Text style={[styles.charCount, { color: O_FG_FAINT }]}>{newAnnouncement.content.length}/2000</Text>
            </View>
            <View style={[styles.pinToggleRow, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG }]}>
              <View style={styles.pinToggleInfo}>
                <Ionicons name="pin" size={18} color={O_GOLD} />
                <View>
                  <Text style={[styles.pinToggleLabel, { color: O_FG }]}>Pin announcement</Text>
                  <Text style={[styles.pinToggleHint, { color: O_FG_MUTED }]}>Pinned announcements appear at the top</Text>
                </View>
              </View>
              <Switch
                value={newAnnouncement.pinned}
                onValueChange={(v) => setNewAnnouncement((p) => ({ ...p, pinned: v }))}
                trackColor={{ false: O_LINE_STRONG, true: O_GOLD }}
                thumbColor="#FFF"
              />
            </View>
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Existing Create Sub-org modal (preserved) */}
      <Modal visible={showCreateSubOrgModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateSubOrgModal(false)}>
        <KeyboardAvoidingView style={[styles.modalContainer, { backgroundColor: O_BG }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalHeader, { borderBottomColor: O_LINE }]}>
            <TouchableOpacity onPress={() => setShowCreateSubOrgModal(false)} disabled={creatingSubOrg}>
              <Text style={[styles.modalCancel, { color: O_FG_MUTED }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: O_FG, fontFamily: FONTS.serifMediumItalic,  }]}>New sub-org</Text>
            <TouchableOpacity onPress={handleCreateSubOrg} disabled={creatingSubOrg || !newSubOrg.name.trim()}>
              {creatingSubOrg ? <ActivityIndicator size="small" color={O_GOLD} /> : <Text style={[styles.modalSubmit, { color: newSubOrg.name.trim() ? O_GOLD : O_FG_FAINT }]}>Create</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: O_FG }]}>Name</Text>
            <TextInput
              value={newSubOrg.name}
              onChangeText={(t) => setNewSubOrg({ ...newSubOrg, name: t })}
              placeholder={`e.g. "Mr. Smith's Class"`}
              placeholderTextColor={O_FG_FAINT}
              style={[styles.modalInput, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG, color: O_FG }]}
              maxLength={80} autoCapitalize="words"
            />
            <Text style={[styles.modalLabel, { color: O_FG, marginTop: 16 }]}>Type</Text>
            <View style={styles.typeRow}>
              {ORG_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setNewSubOrg({ ...newSubOrg, type: t.value })}
                  style={[styles.typeChip, {
                    backgroundColor: newSubOrg.type === t.value ? 'rgba(234,186,88,0.12)' : O_BG_CARD,
                    borderColor: newSubOrg.type === t.value ? O_GOLD : O_LINE_STRONG,
                  }]}
                >
                  <Text style={{ color: newSubOrg.type === t.value ? O_GOLD : O_FG_MUTED, fontSize: 12 }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: O_FG, marginTop: 16 }]}>Description (optional)</Text>
            <TextInput
              value={newSubOrg.description}
              onChangeText={(t) => setNewSubOrg({ ...newSubOrg, description: t })}
              placeholder="What's this sub-org for?"
              placeholderTextColor={O_FG_FAINT}
              style={[styles.modalInput, styles.modalInputMultiline, { backgroundColor: O_BG_CARD, borderColor: O_LINE_STRONG, color: O_FG }]}
              multiline maxLength={300}
            />
            <Text style={[styles.adminEmptyText, { color: O_FG_FAINT, marginTop: 16 }]}>
              Sub-organizations get their own invite code, member roster, and proposal feed. Members of the sub-org are also effective members of {organization?.name || 'this organization'}.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* New redesigned modals (filled in subsequent passes) */}
      <InviteCodeModal
        visible={showInviteCodeModal}
        onClose={() => setShowInviteCodeModal(false)}
        onConfirm={handleGenerateInviteCode}
        generating={generatingCode}
      />
      <MemberRoleModal
        visible={showRoleModal}
        member={editingMember}
        onClose={() => { setShowRoleModal(false); setEditingMember(null); }}
        onConfirm={(role) => {
          if (editingMember) handleSetMemberRole(editingMember.id || editingMember.userId, role);
          setShowRoleModal(false);
          setEditingMember(null);
        }}
      />
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        type="orgTier"
        title="Pro plan required"
        message="Required-verification mode is a Pro plan feature. Upgrade this organization to enable identity-verified voting."
        ctaLabel="Manage plan"
        onCta={() => {
          setShowUpgradeModal(false);
          if (organization) {
            router.push({
              pathname: '/modals/organization-billing',
              params: { orgId: organization.id, orgName: organization.name },
            });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1,
  },
  modalCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontFamily: FONTS.sansMedium},
  modalSubmitBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4 },
  modalSubmitBtnText: { color: '#000', fontFamily: FONTS.sansSemiBold, fontSize: 13, letterSpacing: 1 },
  modalContent: { flex: 1, padding: 16 },
  modalCancel: { fontSize: 14, fontFamily: FONTS.sansMedium},
  modalSubmit: { fontSize: 14, fontFamily: FONTS.sansSemiBold},
  modalLabel: { fontSize: 12, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderRadius: 4, padding: 12, fontSize: 15 },
  modalInputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  limitsCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 4, borderWidth: 1, marginBottom: 14 },
  limitsText: { fontSize: 12 },
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontSize: 11, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 },
  textInput: { borderWidth: 1, borderRadius: 4, padding: 12, fontSize: 15 },
  textArea: { borderWidth: 1, borderRadius: 4, padding: 12, fontSize: 15, minHeight: 110 },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: 4, fontFamily: MONO, letterSpacing: 1 },
  categoryScroll: { flexDirection: 'row' },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 2, borderWidth: 1, marginRight: 6 },
  categoryChipText: { fontSize: 11, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.5, textTransform: 'uppercase' },
  officialToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 6, borderWidth: 1 },
  officialToggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  officialToggleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  officialToggleText: { flex: 1 },
  officialToggleTitle: { fontSize: 14, fontFamily: FONTS.sansSemiBold},
  officialToggleSubtitle: { fontSize: 11, marginTop: 2 },
  pinToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 6, borderWidth: 1 },
  pinToggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  pinToggleLabel: { fontSize: 14, fontFamily: FONTS.sansSemiBold},
  pinToggleHint: { fontSize: 11, marginTop: 2 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, borderWidth: 1 },
  adminEmptyText: { fontSize: 11, lineHeight: 16 },
});

// Exports for sibling section files (in case we extract later)
export { O_GOLD, O_GOLD_D, O_GOLD_L, O_BG, O_BG_CARD, O_BG_RAISED, O_LINE, O_LINE_STRONG, O_FG, O_FG_MUTED, O_FG_FAINT, O_GREEN, O_RED, SERIF, MONO };
