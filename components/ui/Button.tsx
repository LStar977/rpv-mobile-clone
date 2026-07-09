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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme, RADIUS, SPACING, EASING, FONTS, withAlpha as withAlphaLocal } from '../../lib/theme';
import { haptics } from '../../lib/haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
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
  const pressed = useSharedValue(0);

  // Motion spec: Instant (120ms) press — scale .965 + light haptic.
  const handlePressIn = () => {
    haptics.light();
    scale.value = withSpring(0.965, EASING.springSnappy);
    pressed.value = withTiming(1, { duration: 120 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, EASING.springSnappy);
    pressed.value = withTiming(0, { duration: 120 });
  };

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.9], Extrapolation.CLAMP),
  }));

  // Redesign spec: buttons radius 14–16, primary height 54–56, min hit 44.
  const sizeConfig = {
    sm: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: RADIUS.button,
      fontSize: 13,
      iconSize: 16,
      minHeight: 44,
    },
    md: {
      paddingVertical: 14,
      paddingHorizontal: 24,
      borderRadius: RADIUS.button,
      fontSize: 15,
      iconSize: 18,
      minHeight: 48,
    },
    lg: {
      paddingVertical: 16,
      paddingHorizontal: 28,
      borderRadius: 16,
      fontSize: 16,
      iconSize: 20,
      minHeight: 54,
    },
    xl: {
      paddingVertical: 18,
      paddingHorizontal: 32,
      borderRadius: 16,
      fontSize: 17,
      iconSize: 22,
      minHeight: 58,
    },
  };

  const getVariantStyles = (): {
    container: ViewStyle;
    text: TextStyle;
    iconColor: string;
    useGradient?: boolean;
    gradientColors?: string[];
  } => {
    const isDisabled = disabled || loading;

    switch (variant) {
      case 'primary':
        // Flat Sovereign Gold per redesign — no gradient, no glow.
        // Disabled = same gold at .4 opacity (spec), not a muted surface.
        return {
          container: {
            backgroundColor: colors.goldFill,
            opacity: isDisabled ? 0.4 : 1,
          },
          text: { color: '#040707' },
          iconColor: '#040707',
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: isDisabled ? colors.surface : colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
          },
          text: { color: isDisabled ? colors.textDisabled : colors.text },
          iconColor: isDisabled ? colors.textDisabled : colors.gold,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: isDisabled ? colors.border : colors.gold,
          },
          text: { color: isDisabled ? colors.textDisabled : colors.gold },
          iconColor: isDisabled ? colors.textDisabled : colors.gold,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
          },
          text: { color: isDisabled ? colors.textDisabled : colors.textSecondary },
          iconColor: isDisabled ? colors.textDisabled : colors.textSecondary,
        };
      case 'danger':
        // Destructive per redesign — outline, never a filled red slab.
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1.5,
            borderColor: isDisabled ? colors.border : withAlphaLocal(colors.oppose, 0.5),
          },
          text: { color: isDisabled ? colors.textDisabled : colors.oppose },
          iconColor: isDisabled ? colors.textDisabled : colors.oppose,
        };
      case 'success':
        return {
          container: {
            backgroundColor: isDisabled ? colors.successSurface : colors.success,
          },
          text: { color: colors.black },
          iconColor: colors.black,
        };
      default:
        return {
          container: { backgroundColor: colors.goldFill },
          text: { color: '#040707' },
          iconColor: '#040707',
        };
    }
  };

  const variantStyles = getVariantStyles();
  const currentSize = sizeConfig[size];

  const buttonContent = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variantStyles.iconColor}
        />
      ) : (
        <>
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
        </>
      )}
    </View>
  );

  // For primary variant, use gradient background
  if (variantStyles.useGradient && variantStyles.gradientColors) {
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
          animatedContainerStyle,
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        <LinearGradient
          colors={variantStyles.gradientColors as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.container,
            {
              paddingVertical: currentSize.paddingVertical,
              paddingHorizontal: currentSize.paddingHorizontal,
              borderRadius: currentSize.borderRadius,
              minHeight: currentSize.minHeight,
            },
            variantStyles.container,
          ]}
        >
          {buttonContent}
        </LinearGradient>
      </AnimatedTouchable>
    );
  }

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
          minHeight: currentSize.minHeight,
        },
        variantStyles.container,
        fullWidth && styles.fullWidth,
        animatedContainerStyle,
        style,
      ]}
    >
      {buttonContent}
    </AnimatedTouchable>
  );
}

// Icon Button - for icon-only buttons
interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filled' | 'outline';
  color?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  size = 'md',
  variant = 'default',
  color,
  disabled = false,
  style,
}: IconButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    haptics.light();
    scale.value = withSpring(0.9, EASING.springSnappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, EASING.springSnappy);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeConfig = {
    sm: { size: 36, iconSize: 18 },
    md: { size: 44, iconSize: 22 },
    lg: { size: 52, iconSize: 26 },
  };

  const currentSize = sizeConfig[size];
  const iconColor = color || colors.text;

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: colors.surface,
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          backgroundColor: 'transparent',
        };
    }
  };

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={1}
      style={[
        styles.iconButton,
        {
          width: currentSize.size,
          height: currentSize.size,
          borderRadius: currentSize.size / 2,
          opacity: disabled ? 0.5 : 1,
        },
        getVariantStyles(),
        animatedStyle,
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={currentSize.iconSize}
        color={disabled ? colors.textDisabled : iconColor}
      />
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
    fontFamily: FONTS.sansSemiBold,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  iconLeft: {
    marginRight: SPACING.sm,
  },
  iconRight: {
    marginLeft: SPACING.sm,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
