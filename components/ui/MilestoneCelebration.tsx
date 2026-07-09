import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, SPACING, TYPOGRAPHY } from '../../lib/theme';
import { ConfettiParticles } from './ConfettiParticles';
import { soundEffects } from '../../lib/sounds';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MilestoneCelebrationProps {
  visible: boolean;
  type: 'badge' | 'milestone' | 'achievement' | 'streak';
  title: string;
  subtitle?: string;
  emoji?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  tier?: 'common' | 'rare' | 'epic' | 'legendary';
  onDismiss: () => void;
  autoDismissMs?: number;
}

const TIER_COLORS = {
  common: ['#6B7280', '#4B5563'],
  rare: ['#3B82F6', '#1D4ED8'],
  epic: ['#8B5CF6', '#6D28D9'],
  legendary: ['#D4AF37', '#A68523'],
};

const TIER_PARTICLES = {
  common: ['#9CA3AF', '#6B7280', '#4B5563'],
  rare: ['#60A5FA', '#3B82F6', '#1D4ED8'],
  epic: ['#A78BFA', '#8B5CF6', '#6D28D9'],
  legendary: ['#FFD700', '#D4AF37', '#A68523', '#FFE082'],
};

export function MilestoneCelebration({
  visible,
  type,
  title,
  subtitle,
  emoji,
  iconName,
  tier = 'common',
  onDismiss,
  autoDismissMs = 3500,
}: MilestoneCelebrationProps) {
  const { colors } = useTheme();
  const [showConfetti, setShowConfetti] = useState(false);

  const overlayOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.5);
  const cardOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconRotation = useSharedValue(-30);
  const shimmerPosition = useSharedValue(-1);
  const glowPulse = useSharedValue(0);
  const starScale = useSharedValue(0);

  const tierColors = TIER_COLORS[tier];
  const particleColors = TIER_PARTICLES[tier];

  useEffect(() => {
    if (visible) {
      // Play celebration sound
      if (type === 'badge') {
        soundEffects.badgeUnlock();
      } else {
        soundEffects.celebration();
      }

      setShowConfetti(true);

      // Overlay fade in
      overlayOpacity.value = withTiming(1, { duration: 200 });

      // Card animation
      cardScale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 200 }));
      cardOpacity.value = withDelay(100, withTiming(1, { duration: 200 }));

      // Icon animation
      iconScale.value = withDelay(250, withSpring(1, { damping: 8, stiffness: 180 }));
      iconRotation.value = withDelay(250, withSpring(0, { damping: 10, stiffness: 150 }));

      // Shimmer animation
      shimmerPosition.value = withDelay(
        400,
        withRepeat(
          withTiming(1, { duration: 1500, easing: Easing.linear }),
          -1,
          false
        )
      );

      // Glow pulse
      glowPulse.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 800 }),
            withTiming(0.5, { duration: 800 })
          ),
          -1,
          true
        )
      );

      // Stars animation
      starScale.value = withDelay(500, withSpring(1, { damping: 8 }));

      // Auto dismiss
      const timeout = setTimeout(() => {
        dismissAnimation();
      }, autoDismissMs);

      return () => clearTimeout(timeout);
    } else {
      resetAnimation();
    }
  }, [visible]);

  const resetAnimation = () => {
    overlayOpacity.value = 0;
    cardScale.value = 0.5;
    cardOpacity.value = 0;
    iconScale.value = 0;
    iconRotation.value = -30;
    shimmerPosition.value = -1;
    glowPulse.value = 0;
    starScale.value = 0;
    setShowConfetti(false);
  };

  const dismissAnimation = () => {
    cardScale.value = withTiming(0.9, { duration: 150 });
    cardOpacity.value = withTiming(0, { duration: 150 });
    overlayOpacity.value = withDelay(100, withTiming(0, { duration: 200 }, () => {
      runOnJS(onDismiss)();
    }));
    setShowConfetti(false);
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: iconScale.value },
      { rotate: `${iconRotation.value}deg` },
    ],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerPosition.value,
          [-1, 1],
          [-200, 200]
        ),
      },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(glowPulse.value, [0, 1], [1, 1.2]) }],
  }));

  const starsStyle = useAnimatedStyle(() => ({
    opacity: starScale.value,
    transform: [{ scale: starScale.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <ConfettiParticles
          visible={showConfetti}
          colors={particleColors}
          particleCount={tier === 'legendary' ? 80 : tier === 'epic' ? 60 : 40}
          duration={2500}
        />

        <Animated.View style={[styles.cardContainer, cardStyle]}>
          {/* Glow effect */}
          <Animated.View style={[styles.glow, glowStyle]}>
            <LinearGradient
              colors={[...tierColors, 'transparent']}
              style={styles.glowGradient}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
          </Animated.View>

          <LinearGradient
            colors={[colors.surface, colors.background]}
            style={styles.card}
          >
            {/* Shimmer overlay */}
            <Animated.View style={[styles.shimmerContainer, shimmerStyle]}>
              <LinearGradient
                colors={['transparent', `${tierColors[0]}40`, 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.shimmer}
              />
            </Animated.View>

            {/* Stars decoration */}
            <Animated.View style={[styles.starsContainer, starsStyle]}>
              {tier === 'legendary' && (
                <>
                  <Text style={[styles.star, { left: 30, top: 20 }]}>✦</Text>
                  <Text style={[styles.star, { right: 30, top: 25 }]}>✦</Text>
                  <Text style={[styles.star, { left: 50, bottom: 40 }]}>✦</Text>
                  <Text style={[styles.star, { right: 45, bottom: 35 }]}>✦</Text>
                </>
              )}
            </Animated.View>

            {/* Icon/Emoji */}
            <Animated.View style={[styles.iconContainer, iconStyle]}>
              <LinearGradient
                colors={tierColors}
                style={styles.iconBackground}
              >
                {emoji ? (
                  <Text style={styles.emoji}>{emoji}</Text>
                ) : iconName ? (
                  <Ionicons name={iconName} size={48} color="#fff" />
                ) : (
                  <Ionicons name="trophy" size={48} color="#fff" />
                )}
              </LinearGradient>
            </Animated.View>

            {/* Text content */}
            <Text style={[styles.title, { color: tierColors[0] }]}>{title}</Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {subtitle}
              </Text>
            )}

            {/* Tier badge */}
            <View style={[styles.tierBadge, { backgroundColor: `${tierColors[0]}20` }]}>
              <Text style={[styles.tierText, { color: tierColors[0] }]}>
                {tier.toUpperCase()}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 340,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 100,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  shimmer: {
    width: 100,
    height: '100%',
  },
  starsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    fontSize: 16,
    color: '#FFD700',
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    ...TYPOGRAPHY.headlineMedium,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  tierBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  tierText: {
    ...TYPOGRAPHY.labelSmall,
    letterSpacing: 1.5,
  },
});

export default MilestoneCelebration;
