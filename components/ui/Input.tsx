import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolateColor,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme, RADIUS, SPACING, TYPOGRAPHY, EASING } from '../../lib/theme';
import { haptics } from '../../lib/haptics';

const AnimatedView = Animated.View;
const AnimatedText = Animated.Text;

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
  size?: 'sm' | 'md' | 'lg';
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
  size = 'md',
  secureTextEntry,
  ...props
}: InputProps) {
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const focusAnim = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const sizeConfig = {
    sm: { minHeight: 44, fontSize: 14, iconSize: 18, paddingHorizontal: SPACING.md },
    md: { minHeight: 52, fontSize: 15, iconSize: 20, paddingHorizontal: SPACING.lg },
    lg: { minHeight: 60, fontSize: 17, iconSize: 22, paddingHorizontal: SPACING.xl },
  };

  const currentSize = sizeConfig[size];

  const handleFocus = () => {
    haptics.light();
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

    const backgroundColor = interpolateColor(
      focusAnim.value,
      [0, 1],
      [colors.inputBg, colors.inputBgFocus]
    );

    return {
      borderColor,
      backgroundColor,
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => {
    const color = error
      ? colors.error
      : interpolateColor(
          focusAnim.value,
          [0, 1],
          [colors.textSecondary, colors.gold]
        );

    return { color };
  });

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: 'transparent',
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
        };
      default:
        return {
          backgroundColor: colors.inputBg,
          borderWidth: 1,
        };
    }
  };

  const showPasswordToggle = secureTextEntry;
  const actualSecureEntry = secureTextEntry && !isPasswordVisible;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <AnimatedText
          style={[
            styles.label,
            animatedLabelStyle,
          ]}
        >
          {label}
        </AnimatedText>
      )}

      <AnimatedView
        style={[
          styles.container,
          {
            minHeight: currentSize.minHeight,
            paddingHorizontal: currentSize.paddingHorizontal,
            borderRadius: RADIUS.input,
          },
          getVariantStyles(),
          animatedContainerStyle,
          error && { borderColor: colors.error },
        ]}
      >
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons
              name={leftIcon}
              size={currentSize.iconSize}
              color={isFocused ? colors.gold : colors.textTertiary}
            />
          </View>
        )}

        <TextInput
          ref={inputRef}
          {...props}
          secureTextEntry={actualSecureEntry}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: currentSize.fontSize,
            },
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || showPasswordToggle) && styles.inputWithRightIcon,
            inputStyle,
          ]}
          placeholderTextColor={colors.textTertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor={colors.gold}
          cursorColor={colors.gold}
        />

        {showPasswordToggle ? (
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setIsPasswordVisible(!isPasswordVisible);
            }}
            style={styles.rightIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={currentSize.iconSize}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ) : rightIcon ? (
          <TouchableOpacity
            onPress={() => {
              if (onRightIconPress) {
                haptics.light();
                onRightIconPress();
              }
            }}
            style={styles.rightIconButton}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={rightIcon}
              size={currentSize.iconSize}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ) : null}
      </AnimatedView>

      {(error || hint) && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
          <Text
            style={[
              styles.helperText,
              { color: error ? colors.error : colors.textTertiary },
            ]}
          >
            {error || hint}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

// TextArea variant
interface TextAreaProps extends InputProps {
  numberOfLines?: number;
}

export function TextArea({
  numberOfLines = 4,
  ...props
}: TextAreaProps) {
  return (
    <Input
      {...props}
      multiline
      numberOfLines={numberOfLines}
      textAlignVertical="top"
      inputStyle={{
        minHeight: numberOfLines * 24,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.md,
      }}
    />
  );
}

// Search Input variant
interface SearchInputProps extends InputProps {
  onClear?: () => void;
}

export function SearchInput({
  onClear,
  value,
  placeholder = 'Search...',
  ...props
}: SearchInputProps) {
  const { colors } = useTheme();

  return (
    <Input
      {...props}
      value={value}
      placeholder={placeholder}
      leftIcon="search-outline"
      rightIcon={value ? 'close-circle' : undefined}
      onRightIconPress={onClear}
      variant="filled"
      size="md"
    />
  );
}

// OTP Input - for verification codes
interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  error,
  autoFocus = true,
}: OTPInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);

  const handlePress = () => {
    haptics.light();
    inputRef.current?.focus();
  };

  const handleChange = (text: string) => {
    const cleanText = text.replace(/[^0-9]/g, '').slice(0, length);
    onChange(cleanText);
  };

  return (
    <View style={styles.otpWrapper}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        style={styles.otpContainer}
      >
        {Array.from({ length }).map((_, index) => {
          const isActive = focused && index === value.length;
          const isFilled = index < value.length;

          return (
            <View
              key={index}
              style={[
                styles.otpBox,
                {
                  backgroundColor: isFilled ? colors.goldSurface : colors.surface,
                  borderColor: error
                    ? colors.error
                    : isActive
                    ? colors.gold
                    : colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.otpText,
                  { color: isFilled ? colors.text : colors.textTertiary },
                ]}
              >
                {value[index] || ''}
              </Text>
              {isActive && (
                <View style={[styles.otpCursor, { backgroundColor: colors.gold }]} />
              )}
            </View>
          );
        })}
      </TouchableOpacity>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.otpHiddenInput}
        caretHidden
      />

      {error && (
        <Text style={[styles.otpError, { color: colors.error }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.lg,
  },
  label: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingVertical: Platform.select({ ios: SPACING.md, android: SPACING.sm }),
    ...TYPOGRAPHY.body,
  },
  inputWithLeftIcon: {
    paddingLeft: SPACING.sm,
  },
  inputWithRightIcon: {
    paddingRight: SPACING.sm,
  },
  leftIconContainer: {
    marginRight: SPACING.sm,
  },
  rightIconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  helperText: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  // OTP styles
  otpWrapper: {
    alignItems: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  otpText: {
    ...TYPOGRAPHY.h3,
  },
  otpCursor: {
    position: 'absolute',
    width: 2,
    height: 24,
    borderRadius: 1,
  },
  otpHiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpError: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
});
