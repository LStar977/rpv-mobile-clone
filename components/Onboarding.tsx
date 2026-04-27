import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ViewToken,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path, G, Line } from 'react-native-svg';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_KEY = '@represent_onboarding_complete';

// Design tokens matching the app
const GOLD = '#EABA58';
const GOLD_DARK = '#C89A3E';
const BG = '#040707';
const FG = '#F4F5F6';
const FG_MUTED = '#8E9297';
const GREEN = '#34C759';

interface Slide {
  id: string;
  title: string;
  titleAccent?: string;
  subtitle: string;
  icon: 'voice' | 'swipe' | 'verify';
}

const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Your voice,',
    titleAccent: 'verified.',
    subtitle: 'One person, one vote. Real proposals from your community. Your opinion shapes policy.',
    icon: 'voice',
  },
  {
    id: '2',
    title: 'Swipe to',
    titleAccent: 'decide.',
    subtitle: 'Support or oppose proposals in seconds. Track what passes. See your civic impact grow.',
    icon: 'swipe',
  },
  {
    id: '3',
    title: 'Unlock',
    titleAccent: 'voting.',
    subtitle: 'Verify your identity to cast votes that count. Your data stays private, your voice gets heard.',
    icon: 'verify',
  },
];

function VoiceIcon() {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle cx={60} cy={60} r={50} stroke={GOLD} strokeWidth={1.5} fill="none" opacity={0.3} />
      <Circle cx={60} cy={60} r={35} stroke={GOLD} strokeWidth={1} fill="none" opacity={0.5} />
      <G opacity={0.9}>
        <Path
          d="M60 30 L60 90"
          stroke={GOLD}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M45 45 L45 75"
          stroke={GOLD}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M75 45 L75 75"
          stroke={GOLD}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M30 55 L30 65"
          stroke={GOLD}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M90 55 L90 65"
          stroke={GOLD}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </G>
    </Svg>
  );
}

function SwipeIcon() {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      {/* Card shape */}
      <G transform="rotate(-8, 60, 60)">
        <Path
          d="M30 25 H90 Q95 25 95 30 V90 Q95 95 90 95 H30 Q25 95 25 90 V30 Q25 25 30 25"
          stroke={GOLD}
          strokeWidth={1.5}
          fill="none"
          opacity={0.4}
        />
      </G>
      <G transform="rotate(8, 60, 60)">
        <Path
          d="M30 25 H90 Q95 25 95 30 V90 Q95 95 90 95 H30 Q25 95 25 90 V30 Q25 25 30 25"
          stroke={GOLD}
          strokeWidth={1.5}
          fill="none"
          opacity={0.7}
        />
      </G>
      {/* Arrow */}
      <Path
        d="M50 60 L80 60 M70 50 L80 60 L70 70"
        stroke={GOLD}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function VerifyIcon() {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      {/* Shield outline */}
      <Path
        d="M60 15 L95 30 L95 55 Q95 85 60 105 Q25 85 25 55 L25 30 Z"
        stroke={GOLD}
        strokeWidth={1.5}
        fill="none"
        opacity={0.5}
      />
      {/* Inner shield */}
      <Path
        d="M60 25 L85 37 L85 55 Q85 78 60 93 Q35 78 35 55 L35 37 Z"
        stroke={GOLD}
        strokeWidth={1}
        fill={`${GOLD}15`}
      />
      {/* Checkmark */}
      <Path
        d="M45 58 L55 68 L75 48"
        stroke={GOLD}
        strokeWidth={3}
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
    width: withTiming(active ? 24 : 8, { duration: 200 }),
    opacity: withTiming(active ? 1 : 0.4, { duration: 200 }),
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
    // Navigate to identity tab for verification
    router.push('/(tabs)/identity');
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderSlide = ({ item, index }: { item: Slide; index: number }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <Animated.View
        entering={FadeInUp.duration(600).delay(100)}
        style={styles.iconContainer}
      >
        <SlideIcon type={item.icon} />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(200)}>
        <Text style={styles.title}>
          {item.title}
          {item.titleAccent && (
            <Text style={styles.titleAccent}> {item.titleAccent}</Text>
          )}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(600).delay(300)}>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </Animated.View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={[`${GOLD}15`, 'transparent', 'transparent', `${GOLD}08`]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Skip button */}
      {!isLastSlide && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.skipContainer}>
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
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
        contentContainerStyle={styles.flatListContent}
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
                <Text style={styles.primaryButtonText}>Verify Now</Text>
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
    </View>
  );
}

// Helper to check if onboarding has been completed
export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const status = await AsyncStorage.getItem(ONBOARDING_KEY);
    return status === 'completed';
  } catch (e) {
    console.error('Error checking onboarding status:', e);
    return false;
  }
}

// Helper to reset onboarding (for testing)
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
  skipContainer: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
  },
  skipText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: FG_MUTED,
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    alignItems: 'center',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 48,
  },
  title: {
    fontFamily: 'System',
    fontSize: 36,
    fontWeight: '300',
    color: FG,
    textAlign: 'center',
    lineHeight: 44,
  },
  titleAccent: {
    fontFamily: 'Georgia',
    fontSize: 38,
    fontWeight: '400',
    fontStyle: 'italic',
    color: GOLD,
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '400',
    color: FG_MUTED,
    textAlign: 'center',
    lineHeight: 26,
    marginTop: 20,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: 'System',
    fontSize: 17,
    fontWeight: '600',
    color: BG,
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: FG_MUTED,
  },
});
