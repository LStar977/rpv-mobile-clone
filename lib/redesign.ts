// ═══════════════════════════════════════════════════════════════════════════════
// REDESIGN DESIGN SYSTEM — "The Digital Ballot"
// ═══════════════════════════════════════════════════════════════════════════════
// Ported from the Claude Design redesign (content/handoff/app-redesign-brief.md).
// Type system: Newsreader (editorial serif) for civic moments, Onest for UI,
// JetBrains Mono for anything COUNTED — every tally, ID, and timestamp reads as a
// recorded fact. Colors come from lib/theme.ts (palette is unchanged); this module
// adds the typography scale + redesign-specific spacing/radius/motion tokens the
// new components and screens are built from.
//
// Font families are registered in app/_layout.tsx via expo-font. The names below
// MUST match the keys used there. On platforms/builds where the fonts haven't
// loaded yet, components fall back to the system font (see FONT_FALLBACK).

import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// FONT FAMILY NAMES (must match the keys in useFonts() in _layout.tsx)
// ─────────────────────────────────────────────────────────────────────────────
export const FONTS = {
  // Editorial serif — civic moments (hero numbers, proposal titles, results)
  serif: 'Newsreader-500',
  serifRegular: 'Newsreader-400',
  serifMedium: 'Newsreader-500',
  serifSemibold: 'Newsreader-600',

  // Humanist sans — all functional UI text
  sans: 'Onest-400',
  sansRegular: 'Onest-400',
  sansMedium: 'Onest-500',
  sansSemibold: 'Onest-600',
  sansBold: 'Onest-700',

  // Monospace — anything counted / recorded (tallies, IDs, timestamps, hashes)
  mono: 'JetBrainsMono-400',
  monoRegular: 'JetBrainsMono-400',
  monoMedium: 'JetBrainsMono-500',
  monoSemibold: 'JetBrainsMono-600',
} as const;

// Used before fonts finish loading, or if a build ships without them.
export const FONT_FALLBACK = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
}) as string;

// The full asset map for expo-font's useFonts(). Import this in _layout.tsx.
// (require() paths are relative to THIS file's directory → ../assets/fonts)
export const FONT_ASSETS = {
  'Newsreader-400': require('../assets/fonts/Newsreader-400.ttf'),
  'Newsreader-500': require('../assets/fonts/Newsreader-500.ttf'),
  'Newsreader-600': require('../assets/fonts/Newsreader-600.ttf'),
  'Onest-400': require('../assets/fonts/Onest-400.ttf'),
  'Onest-500': require('../assets/fonts/Onest-500.ttf'),
  'Onest-600': require('../assets/fonts/Onest-600.ttf'),
  'Onest-700': require('../assets/fonts/Onest-700.ttf'),
  'JetBrainsMono-400': require('../assets/fonts/JetBrainsMono-400.ttf'),
  'JetBrainsMono-500': require('../assets/fonts/JetBrainsMono-500.ttf'),
  'JetBrainsMono-600': require('../assets/fonts/JetBrainsMono-600.ttf'),
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPE SCALE — ported from the redesign mockups
// Note: RN has no `font:` shorthand and no automatic line-height from unit; every
// style carries explicit fontFamily / fontSize / lineHeight / letterSpacing.
// letterSpacing in RN is in px (not em), so em values from the mockup are
// converted at the given font size.
// ─────────────────────────────────────────────────────────────────────────────
export const TYPE = {
  // Editorial serif — the civic "moments"
  heroSerif: { fontFamily: FONTS.serifMedium, fontSize: 46, lineHeight: 50, letterSpacing: -0.6 },
  titleSerif: { fontFamily: FONTS.serifMedium, fontSize: 27, lineHeight: 30, letterSpacing: -0.3 },
  proposalTitle: { fontFamily: FONTS.serifMedium, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  resultSerif: { fontFamily: FONTS.serifSemibold, fontSize: 21, lineHeight: 26, letterSpacing: -0.2 },

  // UI sans
  h2: { fontFamily: FONTS.sansSemibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  bodyLg: { fontFamily: FONTS.sansRegular, fontSize: 16, lineHeight: 25 },
  body: { fontFamily: FONTS.sansRegular, fontSize: 14, lineHeight: 21 },
  bodyMedium: { fontFamily: FONTS.sansMedium, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: FONTS.sansRegular, fontSize: 12.5, lineHeight: 18 },
  button: { fontFamily: FONTS.sansSemibold, fontSize: 16, lineHeight: 20 },
  buttonSm: { fontFamily: FONTS.sansSemibold, fontSize: 13, lineHeight: 16 },

  // Eyebrow / section label — gold uppercase mono-ish (mockup uses Onest 600 caps)
  eyebrow: { fontFamily: FONTS.sansSemibold, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.5, textTransform: 'uppercase' as const },

  // Mono — anything counted / recorded
  tallyBig: { fontFamily: FONTS.monoMedium, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  tally: { fontFamily: FONTS.monoMedium, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  monoLabel: { fontFamily: FONTS.monoMedium, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  monoData: { fontFamily: FONTS.monoRegular, fontSize: 12, lineHeight: 16 },
  monoReceipt: { fontFamily: FONTS.monoMedium, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SPACING / RADIUS — the redesign's rhythm (mockup uses a 4px base, generous radii)
// ─────────────────────────────────────────────────────────────────────────────
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28, xxxl: 40 } as const;

export const RADIUS = {
  chip: 100, // pill
  button: 14,
  card: 18,
  sheet: 24,
  phone: 47, // device-frame corner in the mockup (not used in-app, kept for parity)
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// NEUTRAL PARTISAN PAIR — Support vs Oppose must read as EQUAL and NEUTRAL.
// Per the brief: gold is reserved for the ACT of voting / verified state, NEVER as
// a permanent color for one side. The current mockup fills Support in gold and
// Oppose as outline; these tokens are the seam to swap in a warm/cool neutral pair
// later (see the refinement prompt) without touching every screen. For now they
// alias the mockup's choices so the port is faithful; change HERE to restyle
// everywhere.
// ─────────────────────────────────────────────────────────────────────────────
export const SIDE = {
  supportFill: 'rgba(234,186,88,0.15)', // gold-tint (mockup)
  supportInk: '#EABA58',
  opposeFill: 'rgba(244,245,246,0.06)', // neutral surface (mockup)
  opposeInk: '#B8BABB',
  // tally bar segments
  supportBar: '#EABA58',
  opposeBar: 'rgba(244,245,246,0.14)',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// MOTION — durations (ms) matching the mockup's keyframes, for Animated/Reanimated
// ─────────────────────────────────────────────────────────────────────────────
export const MOTION = {
  press: 180, // rv-press button press
  commit: 900, // rv-commit ballot lift+seal
  seal: 1400, // rv-seal stroke draw
  tick: 700, // rv-tickup tally count
} as const;
