import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  ViewToken,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../lib/theme';
import { haptics } from '../lib/haptics';

const { width, height } = Dimensions.get('window');
const ONBOARDING_KEY = '@represent_onboarding_complete';

// Onboarding slide data - ALL using gold brand color
const slides = [
  {
    id: '1',
    icon: 'shield-checkmark',
    title: 'Verify Your Identity',
    subtitle: 'Soulbound Passport',
    description:
      'Complete identity verification to receive your unique Soulbound Passport NFT. This proves you are a real person and unlocks full voting rights.',
    features: ['One person, one vote', 'Privacy-preserving', 'Blockchain secured'],
  },
  {
    id: '2',
    icon: 'document-text',
    title: 'Vote on Proposals',
    subtitle: 'Your Voice Matters',
    description:
      'Browse and vote on proposals that affect your community. Filter by location, category, and demographics to find issues you care about.',
    features: ['Transparent voting', 'Immutable records', 'Real impact'],
  },
  {
    id: '3',
    icon: 'create',
    title: 'Create Proposals',
    subtitle: 'Lead the Change',
    description:
      'Have an idea to improve your community? Create a proposal and let others vote on it. Set geographic and demographic restrictions for targeted feedback.',
    features: ['Easy creation', 'Geo-targeting', 'Community reach'],
  },
  {
    id: '4',
    icon: 'sparkles',
    title: 'Sentinel AI',
    subtitle: 'Governance Analyzer',
    description:
      'Analyze government documents against 155 principles of proper governance. Get AI-powered insights on alignment, violations, and recommended corrections.',
    features: ['155 principles', 'Instant analysis', 'Auto-proposals'],
  },
];

// Animated slide component
function OnboardingSlide({
  item,
  index,
  scrollX,
}: {
  item: typeof slides[0];
  index: number;
  scrollX: Animated.SharedValue<number>;
}) {
  const { colors } = useTheme();

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = interpolate(scrollX.value, inputRange, [0.8, 1, 0.8], Extrapolation.CLAMP);
    const opacity = interpolate(scrollX.value, inputRange, [0.5, 1, 0.5], Extrapolation.CLAMP);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <View style={styles.slide}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        {/* Icon - using gold brand color */}
        <View style={[styles.iconContainer, { shadowColor: colors.gold }]}>
          <LinearGradient
            colors={[`${colors.gold}30`, `${colors.gold}10`]}
            style={styles.iconGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[styles.iconInner, { backgroundColor: colors.goldLight }]}>
            <Ionicons name={item.icon as any} size={48} color={colors.gold} />
          </View>
        </View>

        {/* Text Content */}
        <Text style={[styles.subtitle, { color: colors.gold }]}>{item.subtitle}</Text>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {item.description}
        </Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          {item.features.map((feature, i) => (
            <View
              key={i}
              style={[styles.featureItem, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
              <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

// Pagination dot
function PaginationDot({
  index,
  currentIndex,
}: {
  index: number;
  currentIndex: number;
}) {
  const { colors } = useTheme();
  const isActive = index === currentIndex;

  const animatedStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 24 : 8, { damping: 15, stiffness: 200 }),
    opacity: withTiming(isActive ? 1 : 0.4, { duration: 200 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: colors.gold },
        animatedStyle,
      ]}
    />
  );
}

export default function OnboardingScreen() {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);

  const isLastSlide = currentIndex === slides.length - 1;

  const handleNext = () => {
    haptics.medium();
    if (isLastSlide) {
      completeOnboarding();
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleSkip = () => {
    haptics.light();
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      haptics.success();
      // Navigate to the main app - replace clears the history
      router.replace('/');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      router.replace('/');
    }
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
        haptics.selection();
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background gradient */}
      <LinearGradient
        colors={isDark
          ? ['rgba(212, 175, 55, 0.05)', 'transparent', 'rgba(212, 175, 55, 0.03)']
          : ['rgba(212, 175, 55, 0.08)', 'transparent', 'rgba(212, 175, 55, 0.05)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Skip button */}
      <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.skipContainer}>
        <TouchableOpacity
          style={[styles.skipButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Logo - using actual logo image */}
      <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.logoContainer}>
        <View style={[styles.logoBox, { backgroundColor: colors.goldLight, ...SHADOWS.glow }]}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.logoTitle, { color: colors.gold }]}>Represent</Text>
      </Animated.View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={({ item, index }) => (
          <OnboardingSlide item={item} index={index} scrollX={scrollX} />
        )}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={(event) => {
          scrollX.value = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
      />

      {/* Bottom section */}
      <Animated.View
        entering={FadeInUp.delay(600).duration(400)}
        style={styles.bottomSection}
      >
        {/* Pagination */}
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <PaginationDot key={index} index={index} currentIndex={currentIndex} />
          ))}
        </View>

        {/* Next/Get Started button */}
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: colors.gold, ...SHADOWS.glow }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {isLastSlide ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons
            name={isLastSlide ? 'checkmark-circle' : 'arrow-forward'}
            size={20}
            color="#000"
          />
        </TouchableOpacity>

        {/* Progress text */}
        <Text style={[styles.progressText, { color: colors.textMuted }]}>
          {currentIndex + 1} of {slides.length}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: 60,
    right: SPACING.lg,
    zIndex: 10,
  },
  skipButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  skipText: {
    ...TYPOGRAPHY.labelMedium,
  },
  logoContainer: {
    alignItems: 'center',
    paddingTop: 100,
    marginBottom: SPACING.lg,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  logoTitle: {
    ...TYPOGRAPHY.headlineMedium,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
  },
  slideContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
  },
  iconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.overline,
    marginBottom: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.displaySmall,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  description: {
    ...TYPOGRAPHY.bodyLarge,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xl,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  featureText: {
    ...TYPOGRAPHY.labelSmall,
  },
  bottomSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: 50,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  nextButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },
  progressText: {
    ...TYPOGRAPHY.bodySmall,
  },
});

// Export the key for checking onboarding status
export { ONBOARDING_KEY };
