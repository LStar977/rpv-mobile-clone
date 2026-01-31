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
import Animated, { FadeInUp, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../lib/theme';
import { haptics } from '../lib/haptics';

const { width } = Dimensions.get('window');

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
        kicker: 'Trust layer',
        title: 'Verify once',
        subtitle: 'Carry your civic passport everywhere.',
        description:
          'Receive a verified ID that proves you are real — without revealing more than necessary.',
        bullets: ['Fast verification', 'Privacy-first proof', 'One person, one voice'],
        icon: 'shield-checkmark',
      },
      {
        id: '2',
        kicker: 'Consent layer',
        title: 'Vote with clarity',
        subtitle: 'Know who is eligible and why.',
        description:
          'Every proposal is geo-gated to the right community so outcomes represent real residents.',
        bullets: ['Geo-gated voting', 'Transparent totals', 'Verified residents only'],
        icon: 'checkmark-done',
      },
      {
        id: '3',
        kicker: 'Creation layer',
        title: 'Shape proposals',
        subtitle: 'Draft, share, and measure consensus.',
        description:
          'Create proposals in minutes and share them with the right jurisdiction or organization.',
        bullets: ['Guided creation', 'Targeted distribution', 'Track outcomes'],
        icon: 'sparkles',
      },
      {
        id: '4',
        kicker: 'Intelligence layer',
        title: 'Sentinel assists',
        subtitle: 'Spot risks before they spread.',
        description:
          'Paste any policy and get a plain-language analysis with suggested fixes.',
        bullets: ['Instant analysis', 'Principle scoring', 'Actionable improvements'],
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

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      haptics.success();
      router.replace('/');
    } catch (e) {
      router.replace('/');
    }
  };

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>Represent</Text>
            <Text style={[styles.brandSubtitle, { color: colors.textMuted }]}>Onboarding</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <Animated.View style={[styles.slide, { width }]} entering={FadeInUp.duration(400)}>
            <View style={[styles.slideCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: colors.goldLight }]}
              >
                <Ionicons name={item.icon} size={32} color={colors.gold} />
              </View>
              <Text style={[styles.kicker, { color: colors.textMuted }]}>{item.kicker}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
              <View style={styles.bulletList}>
                {item.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.gold }]} />
                    <Text style={[styles.bulletText, { color: colors.textSecondary }]}>{bullet}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {slides.map((slide, dotIndex) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                {
                  backgroundColor: dotIndex === index ? colors.gold : colors.border,
                  width: dotIndex === index ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity
          onPress={handleNext}
          style={[styles.nextButton, { backgroundColor: colors.gold }]}
        >
          <Text style={[styles.nextText, { color: colors.background }]}
          >
            {index === slides.length - 1 ? 'Enter Represent' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: SPACING.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  logo: {
    width: 32,
    height: 32,
  },
  brandTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  brandSubtitle: {
    ...TYPOGRAPHY.bodySmall,
  },
  skipButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  skipText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  slide: {
    paddingHorizontal: SPACING.xl,
  },
  slideCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.xl,
    gap: SPACING.sm,
    ...SHADOWS.soft,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  kicker: {
    ...TYPOGRAPHY.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    ...TYPOGRAPHY.displaySmall,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyLarge,
  },
  description: {
    ...TYPOGRAPHY.bodyMedium,
  },
  bulletList: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bulletText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  nextText: {
    ...TYPOGRAPHY.labelLarge,
  },
});
