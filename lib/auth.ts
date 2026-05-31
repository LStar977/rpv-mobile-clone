import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const API_BASE_URL = 'https://representportal.com';

interface User {
  id: string;
  email: string;
  name: string | null;
  profileImageUrl: string | null;
  walletAddress: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  verified: boolean | null;
  // Passed the Didit "Citizen" workflow (passport + proof of address).
  // Gates citizens-only proposals. Independent of `verified`.
  citizenshipVerified: boolean | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hydrated: boolean;
  login: (provider: 'google' | 'apple', idToken: string, userData?: Partial<User>) => Promise<boolean>;
  emailLogin: (email: string, password: string, name?: string, isSignup?: boolean) => Promise<{ success: boolean; error?: string }>;
  demoLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

const TOKEN_KEY = 'represent_auth_token';
const USER_KEY = 'represent_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  hydrated: false,

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  // Synchronous-feeling rehydrate from SecureStore. Runs once at app start;
  // populates user/token/isAuthenticated optimistically from cache so the UI
  // can render the authed shell on first paint instead of flashing the
  // sign-in screen. checkAuth() then validates against the server in the
  // background and clears state if the cached token has been revoked.
  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (token && userJson) {
        try {
          const user = JSON.parse(userJson) as User;
          set({ user, token, isAuthenticated: true, isLoading: false, hydrated: true });
          // Background re-validate against server; clears state if revoked.
          get().checkAuth();
          return;
        } catch {
          // Cached user JSON is corrupt — fall through to unauthed state.
        }
      }
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, hydrated: true });
    } catch (e) {
      console.error('Auth hydrate error:', e);
      set({ hydrated: true, isLoading: false });
    }
  },

  login: async (provider: 'google' | 'apple', idToken: string, userData?: Partial<User>) => {
    try {
      set({ isLoading: true });

      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          ...userData,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Login failed:', error);
        set({ isLoading: false });
        return false;
      }

      const data = await response.json();
      
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));

      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error('Login error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  emailLogin: async (email: string, password: string, name?: string, isSignup?: boolean) => {
    try {
      set({ isLoading: true });

      const endpoint = isSignup ? '/api/auth/mobile/email/signup' : '/api/auth/mobile/email/login';
      const body: Record<string, string> = { email, password };
      if (isSignup && name) {
        body.name = name;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Email auth failed:', error);
        set({ isLoading: false });
        return {
          success: false,
          error: error.message || error.error || 'Authentication failed. Please try again.'
        };
      }

      const data = await response.json();

      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));

      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });

      return { success: true };
    } catch (error) {
      console.error('Email auth error:', error);
      set({ isLoading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error. Please check your connection.'
      };
    }
  },

  demoLogin: async () => {
    try {
      set({ isLoading: true });

      const response = await fetch(`${API_BASE_URL}/api/auth/mobile/demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'demo@represent.app',
          password: 'RepresentDemo2024!',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('Demo login failed:', error);
        set({ isLoading: false });
        return false;
      }

      const data = await response.json();

      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data.user));

      set({
        user: data.user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });

      return true;
    } catch (error) {
      console.error('Demo login error:', error);
      set({ isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);

      // Clear device-local, non-user-scoped caches (org votes, demo data)
      // so the next account on this device doesn't inherit them — fixes a
      // fresh account showing a phantom ballot count.
      try {
        const { clearLocalUserData } = require('./api');
        await clearLocalUserData();
      } catch { /* non-fatal */ }

      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  deleteAccount: async () => {
    try {
      const token = get().token;
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/api/auth/account`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Delete account failed:', await response.json().catch(() => ({})));
        return false;
      }

      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);

      try {
        const { clearLocalUserData } = require('./api');
        await clearLocalUserData();
      } catch { /* non-fatal */ }

      set({
        user: null,
        token: null,
        isAuthenticated: false,
      });

      return true;
    } catch (error) {
      console.error('Delete account error:', error);
      return false;
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      if (token) {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.valid && data.user) {
            // Use FRESH user data from API (includes updated location after verification)
            const freshUser: User = {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name || null,
              profileImageUrl: data.user.profileImageUrl || null,
              walletAddress: data.user.walletAddress || null,
              country: data.user.country || null,
              state: data.user.state || null,
              city: data.user.city || null,
              verified: !!(data.user.verified || data.user.isVerified || data.user.is_verified || data.user.kycVerified || data.user.kyc_verified || data.user.passport_verified),
              citizenshipVerified: !!(data.user.citizenshipVerified || data.user.citizenship_verified),
            };
            
            // Update cached user with fresh data
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(freshUser));
            
            set({
              user: freshUser,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }
        }
      }

      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Check auth error:', error);
      set({ isLoading: false });
    }
  },
}));

export async function getAuthToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}
