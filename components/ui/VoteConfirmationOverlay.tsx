import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, SPACING, TYPOGRAPHY, ANIMATION } from '../../lib/theme';
import { ConfettiParticles } from './ConfettiParticles';
import { soundEffects } from '../../lib/sounds';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VoteConfirmationOverlayProps {
  visible: boolean;
  voteType: 'support' | 'oppose';
  onDismiss: () => void;
}

export function VoteConfirmationOverlay({
  visible,
  voteType,
  onDismiss,
}: VoteConfirmationOverlayProps) {
  const { colors } = useTheme();

  const overlayOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconRotation = useSharedValue(-45);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const ringScale = useSharedValue(0.8);
  const ringOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const isSupport = voteType === 'support';
  const iconColor = isSupport ? colors.success : colors.error;
  const iconName = isSupport ? 'checkmark-circle' : 'close-circle';
  const voteText = isSupport ? 'Vote Supported' : 'Vote Opposed';
  const subtitleText = isSupport
    ? 'Your voice has been recorded'
    : 'Your opposition has been noted';

  // Confetti colors based on vote type
  const confettiColors = isSupport
    ? ['#D4AF37', '#FFD700', '#2BB673', '#4ADE80', '#60A5FA']
    : ['#D4AF37', '#FFD700', '#DC2626', '#EF4444', '#FB923C'];

  useEffect(() => {
    if (visible) {
      // Play sound effect
      if (isSupport) {
        soundEffects.voteSuccess();
      } else {
        soundEffects.voteOppose();
      }

      // Animate in
      overlayOpacity.value = withTiming(1, { duration: 200 });

      // Glow pulse animation
      glowOpacity.value = withDelay(
        50,
        withSequence(
          withTiming(0.6, { duration: 200 }),
          withTiming(0.3, { duration: 300 })
        )
      );

      // Ring pulse animation
      ringOpacity.value = withDelay(100, withTiming(0.4, { duration: 200 }));
      ringScale.value = withDelay(
        100,
        withSequence(
          withSpring(1.3, ANIMATION.spring.bouncy),
          withTiming(1.6, { duration: 500 })
        )
      );
      ringOpacity.value = withDelay(
        100,
        withSequence(
          withTiming(0.4, { duration: 200 }),
          withDelay(300, withTiming(0, { duration: 400 }))
        )
      );

      // Icon animation - scale up with rotation and pulse
      iconScale.value = withDelay(150, withSpring(1, ANIMATION.spring.bouncy));
      iconRotation.value = withDelay(150, withSpring(0, ANIMATION.spring.bouncy));

      // Pulse effect on icon
      pulseScale.value = withDelay(
        400,
        withSequence(
          withSpring(1.1, { damping: 8, stiffness: 400 }),
          withSpring(1, { damping: 10, stiffness: 200 })
        )
      );

      // Text fade in
      textOpacity.value = withDelay(350, withTiming(1, { duration: 250 }));
      textTranslateY.value = withDelay(350, withSpring(0, ANIMATION.spring.gentle));

      // Auto dismiss after delay
      const timeout = setTimeout(() => {
        // Animate out
        textOpacity.value = withTiming(0, { duration: 150 });
        iconScale.value = withTiming(0.8, { duration: 150 });
        glowOpacity.value = withTiming(0, { duration: 150 });
        overlayOpacity.value = withDelay(
          100,
          withTiming(0, { duration: 200 }, () => {
            runOnJS(onDismiss)();
          })
        );
      }, 1800);

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
      pulseScale.value = 1;
      glowOpacity.value = 0;
    }
  }, [visible, isSupport]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: overlayOpacity.value > 0 ? 'auto' : 'none',
  }));

  const iconContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value * pulseScale.value },
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

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: 1.5 }],
  }));

  if (!visible && overlayOpacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      {/* Confetti for support votes */}
      <ConfettiParticles
        visible={visible}
        colors={confettiColors}
        particleCount={isSupport ? 60 : 30}
        duration={2000}
      />

      <View style={styles.content}>
        {/* Animated outer ring */}
        <Animated.View
          style={[styles.ring, { borderColor: iconColor }, ringStyle]}
        />

        {/* Second ring for depth */}
        <Animated.View
          style={[
            styles.ring,
            styles.ringInner,
            { borderColor: iconColor },
            ringStyle,
          ]}
        />

        {/* Icon container with enhanced glow */}
        <Animated.View style={[styles.iconContainer, iconContainerStyle]}>
          {/* Outer glow */}
          <Animated.View
            style={[
              styles.iconGlowOuter,
              { backgroundColor: iconColor },
              glowStyle,
            ]}
          />

          {/* Inner glow */}
          <View
            style={[
              styles.iconGlow,
              { backgroundColor: iconColor, shadowColor: iconColor },
            ]}
          />

          {/* Icon circle */}
          <View style={[styles.iconCircle, { backgroundColor: iconColor }]}>
            <Ionicons name={iconName} size={64} color="#fff" />
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={[styles.title, { color: colors.text }]}>{voteText}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitleText}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
  },
  ringInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    opacity: 0.5,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlowOuter: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  iconGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    opacity: 0.4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 25,
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
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
  },
});

export default VoteConfirmationOverlay;
