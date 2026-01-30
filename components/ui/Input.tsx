import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme, BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../../lib/theme';

const AnimatedView = Animated.View;

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  variant?: 'default' | 'filled' | 'outlined';
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  variant = 'default',
  secureTextEntry,
  ...props
}: InputProps) {
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const focusAnim = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const handleFocus = () => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: 200 });
    props.onFocus?.(null as any);
  };

  const handleBlur = () => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
    props.onBlur?.(null as any);
  };

  const animatedContainerStyle = useAnimatedStyle(() => {
    const borderColor = error
      ? colors.error
      : interpolateColor(
          focusAnim.value,
          [0, 1],
          [colors.border, colors.gold]
        );

    return {
      borderColor,
      transform: [
        { scale: withTiming(isFocused ? 1.01 : 1, { duration: 150 }) },
      ],
    };
  });

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: colors.cardBgLight,
          borderWidth: 1.5,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
        };
      default:
        return {
          backgroundColor: colors.cardBg,
          borderWidth: 1,
        };
    }
  };

  const showPasswordToggle = secureTextEntry;
  const actualSecureEntry = secureTextEntry && !isPasswordVisible;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: error ? colors.error : isFocused ? colors.gold : colors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}

      <AnimatedView
        style={[
          styles.container,
          getVariantStyles(),
          animatedContainerStyle,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={isFocused ? colors.gold : colors.textMuted}
            style={styles.leftIcon}
          />
        )}

        <TextInput
          ref={inputRef}
          {...props}
          secureTextEntry={actualSecureEntry}
          style={[
            styles.input,
            { color: colors.text },
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
            inputStyle,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={colors.gold}
        />

        {showPasswordToggle ? (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconButton}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={rightIcon}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </AnimatedView>

      {(error || hint) && (
        <Text
          style={[
            styles.helperText,
            { color: error ? colors.error : colors.textMuted },
          ]}
        >
          {error || hint}
        </Text>
      )}
    </View>
  );
}

// TextArea variant
export function TextArea({
  numberOfLines = 4,
  ...props
}: InputProps & { numberOfLines?: number }) {
  return (
    <Input
      {...props}
      multiline
      numberOfLines={numberOfLines}
      textAlignVertical="top"
      inputStyle={{
        minHeight: numberOfLines * 24,
        paddingTop: SPACING.md,
      }}
    />
  );
}

// Search Input variant
export function SearchInput({
  onClear,
  value,
  ...props
}: InputProps & { onClear?: () => void }) {
  const { colors } = useTheme();

  return (
    <Input
      {...props}
      value={value}
      leftIcon="search-outline"
      rightIcon={value ? 'close-circle' : undefined}
      onRightIconPress={onClear}
      variant="filled"
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    minHeight: 52,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.bodyLarge,
    paddingVertical: SPACING.md,
  },
  inputWithLeftIcon: {
    paddingLeft: SPACING.sm,
  },
  inputWithRightIcon: {
    paddingRight: SPACING.sm,
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  rightIconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  helperText: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
});
