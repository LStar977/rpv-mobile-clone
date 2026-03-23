import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const BALLOTS_KEY = 'represent_ballots';
const REGEN_KEY = 'represent_ballots_regen';

// Regeneration rates by tier (in milliseconds)
const REGEN_RATES = {
  free: 24 * 60 * 60 * 1000,      // 24 hours
  verified: 12 * 60 * 60 * 1000,  // 12 hours
  premium: 0,                      // Unlimited (no regen needed)
};

// Daily regeneration amounts by tier
const REGEN_AMOUNTS = {
  free: 1,
  verified: 2,
  premium: 0, // Premium has unlimited, no regen needed
};

const INITIAL_BALLOTS = 10;

interface BallotState {
  balance: number;
  lastRegeneration: number | null; // timestamp
  tier: 'free' | 'verified' | 'premium';
  isLoading: boolean;

  // Actions
  initialize: () => Promise<void>;
  setTier: (tier: 'free' | 'verified' | 'premium') => void;
  spendBallot: () => boolean;
  addBallots: (count: number) => Promise<void>;
  checkRegeneration: () => void;
  getTimeUntilNextBallot: () => number; // milliseconds
  getRegenerationProgress: () => number; // 0-1
}

export const useBallotStore = create<BallotState>((set, get) => ({
  balance: 0,
  lastRegeneration: null,
  tier: 'free',
  isLoading: true,

  initialize: async () => {
    try {
      const storedBalance = await AsyncStorage.getItem(BALLOTS_KEY);
      const storedRegen = await AsyncStorage.getItem(REGEN_KEY);

      let balance = INITIAL_BALLOTS;
      let lastRegeneration: number | null = null;

      if (storedBalance !== null) {
        balance = parseInt(storedBalance, 10);
      }

      if (storedRegen !== null) {
        lastRegeneration = parseInt(storedRegen, 10);
      }

      set({ balance, lastRegeneration, isLoading: false });

      // Check for any pending regeneration
      get().checkRegeneration();
    } catch (error) {
      console.error('Failed to initialize ballots:', error);
      set({ balance: INITIAL_BALLOTS, isLoading: false });
    }
  },

  setTier: (tier) => {
    set({ tier });
    // If upgrading to premium, no need to track regeneration
    if (tier === 'premium') {
      set({ lastRegeneration: null });
    }
  },

  spendBallot: () => {
    const { balance, tier } = get();

    // Premium users have unlimited ballots
    if (tier === 'premium') {
      return true;
    }

    if (balance <= 0) {
      return false;
    }

    const newBalance = balance - 1;
    set({ balance: newBalance });

    // Start regeneration timer if this is the first spend
    const { lastRegeneration } = get();
    if (lastRegeneration === null) {
      const now = Date.now();
      set({ lastRegeneration: now });
      AsyncStorage.setItem(REGEN_KEY, now.toString());
    }

    // Persist balance
    AsyncStorage.setItem(BALLOTS_KEY, newBalance.toString());

    return true;
  },

  addBallots: async (count) => {
    const { balance } = get();
    const newBalance = balance + count;
    set({ balance: newBalance });
    await AsyncStorage.setItem(BALLOTS_KEY, newBalance.toString());
  },

  checkRegeneration: () => {
    const { lastRegeneration, tier, balance } = get();

    // Premium users don't need regeneration
    if (tier === 'premium') return;

    // No regeneration timer set
    if (lastRegeneration === null) return;

    const now = Date.now();
    const elapsed = now - lastRegeneration;
    const regenRate = REGEN_RATES[tier];
    const regenAmount = REGEN_AMOUNTS[tier];

    // Calculate how many regeneration cycles have passed
    const cycles = Math.floor(elapsed / regenRate);

    if (cycles > 0) {
      const ballotsToAdd = cycles * regenAmount;
      const newBalance = balance + ballotsToAdd;
      const newRegenTime = lastRegeneration + (cycles * regenRate);

      set({ balance: newBalance, lastRegeneration: newRegenTime });
      AsyncStorage.setItem(BALLOTS_KEY, newBalance.toString());
      AsyncStorage.setItem(REGEN_KEY, newRegenTime.toString());
    }
  },

  getTimeUntilNextBallot: () => {
    const { lastRegeneration, tier } = get();

    // Premium users have unlimited
    if (tier === 'premium') return 0;

    // No regeneration timer set (hasn't spent any ballots yet)
    if (lastRegeneration === null) return 0;

    const now = Date.now();
    const regenRate = REGEN_RATES[tier];
    const elapsed = now - lastRegeneration;
    const timeInCurrentCycle = elapsed % regenRate;
    const remaining = regenRate - timeInCurrentCycle;

    return remaining;
  },

  getRegenerationProgress: () => {
    const { lastRegeneration, tier } = get();

    if (tier === 'premium') return 1;
    if (lastRegeneration === null) return 0;

    const now = Date.now();
    const regenRate = REGEN_RATES[tier];
    const elapsed = now - lastRegeneration;
    const timeInCurrentCycle = elapsed % regenRate;

    return timeInCurrentCycle / regenRate;
  },
}));

// Helper to format time remaining
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return 'Now';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}
