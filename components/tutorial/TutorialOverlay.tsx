import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Modal, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTutorialStore } from '../../lib/tutorial';
import { useTheme } from '../../lib/theme';
import { Spotlight } from './Spotlight';
import { Tooltip } from './Tooltip';
import { TutorialControls } from './TutorialControls';

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
  const { isActive, currentStepIndex, steps, targetMeasurements, setTargetMeasurements } =
    useTutorialStore();

  const currentStep = steps[currentStepIndex];
  const isCenterModal = currentStep?.position === 'center';

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

  if (!isActive) return null;

  return (
    <Modal visible={isActive} transparent animationType="none" statusBarTranslucent>
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.container}
      >
        {/* Dark overlay with spotlight cutout */}
        {!isCenterModal && targetMeasurements ? (
          <Spotlight
            targetRect={targetMeasurements}
            padding={currentStep.highlightPadding || 8}
          />
        ) : (
          // Full dark backdrop for center modals
          <View style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.9)' }]} />
        )}

        {/* Tooltip */}
        <Tooltip step={currentStep} targetRect={targetMeasurements} />

        {/* Controls */}
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
});

export default TutorialOverlay;
