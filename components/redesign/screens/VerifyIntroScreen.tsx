// Redesign · Screen 03a — Verify intro
// The highest-stakes ask (government ID + selfie), so it explains WHY, WHAT you
// need, and reassures on privacy BEFORE handing off to the real capture flow.
// It does NOT do capture itself — it routes into the existing, working KYC
// WebView flow (/modals/verification-payment → veriff), which stays untouched.
import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../lib/auth';
import { T, Eyebrow, Button, TrustChip } from '../index';
import { SPACE, RADIUS } from '../../../lib/redesign';

const STEPS = [
  { n: '1', title: 'Government ID', body: 'A passport, driver’s licence, or provincial ID.' },
  { n: '2', title: 'A quick selfie', body: 'A liveness check confirms the ID is really you.' },
  { n: '3', title: 'That’s it', body: 'Your region comes from the document — no GPS, no forms.' },
];

export function VerifyIntroScreen() {
  const { colors } = useTheme();
  const verified = !!useAuthStore((s) => s.user)?.verified;

  if (verified) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: SPACE.xxl, justifyContent: 'center', gap: SPACE.lg }}>
          <TrustChip label="Verified" kind="gold" dot />
          <T variant="heroSerif" color={colors.text} style={{ fontSize: 34, lineHeight: 38 }}>You're verified</T>
          <T variant="bodyLg" color={colors.textSecondary}>Your ballots count as verified. You can vote on anything open to your region.</T>
          <Button label="Start voting" onPress={() => router.replace('/(redesign)/vote')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 40 }}>
        <View style={{ gap: SPACE.md }}>
          <Eyebrow>Verify your identity</Eyebrow>
          <T variant="heroSerif" color={colors.text} style={{ fontSize: 32, lineHeight: 36 }}>
            One check. Then your voice is real.
          </T>
          <T variant="bodyLg" color={colors.textSecondary}>
            Verification is what makes Represent trustworthy — one person, one ballot, no bots. It takes about two minutes and it’s free.
          </T>
        </View>

        {/* steps */}
        <View style={{ gap: SPACE.md }}>
          {STEPS.map((s) => (
            <View key={s.n} style={{ flexDirection: 'row', gap: SPACE.lg, backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl }}>
              <T variant="tally" color={colors.gold}>{s.n}</T>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodyMedium" color={colors.text}>{s.title}</T>
                <T variant="body" color={colors.textTertiary}>{s.body}</T>
              </View>
            </View>
          ))}
        </View>

        {/* privacy reassurance */}
        <View style={{ backgroundColor: colors.goldSurface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.goldSurfaceStrong, padding: SPACE.xl, gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.gold}>Your privacy</T>
          <T variant="body" color={colors.textSecondary}>
            Verification is handled by a certified provider (Didit). Represent receives the extracted fields we need — not a stored copy of your documents.
          </T>
        </View>

        <View style={{ gap: SPACE.sm }}>
          <Button label="Verify now" onPress={() => router.push('/modals/verification-payment')} />
          <Button label="Maybe later" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
