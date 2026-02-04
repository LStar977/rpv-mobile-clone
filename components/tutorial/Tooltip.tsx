import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, LayoutChangeEvent, Image } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { TutorialStep } from '../../lib/tutorial';

interface TooltipProps {
  step: TutorialStep;
  targetRect: { x: number; y: number; width: number; height: number } | null;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TOOLTIP_MAX_WIDTH = 320;
const ARROW_SIZE = 12;

// Import logo
const logo = require('../../assets/logo.png');

export function Tooltip({ step, targetRect }: TooltipProps) {
  const { colors } = useTheme();
  const [tooltipSize, setTooltipSize] = useState({ width: TOOLTIP_MAX_WIDTH, height: 120 });

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTooltipSize({ width, height });
  };

  // Calculate position
  const position = useMemo(() => {
    if (step.position === 'center' || !targetRect) {
      return {
        left: (SCREEN_WIDTH - TOOLTIP_MAX_WIDTH) / 2,
        top: SCREEN_HEIGHT / 2 - tooltipSize.height / 2 - 40,
        arrowStyle: null as any,
        entering: FadeInDown.delay(200).duration(300).springify(),
      };
    }

    const centerX = targetRect.x + targetRect.width / 2;
    let left = Math.max(SPACING.lg, Math.min(
      centerX - tooltipSize.width / 2,
      SCREEN_WIDTH - tooltipSize.width - SPACING.lg
    ));
    let top = 0;
    let arrowStyle: any = null;
    let entering = FadeInDown.delay(200).duration(300).springify();

    const arrowLeft = Math.max(20, Math.min(centerX - left - ARROW_SIZE / 2, tooltipSize.width - 40));

    if (step.position === 'bottom') {
      top = targetRect.y + targetRect.height + ARROW_SIZE + 8;
      entering = FadeInDown.delay(200).duration(300).springify();
      arrowStyle = {
        position: 'absolute' as const,
        top: -ARROW_SIZE,
        left: arrowLeft,
        width: 0,
        height: 0,
        borderLeftWidth: ARROW_SIZE / 2,
        borderRightWidth: ARROW_SIZE / 2,
        borderBottomWidth: ARROW_SIZE,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: colors.surface,
      };
    } else if (step.position === 'top') {
      top = targetRect.y - tooltipSize.height - ARROW_SIZE - 8;
      entering = FadeInUp.delay(200).duration(300).springify();
      arrowStyle = {
        position: 'absolute' as const,
        bottom: -ARROW_SIZE,
        left: arrowLeft,
        width: 0,
        height: 0,
        borderLeftWidth: ARROW_SIZE / 2,
        borderRightWidth: ARROW_SIZE / 2,
        borderTopWidth: ARROW_SIZE,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: colors.surface,
      };
    }

    return { left, top, arrowStyle, entering };
  }, [step, targetRect, tooltipSize, colors]);

  const isCentered = step.position === 'center';
  const isIntroOrComplete = step.type === 'intro' || step.type === 'complete';

  return (
    <Animated.View
      entering={position.entering}
      onLayout={handleLayout}
      style={[
        styles.container,
        isCentered && styles.centeredContainer,
        {
          left: position.left,
          top: position.top,
          backgroundColor: colors.surface,
          borderColor: colors.gold,
          ...SHADOWS.lg,
        },
      ]}
    >
      {/* Gold accent gradient */}
      <LinearGradient
        colors={[`${colors.gold}15`, 'transparent']}
        style={styles.gradientAccent}
      />

      {/* Arrow */}
      {position.arrowStyle && <View style={position.arrowStyle} />}

      {/* Content */}
      <View style={styles.content}>
        {/* Logo for intro/complete steps */}
        {isIntroOrComplete && (
          <View style={styles.logoContainer}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          </View>
        )}
        <Text style={[styles.title, { color: colors.gold }]}>{step.title}</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {step.description}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    maxWidth: TOOLTIP_MAX_WIDTH,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  centeredContainer: {
    minWidth: 280,
  },
  gradientAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  content: {
    padding: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.sm,
  },
  description: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 22,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logo: {
    width: 80,
    height: 80,
  },
});

export default Tooltip;
