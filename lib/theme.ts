import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, Dimensions } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'represent_theme_preference';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ThemePreference = 'system' | 'dark' | 'light';

// Premium Dark Theme - Sophisticated, rich colors with depth
export const DARK_COLORS = {
  // Backgrounds with subtle depth
  background: '#050506',
  backgroundSecondary: '#0A0A0C',
  cardBg: '#0F0F12',
  cardBgElevated: '#141418',
  cardBgLight: '#1A1A1F',
  cardBgHover: '#1E1E24',

  // Borders with subtlety
  border: '#1F1F26',
  borderLight: '#2A2A33',
  borderFocus: '#3A3A45',

  // Text hierarchy
  text: '#F5F5F7',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  textDisabled: '#52525B',

  // Premium Gold - Rich and warm
  gold: '#D4AF37',
  goldLight: 'rgba(212, 175, 55, 0.12)',
  goldMedium: 'rgba(212, 175, 55, 0.24)',
  goldStrong: 'rgba(212, 175, 55, 0.36)',
  goldGradientStart: '#D4AF37',
  goldGradientEnd: '#B8962D',

  // Accent Colors
  white: '#FFFFFF',
  black: '#000000',

  // Semantic Colors - Refined
  error: '#EF4444',
  errorLight: 'rgba(239, 68, 68, 0.12)',
  errorMedium: 'rgba(239, 68, 68, 0.24)',

  success: '#22C55E',
  successLight: 'rgba(34, 197, 94, 0.12)',
  successMedium: 'rgba(34, 197, 94, 0.24)',

  info: '#3B82F6',
  infoLight: 'rgba(59, 130, 246, 0.12)',
  infoMedium: 'rgba(59, 130, 246, 0.24)',

  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  warningMedium: 'rgba(245, 158, 11, 0.24)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.4)',

  // Glass effect
  glass: 'rgba(255, 255, 255, 0.05)',
  glassStrong: 'rgba(255, 255, 255, 0.1)',
};

// Premium Light Theme - Clean, bright with subtle warmth
export const LIGHT_COLORS = {
  // Backgrounds
  background: '#FAFAFA',
  backgroundSecondary: '#F5F5F5',
  cardBg: '#FFFFFF',
  cardBgElevated: '#FFFFFF',
  cardBgLight: '#F9FAFB',
  cardBgHover: '#F3F4F6',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderFocus: '#D1D5DB',

  // Text hierarchy
  text: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',
  textDisabled: '#D1D5DB',

  // Premium Gold - Slightly deeper for light mode
  gold: '#B8962D',
  goldLight: 'rgba(184, 150, 45, 0.08)',
  goldMedium: 'rgba(184, 150, 45, 0.16)',
  goldStrong: 'rgba(184, 150, 45, 0.24)',
  goldGradientStart: '#D4AF37',
  goldGradientEnd: '#B8962D',

  // Accent Colors
  white: '#FFFFFF',
  black: '#000000',

  // Semantic Colors
  error: '#DC2626',
  errorLight: 'rgba(220, 38, 38, 0.08)',
  errorMedium: 'rgba(220, 38, 38, 0.16)',

  success: '#16A34A',
  successLight: 'rgba(22, 163, 74, 0.08)',
  successMedium: 'rgba(22, 163, 74, 0.16)',

  info: '#2563EB',
  infoLight: 'rgba(37, 99, 235, 0.08)',
  infoMedium: 'rgba(37, 99, 235, 0.16)',

  warning: '#D97706',
  warningLight: 'rgba(217, 119, 6, 0.08)',
  warningMedium: 'rgba(217, 119, 6, 0.16)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Glass effect
  glass: 'rgba(255, 255, 255, 0.8)',
  glassStrong: 'rgba(255, 255, 255, 0.95)',
};

export const COLORS = DARK_COLORS;

// Typography Scale - Premium feel with proper hierarchy
export const TYPOGRAPHY = {
  // Display - Hero text
  displayLarge: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700' as const,
    letterSpacing: -1,
  },
  displayMedium: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  displaySmall: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },

  // Headlines
  headlineLarge: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },

  // Body text
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: 0.15,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },

  // Labels
  labelLarge: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },

  // Overline - Section headers
  overline: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
};

// Spacing Scale - Consistent rhythm
export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
  giant: 64,
};

// Font Sizes (legacy support)
export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 24,
  xxxl: 32,
};

// Border Radius - Smooth, premium curves
export const BORDER_RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
  full: 9999,
};

// Premium Shadows - Subtle, layered depth
export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  // Gold glow for premium elements
  glow: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glowStrong: {
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  // Card shadows
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  // For dark mode - subtle inner glow
  innerGlow: {
    shadowColor: 'rgba(255, 255, 255, 0.05)',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
};

// Animation Durations
export const ANIMATION = {
  instant: 50,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
};

// Easing Functions (for Reanimated)
export const EASING = {
  easeOut: [0.0, 0.0, 0.2, 1],
  easeIn: [0.4, 0.0, 1, 1],
  easeInOut: [0.4, 0.0, 0.2, 1],
  spring: { damping: 15, stiffness: 150 },
  springBouncy: { damping: 12, stiffness: 180 },
  springGentle: { damping: 20, stiffness: 100 },
};

// Haptic feedback types
export const HAPTICS = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'success',
  warning: 'warning',
  error: 'error',
} as const;

// Screen breakpoints
export const BREAKPOINTS = {
  small: 320,
  medium: 375,
  large: 428,
  tablet: 768,
};

// Get responsive value based on screen width
export const responsive = (small: number, medium: number, large?: number) => {
  if (SCREEN_WIDTH >= BREAKPOINTS.large) return large ?? medium;
  if (SCREEN_WIDTH >= BREAKPOINTS.medium) return medium;
  return small;
};

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
