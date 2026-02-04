import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { GestureType } from '../../lib/tutorial';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GestureIndicatorProps {
  gesture: GestureType;
  targetRect: { x: number; y: number; width: number; height: number } | null;
}

export function GestureIndicator({ gesture, targetRect }: GestureIndicatorProps) {
  if (!targetRect) return null;

  if (gesture === 'swipe-right' || gesture === 'swipe-left') {
    return <SwipeIndicator gesture={gesture} targetRect={targetRect} />;
  }

  if (gesture === 'tap') {
    return <TapIndicator targetRect={targetRect} />;
  }

  return null;
}

// Animated hand that swipes across the card
function SwipeIndicator({
  gesture,
  targetRect,
}: {
  gesture: 'swipe-right' | 'swipe-left';
  targetRect: { x: number; y: number; width: number; height: number };
}) {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);

  const isRight = gesture === 'swipe-right';
  const swipeDistance = targetRect.width * 0.6;

  useEffect(() => {
    // Reset and start animation
    translateX.value = 0;
    opacity.value = 0;

    // Animate: fade in, swipe, fade out, repeat
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 200 }),
        withDelay(1000, withTiming(0, { duration: 200 }))
      ),
      -1,
      false
    );

    translateX.value = withRepeat(
      withSequence(
        withDelay(200, withTiming(isRight ? swipeDistance : -swipeDistance, {
          duration: 800,
          easing: Easing.out(Easing.cubic),
        })),
        withDelay(400, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [gesture, swipeDistance, isRight]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  // Position hand at center of target
  const handX = targetRect.x + targetRect.width / 2 - 30 + (isRight ? -swipeDistance / 2 : swipeDistance / 2);
  const handY = targetRect.y + targetRect.height / 2 - 30;

  return (
    <Animated.View
      style={[
        styles.swipeContainer,
        { left: handX, top: handY },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      {/* Arrow trail */}
      <View style={[styles.arrowTrail, isRight ? styles.arrowRight : styles.arrowLeft]}>
        <Ionicons
          name={isRight ? 'arrow-forward' : 'arrow-back'}
          size={24}
          color="rgba(234, 186, 88, 0.6)"
        />
      </View>

      {/* Hand icon */}
      <View style={styles.handIcon}>
        <Ionicons name="hand-right" size={40} color="#EABA58" />
      </View>
    </Animated.View>
  );
}

// Pulsing tap indicator
function TapIndicator({
  targetRect,
}: {
  targetRect: { x: number; y: number; width: number; height: number };
}) {
  const scale = useSharedValue(1);
  const rippleScale = useSharedValue(0.5);
  const rippleOpacity = useSharedValue(0);

  useEffect(() => {
    // Pulsing finger
    scale.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 300 }),
        withTiming(1, { duration: 300 })
      ),
      -1,
      true
    );

    // Ripple effect
    rippleScale.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 0 }),
        withTiming(2, { duration: 800, easing: Easing.out(Easing.cubic) })
      ),
      -1,
      false
    );

    rippleOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 0 }),
        withTiming(0, { duration: 800 })
      ),
      -1,
      false
    );
  }, []);

  const fingerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rippleScale.value }],
    opacity: rippleOpacity.value,
  }));

  // Position at center of target
  const tapX = targetRect.x + targetRect.width / 2 - 30;
  const tapY = targetRect.y + targetRect.height / 2 - 30;

  return (
    <View style={[styles.tapContainer, { left: tapX, top: tapY }]} pointerEvents="none">
      {/* Ripple rings */}
      <Animated.View style={[styles.ripple, rippleStyle]} />
      <Animated.View style={[styles.ripple, styles.ripple2, rippleStyle]} />

      {/* Finger icon */}
      <Animated.View style={[styles.fingerIcon, fingerStyle]}>
        <Ionicons name="finger-print" size={36} color="#EABA58" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: {
    position: 'absolute',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10001,
  },
  handIcon: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#EABA58',
  },
  arrowTrail: {
    position: 'absolute',
    opacity: 0.8,
  },
  arrowRight: {
    right: -30,
  },
  arrowLeft: {
    left: -30,
  },
  tapContainer: {
    position: 'absolute',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10001,
  },
  fingerIcon: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#EABA58',
  },
  ripple: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#EABA58',
  },
  ripple2: {
    borderWidth: 1,
  },
});

export default GestureIndicator;
