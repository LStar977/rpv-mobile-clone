// Redesign · Screens 01a/01b — Welcome / Onboarding
// Shown once to first-time users (the cutover retired the old tabs-layout
// onboarding, so this restores it for the 4-tab app). Drop-in `onComplete`
// signature matches the existing Onboarding component. Persists the SAME
// AsyncStorage key so hasCompletedOnboarding() stays authoritative.
import React, { useState } from 'react';
import { View, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../lib/theme';
import { T, Eyebrow, Button } from '../index';
import { SPACE } from '../../../lib/redesign';

const ONBOARDING_KEY = '@represent_onboarding_complete'; // must match components/Onboarding.tsx

const PANELS = [
  {
    eyebrow: 'Represent',
    title: 'Your verified voice counts',
    body: 'Real people, verified by government ID. One person, one vote — on the issues that actually affect your life.',
  },
  {
    eyebrow: 'How it works',
    title: 'Verify once. Vote on anything.',
    body: 'A quick identity check unlocks every ballot open to your region — from a national referendum to your neighbourhood.',
  },
  {
    eyebrow: 'The count',
    title: 'A number nobody can dismiss',
    body: 'Every ballot is recorded on a public, tamper-evident ledger. When results land, they’re checkable by anyone.',
  },
];

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const last = step === PANELS.length - 1;
  const panel = PANELS[step];

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'completed');
    } catch {
      /* non-fatal */
    }
    onComplete();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: SPACE.xxl, justifyContent: 'center', gap: SPACE.lg }}>
        <Eyebrow>{panel.eyebrow}</Eyebrow>
        <T variant="heroSerif" color={colors.text}>{panel.title}</T>
        <T variant="bodyLg" color={colors.textSecondary}>{panel.body}</T>
      </View>

      {/* progress dots */}
      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', paddingBottom: SPACE.xl }}>
        {PANELS.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === step ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === step ? colors.gold : colors.border,
            }}
          />
        ))}
      </View>

      <View style={{ padding: SPACE.xxl, paddingTop: 0, gap: SPACE.sm }}>
        <Button label={last ? 'Get started' : 'Next'} onPress={() => (last ? finish() : setStep((s) => s + 1))} />
        {!last && <Button label="Skip" variant="ghost" onPress={finish} />}
      </View>
    </SafeAreaView>
  );
}
