import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
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
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
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

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/');
          },
        },
      ]
    );
  };

  const navigateTo = (screen: string) => router.push(screen as any);

  const getInitial = () =>
    user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  const getLocationString = () => {
    const parts = [user?.city, user?.state, user?.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Header */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}
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

          {getLocationString() && (
            <View style={[styles.locationBadge, { backgroundColor: colors.goldLight }]}>
              <Ionicons name="location" size={14} color={colors.gold} />
              <Text style={[styles.locationText, { color: colors.gold }]}>{getLocationString()}</Text>
            </View>
          )}
        </Animated.View>

        {/* Menu Card */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.menuCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          <MenuItem
            icon="card-outline"
            label="Subscription"
            onPress={() => navigateTo('/modals/subscription')}
            delay={300}
          />
          <MenuItem
            icon="wallet-outline"
            label="Connected Wallet"
            onPress={() => navigateTo('/modals/wallet')}
            delay={350}
          />
          <MenuItem
            icon="time-outline"
            label="Voting History"
            onPress={() => navigateTo('/modals/voting-history')}
            delay={400}
          />
          <MenuItem
            icon="trophy-outline"
            label="Badges & Achievements"
            onPress={() => navigateTo('/modals/badges')}
            delay={450}
          />
          <MenuItem
            icon="settings-outline"
            label="Settings & Privacy"
            onPress={() => navigateTo('/modals/privacy')}
            delay={500}
            showBorder={false}
          />
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
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 80,
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
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
  },
  userName: {
    ...TYPOGRAPHY.headlineLarge,
    marginBottom: SPACING.xs,
  },
  userEmail: {
    ...TYPOGRAPHY.bodyMedium,
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
  locationText: {
    ...TYPOGRAPHY.labelMedium,
  },
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
  // Logout
  logoutContainer: {
    marginBottom: SPACING.xl,
  },
  versionText: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
  },
  bottomPadding: {
    height: 100,
  },
});
