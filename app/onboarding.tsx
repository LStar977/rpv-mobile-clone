import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ViewToken,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme, SPACING, RADIUS, TYPOGRAPHY } from '../lib/theme';
import { haptics } from '../lib/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ONBOARDING_KEY = '@represent_onboarding_complete';

type Slide = {
  id: string;
  layer: string;
  headline: string;
  subheadline: string;
  description: string;
  features: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const slides: Slide[] = useMemo(
    () => [
      {
        id: '1',
        layer: 'Trust',
        headline: 'Verify once',
        subheadline: 'Own your voice forever',
        description:
          'Complete identity verification once and receive a privacy-preserving digital passport that proves you are a real, unique person.',
        features: [
          { icon: 'shield-checkmark', text: 'Secure verification' },
          { icon: 'finger-print', text: 'One person, one vote' },
          { icon: 'eye-off', text: 'Privacy-first design' },
        ],
        icon: 'shield-checkmark',
        accentColor: '#34D399',
      },
      {
        id: '2',
        layer: 'Voice',
        headline: 'Vote on',
        subheadline: 'what matters to you',
        description:
          'Participate in decisions that affect your community. Every vote is geo-verified and counted equally - no bots, no manipulation.',
        features: [
          { icon: 'location', text: 'Geo-gated voting' },
          { icon: 'stats-chart', text: 'Real-time results' },
          { icon: 'people', text: 'Community decisions' },
        ],
        icon: 'checkmark-done-circle',
        accentColor: '#60A5FA',
      },
      {
        id: '3',
        layer: 'Create',
        headline: 'Propose',
        subheadline: 'better solutions',
        description:
          'Draft proposals in minutes and share them with the right audience. Collect verified support and drive real change.',
        features: [
          { icon: 'create', text: 'Simple drafting' },
          { icon: 'share-social', text: 'Targeted sharing' },
          { icon: 'trending-up', text: 'Track momentum' },
        ],
        icon: 'sparkles',
        accentColor: '#C9A227',
      },
      {
        id: '4',
        layer: 'Intelligence',
        headline: 'Sentinel AI',
        subheadline: 'sees what you miss',
        description:
          'Paste any policy or proposal. Sentinel analyzes it against core governance principles and helps you understand the implications.',
        features: [
          { icon: 'flash', text: 'Instant analysis' },
          { icon: 'analytics', text: 'Principle scoring' },
          { icon: 'bulb', text: 'Smart suggestions' },
        ],
        icon: 'eye',
        accentColor: '#8B5CF6',
      },
    ],
    []
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const current = viewableItems?.[0]?.index ?? 0;
      setCurrentIndex(current);
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const handleSkip = async () => {
    haptics.light();
    await completeOnboarding();
  };

  const handleNext = () => {
    haptics.medium();
    if (currentIndex < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      haptics.success();
      router.replace('/');
    } catch {
      router.replace('/');
    }
  };

  const safeIndex = Math.min(Math.max(currentIndex, 0), slides.length - 1);
  const isLastSlide = safeIndex === slides.length - 1;
  const currentSlide = slides[safeIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Background gradient */}
      <LinearGradient
        colors={['transparent', currentSlide.accentColor + '08', 'transparent']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.brand, { color: colors.text }]}>Represent</Text>
        </View>
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        contentContainerStyle={{ paddingBottom: 200 }}
        renderItem={({ item, index }) => (
          <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
            {/* Layer badge */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={[
                styles.layerBadge,
                {
                  backgroundColor: item.accentColor + '15',
                  borderColor: item.accentColor + '30',
                },
              ]}
            >
              <Ionicons name={item.icon} size={14} color={item.accentColor} />
              <Text style={[styles.layerText, { color: item.accentColor }]}>
                {item.layer} Layer
              </Text>
            </Animated.View>

            {/* Headlines */}
            <Animated.Text
              entering={FadeInDown.delay(200).duration(400)}
              style={[styles.headline, { color: colors.text }]}
            >
              {item.headline}
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(250).duration(400)}
              style={[styles.subheadline, { color: colors.text }]}
            >
              {item.subheadline}
            </Animated.Text>

            {/* Description */}
            <Animated.Text
              entering={FadeInDown.delay(300).duration(400)}
              style={[styles.description, { color: colors.textSecondary }]}
            >
              {item.description}
            </Animated.Text>

            {/* Features */}
            <Animated.View
              entering={FadeInUp.delay(400).duration(500)}
              style={[
                styles.featuresCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {item.features.map((feature, i) => (
                <View
                  key={i}
                  style={[
                    styles.featureRow,
                    i < item.features.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.featureIcon,
                      { backgroundColor: item.accentColor + '15' },
                    ]}
                  >
                    <Ionicons name={feature.icon} size={16} color={item.accentColor} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.text }]}>
                    {feature.text}
                  </Text>
                </View>
              ))}
            </Animated.View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + SPACING.lg }]}>
        {/* Progress dots */}
        <View style={styles.progressContainer}>
          <View style={styles.dots}>
            {slides.map((slide, i) => {
              const isActive = safeIndex === i;
              return (
                <View
                  key={slide.id}
                  style={[
                    styles.dot,
                    {
                      width: isActive ? 24 : 8,
                      backgroundColor: isActive ? slide.accentColor : colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>
          <Text style={[styles.progressText, { color: colors.textTertiary }]}>
            {safeIndex + 1} of {slides.length}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.actionMeta}>
            <Text style={[styles.actionHint, { color: colors.textSecondary }]}>
              {isLastSlide ? 'Ready to begin?' : 'Swipe or tap to continue'}
            </Text>
          </View>
          <AnimatedTouchable
            onPress={handleNext}
            activeOpacity={0.9}
            style={[styles.nextButton]}
          >
            <LinearGradient
              colors={[
                currentSlide.accentColor,
                currentSlide.accentColor + 'DD',
              ] as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.nextButtonGradient}
            >
              <Text style={[styles.nextButtonText, { color: colors.white }]}>
                {isLastSlide ? 'Get Started' : 'Next'}
              </Text>
              <Ionicons
                name={isLastSlide ? 'arrow-forward' : 'chevron-forward'}
                size={20}
                color={colors.white}
              />
            </LinearGradient>
          </AnimatedTouchable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  logo: {
    width: 28,
    height: 28,
  },
  brand: {
    ...TYPOGRAPHY.h5,
  },
  skipButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  skipText: {
    ...TYPOGRAPHY.label,
  },
  slide: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING['2xl'],
  },
  layerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  layerText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 50,
  },
  subheadline: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 50,
    marginBottom: SPACING.lg,
  },
  description: {
    ...TYPOGRAPHY.bodyLarge,
    lineHeight: 26,
    marginBottom: SPACING['2xl'],
  },
  featuresCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    ...TYPOGRAPHY.body,
    flex: 1,
    fontWeight: '500',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dot: {
    height: 8,
    borderRadius: RADIUS.full,
  },
  progressText: {
    ...TYPOGRAPHY.caption,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  actionMeta: {
    flex: 1,
  },
  actionHint: {
    ...TYPOGRAPHY.body,
  },
  nextButton: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  nextButtonText: {
    ...TYPOGRAPHY.label,
    fontWeight: '600',
  },
});
