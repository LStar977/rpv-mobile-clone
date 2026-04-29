import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import Svg, { Circle, Line, Path, Rect, Defs, Pattern, Text as SvgText } from 'react-native-svg';

import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, responsive } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { userApi, veriffApi } from '../../lib/api';
import { Button } from '../../components/ui';
import { useTutorialTarget } from '../../components/tutorial';
import { useTutorialStore } from '../../lib/tutorial';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;
const CARD_HEIGHT = CARD_WIDTH * 0.63;

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// Premium design tokens - static fallbacks for StyleSheet
const ID = {
  G: '#EABA58',
  GD: '#C89A3E',
  GL: '#F4D28C',
  BG: '#040707',
  BG_CARD: '#0D0F12',
  BG_RAISED: '#15181C',
  LINE: '#1E2228',
  LINE_STRONG: '#2A2F37',
  FG: '#F4F5F6',
  FG_MUTED: '#C7CACD',
  FG_FAINT: '#8E9297',
  GREEN: '#34C759',
  SERIF: 'Georgia',
  MONO: 'JetBrainsMono-Regular',
};

// Dynamic hook for components to get theme-aware colors
function useIdentityColors() {
  const { colors, isDark } = useTheme();
  return {
    G: colors.gold,
    GD: colors.goldDark,
    GL: colors.goldLight,
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

type VerificationState = {
  verified: boolean;
  status?: 'unverified' | 'pending' | 'verified' | 'failed';
  provider?: 'veriff' | string;
  verifiedAt?: string | null;
};

type ProfileState = {
  name?: string;
  email?: string;
  country?: string;
  state?: string;
  city?: string;
};

// Badge tier colors matching the badges modal
const TIER_COLORS = {
  common: { bg: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)' },
  rare: { bg: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  epic: { bg: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.5)' },
  legendary: { bg: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)' },
};

// All badges - same as badges modal for consistency
const ALL_BADGES = [
  { id: 'first_vote', name: 'First Vote', description: 'Cast your first vote on a proposal', icon: '🗳️', tier: 'common' as const, category: 'voting' },
  { id: 'first_vote_country', name: 'National Voice', description: 'Cast your first vote on a national proposal', icon: '🏛️', tier: 'common' as const, category: 'voting' },
  { id: 'first_vote_state', name: 'State Advocate', description: 'Cast your first vote on a state proposal', icon: '🗺️', tier: 'rare' as const, category: 'voting' },
  { id: 'first_vote_city', name: 'Local Champion', description: 'Cast your first vote on a city proposal', icon: '🏙️', tier: 'rare' as const, category: 'voting' },
  { id: 'vote_streak_5', name: 'Consistent Voter', description: 'Vote on 5 different proposals', icon: '🔥', tier: 'common' as const, category: 'streak' },
  { id: 'vote_streak_25', name: 'Dedicated Citizen', description: 'Vote on 25 different proposals', icon: '⭐', tier: 'rare' as const, category: 'streak' },
  { id: 'vote_streak_100', name: 'Democracy Hero', description: 'Vote on 100 different proposals', icon: '🏆', tier: 'legendary' as const, category: 'streak' },
  { id: 'first_proposal', name: 'Proposal Pioneer', description: 'Create your first proposal', icon: '📝', tier: 'common' as const, category: 'creator' },
  { id: 'proposal_5', name: 'Active Legislator', description: 'Create 5 proposals', icon: '📋', tier: 'epic' as const, category: 'creator' },
  { id: 'referral_5', name: 'Community Builder', description: 'Refer 5 new users', icon: '🤝', tier: 'rare' as const, category: 'social' },
  { id: 'referral_20', name: 'Movement Leader', description: 'Refer 20 new users', icon: '👥', tier: 'epic' as const, category: 'social' },
  { id: 'passport_minted', name: 'Verified Citizen', description: 'Mint your Represent Passport NFT', icon: '🛂', tier: 'epic' as const, category: 'identity' },
  { id: 'early_adopter', name: 'Early Adopter', description: 'Join during the beta period', icon: '🚀', tier: 'legendary' as const, category: 'special' },
  { id: 'democratic_spirit', name: 'Democratic Spirit', description: 'Vote on both sides of the aisle', icon: '⚖️', tier: 'rare' as const, category: 'special' },
  { id: 'global_citizen', name: 'Global Citizen', description: 'Participate in governance across multiple regions', icon: '🌍', tier: 'legendary' as const, category: 'special' },
];

// Show first 6 badges on identity page (sorted by tier importance)
const PREVIEW_BADGES = [...ALL_BADGES].sort((a, b) => {
  const tierOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
  return tierOrder[a.tier] - tierOrder[b.tier];
}).slice(0, 6);

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatShortDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}

function toRomanNumeral(num: number): string {
  const lookup: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let result = '';
  for (const [value, numeral] of lookup) {
    while (num >= value) { result += numeral; num -= value; }
  }
  return result;
}

// Premium ID Header
function IdHeader({ folio }: { folio: string }) {
  const id = useIdentityColors();
  return (
    <View style={premiumStyles.header}>
      <View style={premiumStyles.headerTop}>
        <View style={premiumStyles.headerBadge}>
          <View style={[premiumStyles.greenDot, { backgroundColor: id.GREEN }]} />
          <Text style={[premiumStyles.eyebrow, { color: id.FG_FAINT }]}>Verified</Text>
        </View>
        <Text style={[premiumStyles.folioCode, { color: id.FG_FAINT }]}>ID {folio}</Text>
      </View>
      <Text style={[premiumStyles.headline, { color: id.FG }]}>
        Your <Text style={[premiumStyles.headlineItalic, { color: id.GL }]}>Identity</Text>
      </Text>
      <Text style={[premiumStyles.subline, { color: id.FG_MUTED }]}>
        Your verified civic profile and activity.
      </Text>
    </View>
  );
}

// Premium Passport Card
function PassportCard({
  name,
  location,
  verified,
  folio,
  memberSince,
}: {
  name: string;
  location: string;
  verified: boolean;
  folio: string;
  memberSince?: string;
}) {
  const id = useIdentityColors();
  const initials = useMemo(() => {
    if (!name) return 'RW';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [name]);

  const mrzLine1 = useMemo(() => {
    const nameUpper = (name || 'CITIZEN').toUpperCase().replace(/[^A-Z]/g, '');
    return `P<CAN<${nameUpper}<<<<<<<<<<<<`;
  }, [name]);

  const mrzLine2 = `RW${folio.replace(/[^0-9]/g, '')}<CAN8604012M2604264<<<<<<<<`;

  return (
    <View style={[premiumStyles.passportCard, { backgroundColor: id.BG_CARD, borderColor: id.LINE_STRONG }]}>
      {/* Guilloché pattern */}
      <View style={premiumStyles.guilloche}>
        <Svg width="100%" height="100%" viewBox="0 0 400 260" preserveAspectRatio="none">
          <Defs>
            <Pattern id="guilloche" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <Path d="M 0 20 Q 10 0, 20 20 T 40 20" stroke={id.G} fill="none" strokeWidth={0.5} opacity={0.07} />
              <Path d="M 0 20 Q 10 40, 20 20 T 40 20" stroke={id.G} fill="none" strokeWidth={0.5} opacity={0.07} />
            </Pattern>
          </Defs>
          <Rect width="400" height="260" fill="url(#guilloche)" />
        </Svg>
      </View>

      {/* Top strip */}
      <View style={[premiumStyles.passportTop, { borderBottomColor: id.LINE }]}>
        <View style={premiumStyles.passportLogo}>
          <Image source={require('../../assets/logo.png')} style={{ width: 22, height: 22 }} resizeMode="contain" />
          <Text style={[premiumStyles.passportBrand, { color: id.G }]}>REPRESENT</Text>
        </View>
        <Text style={[premiumStyles.passportEst, { color: id.FG_FAINT }]}>EST 2026</Text>
      </View>

      {/* Main section */}
      <View style={premiumStyles.passportMain}>
        {/* Portrait frame */}
        <View style={[premiumStyles.portraitFrame, { borderColor: id.GD }]}>
          <View style={[premiumStyles.cornerTick, { top: -1, left: -1, borderColor: id.G }]} />
          <View style={[premiumStyles.cornerTick, { top: -1, right: -1, borderLeftWidth: 0, borderRightWidth: 1.5, borderColor: id.G }]} />
          <View style={[premiumStyles.cornerTick, { bottom: -1, left: -1, borderTopWidth: 0, borderBottomWidth: 1.5, borderColor: id.G }]} />
          <View style={[premiumStyles.cornerTick, { bottom: -1, right: -1, borderTopWidth: 0, borderBottomWidth: 1.5, borderLeftWidth: 0, borderRightWidth: 1.5, borderColor: id.G }]} />
          <Text style={[premiumStyles.initialsText, { color: id.GL }]} numberOfLines={1} adjustsFontSizeToFit>{initials}</Text>
          {verified && (
            <View style={[premiumStyles.biometricTick, { backgroundColor: id.GREEN }]}>
              <Ionicons name="checkmark" size={10} color={id.BG} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={premiumStyles.passportInfo}>
          <Text style={[premiumStyles.registeredLabel, { color: id.FG_FAINT }]}>Registered name</Text>
          <Text style={[premiumStyles.passportName, { color: id.FG }]}>{name || 'Your Name'}</Text>
          <View style={premiumStyles.locationRow}>
            <Svg width={10} height={10} viewBox="0 0 12 12">
              <Path d="M6 11s4-3.5 4-7a4 4 0 1 0-8 0c0 3.5 4 7 4 7z" stroke={id.G} strokeWidth={1} fill="none" />
              <Circle cx="6" cy="4" r="1.2" fill={id.G} />
            </Svg>
            <Text style={[premiumStyles.locationText, { color: id.FG_MUTED }]}>{location || 'Location not set'}</Text>
          </View>
        </View>
      </View>

      {/* Register strip */}
      <View style={[premiumStyles.registerStrip, { borderTopColor: id.LINE }]}>
        <View style={premiumStyles.registerCell}>
          <Text style={[premiumStyles.registerLabel, { color: id.FG_FAINT }]}>Joined</Text>
          <Text style={[premiumStyles.registerValue, { color: id.FG }]}>{memberSince || 'Apr 2026'}</Text>
        </View>
        <View style={[premiumStyles.registerCell, premiumStyles.registerCellMid, { borderColor: id.LINE }]}>
          <Text style={[premiumStyles.registerLabel, { color: id.FG_FAINT }]}>Folio</Text>
          <Text style={[premiumStyles.registerMono, { color: id.FG }]}>RW·{folio}</Text>
        </View>
        <View style={premiumStyles.registerCell}>
          <Text style={[premiumStyles.registerLabel, { color: id.FG_FAINT }]}>Status</Text>
          <Text style={[premiumStyles.registerValue, { color: verified ? id.GREEN : id.FG_MUTED }]}>
            {verified ? 'Active' : 'Pending'}
          </Text>
        </View>
      </View>

    </View>
  );
}

// Activity Stats
function StandingRegister({ votes, proposals, streak }: { votes: number; proposals: number; streak: number }) {
  const id = useIdentityColors();
  const items = [
    { label: 'Votes cast', value: votes.toString().padStart(2, '0'), sub: 'all-time' },
    { label: 'Proposals', value: proposals.toString().padStart(2, '0'), sub: 'authored' },
    { label: 'Day streak', value: streak.toString().padStart(2, '0'), sub: 'consecutive' },
  ];
  return (
    <View style={premiumStyles.standingSection}>
      <View style={premiumStyles.standingHeader}>
        <Text style={[premiumStyles.eyebrow, { color: id.FG_FAINT }]}>Activity</Text>
      </View>
      <View style={[premiumStyles.standingGrid, { backgroundColor: id.BG_CARD, borderColor: id.LINE }]}>
        {items.map((it, i) => (
          <View key={i} style={[premiumStyles.standingCell, i < 2 && [premiumStyles.standingCellBorder, { borderRightColor: id.LINE }]]}>
            <Text style={[premiumStyles.standingValue, { color: id.FG }]}>{it.value}</Text>
            <Text style={[premiumStyles.standingLabel, { color: id.FG_MUTED }]}>{it.label}</Text>
            <Text style={[premiumStyles.standingSub, { color: id.FG_FAINT }]}>{it.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Engraved Seal Medallion
function SealMedallion({ glyph, locked, tier }: { glyph: React.ReactNode; locked: boolean; tier: 'L' | 'E' }) {
  const id = useIdentityColors();
  const ringColor = locked ? id.LINE_STRONG : id.GD;
  const innerColor = locked ? (id.isDark ? '#16191D' : '#E8E4DF') : (id.isDark ? '#181B20' : '#F5F2ED');

  return (
    <View style={premiumStyles.sealContainer}>
      <Svg width={56} height={56} viewBox="0 0 56 56">
        <Circle cx="28" cy="28" r="26" fill={innerColor} stroke={ringColor} strokeWidth={0.8} />
        <Circle cx="28" cy="28" r="22" fill="none" stroke={ringColor} strokeWidth={0.4} strokeDasharray={tier === 'L' ? '0' : '1 2'} />
        {[0, 90, 180, 270].map(a => (
          <Line
            key={a}
            x1={28 + 24 * Math.cos((a - 90) * Math.PI / 180)}
            y1={28 + 24 * Math.sin((a - 90) * Math.PI / 180)}
            x2={28 + 26 * Math.cos((a - 90) * Math.PI / 180)}
            y2={28 + 26 * Math.sin((a - 90) * Math.PI / 180)}
            stroke={ringColor}
            strokeWidth={1}
          />
        ))}
      </Svg>
      <View style={[premiumStyles.sealGlyph, { opacity: locked ? 0.45 : 1 }]}>
        {glyph}
      </View>
    </View>
  );
}

// Seal glyph SVGs
const SealGlyphs = {
  hero: (color: string) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4l-4.8 2.5.9-5.4L4.2 8.7l5.4-.8L12 3z" stroke={color} strokeWidth={1} strokeLinejoin="round" />
      <Circle cx="12" cy="11" r="2" fill={color} />
    </Svg>
  ),
  rocket: (color: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1}>
      <Path d="M5 19l3-3M3 21l4-1M14 4c4 0 6 2 6 6l-7 7-5-5 6-8z" />
      <Circle cx="14" cy="10" r="1.2" fill={color} />
    </Svg>
  ),
  globe: (color: string) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={0.8}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9z" />
      <Path d="M3 12h18M5 7h14M5 17h14" />
    </Svg>
  ),
  scroll: (color: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1}>
      <Path d="M6 4h11l3 3v13a2 2 0 0 1-2 2H6V4z" />
      <Path d="M9 10h7M9 13h7M9 16h4" />
    </Svg>
  ),
  hands: (color: string) => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1}>
      <Circle cx="9" cy="8" r="2.5" />
      <Circle cx="15" cy="8" r="2.5" />
      <Path d="M4 19c0-3 2.5-5 5-5s5 2 5 5M11 19c0-3 2.5-5 5-5s5 2 5 5" />
    </Svg>
  ),
  shield: (color: string) => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1}>
      <Path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <Path d="M9 12l2 2 4-4" strokeWidth={1.4} />
    </Svg>
  ),
};

// Premium Achievement Badge
function AchievementBadge({
  badge,
  earned,
  onPress,
}: {
  badge: typeof ALL_BADGES[0];
  earned: boolean;
  onPress?: () => void;
}) {
  const id = useIdentityColors();
  const glyphId = badge.id === 'vote_streak_100' ? 'hero' :
    badge.id === 'early_adopter' ? 'rocket' :
    badge.id === 'global_citizen' ? 'globe' :
    badge.id === 'proposal_5' ? 'scroll' :
    badge.id === 'referral_20' ? 'hands' : 'shield';

  const tier = badge.tier === 'legendary' ? 'L' : 'E';
  const glyphColor = earned ? id.GL : id.FG_FAINT;
  const glyph = SealGlyphs[glyphId as keyof typeof SealGlyphs]?.(glyphColor) || SealGlyphs.shield(glyphColor);

  return (
    <TouchableOpacity
      style={[
        premiumStyles.achievementCard,
        { backgroundColor: id.BG_CARD, borderColor: id.LINE },
        earned && [premiumStyles.achievementCardEarned, { borderColor: id.GD }],
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[premiumStyles.achievementCheck, { color: id.FG_FAINT }]}>{earned ? '✓' : '—'}</Text>
      <SealMedallion glyph={glyph} locked={!earned} tier={tier} />
      <Text style={[premiumStyles.achievementName, { color: earned ? id.FG : id.FG_MUTED }]}>
        {badge.name}
      </Text>
      <Text style={[premiumStyles.achievementTier, { color: tier === 'L' ? id.GL : '#B8A4D9', opacity: earned ? 1 : 0.55 }]}>
        {tier === 'L' ? 'Legendary' : 'Epic'}
      </Text>
    </TouchableOpacity>
  );
}

// Progress Meter with segments
function ProgressMeter({ earned, total }: { earned: number; total: number }) {
  const id = useIdentityColors();
  const pct = Math.round((earned / total) * 100);
  return (
    <View style={[premiumStyles.progressCard, { backgroundColor: id.BG_CARD, borderColor: id.LINE }]}>
      <View style={premiumStyles.progressHeader}>
        <View>
          <Text style={[premiumStyles.progressTitle, { color: id.FG }]}>Progress</Text>
        </View>
        <Text style={premiumStyles.progressCount}>
          <Text style={{ color: id.G }}>{earned}</Text>
          <Text style={{ color: id.FG_FAINT }}> / {total}</Text>
        </Text>
      </View>
      <View style={premiumStyles.progressBar}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              premiumStyles.progressSegment,
              { backgroundColor: id.LINE_STRONG },
              i < earned && [premiumStyles.progressSegmentFilled, { backgroundColor: id.G }],
            ]}
          />
        ))}
      </View>
      <View style={premiumStyles.progressFooter}>
        <Text style={[premiumStyles.timestamp, { color: id.FG_FAINT }]}>NEXT · ACTIVE LEGISLATOR</Text>
        <Text style={[premiumStyles.timestamp, { color: id.FG_FAINT }]}>{pct}%</Text>
      </View>
    </View>
  );
}

// Account Particulars
function AccountParticulars({
  name,
  email,
  location,
  walletAddress,
  verified,
  onCopyWallet,
}: {
  name: string;
  email: string;
  location: string;
  walletAddress?: string | null;
  verified: boolean;
  onCopyWallet?: () => void;
}) {
  const id = useIdentityColors();
  const rows = [
    { label: 'Name', value: name || '—', verified: true },
    { label: 'Email', value: email || '—', verified: true },
    { label: 'Location', value: location || '—', verified: true },
    ...(walletAddress ? [{ label: 'Wallet', value: `${walletAddress.slice(0, 6)}···${walletAddress.slice(-4)}`, mono: true, action: 'copy' as const }] : []),
  ];

  return (
    <View style={[premiumStyles.particularsCard, { backgroundColor: id.BG_CARD, borderColor: id.LINE }]}>
      <View style={[premiumStyles.particularsHeader, { borderBottomColor: id.LINE }]}>
        <View>
          <Text style={[premiumStyles.particularsTitle, { color: id.FG }]}>Account</Text>
        </View>
        {verified && (
          <View style={premiumStyles.verifiedPill}>
            <Ionicons name="checkmark" size={9} color={id.GREEN} />
            <Text style={[premiumStyles.verifiedPillText, { color: id.GREEN }]}>Verified</Text>
          </View>
        )}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={[premiumStyles.particularRow, i < rows.length - 1 && [premiumStyles.particularRowBorder, { borderBottomColor: id.LINE }]]}>
          <Text style={[premiumStyles.particularLabel, { color: id.FG_FAINT }]}>{r.label}</Text>
          <Text style={[premiumStyles.particularValue, { color: id.FG }, r.mono && premiumStyles.monoText]}>{r.value}</Text>
          {r.action === 'copy' ? (
            <TouchableOpacity onPress={onCopyWallet} style={[premiumStyles.copyButton, { backgroundColor: id.BG_RAISED, borderColor: id.LINE_STRONG }]}>
              <Ionicons name="copy-outline" size={13} color={id.FG_MUTED} />
            </TouchableOpacity>
          ) : (
            <View style={[premiumStyles.verifiedDot, { backgroundColor: id.GREEN }]} />
          )}
        </View>
      ))}
    </View>
  );
}

// Verified Seal
function VerifiedSeal({ verifiedAt, provider }: { verifiedAt?: string | null | undefined; provider?: string }) {
  const id = useIdentityColors();
  const date = formatDate(verifiedAt) || '26 April 2026';
  return (
    <View style={premiumStyles.verifiedSeal}>
      <View style={premiumStyles.sealRing}>
        <Svg width={44} height={44} viewBox="0 0 44 44">
          <Circle cx="22" cy="22" r="20" fill="rgba(52,199,89,0.1)" stroke={id.GREEN} strokeWidth={0.6} />
          <Circle cx="22" cy="22" r="16" fill="none" stroke={id.GREEN} strokeWidth={0.3} strokeDasharray="1 2" />
          <Path d="M14 22l5 5 11-12" stroke={id.GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
      <View style={premiumStyles.sealInfo}>
        <Text style={[premiumStyles.sealTitle, { color: id.GREEN }]}>Identity verified</Text>
        <Text style={[premiumStyles.sealSubtitle, { color: id.FG }]}>Verified by {provider || 'Veriff'} on {date}</Text>
      </View>
    </View>
  );
}

// Footer Signature
function FooterSignature({ folio }: { folio: string }) {
  const id = useIdentityColors();
  return (
    <View style={premiumStyles.footerSig}>
      <Text style={[premiumStyles.footerMono, { color: id.FG_FAINT }]}>Represent · ID {folio}</Text>
    </View>
  );
}

export default function IdentityScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user, token } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [verification, setVerification] = useState<VerificationState>({
    verified: false,
    status: 'unverified',
    provider: 'veriff',
    verifiedAt: null,
  });

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [startingKyc, setStartingKyc] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [hasPaidVerification, setHasPaidVerification] = useState(false);

  // Stats from API
  const [stats, setStats] = useState({ votes: 0, proposals: 0, streak: 0 });

  // Tutorial target refs
  const idCardRef = useTutorialTarget('id-card');
  const verifyButtonRef = useTutorialTarget('verify-button');

  // Tutorial state for action detection
  const { isActive: tutorialActive, completeAction: completeTutorialAction } = useTutorialStore();

  const fetchIdentity = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        isAuthenticated ? userApi.getVerificationStatus() : Promise.resolve({ data: { verified: false } }),
        isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null }),
        isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [] }),
      ]);

      const verificationRes =
        results[0].status === 'fulfilled' ? results[0].value : { data: { verified: false } };
      const profileRes = results[1].status === 'fulfilled' ? results[1].value : { data: null };
      const votedRes = results[2].status === 'fulfilled' ? results[2].value : { data: [] };

      const v = (verificationRes?.data || {}) as any;
      const p = profileRes?.data || null;

      // Demo account should always appear verified (for App Store review)
      const isDemoAccount = user?.email === 'demo@represent.app';

      setVerification({
        verified: isDemoAccount ? true : !!v.verified,
        status: isDemoAccount ? 'verified' : ((v.status as any) || (v.verified ? 'verified' : 'unverified')),
        provider: v.provider || 'veriff',
        verifiedAt: isDemoAccount ? new Date().toISOString() : (v.verifiedAt || v.verified_at || null),
      });

      setProfile(p);

      // Check subscription status (for premium users, verification is included)
      if (isAuthenticated && token) {
        try {
          const subResponse = await fetch(`${API_URL}/api/stripe/subscription`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (subResponse.ok) {
            const subData = await subResponse.json();
            const userIsPremium = subData.tier === 'premium' && subData.status === 'active';
            const userHasPaid = subData.verificationPaid === true || userIsPremium;
            setIsPremium(userIsPremium);
            setHasPaidVerification(userHasPaid);
          }
        } catch (subError) {
          console.error('Subscription check error:', subError);
        }
      }

      // Set real stats from API data
      const votedProposals = votedRes?.data || [];
      setStats({
        votes: Array.isArray(votedProposals) ? votedProposals.length : 0,
        proposals: 0,
        streak: 0,
      });
    } catch (e) {
      console.error('Identity fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchIdentity();
  }, [fetchIdentity]);

  const handleStartKyc = async () => {
    // Check if this is a tutorial action
    if (tutorialActive) {
      completeTutorialAction('tap-button');
      // Don't actually start verification during tutorial
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to begin verification.');
      return;
    }

    // Verification is now free - proceed directly to Veriff
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStartingKyc(true);

    try {
      const response = await veriffApi.createSession();

      if (response.data?.sessionUrl && response.data?.verificationId) {
        router.push({
          pathname: '/modals/veriff',
          params: {
            sessionUrl: response.data.sessionUrl,
            verificationId: response.data.verificationId,
          },
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Verification Error',
          response.data?.error || 'Could not start verification session. Please try again.'
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Veriff session error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the verification service. Please check your connection and try again.'
      );
    } finally {
      setStartingKyc(false);
    }
  };

  const copyWalletAddress = async (address: string) => {
    await Clipboard.setStringAsync(address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Wallet address copied to clipboard');
  };

  // Calculate earned badges
  // State for API-fetched earned badges
  const [apiBadges, setApiBadges] = useState<Set<string>>(new Set());

  // Fetch earned badges from API
  useEffect(() => {
    const fetchBadges = async () => {
      if (!isAuthenticated || !user?.id || !token) return;
      try {
        const response = await fetch(`${API_URL}/api/badges/user/${user.id}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const earnedBadgesData = await response.json();
          const earnedIds = new Set<string>(
            earnedBadgesData.map((b: any) => b.badgeId || b.badge?.id || b.id)
          );
          setApiBadges(earnedIds);
        }
      } catch (error) {
        console.error('Error fetching badges:', error);
      }
    };
    fetchBadges();
  }, [isAuthenticated, user?.id, token]);

  // Combine API badges with local computed badges
  const earnedBadges = useMemo(() => {
    const earned = new Set<string>(apiBadges);
    // Add computed badges based on stats
    if (stats.votes >= 1) earned.add('first_vote');
    if (stats.votes >= 5) earned.add('vote_streak_5');
    if (stats.votes >= 25) earned.add('vote_streak_25');
    if (stats.votes >= 100) earned.add('vote_streak_100');
    if (stats.proposals >= 1) earned.add('first_proposal');
    if (stats.proposals >= 5) earned.add('proposal_5');
    if (verification.verified) earned.add('passport_minted');
    return earned;
  }, [verification.verified, stats, apiBadges]);

  // Pre-compute display values (needed before early return for hooks consistency)
  const displayName = profile?.name || user?.name || '';
  const displayEmail = profile?.email || user?.email || '';

  // Demo account should use hardcoded location for App Store review
  const isDemoAccount = user?.email === 'demo@represent.app';
  const displayCountry = isDemoAccount ? 'Canada' : (profile?.country || user?.country || '');
  const displayState = isDemoAccount ? 'Ontario' : (profile?.state || user?.state || '');
  const displayCity = isDemoAccount ? 'Toronto' : (profile?.city || user?.city || '');

  // Build location string
  const locationParts = [displayCity, displayState, displayCountry].filter(Boolean);
  const displayLocation = locationParts.length > 0 ? locationParts.join(', ') : '';

  // Member since date
  const memberSince = formatShortDate(verification.verifiedAt) || 'Apr 2026';

  // Generate folio number based on name (must be before early return)
  const folio = useMemo(() => {
    if (!displayName) return '0000/2033';
    const hash = displayName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return `${(hash % 10000).toString().padStart(4, '0')}/${new Date().getFullYear()}`;
  }, [displayName]);

  // Loading state (after all hooks)
  if (loading) {
    return (
      <View style={[premiumStyles.container, premiumStyles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={[premiumStyles.loadingCard, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[premiumStyles.loadingText, { color: colors.text }]}>Loading identity...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[premiumStyles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Premium Header */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <IdHeader folio={folio} />
        </Animated.View>

        {/* Passport Card */}
        <View ref={idCardRef} collapsable={false}>
          <Animated.View entering={FadeInUp.delay(100).duration(500)}>
            <PassportCard
              name={displayName}
              location={displayLocation}
              verified={verification.verified}
              folio={folio}
              memberSince={memberSince}
            />
          </Animated.View>
        </View>

        {/* Verification CTA for unverified users */}
        {!verification.verified && isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={[premiumStyles.verifyCta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={premiumStyles.verifyCtaContent}>
              <View style={[premiumStyles.verifyCtaIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color={colors.gold} />
              </View>
              <View style={premiumStyles.verifyCtaText}>
                <Text style={[premiumStyles.verifyCtaTitle, { color: colors.text }]}>
                  {verification.status === 'pending' ? 'Verification Pending' : 'Verify Your Identity'}
                </Text>
                <Text style={[premiumStyles.verifyCtaSubtitle, { color: colors.textSecondary }]}>
                  {verification.status === 'pending'
                    ? 'Your verification is being processed'
                    : 'Unlock voting and earn the Verified badge'
                  }
                </Text>
              </View>
            </View>
            <View ref={verifyButtonRef} collapsable={false}>
              <Button
                title={startingKyc ? 'Starting...' : verification.status === 'pending' ? 'Refresh' : 'Verify Now'}
                onPress={verification.status === 'pending' ? onRefresh : handleStartKyc}
                variant="primary"
                size="md"
                loading={startingKyc}
                disabled={startingKyc}
              />
            </View>
          </Animated.View>
        )}

        {/* Sign In CTA for unauthenticated users */}
        {!isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={[premiumStyles.verifyCta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={premiumStyles.verifyCtaContent}>
              <View style={[premiumStyles.verifyCtaIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="log-in-outline" size={24} color={colors.gold} />
              </View>
              <View style={premiumStyles.verifyCtaText}>
                <Text style={[premiumStyles.verifyCtaTitle, { color: colors.text }]}>Sign In Required</Text>
                <Text style={[premiumStyles.verifyCtaSubtitle, { color: colors.textSecondary }]}>
                  Sign in to access your civic identity
                </Text>
              </View>
            </View>
            <Button
              title="Sign In"
              onPress={() => router.replace('/')}
              variant="primary"
              size="md"
            />
          </Animated.View>
        )}

        {/* Standing Register */}
        {isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <StandingRegister votes={stats.votes} proposals={stats.proposals} streak={stats.streak} />
          </Animated.View>
        )}

        {/* Achievements Section */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={premiumStyles.achievementsSection}>
          <View style={premiumStyles.achievementsHeader}>
            <View>
              <Text style={[premiumStyles.achievementsSectionTitle, { color: colors.text }]}>Achievements</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/modals/badges')}
              style={premiumStyles.viewAllButton}
            >
              <Text style={[premiumStyles.viewAllText, { color: colors.gold }]}>View all {ALL_BADGES.length}</Text>
              <Ionicons name="chevron-forward" size={10} color={colors.gold} />
            </TouchableOpacity>
          </View>

          <View style={premiumStyles.achievementsGrid}>
            {PREVIEW_BADGES.map((badge) => (
              <AchievementBadge
                key={badge.id}
                badge={badge}
                earned={earnedBadges.has(badge.id)}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert(
                    badge.name,
                    earnedBadges.has(badge.id)
                      ? `You've earned this badge! ${badge.description}`
                      : `${badge.description} to earn this badge.`
                  );
                }}
              />
            ))}
          </View>
        </Animated.View>

        {/* Progress Meter */}
        <Animated.View entering={FadeInUp.delay(450).duration(400)}>
          <ProgressMeter earned={earnedBadges.size} total={ALL_BADGES.length} />
        </Animated.View>

        {/* Account Particulars */}
        {isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(500).duration(400)}>
            <AccountParticulars
              name={displayName}
              email={displayEmail}
              location={displayLocation}
              walletAddress={user?.walletAddress}
              verified={verification.verified}
              onCopyWallet={() => user?.walletAddress && copyWalletAddress(user.walletAddress)}
            />
          </Animated.View>
        )}

        {/* Verified Seal */}
        {verification.verified && (
          <Animated.View entering={FadeInUp.delay(600).duration(400)}>
            <VerifiedSeal verifiedAt={verification.verifiedAt} provider={verification.provider} />
          </Animated.View>
        )}

        {/* Footer Signature */}
        <Animated.View entering={FadeInUp.delay(700).duration(400)}>
          <FooterSignature folio={folio} />
        </Animated.View>

        <View style={premiumStyles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({});

// Premium Identity Styles
const premiumStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ID.BG },
  loadingContainer: { alignItems: 'center', justifyContent: 'center' },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: ID.BG_CARD,
    borderWidth: 1,
    borderColor: ID.LINE,
  },
  loadingText: { color: ID.FG_MUTED, fontSize: 14 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  // Header
  header: { paddingHorizontal: 8, paddingBottom: 18 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerBadge: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ID.GREEN, marginRight: 8 },
  eyebrow: { fontWeight: '600', fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase', color: ID.FG_FAINT },
  folioCode: { fontFamily: ID.MONO, fontSize: 9.5, color: ID.FG_FAINT, letterSpacing: 0.8 },
  headline: { fontFamily: ID.SERIF, fontSize: 44, fontWeight: '500', letterSpacing: -0.8, lineHeight: 42, color: ID.FG, marginBottom: 10 },
  headlineItalic: { fontStyle: 'italic', color: ID.GL, fontWeight: '400' },
  subline: { fontSize: 13, color: ID.FG_MUTED, letterSpacing: -0.05, maxWidth: 280 },

  // Passport Card
  passportCard: {
    position: 'relative',
    borderRadius: 20,
    backgroundColor: ID.BG_CARD,
    borderWidth: 1,
    borderColor: ID.LINE_STRONG,
    overflow: 'hidden',
    marginBottom: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.4,
    shadowRadius: 36,
    elevation: 20,
  },
  guilloche: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.07 },
  passportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: ID.LINE,
  },
  passportLogo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  passportBrand: { fontWeight: '600', fontSize: 10, letterSpacing: 2.8, color: ID.G },
  passportEst: { fontFamily: ID.MONO, fontSize: 9, color: ID.FG_FAINT, letterSpacing: 1 },
  passportMain: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, gap: 16 },
  portraitFrame: {
    width: 88,
    height: 110,
    borderWidth: 1,
    borderColor: ID.GD,
    backgroundColor: '#0A0C0F',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cornerTick: { position: 'absolute', width: 8, height: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: ID.G },
  initialsText: { fontFamily: ID.SERIF, fontSize: 42, fontWeight: '500', fontStyle: 'italic', color: ID.GL, letterSpacing: -0.8 },
  biometricTick: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: ID.GREEN,
    borderWidth: 2,
    borderColor: '#0B0D10',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passportInfo: { flex: 1, paddingTop: 4 },
  registeredLabel: { fontWeight: '600', fontSize: 9, letterSpacing: 2.2, textTransform: 'uppercase', color: ID.FG_FAINT, marginBottom: 4 },
  passportName: { fontFamily: ID.SERIF, fontSize: 24, fontWeight: '500', letterSpacing: -0.4, color: ID.FG, lineHeight: 26, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontSize: 11.5, color: ID.FG_MUTED, letterSpacing: -0.05 },
  registerStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: ID.LINE },
  registerCell: { flex: 1, padding: 12, paddingHorizontal: 14 },
  registerCellMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: ID.LINE },
  registerLabel: { fontWeight: '600', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: ID.FG_FAINT, marginBottom: 4 },
  registerValue: { fontFamily: ID.SERIF, fontSize: 14, fontWeight: '500', fontStyle: 'italic', color: ID.FG },
  registerSub: { fontSize: 9, color: ID.FG_FAINT, letterSpacing: 0.5, marginTop: 2 },
  registerMono: { fontFamily: ID.MONO, fontSize: 11, fontWeight: '500', color: ID.FG, letterSpacing: 0.4 },
  mrzZone: {
    padding: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: ID.LINE,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  mrzText: { fontFamily: ID.MONO, fontSize: 9.5, color: ID.FG_MUTED, letterSpacing: 0.8, lineHeight: 14 },

  // Verify CTA
  verifyCta: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ID.LINE,
    padding: 16,
    marginBottom: 16,
    backgroundColor: ID.BG_CARD,
  },
  verifyCtaContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  verifyCtaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${ID.G}15`, justifyContent: 'center', alignItems: 'center' },
  verifyCtaText: { flex: 1 },
  verifyCtaTitle: { fontSize: 15, fontWeight: '600', color: ID.FG, marginBottom: 2 },
  verifyCtaSubtitle: { fontSize: 13, color: ID.FG_MUTED },

  // Standing Register
  standingSection: { paddingHorizontal: 8, marginBottom: 22 },
  standingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  timestamp: { fontFamily: ID.MONO, fontSize: 9, color: ID.FG_FAINT, letterSpacing: 0.8 },
  standingGrid: {
    flexDirection: 'row',
    backgroundColor: ID.BG_CARD,
    borderWidth: 1,
    borderColor: ID.LINE,
    borderRadius: 14,
    overflow: 'hidden',
  },
  standingCell: { flex: 1, padding: 16, paddingHorizontal: 14 },
  standingCellBorder: { borderRightWidth: 1, borderRightColor: ID.LINE },
  standingValue: { fontFamily: ID.SERIF, fontSize: 36, fontWeight: '500', color: ID.FG, letterSpacing: -0.8, lineHeight: 36, marginBottom: 6 },
  standingLabel: { fontSize: 11, fontWeight: '500', color: ID.FG_MUTED, letterSpacing: -0.05 },
  standingSub: { fontWeight: '600', fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: ID.FG_FAINT, marginTop: 2 },

  // Achievements
  achievementsSection: { paddingHorizontal: 8, marginBottom: 18 },
  achievementsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  achievementsSectionTitle: { fontFamily: ID.SERIF, fontSize: 22, fontWeight: '500', color: ID.FG, letterSpacing: -0.4, lineHeight: 22 },
  viewAllButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontSize: 11, fontWeight: '500', color: ID.G, letterSpacing: -0.05 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achievementCard: {
    width: (CARD_WIDTH - 24 - 20) / 3,
    backgroundColor: ID.BG_CARD,
    borderWidth: 1,
    borderColor: ID.LINE,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
  },
  achievementCardEarned: {
    backgroundColor: 'rgba(234,186,88,0.06)',
    borderColor: ID.GD,
    shadowColor: ID.G,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  achievementCheck: { position: 'absolute', top: 8, right: 8, fontFamily: ID.MONO, fontSize: 8, color: ID.FG_FAINT, letterSpacing: 1 },
  sealContainer: { width: 56, height: 56, marginBottom: 0, position: 'relative' },
  sealGlyph: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  achievementName: { fontSize: 10.5, fontWeight: '600', color: ID.FG_MUTED, letterSpacing: -0.05, marginTop: 8, marginBottom: 4, textAlign: 'center', lineHeight: 12 },
  achievementTier: { fontFamily: ID.SERIF, fontSize: 10, fontStyle: 'italic', letterSpacing: 0.5 },

  // Progress Meter
  progressCard: {
    backgroundColor: ID.BG_CARD,
    borderWidth: 1,
    borderColor: ID.LINE,
    borderRadius: 14,
    padding: 14,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    marginBottom: 22,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  progressTitle: { fontSize: 13, fontWeight: '600', color: ID.FG, letterSpacing: -0.05 },
  progressCount: { fontFamily: ID.SERIF, fontSize: 18, letterSpacing: -0.4 },
  progressBar: { flexDirection: 'row', gap: 3, marginBottom: 8 },
  progressSegment: { flex: 1, height: 5, borderRadius: 1, backgroundColor: ID.LINE_STRONG },
  progressSegmentFilled: { backgroundColor: ID.G, shadowColor: ID.G, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6 },
  progressFooter: { flexDirection: 'row', justifyContent: 'space-between' },

  // Account Particulars
  particularsCard: {
    backgroundColor: ID.BG_CARD,
    borderWidth: 1,
    borderColor: ID.LINE,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginBottom: 18,
  },
  particularsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: ID.LINE,
  },
  particularsTitle: { fontFamily: ID.SERIF, fontSize: 18, fontWeight: '500', color: ID.FG, letterSpacing: -0.05, lineHeight: 18 },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(52,199,89,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.3)',
  },
  verifiedPillText: { fontWeight: '600', fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: ID.GREEN },
  particularRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 18, gap: 12 },
  particularRowBorder: { borderBottomWidth: 1, borderBottomColor: ID.LINE },
  particularLabel: { width: 108, fontWeight: '600', fontSize: 9.5, letterSpacing: 1.6, textTransform: 'uppercase', color: ID.FG_FAINT },
  particularValue: { flex: 1, fontSize: 13.5, fontWeight: '500', color: ID.FG, letterSpacing: -0.05 },
  monoText: { fontFamily: ID.MONO, fontSize: 12, letterSpacing: 0.4 },
  copyButton: { width: 28, height: 28, borderRadius: 8, backgroundColor: ID.BG_RAISED, borderWidth: 1, borderColor: ID.LINE_STRONG, justifyContent: 'center', alignItems: 'center' },
  verifiedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ID.GREEN, opacity: 0.7 },

  // Verified Seal
  verifiedSeal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 8,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(52,199,89,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.25)',
    marginBottom: 18,
  },
  sealRing: { width: 44, height: 44 },
  sealInfo: { flex: 1 },
  sealTitle: { fontWeight: '600', fontSize: 9.5, letterSpacing: 1.8, textTransform: 'uppercase', color: ID.GREEN, marginBottom: 3 },
  sealSubtitle: { fontFamily: ID.SERIF, fontSize: 15, fontWeight: '500', color: ID.FG, letterSpacing: -0.05, lineHeight: 18, marginBottom: 6 },

  // Footer
  footerSig: { paddingVertical: 8, paddingHorizontal: 24, alignItems: 'center' },
  footerItalic: { fontFamily: ID.SERIF, fontSize: 13, fontStyle: 'italic', color: ID.FG_FAINT, letterSpacing: -0.05, marginBottom: 4 },
  footerMono: { fontFamily: ID.MONO, fontSize: 8.5, color: ID.FG_FAINT, letterSpacing: 2.2, textTransform: 'uppercase' },

  bottomSpacer: { height: 100 },
});
