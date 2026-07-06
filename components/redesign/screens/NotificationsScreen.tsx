// Redesign · Screen 15 — Notifications
// Civic, not spammy. The app's pushes (proposal opening, closing soon, results)
// are system-delivered; this screen explains what you'll be told and lets you
// manage it. Kept intentionally calm — no fake notification feed.
import React from 'react';
import { View, ScrollView, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../lib/theme';
import { T, Eyebrow, Button } from '../index';
import { SPACE, RADIUS } from '../../../lib/redesign';

const KINDS = [
  { title: 'A proposal opens for you', body: 'When something in your verified region opens for voting.' },
  { title: 'Closing soon', body: 'A reminder before a ballot you can still cast closes.' },
  { title: 'Results are in', body: 'When a proposal you voted on is decided.' },
  { title: 'Organization activity', body: 'Announcements and votes from groups you belong to.' },
];

export function NotificationsScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 60 }}>
        <View style={{ gap: SPACE.xs }}>
          <Eyebrow>Notifications</Eyebrow>
          <T variant="titleSerif" color={colors.text}>What we'll tell you</T>
        </View>

        <View style={{ gap: SPACE.md }}>
          {KINDS.map((k) => (
            <View key={k.title} style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.xs }}>
              <T variant="bodyMedium" color={colors.text}>{k.title}</T>
              <T variant="body" color={colors.textTertiary}>{k.body}</T>
            </View>
          ))}
        </View>

        <T variant="caption" color={colors.textTertiary}>
          Notifications are managed in your device settings. We never send political advertising.
        </T>
        <Button
          label="Open device settings"
          variant="secondary"
          onPress={() => Linking.openSettings?.() ?? (Platform.OS === 'ios' && Linking.openURL('app-settings:'))}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
