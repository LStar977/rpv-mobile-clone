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
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme, FONTS, RADIUS } from '../lib/theme';
import { TrustChip } from './ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ONBOARDING_KEY = '@represent_onboarding_complete';

interface Slide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Trust chips shown under the copy (design-language pills). */
  chips?: { label: string; variant: 'gold' | 'neutral'; icon?: keyof typeof Ionicons.glyphMap }[];
  /** Gold-surface trust note card ("Checked, never kept." on the verify step). */
  note?: { lead: string; body: string };
}

const SLIDES: Slide[] = [
  {
    id: '1',
    eyebrow: 'CIVIC DEMOCRACY',
    title: 'Your voice, on the record.',
    subtitle:
      'One person, one vote. Real proposals from your community — your opinion shapes policy.',
    icon: 'megaphone-outline',
    chips: [
      { label: 'VERIFIED CITIZENS', variant: 'gold', icon: 'checkmark' },
      { label: 'PUBLIC COUNT', variant: 'neutral' },
    ],
  },
  {
    id: '2',
    eyebrow: 'INSTANT VOTING',
    title: 'Swipe to decide.',
    subtitle:
      'Support or oppose in seconds. Track outcomes. Watch your civic impact grow.',
    icon: 'swap-horizontal-outline',
    chips: [
      { label: 'COUNTED, NOT ESTIMATED', variant: 'neutral' },
    ],
  },
  {
    id: '3',
    eyebrow: 'VERIFIED IDENTITY',
    title: 'Unlock voting.',
    subtitle:
      'Verify once to vote everywhere. Your ballot becomes impossible to fake — and impossible to ignore.',
    icon: 'shield-checkmark-outline',
    note: {
      lead: 'Checked, never kept.',
      body: ' Your documents are verified, then discarded. Represent stores only the fact that you are verified — never your ID.',
    },
  },
];

// Page dot per mock 01a/01b — active is a 22×6 gold pill.
function Dot({ active }: { active: boolean }) {
  const { colors } = useTheme();
  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(active ? 22 : 6, { duration: 240 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: active ? colors.goldFill : colors.surfaceHighlight },
        animatedStyle,
      ]}
    />
  );
}

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { colors } = useTheme();
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
      <Animated.View entering={FadeInUp.duration(450).delay(50)}>
        <View style={[styles.slideIconTile, { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.3)' }]}>
          <Ionicons name={item.icon} size={28} color={colors.gold} />
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInUp.duration(450).delay(120)}
        style={[styles.eyebrow, { color: colors.gold }]}
      >
        {item.eyebrow}
      </Animated.Text>

      <Animated.Text
        entering={FadeInUp.duration(450).delay(190)}
        style={[styles.title, { color: colors.text }]}
      >
        {item.title}
      </Animated.Text>

      <Animated.Text
        entering={FadeInUp.duration(450).delay(260)}
        style={[styles.subtitle, { color: colors.textSecondary }]}
      >
        {item.subtitle}
      </Animated.Text>

      {item.chips && (
        <Animated.View entering={FadeInUp.duration(450).delay(330)} style={styles.chipsRow}>
          {item.chips.map((chip) => (
            <TrustChip key={chip.label} label={chip.label} variant={chip.variant} icon={chip.icon} />
          ))}
        </Animated.View>
      )}

      {item.note && (
        <Animated.View
          entering={FadeInUp.duration(450).delay(330)}
          style={[styles.noteCard, { backgroundColor: colors.goldSurface, borderColor: 'rgba(234, 186, 88, 0.18)' }]}
        >
          <Ionicons name="shield-outline" size={18} color={colors.gold} style={styles.noteIcon} />
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>
            <Text style={[styles.noteLead, { color: colors.text }]}>{item.note.lead}</Text>
            {item.note.body}
          </Text>
        </Animated.View>
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 24) + 8 },
      ]}
    >
      {/* Top bar — the Represent mark + Skip */}
      <View style={styles.topBar}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.brandRow}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="cover"
          />
          <Text style={[styles.brandText, { color: colors.gold }]}>REPRESENT</Text>
        </Animated.View>

        {!isLastSlide && (
          <Animated.View entering={FadeIn.duration(400)}>
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.7}
              style={styles.skipButton}
              accessibilityRole="button"
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

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

      {/* Pagination dots — left-aligned per mock */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <Dot key={index} active={index === currentIndex} />
        ))}
      </View>

      {/* Bottom actions — one gold moment per screen */}
      <View style={styles.bottomContainer}>
        {isLastSlide ? (
          <>
            <TouchableOpacity
              onPress={handleVerifyNow}
              activeOpacity={0.9}
              accessibilityRole="button"
              style={[styles.primaryButton, { backgroundColor: colors.goldFill }]}
            >
              <Text style={styles.primaryButtonText}>Verify My Identity</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleComplete}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={styles.secondaryButton}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                Explore first
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={[styles.primaryButton, { backgroundColor: colors.goldFill }]}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer — trust copy, mono and recorded */}
      <Animated.View entering={FadeIn.duration(700).delay(300)} style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          ONE PERSON · ONE BALLOT
        </Text>
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
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    minHeight: 44,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  brandText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.98, // .18em
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  skipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  slideIconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.98, // .18em
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.48,
    marginBottom: 14,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 320,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  noteIcon: {
    marginTop: 1,
  },
  noteText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  noteLead: {
    fontFamily: FONTS.sansSemiBold,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 30,
    marginBottom: 26,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  bottomContainer: {
    paddingHorizontal: 30,
    gap: 10,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: '#040707',
  },
  secondaryButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: 14,
  },
  footerText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2.2, // .22em
    fontVariant: ['tabular-nums'],
  },
});
