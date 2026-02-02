import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ThemeProvider, useTheme } from '../lib/theme';
import { STRIPE_PUBLISHABLE_KEY, MERCHANT_IDENTIFIER } from '../lib/stripe';

function ThemedStack() {
  const { colors, isDark } = useTheme();

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
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modals" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={MERCHANT_IDENTIFIER}
      urlScheme="represent"
    >
      <ThemeProvider>
        <ThemedStack />
      </ThemeProvider>
    </StripeProvider>
  );
}
