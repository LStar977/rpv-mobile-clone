import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRPVBalance } from './rpv-token';

interface BallotState {
  balance: number;
  tier: 'free' | 'verified' | 'premium';
  isLoading: boolean;
  fetchError: boolean;
  lastSyncedAt: number | null;
  walletAddress: string | null;
  _hasHydrated: boolean;

  // Actions
  setHasHydrated: (state: boolean) => void;
  setTier: (tier: 'free' | 'verified' | 'premium') => void;
  syncFromChain: (walletAddress: string) => Promise<void>;
  spendBallot: () => boolean;
  restoreBallot: () => void;
  canVote: () => boolean;
}

export const useBallotStore = create<BallotState>()(
  persist(
    (set, get) => ({
      balance: 0,
      tier: 'free',
      isLoading: true,
      fetchError: false,
      lastSyncedAt: null,
      walletAddress: null,
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state, isLoading: !state });
      },

      setTier: (tier) => {
        set({ tier });
      },

      syncFromChain: async (walletAddress: string) => {
        console.log('[Ballots] syncFromChain called with:', walletAddress);

        if (!walletAddress) {
          console.log('[Ballots] No wallet address, setting balance to 0');
          set({ balance: 0, isLoading: false, fetchError: false, walletAddress: null });
          return;
        }

        const currentBalance = get().balance;
        set({ isLoading: true, walletAddress, fetchError: false });

        try {
          const result = await getRPVBalance(walletAddress);

          if (result.error) {
            console.warn('[Ballots] RPC fetch failed, keeping cached balance:', currentBalance);
            set({
              isLoading: false,
              fetchError: true,
            });
            return;
          }

          console.log('[Ballots] Got RPV balance:', result.balance, '| Setting to:', Math.floor(result.balance));
          set({
            balance: Math.floor(result.balance),
            isLoading: false,
            fetchError: false,
            lastSyncedAt: Date.now(),
          });
        } catch (error) {
          console.error('[Ballots] Failed to sync RPV balance:', error);
          set({ isLoading: false, fetchError: true });
        }
      },

      spendBallot: () => {
        const { balance, tier } = get();

        if (tier === 'premium') {
          return true;
        }

        if (balance <= 0) {
          return false;
        }

        set({ balance: balance - 1 });
        return true;
      },

      restoreBallot: () => {
        const { balance, tier } = get();
        if (tier !== 'premium') {
          set({ balance: balance + 1 });
        }
      },

      canVote: () => {
        const { balance, tier } = get();
        return tier === 'premium' || balance > 0;
      },
    }),
    {
      name: 'represent-ballots',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        balance: state.balance,
        tier: state.tier,
        lastSyncedAt: state.lastSyncedAt,
        walletAddress: state.walletAddress,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

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
