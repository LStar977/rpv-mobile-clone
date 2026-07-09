import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme, RADIUS, SPACING, FONTS } from '../../lib/theme';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'gold' | 'premium';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: keyof typeof Ionicons.glyphMap;
  outlined?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  animated?: boolean;
}

export function Badge({
  label,
  variant = 'default',
  size = 'md',
  icon,
  outlined = false,
  style,
  textStyle,
  animated = false,
}: BadgeProps) {
  const { colors } = useTheme();

  const sizeConfig = {
    // Redesign spec: chips are pills (radius 100), Onest 600 10px +0.1em.
    sm: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      fontSize: 9.5,
      iconSize: 10,
      borderRadius: RADIUS.chip,
      gap: 4,
    },
    md: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      fontSize: 10,
      iconSize: 11,
      borderRadius: RADIUS.chip,
      gap: 5,
    },
    lg: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      fontSize: 11,
      iconSize: 13,
      borderRadius: RADIUS.chip,
      gap: 6,
    },
  };

  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: colors.successSurface,
          border: colors.success,
          text: colors.success,
        };
      case 'error':
        return {
          bg: colors.errorSurface,
          border: colors.error,
          text: colors.error,
        };
      case 'warning':
        return {
          bg: colors.warningSurface,
          border: colors.warning,
          text: colors.warning,
        };
      case 'info':
        return {
          bg: colors.infoSurface,
          border: colors.info,
          text: colors.info,
        };
      case 'gold':
        return {
          bg: colors.goldSurface,
          border: colors.gold,
          text: colors.gold,
        };
      case 'premium':
        return {
          bg: colors.goldSurfaceStrong,
          border: colors.gold,
          text: colors.gold,
          isGradient: true,
        };
      default:
        return {
          bg: colors.surface,
          border: colors.border,
          text: colors.textSecondary,
        };
    }
  };

  const variantColors = getVariantColors();
  const currentSize = sizeConfig[size];

  const containerStyle: ViewStyle = {
    backgroundColor: outlined ? 'transparent' : variantColors.bg,
    borderWidth: outlined ? 1.5 : 0,
    borderColor: variantColors.border,
    paddingHorizontal: currentSize.paddingHorizontal,
    paddingVertical: currentSize.paddingVertical,
    borderRadius: currentSize.borderRadius,
    gap: currentSize.gap,
  };

  const content = (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={currentSize.iconSize}
          color={variantColors.text}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color: variantColors.text,
            fontSize: currentSize.fontSize,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </>
  );

  // Premium variant with gradient background
  if (variant === 'premium' && !outlined) {
    return (
      <LinearGradient
        colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.container,
          {
            paddingHorizontal: currentSize.paddingHorizontal,
            paddingVertical: currentSize.paddingVertical,
            borderRadius: currentSize.borderRadius,
            gap: currentSize.gap,
          },
          style,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={currentSize.iconSize}
            color={colors.black}
          />
        )}
        <Text
          style={[
            styles.label,
            {
              color: colors.black,
              fontSize: currentSize.fontSize,
            },
            textStyle,
          ]}
        >
          {label}
        </Text>
      </LinearGradient>
    );
  }

  const wrapper = (
    <View style={[styles.container, containerStyle, style]}>
      {content}
    </View>
  );

  if (animated) {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
        {wrapper}
      </Animated.View>
    );
  }

  return wrapper;
}

// Count Badge - for notification dots
interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: 'gold' | 'error' | 'success' | 'info';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  showZero?: boolean;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'gold',
  size = 'md',
  style,
  showZero = false,
}: CountBadgeProps) {
  const { colors } = useTheme();

  if (count <= 0 && !showZero) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  const bgColor = {
    gold: colors.gold,
    error: colors.error,
    success: colors.success,
    info: colors.info,
  }[variant];

  const textColor = variant === 'gold' ? colors.black : colors.white;

  const sizeConfig = {
    sm: { minWidth: 16, height: 16, fontSize: 9, paddingHorizontal: 4 },
    md: { minWidth: 20, height: 20, fontSize: 11, paddingHorizontal: 5 },
    lg: { minWidth: 24, height: 24, fontSize: 12, paddingHorizontal: 6 },
  };

  const currentSize = sizeConfig[size];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        styles.countBadge,
        {
          backgroundColor: bgColor,
          minWidth: currentSize.minWidth,
          height: currentSize.height,
          paddingHorizontal: currentSize.paddingHorizontal,
        },
        style,
      ]}
    >
      <Text style={[styles.countText, { fontSize: currentSize.fontSize, color: textColor }]}>
        {displayCount}
      </Text>
    </Animated.View>
  );
}

// Status Dot - simple indicator
interface StatusDotProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'offline' | 'online';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  style?: ViewStyle;
}

export function StatusDot({
  variant = 'success',
  size = 'md',
  pulse = false,
  style,
}: StatusDotProps) {
  const { colors } = useTheme();
  const pulseAnim = useSharedValue(1);

  React.useEffect(() => {
    if (pulse) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [pulse]);

  const animatedPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
    opacity: 1.5 - pulseAnim.value * 0.5,
  }));

  const dotColor = {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info,
    offline: colors.textTertiary,
    online: colors.success,
  }[variant];

  const sizeValue = {
    sm: 6,
    md: 8,
    lg: 10,
  }[size];

  return (
    <View style={[styles.statusDotContainer, style]}>
      {pulse && (
        <Animated.View
          style={[
            styles.statusDotPulse,
            {
              width: sizeValue * 2,
              height: sizeValue * 2,
              borderRadius: sizeValue,
              backgroundColor: dotColor,
            },
            animatedPulseStyle,
          ]}
        />
      )}
      <View
        style={[
          styles.statusDot,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
            backgroundColor: dotColor,
          },
        ]}
      />
    </View>
  );
}

// Live Badge - for live content indicators
interface LiveBadgeProps {
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function LiveBadge({ size = 'md', style }: LiveBadgeProps) {
  const { colors } = useTheme();

  const sizeConfig = {
    sm: { paddingHorizontal: 8, paddingVertical: 3, fontSize: 9, dotSize: 5 },
    md: { paddingHorizontal: 10, paddingVertical: 4, fontSize: 10, dotSize: 6 },
  };

  const currentSize = sizeConfig[size];

  return (
    <View
      style={[
        styles.liveBadge,
        {
          backgroundColor: colors.errorSurface,
          borderColor: colors.error,
          paddingHorizontal: currentSize.paddingHorizontal,
          paddingVertical: currentSize.paddingVertical,
        },
        style,
      ]}
    >
      <StatusDot variant="error" size="sm" pulse />
      <Text
        style={[
          styles.liveText,
          { color: colors.error, fontSize: currentSize.fontSize },
        ]}
      >
        LIVE
      </Text>
    </View>
  );
}

// Verification Badge
interface VerificationBadgeProps {
  verified?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: ViewStyle;
}

export function VerificationBadge({
  verified = false,
  size = 'md',
  showLabel = false,
  style,
}: VerificationBadgeProps) {
  const { colors } = useTheme();

  const sizeConfig = {
    sm: { iconSize: 14, padding: 4 },
    md: { iconSize: 18, padding: 5 },
    lg: { iconSize: 22, padding: 6 },
  };

  const currentSize = sizeConfig[size];

  if (!verified) return null;

  if (showLabel) {
    return (
      <Badge
        label="Verified"
        variant="success"
        size={size}
        icon="checkmark-circle"
        style={style}
      />
    );
  }

  return (
    <View
      style={[
        styles.verificationBadge,
        {
          backgroundColor: colors.success,
          padding: currentSize.padding,
          borderRadius: RADIUS.full,
        },
        style,
      ]}
    >
      <Ionicons
        name="checkmark"
        size={currentSize.iconSize}
        color={colors.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  countBadge: {
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: FONTS.monoSemiBold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  statusDotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDotPulse: {
    position: 'absolute',
  },
  statusDot: {},
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    gap: 6,
  },
  liveText: {
    fontFamily: FONTS.sansBold,
    letterSpacing: 1,
  },
  verificationBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
