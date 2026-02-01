import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, Dimensions, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'represent_theme_preference';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type ThemePreference = 'system' | 'dark' | 'light';

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM DARK THEME - Executive, Sophisticated, Trustworthy
// Inspired by: Apple Wallet, Linear, Bloomberg Terminal, Robinhood
// ═══════════════════════════════════════════════════════════════════════════════

export const DARK_COLORS = {
  // ─────────────────────────────────────────────────────────────────────────────
  // BACKGROUNDS - Deep, rich blacks with subtle blue undertones for sophistication
  // ─────────────────────────────────────────────────────────────────────────────
  background: '#000000',           // Pure black - premium feel
  backgroundElevated: '#0C0C0E',   // Slightly elevated surfaces
  backgroundSecondary: '#111113',  // Secondary background

  // Surface hierarchy (cards, modals, sheets)
  surface: '#161618',              // Primary surface
  surfaceElevated: '#1C1C1F',      // Elevated surface (modals)
  surfaceHighlight: '#222225',     // Highlighted surface (hover states)
  surfacePressed: '#2A2A2D',       // Pressed state

  // ─────────────────────────────────────────────────────────────────────────────
  // BORDERS - Subtle, sophisticated separators
  // ─────────────────────────────────────────────────────────────────────────────
  border: 'rgba(255, 255, 255, 0.08)',      // Default border
  borderSubtle: 'rgba(255, 255, 255, 0.05)', // Subtle dividers
  borderStrong: 'rgba(255, 255, 255, 0.12)', // Prominent borders
  borderFocus: 'rgba(255, 255, 255, 0.20)',  // Focus states

  // ─────────────────────────────────────────────────────────────────────────────
  // TEXT HIERARCHY - Crystal clear readability
  // ─────────────────────────────────────────────────────────────────────────────
  text: '#FFFFFF',                 // Primary text - pure white
  textPrimary: '#FFFFFF',          // Alias for primary
  textSecondary: '#A0A0A5',        // Secondary text
  textTertiary: '#6B6B70',         // Tertiary/muted text
  textDisabled: '#404045',         // Disabled text
  textInverse: '#000000',          // Text on light backgrounds

  // ─────────────────────────────────────────────────────────────────────────────
  // BRAND - Premium Gold System
  // ─────────────────────────────────────────────────────────────────────────────
  // Primary gold - warm, rich, trustworthy
  gold: '#C9A227',                 // Primary brand gold
  goldLight: '#E5C34A',            // Light gold for highlights
  goldDark: '#9E7E1E',             // Dark gold for depth

  // Gold surfaces (for backgrounds, highlights)
  goldSurface: 'rgba(201, 162, 39, 0.08)',     // Subtle gold tint
  goldSurfaceStrong: 'rgba(201, 162, 39, 0.15)', // Stronger gold tint
  goldSurfaceIntense: 'rgba(201, 162, 39, 0.25)', // Intense gold tint

  // Gold gradient
  goldGradientStart: '#E5C34A',
  goldGradientMiddle: '#C9A227',
  goldGradientEnd: '#9E7E1E',

  // ─────────────────────────────────────────────────────────────────────────────
  // SEMANTIC COLORS - Clear, accessible status indicators
  // ─────────────────────────────────────────────────────────────────────────────
  // Success - Fresh green
  success: '#34D399',
  successLight: '#6EE7B7',
  successDark: '#059669',
  successSurface: 'rgba(52, 211, 153, 0.12)',
  successSurfaceStrong: 'rgba(52, 211, 153, 0.20)',

  // Error - Clear red
  error: '#F87171',
  errorLight: '#FCA5A5',
  errorDark: '#DC2626',
  errorSurface: 'rgba(248, 113, 113, 0.12)',
  errorSurfaceStrong: 'rgba(248, 113, 113, 0.20)',

  // Warning - Warm amber
  warning: '#FBBF24',
  warningLight: '#FCD34D',
  warningDark: '#D97706',
  warningSurface: 'rgba(251, 191, 36, 0.12)',
  warningSurfaceStrong: 'rgba(251, 191, 36, 0.20)',

  // Info - Cool blue
  info: '#60A5FA',
  infoLight: '#93C5FD',
  infoDark: '#2563EB',
  infoSurface: 'rgba(96, 165, 250, 0.12)',
  infoSurfaceStrong: 'rgba(96, 165, 250, 0.20)',

  // ─────────────────────────────────────────────────────────────────────────────
  // ACCENT COLORS - For variety and visual interest
  // ─────────────────────────────────────────────────────────────────────────────
  accent: '#8B5CF6',               // Purple accent
  accentSurface: 'rgba(139, 92, 246, 0.12)',

  cyan: '#22D3EE',                 // Cyan for special highlights
  cyanSurface: 'rgba(34, 211, 238, 0.12)',

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY COLORS
  // ─────────────────────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.75)',
  overlayLight: 'rgba(0, 0, 0, 0.50)',
  overlayUltraLight: 'rgba(0, 0, 0, 0.30)',

  // Glass effects
  glass: 'rgba(255, 255, 255, 0.03)',
  glassMedium: 'rgba(255, 255, 255, 0.06)',
  glassStrong: 'rgba(255, 255, 255, 0.10)',

  // Shimmer (for skeleton loading)
  shimmer: 'rgba(255, 255, 255, 0.05)',
  shimmerHighlight: 'rgba(255, 255, 255, 0.10)',

  // Tab bar
  tabBar: 'rgba(0, 0, 0, 0.85)',
  tabBarBorder: 'rgba(255, 255, 255, 0.06)',

  // Input fields
  inputBg: 'rgba(255, 255, 255, 0.04)',
  inputBgFocus: 'rgba(255, 255, 255, 0.08)',

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGACY ALIASES - For backward compatibility with existing components
  // ─────────────────────────────────────────────────────────────────────────────
  cardBg: '#161618',                 // Alias for surface
  cardBgLight: '#1C1C1F',            // Alias for surfaceElevated
  textMuted: '#6B6B70',              // Alias for textTertiary
  surfaceHover: '#222225',           // Alias for surfaceHighlight
  borderLight: 'rgba(255, 255, 255, 0.05)', // Alias for borderSubtle

  // ─────────────────────────────────────────────────────────────────────────────
  // GRADIENTS (as arrays for LinearGradient)
  // ─────────────────────────────────────────────────────────────────────────────
  gradientGold: ['#E5C34A', '#C9A227', '#9E7E1E'],
  gradientDark: ['#1C1C1F', '#111113', '#000000'],
  gradientCard: ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'],
  gradientHero: ['#161618', '#0C0C0E', '#000000'],
  gradientSuccess: ['#34D399', '#059669'],
  gradientAccent: ['#8B5CF6', '#6366F1'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM LIGHT THEME - Clean, Bright, Professional
// ═══════════════════════════════════════════════════════════════════════════════

export const LIGHT_COLORS = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundElevated: '#FAFAFA',
  backgroundSecondary: '#F5F5F7',

  // Surfaces
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#F5F5F7',
  surfacePressed: '#EBEBED',

  // Borders
  border: 'rgba(0, 0, 0, 0.08)',
  borderSubtle: 'rgba(0, 0, 0, 0.05)',
  borderStrong: 'rgba(0, 0, 0, 0.12)',
  borderFocus: 'rgba(0, 0, 0, 0.20)',

  // Text
  text: '#000000',
  textPrimary: '#000000',
  textSecondary: '#6B6B70',
  textTertiary: '#9A9AA0',
  textDisabled: '#C5C5CA',
  textInverse: '#FFFFFF',

  // Brand Gold - Darker for light mode
  gold: '#9E7E1E',
  goldLight: '#C9A227',
  goldDark: '#7A6217',
  goldSurface: 'rgba(158, 126, 30, 0.08)',
  goldSurfaceStrong: 'rgba(158, 126, 30, 0.15)',
  goldSurfaceIntense: 'rgba(158, 126, 30, 0.25)',
  goldGradientStart: '#C9A227',
  goldGradientMiddle: '#9E7E1E',
  goldGradientEnd: '#7A6217',

  // Semantic - Darker for light backgrounds
  success: '#059669',
  successLight: '#34D399',
  successDark: '#047857',
  successSurface: 'rgba(5, 150, 105, 0.08)',
  successSurfaceStrong: 'rgba(5, 150, 105, 0.15)',

  error: '#DC2626',
  errorLight: '#F87171',
  errorDark: '#B91C1C',
  errorSurface: 'rgba(220, 38, 38, 0.08)',
  errorSurfaceStrong: 'rgba(220, 38, 38, 0.15)',

  warning: '#D97706',
  warningLight: '#FBBF24',
  warningDark: '#B45309',
  warningSurface: 'rgba(217, 119, 6, 0.08)',
  warningSurfaceStrong: 'rgba(217, 119, 6, 0.15)',

  info: '#2563EB',
  infoLight: '#60A5FA',
  infoDark: '#1D4ED8',
  infoSurface: 'rgba(37, 99, 235, 0.08)',
  infoSurfaceStrong: 'rgba(37, 99, 235, 0.15)',

  // Accent
  accent: '#7C3AED',
  accentSurface: 'rgba(124, 58, 237, 0.08)',
  cyan: '#0891B2',
  cyanSurface: 'rgba(8, 145, 178, 0.08)',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  overlay: 'rgba(0, 0, 0, 0.50)',
  overlayLight: 'rgba(0, 0, 0, 0.30)',
  overlayUltraLight: 'rgba(0, 0, 0, 0.15)',

  glass: 'rgba(255, 255, 255, 0.70)',
  glassMedium: 'rgba(255, 255, 255, 0.85)',
  glassStrong: 'rgba(255, 255, 255, 0.95)',

  shimmer: 'rgba(0, 0, 0, 0.04)',
  shimmerHighlight: 'rgba(0, 0, 0, 0.08)',

  tabBar: 'rgba(255, 255, 255, 0.90)',
  tabBarBorder: 'rgba(0, 0, 0, 0.08)',

  inputBg: 'rgba(0, 0, 0, 0.03)',
  inputBgFocus: 'rgba(0, 0, 0, 0.06)',

  // Legacy aliases for backward compatibility
  cardBg: '#FFFFFF',
  cardBgLight: '#F5F5F7',
  textMuted: '#8E8E93',
  surfaceHover: '#F5F5F7',
  borderLight: 'rgba(0, 0, 0, 0.05)',

  gradientGold: ['#C9A227', '#9E7E1E', '#7A6217'],
  gradientDark: ['#FFFFFF', '#FAFAFA', '#F5F5F7'],
  gradientCard: ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.05)'],
  gradientHero: ['#FFFFFF', '#FAFAFA', '#F5F5F7'],
  gradientSuccess: ['#059669', '#047857'],
  gradientAccent: ['#7C3AED', '#6366F1'],
};

// Default export
export const COLORS = DARK_COLORS;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY - Premium, refined type scale
// Inspired by: Apple Human Interface Guidelines, Material Design 3
// ═══════════════════════════════════════════════════════════════════════════════

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const TYPOGRAPHY = {
  // ─────────────────────────────────────────────────────────────────────────────
  // DISPLAY - Hero headlines, splash screens
  // ─────────────────────────────────────────────────────────────────────────────
  displayLarge: {
    fontFamily,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '700' as const,
    letterSpacing: -1.5,
  },
  displayMedium: {
    fontFamily,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '600' as const,
    letterSpacing: -1,
  },
  displaySmall: {
    fontFamily,
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADLINES - Section headers, card titles
  // ─────────────────────────────────────────────────────────────────────────────
  h1: {
    fontFamily,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  h2: {
    fontFamily,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600' as const,
    letterSpacing: -0.25,
  },
  h3: {
    fontFamily,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  h4: {
    fontFamily,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  h5: {
    fontFamily,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  h6: {
    fontFamily,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BODY - Main content text
  // ─────────────────────────────────────────────────────────────────────────────
  bodyLarge: {
    fontFamily,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  body: {
    fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LABELS - Buttons, tags, small UI elements
  // ─────────────────────────────────────────────────────────────────────────────
  labelLarge: {
    fontFamily,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
    letterSpacing: 0.25,
  },
  label: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.25,
  },
  labelSmall: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.25,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CAPTIONS & OVERLINES
  // ─────────────────────────────────────────────────────────────────────────────
  caption: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.25,
  },
  captionSmall: {
    fontFamily,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400' as const,
    letterSpacing: 0.25,
  },
  overline: {
    fontFamily,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NUMBERS - For stats, metrics, prices
  // ─────────────────────────────────────────────────────────────────────────────
  numberLarge: {
    fontFamily,
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '700' as const,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'] as any,
  },
  numberMedium: {
    fontFamily,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'] as any,
  },
  numberSmall: {
    fontFamily,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as any,
  },

  // Legacy aliases for backward compatibility
  headlineLarge: {
    fontFamily,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontFamily,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontFamily,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SPACING - 4px base unit, harmonious scale
// ═══════════════════════════════════════════════════════════════════════════════

export const SPACING = {
  // Micro spacing
  '2xs': 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
  '7xl': 80,
  '8xl': 96,

  // Semantic aliases
  none: 0,
  px: 1,
  gutter: 20,           // Standard page gutter
  cardPadding: 20,      // Standard card padding
  sectionGap: 32,       // Gap between sections
  screenPadding: 20,    // Screen edge padding

  // Legacy aliases
  xxs: 2,
  xxxl: 32,
  huge: 40,
  massive: 48,
  giant: 64,
};

// Font sizes (legacy support)
export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

// ═══════════════════════════════════════════════════════════════════════════════
// BORDER RADIUS - Smooth, modern curves
// ═══════════════════════════════════════════════════════════════════════════════

export const RADIUS = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,

  // Semantic
  button: 12,
  card: 16,
  modal: 24,
  input: 12,
  badge: 8,
  avatar: 9999,
};

// Legacy alias
export const BORDER_RADIUS = RADIUS;

// ═══════════════════════════════════════════════════════════════════════════════
// SHADOWS - Subtle, layered depth for premium feel
// ═══════════════════════════════════════════════════════════════════════════════

export const SHADOWS = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // Subtle shadows for light touch
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },

  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 32,
    elevation: 16,
  },

  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.20,
    shadowRadius: 48,
    elevation: 24,
  },

  // Gold glow for premium/active elements
  glow: {
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },

  glowStrong: {
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 12,
  },

  glowSubtle: {
    shadowColor: '#C9A227',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 8,
    elevation: 4,
  },

  // Success glow
  glowSuccess: {
    shadowColor: '#34D399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 6,
  },

  // Error glow
  glowError: {
    shadowColor: '#F87171',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 6,
  },

  // Card shadow (subtle lift)
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  cardHover: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },

  // Inner highlight for depth
  innerGlow: {
    shadowColor: 'rgba(255, 255, 255, 0.05)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION - Smooth, delightful motion
// ═══════════════════════════════════════════════════════════════════════════════

export const ANIMATION = {
  // Durations (ms)
  instant: 50,
  fast: 150,
  normal: 250,
  slow: 350,
  verySlow: 500,

  // Named durations
  duration: {
    instant: 50,
    fast: 150,
    normal: 250,
    slow: 350,
    verySlow: 500,
    pageTransition: 300,
    modalEntry: 350,
    buttonPress: 100,
    ripple: 400,
  },

  // Spring configs (for Reanimated) - also available in EASING
  spring: {
    default: { damping: 20, stiffness: 300, mass: 1 },
    bouncy: { damping: 12, stiffness: 180, mass: 0.8 },
    gentle: { damping: 25, stiffness: 200, mass: 1 },
    snappy: { damping: 30, stiffness: 400, mass: 0.8 },
    slowmo: { damping: 35, stiffness: 150, mass: 1.2 },
  },
};

// Easing curves
export const EASING = {
  // Standard curves
  easeOut: [0.0, 0.0, 0.2, 1] as const,
  easeIn: [0.4, 0.0, 1, 1] as const,
  easeInOut: [0.4, 0.0, 0.2, 1] as const,

  // Premium curves (more natural feel)
  premium: [0.22, 1, 0.36, 1] as const,       // Custom ease-out
  premiumIn: [0.64, 0, 0.78, 0] as const,     // Custom ease-in

  // Spring configs (for Reanimated)
  spring: { damping: 20, stiffness: 300, mass: 1 },
  springBouncy: { damping: 12, stiffness: 180, mass: 0.8 },
  springGentle: { damping: 25, stiffness: 200, mass: 1 },
  springSnappy: { damping: 30, stiffness: 400, mass: 0.8 },
  springSlowmo: { damping: 35, stiffness: 150, mass: 1.2 },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HAPTIC FEEDBACK
// ═══════════════════════════════════════════════════════════════════════════════

export const HAPTICS = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'success',
  warning: 'warning',
  error: 'error',
  selection: 'selection',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// BREAKPOINTS & RESPONSIVE
// ═══════════════════════════════════════════════════════════════════════════════

export const BREAKPOINTS = {
  small: 320,
  medium: 375,
  large: 428,
  tablet: 768,
};

export const SCREEN = {
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  isSmall: SCREEN_WIDTH < 375,
  isMedium: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 428,
  isLarge: SCREEN_WIDTH >= 428,
  isTablet: SCREEN_WIDTH >= 768,
};

// Responsive value selector
export const responsive = <T>(small: T, medium: T, large?: T): T => {
  if (SCREEN_WIDTH >= BREAKPOINTS.large) return large ?? medium;
  if (SCREEN_WIDTH >= BREAKPOINTS.medium) return medium;
  return small;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Z-INDEX SCALE
// ═══════════════════════════════════════════════════════════════════════════════

export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  overlay: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
  max: 9999,
};

// ═══════════════════════════════════════════════════════════════════════════════
// THEME CONTEXT & PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

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
  const [isLoaded, setIsLoaded] = useState(false);

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
    } finally {
      setIsLoaded(true);
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
    ? systemColorScheme !== 'light'
    : themePreference === 'dark';

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  const value = { themePreference, setThemePreference, colors, isDark };

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  const systemColorScheme = useColorScheme();

  if (!context) {
    const isDark = systemColorScheme !== 'light';
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

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// Create alpha variant of a color
export const withAlpha = (color: string, alpha: number): string => {
  if (color.startsWith('rgba')) {
    return color.replace(/[\d.]+\)$/, `${alpha})`);
  }
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
};

// Get contrasting text color
export const getContrastText = (background: string, colors: typeof DARK_COLORS): string => {
  // Simple heuristic - can be improved
  if (background.includes('gold') || background === colors.gold) {
    return colors.black;
  }
  return colors.text;
};
