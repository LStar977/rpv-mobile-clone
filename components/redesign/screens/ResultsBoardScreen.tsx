// Redesign · Screen 09b — Results board (the Results tab)
// Lists proposals with their live tallies; tapping opens the single-proposal
// ResultsScreen. Doubles as the Shadow Referendum board. Wired to proposalsApi.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { proposalsApi, type Proposal } from '../../../lib/api';
import { T, Eyebrow, Button, ProposalCard, type ProposalCardData } from '../index';
import { SPACE } from '../../../lib/redesign';

function toCard(p: Proposal): ProposalCardData {
  const geo = Array.isArray(p.geoRestrictions) ? p.geoRestrictions : [];
  const closed = p.deadline ? new Date(p.deadline).getTime() < Date.now() : false;
  return {
    id: String(p.id),
    title: p.title,
    scope: geo.length ? geo[geo.length - 1] : 'Global',
    voteType: (p.voteType as ProposalCardData['voteType']) ?? 'yes-no',
    requiresCitizenship: !!p.requiresCitizenship,
    supportVotes: p.supportVotes ?? 0,
    opposeVotes: p.opposeVotes ?? 0,
    closesLabel: closed ? 'Voting closed' : 'Live',
    closed,
  };
}

export function ResultsBoardScreen() {
  const { colors } = useTheme();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await proposalsApi.getAll();
    if (res.error) setError(res.error);
    else setProposals(res.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openResults = (p: Proposal) =>
    router.push({
      pathname: '/redesign-results',
      params: {
        proposalId: String(p.id),
        title: p.title,
        support: String(p.supportVotes ?? 0),
        oppose: String(p.opposeVotes ?? 0),
        voteType: (p.voteType as string) ?? 'yes-no',
      },
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        <View style={{ gap: SPACE.xs, marginBottom: SPACE.sm }}>
          <Eyebrow>Results</Eyebrow>
          <T variant="titleSerif" color={colors.text}>Where verified voters stand</T>
        </View>

        {proposals === null && !error && (
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

        {proposals !== null && proposals.length === 0 && (
          <T variant="body" color={colors.textTertiary}>No proposals to show yet.</T>
        )}

        {proposals?.map((p) => (
          <ProposalCard key={String(p.id)} data={toCard(p)} onPress={() => openResults(p)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
