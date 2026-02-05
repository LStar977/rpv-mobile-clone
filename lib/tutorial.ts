import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TUTORIAL_KEY = '@represent_tutorial_complete';

// Action types that can be required to advance
export type TutorialActionType =
  | 'swipe-right'
  | 'swipe-left'
  | 'tap-tab'
  | 'tap-button'
  | 'tap-anywhere'
  | 'button-press'; // For intro/complete buttons

// Gesture types for the animated indicator
export type GestureType = 'swipe-right' | 'swipe-left' | 'tap';

// Step types determine UI behavior
export type TutorialStepType = 'intro' | 'action' | 'info' | 'complete';

export interface TutorialStep {
  id: string;
  type: TutorialStepType;
  title: string;
  description: string;
  targetTab?: 'dashboard' | 'proposals' | 'identity' | 'sentinel' | 'profile';
  targetElement?: string;
  requiredAction: TutorialActionType;
  gesture?: GestureType;
  position: 'top' | 'bottom' | 'center';
  highlightPadding?: number;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    type: 'intro',
    title: 'Welcome to Represent!',
    description: "Your voice matters. Let's take a quick tour to show you how to make it heard.",
    requiredAction: 'button-press',
    position: 'center',
  },
  {
    id: 'swipe-right',
    type: 'action',
    title: 'Swipe Right to Support',
    description: 'Try it now! Swipe the card to the right to support this proposal.',
    targetTab: 'proposals',
    targetElement: 'swipe-card',
    requiredAction: 'swipe-right',
    gesture: 'swipe-right',
    position: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'swipe-left',
    type: 'action',
    title: 'Swipe Left to Oppose',
    description: 'Now swipe left to oppose. Your vote shapes the community.',
    targetTab: 'proposals',
    targetElement: 'swipe-card',
    requiredAction: 'swipe-left',
    gesture: 'swipe-left',
    position: 'bottom',
    highlightPadding: 12,
  },
  {
    id: 'tap-identity',
    type: 'action',
    title: 'View Your Identity',
    description: 'Tap the Identity tab to see your civic ID card.',
    targetTab: 'proposals', // Current tab, we want them to navigate TO identity
    targetElement: 'tab-identity',
    requiredAction: 'tap-tab',
    gesture: 'tap',
    position: 'top',
    highlightPadding: 8,
  },
  {
    id: 'id-card-info',
    type: 'info',
    title: 'Your Digital Civic ID',
    description: 'This is your identity in the Represent community. It shows your verification status and achievements.',
    targetTab: 'identity',
    targetElement: 'id-card',
    requiredAction: 'tap-anywhere',
    position: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'tap-verify',
    type: 'action',
    title: 'Get Verified',
    description: 'Tap Verify Now to unlock voting on location-restricted proposals.',
    targetTab: 'identity',
    targetElement: 'verify-button',
    requiredAction: 'tap-button',
    gesture: 'tap',
    position: 'top',
    highlightPadding: 8,
  },
  {
    id: 'tap-sentinel',
    type: 'action',
    title: 'Meet Sentinel AI',
    description: 'Tap the Sentinel tab to discover AI-powered governance analysis.',
    targetTab: 'identity', // Current tab, navigate TO sentinel
    targetElement: 'tab-sentinel',
    requiredAction: 'tap-tab',
    gesture: 'tap',
    position: 'top',
    highlightPadding: 8,
  },
  {
    id: 'sentinel-info',
    type: 'info',
    title: 'Analyze Any Document',
    description: 'Paste any policy, law, or regulation here. Sentinel will grade it against 155 governance principles.',
    targetTab: 'sentinel',
    targetElement: 'sentinel-form',
    requiredAction: 'tap-anywhere',
    position: 'top',
    highlightPadding: 8,
  },
  {
    id: 'complete',
    type: 'complete',
    title: "You're All Set!",
    description: "You're ready to make your voice heard. Start by voting on proposals that matter to you!",
    requiredAction: 'button-press',
    position: 'center',
  },
];

interface TargetMeasurements {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TutorialState {
  isActive: boolean;
  hasCompleted: boolean;
  currentStepIndex: number;
  steps: TutorialStep[];
  targetMeasurements: TargetMeasurements | null;

  // Actions
  startTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => Promise<void>;
  completeTutorial: () => Promise<void>;
  completeAction: (action: TutorialActionType) => void;
  setTargetMeasurements: (measurements: TargetMeasurements | null) => void;
  checkTutorialStatus: () => Promise<boolean>;
  resetTutorial: () => Promise<void>;
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  isActive: false,
  hasCompleted: false,
  currentStepIndex: 0,
  steps: TUTORIAL_STEPS,
  targetMeasurements: null,

  startTutorial: () => {
    set({ isActive: true, currentStepIndex: 0, targetMeasurements: null });
  },

  nextStep: () => {
    const { currentStepIndex, steps } = get();
    console.log('➡️ nextStep called:', { currentStepIndex, totalSteps: steps.length });
    if (currentStepIndex < steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      console.log('📍 Advancing to step:', { newIndex, stepId: steps[newIndex]?.id });
      // Don't reset targetMeasurements to null - keep old spotlight visible until new measurements ready
      set({ currentStepIndex: newIndex });
    } else {
      console.log('🏁 Tutorial complete!');
      get().completeTutorial();
    }
  },

  previousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      // Don't reset targetMeasurements - keep visible until new measurements ready
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  // Called when user completes a required action
  completeAction: (action: TutorialActionType) => {
    const { currentStepIndex, steps, isActive } = get();
    console.log('🎯 completeAction called:', { action, isActive, currentStepIndex, requiredAction: steps[currentStepIndex]?.requiredAction });

    if (!isActive) {
      console.log('❌ Tutorial not active, returning early');
      return;
    }

    const currentStep = steps[currentStepIndex];
    if (currentStep?.requiredAction === action) {
      console.log('✅ Action matched! Advancing to next step');
      // Action matches, advance to next step
      get().nextStep();
    } else {
      console.log('❌ Action mismatch:', { expected: currentStep?.requiredAction, received: action });
    }
  },

  skipTutorial: async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_KEY, 'skipped');
    } catch (error) {
      console.error('Error saving tutorial skip state:', error);
    }
    set({ isActive: false, hasCompleted: true });
  },

  completeTutorial: async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_KEY, 'completed');
    } catch (error) {
      console.error('Error saving tutorial complete state:', error);
    }
    set({ isActive: false, hasCompleted: true });
  },

  setTargetMeasurements: (measurements) => {
    set({ targetMeasurements: measurements });
  },

  checkTutorialStatus: async () => {
    try {
      const status = await AsyncStorage.getItem(TUTORIAL_KEY);
      const hasCompleted = status === 'completed' || status === 'skipped';
      set({ hasCompleted });
      return hasCompleted;
    } catch (error) {
      console.error('Error checking tutorial status:', error);
      return false;
    }
  },

  resetTutorial: async () => {
    try {
      await AsyncStorage.removeItem(TUTORIAL_KEY);
    } catch (error) {
      console.error('Error resetting tutorial:', error);
    }
    set({ hasCompleted: false, currentStepIndex: 0 });
  },
}));
