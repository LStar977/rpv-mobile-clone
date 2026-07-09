import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, SPACING, FONTS } from '../../lib/theme';
import { EmptyState } from '../../components/ui';

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS — screen 15 + G2 toggles
// There is no server-side notification feed (lib/notifications.ts only
// registers push tokens and fires local notifications), so the list renders
// an honest empty state — no fabricated rows. Per-type preferences persist
// locally and are the single source of truth for which civic notification
// kinds this device wants.
// ═══════════════════════════════════════════════════════════════════════════════

// AsyncStorage key follows the app's `@represent_*` convention
// (see DEMO_COMMENTS_STORAGE_KEY in lib/api.ts).
export const NOTIFICATION_PREFS_KEY = '@represent_notification_prefs';

export interface NotificationPrefs {
  /** A new proposal opens for voting in your scope. */
  newProposals: boolean;
  /** 24h before a deadline you have not voted on (lib/notifications.ts scheduleDeadlineReminder). */
  deadlineReminders: boolean;
  /** A ballot you cast is decided / recorded (lib/notifications.ts showVoteConfirmation). */
  results: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  newProposals: true,
  deadlineReminders: true,
  results: true,
};

interface ToggleRow {
  key: keyof NotificationPrefs;
  title: string;
  description: string;
}

// Copy per G2 (per-type toggle reference) adapted to the three civic kinds.
const TOGGLE_ROWS: ToggleRow[] = [
  {
    key: 'newProposals',
    title: 'New proposals',
    description: 'When a ballot opens for voting in your scope',
  },
  {
    key: 'deadlineReminders',
    title: 'Ballots closing soon',
    description: '24h before a deadline you have not voted on',
  },
  {
    key: 'results',
    title: 'Results in',
    description: 'When a ballot you cast is decided',
  },
];

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
        if (stored) {
          setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
        }
      } catch {
        // Unreadable prefs fall back to defaults — never block the screen.
      } finally {
        setPrefsLoaded(true);
      }
    })();
  }, []);

  const togglePref = (key: keyof NotificationPrefs) => {
    Haptics.selectionAsync();
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header — 40px circular back button + serif 28 title (mock 15) */}
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          style={[
            styles.backButton,
            { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + SPACING['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* The list — no feed source exists, so say so honestly (22b). */}
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
            subtitle="Notifications you receive will appear here."
            delay={100}
          />
        </View>

        {/* Per-type toggles (G2) */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>NOTIFY ME ABOUT</Text>
          <View
            style={[
              styles.prefsCard,
              { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
            ]}
          >
            {TOGGLE_ROWS.map((row, i) => (
              <View
                key={row.key}
                style={[
                  styles.prefRow,
                  i < TOGGLE_ROWS.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderSubtle,
                  },
                ]}
              >
                <View style={styles.prefText}>
                  <Text style={[styles.prefTitle, { color: colors.text }]}>{row.title}</Text>
                  <Text style={[styles.prefDescription, { color: colors.textTertiary }]}>
                    {row.description}
                  </Text>
                </View>
                <Switch
                  value={prefs[row.key]}
                  onValueChange={() => togglePref(row.key)}
                  disabled={!prefsLoaded}
                  trackColor={{ false: colors.surfaceHighlight, true: colors.goldFill }}
                  thumbColor={prefs[row.key] ? colors.black : colors.textTertiary}
                  ios_backgroundColor={colors.surfaceHighlight}
                  accessibilityLabel={`${row.title} notifications`}
                />
              </View>
            ))}
          </View>
          <Text style={[styles.footnote, { color: colors.textTertiary }]}>
            Notifications are civic, never promotional.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.34,
  },
  scrollContent: {
    paddingHorizontal: SPACING.screenPadding,
  },
  emptyWrap: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47,
    marginBottom: SPACING.md,
  },
  prefsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: 13,
  },
  prefText: {
    flex: 1,
    gap: 1,
  },
  prefTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  prefDescription: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  footnote: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },
});
