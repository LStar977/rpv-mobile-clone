// "Your Communities" detail modal — UPDATE 30
//
// Educational modal showing the user where they're eligible to vote
// based on their verified location. Renders four geographic tiers as
// a layered hierarchy (Global → Federal → Provincial → Municipal),
// each with the user's location name, proposal counts, and a clear
// eligibility state.
//
// Opened from app/(tabs)/dashboard.tsx "Your Communities" section.

import { View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, SPACING, BORDER_RADIUS, SHADOWS } from '../../lib/theme';

type Tier = {
  key: 'global' | 'federal' | 'provincial' | 'municipal';
  label: string;
  scopeLabel: string;
  locationName: string | null;
  flag: string | null;
  total: number;
  active: number;
  eligible: boolean;
  icon: string;
};

const COUNTRY_FLAG_EMOJI: Record<string, string> = {
  canada: '🇨🇦',
  'united states': '🇺🇸',
  'united kingdom': '🇬🇧',
  australia: '🇦🇺',
  france: '🇫🇷',
  germany: '🇩🇪',
};

function flagFor(name: string | null): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return COUNTRY_FLAG_EMOJI[lower] ?? null;
}

function shortCode(name: string | null): string {
  if (!name) return '—';
  return name.slice(0, 2).toUpperCase();
}

export default function YourCommunitiesModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    country?: string;
    state?: string;
    city?: string;
    isVerified?: string;
    globalTotal?: string;
    globalActive?: string;
    federalTotal?: string;
    federalActive?: string;
    provincialTotal?: string;
    provincialActive?: string;
    municipalTotal?: string;
    municipalActive?: string;
  }>();

  const country = (typeof params.country === 'string' ? params.country : '').trim();
  const state = (typeof params.state === 'string' ? params.state : '').trim();
  const city = (typeof params.city === 'string' ? params.city : '').trim();
  const isVerified = params.isVerified === 'true';

  const n = (v: string | string[] | undefined): number => {
    const s = typeof v === 'string' ? v : '';
    const i = parseInt(s, 10);
    return Number.isFinite(i) ? i : 0;
  };

  const tiers: Tier[] = useMemo(() => [
    {
      key: 'global',
      label: 'Global',
      scopeLabel: 'Open to everyone',
      locationName: 'Worldwide',
      flag: '🌍',
      total: n(params.globalTotal),
      active: n(params.globalActive),
      eligible: true,
      icon: 'earth-outline',
    },
    {
      key: 'federal',
      label: 'Federal',
      scopeLabel: 'Country',
      locationName: country || null,
      flag: flagFor(country) ?? (country ? shortCode(country) : null),
      total: n(params.federalTotal),
      active: n(params.federalActive),
      eligible: isVerified && !!country,
      icon: 'flag-outline',
    },
    {
      key: 'provincial',
      label: 'Provincial',
      scopeLabel: 'Province or state',
      locationName: state || null,
      flag: state ? shortCode(state) : null,
      total: n(params.provincialTotal),
      active: n(params.provincialActive),
      eligible: isVerified && !!state,
      icon: 'map-outline',
    },
    {
      key: 'municipal',
      label: 'Municipal',
      scopeLabel: 'City',
      locationName: city || null,
      flag: city ? shortCode(city) : null,
      total: n(params.municipalTotal),
      active: n(params.municipalActive),
      eligible: isVerified && !!city,
      icon: 'location-outline',
    },
  ], [country, state, city, isVerified, params.globalTotal, params.globalActive, params.federalTotal, params.federalActive, params.provincialTotal, params.provincialActive, params.municipalTotal, params.municipalActive]);

  const totalEligible = tiers.reduce((sum, t) => sum + (t.eligible ? t.active : 0), 0);
  const handleVerify = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/modals/verification-payment');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingTop: insets.top + SPACING.sm, paddingBottom: SPACING.md,
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' }}>
          <Ionicons name="close" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text }}>
          Where you can vote
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['3xl'] }}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.lg,
          marginBottom: SPACING.lg,
          alignItems: 'center',
          ...SHADOWS.sm,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 6 }}>
            Your civic reach
          </Text>
          <Text style={{ fontSize: 44, fontWeight: '700', color: colors.gold, letterSpacing: -1, lineHeight: 50 }}>
            {totalEligible}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            active proposal{totalEligible === 1 ? '' : 's'} you can vote on
          </Text>
          {isVerified ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, gap: 6 }}>
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <Text style={{ fontSize: 12, color: colors.success, fontWeight: '600' }}>
                Verified resident of {[city, state, country].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: SPACING.md, gap: 6,
              paddingHorizontal: SPACING.md, paddingVertical: 6,
              backgroundColor: `${colors.warning}15`,
              borderRadius: BORDER_RADIUS.full,
            }}>
              <Ionicons name="lock-closed" size={13} color={colors.warning} />
              <Text style={{ fontSize: 12, color: colors.warning, fontWeight: '600' }}>
                Unverified — global only
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Tier cards */}
        <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: SPACING.sm, paddingHorizontal: 2 }}>
          Your eligibility
        </Text>

        <View style={{ position: 'relative' }}>
          {/* vertical spine connecting cards */}
          <View style={{
            position: 'absolute',
            left: 27,
            top: 28,
            bottom: 28,
            width: 2,
            backgroundColor: colors.border,
            opacity: 0.6,
          }} />

          {tiers.map((tier, i) => (
            <TierRow key={tier.key} tier={tier} index={i} />
          ))}
        </View>

        {/* Explainer */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={{
          marginTop: SPACING.lg,
          padding: SPACING.md,
          backgroundColor: `${colors.gold}08`,
          borderColor: `${colors.gold}30`,
          borderWidth: 1,
          borderRadius: BORDER_RADIUS.md,
          flexDirection: 'row',
          gap: 10,
        }}>
          <Ionicons name="information-circle-outline" size={20} color={colors.gold} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 4 }}>
              How geo-gating works
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>
              Verifying your identity unlocks voting on proposals tied to your country, province, and city. Global proposals are open to anyone. Vote integrity depends on the gates above — one verified person, one ballot per proposal.
            </Text>
          </View>
        </Animated.View>

        {!isVerified && (
          <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ marginTop: SPACING.lg }}>
            <TouchableOpacity onPress={handleVerify} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.gold, colors.goldDark ?? '#A68523']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: SPACING.md,
                  borderRadius: BORDER_RADIUS.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>
                  Verify identity to unlock
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.sm, lineHeight: 16 }}>
              Free · takes 2 minutes · government-issued ID
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function TierRow({ tier, index }: { tier: Tier; index: number }) {
  const { colors } = useTheme();
  const onPress = () => {
    if (!tier.eligible) return;
    Haptics.selectionAsync();
    router.push({
      pathname: '/modals/community-proposals',
      params: { scope: tier.key === 'federal' ? 'country' : tier.key === 'provincial' ? 'state' : tier.key === 'municipal' ? 'city' : 'global', scopeName: tier.locationName ?? '', icon: tier.flag ?? '' },
    });
  };

  const isMuted = !tier.eligible;
  const accentColor = tier.eligible ? colors.gold : colors.textTertiary;

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(400)}>
      <Pressable
        onPress={onPress}
        disabled={!tier.eligible}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: SPACING.md,
          backgroundColor: pressed ? colors.surface : colors.surface,
          opacity: pressed ? 0.85 : 1,
          borderColor: tier.eligible ? `${colors.gold}40` : colors.border,
          borderWidth: 1,
          borderRadius: BORDER_RADIUS.md,
          marginBottom: 12,
          gap: 14,
        })}
      >
        {/* Flag / Icon disc on the spine */}
        <View style={{
          width: 54, height: 54, borderRadius: 27,
          backgroundColor: tier.eligible ? `${colors.gold}15` : colors.surfaceElevated ?? colors.background,
          borderColor: tier.eligible ? `${colors.gold}50` : colors.border,
          borderWidth: 1,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {tier.flag && tier.flag.length <= 4 ? (
            <Text style={{ fontSize: tier.flag.startsWith('🌍') ? 24 : tier.flag.length === 2 ? 13 : 22, fontWeight: '700', color: accentColor, letterSpacing: 0.5 }}>
              {tier.flag}
            </Text>
          ) : (
            <Ionicons name={tier.icon as any} size={22} color={accentColor} />
          )}
        </View>

        {/* Tier info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: isMuted ? colors.textTertiary : colors.text, letterSpacing: -0.1 }} numberOfLines={1}>
              {tier.locationName ?? '—'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: accentColor }}>
              {tier.label}
            </Text>
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textTertiary, opacity: 0.6 }} />
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{tier.scopeLabel}</Text>
          </View>
          {tier.eligible ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{tier.active}</Text> active
              <Text style={{ color: colors.textTertiary }}> · {tier.total} total</Text>
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <Ionicons name="lock-closed" size={11} color={colors.textTertiary} />
              <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                {tier.locationName ? 'Verify identity to unlock' : 'No location on file'}
              </Text>
            </View>
          )}
        </View>

        {tier.eligible && (
          <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        )}
      </Pressable>
    </Animated.View>
  );
}
