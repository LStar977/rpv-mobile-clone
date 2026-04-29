import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from '../lib/theme';
import { STRIPE_PUBLISHABLE_KEY, MERCHANT_IDENTIFIER } from '../lib/stripe';
import { initIAP, endIAP } from '../lib/iap';
import { soundEffects } from '../lib/sounds';
import { useSyncBallotTier } from '../lib/ballots';

// Conditionally import StripeProvider to handle missing native module
let StripeProvider: any = null;
try {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
} catch (e) {
  // Stripe native module not available (e.g., in Expo Go)
}

function ThemedStack() {
  const { colors, isDark } = useTheme();

  // Keeps the ballot store's tier ('free' | 'verified' | 'premium') in sync
  // with the user's auth + subscription state. Without this, premium subscribers
  // would still see the free-tier daily-cap UI.
  useSyncBallotTier();

  useEffect(() => {
    initIAP();
    soundEffects.init();
    return () => {
      endIAP();
      soundEffects.unload();
    };
  }, []);

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

export default function RootLayout() {
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
