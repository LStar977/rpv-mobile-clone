import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// Daily ballot allowance. Mirrors the backend cap (DAILY_BALLOT_CAP in routes.ts).
// Premium subscribers bypass this cap entirely.
export const DAILY_BALLOT_CAP = 20;

// Returns today's date as YYYY-MM-DD in UTC, used to detect day rollover.
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

interface BallotState {
  usedToday: number;
  usedTodayDate: string; // YYYY-MM-DD; used to lazy-reset on day rollover
  tier: 'free' | 'verified' | 'premium';
  _hasHydrated: boolean;

  // Actions
  setHasHydrated: (state: boolean) => void;
  setTier: (tier: 'free' | 'verified' | 'premium') => void;

  // Returns true if the vote is allowed (and the counter was incremented).
  // Returns false if the daily cap is reached. Premium users always pass.
  spendBallot: () => boolean;

  // Refunds a vote (used when an on-chain submission fails after spending).
  // No-op for premium users.
  restoreBallot: () => void;

  // Pure check — does the user have any ballots left today?
  canVote: () => boolean;

  // Number of votes left today. Returns Infinity for premium.
  remaining: () => number;
}

export const useBallotStore = create<BallotState>()(
  persist(
    (set, get) => ({
      usedToday: 0,
      usedTodayDate: todayUTC(),
      tier: 'free',
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      setTier: (tier) => {
        set({ tier });
      },

      spendBallot: () => {
        const { tier, usedToday, usedTodayDate } = get();

        if (tier === 'premium') return true;

        // Lazy reset on day rollover (UTC). Mirrors the backend behavior so
        // the local UI doesn't show "0 of 20" while the server still thinks
        // it's yesterday.
        const today = todayUTC();
        const effectiveUsed = usedTodayDate === today ? usedToday : 0;

        if (effectiveUsed >= DAILY_BALLOT_CAP) return false;

        set({ usedToday: effectiveUsed + 1, usedTodayDate: today });
        return true;
      },

      restoreBallot: () => {
        const { tier, usedToday, usedTodayDate } = get();
        if (tier === 'premium') return;
        const today = todayUTC();
        if (usedTodayDate !== today) return; // already rolled over, nothing to restore
        set({ usedToday: Math.max(0, usedToday - 1) });
      },

      canVote: () => {
        const { tier, usedToday, usedTodayDate } = get();
        if (tier === 'premium') return true;
        const today = todayUTC();
        const effectiveUsed = usedTodayDate === today ? usedToday : 0;
        return effectiveUsed < DAILY_BALLOT_CAP;
      },

      remaining: () => {
        const { tier, usedToday, usedTodayDate } = get();
        if (tier === 'premium') return Infinity;
        const today = todayUTC();
        const effectiveUsed = usedTodayDate === today ? usedToday : 0;
        return Math.max(0, DAILY_BALLOT_CAP - effectiveUsed);
      },
    }),
    {
      name: 'represent-ballots',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        usedToday: state.usedToday,
        usedTodayDate: state.usedTodayDate,
        tier: state.tier,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Hook: keeps the ballot store's `tier` in sync with the user's auth and
// subscription state. Mount this once at app root. Without it, paying premium
// users would still see free-tier UI because nothing updates `tier` after
// login.
//
// Logic:
//   - No user logged in → 'free'
//   - User logged in + active subscription → 'premium' (unlimited voting)
//   - User logged in + verified, no active sub → 'verified'
//   - User logged in but not verified → 'free'
export function useSyncBallotTier() {
  const user = useAuthStore((s) => s.user);
  const setTier = useBallotStore((s) => s.setTier);

  useEffect(() => {
    let cancelled = false;

    async function syncTier() {
      if (!user) {
        setTier('free');
        return;
      }

      try {
        // Authoritative subscription state lives on the server. Fetch it
        // on auth change rather than trusting whatever we last persisted.
        const token = useAuthStore.getState().token;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/api/stripe/subscription`, { headers });
        if (cancelled) return;

        let isActive = false;
        if (response.ok) {
          const data = await response.json();
          isActive = data?.status === 'active';
        }

        if (cancelled) return;
        if (isActive) {
          setTier('premium');
        } else if (user.verified) {
          setTier('verified');
        } else {
          setTier('free');
        }
      } catch {
        if (cancelled) return;
        setTier(user.verified ? 'verified' : 'free');
      }
    }

    syncTier();
    return () => {
      cancelled = true;
    };
  }, [user, setTier]);
}
