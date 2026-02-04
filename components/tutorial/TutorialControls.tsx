import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTutorialStore } from '../../lib/tutorial';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

export function TutorialControls() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentStepIndex, steps, nextStep, skipTutorial } = useTutorialStore();

  const isLastStep = currentStepIndex === steps.length - 1;
  const progress = (currentStepIndex + 1) / steps.length;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    nextStep();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skipTutorial();
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(400).duration(300)}
      style={[styles.container, { paddingBottom: insets.bottom + SPACING.lg }]}
    >
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: `${colors.border}60` }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.gold, width: `${progress * 100}%` },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: colors.textTertiary }]}>
          {currentStepIndex + 1} of {steps.length}
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <LinearGradient
            colors={[colors.gold, colors.goldDark || '#C99A38']}
            style={styles.nextButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.nextText}>{isLastStep ? 'Get Started' : 'Next'}</Text>
            <Ionicons
              name={isLastStep ? 'checkmark' : 'chevron-forward'}
              size={18}
              color="#000"
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
    ...TYPOGRAPHY.labelSmall,
    minWidth: 50,
    textAlign: 'right',
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  skipText: {
    ...TYPOGRAPHY.labelMedium,
  },
  nextButton: {
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  nextText: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    fontWeight: '600',
  },
});

export default TutorialControls;
