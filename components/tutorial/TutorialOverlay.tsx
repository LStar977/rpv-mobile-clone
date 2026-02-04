import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { router, usePathname } from 'expo-router';
import { useTutorialStore } from '../../lib/tutorial';
import { useTheme } from '../../lib/theme';
import { Spotlight } from './Spotlight';
import { Tooltip } from './Tooltip';
import { TutorialControls } from './TutorialControls';
import { GestureIndicator } from './GestureIndicator';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Registry to store refs to tutorial target elements
const targetRegistry: Map<string, React.RefObject<View>> = new Map();

// Hook for components to register themselves as tutorial targets
export function useTutorialTarget(targetId: string) {
  const ref = useRef<View>(null);

  useEffect(() => {
    targetRegistry.set(targetId, ref);
    return () => {
      targetRegistry.delete(targetId);
    };
  }, [targetId]);

  return ref;
}

// Function to measure a target element
export async function measureTarget(
  targetId: string
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const ref = targetRegistry.get(targetId);
  if (!ref?.current) return null;

  return new Promise((resolve) => {
    ref.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        resolve({ x, y, width, height });
      } else {
        resolve(null);
      }
    });
  });
}

export function TutorialOverlay() {
  const { colors } = useTheme();
  const pathname = usePathname();
  const {
    isActive,
    currentStepIndex,
    steps,
    targetMeasurements,
    setTargetMeasurements,
    completeAction,
  } = useTutorialStore();

  const currentStep = steps[currentStepIndex];
  const isCenterModal = currentStep?.position === 'center';
  const isActionStep = currentStep?.type === 'action';
  const isInfoStep = currentStep?.type === 'info';

  // Auto-navigate to correct tab for current step
  useEffect(() => {
    if (!isActive || !currentStep?.targetTab) return;

    const currentTab = pathname.split('/').pop();
    if (currentTab !== currentStep.targetTab) {
      // Navigate to the required tab
      router.push(`/(tabs)/${currentStep.targetTab}`);
    }
  }, [isActive, currentStepIndex, currentStep?.targetTab, pathname]);

  // Measure target element when step changes
  useEffect(() => {
    const measureCurrentTarget = async () => {
      if (!isActive || !currentStep?.targetElement) {
        setTargetMeasurements(null);
        return;
      }

      // Small delay to allow navigation/render to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      const measurements = await measureTarget(currentStep.targetElement);
      setTargetMeasurements(measurements);
    };

    measureCurrentTarget();
  }, [isActive, currentStepIndex, currentStep?.targetElement]);

  // Handle tap on overlay (for info steps with tap-anywhere)
  const handleOverlayTap = () => {
    if (isInfoStep && currentStep?.requiredAction === 'tap-anywhere') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      completeAction('tap-anywhere');
    }
  };

  if (!isActive) return null;

  return (
    <Modal visible={isActive} transparent animationType="none" statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.container}
      >
        {/* For center modals (intro/complete), full dark backdrop */}
        {isCenterModal && (
          <View style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.92)' }]} />
        )}

        {/* For action/info steps with target, show spotlight with holes */}
        {!isCenterModal && targetMeasurements && (
          <>
            {/* Spotlight creates dark areas around the target */}
            <Spotlight
              targetRect={targetMeasurements}
              padding={currentStep.highlightPadding || 8}
            />

            {/* For action steps, the target area needs to be touchable */}
            {isActionStep && (
              <View
                style={[
                  styles.touchableHole,
                  {
                    left: targetMeasurements.x - (currentStep.highlightPadding || 8),
                    top: targetMeasurements.y - (currentStep.highlightPadding || 8),
                    width: targetMeasurements.width + (currentStep.highlightPadding || 8) * 2,
                    height: targetMeasurements.height + (currentStep.highlightPadding || 8) * 2,
                  },
                ]}
                pointerEvents="box-none"
              />
            )}

            {/* Gesture indicator for action steps */}
            {isActionStep && currentStep.gesture && (
              <GestureIndicator
                gesture={currentStep.gesture}
                targetRect={targetMeasurements}
              />
            )}
          </>
        )}

        {/* For info steps, tapping anywhere advances */}
        {isInfoStep && (
          <TouchableWithoutFeedback onPress={handleOverlayTap}>
            <View style={styles.tapAnywhere} />
          </TouchableWithoutFeedback>
        )}

        {/* Tooltip */}
        <Tooltip step={currentStep} targetRect={targetMeasurements} />

        {/* Controls (skip button, progress, action buttons for intro/complete) */}
        <TutorialControls />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  touchableHole: {
    position: 'absolute',
    // This view allows touches to pass through to the target below
  },
  tapAnywhere: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});

export default TutorialOverlay;
