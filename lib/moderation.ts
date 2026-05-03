import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { moderationApi } from './api';

// Local store for the user's mute list. The backend is authoritative when
// available, but we persist locally so feeds filter out muted creators
// instantly on app start (before any network roundtrip) and continue working
// offline.

interface ModerationState {
  mutedUserIds: string[]; // keep as array for JSON-stable persistence
  _hasHydrated: boolean;

  setHasHydrated: (state: boolean) => void;

  isMuted: (userId: string | null | undefined) => boolean;
  mute: (userId: string) => Promise<void>;
  unmute: (userId: string) => Promise<void>;

  // Replace the local set with the server's authoritative list.
  syncFromServer: () => Promise<void>;
}

export const useModerationStore = create<ModerationState>()(
  persist(
    (set, get) => ({
      mutedUserIds: [],
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      isMuted: (userId) => {
        if (!userId) return false;
        return get().mutedUserIds.includes(String(userId));
      },

      mute: async (userId) => {
        const id = String(userId);
        const current = get().mutedUserIds;
        if (!current.includes(id)) {
          set({ mutedUserIds: [...current, id] });
        }
        // Fire-and-forget server sync. If it fails the local state still
        // applies, which is the right UX — the user expects an immediate
        // hide regardless of network.
        try {
          await moderationApi.muteUser(id);
        } catch {
          /* ignored — client state is the visible truth */
        }
      },

      unmute: async (userId) => {
        const id = String(userId);
        set({ mutedUserIds: get().mutedUserIds.filter((x) => x !== id) });
        try {
          await moderationApi.unmuteUser(id);
        } catch {
          /* ignored */
        }
      },

      syncFromServer: async () => {
        const result = await moderationApi.getMutedUsers();
        if (result.data) {
          set({ mutedUserIds: result.data.map(String) });
        }
      },
    }),
    {
      name: 'moderation-mutes',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// Hook: refresh the mute list from server on mount. Use in any screen that
// renders feeds (Vote, Dashboard) so a fresh sign-in pulls server-side mutes.
export function useSyncMutes() {
  useEffect(() => {
    useModerationStore.getState().syncFromServer();
  }, []);
}
