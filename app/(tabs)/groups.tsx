import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect, Defs, Pattern, G } from 'react-native-svg';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, Organization } from '../../lib/api';

// ─── design tokens (matches PassportCard / Identity surface) ──────────
const G_GOLD = '#EABA58';
const G_GOLD_D = '#C89A3E';
const G_GOLD_L = '#F4D28C';
const G_BG = '#040707';
const G_BG_CARD = '#0D0F12';
const G_BG_RAISED = '#15181C';
const G_LINE = '#1E2228';
const G_LINE_STRONG = '#2A2F37';
const G_FG = '#F4F5F6';
const G_FG_MUTED = '#C7CACD';
const G_FG_FAINT = '#8E9297';
const G_GREEN = '#34C759';

const SERIF = 'Georgia';
const MONO = 'JetBrainsMono-Regular';

// ─── helpers ──────────────────────────────────────────────────────────
function toRomanNumeral(num: number): string {
  const lookup: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  let n = num;
  for (const [value, numeral] of lookup) {
    while (n >= value) { result += numeral; n -= value; }
  }
  return result;
}

function formatRomanYearMonth(iso?: string | null): string {
  if (!iso) return 'MMXXVI';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'MMXXVI';
  return `${toRomanNumeral(d.getMonth() + 1)}·${toRomanNumeral(d.getFullYear())}`;
}

function folioFromOrg(name: string, id: string): string {
  const safeName = name || '';
  const safeId = id ? String(id) : '';
  const initials = safeName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 3) || 'ORG';
  let hash = 0;
  for (let i = 0; i < safeId.length; i++) hash = (hash * 31 + safeId.charCodeAt(i)) >>> 0;
  const num = (hash % 9000) + 1000;
  return `FOLIO·${initials}·${num}`;
}

function monogramFromName(name: string): string {
  const parts = (name || '').split(/\s+/).filter(Boolean);
  if (!parts.length) return 'O';
  return parts[0][0].toUpperCase();
}

// ─── atoms ────────────────────────────────────────────────────────────
function Guilloche({ opacity = 0.07, color = G_GOLD, id = 'gguil' }: { opacity?: number; color?: string; id?: string }) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
      preserveAspectRatio="none"
      viewBox="0 0 400 260"
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={id} x={0} y={0} width={40} height={40} patternUnits="userSpaceOnUse">
          <Path d="M 0 20 Q 10 0, 20 20 T 40 20" stroke={color} fill="none" strokeWidth={0.5} />
          <Path d="M 0 20 Q 10 40, 20 20 T 40 20" stroke={color} fill="none" strokeWidth={0.5} />
        </Pattern>
      </Defs>
      <Rect width={400} height={260} fill={`url(#${id})`} />
    </Svg>
  );
}

function CornerTicks({ color = G_GOLD, size = 8, weight = 1.2 }: { color?: string; size?: number; weight?: number }) {
  return (
    <>
      <View pointerEvents="none" style={{
        position: 'absolute', top: -1, left: -1, width: size, height: size,
        borderTopWidth: weight, borderLeftWidth: weight, borderColor: color,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', top: -1, right: -1, width: size, height: size,
        borderTopWidth: weight, borderRightWidth: weight, borderColor: color,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', bottom: -1, left: -1, width: size, height: size,
        borderBottomWidth: weight, borderLeftWidth: weight, borderColor: color,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', bottom: -1, right: -1, width: size, height: size,
        borderBottomWidth: weight, borderRightWidth: weight, borderColor: color,
      }} />
    </>
  );
}

function GEyebrow({ children, color = G_FG_FAINT, style }: { children: React.ReactNode; color?: string; style?: any }) {
  return (
    <Text style={[{
      fontSize: 9.5,
      fontWeight: '600',
      letterSpacing: 2,
      textTransform: 'uppercase',
      color,
    }, style]}>{children}</Text>
  );
}

function VerifiedTick({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={6.4} fill="rgba(52,199,89,0.12)" stroke={G_GREEN} strokeWidth={0.6} />
      <Path d="M4.2 7.2l2 2 3.6-4" stroke={G_GREEN} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function RoleInsignia({ role }: { role: 'admin' | 'member' }) {
  const isAdmin = role === 'admin';
  const accent = isAdmin ? G_GOLD : G_FG_MUTED;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 8, paddingVertical: 4,
      borderWidth: 1, borderColor: isAdmin ? G_GOLD_D : G_LINE_STRONG,
      backgroundColor: isAdmin ? 'rgba(234,186,88,0.06)' : 'transparent',
      borderRadius: 3, alignSelf: 'flex-start',
    }}>
      <Svg width={11} height={11} viewBox="0 0 12 12">
        <Circle cx={6} cy={6} r={5.2} fill="none" stroke={accent} strokeWidth={0.5} />
        <Circle
          cx={6} cy={6} r={3.5} fill="none" stroke={accent} strokeWidth={0.4}
          strokeDasharray={isAdmin ? '0' : '0.8 1.6'}
        />
        {isAdmin
          ? <Path d="M3.5 6l1.7 1.8L8.5 4.4" stroke={accent} strokeWidth={0.9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          : <Circle cx={6} cy={6} r={1} fill={accent} />
        }
      </Svg>
      <Text style={{
        fontSize: 9, fontWeight: '600', letterSpacing: 1.6,
        textTransform: 'uppercase', color: accent,
      }}>{isAdmin ? 'Admin' : 'Member'}</Text>
    </View>
  );
}

function TierMark({ tier }: { tier: Organization['tier'] }) {
  const isPro = tier === 'professional';
  const label = isPro ? 'PROFESSIONAL' : 'COMMUNITY';
  const color = isPro ? G_GOLD : G_FG_MUTED;
  const line = isPro ? G_GOLD_D : G_LINE_STRONG;
  return (
    <View style={{
      paddingHorizontal: 6, paddingVertical: 2,
      borderWidth: 1, borderColor: line, borderRadius: 2,
      alignSelf: 'flex-start',
    }}>
      <Text style={{
        fontFamily: MONO, fontSize: 8.5, fontWeight: '500',
        letterSpacing: 1.5, color,
      }}>{label}</Text>
    </View>
  );
}

function OrgSigil({ name, logoUrl, tier }: { name: string; logoUrl?: string; tier: Organization['tier'] }) {
  const isPro = tier === 'professional';
  const monogram = monogramFromName(name);
  return (
    <View style={{
      width: 56, height: 56,
      borderWidth: 1, borderColor: isPro ? G_GOLD_D : G_LINE_STRONG,
      backgroundColor: '#0A0C0F',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', flexShrink: 0,
    }}>
      <CornerTicks color={isPro ? G_GOLD : G_FG_FAINT} size={6} weight={1} />
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={{ width: 44, height: 44 }} resizeMode="contain" />
      ) : (
        <Text style={{
          fontFamily: SERIF, fontSize: 24, fontWeight: '500', fontStyle: 'italic',
          color: isPro ? G_GOLD_L : G_FG_MUTED, letterSpacing: -0.5,
        }}>{monogram}</Text>
      )}
    </View>
  );
}

// ─── header ───────────────────────────────────────────────────────────
function GHeader({ stat, admins, onAddPress, insetTop }: { stat: number; admins: number; onAddPress: () => void; insetTop: number }) {
  const padded = (n: number) => n.toString().padStart(2, '0');
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ paddingTop: insetTop + 8, paddingHorizontal: 24, paddingBottom: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 6, height: 6, borderRadius: 3, backgroundColor: G_GREEN, marginRight: 8,
            shadowColor: G_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 3,
          }} />
          <GEyebrow>Chartered orders · in good standing</GEyebrow>
        </View>
        <Text style={{ fontFamily: MONO, fontSize: 9.5, color: G_FG_FAINT, letterSpacing: 0.8 }}>SECTION III</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <Text style={{
          fontFamily: SERIF, fontSize: 44, fontWeight: '500',
          letterSpacing: -1, lineHeight: 44, color: G_FG, flex: 1,
        }}>
          My{' '}
          <Text style={{ fontStyle: 'italic', color: G_GOLD_L, fontWeight: '400' }}>organizations</Text>
        </Text>
        <TouchableOpacity
          onPress={onAddPress}
          activeOpacity={0.7}
          style={{
            width: 42, height: 42, borderRadius: 21,
            backgroundColor: 'rgba(234,186,88,0.08)',
            borderWidth: 1, borderColor: G_GOLD_D,
            alignItems: 'center', justifyContent: 'center',
            marginTop: 4,
            shadowColor: G_GOLD, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1, shadowRadius: 12,
          }}
        >
          <Ionicons name="add" size={18} color={G_GOLD} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ fontFamily: MONO, fontSize: 10, color: G_FG_MUTED, letterSpacing: 1.4 }}>
          ORGANIZATIONS · <Text style={{ color: G_FG }}>{padded(stat)}</Text>
        </Text>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: G_FG_FAINT, opacity: 0.6 }} />
        <Text style={{ fontFamily: MONO, fontSize: 10, color: G_FG_MUTED, letterSpacing: 1.4 }}>
          ADMIN ROLES · <Text style={{ color: G_GOLD }}>{padded(admins)}</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── ORG CARD ─────────────────────────────────────────────────────────
function OrgCard({ org, onPress, index }: { org: Organization; onPress: () => void; index: number }) {
  const isPro = org.tier === 'professional';
  const folio = folioFromOrg(org.name, org.id);
  const joined = formatRomanYearMonth(org.createdAt);
  const role: 'admin' | 'member' = org.role === 'admin' ? 'admin' : 'member';
  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(400)}>
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        <View style={{
          position: 'relative',
          borderRadius: 18,
          borderWidth: 1, borderColor: isPro ? G_LINE_STRONG : G_LINE,
          overflow: 'hidden',
          shadowColor: '#000', shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.4, shadowRadius: 36, elevation: 8,
        }}>
          <LinearGradient
            colors={isPro ? ['#14171C', '#0B0D10'] : ['#10131A', '#0B0D10']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          {isPro && (
            <LinearGradient
              colors={['rgba(234,186,88,0.06)', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 0.55 }}
            />
          )}
          {isPro && <Guilloche opacity={0.05} id={`g-${org.id}`} />}

          {/* main row */}
          <View style={{
            paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
            flexDirection: 'row', gap: 14, alignItems: 'flex-start',
            borderBottomWidth: 1, borderBottomColor: G_LINE,
          }}>
            <OrgSigil name={org.name} logoUrl={org.logoUrl} tier={org.tier} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <GEyebrow style={{ fontSize: 8.5, letterSpacing: 1.7 }}>Registered</GEyebrow>
                {org.verified && <VerifiedTick size={11} />}
              </View>
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: SERIF, fontSize: 19, fontWeight: '500',
                  color: G_FG, lineHeight: 21, letterSpacing: -0.2,
                  marginBottom: 6,
                }}
              >
                {org.name || 'Unnamed Organization'}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  fontSize: 11.5, color: G_FG_MUTED,
                  letterSpacing: -0.05, lineHeight: 16,
                }}
              >
                {org.description || ''}
              </Text>
            </View>
          </View>

          {/* register strip */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1.2, paddingHorizontal: 14, paddingVertical: 11, borderRightWidth: 1, borderRightColor: G_LINE }}>
              <GEyebrow style={{ fontSize: 8.5, letterSpacing: 1.5, marginBottom: 4 }}>Members</GEyebrow>
              <Text style={{
                fontFamily: SERIF, fontSize: 15, fontStyle: 'italic',
                color: G_FG, letterSpacing: -0.05, lineHeight: 16,
              }}>
                {(org.memberCount ?? 0).toLocaleString()} registered
              </Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 11, borderRightWidth: 1, borderRightColor: G_LINE }}>
              <GEyebrow style={{ fontSize: 8.5, letterSpacing: 1.5, marginBottom: 4 }}>Joined</GEyebrow>
              <Text style={{
                fontFamily: MONO, fontSize: 11, color: G_FG, letterSpacing: 0.6, lineHeight: 14,
              }}>{joined}</Text>
            </View>
            <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'flex-start', justifyContent: 'center' }}>
              <RoleInsignia role={role} />
            </View>
          </View>

          {/* tier footer */}
          <View style={{
            paddingHorizontal: 14, paddingVertical: 8,
            borderTopWidth: 1, borderTopColor: G_LINE,
            backgroundColor: 'rgba(0,0,0,0.25)',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <TierMark tier={org.tier} />
            <Text style={{ fontFamily: MONO, fontSize: 9, color: G_FG_FAINT, letterSpacing: 0.9 }}>{folio}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── charter CTA ──────────────────────────────────────────────────────
function CharterCTA({ onPress }: { onPress: () => void }) {
  return (
    <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
        <View style={{
          position: 'relative',
          borderRadius: 18,
          borderWidth: 1, borderColor: G_GOLD_D,
          overflow: 'hidden',
          paddingHorizontal: 18, paddingVertical: 20,
          shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3, shadowRadius: 24, elevation: 6,
        }}>
          <LinearGradient
            colors={['rgba(234,186,88,0.06)', 'rgba(234,186,88,0.02)']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
          <Guilloche opacity={0.08} id="g-cta" />
          <CornerTicks color={G_GOLD} size={10} weight={1.2} />

          <GEyebrow color={G_GOLD} style={{ marginBottom: 8 }}>Petition for charter</GEyebrow>
          <Text style={{
            fontFamily: SERIF, fontSize: 22, fontWeight: '500',
            color: G_FG, letterSpacing: -0.2, lineHeight: 24, marginBottom: 6,
          }}>
            Charter your own{' '}
            <Text style={{ fontStyle: 'italic', color: G_GOLD_L }}>organization</Text>
          </Text>
          <Text style={{
            fontSize: 12, color: G_FG_MUTED, letterSpacing: -0.05, lineHeight: 17,
            marginBottom: 14, maxWidth: 280,
          }}>
            For unions, nonprofits, and community groups requiring verified roll, secure ballots, and audit-grade records.
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{
                fontFamily: SERIF, fontSize: 18, fontStyle: 'italic',
                color: G_GOLD_L, lineHeight: 18,
              }}>$29</Text>
              <Text style={{ fontFamily: MONO, fontSize: 9.5, color: G_FG_FAINT, letterSpacing: 1 }}>/MO · ANNUAL DUES</Text>
            </View>
            <View style={{
              paddingHorizontal: 14, paddingVertical: 8,
              backgroundColor: G_GOLD,
              borderRadius: 4,
              flexDirection: 'row', alignItems: 'center', gap: 6,
            }}>
              <Text style={{
                fontSize: 11, fontWeight: '600', letterSpacing: 1.7,
                textTransform: 'uppercase', color: '#0A0C0F',
              }}>Begin charter</Text>
              <Ionicons name="arrow-forward" size={11} color="#0A0C0F" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── empty ledger ─────────────────────────────────────────────────────
function EmptyLedger({ onJoinPress, onCreatePress }: { onJoinPress: () => void; onCreatePress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
      <View style={{
        position: 'relative',
        borderRadius: 20,
        borderWidth: 1, borderColor: G_LINE_STRONG,
        overflow: 'hidden',
        paddingHorizontal: 24, paddingTop: 36, paddingBottom: 28,
        minHeight: 360,
        shadowColor: '#000', shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.4, shadowRadius: 36, elevation: 8,
      }}>
        <LinearGradient
          colors={['#0E1116', '#0A0C0F']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <Guilloche opacity={0.05} id="g-empty" />
        <CornerTicks color={G_GOLD_D} size={12} weight={1.2} />

        {/* engraved sigil */}
        <View style={{ alignSelf: 'center', width: 88, height: 88, marginBottom: 20, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={88} height={88} viewBox="0 0 88 88">
            <Circle cx={44} cy={44} r={42} fill="none" stroke={G_GOLD_D} strokeWidth={0.6} />
            <Circle cx={44} cy={44} r={36} fill="none" stroke={G_GOLD_D} strokeWidth={0.4} strokeDasharray="1 2" />
            {Array.from({ length: 12 }).map((_, i) => {
              const a = ((i * 30 - 90) * Math.PI) / 180;
              return (
                <Line
                  key={i}
                  x1={44 + 39 * Math.cos(a)}
                  y1={44 + 39 * Math.sin(a)}
                  x2={44 + 42 * Math.cos(a)}
                  y2={44 + 42 * Math.sin(a)}
                  stroke={G_GOLD_D}
                  strokeWidth={0.6}
                />
              );
            })}
            <G transform="translate(28 26)" stroke={G_GOLD_L} strokeWidth={0.9} fill="none" strokeLinejoin="round">
              <Path d="M4 2h20l4 4v28a2 2 0 0 1-2 2H4z" />
              <Path d="M24 2v4h4" />
              <Path d="M9 14h14M9 19h14M9 24h10" />
            </G>
          </Svg>
        </View>

        <Text style={{
          fontFamily: SERIF, fontSize: 26, fontWeight: '500',
          color: G_FG, letterSpacing: -0.3, lineHeight: 28,
          textAlign: 'center', marginBottom: 8,
        }}>
          An <Text style={{ fontStyle: 'italic', color: G_GOLD_L }}>empty ledger</Text>
        </Text>
        <Text style={{
          fontSize: 13, color: G_FG_MUTED, letterSpacing: -0.05, lineHeight: 19,
          textAlign: 'center', maxWidth: 280, alignSelf: 'center', marginBottom: 24,
        }}>
          No organizations are yet inscribed under your name. Petition for membership by invitation, or charter a new order of your own.
        </Text>

        <View style={{
          height: 1, backgroundColor: G_GOLD_D, opacity: 0.4,
          width: 200, alignSelf: 'center', marginBottom: 22,
        }} />

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onJoinPress}
          style={{
            paddingHorizontal: 16, paddingVertical: 13,
            backgroundColor: G_GOLD, borderRadius: 5,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 10,
          }}
        >
          <Ionicons name="key-outline" size={14} color="#0A0C0F" />
          <Text style={{
            fontSize: 11.5, fontWeight: '600', letterSpacing: 2,
            textTransform: 'uppercase', color: '#0A0C0F',
          }}>Enter invite code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCreatePress}
          style={{
            paddingHorizontal: 16, paddingVertical: 13,
            backgroundColor: 'transparent',
            borderWidth: 1, borderColor: G_GOLD_D,
            borderRadius: 5,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{
            fontSize: 11.5, fontWeight: '600', letterSpacing: 2,
            textTransform: 'uppercase', color: G_GOLD,
          }}>Charter a new organization</Text>
        </TouchableOpacity>

        <Text style={{
          fontFamily: MONO, fontSize: 8.5, color: G_FG_FAINT,
          letterSpacing: 2, textTransform: 'uppercase',
          textAlign: 'center', marginTop: 18,
        }}>FOLIO · 0000 / 2033 · AWAITING ENTRY</Text>
      </View>
    </Animated.View>
  );
}

// ─── invite sheet ─────────────────────────────────────────────────────
function InviteSheet({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (org: Organization) => void;
}) {
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const insets = useSafeAreaInsets();

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);
    try {
      const result = await organizationsApi.joinWithInviteCode(inviteCode.trim().toUpperCase());
      if (result.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', result.error);
        return;
      }
      if (result.data?.organization) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess(result.data.organization);
        setInviteCode('');
        onClose();
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to join organization. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const codeLen = inviteCode.length;
  const lengthOk = codeLen >= 6 && codeLen <= 12;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,7,7,0.7)' }]}
      />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: G_BG_CARD,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        borderTopWidth: 1, borderTopColor: G_GOLD_D,
        borderLeftWidth: 1, borderLeftColor: G_LINE_STRONG,
        borderRightWidth: 1, borderRightColor: G_LINE_STRONG,
        paddingTop: 12,
        paddingBottom: 36 + insets.bottom,
        shadowColor: '#000', shadowOffset: { width: 0, height: -20 },
        shadowOpacity: 0.6, shadowRadius: 60, elevation: 24,
      }}>
        {/* grabber */}
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: G_LINE_STRONG, alignSelf: 'center', marginBottom: 18 }} />

        {/* eyebrow + close */}
        <View style={{ paddingHorizontal: 22, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <GEyebrow color={G_GOLD} style={{ marginBottom: 6 }}>Letter of invitation</GEyebrow>
            <Text style={{
              fontFamily: SERIF, fontSize: 24, fontWeight: '500',
              color: G_FG, letterSpacing: -0.3, lineHeight: 26,
            }}>
              Enter <Text style={{ fontStyle: 'italic', color: G_GOLD_L }}>invite code</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{
              width: 32, height: 32, borderRadius: 16,
              borderWidth: 1, borderColor: G_LINE_STRONG,
              backgroundColor: G_BG_RAISED,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={14} color={G_FG_FAINT} />
          </TouchableOpacity>
        </View>

        {/* hairline */}
        <View style={{ height: 1, backgroundColor: G_LINE_STRONG, marginHorizontal: 22, marginBottom: 18 }} />

        {/* copy */}
        <Text style={{
          paddingHorizontal: 22, fontSize: 12.5, color: G_FG_MUTED,
          letterSpacing: -0.05, lineHeight: 18, marginBottom: 18,
        }}>
          A six- to twelve-character alphanumeric code, issued by an admin of the chartering organization.
        </Text>

        {/* code field */}
        <View style={{ paddingHorizontal: 22, marginBottom: 14 }}>
          <View style={{
            position: 'relative',
            borderWidth: 1, borderColor: G_GOLD_D,
            backgroundColor: '#0A0C0F',
            borderRadius: 4,
            paddingLeft: 46, paddingRight: 16, paddingVertical: 18,
            shadowColor: G_GOLD, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06, shadowRadius: 14,
          }}>
            <CornerTicks color={G_GOLD} size={6} weight={1} />
            <View style={{
              position: 'absolute', left: 14, top: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Svg width={18} height={18} viewBox="0 0 20 20">
                <Circle cx={7} cy={10} r={3.2} stroke={G_GOLD} strokeWidth={1.1} fill="none" />
                <Path d="M10 10h8M16 10v3M14 10v2" stroke={G_GOLD} strokeWidth={1.1} strokeLinecap="round" fill="none" />
              </Svg>
            </View>
            <TextInput
              style={{
                fontFamily: MONO, fontSize: 22, fontWeight: '500',
                letterSpacing: 6, color: G_GOLD_L,
                padding: 0,
              }}
              placeholder="ENTER CODE"
              placeholderTextColor="rgba(244,210,140,0.25)"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              selectionColor={G_GOLD}
            />
          </View>
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            marginTop: 8,
          }}>
            <Text style={{ fontFamily: MONO, fontSize: 9, color: G_FG_FAINT, letterSpacing: 1.3 }}>
              {codeLen} / 12 CHAR · ALPHANUMERIC
            </Text>
            <Text style={{ fontFamily: MONO, fontSize: 9, color: lengthOk ? G_GREEN : G_FG_FAINT, letterSpacing: 1.3 }}>
              {lengthOk ? '● READY' : '○ ENTER CODE'}
            </Text>
          </View>
        </View>

        {/* primary action */}
        <View style={{ paddingHorizontal: 22 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleJoin}
            disabled={joining || !lengthOk}
            style={{
              paddingHorizontal: 16, paddingVertical: 14,
              backgroundColor: lengthOk ? G_GOLD : 'rgba(234,186,88,0.3)',
              borderRadius: 5,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 10,
            }}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#0A0C0F" />
            ) : (
              <>
                <Text style={{
                  fontSize: 11.5, fontWeight: '600', letterSpacing: 2,
                  textTransform: 'uppercase', color: '#0A0C0F',
                }}>Petition for membership</Text>
                <Ionicons name="arrow-forward" size={11} color="#0A0C0F" />
              </>
            )}
          </TouchableOpacity>
          <Text style={{
            fontFamily: MONO, fontSize: 8.5, color: G_FG_FAINT,
            letterSpacing: 1.7, textAlign: 'center',
            textTransform: 'uppercase', marginTop: 10,
          }}>
            On submission, code witnessed by the assembly registrar
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── footer signature ─────────────────────────────────────────────────
function FooterSig() {
  return (
    <View style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 28, alignItems: 'center' }}>
      <Text style={{
        fontFamily: SERIF, fontSize: 13, fontStyle: 'italic',
        color: G_FG_FAINT, letterSpacing: -0.05, marginBottom: 4,
      }}>Sealed by the assembly</Text>
      <Text style={{
        fontFamily: MONO, fontSize: 8.5, color: G_FG_FAINT,
        letterSpacing: 2, textTransform: 'uppercase',
      }}>SECTION III · CHARTERED ORDERS · IV·MMXXVI</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Groups screen ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export default function GroupsScreen() {
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const result = await organizationsApi.getMyOrganizations();
      if (result.data) setOrganizations(result.data);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { fetchOrganizations(); }, [fetchOrganizations]));

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchOrganizations();
  }, [fetchOrganizations]);

  const adminCount = useMemo(
    () => organizations.filter((o) => o.role === 'admin').length,
    [organizations]
  );

  const handleOrgPress = (org: Organization) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/modals/organization-detail',
      params: { orgId: org.id, orgName: org.name, orgRole: org.role || 'member' },
    });
  };

  const handleCharter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/modals/create-organization');
  };

  const handleInviteSuccess = (org: Organization) => {
    setOrganizations((prev) => [...prev, org]);
    Alert.alert('Welcome!', `You've been admitted to ${org.name}.`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: G_BG, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={G_GOLD} />
        <Text style={{ fontFamily: MONO, fontSize: 10, color: G_FG_FAINT, letterSpacing: 1.4, marginTop: 12, textTransform: 'uppercase' }}>
          Consulting the registrar
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: G_BG }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={G_GOLD}
          />
        }
      >
        <GHeader
          stat={organizations.length}
          admins={adminCount}
          onAddPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowInviteSheet(true);
          }}
          insetTop={insets.top}
        />

        {organizations.length === 0 ? (
          <EmptyLedger
            onJoinPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowInviteSheet(true);
            }}
            onCreatePress={handleCharter}
          />
        ) : (
          <>
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {organizations.map((org, i) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  index={i}
                  onPress={() => handleOrgPress(org)}
                />
              ))}
            </View>
            <CharterCTA onPress={handleCharter} />
          </>
        )}

        <View style={{ height: 18 }} />
        <FooterSig />
      </ScrollView>

      {showInviteSheet && (
        <InviteSheet
          onClose={() => setShowInviteSheet(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
