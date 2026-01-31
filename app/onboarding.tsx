import React, { useMemo, useRef, useState } from 'react';
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
import Animated, {
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

const { width } = Dimensions.get('window');

// ✅ IMPORTANT: export this so app/index.tsx can import it
export const ONBOARDING_KEY = '@represent_onboarding_complete';

type Slide = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  icon: keyof typeof Ionicons.glyphMap;
};

export default function Onboarding() {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const progress = useSharedValue(0);

  const slides: Slide[] = useMemo(
    () => [
      {
        id: '1',
        kicker: 'Trust Layer',
        title: 'Verify once.',
        subtitle: 'Own your voice everywhere.',
        description:
          'Complete identity verification and receive a Soulbound Passport that proves you’re a real person — without revealing more than necessary.',
        bullets: ['Fast verification', 'One person, one voice', 'Privacy-first'],
        icon: 'shield-checkmark',
      },
      {
        id: '2',
        kicker: 'Consent Layer',
        title: 'Vote on',
        subtitle: 'real proposals.',
        description:
          'See what verified residents actually think — by country, region, city, or community. Every vote is geo-gated to the right people.',
        bullets: ['Geo-gated voting', 'Clear outcomes', 'Verified residents only'],
        icon: 'checkmark-done',
      },
      {
        id: '3',
        kicker: 'Creation Layer',
        title: 'Create',
        subtitle: 'better decisions.',
        description:
          'Draft proposals in minutes. Share them to the right jurisdiction or organization and collect verified consent — not noise.',
        bullets: ['Simple creation', 'Targeted distribution', 'Track results'],
        icon: 'sparkles',
      },
      {
        id: '4',
        kicker: 'Intelligence Layer',
        title: 'Sentinel',
        subtitle: 'reads what others miss.',
        description:
          'Paste a policy or proposal. Sentinel scores it against core governance principles and helps you generate fixes or a stronger proposal.',
        bullets: ['Instant analysis', 'Principle scoring', 'Generate improvements'],
        icon: 'eye',
      },
    ],
    []
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const current = viewableItems?.[0]?.index ?? 0;
      setIndex(current);
      progress.value = withTiming(current, { duration: 240 });
    }
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 70 }).current;

  const handleSkip = async () => {
    haptics.light();
    await completeOnboarding();
  };

  const handleNext = () => {
    haptics.light();
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      haptics.success();
      router.replace('/');
    } catch (e) {
      // If storage fails, still move forward so user isn't stuck.
      router.replace('/');
    }
  };

  const headerGlowStyle = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [0, slides.length - 1], [0.25, 0.45], Extrapolation.CLAMP);
    return { opacity: withSpring(t) };
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Background */}
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary, colors.background]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.goldGlow, { backgroundColor: colors.goldLight }, headerGlowStyle]} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.brand, { color: colors.text }]}>Represent</Text>
        </View>

        <TouchableOpacity onPress={handleSkip} activeOpacity={0.85} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
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
        contentContainerStyle={{ paddingBottom: 160 }}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Animated.View entering={FadeInUp.duration(420)} style={styles.heroWrap}>
              <View
                style={[
                  styles.iconPill,
                  { borderColor: colors.borderLight, backgroundColor: colors.cardBgElevated },
                  SHADOWS.medium,
                ]}
              >
                <Ionicons name={item.icon} size={18} color={colors.gold} />
                <Text style={[styles.kicker, { color: colors.textSecondary }]}>{item.kicker}</Text>
              </View>

              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.subtitle, { color: colors.text }]}>{item.subtitle}</Text>

              <Text style={[styles.desc, { color: colors.textSecondary }]}>{item.description}</Text>

              <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, SHADOWS.soft]}>
                {item.bullets.map((b) => (
                  <View key={b} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.goldMedium }]} />
                    <Text style={[styles.bulletText, { color: colors.text }]}>{b}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => {
            const dotStyle = useAnimatedStyle(() => {
              const w = interpolate(progress.value, [i - 1, i, i + 1], [8, 18, 8], Extrapolation.CLAMP);
              const o = interpolate(progress.value, [i - 1, i, i + 1], [0.35, 1, 0.35], Extrapolation.CLAMP);
              return { width: withSpring(w), opacity: withSpring(o) };
            });

            return (
              <Animated.View key={i} style={[styles.dot, { backgroundColor: colors.gold }, dotStyle]} />
            );
          })}
        </View>

        <Animated.View entering={FadeInDown.duration(380)} style={styles.ctaRow}>
          <View style={styles.ctaMeta}>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>
              {index + 1} / {slides.length}
            </Text>
            <Text style={[styles.stepHint, { color: colors.text }]}>
              {index === slides.length - 1 ? 'Ready to begin' : 'Continue'}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleNext}
            style={[styles.primaryButton, { backgroundColor: colors.gold }]}
          >
            <Text style={[styles.primaryText, { color: colors.black }]}>
              {index === slides.length - 1 ? 'Get Started' : 'Next'}
            </Text>
            <Ionicons
              name={index === slides.length - 1 ? 'arrow-forward' : 'chevron-forward'}
              size={18}
              color={colors.black}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  goldGlow: {
    position: 'absolute',
    top: -120,
    left: -120,
    width: 280,
    height: 280,
    borderRadius: 999,
  },

  topBar: {
    paddingTop: 14,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 26, height: 26 },
  brand: { ...TYPOGRAPHY.titleMedium },

  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  skipText: { ...TYPOGRAPHY.labelLarge },

  slide: { paddingHorizontal: SPACING.lg, paddingTop: 26 },
  heroWrap: { flex: 1 },

  iconPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 18,
  },
  kicker: { ...TYPOGRAPHY.labelMedium },

  title: { ...TYPOGRAPHY.displaySmall, marginTop: 6 },
  subtitle: { ...TYPOGRAPHY.displaySmall, marginTop: 2 },
  desc: { ...TYPOGRAPHY.bodyLarge, marginTop: 14, maxWidth: 520 },

  card: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  bulletDot: { width: 8, height: 8, borderRadius: 999 },
  bulletText: { ...TYPOGRAPHY.bodyMedium, flex: 1 },

  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 18,
    paddingTop: 12,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },

  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  ctaMeta: { flex: 1 },
  stepText: { ...TYPOGRAPHY.labelMedium },
  stepHint: { ...TYPOGRAPHY.titleSmall, marginTop: 2 },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  primaryText: { ...TYPOGRAPHY.labelLarge },
});
