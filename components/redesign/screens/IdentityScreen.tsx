// Redesign · Screen 10 — Identity
// The verified civic identity CARD is the centerpiece (a tasteful credential /
// press-pass — NOT a crypto wallet). Below it: civic stats (ballots cast),
// badges, and entries into history/settings. Wired to the auth store + userApi
// + badgesApi.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../lib/auth';
import { userApi, badgesApi } from '../../../lib/api';
import { T, Eyebrow, TrustChip, Button } from '../index';
import { SPACE, RADIUS, FONTS, regionLabel } from '../../../lib/redesign';

export function IdentityScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [ballots, setBallots] = useState<number | null>(null);
  const [badges, setBadges] = useState<any[]>([]);

  const verified = !!user?.verified;
  const citizen = !!user?.citizenshipVerified;
  const region = regionLabel(user) || 'Region not set';

  const load = useCallback(async () => {
    const voted = await userApi.getVotedProposals();
    if (!voted.error && Array.isArray(voted.data)) setBallots(voted.data.length);
    const b = await badgesApi.getUserBadges();
    if (!b.error && Array.isArray(b.data)) setBadges(b.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Short, non-sensitive credential id derived from the account id (NOT the wallet).
  const credId = (user?.id ?? 'RPV').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase().padStart(8, '0');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 120 }}>
        <Eyebrow>Identity</Eyebrow>

        {/* ── the credential card ── */}
        <View
          style={{
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: colors.goldSurfaceStrong,
            backgroundColor: colors.surfaceElevated,
            padding: SPACE.xxl,
            gap: SPACE.lg,
            overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: 2 }}>
              <T variant="monoLabel" color={colors.gold}>Represent</T>
              <T variant="monoLabel" color={colors.textTertiary}>Verified civic credential</T>
            </View>
            <TrustChip label={verified ? 'Verified' : 'Unverified'} kind={verified ? 'gold' : 'neutral'} dot />
          </View>

          <View style={{ gap: SPACE.xs, marginTop: SPACE.md }}>
            <T variant="titleSerif" color={colors.text}>{user?.name ?? 'Your name'}</T>
            <T variant="body" color={colors.textSecondary}>{region}</T>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
            {verified && <TrustChip label="Identity verified" kind="gold" />}
            {citizen && <TrustChip label="Citizen verified" kind="citizens" />}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: SPACE.sm }}>
            <T variant="monoData" color={colors.textTertiary} style={{ fontFamily: FONTS.monoMedium }}>
              ID · {credId}
            </T>
            <T variant="monoData" color={colors.textTertiary}>one person · one ballot</T>
          </View>
        </View>

        {/* ── civic stats ── */}
        <View style={{ flexDirection: 'row', gap: SPACE.md }}>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.xs }}>
            <T variant="tallyBig" color={colors.gold} style={{ fontSize: 28, lineHeight: 32 }}>
              {ballots ?? '—'}
            </T>
            <T variant="caption" color={colors.textTertiary}>Ballots cast</T>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.xs }}>
            <T variant="tallyBig" color={colors.gold} style={{ fontSize: 28, lineHeight: 32 }}>
              {badges.length}
            </T>
            <T variant="caption" color={colors.textTertiary}>Civic badges</T>
          </View>
        </View>

        {/* ── badges ── */}
        {badges.length > 0 && (
          <View style={{ gap: SPACE.md }}>
            <Eyebrow>Badges</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
              {badges.map((b, i) => (
                <View
                  key={b.id ?? i}
                  style={{
                    backgroundColor: colors.goldSurface,
                    borderRadius: RADIUS.chip,
                    paddingHorizontal: SPACE.lg,
                    paddingVertical: SPACE.sm,
                    borderWidth: 1,
                    borderColor: colors.goldSurfaceStrong,
                  }}
                >
                  <T variant="bodyMedium" color={colors.gold}>
                    {b.name ?? b.title ?? b.badgeName ?? 'Badge'}
                  </T>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── entries ── */}
        <View style={{ gap: SPACE.sm }}>
          <Button label="Voting history" variant="secondary" onPress={() => router.push('/redesign-history')} />
          <Button label="Civic analytics" variant="secondary" onPress={() => router.push('/redesign-analytics')} />
          <Button label="Settings" variant="secondary" onPress={() => router.push('/redesign-settings')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
