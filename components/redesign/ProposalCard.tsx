// The workhorse card — one design that handles yes/no, ranked, and multi-choice
// proposals across the feed, home, and org screens. Serif title (civic moment),
// scope + citizens chips, the signature tally bar, and a deadline/status line.
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../lib/theme';
import { T } from './Text';
import { TrustChip } from './TrustChip';
import { TallyBar } from './TallyBar';
import { RADIUS, SPACE } from '../../lib/redesign';

export interface ProposalCardData {
  id: string;
  title: string;
  scope?: string; // e.g. "Canada · Alberta"
  voteType?: 'yes-no' | 'ranked' | 'multiple-choice';
  requiresCitizenship?: boolean;
  supportVotes?: number;
  opposeVotes?: number;
  totalVotes?: number; // for ranked/multi where support/oppose don't apply
  closesLabel?: string; // e.g. "Closes in 3 days" / "Voting closed"
  closed?: boolean;
}

interface Props {
  data: ProposalCardData;
  onPress?: () => void;
}

export function ProposalCard({ data, onPress }: Props) {
  const { colors } = useTheme();
  const isYesNo = (data.voteType ?? 'yes-no') === 'yes-no';
  const total = data.totalVotes ?? (data.supportVotes ?? 0) + (data.opposeVotes ?? 0);

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: RADIUS.card,
          borderWidth: 1,
          borderColor: colors.border,
          padding: SPACE.xl,
          gap: SPACE.lg,
        }}
      >
        {/* chips row */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
          <TrustChip
            label={data.closed ? 'Voting closed' : 'Open for voting'}
            kind={data.closed ? 'closed' : 'open'}
            dot
          />
          {data.requiresCitizenship && <TrustChip label="Citizens only" kind="citizens" />}
          {data.scope ? <TrustChip label={data.scope} kind="neutral" /> : null}
        </View>

        {/* title — serif civic moment */}
        <T variant="proposalTitle" color={colors.text}>{data.title}</T>

        {/* tally — yes/no gets the bar; ranked/multi gets a count line */}
        {isYesNo ? (
          <TallyBar support={data.supportVotes ?? 0} oppose={data.opposeVotes ?? 0} compact />
        ) : (
          <T variant="monoData" color={colors.textTertiary}>
            {total > 0 ? `${total.toLocaleString()} verified ballots` : 'Polls are open — be the first verified ballot'}
          </T>
        )}

        {/* footer status */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T variant="caption" color={colors.textTertiary}>
            {data.closesLabel ?? (data.closed ? 'Voting closed' : 'Open')}
          </T>
          <T variant="caption" color={colors.gold}>View →</T>
        </View>
      </View>
    </Pressable>
  );
}
