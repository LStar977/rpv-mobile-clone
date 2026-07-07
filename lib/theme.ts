import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme, Dimensions } from 'react-native';
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
  // BACKGROUNDS - Obsidian Black for authority and premium feel
  // ─────────────────────────────────────────────────────────────────────────────
  background: '#040707',           // Obsidian Black - primary background
  backgroundElevated: '#0A0D0D',   // Slightly elevated surfaces
  backgroundSecondary: '#0F1212',  // Secondary background

  // Surface hierarchy (cards, modals, sheets)
  surface: '#141818',              // Primary surface
  surfaceElevated: '#1A1F1F',      // Elevated surface (modals)
  surfaceHighlight: '#202626',     // Highlighted surface (hover states)
  surfacePressed: '#282E2E',       // Pressed state

  // ─────────────────────────────────────────────────────────────────────────────
  // BORDERS - Subtle, sophisticated separators
  // ─────────────────────────────────────────────────────────────────────────────
  border: 'rgba(244, 245, 246, 0.08)',      // Default border
  borderSubtle: 'rgba(244, 245, 246, 0.05)', // Subtle dividers
  borderStrong: 'rgba(244, 245, 246, 0.12)', // Prominent borders
  borderFocus: 'rgba(244, 245, 246, 0.20)',  // Focus states

  // ─────────────────────────────────────────────────────────────────────────────
  // TEXT HIERARCHY - Civic White for clean readability
  // ─────────────────────────────────────────────────────────────────────────────
  text: '#F4F5F6',                 // Civic White - primary text
  textPrimary: '#F4F5F6',          // Alias for primary
  textSecondary: '#B8BABB',        // Secondary text
  textTertiary: '#7A7D7E',         // Tertiary/muted text
  textDisabled: '#4A4D4E',         // Disabled text
  textInverse: '#040707',          // Text on light backgrounds

  // ─────────────────────────────────────────────────────────────────────────────
  // BRAND - Sovereign Gold System
  // ─────────────────────────────────────────────────────────────────────────────
  // Primary gold - governance highlights, calls-to-action
  gold: '#EABA58',                 // Sovereign Gold - primary brand
  goldLight: '#F0CB7A',            // Light gold for highlights
  goldDark: '#C99A38',             // Dark gold for depth
  goldFill: '#EABA58',             // Gold as a fill (CTAs) — same in both themes

  // Gold surfaces (for backgrounds, highlights)
  goldSurface: 'rgba(234, 186, 88, 0.08)',     // Subtle gold tint
  goldSurfaceStrong: 'rgba(234, 186, 88, 0.15)', // Stronger gold tint
  goldSurfaceIntense: 'rgba(234, 186, 88, 0.25)', // Intense gold tint

  // Gold gradient
  goldGradientStart: '#F0CB7A',
  goldGradientMiddle: '#EABA58',
  goldGradientEnd: '#C99A38',

  // ─────────────────────────────────────────────────────────────────────────────
  // SIDE COLORS - Green = Support, Red = Oppose
  // ALWAYS paired with a text label + exact count (colorblind/grayscale safe)
  // ─────────────────────────────────────────────────────────────────────────────
  support: '#34D399',
  supportSurface: 'rgba(52, 211, 153, 0.12)',
  oppose: '#F87171',
  opposeSurface: 'rgba(248, 113, 113, 0.12)',

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
  white: '#F4F5F6',
  black: '#040707',
  transparent: 'transparent',

  // Overlays
  overlay: 'rgba(4, 7, 7, 0.75)',
  overlayLight: 'rgba(4, 7, 7, 0.50)',
  overlayUltraLight: 'rgba(4, 7, 7, 0.30)',

  // Glass effects
  glass: 'rgba(244, 245, 246, 0.03)',
  glassMedium: 'rgba(244, 245, 246, 0.06)',
  glassStrong: 'rgba(244, 245, 246, 0.10)',

  // Shimmer (for skeleton loading)
  shimmer: 'rgba(244, 245, 246, 0.05)',
  shimmerHighlight: 'rgba(244, 245, 246, 0.10)',

  // Tab bar
  tabBar: 'rgba(4, 7, 7, 0.85)',
  tabBarBorder: 'rgba(244, 245, 246, 0.06)',

  // Input fields
  inputBg: 'rgba(244, 245, 246, 0.04)',
  inputBgFocus: 'rgba(244, 245, 246, 0.08)',

  // ─────────────────────────────────────────────────────────────────────────────
  // LEGACY ALIASES - For backward compatibility with existing components
  // ─────────────────────────────────────────────────────────────────────────────
  cardBg: '#141818',                 // Alias for surface
  cardBgLight: '#1A1F1F',            // Alias for surfaceElevated
  textMuted: '#7A7D7E',              // Alias for textTertiary
  surfaceHover: '#202626',           // Alias for surfaceHighlight
  borderLight: 'rgba(244, 245, 246, 0.05)', // Alias for borderSubtle

  // ─────────────────────────────────────────────────────────────────────────────
  // GRADIENTS (as arrays for LinearGradient)
  // ─────────────────────────────────────────────────────────────────────────────
  gradientGold: ['#F0CB7A', '#EABA58', '#C99A38'],
  gradientDark: ['#1A1F1F', '#0F1212', '#040707'],
  gradientCard: ['rgba(244,245,246,0.06)', 'rgba(244,245,246,0.02)'],
  gradientHero: ['#141818', '#0A0D0D', '#040707'],
  gradientSuccess: ['#34D399', '#059669'],
  gradientAccent: ['#8B5CF6', '#6366F1'],
};

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM LIGHT THEME - Warm, Institutional, Billion-Dollar Feel
// ═══════════════════════════════════════════════════════════════════════════════

export const LIGHT_COLORS = {
  // Backgrounds - Warm ivory per redesign spec
  background: '#FAF8F5',
  backgroundElevated: '#FFFDF9',
  backgroundSecondary: '#F5F2ED',

  // Surfaces - warm paper, highlight #F0EBE2 per spec
  surface: '#FFFDF9',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#F0EBE2',
  surfacePressed: '#EBE5D9',

  // Borders - warm ink at spec alphas (.10 / .07 / .16)
  border: 'rgba(24, 21, 16, 0.10)',
  borderSubtle: 'rgba(24, 21, 16, 0.07)',
  borderStrong: 'rgba(24, 21, 16, 0.16)',
  borderFocus: 'rgba(24, 21, 16, 0.25)',

  // Text - warm ink #181510 per spec
  text: '#181510',
  textPrimary: '#181510',
  textSecondary: '#57534A',
  textTertiary: '#8B8578',
  textDisabled: '#B5AFA3',
  textInverse: '#FAF8F5',

  // Brand Gold - fills stay #EABA58; gold-as-text uses #C99A38 for contrast.
  // `gold` is used as a text/icon color throughout the app, so it carries
  // the darker value; use gradientGold / goldLight for large fills.
  gold: '#C99A38',
  goldLight: '#EABA58',
  goldDark: '#A87C24',
  goldFill: '#EABA58',             // Gold as a fill (CTAs) — same in both themes
  goldSurface: 'rgba(234, 186, 88, 0.14)',
  goldSurfaceStrong: 'rgba(234, 186, 88, 0.24)',
  goldSurfaceIntense: 'rgba(234, 186, 88, 0.34)',
  goldGradientStart: '#F0CB7A',
  goldGradientMiddle: '#EABA58',
  goldGradientEnd: '#C99A38',

  // Side colors - Support/Oppose per light spec
  support: '#0E9F6E',
  supportSurface: 'rgba(14, 159, 110, 0.10)',
  oppose: '#DC2626',
  opposeSurface: 'rgba(220, 38, 38, 0.08)',

  // Semantic - per light spec
  success: '#0E9F6E',
  successLight: '#34D399',
  successDark: '#047857',
  successSurface: 'rgba(14, 159, 110, 0.10)',
  successSurfaceStrong: 'rgba(14, 159, 110, 0.16)',

  error: '#DC2626',
  errorLight: '#F87171',
  errorDark: '#B91C1C',
  errorSurface: 'rgba(220, 38, 38, 0.08)',
  errorSurfaceStrong: 'rgba(220, 38, 38, 0.15)',

  warning: '#B45309',
  warningLight: '#FBBF24',
  warningDark: '#92400E',
  warningSurface: 'rgba(180, 83, 9, 0.08)',
  warningSurfaceStrong: 'rgba(180, 83, 9, 0.15)',

  info: '#1D4ED8',
  infoLight: '#60A5FA',
  infoDark: '#1E40AF',
  infoSurface: 'rgba(29, 78, 216, 0.08)',
  infoSurfaceStrong: 'rgba(29, 78, 216, 0.15)',

  // Accent
  accent: '#7C3AED',
  accentSurface: 'rgba(124, 58, 237, 0.08)',
  cyan: '#0891B2',
  cyanSurface: 'rgba(8, 145, 178, 0.08)',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  overlay: 'rgba(24, 21, 16, 0.55)',
  overlayLight: 'rgba(24, 21, 16, 0.30)',
  overlayUltraLight: 'rgba(24, 21, 16, 0.15)',

  glass: 'rgba(255, 253, 249, 0.70)',
  glassMedium: 'rgba(255, 253, 249, 0.85)',
  glassStrong: 'rgba(255, 253, 249, 0.95)',

  shimmer: 'rgba(24, 21, 16, 0.05)',
  shimmerHighlight: 'rgba(24, 21, 16, 0.09)',

  tabBar: 'rgba(250, 248, 245, 0.96)',
  tabBarBorder: 'rgba(24, 21, 16, 0.08)',

  inputBg: 'rgba(24, 21, 16, 0.03)',
  inputBgFocus: 'rgba(24, 21, 16, 0.06)',

  // Legacy aliases for backward compatibility
  cardBg: '#FFFDF9',
  cardBgLight: '#F5F2ED',
  textMuted: '#8B8578',
  surfaceHover: '#F0EBE2',
  borderLight: 'rgba(24, 21, 16, 0.07)',

  gradientGold: ['#F0CB7A', '#EABA58', '#C99A38'],
  gradientDark: ['#FAF8F5', '#F5F2ED', '#EDE9E3'],
  gradientCard: ['rgba(30,25,20,0.02)', 'rgba(30,25,20,0.05)'],
  gradientHero: ['#FAF8F5', '#F5F2ED', '#EDE9E3'],
  gradientSuccess: ['#059669', '#047857'],
  gradientAccent: ['#7C3AED', '#6366F1'],
};

// Default export
export const COLORS = DARK_COLORS;

// ═══════════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY - Redesign type system
// Newsreader (serif): civic moments — display, screen titles, ballot questions
// Onest (sans): all UI — buttons, body, labels, eyebrows
// JetBrains Mono: EVERYTHING counted or recorded — tallies, IDs, timestamps
// ═══════════════════════════════════════════════════════════════════════════════

// Weight-specific static font families (loaded in app/_layout.tsx). Do not
// pair these with a fontWeight override — Android will substitute a
// synthesized face instead of the loaded file.
export const FONTS = {
  // Newsreader — civic serif
  serifRegular: 'Newsreader_400Regular',
  serif: 'Newsreader_500Medium',
  serifSemiBold: 'Newsreader_600SemiBold',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMediumItalic: 'Newsreader_500Medium_Italic',
  // Onest — UI sans
  sans: 'Onest_400Regular',
  sansMedium: 'Onest_500Medium',
  sansSemiBold: 'Onest_600SemiBold',
  sansBold: 'Onest_700Bold',
  // JetBrains Mono — counted & recorded
  monoRegular: 'JetBrainsMono_400Regular',
  mono: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
};

// Tabular numerals — apply to every mono style so counts never shift width.
const TNUM = { fontVariant: ['tabular-nums'] as any };

export const TYPOGRAPHY = {
  // ─────────────────────────────────────────────────────────────────────────────
  // DISPLAY - Newsreader 500 · 42–45 / 1.1 · -0.012em — hero civic moments
  // ─────────────────────────────────────────────────────────────────────────────
  displayLarge: {
    fontFamily: FONTS.serif,
    fontSize: 45,
    lineHeight: 50,
    letterSpacing: -0.54,
  },
  displayMedium: {
    fontFamily: FONTS.serif,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  displaySmall: {
    fontFamily: FONTS.serif,
    fontSize: 36,
    lineHeight: 41,
    letterSpacing: -0.43,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADLINES - Screen titles (serif 32–34) & ballot questions (serif 18–24)
  // ─────────────────────────────────────────────────────────────────────────────
  h1: {
    fontFamily: FONTS.serif,
    fontSize: 34,
    lineHeight: 39,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -0.25,
  },
  h3: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: 0,
  },
  h4: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
  },
  h5: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: 0,
  },
  h6: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },

  // Ballot question — serif 500, 18–24 / 1.25–1.32
  ballotQuestion: {
    fontFamily: FONTS.serif,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: 0,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // BODY - Onest 400 · 13–15 / 1.5–1.6
  // ─────────────────────────────────────────────────────────────────────────────
  bodyLarge: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    lineHeight: 25,
    letterSpacing: 0,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: 0,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // LABELS - Onest 600 · buttons & emphasis 13–17
  // ─────────────────────────────────────────────────────────────────────────────
  labelLarge: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.15,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // CAPTIONS & EYEBROWS - eyebrow: Onest 600 10–11 · +0.14em · uppercase
  // ─────────────────────────────────────────────────────────────────────────────
  caption: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  captionSmall: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  overline: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.54,
    textTransform: 'uppercase' as const,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 1.47,
    textTransform: 'uppercase' as const,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NUMBERS - JetBrains Mono, always tabular — tallies, stats, metrics
  // ─────────────────────────────────────────────────────────────────────────────
  numberLarge: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -0.5,
    ...TNUM,
  },
  numberMedium: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.3,
    ...TNUM,
  },
  numberSmall: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
    ...TNUM,
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // MONO - JetBrains Mono 500 · 10–12 — IDs, timestamps, hashes, ledger rows
  // ─────────────────────────────────────────────────────────────────────────────
  mono: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 17,
    ...TNUM,
  },
  monoSmall: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    lineHeight: 15,
    ...TNUM,
  },
  monoLabel: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
    ...TNUM,
  },

  // Legacy aliases for backward compatibility
  headlineLarge: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    lineHeight: 16,
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

  // Semantic aliases — redesign spec: 24px horizontal screen padding
  none: 0,
  px: 1,
  gutter: 24,           // Standard page gutter
  cardPadding: 20,      // Standard card padding
  sectionGap: 32,       // Gap between sections
  screenPadding: 24,    // Screen edge padding

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

  // Semantic — redesign spec: cards 16–22, buttons 14–16, chips pill (100)
  button: 14,
  card: 18,
  modal: 24,
  input: 14,
  badge: 8,
  chip: 100,
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
    shadowColor: '#EABA58',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },

  glowStrong: {
    shadowColor: '#EABA58',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 12,
  },

  glowSubtle: {
    shadowColor: '#EABA58',
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

  // Redesign motion tokens:
  // Instant — press feedback (scale .965 + light haptic)
  // Quick — sheets, tab/screen transitions
  // Deliberate — tally re-fill (never from zero), odometer roll, card commit
  // Momentous — the ballot seal (gold ring draws with the ledger write)
  motion: {
    instant: 120,
    quick: 240,
    deliberate: 480,
    momentous: 900,
  },

  // Named durations
  duration: {
    instant: 50,
    fast: 150,
    normal: 250,
    slow: 350,
    verySlow: 500,
    pageTransition: 240,
    modalEntry: 240,
    buttonPress: 120,
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
  // Redesign standard easing — cubic-bezier(.2, 0, 0, 1)
  standard: [0.2, 0, 0, 1] as const,
  // Ballot-seal checkmark overshoot — cubic-bezier(.34, 1.3, .5, 1)
  overshoot: [0.34, 1.3, 0.5, 1] as const,

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
