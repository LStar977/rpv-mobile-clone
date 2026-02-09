import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Button, TierBadge } from '../../components/ui';
import type { UserTier } from '../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

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
      <View style={[styles.menuIconBg, { backgroundColor: `${colors.gold}15` }]}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
          backgroundColor: selected ? colors.gold : colors.surface,
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
  const { user, logout, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [userTier, setUserTier] = useState<UserTier>('free');

  // Fetch user's subscription tier
  useEffect(() => {
    const fetchTier = async () => {
      // Demo account should appear as premium (for App Store review)
      const isDemoAccount = user?.email === 'demo@represent.app';
      if (isDemoAccount) {
        setUserTier('premium');
        return;
      }

      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/api/stripe/subscription`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.tier === 'premium' && data.status === 'active') {
            setUserTier('premium');
          } else if (data.verificationPaid || data.tier === 'verified') {
            setUserTier('verified');
          } else {
            setUserTier('free');
          }
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      }
    };

    fetchTier();
  }, [token, user?.email]);

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
    // Demo account should use hardcoded location for App Store review
    const isDemoAccount = user?.email === 'demo@represent.app';
    if (isDemoAccount) {
      return 'Toronto, Ontario, Canada';
    }
    const parts = [user?.city, user?.state, user?.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const themeLabel =
    themePreference === 'system' ? `System (${isDark ? 'Dark' : 'Light'})` :
    themePreference === 'dark' ? 'Dark' : 'Light';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 36 }]} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}
        >
          <LinearGradient
            colors={[`${colors.gold}10`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          <View style={[styles.avatar, { backgroundColor: colors.gold, ...SHADOWS.glow }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>{getInitial()}</Text>
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>{user?.name || 'Citizen'}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{user?.email || ''}</Text>

          <View style={styles.tierBadgeContainer}>
            <TierBadge
              tier={userTier}
              size="md"
              onPress={() => router.push('/modals/subscription')}
            />
          </View>

          {getLocationString() && (
            <View style={[styles.locationBadge, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="location" size={14} color={colors.gold} />
              <Text style={[styles.locationText, { color: colors.gold }]}>{getLocationString()}</Text>
            </View>
          )}
        </Animated.View>

        {/* Menu Card */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <MenuItem icon="business-outline" label="My Organizations" onPress={() => navigateTo('/modals/organizations')} delay={300} />
          <MenuItem icon="card-outline" label="Subscription" onPress={() => navigateTo('/modals/subscription')} delay={350} />
          <MenuItem icon="time-outline" label="Voting History" onPress={() => navigateTo('/modals/voting-history')} delay={400} />
          <MenuItem icon="analytics-outline" label="Analytics" onPress={() => navigateTo('/modals/analytics')} delay={450} />
          <MenuItem icon="trophy-outline" label="Badges & Achievements" onPress={() => navigateTo('/modals/badges')} delay={500} />
          <MenuItem icon="settings-outline" label="Settings & Privacy" onPress={() => navigateTo('/modals/privacy')} delay={550} showBorder={false} />
        </Animated.View>

        {/* Theme Card */}
        <Animated.View
          entering={FadeInUp.delay(350).duration(400)}
          style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.themeHeader}>
            <View style={[styles.themeIconBg, { backgroundColor: `${colors.gold}15` }]}>
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
          style={[styles.versionText, { color: colors.textTertiary }]}
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
    paddingHorizontal: SPACING.lg,
    // paddingTop is set dynamically via insets
    paddingBottom: 40,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    padding: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  avatarText: { fontSize: 36, fontWeight: '700' },
  userName: { ...TYPOGRAPHY.headlineLarge, marginBottom: SPACING.xs },
  userEmail: { ...TYPOGRAPHY.bodyMedium, marginBottom: SPACING.sm },
  tierBadgeContainer: {
    marginBottom: SPACING.lg,
  },

  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  locationText: { ...TYPOGRAPHY.labelMedium },

  // Menu Card
  menuCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
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
  logoutContainer: { marginBottom: SPACING.xl },
  versionText: { ...TYPOGRAPHY.bodySmall, textAlign: 'center' },
  bottomPadding: { height: 100 },
});
