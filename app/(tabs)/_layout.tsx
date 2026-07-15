import { useState, useEffect, useRef } from 'react';
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
import { useTheme, ANIMATION, FONTS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { Onboarding, hasCompletedOnboarding, resetOnboarding } from '../../components/Onboarding';
import { AppOpenInterstitial, shouldShowPromo, markPromoShown } from '../../components/ui';
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
  const opacity = useSharedValue(focused ? 1 : 0);

  opacity.value = withSpring(focused ? 1 : 0, ANIMATION.spring.gentle);

  // Redesign spec: the active tab's icon sits in a 52×30 gold-tinted pill.
  const pillAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0, 1], [0.7, 1]) }],
  }));

  return (
    <View style={styles.iconContainer}>
      <Animated.View
        style={[
          styles.activePill,
          { backgroundColor: colors.goldSurfaceStrong },
          pillAnimatedStyle,
        ]}
      />
      <View>
        <Ionicons
          name={focused ? name.replace('-outline', '') as any : name}
          size={20}
          color={color}
        />
        {premiumBadge && (
          <View style={[styles.premiumBadge, { backgroundColor: colors.goldFill }]}>
            <Ionicons name="lock-closed" size={7} color="#000" />
          </View>
        )}
      </View>
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

  // ── S3a · App-open interstitial ──────────────────────────────────────
  // Full-screen Premium takeover on tab-layout mount. Manners: only after
  // onboarding is settled, never in the same session onboarding was shown,
  // only for authenticated non-premium non-demo users, at most once per
  // session, and capped by the global promo timestamp ("once a month" is
  // printed on its face, so shouldShowPromo('app-open') enforces 30 days).
  const [showInterstitial, setShowInterstitial] = useState(false);
  const interstitialAttemptedRef = useRef(false);
  const onboardingShownThisSessionRef = useRef(false);
  useEffect(() => {
    if (showOnboarding) onboardingShownThisSessionRef.current = true;
  }, [showOnboarding]);

  useEffect(() => {
    if (!onboardingChecked || showOnboarding) return;
    if (onboardingShownThisSessionRef.current) return; // never same session as onboarding
    if (interstitialAttemptedRef.current) return; // once per session
    if (!user?.id || !token || user.email === DEMO_EMAIL) return;
    const isPremiumUser = !!user.isPremium || user.subscriptionStatus === 'active';
    if (isPremiumUser) return;
    interstitialAttemptedRef.current = true;
    let alive = true;
    shouldShowPromo('app-open')
      .then((ok) => {
        if (!alive || !ok) return;
        markPromoShown('app-open');
        setShowInterstitial(true);
      })
      .catch(() => { /* promo is best-effort */ });
    return () => { alive = false; };
  }, [onboardingChecked, showOnboarding, user?.id, user?.email, user?.isPremium, user?.subscriptionStatus, token]);

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
        // Redesign spec: opaque obsidian (ivory in light) tab bar with a
        // hairline top border — no blur, no shadow.
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 12,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 62 + insets.bottom : 74,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: FONTS.sansSemiBold,
          fontSize: 10,
          marginTop: 3,
          letterSpacing: 0.2,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}
    >
      {/* 4-tab IA per the 1b redesign: Vote is home. The dashboard route
          stays alive (href: null) for deep links and legacy navigation. */}
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
        name="dashboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="stats-chart-outline" color={color} focused={focused} />
          ),
        }}
      />
      {/* Sentinel left the tab bar in the 4-tab redesign IA but the route
          stays alive (href: null) so dashboard/profile entry points can
          still router.push('/(tabs)/sentinel'). */}
      <Tabs.Screen
        name="sentinel"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Orgs',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Identity',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="shield-outline" color={color} focused={focused} />
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

    {/* S3a · App-open Premium interstitial (own full-screen Modal). The ✕ is
        full-size from frame one; the dismiss is named for where it goes. */}
    <AppOpenInterstitial
      visible={showInterstitial}
      onClose={() => setShowInterstitial(false)}
      onSeePremium={() => {
        setShowInterstitial(false);
        router.push('/modals/subscription');
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 30,
  },
  activePill: {
    position: 'absolute',
    width: 52,
    height: 30,
    borderRadius: 15,
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
