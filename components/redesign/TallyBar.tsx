// The signature results visualization — reused everywhere a vote count appears
// (feed cards, proposal detail, results, referendum board). A proportion bar with
// mono numbers. Support/Oppose colors come from the SIDE tokens (lib/redesign.ts)
// so a future neutral-pair restyle is a one-file change.
//
// Handles the low-N (launch morning) state gracefully: at 0 ballots it shows a
// calm "Polls are open" track instead of a broken 0%/0% bar.
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../lib/theme';
import { T } from './Text';
import { SIDE, SPACE, FONTS } from '../../lib/redesign';

interface Props {
  support: number;
  oppose: number;
  supportLabel?: string;
  opposeLabel?: string;
  emptyLabel?: string; // shown at 0 ballots
  compact?: boolean; // feed-card density
}

export function TallyBar({
  support,
  oppose,
  supportLabel = 'Support',
  opposeLabel = 'Oppose',
  emptyLabel = 'Polls are open — be the first verified ballot',
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const total = support + oppose;
  const pct = total > 0 ? Math.round((support / total) * 100) : 0;
  const barH = compact ? 8 : 10;

  if (total === 0) {
    return (
      <View style={{ gap: SPACE.sm }}>
        <View style={{ height: barH, borderRadius: barH / 2, backgroundColor: SIDE.opposeBar }} />
        <T variant="caption" color={colors.textTertiary}>{emptyLabel}</T>
      </View>
    );
  }

  return (
    <View style={{ gap: compact ? SPACE.xs : SPACE.sm }}>
      {/* Top row: labels + percentages (color always paired with text) */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T variant={compact ? 'caption' : 'bodyMedium'} color={colors.text}>
          {supportLabel} <T variant={compact ? 'caption' : 'bodyMedium'} color={SIDE.supportInk} style={{ fontFamily: FONTS.monoMedium }}>{pct}%</T>
        </T>
        <T variant={compact ? 'caption' : 'bodyMedium'} color={colors.textSecondary}>
          {opposeLabel} <T variant={compact ? 'caption' : 'bodyMedium'} color={colors.textSecondary} style={{ fontFamily: FONTS.monoMedium }}>{100 - pct}%</T>
        </T>
      </View>

      {/* The proportion bar — two segments, rounded ends */}
      <View style={{ height: barH, borderRadius: barH / 2, overflow: 'hidden', flexDirection: 'row', backgroundColor: SIDE.opposeBar }}>
        <View style={{ width: `${pct}%`, backgroundColor: SIDE.supportBar }} />
      </View>

      {/* Total, mono — "this is a counted fact" */}
      {!compact && (
        <T variant="monoData" color={colors.textTertiary}>
          {total.toLocaleString()} verified ballots
        </T>
      )}
    </View>
  );
}
