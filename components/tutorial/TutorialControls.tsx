import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTutorialStore } from '../../lib/tutorial';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function TutorialControls() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    currentStepIndex,
    steps,
    skipTutorial,
    completeAction,
  } = useTutorialStore();

  const currentStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progress = (currentStepIndex + 1) / totalSteps;

  const isIntro = currentStep?.type === 'intro';
  const isAction = currentStep?.type === 'action';
  const isInfo = currentStep?.type === 'info';
  const isComplete = currentStep?.type === 'complete';

  const handleSkip = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await skipTutorial();
    // Navigate to home screen after skipping
    router.replace('/(tabs)/dashboard');
  };

  const handleButtonPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    completeAction('button-press');

    // Navigate to home screen after completing tutorial
    if (isComplete) {
      setTimeout(() => {
        router.replace('/(tabs)/dashboard');
      }, 100);
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Skip button - always visible except on complete screen */}
      {!isComplete && (
        <Animated.View
          entering={FadeIn.delay(300).duration(300)}
          style={[styles.skipContainer, { paddingTop: insets.top + SPACING.md }]}
        >
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: 'rgba(255, 255, 255, 0.6)' }]}>
              Skip
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Bottom controls area - transparent background for action steps to show tab bar */}
      <View
        style={[
          styles.bottomContainer,
          { paddingBottom: insets.bottom + SPACING.lg },
          isAction && { backgroundColor: 'transparent' }
        ]}
        pointerEvents={isAction ? 'box-none' : 'auto'}
      >
        {/* Progress bar - no touch handling for action steps */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={styles.progressContainer}
          pointerEvents={isAction ? 'none' : 'auto'}
        >
          <View style={[styles.progressBar, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            >
              <LinearGradient
                colors={[colors.gold, '#A68523']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </Animated.View>
          </View>
          <Text style={styles.progressText}>
            {currentStepIndex + 1} of {totalSteps}
          </Text>
        </Animated.View>

        {/* Action-specific controls - box-none for action steps to allow tab bar touches */}
        <View style={styles.actionContainer} pointerEvents={isAction ? 'box-none' : 'auto'}>
          {/* Intro: "Let's Go" button */}
          {isIntro && (
            <Animated.View entering={FadeInUp.delay(400).duration(400)}>
              <TouchableOpacity
                onPress={handleButtonPress}
                activeOpacity={0.8}
                style={styles.primaryButton}
              >
                <LinearGradient
                  colors={[colors.gold, '#A68523']}
                  style={[StyleSheet.absoluteFill, { borderRadius: BORDER_RADIUS.lg }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Text style={styles.primaryButtonText}>Let's Go</Text>
                <Ionicons name="arrow-forward" size={20} color="#000" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Action: Instruction hint (no button - user must perform action) */}
          {isAction && (
            <Animated.View
              entering={FadeInUp.delay(400).duration(400)}
              style={styles.hintContainer}
              pointerEvents="none"
            >
              <View style={[styles.hintBadge, { backgroundColor: 'rgba(234, 186, 88, 0.15)' }]}>
                <Ionicons
                  name={
                    currentStep.gesture === 'swipe-right' ? 'arrow-forward-circle' :
                    currentStep.gesture === 'swipe-left' ? 'arrow-back-circle' :
                    'hand-left'
                  }
                  size={18}
                  color={colors.gold}
                />
                <Text style={[styles.hintText, { color: colors.gold }]}>
                  {currentStep.gesture === 'swipe-right' && 'Swipe right now!'}
                  {currentStep.gesture === 'swipe-left' && 'Swipe left now!'}
                  {currentStep.gesture === 'tap' && 'Tap now!'}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Info: Tap anywhere hint */}
          {isInfo && (
            <Animated.View
              entering={FadeInUp.delay(400).duration(400)}
              style={styles.hintContainer}
            >
              <View style={[styles.hintBadge, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
                <Ionicons name="hand-left-outline" size={16} color="rgba(255, 255, 255, 0.7)" />
                <Text style={[styles.hintText, { color: 'rgba(255, 255, 255, 0.7)' }]}>
                  Tap anywhere to continue
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Complete: "Start Exploring" button */}
          {isComplete && (
            <Animated.View entering={FadeInUp.delay(400).duration(400)}>
              <TouchableOpacity
                onPress={handleButtonPress}
                activeOpacity={0.8}
                style={styles.primaryButton}
              >
                <LinearGradient
                  colors={[colors.gold, '#A68523']}
                  style={[StyleSheet.absoluteFill, { borderRadius: BORDER_RADIUS.lg }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <Ionicons name="rocket" size={20} color="#000" />
                <Text style={styles.primaryButtonText}>Start Exploring</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  skipContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.lg,
  },
  skipButton: {
    padding: SPACING.sm,
  },
  skipText: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },
  bottomContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255, 255, 255, 0.5)',
    minWidth: 50,
    textAlign: 'right',
  },
  actionContainer: {
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    minWidth: 200,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
    color: '#000',
  },
  hintContainer: {
    alignItems: 'center',
  },
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  hintText: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
  },
});

export default TutorialControls;
