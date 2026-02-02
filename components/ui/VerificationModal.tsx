import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';

interface VerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onGetVerified: () => void;
  title?: string;
  message?: string;
  type?: 'verification' | 'location';
}

export function VerificationModal({
  visible,
  onClose,
  onGetVerified,
  title = 'Verification Required',
  message = 'This proposal is restricted to verified users in specific regions. Complete identity verification to vote.',
  type = 'verification',
}: VerificationModalProps) {
  const { colors } = useTheme();

  const overlayOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(20);
  const iconScale = useSharedValue(0);

  const isLocationRestriction = type === 'location';

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Animate in
      overlayOpacity.value = withTiming(1, { duration: 200 });
      cardOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));
      cardScale.value = withDelay(100, withSpring(1, ANIMATION.spring.bouncy));
      cardTranslateY.value = withDelay(100, withSpring(0, ANIMATION.spring.gentle));
      iconScale.value = withDelay(200, withSpring(1, ANIMATION.spring.bouncy));
    } else {
      // Reset values
      overlayOpacity.value = 0;
      cardScale.value = 0.9;
      cardOpacity.value = 0;
      cardTranslateY.value = 20;
      iconScale.value = 0;
    }
  }, [visible]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Animate out
    iconScale.value = withTiming(0.8, { duration: 100 });
    cardOpacity.value = withTiming(0, { duration: 150 });
    cardScale.value = withTiming(0.9, { duration: 150 });
    overlayOpacity.value = withDelay(50, withTiming(0, { duration: 200 }, () => {
      runOnJS(onClose)();
    }));
  };

  const handleGetVerified = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Animate out then navigate
    iconScale.value = withTiming(0.8, { duration: 100 });
    cardOpacity.value = withTiming(0, { duration: 150 });
    cardScale.value = withTiming(0.9, { duration: 150 });
    overlayOpacity.value = withDelay(50, withTiming(0, { duration: 200 }, () => {
      runOnJS(onGetVerified)();
    }));
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'auto' : 'none',
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { scale: cardScale.value },
      { translateY: cardTranslateY.value },
    ],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  if (!visible && overlayOpacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.gold }, cardStyle]}>
        <LinearGradient
          colors={[`${colors.gold}10`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Icon */}
        <Animated.View style={[styles.iconContainer, iconStyle]}>
          <View style={[styles.iconCircle, { backgroundColor: `${isLocationRestriction ? colors.error : colors.gold}15` }]}>
            <Ionicons
              name={isLocationRestriction ? 'location-outline' : 'shield-checkmark'}
              size={40}
              color={isLocationRestriction ? colors.error : colors.gold}
            />
          </View>
        </Animated.View>

        {/* Content */}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>

        {/* Buttons */}
        {!isLocationRestriction && (
          <TouchableOpacity onPress={handleGetVerified} activeOpacity={0.9}>
            <LinearGradient
              colors={[colors.gold, colors.goldDark || '#A68523']}
              style={styles.primaryButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="shield-checkmark" size={18} color="#000" />
              <Text style={styles.primaryButtonText}>Get Verified ($4.99)</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={handleClose}
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
            {isLocationRestriction ? 'OK' : 'Cancel'}
          </Text>
        </TouchableOpacity>

        {/* Premium upsell hint */}
        {!isLocationRestriction && (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Or subscribe to Premium for verification included
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: SPACING.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    alignItems: 'center',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
    minWidth: 220,
    ...SHADOWS.sm,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginTop: SPACING.md,
    minWidth: 220,
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },
  hint: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginTop: SPACING.lg,
  },
});

export default VerificationModal;
