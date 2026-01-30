import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../../lib/theme';

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'info' | 'gold';
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

  const sizeStyles = {
    sm: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xxs + 1,
      fontSize: 10,
      iconSize: 10,
      borderRadius: BORDER_RADIUS.sm,
    },
    md: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      fontSize: 11,
      iconSize: 12,
      borderRadius: BORDER_RADIUS.md,
    },
    lg: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      fontSize: 12,
      iconSize: 14,
      borderRadius: BORDER_RADIUS.lg,
    },
  };

  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return { bg: colors.successLight, border: colors.success, text: colors.success };
      case 'error':
        return { bg: colors.errorLight, border: colors.error, text: colors.error };
      case 'warning':
        return { bg: colors.warningLight, border: colors.warning, text: colors.warning };
      case 'info':
        return { bg: colors.infoLight, border: colors.info, text: colors.info };
      case 'gold':
        return { bg: colors.goldLight, border: colors.gold, text: colors.gold };
      default:
        return { bg: colors.cardBgLight, border: colors.border, text: colors.textSecondary };
    }
  };

  const variantColors = getVariantColors();
  const currentSize = sizeStyles[size];

  const containerStyle: ViewStyle = {
    backgroundColor: outlined ? 'transparent' : variantColors.bg,
    borderWidth: outlined ? 1.5 : 0,
    borderColor: variantColors.border,
    paddingHorizontal: currentSize.paddingHorizontal,
    paddingVertical: currentSize.paddingVertical,
    borderRadius: currentSize.borderRadius,
  };

  const content = (
    <View style={[styles.container, containerStyle, style]}>
      {icon && (
        <Ionicons
          name={icon}
          size={currentSize.iconSize}
          color={variantColors.text}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          { color: variantColors.text, fontSize: currentSize.fontSize },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );

  if (animated) {
    return (
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
        {content}
      </Animated.View>
    );
  }

  return content;
}

// Count Badge - for notification dots
interface CountBadgeProps {
  count: number;
  max?: number;
  variant?: 'gold' | 'error' | 'success';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function CountBadge({
  count,
  max = 99,
  variant = 'gold',
  size = 'md',
  style,
}: CountBadgeProps) {
  const { colors } = useTheme();

  if (count <= 0) return null;

  const displayCount = count > max ? `${max}+` : count.toString();

  const bgColor = {
    gold: colors.gold,
    error: colors.error,
    success: colors.success,
  }[variant];

  const sizeStyles = {
    sm: { minWidth: 18, height: 18, fontSize: 10 },
    md: { minWidth: 24, height: 24, fontSize: 12 },
  };

  const currentSize = sizeStyles[size];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        styles.countBadge,
        {
          backgroundColor: bgColor,
          minWidth: currentSize.minWidth,
          height: currentSize.height,
        },
        style,
      ]}
    >
      <Text style={[styles.countText, { fontSize: currentSize.fontSize }]}>
        {displayCount}
      </Text>
    </Animated.View>
  );
}

// Status Dot - simple indicator
interface StatusDotProps {
  variant?: 'success' | 'error' | 'warning' | 'info' | 'offline';
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

  const dotColor = {
    success: colors.success,
    error: colors.error,
    warning: colors.warning,
    info: colors.info,
    offline: colors.textMuted,
  }[variant];

  const sizeValue = {
    sm: 8,
    md: 10,
    lg: 12,
  }[size];

  return (
    <View
      style={[
        styles.statusDot,
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius: sizeValue / 2,
          backgroundColor: dotColor,
        },
        pulse && {
          shadowColor: dotColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 4,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: SPACING.xs,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  countBadge: {
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  countText: {
    color: '#000',
    fontWeight: '700',
  },
  statusDot: {},
});
