// Trust / status chips — the recurring "trust is UI, not copy" primitive.
// Verified mark, citizens-only, scope (region), open/closed, on-the-ledger.
// A pill with an optional leading dot/glyph. Kinds map to token colors.
import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';
import { T } from './Text';
import { RADIUS } from '../../lib/redesign';

type Kind = 'gold' | 'neutral' | 'open' | 'closed' | 'citizens';

interface Props {
  label: string;
  kind?: Kind;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TrustChip({ label, kind = 'neutral', dot = false, style }: Props) {
  const { colors } = useTheme();

  const map: Record<Kind, { bg: string; fg: string; dot: string; border?: string }> = {
    gold: { bg: colors.goldSurface, fg: colors.gold, dot: colors.gold, border: colors.goldSurfaceStrong },
    citizens: { bg: colors.goldSurface, fg: colors.gold, dot: colors.gold, border: colors.goldSurfaceStrong },
    neutral: { bg: colors.glassMedium, fg: colors.textSecondary, dot: colors.textTertiary },
    open: { bg: colors.successSurface, fg: colors.success, dot: colors.success },
    closed: { bg: colors.glassMedium, fg: colors.textTertiary, dot: colors.textTertiary },
  };
  const c = map[kind];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: RADIUS.chip,
          backgroundColor: c.bg,
          borderWidth: c.border ? 1 : 0,
          borderColor: c.border,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }} />}
      <T variant="monoLabel" color={c.fg}>{label}</T>
    </View>
  );
}
