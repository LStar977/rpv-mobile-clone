import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, ANIMATION } from '../../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VoteConfirmationOverlayProps {
  visible: boolean;
  voteType: 'support' | 'oppose';
  onDismiss: () => void;
  // When provided, a "Share your vote" pill renders under the confirmation
  // text and the auto-dismiss window stretches to give it a beat. This is
  // the single cheapest viral moment in the app — the user just acted and
  // is at peak motivation to tell someone.
  onShare?: () => void;
}

export function VoteConfirmationOverlay({
  visible,
  voteType,
  onDismiss,
  onShare,
}: VoteConfirmationOverlayProps) {
  const { colors } = useTheme();

  const overlayOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconRotation = useSharedValue(-45);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const ringScale = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0);

  const isSupport = voteType === 'support';
  const iconColor = isSupport ? colors.support : colors.oppose;
  const iconName = isSupport ? 'checkmark-circle' : 'close-circle';
  const voteText = isSupport ? 'Vote Supported' : 'Vote Opposed';

  useEffect(() => {
    if (visible) {
      // Animate in
      overlayOpacity.value = withTiming(1, { duration: 200 });

      // Ring pulse animation
      ringOpacity.value = withDelay(100, withTiming(0.3, { duration: 200 }));
      ringScale.value = withDelay(100, withSequence(
        withSpring(1.2, ANIMATION.spring.bouncy),
        withTiming(1.5, { duration: 400 }),
      ));
      ringOpacity.value = withDelay(100, withSequence(
        withTiming(0.3, { duration: 200 }),
        withDelay(200, withTiming(0, { duration: 300 })),
      ));

      // Icon animation - scale up with rotation
      iconScale.value = withDelay(150, withSpring(1, ANIMATION.spring.bouncy));
      iconRotation.value = withDelay(150, withSpring(0, ANIMATION.spring.bouncy));

      // Text fade in
      textOpacity.value = withDelay(350, withTiming(1, { duration: 250 }));
      textTranslateY.value = withDelay(350, withSpring(0, ANIMATION.spring.gentle));

      // Auto dismiss after delay (longer when the share pill is showing,
      // so there's actually time to tap it)
      const timeout = setTimeout(() => {
        // Animate out
        textOpacity.value = withTiming(0, { duration: 150 });
        iconScale.value = withTiming(0.8, { duration: 150 });
        overlayOpacity.value = withDelay(100, withTiming(0, { duration: 200 }, () => {
          runOnJS(onDismiss)();
        }));
      }, onShare ? 2800 : 1500);

      return () => clearTimeout(timeout);
    } else {
      // Reset values
      overlayOpacity.value = 0;
      iconScale.value = 0;
      iconRotation.value = -45;
      textOpacity.value = 0;
      textTranslateY.value = 20;
      ringScale.value = 0.8;
      ringOpacity.value = 0;
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'auto' : 'none',
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotation.value}deg` },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  if (!visible && overlayOpacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <View style={styles.content}>
        {/* Animated ring */}
        <Animated.View
          style={[
            styles.ring,
            { borderColor: iconColor },
            ringStyle,
          ]}
        />

        {/* Icon container with glow */}
        <Animated.View style={[styles.iconContainer, iconContainerStyle]}>
          <View
            style={[
              styles.iconGlow,
              { backgroundColor: iconColor, shadowColor: iconColor },
            ]}
          />
          <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
            <Ionicons
              name={iconName}
              size={64}
              color="#fff"
            />
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={[styles.title, { color: colors.gold }]}>
            {voteText}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Your voice has been recorded
          </Text>
          {onShare && (
            <TouchableOpacity
              style={[styles.shareBtn, { borderColor: colors.gold }]}
              onPress={() => { onShare(); onDismiss(); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Share your vote"
            >
              <Ionicons name="share-outline" size={16} color={colors.gold} />
              <Text style={[styles.shareText, { color: colors.gold }]}>Share your vote</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.headlineLarge,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
  },
  shareText: {
    ...TYPOGRAPHY.labelMedium,
  },
});

export default VoteConfirmationOverlay;
