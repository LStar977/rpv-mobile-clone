// Redesign button. Gold is reserved for the primary action / the "act" of voting
// (per the brief), so `primary` is the only gold variant. Secondary is a
// surface+hairline pill; ghost is text-only. Includes press-scale animation
// (rv-press, MOTION.press) and a loading state.
import React, { useRef } from 'react';
import {
  Pressable,
  Animated,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  View,
} from 'react-native';
import { useTheme } from '../../lib/theme';
import { T } from './Text';
import { RADIUS, MOTION } from '../../lib/redesign';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  right?: React.ReactNode; // e.g. an arrow glyph
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  right,
}: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const press = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: MOTION.press / 2, useNativeDriver: true }).start();

  const styles: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.gold, fg: colors.textInverse },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.textSecondary },
    destructive: { bg: colors.errorSurface, fg: colors.error, border: colors.errorSurfaceStrong },
  };
  const v = styles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      onPressIn={() => !isDisabled && press(0.965)}
      onPressOut={() => press(1)}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      <Animated.View
        style={[
          {
            transform: [{ scale }],
            height: 56,
            borderRadius: RADIUS.button,
            backgroundColor: v.bg,
            borderWidth: v.border ? 1 : 0,
            borderColor: v.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: isDisabled ? 0.5 : 1,
            alignSelf: fullWidth ? 'stretch' : 'flex-start',
            paddingHorizontal: fullWidth ? 0 : 24,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <>
            <T variant="button" color={v.fg}>{label}</T>
            {right ? <View>{right}</View> : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}
