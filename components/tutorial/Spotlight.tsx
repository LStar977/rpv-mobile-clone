import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme, BORDER_RADIUS } from '../../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SpotlightProps {
  targetRect: { x: number; y: number; width: number; height: number };
  padding?: number;
  borderRadius?: number;
}

export function Spotlight({ targetRect, padding = 8, borderRadius = 16 }: SpotlightProps) {
  const { colors } = useTheme();
  const pulseOpacity = useSharedValue(1);

  // Subtle pulse animation on the border
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  const highlightRect = {
    x: targetRect.x - padding,
    y: targetRect.y - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  };

  const borderStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Top section */}
      <View
        style={[
          styles.overlay,
          {
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(0, highlightRect.y),
          },
        ]}
      />

      {/* Left section */}
      <View
        style={[
          styles.overlay,
          {
            top: highlightRect.y,
            left: 0,
            width: Math.max(0, highlightRect.x),
            height: highlightRect.height,
          },
        ]}
      />

      {/* Right section */}
      <View
        style={[
          styles.overlay,
          {
            top: highlightRect.y,
            left: highlightRect.x + highlightRect.width,
            right: 0,
            height: highlightRect.height,
          },
        ]}
      />

      {/* Bottom section */}
      <View
        style={[
          styles.overlay,
          {
            top: highlightRect.y + highlightRect.height,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
      />

      {/* Gold border around spotlight */}
      <Animated.View
        style={[
          styles.spotlightBorder,
          borderStyle,
          {
            top: highlightRect.y - 2,
            left: highlightRect.x - 2,
            width: highlightRect.width + 4,
            height: highlightRect.height + 4,
            borderRadius: borderRadius + 2,
            borderColor: colors.gold,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 2,
  },
});

export default Spotlight;
