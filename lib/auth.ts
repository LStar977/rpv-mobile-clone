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
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (provider: 'google' | 'apple', idToken: string, userData?: Partial<User>) => Promise<boolean>;
  demoLogin: () => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  checkAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

const TOKEN_KEY = 'represent_auth_token';
const USER_KEY = 'represent_user';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setLoading: (loading: boolean) => set({ isLoading: loading }),

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
              verified: data.user.verified || false,
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
