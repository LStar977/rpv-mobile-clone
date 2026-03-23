import { create } from 'zustand';
import { getRPVBalance } from './rpv-token';

interface BallotState {
  balance: number;
  tier: 'free' | 'verified' | 'premium';
  isLoading: boolean;
  lastSyncedAt: number | null;
  walletAddress: string | null;

  // Actions
  initialize: () => void;
  setTier: (tier: 'free' | 'verified' | 'premium') => void;
  syncFromChain: (walletAddress: string) => Promise<void>;
  spendBallot: () => boolean; // Optimistic update for UI
  canVote: () => boolean;
}

export const useBallotStore = create<BallotState>((set, get) => ({
  balance: 0,
  tier: 'free',
  isLoading: true,
  lastSyncedAt: null,
  walletAddress: null,

  initialize: () => {
    // No longer loading from AsyncStorage - will sync from chain
    set({ isLoading: false });
  },

  setTier: (tier) => {
    set({ tier });
  },

  /**
   * Sync ballot balance from on-chain RPV token balance
   */
  syncFromChain: async (walletAddress: string) => {
    if (!walletAddress) {
      set({ balance: 0, isLoading: false, walletAddress: null });
      return;
    }

    set({ isLoading: true, walletAddress });

    try {
      const balance = await getRPVBalance(walletAddress);
      set({
        balance: Math.floor(balance), // RPV tokens = ballots (1:1)
        isLoading: false,
        lastSyncedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to sync RPV balance:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Optimistic balance deduction for immediate UI feedback
   * Actual balance will be synced from chain after vote API call
   */
  spendBallot: () => {
    const { balance, tier } = get();

    // Premium users have unlimited ballots
    if (tier === 'premium') {
      return true;
    }

    if (balance <= 0) {
      return false;
    }

    // Optimistic update - will be corrected on next chain sync
    set({ balance: balance - 1 });
    return true;
  },

  canVote: () => {
    const { balance, tier } = get();
    return tier === 'premium' || balance > 0;
  },
}));

// Helper to format time remaining (kept for compatibility)
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
