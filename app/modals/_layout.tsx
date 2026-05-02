import { Stack } from 'expo-router';
import { useTheme } from '../../lib/theme';

export default function ModalsLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        gestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="veriff" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="receipt" />
      <Stack.Screen name="badges" />
      <Stack.Screen name="voting-history" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="organization-detail" />
      <Stack.Screen name="org-proposal-detail" />
      <Stack.Screen name="verification-payment" />
      <Stack.Screen name="create-organization" />
      <Stack.Screen name="import-roster" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="my-proposals" />
      <Stack.Screen name="community-proposals" />
      <Stack.Screen name="legal" />
    </Stack>
  );
}
