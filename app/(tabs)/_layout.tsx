import { useState, useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { View, StyleSheet, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useTheme, SHADOWS, ANIMATION } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { Onboarding, hasCompletedOnboarding, resetOnboarding } from '../../components/Onboarding';
import {
  registerForPushNotifications,
  savePushTokenToServer,
  addNotificationResponseListener,
} from '../../lib/notifications';

// Custom Tab Bar Icon with animation
function TabIcon({
  name,
  color,
  focused,
  premiumBadge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  // Small gold lock dot for premium-gated tabs so free users aren't
  // surprised by a paywall after tapping (Sentinel).
  premiumBadge?: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(focused ? 1 : 0.85);
  const opacity = useSharedValue(focused ? 1 : 0);

  scale.value = withSpring(focused ? 1 : 0.85, ANIMATION.spring.gentle);
  opacity.value = withSpring(focused ? 1 : 0, ANIMATION.spring.gentle);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0, 1], [0.5, 1]) }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.3,
    transform: [{ scale: interpolate(opacity.value, [0, 1], [0.8, 1.2]) }],
  }));

  return (
    <View style={styles.iconContainer}>
      {/* Glow effect behind active icon */}
      <Animated.View
        style={[
          styles.iconGlow,
          { backgroundColor: colors.gold },
          glowAnimatedStyle,
        ]}
      />
      <Animated.View style={iconAnimatedStyle}>
        <Ionicons
          name={focused ? name.replace('-outline', '') as any : name}
          size={24}
          color={color}
        />
        {premiumBadge && (
          <View style={[styles.premiumBadge, { backgroundColor: colors.gold }]}>
            <Ionicons name="lock-closed" size={7} color="#000" />
          </View>
        )}
      </Animated.View>
      <Animated.View
        style={[
          styles.activeDot,
          { backgroundColor: colors.gold },
          dotAnimatedStyle,
        ]}
      />
    </View>
  );
}

const DEMO_EMAIL = 'demo@represent.app';

export default function TabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuthStore();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  // Premium-gated tabs show a small lock badge for non-premium users.
  const isPremiumUser =
    user?.email === DEMO_EMAIL ||
    !!user?.isPremium ||
    user?.subscriptionStatus === 'active';

  useEffect(() => {
    const checkOnboarding = async () => {
      // Always reset onboarding for demo account (App Store review preview)
      if (user?.email === DEMO_EMAIL) {
        await resetOnboarding();
      }
      const completed = await hasCompletedOnboarding();
      if (!completed) {
        setShowOnboarding(true);
      }
      setOnboardingChecked(true);
    };
    checkOnboarding();
  }, [user?.email]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Push notification registration. Waits until onboarding is settled so
  // the iOS permission prompt never stacks on the onboarding modal. iOS
  // only ever shows the system prompt once, so re-running on later
  // sessions is a no-op that just refreshes the stored token. Demo account
  // is excluded — reviewers' devices must not be registered against it.
  useEffect(() => {
    if (!onboardingChecked || showOnboarding) return;
    if (!user?.id || !token || user.email === DEMO_EMAIL) return;
    let alive = true;
    (async () => {
      const pushToken = await registerForPushNotifications();
      if (alive && pushToken) {
        await savePushTokenToServer(user.id, token);
      }
    })();
    return () => { alive = false; };
  }, [onboardingChecked, showOnboarding, user?.id, user?.email, token]);

  // Route notification taps. All current server pushes carry a proposalId
  // (new proposal, deadline reminder, results) — land the user on the
  // voting tab, which surfaces the relevant proposal at the top of the deck.
  useEffect(() => {
    const sub = addNotificationResponseListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.proposalId || data?.type === 'new_proposal' || data?.type === 'deadline_reminder') {
        router.push('/(tabs)/proposals');
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
    <Tabs
      key={isDark ? 'dark' : 'light'}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isDark ? 'rgba(10, 10, 12, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderTopColor: isDark ? 'rgba(201, 162, 39, 0.15)' : 'rgba(0, 0, 0, 0.06)',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 14,
          paddingTop: 14,
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 74,
          ...SHADOWS.lg,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.4,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="proposals"
        options={{
          title: 'Vote',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="document-text-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sentinel"
        options={{
          title: 'Sentinel',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              name="sparkles-outline"
              color={color}
              focused={focused}
              premiumBadge={!isPremiumUser}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Groups',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>

    {/* Onboarding Modal - shows after sign-in for first-time users */}
    <Modal
      visible={showOnboarding}
      animationType="fade"
      statusBarTranslucent
      presentationStyle="fullScreen"
    >
      <Onboarding onComplete={handleOnboardingComplete} />
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 30,
  },
  iconGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
  premiumBadge: {
    position: 'absolute',
    top: -3,
    right: -7,
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
