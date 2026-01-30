import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme, SHADOWS, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../../lib/theme';
import { haptics } from '../../lib/haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const handlePressIn = () => {
    // Trigger haptic feedback based on variant
    if (variant === 'danger') {
      haptics.medium();
    } else if (variant === 'primary') {
      haptics.light();
    } else {
      haptics.light();
    }
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const sizeStyles = {
    sm: {
      paddingVertical: SPACING.sm + 2,
      paddingHorizontal: SPACING.lg,
      borderRadius: BORDER_RADIUS.md,
      fontSize: 13,
      iconSize: 16,
    },
    md: {
      paddingVertical: SPACING.md + 2,
      paddingHorizontal: SPACING.xl,
      borderRadius: BORDER_RADIUS.lg,
      fontSize: 15,
      iconSize: 18,
    },
    lg: {
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.xxl,
      borderRadius: BORDER_RADIUS.xl,
      fontSize: 16,
      iconSize: 20,
    },
    xl: {
      paddingVertical: SPACING.xl,
      paddingHorizontal: SPACING.xxxl,
      borderRadius: BORDER_RADIUS.xxl,
      fontSize: 17,
      iconSize: 22,
    },
  };

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle; iconColor: string } => {
    const isDisabled = disabled || loading;

    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.goldMedium : colors.gold,
            ...(!isDisabled && SHADOWS.glow),
          },
          text: { color: colors.background, fontWeight: '600' },
          iconColor: colors.background,
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.cardBg : colors.cardBgElevated,
            borderWidth: 1,
            borderColor: colors.border,
          },
          text: { color: isDisabled ? colors.textMuted : colors.text, fontWeight: '600' },
          iconColor: isDisabled ? colors.textMuted : colors.gold,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: isDisabled ? colors.border : colors.gold,
          },
          text: { color: isDisabled ? colors.textMuted : colors.gold, fontWeight: '600' },
          iconColor: isDisabled ? colors.textMuted : colors.gold,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: { color: isDisabled ? colors.textMuted : colors.gold, fontWeight: '600' },
          iconColor: isDisabled ? colors.textMuted : colors.gold,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: isDisabled ? colors.errorLight : colors.error,
          },
          text: { color: '#fff', fontWeight: '600' },
          iconColor: '#fff',
        };
      default:
        return {
          container: { backgroundColor: colors.gold },
          text: { color: colors.background, fontWeight: '600' },
          iconColor: colors.background,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const currentSize = sizeStyles[size];

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.container,
        {
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
          borderRadius: currentSize.borderRadius,
        },
        variantStyles.container,
        fullWidth && styles.fullWidth,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.iconColor}
        />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={currentSize.iconSize}
              color={variantStyles.iconColor}
              style={styles.iconLeft}
            />
          )}
          <Text
            style={[
              styles.text,
              { fontSize: currentSize.fontSize },
              variantStyles.text,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={currentSize.iconSize}
              color={variantStyles.iconColor}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: SPACING.sm,
  },
  iconRight: {
    marginLeft: SPACING.sm,
  },
});
