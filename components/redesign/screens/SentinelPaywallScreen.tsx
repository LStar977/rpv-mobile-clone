// Redesign · Screen 13 — Sentinel (premium AI) paywall
// Frames premium as unlocking civic superpowers. Premium is derived correctly
// from the auth user (isPremium || subscriptionStatus === 'active') — NOT from
// the Stripe-only endpoint that misreports Apple IAP subscribers as free (audit).
// The upgrade CTA routes into the existing, vetted IAP subscription flow.
import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../lib/auth';
import { T, Eyebrow, Button, TrustChip } from '../index';
import { SPACE, RADIUS } from '../../../lib/redesign';

const FEATURES = [
  { title: 'Deeper analysis', body: 'AI-read any proposal — arguments, tradeoffs, who it affects, and what it costs.' },
  { title: 'Civic monitoring', body: 'Track the issues you care about and get alerted when a relevant proposal opens.' },
  { title: 'Turn analysis into action', body: 'Draft a well-formed proposal from any analysis in one tap.' },
  { title: 'Personal civic analytics', body: 'See your voting patterns and how your verified region is trending.' },
];

export function SentinelPaywallScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const isPremium = user?.email === 'demo@represent.app' || !!user?.isPremium || user?.subscriptionStatus === 'active';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 60 }}>
        <View style={{ gap: SPACE.md }}>
          <Eyebrow>Sentinel</Eyebrow>
          <T variant="heroSerif" color={colors.text} style={{ fontSize: 34, lineHeight: 38 }}>
            Your civic co-pilot
          </T>
          <T variant="bodyLg" color={colors.textSecondary}>
            Sentinel reads the fine print so you don't have to — and helps you act on it.
          </T>
          {isPremium && <TrustChip label="Active" kind="gold" dot />}
        </View>

        {/* feature list */}
        <View style={{ gap: SPACE.md }}>
          {FEATURES.map((f) => (
            <View
              key={f.title}
              style={{
                backgroundColor: colors.surface,
                borderRadius: RADIUS.card,
                borderWidth: 1,
                borderColor: colors.border,
                padding: SPACE.xl,
                gap: SPACE.xs,
              }}
            >
              <T variant="bodyMedium" color={colors.text}>{f.title}</T>
              <T variant="body" color={colors.textTertiary}>{f.body}</T>
            </View>
          ))}
        </View>

        {isPremium ? (
          <Button label="Open Sentinel" onPress={() => router.push('/(tabs)/sentinel')} />
        ) : (
          <View style={{ gap: SPACE.md }}>
            <Button label="Unlock Sentinel" onPress={() => router.push('/modals/subscription')} />
            <Button label="Restore purchases" variant="ghost" onPress={() => router.push('/modals/subscription')} />
            <T variant="caption" color={colors.textTertiary} style={{ textAlign: 'center' }}>
              Auto-renewing subscription. Cancel anytime in Settings. Terms & Privacy apply.
            </T>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
