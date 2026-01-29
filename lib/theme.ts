import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'represent_theme_preference';

export type ThemePreference = 'system' | 'dark' | 'light';

export const DARK_COLORS = {
  background: '#040707',
  cardBg: '#0D0D0D',
  cardBgLight: '#1a1a1a',
  border: '#2a2a2a',
  text: '#E8E8E8',
  textSecondary: '#888888',
  textMuted: '#666666',
  gold: '#EABA58',
  goldLight: 'rgba(234, 186, 88, 0.1)',
  goldMedium: 'rgba(234, 186, 88, 0.2)',
  white: '#FFFFFF',
  error: '#E63946',
  errorLight: 'rgba(230, 57, 70, 0.15)',
  success: '#4CAF50',
  successLight: 'rgba(76, 175, 80, 0.15)',
  info: '#3b82f6',
  infoLight: 'rgba(59, 130, 246, 0.15)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.15)',
};

export const LIGHT_COLORS = {
  background: '#F5F5F5',
  cardBg: '#FFFFFF',
  cardBgLight: '#FAFAFA',
  border: '#E0E0E0',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  gold: '#C4952E',
  goldLight: 'rgba(196, 149, 46, 0.1)',
  goldMedium: 'rgba(196, 149, 46, 0.2)',
  white: '#FFFFFF',
  error: '#D32F2F',
  errorLight: 'rgba(211, 47, 47, 0.1)',
  success: '#388E3C',
  successLight: 'rgba(56, 142, 60, 0.1)',
  info: '#1976D2',
  infoLight: 'rgba(25, 118, 210, 0.1)',
  warning: '#F57C00',
  warningLight: 'rgba(245, 124, 0, 0.1)',
};

export const COLORS = DARK_COLORS;

interface ThemeContextType {
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
  colors: typeof DARK_COLORS;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const saved = await SecureStore.getItemAsync(THEME_KEY);
      if (saved && (saved === 'system' || saved === 'dark' || saved === 'light')) {
        setThemePreferenceState(saved);
      }
    } catch (error) {
      console.error('Failed to load theme preference:', error);
    }
  };

  const setThemePreference = async (theme: ThemePreference) => {
    setThemePreferenceState(theme);
    try {
      await SecureStore.setItemAsync(THEME_KEY, theme);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  const isDark = themePreference === 'system' 
    ? systemColorScheme === 'dark' 
    : themePreference === 'dark';

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value = { themePreference, setThemePreference, colors, isDark };

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  const systemColorScheme = useColorScheme();
  
  if (!context) {
    const isDark = systemColorScheme === 'dark';
    return {
      themePreference: 'system' as ThemePreference,
      setThemePreference: async () => {},
      colors: isDark ? DARK_COLORS : LIGHT_COLORS,
      isDark,
    };
  }
  return context;
}

export function useThemeColors() {
  const { colors } = useTheme();
  return colors;
}

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
};

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};
