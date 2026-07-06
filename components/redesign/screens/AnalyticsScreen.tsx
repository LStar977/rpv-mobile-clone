// Redesign · Screen 20 — Civic analytics (premium)
// Premium-gated (derived from auth: isPremium || subscriptionStatus active — NOT
// the Stripe-only endpoint that misreports IAP subscribers, per audit). Shows the
// user's proposal/vote analytics from analyticsApi.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../lib/auth';
import { analyticsApi, type AnalyticsData } from '../../../lib/api';
import { T, Eyebrow, Button, TallyBar } from '../index';
import { SPACE, RADIUS } from '../../../lib/redesign';

function Stat({ big, label }: { big: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.xs }}>
      <T variant="tallyBig" color={colors.gold} style={{ fontSize: 28, lineHeight: 32 }}>{big}</T>
      <T variant="caption" color={colors.textTertiary}>{label}</T>
    </View>
  );
}

export function AnalyticsScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isPremium = !!user?.isPremium || user?.subscriptionStatus === 'active';
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await analyticsApi.getProposalAnalytics();
    if (res.error) setError(res.error);
    else setData(res.data);
  }, []);

  useEffect(() => {
    if (isPremium) load();
  }, [isPremium, load]);

  if (!isPremium) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, padding: SPACE.xl, justifyContent: 'center', gap: SPACE.lg }}>
          <Eyebrow>Civic analytics</Eyebrow>
          <T variant="titleSerif" color={colors.text}>See how your region is trending</T>
          <T variant="body" color={colors.textSecondary}>Analytics are part of Sentinel — unlock deeper insight into proposals and your verified region.</T>
          <Button label="Unlock Sentinel" onPress={() => router.push('/redesign-sentinel')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 60 }}>
        <View style={{ gap: SPACE.xs }}>
          <Eyebrow>Civic analytics</Eyebrow>
          <T variant="titleSerif" color={colors.text}>Your civic activity</T>
        </View>

        {data === null && !error && <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={colors.gold} /></View>}
        {error && (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: SPACE.lg }}>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>{error}</T>
            <Button label="Try again" variant="secondary" fullWidth={false} onPress={load} />
          </View>
        )}

        {data && (
          <>
            <View style={{ flexDirection: 'row', gap: SPACE.md }}>
              <Stat big={String(data.totalProposals ?? 0)} label="Proposals" />
              <Stat big={String(data.totalVotes ?? 0)} label="Total votes" />
            </View>
            <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.md }}>
              <T variant="monoLabel" color={colors.textTertiary}>Support vs oppose</T>
              <TallyBar support={data.supportVotes ?? 0} oppose={data.opposeVotes ?? 0} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
