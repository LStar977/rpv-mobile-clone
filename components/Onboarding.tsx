import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ViewToken,
  Image,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { FONTS } from '../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_KEY = '@represent_onboarding_complete';

// Premium design tokens
const GOLD = '#EABA58';
const GOLD_DARK = '#C89A3E';
const GOLD_LIGHT = '#F4D28C';
const BG = '#040707';
const BG_ELEVATED = '#0D0F12';
const FG = '#F4F5F6';
const FG_MUTED = '#A0A4A8';
const FG_FAINT = '#6B6F73';
const SERIF_FONT = FONTS.serif;

interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  icon: 'voice' | 'swipe' | 'verify';
}

const SLIDES: Slide[] = [
  {
    id: '1',
    eyebrow: 'CIVIC DEMOCRACY',
    title: 'Your voice,',
    titleAccent: 'verified.',
    subtitle: 'One person, one vote. Real proposals from your community. Your opinion shapes policy.',
    icon: 'voice',
  },
  {
    id: '2',
    eyebrow: 'INSTANT VOTING',
    title: 'Swipe to',
    titleAccent: 'decide.',
    subtitle: 'Support or oppose in seconds. Track outcomes. Watch your civic impact grow.',
    icon: 'swipe',
  },
  {
    id: '3',
    eyebrow: 'VERIFIED IDENTITY',
    title: 'Unlock',
    titleAccent: 'voting.',
    subtitle: 'Verify once to vote everywhere. Your data stays private. Your voice gets heard.',
    icon: 'verify',
  },
];

// Floating particle for premium ambient effect
function Particle({ delay }: { delay: number }) {
  const translateY = useSharedValue(SCREEN_HEIGHT + 50);
  const opacity = useSharedValue(0);
  const startX = useMemo(() => Math.random() * SCREEN_WIDTH, []);
  const size = useMemo(() => 2 + Math.random() * 3, []);
  const duration = useMemo(() => 6000 + Math.random() * 4000, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      translateY.value = withRepeat(
        withTiming(-50, { duration, easing: Easing.linear }),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4 + Math.random() * 0.3, { duration: duration * 0.15 }),
          withTiming(0.4 + Math.random() * 0.3, { duration: duration * 0.7 }),
          withTiming(0, { duration: duration * 0.15 })
        ),
        -1,
        false
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
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
          backgroundColor: GOLD,
        },
        animatedStyle,
      ]}
    />
  );
}

function ParticleField() {
  const particles = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ id: i, delay: i * 400 })),
    []
  );
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {particles.map((p) => (
        <Particle key={p.id} delay={p.delay} />
      ))}
    </View>
  );
}

function VoiceIcon() {
  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={GOLD} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={70} cy={70} r={65} fill="url(#glow)" />
      <Circle cx={70} cy={70} r={55} stroke={GOLD} strokeWidth={1} fill="none" opacity={0.2} />
      <Circle cx={70} cy={70} r={40} stroke={GOLD} strokeWidth={0.5} fill="none" opacity={0.4} />
      <G opacity={1}>
        <Path d="M70 30 L70 110" stroke={GOLD} strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M50 45 L50 95" stroke={GOLD} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        <Path d="M90 45 L90 95" stroke={GOLD} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
        <Path d="M30 60 L30 80" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
        <Path d="M110 60 L110 80" stroke={GOLD} strokeWidth={1.5} strokeLinecap="round" opacity={0.6} />
      </G>
    </Svg>
  );
}

function SwipeIcon() {
  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id="glowSwipe" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={GOLD} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={70} cy={70} r={65} fill="url(#glowSwipe)" />
      {/* Stacked cards */}
      <G transform="translate(70, 70) rotate(-12) translate(-70, -70)">
        <Path
          d="M35 30 H105 Q110 30 110 35 V105 Q110 110 105 110 H35 Q30 110 30 105 V35 Q30 30 35 30"
          stroke={GOLD}
          strokeWidth={1}
          fill="none"
          opacity={0.3}
        />
      </G>
      <G transform="translate(70, 70) rotate(0) translate(-70, -70)">
        <Path
          d="M35 30 H105 Q110 30 110 35 V105 Q110 110 105 110 H35 Q30 110 30 105 V35 Q30 30 35 30"
          stroke={GOLD}
          strokeWidth={1.5}
          fill={`${BG_ELEVATED}`}
          opacity={0.9}
        />
      </G>
      {/* Left arrow */}
      <Path
        d="M70 70 L45 70 M58 57 L45 70 L58 83"
        stroke={GOLD}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
      {/* Right arrow */}
      <Path
        d="M70 70 L95 70 M82 57 L95 70 L82 83"
        stroke={GOLD}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function VerifyIcon() {
  return (
    <Svg width={140} height={140} viewBox="0 0 140 140">
      <Defs>
        <RadialGradient id="glowVerify" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={GOLD} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={GOLD} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={70} cy={70} r={65} fill="url(#glowVerify)" />
      {/* Shield */}
      <Path
        d="M70 15 L115 35 L115 65 Q115 100 70 125 Q25 100 25 65 L25 35 Z"
        stroke={GOLD}
        strokeWidth={1}
        fill="none"
        opacity={0.3}
      />
      <Path
        d="M70 28 L100 43 L100 65 Q100 90 70 110 Q40 90 40 65 L40 43 Z"
        stroke={GOLD}
        strokeWidth={1.5}
        fill={`${GOLD}10`}
      />
      {/* Checkmark */}
      <Path
        d="M50 68 L63 81 L90 54"
        stroke={GOLD}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SlideIcon({ type }: { type: Slide['icon'] }) {
  switch (type) {
    case 'voice':
      return <VoiceIcon />;
    case 'swipe':
      return <SwipeIcon />;
    case 'verify':
      return <VerifyIcon />;
  }
}

function Dot({ active }: { active: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(active ? 28 : 8, { duration: 250 }),
    opacity: withTiming(active ? 1 : 0.35, { duration: 250 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: GOLD },
        animatedStyle,
      ]}
    />
  );
}

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastSlide) {
      handleComplete();
    } else {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'completed');
    } catch (e) {
      console.error('Error saving onboarding state:', e);
    }
    onComplete();
  };

  const handleVerifyNow = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await handleComplete();
    router.push('/(tabs)/profile');
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <Animated.View entering={FadeInUp.duration(500).delay(50)} style={styles.eyebrowContainer}>
        <Text style={styles.eyebrow}>{item.eyebrow}</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(100)} style={styles.iconContainer}>
        <SlideIcon type={item.icon} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(200)}>
        <Text style={styles.title}>
          {item.title}
          {'\n'}
          <Text style={styles.titleAccent}>{item.titleAccent}</Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(300)}>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </Animated.View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Background gradients */}
      <LinearGradient
        colors={[`${GOLD}12`, 'transparent', 'transparent', `${GOLD}08`]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Ambient particles */}
      <ParticleField />

      {/* Logo at top */}
      <Animated.View entering={FadeIn.duration(600)} style={[styles.logoContainer, { marginTop: insets.top + 20 }]}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.logoText}>Represent</Text>
      </Animated.View>

      {/* Skip button */}
      {!isLastSlide && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.skipContainer}>
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
        style={styles.flatList}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <Dot key={index} active={index === currentIndex} />
        ))}
      </View>

      {/* Bottom buttons */}
      <View style={styles.bottomContainer}>
        {isLastSlide ? (
          <>
            <TouchableOpacity
              onPress={handleVerifyNow}
              activeOpacity={0.9}
              style={styles.primaryButton}
            >
              <LinearGradient
                colors={[GOLD, GOLD_DARK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>Verify My Identity</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleComplete}
              activeOpacity={0.7}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Explore first</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.9}
            style={styles.primaryButton}
          >
            <LinearGradient
              colors={[GOLD, GOLD_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer tagline */}
      <Animated.View entering={FadeIn.duration(800).delay(400)} style={styles.footer}>
        <Text style={styles.footerText}>Verified civic infrastructure.</Text>
      </Animated.View>
    </View>
  );
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const status = await AsyncStorage.getItem(ONBOARDING_KEY);
    return status === 'completed';
  } catch (e) {
    console.error('Error checking onboarding status:', e);
    return false;
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (e) {
    console.error('Error resetting onboarding:', e);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  logoContainer: {
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  logoText: {
    fontFamily: FONTS.serifMediumItalic,
    fontSize: 18,
    
    color: GOLD,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  skipContainer: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: `${FG}10`,
  },
  skipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 15,
    color: FG_MUTED,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  eyebrowContainer: {
    marginBottom: 24,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    color: GOLD,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  iconContainer: {
    marginBottom: 40,
  },
  title: {
    fontFamily: FONTS.sans,
    fontSize: 38,
    color: FG,
    textAlign: 'center',
    lineHeight: 48,
  },
  titleAccent: {
    fontFamily: FONTS.serifMediumItalic,
    fontSize: 42,
    
    color: GOLD,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 17,
    color: FG_MUTED,
    textAlign: 'center',
    lineHeight: 26,
    marginTop: 24,
    paddingHorizontal: 8,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 14,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: BG,
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 16,
    color: FG_FAINT,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: FONTS.serifMediumItalic,
    fontSize: 12,
    
    color: FG_FAINT,
    letterSpacing: 0.5,
  },
});
