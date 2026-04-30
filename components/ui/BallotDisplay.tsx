import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BallotIcon } from '../icons';
import { useBallotStore, DAILY_BALLOT_CAP } from '../../lib/ballots';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

interface BallotDisplayProps {
  size?: 'sm' | 'md' | 'lg';
  /** @deprecated kept for backward compat — the daily-allowance system has no regeneration timer. */
  showTimer?: boolean;
  /** Override the default tap behavior (which routes to /modals/subscription). */
  onPress?: () => void;
}

export function BallotDisplay({ size = 'md', onPress }: BallotDisplayProps) {
  const { colors } = useTheme();
  const usedToday = useBallotStore((s) => s.usedToday);
  const usedTodayDate = useBallotStore((s) => s.usedTodayDate);
  const tier = useBallotStore((s) => s.tier);

  const scale = useSharedValue(1);

  const sizes = {
    sm: { icon: 16, text: 12, padding: 6, gap: 4 },
    md: { icon: 20, text: 14, padding: 8, gap: 6 },
    lg: { icon: 24, text: 16, padding: 10, gap: 8 },
  };
  const config = sizes[size];

  // Mirror the store's lazy-reset logic so the displayed count is correct
  // even if the user opens the app the next day before any vote action runs.
  const today = new Date().toISOString().slice(0, 10);
  const effectiveUsed = usedTodayDate === today ? usedToday : 0;
  const remaining = Math.max(0, DAILY_BALLOT_CAP - effectiveUsed);
  const isPremium = tier === 'premium';
  const isLow = !isPremium && remaining <= 2;
  const isEmpty = !isPremium && remaining === 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    if (onPress) {
      onPress();
    } else {
      // Tapping the chip leads to the premium upgrade flow (the new
      // monetization path now that ballot packs are gone).
      router.push('/modals/subscription');
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const accentColor = isEmpty ? colors.error : isLow ? colors.warning : colors.gold;
  const accentBg = isEmpty ? `${colors.error}20` : isLow ? `${colors.warning}20` : `${colors.gold}15`;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[
          animatedStyle,
          styles.container,
          {
            backgroundColor: accentBg,
            borderColor: accentColor,
            paddingHorizontal: config.padding + 4,
            paddingVertical: config.padding,
            gap: config.gap,
          },
        ]}
      >
        <BallotIcon size={config.icon} color={accentColor} />
        <Text
          style={[
            styles.count,
            {
              fontSize: config.text,
              color: accentColor,
            },
          ]}
        >
          {isPremium ? '∞' : `${remaining} of ${DAILY_BALLOT_CAP}`}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  count: {
    fontWeight: '700',
  },
});

export default BallotDisplay;
