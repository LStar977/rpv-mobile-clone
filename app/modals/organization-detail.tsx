import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Switch, Clipboard } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Defs, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, Organization, OrganizationProposal } from '../../lib/api';
import { UpgradeModal } from '../../components/ui/UpgradeModal';
import { TallyBar } from '../../components/ui';
import { FONTS, RADIUS, SPACING, useTheme } from '../../lib/theme';

// ─── legacy static tokens (kept for sibling files that import them) ───
// The screen itself now themes through useTheme(); these remain exported
// so existing imports keep compiling. Do not use for new UI.
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
function formatShortDateUpper(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}
function monogramFromName(n: string): string {
  const p = (n || '').split(/\s+/).filter(Boolean);
  if (!p.length) return 'O';
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : p[0].slice(0, 2).toUpperCase();
}

// ─── atoms ────────────────────────────────────────────────────────────
function VerifiedTick({ size = 14 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={6.4} fill={colors.supportSurface} stroke={colors.support} strokeWidth={0.6} />
      <Path d="M4.2 7.2l2 2 3.6-4" stroke={colors.support} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function RoleChip({ role }: { role: 'admin' | 'member' }) {
  const { colors } = useTheme();
  const isAdmin = role === 'admin';
  return (
    <View style={{
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.chip,
      backgroundColor: isAdmin ? colors.goldFill : colors.surfaceHighlight,
    }}>
      <Text style={{
        fontFamily: FONTS.sansSemiBold, fontSize: 9.5, letterSpacing: 1.14,
        color: isAdmin ? '#040707' : colors.textSecondary,
      }}>{isAdmin ? 'ADMIN' : 'MEMBER'}</Text>
    </View>
  );
}

function OrgPortrait({ name, logoUrl, size = 52 }: { name: string; logoUrl?: string; size?: number }) {
  const { colors } = useTheme();
  if (logoUrl) {
    return (
      <ExpoImage
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: 16, backgroundColor: colors.surfaceHighlight }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: 16,
      backgroundColor: colors.surfaceHighlight,
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <Text style={{
        fontFamily: FONTS.serifSemiBold, fontSize: Math.round(size * 0.37),
        color: colors.text,
      }}>{monogramFromName(name)}</Text>
    </View>
  );
}

type PillKind = 'open' | 'closed' | 'passed' | 'failed' | 'active' | 'forming';
function Pill({ kind, children }: { kind: PillKind; children: React.ReactNode }) {
  const { colors } = useTheme();
  const map: Record<PillKind, { color: string; bg: string; dot: string }> = {
    open:    { color: colors.gold,          bg: colors.goldSurface,      dot: colors.gold },
    active:  { color: colors.gold,          bg: colors.goldSurface,      dot: colors.gold },
    closed:  { color: colors.textTertiary,  bg: colors.surfaceHighlight, dot: colors.textTertiary },
    forming: { color: colors.textTertiary,  bg: colors.surfaceHighlight, dot: colors.textTertiary },
    passed:  { color: colors.support,       bg: colors.supportSurface,   dot: colors.support },
    failed:  { color: colors.textSecondary, bg: colors.surfaceHighlight, dot: colors.textSecondary },
  };
  const m = map[kind];
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 9, paddingVertical: 4,
      backgroundColor: m.bg,
      borderRadius: RADIUS.chip, alignSelf: 'flex-start',
    }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: m.dot }} />
      <Text style={{
        fontSize: 8.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.4,
        textTransform: 'uppercase', color: m.color,
      }}>{children}</Text>
    </View>
  );
}

// ─── top bar ──────────────────────────────────────────────────────────
function TopBar({ isAdmin, onBack, onOverflow }: { isAdmin: boolean; onBack: () => void; onOverflow: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{
      paddingHorizontal: SPACING.screenPadding, paddingTop: 8, paddingBottom: 4,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} accessibilityLabel="Back" style={{
        width: 40, height: 40, borderRadius: 20,
        borderWidth: 1, borderColor: colors.borderSubtle,
        backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <RoleChip role={isAdmin ? 'admin' : 'member'} />
        <TouchableOpacity onPress={onOverflow} activeOpacity={0.7} accessibilityLabel="Organization options" style={{
          width: 40, height: 40, borderRadius: 20,
          borderWidth: 1, borderColor: colors.borderSubtle,
          backgroundColor: colors.surface,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── hero ─────────────────────────────────────────────────────────────
function Hero({ org, openBallotCount, actualMemberCount }: { org: Organization; openBallotCount: number; actualMemberCount: number }) {
  const { colors } = useTheme();
  // The deployed backend doesn't always increment org.memberCount when a
  // user accepts an invite, so prefer the larger of the two when we've
  // actually loaded the members list.
  const memberCount = Math.max(org.memberCount ?? 0, actualMemberCount);

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{
      paddingHorizontal: SPACING.screenPadding, marginTop: 10, marginBottom: 15,
      flexDirection: 'row', alignItems: 'center', gap: 13,
    }}>
      <OrgPortrait name={org.name} logoUrl={org.logoUrl} size={52} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text
            numberOfLines={2}
            style={{
              flexShrink: 1,
              fontFamily: SERIF, fontSize: 22,
              color: colors.text, lineHeight: 25.5, letterSpacing: -0.2,
            }}
          >{org.name}</Text>
          {org.verified && <VerifiedTick size={14} />}
        </View>
        <Text style={{
          fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10.5,
          color: colors.textTertiary, letterSpacing: 0.2,
        }}>
          {memberCount.toLocaleString()} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
          {openBallotCount > 0 ? ` · ${openBallotCount} OPEN ${openBallotCount === 1 ? 'BALLOT' : 'BALLOTS'}` : ''}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── section tabs (segmented control per mock 11b) ────────────────────
function SectionTabs({ active, onChange, isAdmin, hasSubOrgs }: { active: TabType; onChange: (t: TabType) => void; isAdmin: boolean; hasSubOrgs: boolean }) {
  const { colors } = useTheme();
  const tabs: Array<{ key: TabType; label: string }> = [
    { key: 'proposals',     label: 'Proposals' },
    { key: 'members',       label: 'Members' },
    { key: 'announcements', label: 'Notices' },
  ];
  if (hasSubOrgs) tabs.push({ key: 'subOrders', label: 'Sub-orgs' });
  if (isAdmin) {
    tabs.push({ key: 'insights', label: 'Insights' });
    tabs.push({ key: 'settings', label: 'Settings' });
  }
  return (
    <View style={{ paddingHorizontal: SPACING.screenPadding, marginBottom: 15 }}>
      <View style={{
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1, borderColor: colors.borderSubtle,
        borderRadius: 13, padding: 3,
      }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {tabs.map((t) => {
            const isActive = t.key === active;
            return (
              <TouchableOpacity
                key={t.key}
                activeOpacity={0.7}
                onPress={() => { Haptics.selectionAsync(); onChange(t.key); }}
                style={{
                  height: 36, minWidth: 96,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  backgroundColor: isActive ? colors.surfaceHighlight : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{
                  fontSize: 13,
                  fontFamily: isActive ? FONTS.sansSemiBold : FONTS.sansMedium,
                  color: isActive ? colors.text : colors.textTertiary,
                }}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
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
// "2D 6H LEFT" per mock 11b.
function timeLeftShort(deadline?: string | null): string {
  if (!deadline) return '';
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  if (ms <= 0) return 'CLOSING';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}D ${h}H LEFT`;
  if (h > 0) return `${h}H ${m}M LEFT`;
  return `${Math.max(1, m)}M LEFT`;
}

function FilterChip({ children, active, onPress }: { children: React.ReactNode; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={{
      paddingHorizontal: 12, paddingVertical: 7,
      borderWidth: 1, borderColor: active ? colors.gold : colors.border,
      backgroundColor: active ? colors.goldSurface : 'transparent',
      borderRadius: RADIUS.chip, marginRight: 6,
    }}>
      <Text style={{
        fontSize: 12, fontFamily: FONTS.sansMedium,
        color: active ? colors.gold : colors.textSecondary,
        fontVariant: ['tabular-nums'],
      }}>{children}</Text>
    </TouchableOpacity>
  );
}

function ProposalsEmpty() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: SPACING.screenPadding }}>
      <View style={{
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card,
        paddingHorizontal: 24, paddingVertical: 36,
        alignItems: 'center',
      }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.surfaceHighlight,
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Ionicons name="document-text-outline" size={24} color={colors.gold} />
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 19, color: colors.text, letterSpacing: -0.1, marginBottom: 6 }}>
          No proposals yet
        </Text>
        <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: colors.textSecondary, lineHeight: 18, textAlign: 'center', maxWidth: 260 }}>
          The first proposal from your group will appear here.
        </Text>
      </View>
    </View>
  );
}

function ProposalsSection({ proposals, onPress }: { proposals: OrganizationProposal[]; onPress: (p: OrganizationProposal) => void }) {
  const { colors } = useTheme();
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

  return (
    <View>
      <View style={{ paddingHorizontal: SPACING.screenPadding, paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <FilterChip active={filter === 'all'} onPress={() => setFilter('all')}>All · {counts.all}</FilterChip>
          <FilterChip active={filter === 'open'} onPress={() => setFilter('open')}>Open · {counts.open}</FilterChip>
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: SPACING.screenPadding, gap: 12 }}>
        {visible.map((p, i) => {
          const kind = classifyProposal(p);
          const support = p.supportVotes || 0;
          const oppose = p.opposeVotes || 0;
          const total = support + oppose;
          const isOpen = kind === 'open';
          const supportPct = total > 0 ? Math.round((support / total) * 100) : 0;
          const userVote = (p as any).userVote as ('support' | 'oppose' | null | undefined);
          const closedLabel =
            kind === 'passed' ? 'CLOSED · PASSED' :
            kind === 'failed' ? 'CLOSED · FAILED' :
            'CLOSED';
          return (
            <Animated.View key={String(p.id)} entering={FadeInUp.delay(i * 40).duration(300)}>
              <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(p)}>
                <View style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1, borderColor: colors.borderSubtle,
                  borderRadius: RADIUS.card,
                  paddingHorizontal: 18, paddingVertical: 16,
                  gap: 11,
                }}>
                  {/* status row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {isOpen ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.support }} />
                        <Text numberOfLines={1} style={{
                          fontFamily: FONTS.monoSemiBold, fontSize: 9.5, letterSpacing: 1.14,
                          color: colors.textSecondary,
                        }}>
                          OPEN · CHANGEABLE{p.category ? ` · ${p.category.toUpperCase()}` : ''}
                        </Text>
                      </View>
                    ) : (
                      <Text numberOfLines={1} style={{
                        fontFamily: FONTS.monoSemiBold, fontSize: 9.5, letterSpacing: 1.14,
                        color: colors.textTertiary, flexShrink: 1,
                      }}>
                        {closedLabel}{p.category ? ` · ${p.category.toUpperCase()}` : ''}
                      </Text>
                    )}
                    <Text style={{
                      fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10.5,
                      color: colors.textTertiary, letterSpacing: 0.2,
                    }}>
                      {isOpen ? timeLeftShort(p.deadline) : formatShortDateUpper(p.deadline || p.createdAt)}
                    </Text>
                  </View>

                  {/* title + description */}
                  <Text numberOfLines={3} style={{
                    fontFamily: SERIF, fontSize: 16.5,
                    color: isOpen ? colors.text : colors.textSecondary,
                    letterSpacing: -0.1, lineHeight: 21.5,
                  }}>
                    {p.title}
                  </Text>
                  {isOpen && !!p.description && (
                    <Text numberOfLines={2} style={{
                      fontFamily: FONTS.sans, fontSize: 12.5, color: colors.textSecondary,
                      lineHeight: 17.5, marginTop: -4,
                    }}>
                      {p.description}
                    </Text>
                  )}

                  {/* tally */}
                  {isOpen ? (
                    <TallyBar supportCount={support} opposeCount={oppose} variant="compact" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      {total > 0 ? (
                        <Text style={{
                          fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10,
                          color: colors.support, letterSpacing: 0.5,
                        }}>
                          SUPPORT {supportPct}% · {total.toLocaleString()} {total === 1 ? 'BALLOT' : 'BALLOTS'}
                        </Text>
                      ) : (
                        <Text style={{
                          fontFamily: MONO, fontSize: 10, color: colors.textTertiary, letterSpacing: 0.5,
                        }}>
                          NO BALLOTS RECORDED
                        </Text>
                      )}
                      <Text style={{ fontFamily: MONO, fontSize: 10, color: colors.textTertiary, letterSpacing: 0.5 }}>
                        ON LEDGER →
                      </Text>
                    </View>
                  )}

                  {/* the user's committed ballot — gold, changeable while open */}
                  {isOpen && (userVote === 'support' || userVote === 'oppose') && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.gold} />
                      <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11.5, color: colors.gold }}>
                        Your ballot: {userVote === 'support' ? 'Support' : 'Oppose'} · changeable while open
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Settings section ─────────────────────────────────────────────────
function SettingsRow({ label, value, mono, gold, onPress, action }: {
  label: string; value: string; mono?: boolean; gold?: boolean; onPress?: () => void; action?: string;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity activeOpacity={onPress ? 0.6 : 1} onPress={onPress} disabled={!onPress} style={{
      paddingHorizontal: 16, paddingVertical: 13,
      borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 9, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 3 }}>
          {label}
        </Text>
        <Text numberOfLines={1} style={{
          fontFamily: mono ? MONO : FONTS.sansMedium,
          fontSize: mono ? 12 : 13.5,
          color: gold ? colors.gold : colors.text,
          ...(mono ? { fontVariant: ['tabular-nums'] as any, letterSpacing: 0.5 } : {}),
        }}>{value}</Text>
      </View>
      {action && (
        <Text style={{ fontSize: 9, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textTertiary }}>
          {action}
        </Text>
      )}
      {onPress && <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

function SettingsCardHeader({ title, danger }: { title: string; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{
      paddingHorizontal: 16, paddingVertical: 9,
      borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
      backgroundColor: colors.surfaceElevated,
    }}>
      <Text style={{
        fontSize: 10.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.47,
        textTransform: 'uppercase',
        color: danger ? colors.error : colors.textTertiary,
      }}>{title}</Text>
    </View>
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
  const { colors } = useTheme();
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
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card, overflow: 'hidden', marginBottom: 14 }}>
      <SettingsCardHeader title="Verification" />
      <View style={{
        paddingHorizontal: 16, paddingVertical: 13,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 9, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 3 }}>
            Require verification
          </Text>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: colors.text, lineHeight: 18 }}>
            Members must complete identity check before voting.
          </Text>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: colors.textTertiary, marginTop: 4, lineHeight: 15 }}>
            {isUnlocked
              ? 'Verification covered for your members at no per-vote cost.'
              : 'Pro plan or higher · One-time unlock fee.'}
          </Text>
          {unlockedCaption && (
            <Text style={{ fontSize: 11, color: colors.gold, marginTop: 4, fontFamily: MONO, fontVariant: ['tabular-nums'], letterSpacing: 0.3 }}>
              {unlockedCaption}
            </Text>
          )}
        </View>
        {savingToggle ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.surfaceHighlight, true: colors.goldFill }}
            thumbColor="#FFF"
          />
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
  const { colors } = useTheme();
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
    <View style={{ paddingHorizontal: SPACING.screenPadding }}>
      {/* active invite code panel */}
      <View style={{
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.borderSubtle,
        borderRadius: RADIUS.card, marginBottom: 16,
      }}>
        <View style={{ paddingHorizontal: 18, paddingTop: 15, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <Text style={{
              fontSize: 10.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.47,
              textTransform: 'uppercase', color: colors.textTertiary,
            }}>Active invite code</Text>
            {expRoman && (
              <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary }}>EXPIRES {expRoman.toUpperCase()}</Text>
            )}
          </View>
          <View style={{
            marginVertical: 10, paddingVertical: 15,
            backgroundColor: colors.backgroundSecondary,
            borderWidth: 1, borderColor: colors.borderSubtle,
            borderRadius: RADIUS.md,
            alignItems: 'center',
          }}>
            <Text style={{
              fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 22,
              color: colors.text, letterSpacing: 4, textAlign: 'center',
            }}>{codeText.replace(/(.{4})/g, '$1·').replace(/·$/, '')}</Text>
          </View>
          <Text style={{
            fontFamily: FONTS.sans, fontSize: 12, color: colors.textTertiary,
            textAlign: 'center', marginBottom: 12, lineHeight: 17,
          }}>Anyone with this code can join your organization.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity activeOpacity={0.75} onPress={() => onCopy(codeText)} style={{
              flex: 1, height: 44,
              backgroundColor: colors.goldFill,
              borderRadius: RADIUS.button,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Ionicons name="copy-outline" size={13} color="#040707" />
              <Text style={{ fontSize: 13, fontFamily: FONTS.sansSemiBold, color: '#040707' }}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.75} onPress={onGenerate} disabled={generating} style={{
              flex: 1, height: 44,
              borderWidth: 1, borderColor: colors.border,
              backgroundColor: colors.surfaceElevated,
              borderRadius: RADIUS.button,
              alignItems: 'center', justifyContent: 'center',
              opacity: generating ? 0.6 : 1,
            }}>
              {generating
                ? <ActivityIndicator size="small" color={colors.textSecondary} />
                : <Text style={{ fontSize: 13, fontFamily: FONTS.sansSemiBold, color: colors.text }}>New Code</Text>
              }
            </TouchableOpacity>
          </View>
          {activeCode?.code && (
            <TouchableOpacity onPress={() => onRevoke(codeText)} style={{ marginTop: 12, alignSelf: 'center' }}>
              <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: colors.textTertiary, textDecorationLine: 'underline' }}>
                Revoke this code
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Organization details */}
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card, overflow: 'hidden', marginBottom: 14 }}>
        <SettingsCardHeader title="Organization details" />
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
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card, overflow: 'hidden', marginBottom: 14 }}>
        <SettingsCardHeader title="Members & roles" />
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
        <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card, overflow: 'hidden', marginBottom: 14 }}>
          <SettingsCardHeader title="Reports & exports" />
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
      <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card, overflow: 'hidden', marginBottom: 14 }}>
        <SettingsCardHeader title="Manage" danger />
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
  const { colors } = useTheme();
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
          <Stop offset="0%" stopColor={colors.gold} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={colors.gold} stopOpacity={0} />
        </SvgLinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <Line key={t} x1={0} y1={h * t} x2={w} y2={h * t} stroke={colors.border} strokeWidth={0.5} strokeDasharray="1 3" />
      ))}
      <Path d={area} fill={`url(#${gradId})`} />
      <Path d={path} fill="none" stroke={colors.gold} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <Circle key={i} cx={p[0]} cy={p[1]} r={i === pts.length - 1 ? 2.4 : 1.2} fill={i === pts.length - 1 ? colors.gold : colors.goldDark} />
      ))}
    </Svg>
  );
}

function InsightsSection({ insights, subOrgs, loading, sealedAt }: { insights: OrgInsights | null; subOrgs: any[]; loading: boolean; sealedAt: string }) {
  const { colors } = useTheme();
  if (loading && !insights) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={colors.gold} />
      </View>
    );
  }
  if (!insights) {
    return (
      <View style={{ paddingHorizontal: SPACING.screenPadding, paddingVertical: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: FONTS.serifItalic, fontSize: 14, color: colors.textSecondary }}>
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
    <View style={{ paddingHorizontal: SPACING.screenPadding }}>
      {/* summary header */}
      <View style={{
        marginBottom: 14,
        paddingHorizontal: 16, paddingVertical: 12,
        borderWidth: 1, borderColor: colors.borderSubtle,
        backgroundColor: colors.surface,
        borderRadius: RADIUS.card,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 3 }}>This quarter</Text>
          <Text style={{ fontFamily: SERIF, fontSize: 15, color: colors.text }}>
            {quarter} {new Date().getFullYear()}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 10.5, color: colors.textTertiary }}>Updated</Text>
          <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10.5, color: colors.textSecondary }}>{sealedRoman || formatRomanDate(new Date().toISOString())}</Text>
        </View>
      </View>

      {/* recent activity chart */}
      <View style={{
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle,
        borderRadius: RADIUS.card, padding: 16, paddingBottom: 18, marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: colors.textSecondary }}>Recent activity</Text>
          <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, letterSpacing: 0.5 }}>
            LAST {insights.periodDays} DAYS
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.monoSemiBold, fontVariant: ['tabular-nums'], fontSize: 32, color: colors.text, letterSpacing: -0.5, lineHeight: 38, marginBottom: 4 }}>
          {totalVotes.toLocaleString()}
        </Text>
        <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, letterSpacing: 0.3, marginBottom: 12 }}>
          {(insights.totalProposals || 0).toLocaleString()} PROPOSALS · {(insights.totalMembers || 0).toLocaleString()} {insights.totalMembers === 1 ? 'MEMBER' : 'MEMBERS'}
        </Text>
        {series.length > 0 ? (
          <>
            <LineChart data={series} w={300} h={96} gradId="chart-act" />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingHorizontal: 2 }}>
              {seriesLabels.filter((_, i) => i % Math.ceil(seriesLabels.length / 12) === 0).map((m, i) => (
                <Text key={i} style={{ fontFamily: MONO, fontSize: 8, color: colors.textTertiary, letterSpacing: 1 }}>{m}</Text>
              ))}
            </View>
          </>
        ) : (
          <View style={{ height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: MONO, fontSize: 9, color: colors.textTertiary, letterSpacing: 1.4, textTransform: 'uppercase' }}>
              No activity recorded in this period
            </Text>
          </View>
        )}
      </View>

      {/* 2-up: participation ring + quorum bar */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={{
          flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle,
          borderRadius: RADIUS.card, padding: 14,
        }}>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: colors.textSecondary }}>Participation</Text>
          <Text style={{ fontFamily: FONTS.monoSemiBold, fontVariant: ['tabular-nums'], fontSize: 24, color: colors.text, letterSpacing: -0.3, lineHeight: 30, marginTop: 6 }}>
            {participationDisplay.split('.')[0]}
            <Text style={{ fontSize: 15, color: colors.textTertiary }}>.{participationDisplay.split('.')[1] || '0'}%</Text>
          </Text>
          <View style={{ marginTop: 10, height: 56, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={56} height={56} viewBox="0 0 56 56">
              <Circle cx={28} cy={28} r={ringR} fill="none" stroke={colors.borderStrong} strokeWidth={2} />
              <Circle
                cx={28} cy={28} r={ringR} fill="none" stroke={colors.gold} strokeWidth={2}
                strokeDasharray={`${ringFilled} ${circ - ringFilled}`}
                strokeDashoffset={0}
                transform="rotate(-90 28 28)"
                strokeLinecap="butt"
              />
              <Circle cx={28} cy={28} r={17} fill="none" stroke={colors.goldDark} strokeWidth={0.4} strokeDasharray="1 2" />
            </Svg>
          </View>
          <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, textAlign: 'center', marginTop: 6, letterSpacing: 0.3 }}>
            {totalVotes} OF {totalMembers} {totalMembers === 1 ? 'MEMBER' : 'MEMBERS'}
          </Text>
        </View>
        <View style={{
          flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle,
          borderRadius: RADIUS.card, padding: 14,
        }}>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: colors.textSecondary }}>Quorum</Text>
          <Text style={{ fontFamily: SERIF, fontSize: 24, color: quorumMet ? colors.support : colors.textSecondary, letterSpacing: -0.3, lineHeight: 30, marginTop: 6 }}>
            {quorumMet ? 'Met' : 'Below'}
          </Text>
          <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textSecondary, marginTop: 4, letterSpacing: 0.3 }}>
            {quorumThreshold} REQUIRED
          </Text>
          <View style={{ marginTop: 12, height: 6, backgroundColor: colors.surfaceHighlight, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
            <View style={{
              position: 'absolute', top: 0, bottom: 0, left: 0,
              width: `${Math.min(100, quorumPct * 2)}%`,
              backgroundColor: colors.goldFill,
            }} />
            <View style={{
              position: 'absolute', top: -3, bottom: -3, left: '50%',
              width: 1, backgroundColor: quorumMet ? colors.support : colors.textTertiary,
            }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <Text style={{ fontFamily: MONO, fontSize: 8.5, color: colors.textTertiary }}>0%</Text>
            <Text style={{ fontFamily: MONO, fontSize: 8.5, color: quorumMet ? colors.support : colors.textTertiary }}>50% needed</Text>
            <Text style={{ fontFamily: MONO, fontSize: 8.5, color: colors.textTertiary }}>100%</Text>
          </View>
        </View>
      </View>

      {/* ward distribution (uses subOrgs as wards when present) */}
      {showWardTable && (
        <View style={{
          backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSubtle,
          borderRadius: RADIUS.card, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 8, marginBottom: 12,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: colors.textSecondary }}>Members by sub-org</Text>
            <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 8, color: colors.textTertiary, letterSpacing: 1.4 }}>
              {String(wardData.length).padStart(2, '0')} OF {String(subOrgs.length || wardData.length).padStart(2, '0')}
            </Text>
          </View>
          {wardData.map((r: any, i: number) => (
            <View key={i} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 7,
              borderBottomWidth: i < wardData.length - 1 ? 1 : 0, borderBottomColor: colors.borderSubtle,
            }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.sansMedium, fontSize: 12, color: colors.text }}>
                {r.ward}
              </Text>
              <View style={{ width: 60, height: 3, backgroundColor: colors.surfaceHighlight, borderRadius: 1.5, position: 'relative', overflow: 'hidden' }}>
                <View style={{
                  position: 'absolute', top: 0, bottom: 0, left: 0,
                  width: `${Math.min(100, (r.pct / 22) * 100)}%`,
                  backgroundColor: colors.goldFill,
                }} />
              </View>
              <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 9.5, color: colors.text, width: 28, textAlign: 'right' }}>
                {r.n}
              </Text>
              <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 8.5, color: colors.textTertiary, letterSpacing: 1, width: 36, textAlign: 'right' }}>
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
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: SPACING.screenPadding }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <Text style={{ fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 10.5, color: colors.textTertiary, letterSpacing: 0.3 }}>
          {subOrgs.length} {subOrgs.length === 1 ? 'SUB-ORG' : 'SUB-ORGS'} · {totalMembers.toLocaleString()} TOTAL MEMBERS
        </Text>
      </View>
      <View style={{ gap: 10 }}>
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
                backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.borderSubtle,
                borderRadius: RADIUS.card,
                paddingHorizontal: 16, paddingVertical: 13,
                flexDirection: 'row', alignItems: 'center', gap: 12,
              }}
            >
              <View style={{
                width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                backgroundColor: colors.surfaceHighlight,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: FONTS.serifSemiBold, fontSize: 15, color: colors.text }}>
                  {monogram}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{
                  fontFamily: FONTS.sansSemiBold, fontSize: 14,
                  color: colors.text, lineHeight: 18, marginBottom: 3,
                }}>{c.name || 'Untitled sub-org'}</Text>
                <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, letterSpacing: 0.3 }}>
                  {memberCount} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'} · FOUNDED {founded.toUpperCase()}
                </Text>
              </View>
              <Pill kind={status === 'forming' ? 'forming' : 'active'}>
                {status === 'forming' ? 'forming' : 'active'}
              </Pill>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
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
  const { colors } = useTheme();
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
      <View style={{ paddingHorizontal: SPACING.screenPadding, paddingBottom: 12 }}>
        <View style={{
          position: 'relative',
          backgroundColor: colors.surface,
          borderWidth: 1, borderColor: colors.borderSubtle,
          borderRadius: RADIUS.button,
          paddingLeft: 38, paddingRight: 14, height: 46,
          flexDirection: 'row', alignItems: 'center',
        }}>
          <View style={{ position: 'absolute', left: 13, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search" size={14} color={colors.textTertiary} />
          </View>
          <TextInput
            style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 13.5, color: colors.text, paddingVertical: 0 }}
            placeholder="Search members"
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={onSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 11, color: colors.textTertiary }}>
            {totalCount.toLocaleString()}
          </Text>
        </View>

        {isAdmin && (
          <TouchableOpacity
            onPress={onImportRoster}
            activeOpacity={0.7}
            style={{
              marginTop: 10,
              backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.borderSubtle,
              borderRadius: RADIUS.button,
              paddingHorizontal: 14, height: 46,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={colors.gold} />
            <Text style={{ flex: 1, fontFamily: FONTS.sansMedium, fontSize: 13.5, color: colors.text }}>Import members from CSV</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {!showList ? (
        <View style={{ paddingHorizontal: SPACING.screenPadding, paddingVertical: 24, alignItems: 'center' }}>
          <Text style={{ fontFamily: SERIF, fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 6 }}>
            No members yet
          </Text>
          <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 11, color: colors.textTertiary, textAlign: 'center' }}>
            {totalCount > 0 ? `${totalCount.toLocaleString()} ${totalCount === 1 ? 'MEMBER' : 'MEMBERS'}` : ''}
          </Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: SPACING.screenPadding }}>
          <View style={{
            backgroundColor: colors.surface,
            borderWidth: 1, borderColor: colors.borderSubtle,
            borderRadius: RADIUS.card, overflow: 'hidden',
          }}>
            {filtered.map((m, i) => {
              const memberRole = (m.role || 'member').toString().toLowerCase();
              const isAdminRow = memberRole === 'admin';
              const fullName = m.name || m.userName || m.user?.name || 'Unknown member';
              const monogram = monogramFromName(fullName);
              const joined = formatRomanYM(m.joinedAt || m.createdAt || m.created_at);
              return (
                <TouchableOpacity
                  key={m.id || m.userId || i}
                  activeOpacity={isAdmin ? 0.7 : 1}
                  disabled={!isAdmin}
                  onPress={() => onMemberPress(m)}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    borderBottomWidth: i < filtered.length - 1 ? 1 : 0,
                    borderBottomColor: colors.borderSubtle,
                  }}
                >
                  <View style={{
                    width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                    backgroundColor: colors.surfaceHighlight,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: FONTS.serifSemiBold, fontSize: 13, color: isAdminRow ? colors.gold : colors.textSecondary }}>
                      {monogram}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 14, fontFamily: FONTS.sansMedium, color: colors.text, lineHeight: 18 }}>
                      {fullName}
                    </Text>
                    <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, marginTop: 2, letterSpacing: 0.3 }}>
                      JOINED {joined.toUpperCase()}
                    </Text>
                  </View>
                  <RoleChip role={isAdminRow ? 'admin' : 'member'} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Notices (announcements) section ──────────────────────────────────
function AnnouncementsEmpty() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: SPACING.screenPadding }}>
      <View style={{
        backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card,
        paddingHorizontal: 24, paddingVertical: 36,
        alignItems: 'center',
      }}>
        <View style={{
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: colors.surfaceHighlight,
          alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <Ionicons name="megaphone-outline" size={24} color={colors.gold} />
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 18, color: colors.text, letterSpacing: -0.1, marginBottom: 6 }}>
          No notices yet
        </Text>
        <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 240, lineHeight: 18 }}>
          Updates from admins will appear here.
        </Text>
      </View>
    </View>
  );
}

function AnnouncementsSection({ announcements, isAdmin, onDelete }: { announcements: any[]; isAdmin: boolean; onDelete: (id: string, title: string) => void }) {
  const { colors } = useTheme();
  if (!announcements.length) return <AnnouncementsEmpty />;
  return (
    <View style={{ paddingHorizontal: SPACING.screenPadding, gap: 12 }}>
      {announcements.map((d, i) => {
        const date = d.createdAt || d.created_at || d.publishedAt;
        const headline = d.title || d.headline || 'Untitled notice';
        const body = d.content || d.body || '';
        const author = d.authorName || d.author?.name || d.signedBy || '';
        const role = d.authorRole || 'Admin';
        const isMostRecent = i === 0;
        return (
          <View
            key={String(d.id || i)}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.borderSubtle,
              borderRadius: RADIUS.card,
              paddingHorizontal: 18, paddingVertical: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {isMostRecent && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.goldFill }} />
              )}
              <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, letterSpacing: 0.3 }}>
                {formatShortDateUpper(date)}
              </Text>
              {d.pinned && (
                <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 9.5, letterSpacing: 1.14, color: colors.gold }}>· PINNED</Text>
              )}
              {isAdmin && d.id && (
                <TouchableOpacity onPress={() => onDelete(String(d.id), headline)} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="trash-outline" size={13} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={{
              fontFamily: SERIF, fontSize: 16.5,
              color: colors.text, letterSpacing: -0.1, lineHeight: 21.5, marginBottom: 6,
            }}>{headline}</Text>
            {!!body && (
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 8 }}>
                {body}
              </Text>
            )}
            <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: colors.textTertiary }}>
              {author ? `${author} · ${role}` : role}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Bottom sheet wrapper used by both redesigned modals ──────────────
function BottomSheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: colors.surfaceElevated,
        borderTopLeftRadius: RADIUS.modal, borderTopRightRadius: RADIUS.modal,
        borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
        paddingTop: 14,
        paddingBottom: 28 + insets.bottom,
        overflow: 'hidden',
        shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 24,
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: 14 }} />
        {children}
      </View>
    </View>
  );
}

function InviteCodeModal({ visible, onClose, onConfirm, generating }: { visible: boolean; onClose: () => void; onConfirm: (opts: { expiresAt: string; maxUses?: number }) => void; generating: boolean }) {
  const { colors } = useTheme();
  const [validity, setValidity] = useState<'24h' | '07d' | '30d' | '90d'>('30d');
  const [singleUse, setSingleUse] = useState(true);
  if (!visible) return null;
  const VALIDITY_MS: Record<'24h' | '07d' | '30d' | '90d', number> = {
    '24h': 24 * 3600000, '07d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000,
  };
  const generate = () => {
    if (generating) return;
    onConfirm({
      expiresAt: new Date(Date.now() + VALIDITY_MS[validity]).toISOString(),
      maxUses: singleUse ? 1 : undefined,
    });
  };
  return (
    <BottomSheet onClose={onClose}>
      <View style={{ paddingHorizontal: SPACING.screenPadding }}>
        <Text style={{ fontFamily: SERIF, fontSize: 22, color: colors.text, letterSpacing: -0.2, marginBottom: 4 }}>
          Invite members
        </Text>
        <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 16, maxWidth: 320 }}>
          Anyone with this code can join your organization.
        </Text>

        <TouchableOpacity activeOpacity={0.75} onPress={generate} disabled={generating} style={{
          paddingHorizontal: 16, paddingVertical: 18,
          backgroundColor: colors.backgroundSecondary,
          borderWidth: 1, borderColor: colors.borderSubtle,
          borderRadius: RADIUS.md, marginBottom: 14, alignItems: 'center',
        }}>
          <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 8 }}>
            Your new code
          </Text>
          <Text style={{
            fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 18,
            color: colors.text, letterSpacing: 3,
          }}>
            {generating ? 'Generating…' : 'Tap to create'}
          </Text>
        </TouchableOpacity>

        <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 8 }}>Expires after</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {(['24h', '07d', '30d', '90d'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              activeOpacity={0.75}
              onPress={() => { Haptics.selectionAsync(); setValidity(p); }}
              style={{
                flex: 1, paddingVertical: 10, alignItems: 'center',
                borderWidth: 1, borderColor: validity === p ? colors.gold : colors.border,
                backgroundColor: validity === p ? colors.goldSurface : 'transparent',
                borderRadius: RADIUS.sm,
              }}
            >
              <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 11, color: validity === p ? colors.gold : colors.textSecondary, letterSpacing: 0.9 }}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 8 }}>Single use</Text>
        <View style={{
          paddingHorizontal: 14, paddingVertical: 11,
          borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
        }}>
          <Text style={{ fontFamily: FONTS.sans, fontSize: 14, color: colors.text }}>
            One person only
          </Text>
          <Switch
            value={singleUse}
            onValueChange={(v) => { Haptics.selectionAsync(); setSingleUse(v); }}
            trackColor={{ false: colors.surfaceHighlight, true: colors.goldFill }}
            thumbColor="#FFF"
          />
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={{
            flex: 1, height: 48,
            borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.button,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.surface,
          }}>
            <Text style={{ fontSize: 13.5, fontFamily: FONTS.sansSemiBold, color: colors.textSecondary }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={generate}
            disabled={generating}
            style={{
              flex: 1.4, height: 48,
              borderRadius: RADIUS.button, alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.goldFill,
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? (
              <ActivityIndicator size="small" color="#040707" />
            ) : (
              <Text style={{ fontSize: 13.5, fontFamily: FONTS.sansSemiBold, color: '#040707' }}>
                Generate Code
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

function MemberRoleModal({ visible, onClose, member, onConfirm }: { visible: boolean; onClose: () => void; member: any | null; onConfirm: (role: 'admin' | 'member') => void }) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<'admin' | 'member'>('member');
  useEffect(() => {
    if (member) setSelected((member.role || 'member').toLowerCase() === 'admin' ? 'admin' : 'member');
  }, [member?.id, member?.userId, visible]);
  if (!visible || !member) return null;

  const fullName = member.name || member.userName || member.user?.name || 'Member';
  const monogram = monogramFromName(fullName);
  const joined = formatRomanYM(member.joinedAt || member.createdAt || member.created_at);

  const options: Array<{ role: 'admin' | 'member'; label: string; desc: string }> = [
    { role: 'admin',  label: 'Admin',  desc: 'Can manage members, post notices, and edit settings' },
    { role: 'member', label: 'Member', desc: 'Can vote on proposals and view notices' },
  ];

  return (
    <BottomSheet onClose={onClose}>
      <View style={{ paddingHorizontal: SPACING.screenPadding }}>
        {/* member header card */}
        <View style={{
          paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
          borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: RADIUS.card,
          backgroundColor: colors.surface,
          flexDirection: 'row', alignItems: 'center', gap: 12,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 13,
            backgroundColor: colors.surfaceHighlight,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: FONTS.serifSemiBold, fontSize: 16, color: colors.text }}>{monogram}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.textTertiary }}>Edit role</Text>
            <Text numberOfLines={1} style={{ fontFamily: FONTS.sansSemiBold, fontSize: 15, color: colors.text, marginTop: 2 }}>
              {fullName}
            </Text>
            <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, marginTop: 1, letterSpacing: 0.3 }}>
              JOINED {joined.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 10 }}>Choose a role</Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {options.map((opt) => {
            const active = selected === opt.role;
            return (
              <TouchableOpacity
                key={opt.role}
                activeOpacity={0.75}
                onPress={() => { Haptics.selectionAsync(); setSelected(opt.role); }}
                style={{
                  paddingHorizontal: 14, paddingVertical: 12,
                  borderWidth: 1, borderColor: active ? colors.gold : colors.border,
                  backgroundColor: active ? colors.goldSurface : 'transparent',
                  borderRadius: RADIUS.button,
                  flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                }}
              >
                <View style={{
                  width: 14, height: 14, borderRadius: 7,
                  borderWidth: 1, borderColor: active ? colors.gold : colors.borderStrong,
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
                }}>
                  {active && (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.goldFill }} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 9.5, fontFamily: FONTS.sansBold, letterSpacing: 1.8, textTransform: 'uppercase', color: active ? colors.gold : colors.textSecondary, marginBottom: 3 }}>
                    {opt.label}
                  </Text>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 12.5, color: colors.textSecondary, lineHeight: 17 }}>
                    {opt.desc}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={{
            flex: 1, height: 48,
            borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.button,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.surface,
          }}>
            <Text style={{ fontSize: 13.5, fontFamily: FONTS.sansSemiBold, color: colors.textSecondary }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => onConfirm(selected)}
            style={{
              flex: 1.4, height: 48,
              borderRadius: RADIUS.button, alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.goldFill,
            }}
          >
            <Text style={{ fontSize: 13.5, fontFamily: FONTS.sansSemiBold, color: '#040707' }}>
              Save Changes
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
  const { colors } = useTheme();
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

  const handleGenerateInviteCode = async (opts?: { expiresAt?: string; maxUses?: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratingCode(true);
    try {
      const result = await organizationsApi.generateInviteCode(params.orgId, opts);
      if (result.error) { Alert.alert('Error', result.error); return; }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowInviteCodeModal(false);
      const newCode = result.data?.code;
      if (newCode) {
        Clipboard.setString(newCode);
        Alert.alert('Code created', `${newCode}\n\nCopied to your clipboard — send it to your members.`);
      }
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
    Alert.alert('Delete Notice', `Are you sure you want to delete "${title}"?`, [
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
  const openBallotCount = useMemo(
    () => proposals.filter((p) => classifyProposal(p) === 'open').length,
    [proposals]
  );

  // Bottom action stack visibility (mock 11b pins admin actions under the list)
  const showProposalActions = activeTab === 'proposals' && !!organization;
  const showNoticeAction = activeTab === 'announcements' && !!isAdmin;
  const showSubOrgAction = activeTab === 'subOrders' && !!isAdmin;
  const hasBottomActions = showProposalActions || showNoticeAction || showSubOrgAction;
  const bottomActionSpace = showProposalActions && isAdmin ? 190 : 130;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={colors.gold} />
        <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, letterSpacing: 1.4, marginTop: 12, textTransform: 'uppercase' }}>
          Loading
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <TopBar
        isAdmin={!!isAdmin}
        onBack={() => router.back()}
        onOverflow={handleOverflow}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: (hasBottomActions ? bottomActionSpace : 40) + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {organization && (
          <Hero
            org={organization}
            openBallotCount={openBallotCount}
            actualMemberCount={members.length}
          />
        )}

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

      {/* Pinned action stack per mock 11b — replaces the old FABs. */}
      {hasBottomActions && (
        <View style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingHorizontal: SPACING.screenPadding,
          paddingTop: 12, paddingBottom: insets.bottom + 14,
          backgroundColor: colors.background,
          borderTopWidth: 1, borderTopColor: colors.borderSubtle,
          gap: 10,
        }}>
          {showProposalActions && (
            <>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateModal(true); }}
                style={{
                  height: 54, borderRadius: 15,
                  backgroundColor: colors.goldFill,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#040707' }}>New Proposal</Text>
              </TouchableOpacity>
              {isAdmin && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowInviteCodeModal(true); }}
                    style={{
                      flex: 1, height: 48, borderRadius: RADIUS.button,
                      backgroundColor: colors.surface,
                      borderWidth: 1, borderColor: colors.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 13.5, color: colors.text }}>Invite Members</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push({
                        pathname: '/modals/import-roster',
                        params: { orgId: organization?.id ?? '', orgName: organization?.name ?? '' },
                      });
                    }}
                    style={{
                      flex: 1, height: 48, borderRadius: RADIUS.button,
                      backgroundColor: colors.surface,
                      borderWidth: 1, borderColor: colors.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 13.5, color: colors.text }}>Import Roster</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          {showNoticeAction && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAnnouncementModal(true); }}
              style={{
                height: 54, borderRadius: 15,
                backgroundColor: colors.goldFill,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#040707' }}>New Notice</Text>
            </TouchableOpacity>
          )}
          {showSubOrgAction && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCreateSubOrgModal(true); }}
              style={{
                height: 54, borderRadius: 15,
                backgroundColor: colors.goldFill,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#040707' }}>New Sub-org</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Existing Create Proposal modal (preserved, restyled) */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView style={[styles.modalContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.borderSubtle }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Proposal</Text>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: creating ? colors.surfaceHighlight : colors.goldFill }]}
              onPress={handleCreateProposal} disabled={creating}
            >
              {creating ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={styles.modalSubmitBtnText}>Post</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {proposalLimits && (
              <View style={[styles.limitsCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Ionicons name="analytics-outline" size={16} color={colors.gold} />
                <Text style={[styles.limitsText, { color: colors.textSecondary }]}>
                  {proposalLimits.created} of {proposalLimits.limit} proposals this {proposalLimits.period}
                </Text>
              </View>
            )}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="What are you proposing?"
                placeholderTextColor={colors.textTertiary}
                value={newProposal.title}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, title: t }))}
                maxLength={100}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>{newProposal.title.length}/100</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Provide details about your proposal..."
                placeholderTextColor={colors.textTertiary}
                value={newProposal.description}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, description: t }))}
                multiline numberOfLines={6} textAlignVertical="top" maxLength={1000}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>{newProposal.description.length}/1000</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, {
                      backgroundColor: newProposal.category === cat ? colors.goldFill : colors.surface,
                      borderColor: newProposal.category === cat ? colors.goldFill : colors.border,
                    }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewProposal((p) => ({ ...p, category: cat })); }}
                  >
                    <Text style={[styles.categoryChipText, { color: newProposal.category === cat ? '#040707' : colors.textSecondary }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            {/* Vote type picker. Defaults to yes-no for backward compat. */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Ballot type</Text>
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
                        backgroundColor: active ? colors.goldFill : colors.surface,
                        borderColor: active ? colors.goldFill : colors.border,
                        borderWidth: 1,
                        borderRadius: RADIUS.sm,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: active ? '#040707' : colors.textSecondary, fontSize: 12, fontFamily: FONTS.sansSemiBold }}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {newProposal.voteType === 'ranked-choice' && (
                <Text style={{ fontFamily: FONTS.sans, color: colors.textTertiary, fontSize: 11, marginTop: 6, lineHeight: 16 }}>
                  Voters rank options in order of preference. Winner determined by instant-runoff (IRV).
                </Text>
              )}
            </View>

            {/* Options list, shown for non-yes-no ballots. */}
            {newProposal.voteType !== 'yes-no' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>Options</Text>
                {newProposal.options.map((opt, idx) => (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, flex: 1 }]}
                      placeholder={`Option ${idx + 1}`}
                      placeholderTextColor={colors.textTertiary}
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
                        <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {newProposal.options.length < 10 && (
                  <TouchableOpacity
                    onPress={() => setNewProposal((p) => ({ ...p, options: [...p.options, ''] }))}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
                  >
                    <Ionicons name="add-circle-outline" size={16} color={colors.gold} />
                    <Text style={{ color: colors.gold, fontSize: 12, fontFamily: FONTS.sansSemiBold }}>Add option</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {organization?.role === 'admin' && (
              <View style={[styles.officialToggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.officialToggleInfo}>
                  <View style={[styles.officialToggleIcon, { backgroundColor: colors.goldSurfaceStrong }]}>
                    <Ionicons name="ribbon" size={16} color={colors.gold} />
                  </View>
                  <View style={styles.officialToggleText}>
                    <Text style={[styles.officialToggleTitle, { color: colors.text }]}>Official Proposal</Text>
                    <Text style={[styles.officialToggleSubtitle, { color: colors.textSecondary }]}>
                      Mark as an official proposal from {organization?.name}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={newProposal.isOfficial}
                  onValueChange={(v) => setNewProposal((p) => ({ ...p, isOfficial: v }))}
                  trackColor={{ false: colors.surfaceHighlight, true: colors.goldFill }}
                  thumbColor="#FFF"
                />
              </View>
            )}

            {organization?.role === 'admin' && (
              <View style={[styles.officialToggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.officialToggleInfo}>
                  <View style={[styles.officialToggleIcon, { backgroundColor: colors.goldSurfaceStrong }]}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.gold} />
                  </View>
                  <View style={styles.officialToggleText}>
                    <Text style={[styles.officialToggleTitle, { color: colors.text }]}>Citizens only</Text>
                    <Text style={[styles.officialToggleSubtitle, { color: colors.textSecondary }]}>
                      Only voters who verify citizenship (passport + proof of address) can vote
                    </Text>
                  </View>
                </View>
                <Switch
                  value={newProposal.requiresCitizenship}
                  onValueChange={(v) => setNewProposal((p) => ({ ...p, requiresCitizenship: v }))}
                  trackColor={{ false: colors.surfaceHighlight, true: colors.goldFill }}
                  thumbColor="#FFF"
                />
              </View>
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notice composer (preserved announcement modal, restyled per E4) */}
      <Modal visible={showAnnouncementModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAnnouncementModal(false)}>
        <KeyboardAvoidingView style={[styles.modalContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{
            paddingHorizontal: SPACING.screenPadding, paddingTop: 14, paddingBottom: 4,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <TouchableOpacity
              onPress={() => setShowAnnouncementModal(false)}
              activeOpacity={0.7}
              accessibilityLabel="Close"
              style={{
                width: 40, height: 40, borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.borderSubtle,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
            <RoleChip role="admin" />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: SPACING.screenPadding, paddingTop: 10 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: colors.textTertiary,
              textTransform: 'uppercase', marginBottom: 3,
            }}>
              {organization?.name || 'Organization'}
            </Text>
            <Text style={{
              fontFamily: SERIF, fontSize: 28, lineHeight: 31, letterSpacing: -0.34,
              color: colors.text, marginBottom: 18,
            }}>
              New Notice
            </Text>

            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 7 }}>
              Title
            </Text>
            <TextInput
              style={{
                height: 52, borderRadius: 15,
                backgroundColor: colors.surface,
                borderWidth: 1.5, borderColor: newAnnouncement.title ? colors.goldSurfaceIntense : colors.border,
                paddingHorizontal: 16,
                fontFamily: SERIF, fontSize: 15, color: colors.text,
              }}
              placeholder="Notice title"
              placeholderTextColor={colors.textTertiary}
              value={newAnnouncement.title}
              onChangeText={(t) => setNewAnnouncement((p) => ({ ...p, title: t }))}
              maxLength={100}
            />
            <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, textAlign: 'right', marginTop: 5, marginBottom: 14 }}>
              {newAnnouncement.title.length} / 100
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
              <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary }}>
                Message
              </Text>
              <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary }}>
                {newAnnouncement.content.length} / 2000
              </Text>
            </View>
            <TextInput
              style={{
                minHeight: 110, borderRadius: 15,
                backgroundColor: colors.surface,
                borderWidth: 1, borderColor: colors.border,
                paddingHorizontal: 16, paddingVertical: 14,
                fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20, color: colors.text,
                textAlignVertical: 'top',
                marginBottom: 16,
              }}
              placeholder="Write your notice..."
              placeholderTextColor={colors.textTertiary}
              value={newAnnouncement.content}
              onChangeText={(t) => setNewAnnouncement((p) => ({ ...p, content: t }))}
              multiline maxLength={2000}
            />

            <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 7 }}>
              Delivery
            </Text>
            <View style={{
              backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.borderSubtle,
              borderRadius: 15, paddingHorizontal: 16, paddingVertical: 4,
              marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13.5, color: colors.text }}>All members</Text>
                <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 11, color: colors.textSecondary }}>
                  {Math.max(organization?.memberCount ?? 0, members.length).toLocaleString()}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                <View>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13.5, color: colors.text }}>Pin notice</Text>
                  <Text style={{ fontFamily: FONTS.sans, fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>Pinned notices appear at the top</Text>
                </View>
                <Switch
                  value={newAnnouncement.pinned}
                  onValueChange={(v) => setNewAnnouncement((p) => ({ ...p, pinned: v }))}
                  trackColor={{ false: colors.surfaceHighlight, true: colors.goldFill }}
                  thumbColor="#FFF"
                />
              </View>
            </View>

            {/* preview */}
            {(newAnnouncement.title.length > 0 || newAnnouncement.content.length > 0) && (
              <>
                <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 10.5, letterSpacing: 1.47, textTransform: 'uppercase', color: colors.textTertiary, marginBottom: 7 }}>
                  Preview
                </Text>
                <View style={{
                  backgroundColor: colors.backgroundSecondary,
                  borderWidth: 1, borderColor: colors.borderSubtle,
                  borderRadius: RADIUS.button, padding: 13,
                  flexDirection: 'row', gap: 11, alignItems: 'flex-start',
                  marginBottom: 16,
                }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    backgroundColor: colors.surfaceHighlight,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontFamily: FONTS.serifSemiBold, fontSize: 11, color: colors.text }}>
                      {monogramFromName(organization?.name || 'Org')}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: FONTS.sansSemiBold, fontSize: 12.5, color: colors.text }}>
                      {organization?.name || 'Organization'}
                    </Text>
                    <Text numberOfLines={2} style={{ fontFamily: FONTS.sans, fontSize: 11.5, lineHeight: 16, color: colors.textSecondary, marginTop: 1 }}>
                      {[newAnnouncement.title, newAnnouncement.content].filter(Boolean).join(' — ')}
                    </Text>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCreateAnnouncement}
              disabled={creatingAnnouncement}
              style={{
                height: 54, borderRadius: 15,
                backgroundColor: colors.goldFill,
                alignItems: 'center', justifyContent: 'center',
                opacity: creatingAnnouncement ? 0.7 : 1,
                marginBottom: 8,
              }}
            >
              {creatingAnnouncement
                ? <ActivityIndicator size="small" color="#040707" />
                : <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#040707' }}>Publish Notice</Text>
              }
            </TouchableOpacity>
            <Text style={{ fontFamily: FONTS.sans, fontSize: 11.5, color: colors.textTertiary, textAlign: 'center', marginBottom: 40 }}>
              Notices are civic, never promotional — no links out, no fundraising
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Existing Create Sub-org modal (preserved) */}
      <Modal visible={showCreateSubOrgModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateSubOrgModal(false)}>
        <KeyboardAvoidingView style={[styles.modalContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.borderSubtle }]}>
            <TouchableOpacity onPress={() => setShowCreateSubOrgModal(false)} disabled={creatingSubOrg}>
              <Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Sub-org</Text>
            <TouchableOpacity onPress={handleCreateSubOrg} disabled={creatingSubOrg || !newSubOrg.name.trim()}>
              {creatingSubOrg ? <ActivityIndicator size="small" color={colors.gold} /> : <Text style={[styles.modalSubmit, { color: newSubOrg.name.trim() ? colors.gold : colors.textTertiary }]}>Create</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={[styles.modalLabel, { color: colors.textTertiary }]}>Name</Text>
            <TextInput
              value={newSubOrg.name}
              onChangeText={(t) => setNewSubOrg({ ...newSubOrg, name: t })}
              placeholder={`e.g. "Mr. Smith's Class"`}
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              maxLength={80} autoCapitalize="words"
            />
            <Text style={[styles.modalLabel, { color: colors.textTertiary, marginTop: 16 }]}>Type</Text>
            <View style={styles.typeRow}>
              {ORG_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setNewSubOrg({ ...newSubOrg, type: t.value })}
                  style={[styles.typeChip, {
                    backgroundColor: newSubOrg.type === t.value ? colors.goldSurface : colors.surface,
                    borderColor: newSubOrg.type === t.value ? colors.gold : colors.border,
                  }]}
                >
                  <Text style={{ fontFamily: FONTS.sansMedium, color: newSubOrg.type === t.value ? colors.gold : colors.textSecondary, fontSize: 12 }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalLabel, { color: colors.textTertiary, marginTop: 16 }]}>Description (optional)</Text>
            <TextInput
              value={newSubOrg.description}
              onChangeText={(t) => setNewSubOrg({ ...newSubOrg, description: t })}
              placeholder="What's this sub-org for?"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, styles.modalInputMultiline, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              multiline maxLength={300}
            />
            <Text style={[styles.adminEmptyText, { color: colors.textTertiary, marginTop: 16 }]}>
              Sub-organizations get their own invite code, member roster, and proposal feed. Members of the sub-org are also effective members of {organization?.name || 'this organization'}.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Redesigned interaction modals */}
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
  modalTitle: { fontSize: 19, fontFamily: FONTS.serif },
  modalSubmitBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.chip },
  modalSubmitBtnText: { color: '#040707', fontFamily: FONTS.sansSemiBold, fontSize: 13 },
  modalContent: { flex: 1, padding: 16 },
  modalCancel: { fontSize: 14, fontFamily: FONTS.sansMedium },
  modalSubmit: { fontSize: 14, fontFamily: FONTS.sansSemiBold },
  modalLabel: { fontSize: 10.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.47, textTransform: 'uppercase', marginBottom: 7 },
  modalInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: FONTS.sans },
  modalInputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  limitsCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
  limitsText: { fontSize: 12, fontFamily: FONTS.sans },
  inputGroup: { marginBottom: 18 },
  inputLabel: { fontSize: 10.5, fontFamily: FONTS.sansSemiBold, letterSpacing: 1.47, textTransform: 'uppercase', marginBottom: 7 },
  textInput: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: FONTS.sans },
  textArea: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, fontFamily: FONTS.sans, minHeight: 110 },
  charCount: { fontSize: 10, textAlign: 'right', marginTop: 4, fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], letterSpacing: 0.5 },
  categoryScroll: { flexDirection: 'row' },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.chip, borderWidth: 1, marginRight: 6 },
  categoryChipText: { fontSize: 12, fontFamily: FONTS.sansMedium },
  officialToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  officialToggleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  officialToggleIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  officialToggleText: { flex: 1 },
  officialToggleTitle: { fontSize: 14, fontFamily: FONTS.sansSemiBold },
  officialToggleSubtitle: { fontSize: 11, marginTop: 2, fontFamily: FONTS.sans },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.chip, borderWidth: 1 },
  adminEmptyText: { fontSize: 11, lineHeight: 16, fontFamily: FONTS.sans },
});

// Exports for sibling section files (in case we extract later)
export { O_GOLD, O_GOLD_D, O_GOLD_L, O_BG, O_BG_CARD, O_BG_RAISED, O_LINE, O_LINE_STRONG, O_FG, O_FG_MUTED, O_FG_FAINT, O_GREEN, O_RED, SERIF, MONO };
