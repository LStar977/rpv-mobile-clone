import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  shape: 'square' | 'circle' | 'rectangle';
}

interface ConfettiParticlesProps {
  visible: boolean;
  colors?: string[];
  particleCount?: number;
  duration?: number;
}

const DEFAULT_COLORS = [
  '#D4AF37', // Gold
  '#FFD700', // Bright gold
  '#2BB673', // Success green
  '#4ADE80', // Light green
  '#60A5FA', // Blue
  '#F472B6', // Pink
  '#A78BFA', // Purple
  '#FB923C', // Orange
];

function ConfettiParticle({ particle, visible }: { particle: Particle; visible: boolean }) {
  const progress = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = 0;
      rotation.value = 0;

      progress.value = withDelay(
        particle.delay,
        withTiming(1, {
          duration: particle.duration,
          easing: Easing.out(Easing.quad),
        })
      );

      rotation.value = withDelay(
        particle.delay,
        withTiming(particle.rotation * 360, {
          duration: particle.duration,
          easing: Easing.linear,
        })
      );
    } else {
      progress.value = 0;
      rotation.value = 0;
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      progress.value,
      [0, 0.3, 1],
      [-50, SCREEN_HEIGHT * 0.3, SCREEN_HEIGHT * 0.8]
    );

    const translateX = interpolate(
      progress.value,
      [0, 1],
      [0, (Math.random() - 0.5) * 100]
    );

    const scale = interpolate(
      progress.value,
      [0, 0.1, 0.8, 1],
      [0, 1, 1, 0.3]
    );

    const opacity = interpolate(
      progress.value,
      [0, 0.1, 0.7, 1],
      [0, 1, 1, 0]
    );

    return {
      transform: [
        { translateY },
        { translateX },
        { scale },
        { rotate: `${rotation.value}deg` },
      ],
      opacity,
    };
  });

  const shapeStyle = useMemo(() => {
    switch (particle.shape) {
      case 'circle':
        return { borderRadius: particle.size / 2 };
      case 'rectangle':
        return { width: particle.size * 0.5, height: particle.size * 1.5, borderRadius: 2 };
      default:
        return { borderRadius: 2 };
    }
  }, [particle]);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: particle.x,
          width: particle.size,
          height: particle.size,
          backgroundColor: particle.color,
        },
        shapeStyle,
        animatedStyle,
      ]}
    />
  );
}

export function ConfettiParticles({
  visible,
  colors = DEFAULT_COLORS,
  particleCount = 50,
  duration = 2000,
}: ConfettiParticlesProps) {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 8,
      delay: Math.random() * 300,
      duration: duration * (0.8 + Math.random() * 0.4),
      rotation: 2 + Math.random() * 4,
      shape: (['square', 'circle', 'rectangle'] as const)[Math.floor(Math.random() * 3)],
    }));
  }, [colors, particleCount, duration]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.map((particle) => (
        <ConfettiParticle key={particle.id} particle={particle} visible={visible} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
});

export default ConfettiParticles;
