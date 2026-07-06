// Redesign · Screen 09 — Results
// The payoff. Fetches proposalsApi.getResults() and renders the right viz for the
// proposal's vote type: yes/no → the signature tally bar; multiple-choice → a
// ranked list of proportion bars; ranked-choice → winner + ballot count. Handles
// loading / error and the low-N (0 ballots) launch state.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { proposalsApi } from '../../../lib/api';
import { T, Eyebrow, Button, TallyBar } from '../index';
import { SPACE, RADIUS, SIDE, FONTS } from '../../../lib/redesign';

function OptionBar({ label, count, total }: { label: string; count: number; total: number }) {
  const { colors } = useTheme();
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={{ gap: SPACE.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T variant="bodyMedium" color={colors.text} style={{ flex: 1 }}>{label}</T>
        <T variant="monoData" color={colors.textSecondary} style={{ fontFamily: FONTS.monoMedium }}>{pct}%</T>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: SIDE.opposeBar, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: SIDE.supportBar }} />
      </View>
    </View>
  );
}

export function ResultsScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ proposalId?: string; title?: string }>();
  const proposalId = params.proposalId ?? '';
  const title = params.title ?? 'Results';

  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await proposalsApi.getResults(proposalId);
    if (res.error) setError(res.error);
    else setData(res.data);
  }, [proposalId]);

  useEffect(() => {
    load();
  }, [load]);

  const type = data?.type as string | undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 40 }}>
        <View style={{ gap: SPACE.sm }}>
          <Eyebrow>Live results</Eyebrow>
          <T variant="proposalTitle" color={colors.text}>{title}</T>
        </View>

        {data === null && !error && (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}

        {error && (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: SPACE.lg }}>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>{error}</T>
            <Button label="Try again" variant="secondary" fullWidth={false} onPress={load} />
          </View>
        )}

        {/* yes/no */}
        {type === 'yes-no' && (
          <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl }}>
            <TallyBar support={data.supportVotes ?? 0} oppose={data.opposeVotes ?? 0} />
          </View>
        )}

        {/* multiple-choice */}
        {type === 'multiple-choice' && (
          <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.lg }}>
            {(() => {
              const opts: string[] = data.options ?? [];
              const counts: number[] = data.counts ?? [];
              const total = counts.reduce((a: number, b: number) => a + b, 0);
              if (total === 0) return <T variant="body" color={colors.textTertiary}>Polls are open — no ballots counted yet.</T>;
              return opts.map((o, i) => <OptionBar key={o} label={o} count={counts[i] ?? 0} total={total} />);
            })()}
          </View>
        )}

        {/* ranked-choice */}
        {type === 'ranked-choice' && (
          <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.md }}>
            <Eyebrow>Winner</Eyebrow>
            <T variant="resultSerif" color={colors.text}>{data.winner ?? '—'}</T>
            <T variant="monoData" color={colors.textTertiary}>
              {(data.totalBallots ?? 0).toLocaleString()} ranked ballots
              {data.winningRound ? ` · decided in round ${data.winningRound}` : ''}
            </T>
          </View>
        )}

        {data && !error && (
          <T variant="caption" color={colors.textTertiary} style={{ textAlign: 'center' }}>
            Every ballot is verified and recorded on the public ledger.
          </T>
        )}

        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}
