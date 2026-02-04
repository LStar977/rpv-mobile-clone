import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TUTORIAL_KEY = '@represent_tutorial_complete';

export type TutorialStepId =
  | 'welcome'
  | 'swipe_intro'
  | 'swipe_right'
  | 'swipe_left'
  | 'identity_card'
  | 'identity_verify'
  | 'sentinel_intro'
  | 'sentinel_analyze'
  | 'complete';

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  description: string;
  targetTab?: 'dashboard' | 'proposals' | 'identity' | 'sentinel' | 'profile';
  targetElement?: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  highlightPadding?: number;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Represent',
    description: "Let's take a quick tour of the app. You'll learn how to vote on proposals, verify your identity, and use Sentinel AI.",
    position: 'center',
  },
  {
    id: 'swipe_intro',
    title: 'Swipe to Vote',
    description: 'Browse proposals by swiping through cards. Each card shows a community proposal you can support or oppose.',
    targetTab: 'proposals',
    targetElement: 'swipe-card',
    position: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'swipe_right',
    title: 'Swipe Right to Support',
    description: 'Swipe the card to the right to support a proposal. A green indicator will appear as you swipe.',
    targetTab: 'proposals',
    targetElement: 'swipe-card',
    position: 'bottom',
  },
  {
    id: 'swipe_left',
    title: 'Swipe Left to Oppose',
    description: 'Swipe left to oppose a proposal. A red indicator will appear.',
    targetTab: 'proposals',
    targetElement: 'swipe-card',
    position: 'bottom',
  },
  {
    id: 'identity_card',
    title: 'Your Civic Identity',
    description: 'This is your digital civic ID card. It shows your verification status and civic badges.',
    targetTab: 'identity',
    targetElement: 'id-card',
    position: 'bottom',
    highlightPadding: 8,
  },
  {
    id: 'identity_verify',
    title: 'Get Verified',
    description: 'Verify your identity to unlock voting on geo-restricted proposals and earn the Verified badge.',
    targetTab: 'identity',
    targetElement: 'verify-button',
    position: 'top',
    highlightPadding: 8,
  },
  {
    id: 'sentinel_intro',
    title: 'Sentinel AI',
    description: 'Sentinel analyzes government documents against 155 governance principles and generates report cards.',
    targetTab: 'sentinel',
    targetElement: 'sentinel-header',
    position: 'bottom',
  },
  {
    id: 'sentinel_analyze',
    title: 'Analyze Documents',
    description: 'Paste any policy or law here and tap "Generate Report Card" to see how it measures up.',
    targetTab: 'sentinel',
    targetElement: 'sentinel-form',
    position: 'top',
    highlightPadding: 8,
  },
  {
    id: 'complete',
    title: "You're All Set!",
    description: "You're ready to make your voice heard. Start by voting on proposals that matter to you!",
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
    if (currentStepIndex < steps.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1, targetMeasurements: null });
    } else {
      get().completeTutorial();
    }
  },

  previousStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1, targetMeasurements: null });
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
