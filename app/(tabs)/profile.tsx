import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ThemePreference } from '../../lib/theme';
import { Button } from '../../components/ui';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Menu Item Component
function MenuItem({
  icon,
  label,
  onPress,
  delay = 0,
  showBorder = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  delay?: number;
  showBorder?: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(delay).duration(300)}
      style={[
        styles.menuItem,
        { borderBottomColor: showBorder ? colors.border : 'transparent' },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <View style={[styles.menuIconBg, { backgroundColor: colors.goldLight }]}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </AnimatedTouchable>
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
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 16, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.themeChip,
        {
          backgroundColor: selected ? colors.gold : colors.cardBg,
          borderColor: selected ? colors.gold : colors.border,
        },
        animatedStyle,
      ]}
      onPress={() => onPress(value)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Text style={[styles.themeChipText, { color: selected ? '#000' : colors.text }]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

export default function ProfileScreen() {
  const { colors, themePreference, setThemePreference, isDark } = useTheme();
  const { user, logout } = useAuthStore();
  const isVerified = Boolean(user?.verified);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const navigateTo = (screen: string) => router.push(screen as any);

  const getInitial = () =>
    user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  const getLocationString = () => {
    const parts = [user?.city, user?.state, user?.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const themeLabel =
    themePreference === 'system' ? `System (${isDark ? 'Dark' : 'Light'})` :
    themePreference === 'dark' ? 'Dark' : 'Light';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Account</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Manage your credentials, privacy, and preferences.
          </Text>
        </View>

        {/* Profile Header */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          <View style={styles.profileTopRow}>
            <View style={[styles.avatar, { backgroundColor: colors.cardBgLight, borderColor: colors.border }]}>
              <Text style={[styles.avatarText, { color: colors.text }]}>{getInitial()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={[
                  styles.verificationPill,
                  {
                    backgroundColor: isVerified ? colors.successLight : colors.warningLight,
                    borderColor: isVerified ? colors.success : colors.warning,
                  },
                ]}
              >
                <Ionicons
                  name={isVerified ? 'shield-checkmark' : 'shield-outline'}
                  size={12}
                  color={isVerified ? colors.success : colors.warning}
                />
                <Text
                  style={[
                    styles.verificationText,
                    { color: isVerified ? colors.success : colors.warning },
                  ]}
                >
                  {isVerified ? 'Verified Identity' : 'Verification Pending'}
                </Text>
              </View>
              <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'Citizen'}</Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email || ''}</Text>
            </View>
          </View>

          {getLocationString() && (
            <View style={[styles.locationBadge, { backgroundColor: colors.cardBgLight, borderColor: colors.border }]}>
              <Ionicons name="location" size={14} color={colors.textSecondary} />
              <Text style={[styles.locationText, { color: colors.textSecondary }]}>{getLocationString()}</Text>
            </View>
          )}
        </Animated.View>

        {/* Menu Card */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.menuCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          <MenuItem icon="card-outline" label="Subscription" onPress={() => navigateTo('/modals/subscription')} delay={300} />
          <MenuItem icon="wallet-outline" label="Connected Wallet" onPress={() => navigateTo('/modals/wallet')} delay={350} />
          <MenuItem icon="time-outline" label="Voting History" onPress={() => navigateTo('/modals/voting-history')} delay={400} />
          <MenuItem icon="trophy-outline" label="Badges & Achievements" onPress={() => navigateTo('/modals/badges')} delay={450} />
          <MenuItem icon="settings-outline" label="Settings & Privacy" onPress={() => navigateTo('/modals/privacy')} delay={500} showBorder={false} />
        </Animated.View>

        {/* Theme Card */}
        <Animated.View
          entering={FadeInUp.delay(350).duration(400)}
          style={[styles.themeCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          <View style={styles.themeHeader}>
            <View style={[styles.themeIconBg, { backgroundColor: colors.goldLight }]}>
              <Ionicons name="color-palette-outline" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.themeTitle, { color: colors.text }]}>Appearance</Text>
              <Text style={[styles.themeSubtitle, { color: colors.textSecondary }]}>
                Current: {themeLabel}
              </Text>
            </View>
          </View>

          <View style={styles.themeRow}>
            <ThemeChip label="System" value="system" selected={themePreference === 'system'} onPress={setThemePreference} />
            <ThemeChip label="Dark" value="dark" selected={themePreference === 'dark'} onPress={setThemePreference} />
            <ThemeChip label="Light" value="light" selected={themePreference === 'light'} onPress={setThemePreference} />
          </View>
        </Animated.View>

        {/* Logout Button */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.logoutContainer}>
          <Button
            title="Log Out"
            onPress={handleLogout}
            variant="danger"
            size="lg"
            fullWidth
            icon="log-out-outline"
          />
        </Animated.View>

        {/* App Version */}
        <Animated.Text
          entering={FadeIn.delay(700).duration(400)}
          style={[styles.versionText, { color: colors.textMuted }]}
        >
          Represent Wallet v1.0.0
        </Animated.Text>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 40,
  },

  // Page Header
  pageHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 56,
    paddingBottom: SPACING.md,
  },
  pageTitle: { ...TYPOGRAPHY.headlineLarge },
  pageSubtitle: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xxs },

  // Profile Card
  profileCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
    width: '100%',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 28, fontWeight: '700' },
  verificationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  verificationText: { ...TYPOGRAPHY.labelSmall },
  userName: { ...TYPOGRAPHY.headlineSmall, marginTop: SPACING.md },
  userEmail: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xxs },

  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
    marginTop: SPACING.md,
    borderWidth: 1,
  },
  locationText: { ...TYPOGRAPHY.labelSmall },

  // Menu Card
  menuCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
    marginHorizontal: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuLabel: {
    ...TYPOGRAPHY.bodyLarge,
    flex: 1,
    fontWeight: '500',
  },

  // Theme Card
  themeCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    marginHorizontal: SPACING.lg,
    ...SHADOWS.sm,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  themeIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
  },
  themeSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  themeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  themeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  themeChipText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '700',
  },

  // Logout
  logoutContainer: { marginBottom: SPACING.xl, marginHorizontal: SPACING.lg },
  versionText: { ...TYPOGRAPHY.bodySmall, textAlign: 'center', marginHorizontal: SPACING.lg },
  bottomPadding: { height: 100 },
});
