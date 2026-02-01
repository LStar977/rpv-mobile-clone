import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme, SHADOWS, RADIUS, SPACING, EASING } from '../../lib/theme';
import { haptics } from '../../lib/haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled' | 'glass' | 'gradient';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  padding?: keyof typeof SPACING | number;
  animated?: boolean;
  animationDelay?: number;
  animationDirection?: 'up' | 'down' | 'fade';
  accessibilityLabel?: string;
}

export function Card({
  children,
  variant = 'default',
  onPress,
  style,
  padding = 'xl',
  animated = true,
  animationDelay = 0,
  animationDirection = 'up',
  accessibilityLabel,
}: CardProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (onPress) {
      haptics.light();
      scale.value = withSpring(0.98, EASING.springSnappy);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, EASING.springSnappy);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.border,
          ...SHADOWS.md,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'filled':
        return {
          backgroundColor: colors.surface,
          borderWidth: 0,
        };
      case 'glass':
        return {
          backgroundColor: colors.glass,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          ...SHADOWS.sm,
        };
      case 'gradient':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          overflow: 'hidden',
        };
      default:
        return {
          backgroundColor: colors.surface,
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

  const getEnteringAnimation = () => {
    if (!animated) return undefined;

    const baseConfig = { damping: 20, stiffness: 200 };

    switch (animationDirection) {
      case 'down':
        return FadeInDown.delay(animationDelay).duration(400).springify().damping(baseConfig.damping).stiffness(baseConfig.stiffness);
      case 'fade':
        return FadeIn.delay(animationDelay).duration(300);
      case 'up':
      default:
        return FadeInUp.delay(animationDelay).duration(400).springify().damping(baseConfig.damping).stiffness(baseConfig.stiffness);
    }
  };

  const enteringAnimation = getEnteringAnimation();

  // Gradient variant with LinearGradient background
  if (variant === 'gradient') {
    const content = (
      <LinearGradient
        colors={[colors.surfaceElevated, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { padding: paddingValue }, style]}
      >
        {children}
      </LinearGradient>
    );

    if (onPress) {
      return (
        <AnimatedTouchable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={[animatedStyle]}
          entering={enteringAnimation}
        >
          {content}
        </AnimatedTouchable>
      );
    }

    return (
      <Animated.View entering={enteringAnimation} accessibilityLabel={accessibilityLabel}>
        {content}
      </Animated.View>
    );
  }

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

// Glow Card - with colored glow effect
interface GlowCardProps extends CardProps {
  glowColor?: string;
  glowIntensity?: 'subtle' | 'medium' | 'strong';
}

export function GlowCard({
  children,
  glowColor,
  glowIntensity = 'medium',
  style,
  padding = 'xl',
  ...props
}: GlowCardProps) {
  const { colors } = useTheme();
  const color = glowColor || colors.gold;

  const intensityConfig = {
    subtle: { shadowOpacity: 0.15, shadowRadius: 8 },
    medium: { shadowOpacity: 0.25, shadowRadius: 16 },
    strong: { shadowOpacity: 0.40, shadowRadius: 24 },
  };

  const { shadowOpacity, shadowRadius } = intensityConfig[glowIntensity];

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
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity,
          shadowRadius,
          elevation: 8,
        },
        style as ViewStyle,
      ].filter(Boolean) as ViewStyle[]}
    >
      {children}
    </Card>
  );
}

// Gradient Border Card - premium look with gold border
interface GradientBorderCardProps extends CardProps {
  borderWidth?: number;
  borderColors?: string[];
}

export function GradientBorderCard({
  children,
  style,
  padding = 'xl',
  borderWidth = 1.5,
  borderColors,
  ...props
}: GradientBorderCardProps) {
  const { colors } = useTheme();
  const paddingValue = typeof padding === 'number' ? padding : SPACING[padding];
  const gradientColors = borderColors || [colors.goldLight, colors.gold, colors.goldDark];

  return (
    <LinearGradient
      colors={gradientColors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradientBorderOuter,
        { padding: borderWidth, borderRadius: RADIUS.card + borderWidth },
        style,
      ]}
    >
      <View
        style={[
          styles.gradientBorderInner,
          { backgroundColor: colors.surface, padding: paddingValue },
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

// Feature Card - for showcasing features with icon
interface FeatureCardProps extends CardProps {
  icon?: React.ReactNode;
  highlighted?: boolean;
}

export function FeatureCard({
  children,
  icon,
  highlighted = false,
  style,
  ...props
}: FeatureCardProps) {
  const { colors } = useTheme();

  if (highlighted) {
    return (
      <GlowCard
        {...props}
        glowColor={colors.gold}
        glowIntensity="subtle"
        style={[{ borderColor: colors.gold }, style]}
      >
        {icon && <View style={styles.featureIcon}>{icon}</View>}
        {children}
      </GlowCard>
    );
  }

  return (
    <Card {...props} variant="elevated" style={style}>
      {icon && <View style={styles.featureIcon}>{icon}</View>}
      {children}
    </Card>
  );
}

// Action Card - pressable card with arrow indicator
interface ActionCardProps extends CardProps {
  showArrow?: boolean;
}

export function ActionCard({
  children,
  showArrow = true,
  onPress,
  style,
  ...props
}: ActionCardProps) {
  const { colors } = useTheme();

  return (
    <Card
      {...props}
      variant="elevated"
      onPress={onPress}
      style={[styles.actionCard, style]}
    >
      <View style={styles.actionContent}>
        {children}
      </View>
      {showArrow && onPress && (
        <View style={[styles.actionArrow, { backgroundColor: colors.goldSurface }]}>
          <View style={[styles.actionArrowInner, { borderColor: colors.gold }]} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  gradientBorderOuter: {
    overflow: 'hidden',
  },
  gradientBorderInner: {
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  featureIcon: {
    marginBottom: SPACING.lg,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  actionArrowInner: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-45deg' }],
  },
});
