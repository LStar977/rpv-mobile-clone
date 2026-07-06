// Redesign · Screen 14 — Settings
// Theme (system/light/dark), account, legal, and sign out. Wired to the theme
// context + auth store. Heavier/existing flows (delete account, full legal text)
// route into the current modals so nothing regresses.
import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme, type ThemePreference } from '../../../lib/theme';
import { useAuthStore } from '../../../lib/auth';
import { T, Eyebrow, Button } from '../index';
import { SPACE, RADIUS } from '../../../lib/redesign';

function Row({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACE.lg, paddingHorizontal: SPACE.lg, backgroundColor: colors.surface, borderRadius: RADIUS.button, borderWidth: 1, borderColor: colors.border }}>
        <T variant="bodyMedium" color={danger ? colors.error : colors.text}>{label}</T>
        <T variant="body" color={colors.textTertiary}>›</T>
      </View>
    </Pressable>
  );
}

export function SettingsScreen() {
  const { colors, themePreference, setThemePreference } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  const themes: { key: ThemePreference; label: string }[] = [
    { key: 'system', label: 'System' },
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xxl, paddingBottom: 60 }}>
        <View style={{ gap: SPACE.xs }}>
          <Eyebrow>Settings</Eyebrow>
          <T variant="titleSerif" color={colors.text}>Your account</T>
        </View>

        {/* appearance */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>Appearance</T>
          <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
            {themes.map((t) => {
              const on = themePreference === t.key;
              return (
                <Pressable key={t.key} onPress={() => setThemePreference(t.key)} style={{ flex: 1 }}>
                  <View style={{ alignItems: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.button, backgroundColor: on ? colors.goldSurface : colors.surface, borderWidth: 1, borderColor: on ? colors.gold : colors.border }}>
                    <T variant="bodyMedium" color={on ? colors.gold : colors.textSecondary}>{t.label}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* account */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>Account</T>
          <Row label="Voting history" onPress={() => router.push('/redesign-history')} />
          <Row label="Notifications" onPress={() => router.push('/redesign-notifications')} />
          <Row label="Subscription" onPress={() => router.push('/modals/subscription')} />
        </View>

        {/* legal */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>Legal</T>
          <Row label="Privacy policy" onPress={() => router.push('/modals/privacy')} />
          <Row label="Terms of service" onPress={() => router.push('/modals/legal')} />
        </View>

        {/* sign out / delete */}
        <View style={{ gap: SPACE.sm }}>
          <Button label="Sign out" variant="secondary" onPress={() => { logout(); router.replace('/'); }} />
          <Row label="Delete account" danger onPress={() => router.push('/modals/legal')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
