import { Stack } from 'expo-router';
import { useTheme } from '../../lib/theme';

export default function ModalsLayout() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, presentation: 'modal', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="veriff" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="badges" />
      <Stack.Screen name="voting-history" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
