// Redesign · 4-tab IA — Vote · Results · Organizations · Identity.
// Consolidates the old 5-tabs-+-21-modals into the brief's four. Reachable at
// /(redesign)/vote. To make this the app's primary experience, point the
// post-auth redirect (app/index.tsx) at '/(redesign)/vote' — see README.
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, SHADOWS } from '../../lib/theme';
import { FONTS } from '../../lib/redesign';

export default function RedesignTabLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      key={isDark ? 'dark' : 'light'}
      screenListeners={{ tabPress: () => Haptics.selectionAsync() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isDark ? 'rgba(4,7,7,0.96)' : 'rgba(250,248,245,0.98)',
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 14,
          paddingTop: 12,
          height: Platform.OS === 'ios' ? 60 + insets.bottom : 74,
          ...SHADOWS.lg,
        },
        tabBarLabelStyle: { fontFamily: FONTS.sansSemibold, fontSize: 10, letterSpacing: 0.4, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="vote"
        options={{ title: 'Vote', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'checkbox' : 'checkbox-outline'} size={23} color={color} /> }}
      />
      <Tabs.Screen
        name="results"
        options={{ title: 'Results', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'bar-chart' : 'bar-chart-outline'} size={23} color={color} /> }}
      />
      <Tabs.Screen
        name="organizations"
        options={{ title: 'Orgs', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={23} color={color} /> }}
      />
      <Tabs.Screen
        name="identity"
        options={{ title: 'Identity', tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={23} color={color} /> }}
      />
    </Tabs>
  );
}
