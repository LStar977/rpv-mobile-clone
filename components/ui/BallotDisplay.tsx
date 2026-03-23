import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BallotIcon } from '../icons';
import { useBallotStore, formatTimeRemaining } from '../../lib/ballots';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

interface BallotDisplayProps {
  size?: 'sm' | 'md' | 'lg';
  showTimer?: boolean;
  onPress?: () => void;
}

export function BallotDisplay({ size = 'md', showTimer = false, onPress }: BallotDisplayProps) {
  const { colors } = useTheme();
  const { balance, tier, getTimeUntilNextBallot, checkRegeneration } = useBallotStore();
  const [timeRemaining, setTimeRemaining] = useState(0);

  const scale = useSharedValue(1);

  // Size configurations
  const sizes = {
    sm: { icon: 16, text: 12, padding: 6, gap: 4 },
    md: { icon: 20, text: 14, padding: 8, gap: 6 },
    lg: { icon: 24, text: 16, padding: 10, gap: 8 },
  };

  const config = sizes[size];

  // Update timer every second
  useEffect(() => {
    if (!showTimer || tier === 'premium') return;

    const interval = setInterval(() => {
      checkRegeneration();
      setTimeRemaining(getTimeUntilNextBallot());
    }, 1000);

    return () => clearInterval(interval);
  }, [showTimer, tier]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });

    if (onPress) {
      onPress();
    } else {
      router.push('/modals/purchase-ballots');
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isLow = balance <= 2 && tier !== 'premium';
  const isEmpty = balance === 0 && tier !== 'premium';

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[
          animatedStyle,
          styles.container,
          {
            backgroundColor: isEmpty
              ? `${colors.error}20`
              : isLow
              ? `${colors.warning}20`
              : `${colors.gold}15`,
            borderColor: isEmpty
              ? colors.error
              : isLow
              ? colors.warning
              : colors.gold,
            paddingHorizontal: config.padding + 4,
            paddingVertical: config.padding,
            gap: config.gap,
          },
        ]}
      >
        <BallotIcon
          size={config.icon}
          color={isEmpty ? colors.error : isLow ? colors.warning : colors.gold}
        />
        <Text
          style={[
            styles.count,
            {
              fontSize: config.text,
              color: isEmpty ? colors.error : isLow ? colors.warning : colors.gold,
            },
          ]}
        >
          {tier === 'premium' ? '∞' : balance}
        </Text>
        {showTimer && timeRemaining > 0 && tier !== 'premium' && (
          <Text style={[styles.timer, { color: colors.textSecondary, fontSize: config.text - 2 }]}>
            +1 in {formatTimeRemaining(timeRemaining)}
          </Text>
        )}
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
  timer: {
    marginLeft: 4,
  },
});

export default BallotDisplay;
