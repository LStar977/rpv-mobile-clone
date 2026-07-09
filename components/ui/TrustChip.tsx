import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FONTS, RADIUS } from '../../lib/theme';

// ═══════════════════════════════════════════════════════════════════════════════
// TRUST CHIPS — pill chips for verification / scope / ledger provenance
// Variants from the redesign component library:
//   gold    — VERIFIED, REFERENDUM · Q3 (gold-tinted surface + gold border)
//   neutral — CALGARY · MUNICIPAL (highlight surface, no border)
//   outline — CITIZENS ONLY, ON THE PUBLIC LEDGER → (hairline border)
//   ledger  — bare mono caption, ONE PERSON · ONE BALLOT
// ═══════════════════════════════════════════════════════════════════════════════

type TrustChipVariant = 'gold' | 'neutral' | 'outline' | 'ledger';

interface TrustChipProps {
  label: string;
  variant?: TrustChipVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Use mono for recorded/ledger strings, sans for scope/status labels. */
  mono?: boolean;
  style?: ViewStyle;
}

export function TrustChip({
  label,
  variant = 'neutral',
  icon,
  mono = false,
  style,
}: TrustChipProps) {
  const { colors } = useTheme();

  const palette = {
    gold: {
      backgroundColor: colors.goldSurface,
      borderColor: 'rgba(234, 186, 88, 0.22)',
      borderWidth: 1,
      color: colors.gold,
    },
    neutral: {
      backgroundColor: colors.surfaceHighlight,
      borderColor: 'transparent',
      borderWidth: 0,
      color: colors.textSecondary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
      borderWidth: 1,
      color: colors.textTertiary,
    },
    ledger: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      color: colors.textTertiary,
    },
  }[variant];

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.chip,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          borderWidth: palette.borderWidth,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={11} color={palette.color} />}
      <Text
        style={[
          mono || variant === 'ledger' ? styles.monoLabel : styles.label,
          { color: palette.color },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
  },
  label: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  monoLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
  },
});
