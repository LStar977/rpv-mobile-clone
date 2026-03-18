import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  interpolate,
  Extrapolation,
  Easing,
  runOnJS,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, SHADOWS, EASING, responsive } from '../lib/theme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../lib/auth';
import { router } from 'expo-router';
import { isBiometricAvailable, getBiometricType, authenticateWithBiometrics, isBiometricEnabled } from '../lib/biometrics';
import { Button, Input, Card, Badge } from '../components/ui';
import { haptics } from '../lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

GoogleSignin.configure({
  iosClientId: '945878560232-blus90hj4nqh6h32msts24971t72f8g7.apps.googleusercontent.com',
  webClientId: '945878560232-8ot8f3lr62436nlrm9qas82aras59koi.apps.googleusercontent.com',
  offlineAccess: true,
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM VISUAL EFFECTS - Billion Dollar Feel
// ═══════════════════════════════════════════════════════════════════════════════

// Floating Particle Component
function Particle({ delay, color }: { delay: number; color: string }) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);

  const startX = useMemo(() => Math.random() * SCREEN_WIDTH, []);
  const size = useMemo(() => 2 + Math.random() * 4, []);
  const duration = useMemo(() => 4000 + Math.random() * 3000, []);
  const swayAmount = useMemo(() => 20 + Math.random() * 30, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Vertical movement
      translateY.value = withRepeat(
        withTiming(-100, { duration, easing: Easing.linear }),
        -1,
        false
      );
      // Horizontal sway
      translateX.value = withRepeat(
        withSequence(
          withTiming(swayAmount, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
          withTiming(-swayAmount, { duration: duration / 2, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      // Fade in/out based on position
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.6 + Math.random() * 0.4, { duration: duration * 0.2 }),
          withTiming(0.6 + Math.random() * 0.4, { duration: duration * 0.6 }),
          withTiming(0, { duration: duration * 0.2 })
        ),
        -1,
        false
      );
      // Subtle scale pulse
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: startX,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// Particle Field - Floating particles background
function ParticleField() {
  const { colors } = useTheme();
  const particles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      delay: i * 200,
    })),
    []
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((particle) => (
        <Particle key={particle.id} delay={particle.delay} color={colors.gold + '60'} />
      ))}
    </View>
  );
}

// Animated Glow Orb - Multi-layered ethereal glow
function AnimatedGlowOrb({ color }: { color: string }) {
  const scale1 = useSharedValue(1);
  const scale2 = useSharedValue(1);
  const scale3 = useSharedValue(1);
  const opacity1 = useSharedValue(0.15);
  const opacity2 = useSharedValue(0.1);
  const opacity3 = useSharedValue(0.05);

  useEffect(() => {
    // Layer 1 - Inner glow
    scale1.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    opacity1.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    // Layer 2 - Middle glow (offset timing)
    scale2.value = withDelay(500, withRepeat(
      withSequence(
        withTiming(1.3, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
    opacity2.value = withDelay(500, withRepeat(
      withSequence(
        withTiming(0.15, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.08, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
    // Layer 3 - Outer glow (offset timing)
    scale3.value = withDelay(1000, withRepeat(
      withSequence(
        withTiming(1.6, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.3, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
    opacity3.value = withDelay(1000, withRepeat(
      withSequence(
        withTiming(0.1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.04, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
  }, []);

  const layer1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: opacity1.value,
  }));
  const layer2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: opacity2.value,
  }));
  const layer3Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale3.value }],
    opacity: opacity3.value,
  }));

  const baseStyle = {
    position: 'absolute' as const,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: color,
  };

  return (
    <View style={{ position: 'absolute', width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[baseStyle, { width: 200, height: 200, borderRadius: 100, marginLeft: -30, marginTop: -30 }, layer3Style]} />
      <Animated.View style={[baseStyle, { width: 170, height: 170, borderRadius: 85, marginLeft: -15, marginTop: -15 }, layer2Style]} />
      <Animated.View style={[baseStyle, layer1Style]} />
    </View>
  );
}

// Self-Drawing Ring - SVG circle that animates its stroke
function SelfDrawingRing({ size, color }: { size: number; color: string }) {
  const progress = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const circumference = Math.PI * (size - 4);

  useEffect(() => {
    // Draw the ring
    progress.value = withDelay(300, withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }));
    // Glow after drawing
    glowOpacity.value = withDelay(1500, withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={{ position: 'absolute', width: size, height: size }}>
      {/* Glow layer */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, glowStyle]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={(size - 4) / 2}
            stroke={color}
            strokeWidth={6}
            fill="none"
            opacity={0.3}
          />
        </Svg>
      </Animated.View>
      {/* Main ring */}
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={1} />
            <Stop offset="50%" stopColor={color} stopOpacity={0.8} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.4} />
          </SvgLinearGradient>
        </Defs>
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={(size - 4) / 2}
          stroke="url(#ringGradient)"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
    </View>
  );
}

// Shimmer Effect - Diagonal light sweep
function ShimmerOverlay({ width, height }: { width: number; height: number }) {
  const translateX = useSharedValue(-width * 2);

  useEffect(() => {
    const runShimmer = () => {
      translateX.value = -width * 2;
      translateX.value = withDelay(
        4000,
        withTiming(width * 2, { duration: 800, easing: Easing.inOut(Easing.ease) })
      );
    };
    runShimmer();
    const interval = setInterval(runShimmer, 5000);
    return () => clearInterval(interval);
  }, [width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { rotate: '20deg' }],
  }));

  return (
    <View style={{ position: 'absolute', width, height, borderRadius: height / 2, overflow: 'hidden' }} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', width: width * 0.5, height: height * 2, top: -height / 2 }, animatedStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0.3)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </View>
  );
}

// Animated Gradient Text - Premium title effect
function AnimatedGradientTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  const gradientPosition = useSharedValue(0);

  useEffect(() => {
    gradientPosition.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  // Since MaskedView isn't available, we'll create a shimmer text effect
  const shimmerX = useSharedValue(-200);

  useEffect(() => {
    const runShimmer = () => {
      shimmerX.value = -200;
      shimmerX.value = withDelay(
        3000,
        withTiming(400, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      );
    };
    runShimmer();
    const interval = setInterval(runShimmer, 5000);
    return () => clearInterval(interval);
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View style={{ position: 'relative' }}>
      <Text style={[styles.brandName, { color: colors.gold }]}>{children}</Text>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }} pointerEvents="none">
        <Animated.View style={[{ position: 'absolute', width: 100, height: '100%', top: 0 }, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: '100%', height: '100%' }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

// Premium CTA Button with glow and shimmer
function PremiumCTAButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);
  const shimmerX = useSharedValue(-300);

  useEffect(() => {
    // Pulsing glow
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    // Periodic shimmer
    const runShimmer = () => {
      shimmerX.value = -300;
      shimmerX.value = withDelay(
        2000,
        withTiming(400, { duration: 600, easing: Easing.out(Easing.ease) })
      );
    };
    runShimmer();
    const interval = setInterval(runShimmer, 4000);
    return () => clearInterval(interval);
  }, []);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, EASING.springSnappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, EASING.springSnappy);
  };

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }, { rotate: '20deg' }],
  }));

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      style={[styles.premiumCTAContainer, buttonStyle]}
    >
      {/* Glow layer */}
      <Animated.View style={[styles.premiumCTAGlow, { backgroundColor: colors.gold }, glowStyle]} />

      {/* Button */}
      <LinearGradient
        colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.premiumCTAButton}
      >
        <Text style={[styles.premiumCTAText, { color: colors.black }]}>{title}</Text>

        {/* Shimmer */}
        <View style={styles.premiumCTAShimmerContainer}>
          <Animated.View style={[styles.premiumCTAShimmer, shimmerStyle]}>
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
        </View>
      </LinearGradient>
    </AnimatedTouchable>
  );
}

// Light Rays - Ambient rays from behind logo
function LightRays({ color }: { color: string }) {
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0.1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 60000, easing: Easing.linear }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.05, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.lightRaysContainer, animatedStyle]} pointerEvents="none">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <View
          key={angle}
          style={[
            styles.lightRay,
            {
              backgroundColor: color,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />
      ))}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORIGINAL COMPONENTS (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════════

// Pulsing Ring Component - single expanding ring
function PulsingRing({ delay, color }: { delay: number; color: string }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scale.value = withRepeat(
        withTiming(2.5, { duration: 3000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 300 }),
          withTiming(0, { duration: 2700 })
        ),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          borderWidth: 1,
          borderColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// Pulsing Rings Container - expanding circles from logo center
function PulsingRings() {
  const { colors } = useTheme();

  return (
    <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }} pointerEvents="none">
      {[0, 1, 2].map((index) => (
        <PulsingRing key={index} delay={index * 1000} color={colors.gold} />
      ))}
    </View>
  );
}

// Animated Aurora Background - enhanced with horizontal movement
function AuroraBackground() {
  const { colors } = useTheme();
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-80, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(80, { duration: 5000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    translateX.value = withRepeat(
      withSequence(
        withTiming(30, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-30, { duration: 7000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="none">
      <LinearGradient
        colors={[
          'transparent',
          colors.gold + '20',
          colors.gold + '10',
          'transparent',
        ]}
        locations={[0, 0.4, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

// Animated Logo Glow Component
function PulsingLogoGlow({ color }: { color: string }) {
  const glowOpacity = useSharedValue(0.15);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          bottom: 10,
          borderRadius: 70,
          backgroundColor: color,
          zIndex: -1,
        },
        animatedStyle,
      ]}
    />
  );
}

// Premium Feature Card Component
function FeatureCard({
  icon,
  label,
  tagline,
  delay,
  IconComponent = Ionicons,
}: {
  icon: string;
  label: string;
  tagline: string;
  delay: number;
  IconComponent?: any;
}) {
  const { colors } = useTheme();
  const floatY = useSharedValue(0);
  const iconGlow = useSharedValue(0.3);
  const iconScale = useSharedValue(1);
  const borderOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Gentle floating animation
    floatY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
    // Icon glow pulse
    iconGlow.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
    // Subtle icon scale
    iconScale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
    // Border glow animation
    borderOpacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: iconGlow.value,
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const borderStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(600).springify()}
      style={[floatStyle]}
    >
      <View style={[styles.featureCard, { backgroundColor: colors.surface }]}>
        {/* Animated border glow */}
        <Animated.View style={[styles.featureCardBorderGlow, { borderColor: colors.gold }, borderStyle]} />

        {/* Icon with glow */}
        <View style={styles.featureCardIconContainer}>
          <Animated.View style={[styles.featureCardIconGlow, { backgroundColor: colors.gold }, glowStyle]} />
          <Animated.View style={[styles.featureCardIconWrapper, { backgroundColor: colors.goldSurface }, iconAnimStyle]}>
            <IconComponent name={icon} size={24} color={colors.gold} />
          </Animated.View>
        </View>

        {/* Label */}
        <Text style={[styles.featureCardLabel, { color: colors.text }]}>{label}</Text>

        {/* Tagline */}
        <Text style={[styles.featureCardTagline, { color: colors.textTertiary }]}>{tagline}</Text>
      </View>
    </Animated.View>
  );
}

// Premium Social Button
function SocialButton({
  provider,
  onPress,
  disabled,
  loading,
}: {
  provider: 'google' | 'apple';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled) {
      haptics.light();
      scale.value = withSpring(0.97, EASING.springSnappy);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, EASING.springSnappy);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isGoogle = provider === 'google';
  const bgColor = isGoogle ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#000000');
  const textColor = isGoogle ? '#1F1F1F' : (isDark ? '#000000' : '#FFFFFF');

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
      style={[
        styles.socialButton,
        { backgroundColor: bgColor, opacity: disabled ? 0.5 : 1 },
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          <Ionicons
            name={isGoogle ? 'logo-google' : 'logo-apple'}
            size={20}
            color={textColor}
          />
          <Text style={[styles.socialButtonText, { color: textColor }]}>
            {isGoogle ? 'Google' : 'Apple'}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

// Biometric Quick Login Button
function BiometricButton({
  type,
  onPress,
}: {
  type: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withSequence(
      withTiming(1, { duration: 1500 }),
      withTiming(0.5, { duration: 1500 })
    );
  }, []);

  const handlePress = () => {
    haptics.medium();
    scale.value = withSequence(
      withSpring(0.92, EASING.springSnappy),
      withSpring(1, EASING.springSnappy)
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.6], Extrapolation.CLAMP),
  }));

  const isFaceID = type === 'Face ID';

  return (
    <AnimatedTouchable
      onPress={handlePress}
      activeOpacity={1}
      style={[styles.biometricContainer, animatedStyle]}
    >
      <Animated.View style={[styles.biometricGlow, { backgroundColor: colors.gold }, glowStyle]} />
      <LinearGradient
        colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
        style={styles.biometricButton}
      >
        <Ionicons
          name={isFaceID ? 'scan-outline' : 'finger-print-outline'}
          size={32}
          color={colors.black}
        />
      </LinearGradient>
      <Text style={[styles.biometricLabel, { color: colors.textSecondary }]}>
        {type}
      </Text>
    </AnimatedTouchable>
  );
}

export default function AuthScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [demoLoading, setDemoLoading] = useState(false);
  const demoTapCount = useRef(0);
  const demoTapTimeout = useRef<NodeJS.Timeout | null>(null);
  const { login, emailLogin, demoLogin, isAuthenticated, checkAuth } = useAuthStore();

  // Animations
  const logoScale = useSharedValue(0.8);
  const logoOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 800 });
    logoScale.value = withSpring(1, EASING.springGentle);
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  // Check biometric availability
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);

    const checkBiometric = async () => {
      const available = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();

      if (available && enabled) {
        await checkAuth();
        const hasStoredSession = useAuthStore.getState().token !== null;
        setBiometricAvailable(hasStoredSession);
      } else {
        setBiometricAvailable(false);
      }

      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
      }
    };
    checkBiometric();
  }, []);

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated]);

  const handleBiometricLogin = async () => {
    const result = await authenticateWithBiometrics(`Use ${biometricType} to sign in`);
    if (result.success) {
      haptics.success();
      await checkAuth();
      if (useAuthStore.getState().isAuthenticated) {
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Session Expired', 'Please sign in again.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      const userData = (userInfo as any).data?.user || (userInfo as any).user;
      const success = await login('google', tokens.accessToken, {
        email: userData?.email || '',
        name: userData?.name || '',
        profileImageUrl: userData?.photo || '',
      });

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Login Failed', 'Could not authenticate. Please try again.');
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (err.code === statusCodes.IN_PROGRESS) {
        haptics.warning();
        Alert.alert('Please wait', 'Sign in is already in progress');
      } else {
        haptics.error();
        Alert.alert('Error', err.message || 'Failed to sign in with Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : null;

      const success = await login('apple', credential.identityToken || '', {
        id: credential.user,
        email: credential.email || undefined,
        name: fullName || undefined,
      });

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Login Failed', 'Could not authenticate. Please try again.');
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        haptics.error();
        Alert.alert('Error', 'An error occurred during Apple sign in');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password || (view === 'signup' && !name)) {
      setError('Please fill in all fields');
      haptics.warning();
      return;
    }
    setError('');
    setIsLoading(true);

    const isSignup = view === 'signup';
    const result = await emailLogin(email, password, isSignup ? name : undefined, isSignup);

    setIsLoading(false);

    if (result.success) {
      haptics.success();
      router.replace('/(tabs)/dashboard');
    } else {
      haptics.error();
      setError(result.error || 'Authentication failed. Please try again.');
    }
  };

  // Hidden demo login trigger - 5 taps on logo
  const handleLogoTap = async () => {
    demoTapCount.current += 1;

    // Clear existing timeout
    if (demoTapTimeout.current) {
      clearTimeout(demoTapTimeout.current);
    }

    // Reset tap count after 2 seconds of no taps
    demoTapTimeout.current = setTimeout(() => {
      demoTapCount.current = 0;
    }, 2000);

    // Trigger demo login on 5th tap
    if (demoTapCount.current >= 5) {
      demoTapCount.current = 0;
      if (demoTapTimeout.current) {
        clearTimeout(demoTapTimeout.current);
      }

      setDemoLoading(true);
      haptics.medium();

      const success = await demoLogin();

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Demo Login Failed', 'Could not authenticate demo account.');
      }

      setDemoLoading(false);
    }
  };

  // Welcome Screen
  if (view === 'welcome') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Floating particles background */}
        <ParticleField />

        {/* Background gradient */}
        <LinearGradient
          colors={['transparent', colors.goldSurface, 'transparent']}
          locations={[0, 0.5, 1]}
          style={styles.backgroundGradient}
        />

        {/* Content */}
        <View style={[styles.welcomeContent, { paddingTop: insets.top + 60 }]}>
          {/* Logo with premium effects - 5 taps triggers demo login */}
          <TouchableOpacity onPress={handleLogoTap} activeOpacity={1} disabled={demoLoading}>
            <Animated.View style={[styles.logoWrapper, logoAnimatedStyle]}>
              {/* Light rays behind everything */}
              <LightRays color={colors.gold} />

              {/* Animated glow orb */}
              <AnimatedGlowOrb color={colors.gold} />

              {/* Self-drawing ring */}
              <SelfDrawingRing size={160} color={colors.gold} />

              {/* Pulsing rings emanating from logo */}
              <PulsingRings />

              {/* Logo container */}
              <View style={[styles.logoOuter, { borderColor: colors.gold + '30' }]}>
                <LinearGradient
                  colors={[colors.surface, colors.surfaceElevated] as any}
                  style={styles.logoInner}
                >
                  {demoLoading ? (
                    <ActivityIndicator size="large" color={colors.gold} />
                  ) : (
                    <Image
                      source={require('../assets/logo.png')}
                      style={styles.logoImage}
                      resizeMode="cover"
                    />
                  )}
                </LinearGradient>
                {/* Shimmer overlay on logo */}
                <ShimmerOverlay width={115} height={115} />
              </View>
              <PulsingLogoGlow color={colors.gold} />
            </Animated.View>
          </TouchableOpacity>

          {/* Animated Brand Title */}
          <Animated.View entering={FadeInDown.delay(300).duration(600)}>
            <AnimatedGradientTitle>Represent</AnimatedGradientTitle>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(400).duration(600)}
            style={[styles.tagline, { color: colors.textSecondary }]}
          >
            Democracy in your pocket.
          </Animated.Text>


          {/* Biometric login (if available) */}
          {biometricAvailable && (
            <Animated.View
              entering={FadeInUp.delay(800).duration(500)}
              style={styles.biometricSection}
            >
              <BiometricButton type={biometricType} onPress={handleBiometricLogin} />
            </Animated.View>
          )}

          {/* Premium CTA buttons */}
          <Animated.View
            entering={FadeInUp.delay(900).duration(500)}
            style={styles.welcomeButtons}
          >
            <PremiumCTAButton
              title="Get Started"
              onPress={() => setView('signup')}
            />
            <Button
              title="I have an account"
              onPress={() => setView('login')}
              variant="ghost"
              size="lg"
              fullWidth
            />
          </Animated.View>
        </View>

        {/* Bottom accent */}
        <LinearGradient
          colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.bottomAccent, { bottom: insets.bottom }]}
        />
      </View>
    );
  }

  // Login/Signup Screen
  const isLogin = view === 'login';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.authContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Animated.View entering={FadeIn.duration(300)}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              haptics.light();
              setView('welcome');
              setError('');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
        </Animated.View>

        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.authHeader}
        >
          <View style={[styles.authLogo, { backgroundColor: colors.goldSurface }]}>
            <Image
              source={require('../assets/logo.png')}
              style={styles.authLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.authTitle, { color: colors.text }]}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            {isLogin
              ? 'Sign in to continue to Represent'
              : 'Join the future of civic engagement'}
          </Text>
        </Animated.View>

        {/* Social login buttons */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.socialButtons}
        >
          <SocialButton
            provider="google"
            onPress={handleGoogleLogin}
            disabled={googleLoading || appleLoading}
            loading={googleLoading}
          />
          {Platform.OS === 'ios' && appleAvailable && (
            <SocialButton
              provider="apple"
              onPress={handleAppleLogin}
              disabled={googleLoading || appleLoading}
              loading={appleLoading}
            />
          )}
        </Animated.View>

        {/* Divider */}
        <Animated.View
          entering={FadeIn.delay(300).duration(400)}
          style={styles.divider}
        >
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {!isLogin && (
            <Input
              label="Full Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon="person-outline"
            />
          )}

          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
          />

          <Input
            label="Password"
            placeholder={isLogin ? 'Enter password' : 'Create a password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
          />

          <Button
            title={isLogin ? 'Sign In' : 'Create Account'}
            onPress={handleEmailAuth}
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            style={{ marginTop: SPACING.sm }}
          />
        </Animated.View>

        {/* Switch auth */}
        <Animated.View
          entering={FadeIn.delay(450).duration(400)}
          style={styles.switchAuth}
        >
          <Text style={[styles.switchAuthText, { color: colors.textSecondary }]}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setView(isLogin ? 'signup' : 'login');
              setError('');
            }}
          >
            <Text style={[styles.switchAuthLink, { color: colors.gold }]}>
              {isLogin ? 'Sign up' : 'Sign in'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Terms */}
        <Animated.Text
          entering={FadeIn.delay(500).duration(400)}
          style={[styles.terms, { color: colors.textTertiary }]}
        >
          By continuing, you agree to our Terms of Service and Privacy Policy
        </Animated.Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    borderRadius: RADIUS['2xl'],
    overflow: 'hidden',
  },
  loadingLogoGradient: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogoImage: {
    width: 56,
    height: 56,
  },
  loadingDots: {},
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  welcomeContent: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  logoWrapper: {
    marginBottom: SPACING['3xl'],
    position: 'relative',
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  logoInner: {
    width: '100%',
    height: '100%',
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 115,
    height: 115,
    borderRadius: 58,
  },
  logoGlow: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderRadius: 60,
    opacity: 0.15,
    zIndex: -1,
  },
  brandName: {
    fontSize: responsive(32, 36, 48),
    fontWeight: '700',
    letterSpacing: -1.5,
    marginBottom: SPACING.md,
  },
  tagline: {
    ...TYPOGRAPHY.bodyLarge,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: SPACING['3xl'],
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: responsive(SPACING.sm, SPACING.md, SPACING.md),
    marginBottom: SPACING['3xl'],
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsive(SPACING.xs, SPACING.sm, SPACING.sm),
    paddingHorizontal: responsive(SPACING.sm, SPACING.md, SPACING.lg),
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  // Feature Cards
  featureCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING['3xl'],
    paddingHorizontal: SPACING.sm,
  },
  featureCard: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xl,
    width: responsive(95, 105, 115),
    position: 'relative',
    overflow: 'hidden',
  },
  featureCardBorderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
  },
  featureCardIconContainer: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  featureCardIconGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 30,
  },
  featureCardIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCardLabel: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  featureCardTagline: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
  },
  featurePillText: {
    ...TYPOGRAPHY.labelSmall,
  },
  biometricSection: {
    marginBottom: SPACING['2xl'],
    alignItems: 'center',
  },
  biometricContainer: {
    alignItems: 'center',
  },
  biometricGlow: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    top: 4,
    left: 4,
  },
  biometricButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  biometricLabel: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.sm,
  },
  welcomeButtons: {
    width: '100%',
    gap: SPACING.md,
    marginTop: 'auto',
    marginBottom: SPACING['2xl'],
  },
  bottomAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.6,
  },
  // Auth screen
  authContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING['3xl'],
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: SPACING['2xl'],
  },
  authLogo: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  authLogoImage: {
    width: 44,
    height: 44,
  },
  authTitle: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xs,
  },
  authSubtitle: {
    ...TYPOGRAPHY.body,
    textAlign: 'center',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 52,
    borderRadius: RADIUS.md,
  },
  socialButtonText: {
    ...TYPOGRAPHY.label,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...TYPOGRAPHY.caption,
    marginHorizontal: SPACING.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
  },
  switchAuth: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.xl,
  },
  switchAuthText: {
    ...TYPOGRAPHY.body,
  },
  switchAuthLink: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
  },
  terms: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  // Premium CTA Button styles
  premiumCTAContainer: {
    width: '100%',
    position: 'relative',
  },
  premiumCTAGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: RADIUS.lg + 8,
  },
  premiumCTAButton: {
    width: '100%',
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  premiumCTAText: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
  },
  premiumCTAShimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: RADIUS.lg,
  },
  premiumCTAShimmer: {
    position: 'absolute',
    width: 100,
    height: '200%',
    top: '-50%',
  },
  // Light rays styles
  lightRaysContainer: {
    position: 'absolute',
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightRay: {
    position: 'absolute',
    width: 2,
    height: 150,
    borderRadius: 1,
    transformOrigin: 'center bottom',
  },
});
