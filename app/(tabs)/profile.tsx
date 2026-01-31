import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ThemePreference } from '../../lib/theme';
import { Button } from '../../components/ui';

function MenuItem({
  icon,
  label,
  onPress,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.menuItem, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
      onPress={onPress}
    >
      <View style={[styles.menuIconBg, { backgroundColor: colors.goldLight }]}
      >
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.menuDesc, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function ThemeChip({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: ThemePreference;
  selected: boolean;
  onPress: (v: ThemePreference) => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.themeChip,
        {
          backgroundColor: selected ? colors.gold : colors.cardBg,
          borderColor: selected ? colors.gold : colors.border,
        },
      ]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.themeChipText, { color: selected ? colors.background : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { colors, themePreference, setThemePreference } = useTheme();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <LinearGradient colors={[colors.backgroundSecondary, colors.background]} style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{user?.name || 'Citizen'}</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{user?.email || 'No email on file'}</Text>
        <View style={styles.heroMeta}>
          <View style={[styles.heroChip, { backgroundColor: colors.cardBg }]}
          >
            <Ionicons name="location" size={14} color={colors.gold} />
            <Text style={[styles.heroChipText, { color: colors.text }]}
            >{user?.city || user?.state || user?.country || 'Location not set'}</Text>
          </View>
          <View style={[styles.heroChip, { backgroundColor: colors.cardBg }]}
          >
            <Ionicons name={user?.verified ? 'shield-checkmark' : 'alert-circle'} size={14} color={colors.gold} />
            <Text style={[styles.heroChipText, { color: colors.text }]}
            >{user?.verified ? 'Verified' : 'Not verified'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Account</Text>
        <View style={styles.menuList}>
          <MenuItem
            icon="shield-checkmark"
            label="Identity verification"
            description="Manage documents and passport status."
            onPress={() => router.push('/(tabs)/identity')}
          />
          <MenuItem
            icon="notifications"
            label="Notifications"
            description="Customize how you get updates."
            onPress={() => Alert.alert('Coming soon', 'Notification settings are coming soon.')}
          />
          <MenuItem
            icon="document-text"
            label="My proposals"
            description="Track drafts and submitted proposals."
            onPress={() => router.push('/(tabs)/proposals')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme</Text>
        <View style={styles.themeRow}>
          <ThemeChip label="System" value="system" selected={themePreference === 'system'} onPress={setThemePreference} />
          <ThemeChip label="Light" value="light" selected={themePreference === 'light'} onPress={setThemePreference} />
          <ThemeChip label="Dark" value="dark" selected={themePreference === 'dark'} onPress={setThemePreference} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Support</Text>
        <View style={styles.menuList}>
          <MenuItem
            icon="help-circle"
            label="Help center"
            description="Read guides and FAQs."
            onPress={() => Alert.alert('Help center', 'Help center is coming soon.')}
          />
          <MenuItem
            icon="lock-closed"
            label="Privacy"
            description="Review data policies."
            onPress={() => Alert.alert('Privacy', 'Privacy details will be available soon.')}
          />
        </View>
      </View>

      <Button title="Sign out" onPress={handleLogout} variant="secondary" style={styles.logoutButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  heroTitle: {
    ...TYPOGRAPHY.displaySmall,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xs,
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  heroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  heroChipText: {
    ...TYPOGRAPHY.bodySmall,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.sm,
  },
  menuList: {
    gap: SPACING.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    ...SHADOWS.soft,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    ...TYPOGRAPHY.bodyLarge,
  },
  menuDesc: {
    ...TYPOGRAPHY.bodySmall,
  },
  themeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  themeChip: {
    flex: 1,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  themeChipText: {
    ...TYPOGRAPHY.labelLarge,
  },
  logoutButton: {
    marginTop: SPACING.md,
  },
});
