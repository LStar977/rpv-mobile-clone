// Redesign · Screen 16 — Voting history
// The record of proposals the user has voted on. Cross-references
// userApi.getVotedProposals() (ids) against proposalsApi.getAll() to show the
// full cards. Real loading / error / empty states.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { userApi, proposalsApi, type Proposal } from '../../../lib/api';
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
    closesLabel: closed ? 'Closed' : 'Open',
    closed,
  };
}

export function VotingHistoryScreen() {
  const { colors } = useTheme();
  const [voted, setVoted] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [ids, all] = await Promise.all([userApi.getVotedProposals(), proposalsApi.getAll()]);
    if (ids.error || all.error) {
      setError(ids.error || all.error);
      return;
    }
    const votedSet = new Set((ids.data ?? []).map(String));
    setVoted((all.data ?? []).filter((p) => votedSet.has(String(p.id))));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.lg, paddingBottom: 60 }}>
        <View style={{ gap: SPACE.xs, marginBottom: SPACE.sm }}>
          <Eyebrow>History</Eyebrow>
          <T variant="titleSerif" color={colors.text}>Ballots you've cast</T>
        </View>

        {voted === null && !error && (
          <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={colors.gold} /></View>
        )}
        {error && (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: SPACE.lg }}>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>{error}</T>
            <Button label="Try again" variant="secondary" fullWidth={false} onPress={load} />
          </View>
        )}
        {voted !== null && voted.length === 0 && (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: SPACE.md }}>
            <T variant="proposalTitle" color={colors.text} style={{ textAlign: 'center' }}>No ballots yet</T>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>Proposals you vote on will appear here.</T>
            <Button label="Find proposals" onPress={() => router.push('/redesign-feed')} />
          </View>
        )}
        {voted?.map((p) => (
          <ProposalCard
            key={String(p.id)}
            data={toCard(p)}
            onPress={() => router.push({ pathname: '/redesign-results', params: { proposalId: String(p.id), title: p.title } })}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
