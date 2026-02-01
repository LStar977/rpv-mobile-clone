import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useTheme, SHADOWS, BORDER_RADIUS, SPACING, ANIMATION } from '../../lib/theme';

// Custom Tab Bar Icon with animation
function TabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(focused ? 1 : 0.85);
  const opacity = useSharedValue(focused ? 1 : 0);

  scale.value = withSpring(focused ? 1 : 0.85, ANIMATION.spring.gentle);
  opacity.value = withSpring(focused ? 1 : 0, ANIMATION.spring.gentle);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: interpolate(opacity.value, [0, 1], [0.5, 1]) }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.3,
    transform: [{ scale: interpolate(opacity.value, [0, 1], [0.8, 1.2]) }],
  }));

  return (
    <View style={styles.iconContainer}>
      {/* Glow effect behind active icon */}
      <Animated.View
        style={[
          styles.iconGlow,
          { backgroundColor: colors.gold },
          glowAnimatedStyle,
        ]}
      />
      <Animated.View style={iconAnimatedStyle}>
        <Ionicons
          name={focused ? name.replace('-outline', '') as any : name}
          size={24}
          color={color}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.activeDot,
          { backgroundColor: colors.gold },
          dotAnimatedStyle,
        ]}
      />
    </View>
  );
}

export default function TabLayout() {
  const { colors, isDark } = useTheme();

  return (
    <Tabs
      key={isDark ? 'dark' : 'light'}
      screenListeners={{
        tabPress: () => {
          Haptics.selectionAsync();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: isDark ? 'rgba(10, 10, 12, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          borderTopColor: isDark ? 'rgba(201, 162, 39, 0.15)' : 'rgba(0, 0, 0, 0.06)',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 28 : 14,
          paddingTop: 14,
          height: Platform.OS === 'ios' ? 92 : 74,
          ...SHADOWS.lg,
        },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.4,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
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
        name="identity"
        options={{
          title: 'Identity',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="shield-checkmark-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="sentinel"
        options={{
          title: 'Sentinel',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="sparkles-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 30,
  },
  iconGlow: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
});
