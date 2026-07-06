import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../lib/theme';
import { STRIPE_PUBLISHABLE_KEY, MERCHANT_IDENTIFIER } from '../lib/stripe';
import { initIAP, endIAP } from '../lib/iap';
import { soundEffects } from '../lib/sounds';
import { useSyncBallotTier } from '../lib/ballots';
import { useAuthStore } from '../lib/auth';
import { FONT_ASSETS } from '../lib/redesign';

// Redesign fonts (Newsreader / Onest / JetBrains Mono). Loaded via expo-font.
// We do NOT block the app on font load — components fall back to the system font
// until these are ready, so a slow/failed font load never shows a blank app.
let useFonts: (map: any) => [boolean, Error | null] = () => [true, null];
try {
  useFonts = require('expo-font').useFonts;
} catch (e) {
  // expo-font unavailable (e.g. bare Expo Go without the module) — system fonts.
}

// Conditionally import StripeProvider to handle missing native module
let StripeProvider: any = null;
try {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
} catch (e) {
  // Stripe native module not available (e.g., in Expo Go)
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);

  // Load the redesign fonts. Non-blocking: `fontsLoaded` gates nothing — it's
  // here so a re-render happens once the fonts are ready and text re-lays out.
  useFonts(FONT_ASSETS);

  // Keeps the ballot store's tier ('free' | 'verified' | 'premium') in sync
  // with the user's auth + subscription state. Without this, premium subscribers
  // would still see the free-tier daily-cap UI.
  useSyncBallotTier();

  useEffect(() => {
    // Rehydrate auth from SecureStore before the entry route renders, so
    // returning users don't see the sign-in screen flash on cold start.
    hydrate();
    initIAP();
    soundEffects.init();
    return () => {
      endIAP();
      soundEffects.unload();
    };
  }, []);

  // Until SecureStore reads complete, show a blank background that matches
  // the splash so the transition into the authed UI is seamless.
  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modals" />
      </Stack>
    </View>
  );
}

function RootLayout() {
  const content = (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );

  // Only wrap with StripeProvider if native module is available
  if (StripeProvider) {
    return (
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier={MERCHANT_IDENTIFIER}
        urlScheme="represent"
      >
        {content}
      </StripeProvider>
    );
  }

  return content;
}

export default RootLayout;
