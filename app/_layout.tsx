import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { ThemeProvider, useTheme } from '../lib/theme';
import { STRIPE_PUBLISHABLE_KEY, MERCHANT_IDENTIFIER } from '../lib/stripe';
import { initIAP, endIAP } from '../lib/iap';
import { soundEffects } from '../lib/sounds';
import { useSyncBallotTier } from '../lib/ballots';

// Sentry init at module load. No-op when EXPO_PUBLIC_SENTRY_DSN isn't set,
// so it's safe to leave wired up before you've created a Sentry project.
const SENTRY_PII_FIELDS = new Set([
  'email', 'phone', 'dateOfBirth', 'verificationId',
  'walletAddress', 'privateKey', 'token', 'refreshToken',
  'firstName', 'lastName', 'name',
]);
function scrubPii(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scrubPii);
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENTRY_PII_FIELDS.has(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'object') {
      out[k] = scrubPii(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableAutoSessionTracking: true,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.data) event.request.data = scrubPii(event.request.data);
    if (event.extra) event.extra = scrubPii(event.extra);
    if (event.user) event.user = { id: event.user.id };
    return event;
  },
});

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

// Sentry.wrap enables automatic error boundary + performance monitoring.
export default Sentry.wrap(RootLayout);
