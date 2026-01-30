import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useTheme, SHADOWS, BORDER_RADIUS, SPACING } from '../../lib/theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'glass';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: keyof typeof SPACING | number;
  animated?: boolean;
  animationDelay?: number;
  accessibilityLabel?: string;
}

export function Card({
  children,
  variant = 'default',
  onPress,
  style,
  padding = 'lg',
  animated = true,
  animationDelay = 0,
  accessibilityLabel,
}: CardProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.cardBgElevated,
          borderWidth: 1,
          borderColor: colors.border,
          ...SHADOWS.md,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.border,
        };
      case 'filled':
        return {
          backgroundColor: colors.cardBgLight,
          borderWidth: 0,
        };
      case 'glass':
        return {
          backgroundColor: colors.glass,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          ...SHADOWS.sm,
        };
      default:
        return {
          backgroundColor: colors.cardBg,
          borderWidth: 1,
          borderColor: colors.border,
        };
    }
  };

  const paddingValue = typeof padding === 'number' ? padding : SPACING[padding];
  const containerStyle = [
    styles.container,
    getVariantStyles(),
    { padding: paddingValue },
    style,
  ];

  const enteringAnimation = animated
    ? FadeInDown.delay(animationDelay).duration(400).springify()
    : undefined;

  if (onPress) {
    return (
      <AnimatedTouchable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[containerStyle, animatedStyle]}
        entering={enteringAnimation}
      >
        {children}
      </AnimatedTouchable>
    );
  }

  return (
    <Animated.View
      style={containerStyle}
      entering={enteringAnimation}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Animated.View>
  );
}

// Specialized Card variants
export function GlowCard({
  children,
  glowColor,
  style,
  padding = 'lg',
  ...props
}: CardProps & { glowColor?: string }) {
  const { colors } = useTheme();
  const color = glowColor || colors.gold;

  return (
    <Card
      {...props}
      variant="elevated"
      padding={padding}
      style={[
        {
          borderColor: color,
          borderWidth: 1,
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </Card>
  );
}

export function GradientBorderCard({
  children,
  style,
  padding = 'lg',
  ...props
}: CardProps) {
  const { colors } = useTheme();
  const paddingValue = typeof padding === 'number' ? padding : SPACING[padding];

  return (
    <View
      style={[
        styles.gradientBorderOuter,
        { backgroundColor: colors.gold },
        style,
      ]}
    >
      <View
        style={[
          styles.gradientBorderInner,
          { backgroundColor: colors.cardBg, padding: paddingValue },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  gradientBorderOuter: {
    borderRadius: BORDER_RADIUS.xl + 1,
    padding: 1.5,
  },
  gradientBorderInner: {
    borderRadius: BORDER_RADIUS.xl,
  },
});
