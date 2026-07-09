import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Newsreader_400Regular,
  Newsreader_500Medium,
  Newsreader_600SemiBold,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium_Italic,
} from '@expo-google-fonts/newsreader';
import {
  Onest_400Regular,
  Onest_500Medium,
  Onest_600SemiBold,
  Onest_700Bold,
} from '@expo-google-fonts/onest';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider, useTheme } from '../lib/theme';
import { STRIPE_PUBLISHABLE_KEY, MERCHANT_IDENTIFIER } from '../lib/stripe';
import { initIAP, endIAP } from '../lib/iap';
import { soundEffects } from '../lib/sounds';
import { useSyncBallotTier } from '../lib/ballots';
import { useAuthStore } from '../lib/auth';

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

  // Redesign type system: Newsreader (civic moments) · Onest (UI) ·
  // JetBrains Mono (everything counted or recorded).
  const [fontsLoaded] = useFonts({
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium_Italic,
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

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

  // Until SecureStore reads and font loading complete, show a blank
  // background that matches the splash so the transition into the authed
  // UI is seamless and text never flashes in a fallback font.
  if (!hydrated || !fontsLoaded) {
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
