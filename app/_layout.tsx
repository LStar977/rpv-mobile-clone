import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Modal } from 'react-native';
import { ThemeProvider, useTheme } from '../lib/theme';
import { STRIPE_PUBLISHABLE_KEY, MERCHANT_IDENTIFIER } from '../lib/stripe';
import { initIAP, endIAP } from '../lib/iap';
import { soundEffects } from '../lib/sounds';
import { Onboarding, hasCompletedOnboarding } from '../components/Onboarding';

// Conditionally import StripeProvider to handle missing native module
let StripeProvider: any = null;
try {
  StripeProvider = require('@stripe/stripe-react-native').StripeProvider;
} catch (e) {
  // Stripe native module not available (e.g., in Expo Go)
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    initIAP();
    soundEffects.init();

    // Check onboarding status
    hasCompletedOnboarding().then((completed) => {
      setShowOnboarding(!completed);
    });

    return () => {
      endIAP();
      soundEffects.unload();
    };
  }, []);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Don't render until we know onboarding status
  if (showOnboarding === null) {
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

      {/* Onboarding Modal */}
      <Modal
        visible={showOnboarding}
        animationType="fade"
        statusBarTranslucent
        presentationStyle="fullScreen"
      >
        <Onboarding onComplete={handleOnboardingComplete} />
      </Modal>
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
