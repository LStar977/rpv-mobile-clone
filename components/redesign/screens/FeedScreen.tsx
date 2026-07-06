// Redesign · Screen 05 — Proposal Feed
// Fully wired: consumes proposalsApi.getAll(), scoped to the signed-in user, with
// real loading / error / empty states (the audit flagged the old screens rendering
// API errors as empty "be the first!" states — this one distinguishes them).
// Navigates to the existing proposal-detail route so voting keeps working.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { proposalsApi, type Proposal } from '../../../lib/api';
import { T, Eyebrow, Button, ProposalCard, type ProposalCardData } from '../index';
import { SPACE } from '../../../lib/redesign';

function deadlineLabel(deadline: string | null): { label: string; closed: boolean } {
  if (!deadline) return { label: 'Open', closed: false };
  const ms = new Date(deadline).getTime() - Date.now();
  if (isNaN(ms)) return { label: 'Open', closed: false };
  if (ms <= 0) return { label: 'Voting closed', closed: true };
  const days = Math.ceil(ms / 86400000);
  return { label: days <= 1 ? 'Closes today' : `Closes in ${days} days`, closed: false };
}

function toCard(p: Proposal): ProposalCardData {
  const { label, closed } = deadlineLabel(p.deadline);
  const geo = Array.isArray(p.geoRestrictions) ? p.geoRestrictions : [];
  return {
    id: String(p.id),
    title: p.title,
    scope: geo.length ? geo[geo.length - 1] : 'Global',
    voteType: (p.voteType as ProposalCardData['voteType']) ?? 'yes-no',
    requiresCitizenship: !!p.requiresCitizenship,
    supportVotes: p.supportVotes ?? 0,
    opposeVotes: p.opposeVotes ?? 0,
    closesLabel: label,
    closed,
  };
}

export function FeedScreen() {
  const { colors } = useTheme();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await proposalsApi.getAll();
    if (res.error) {
      setError(res.error);
      setProposals(null);
    } else {
      setProposals(res.data ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openProposal = (p: Proposal) =>
    router.push({
      pathname: '/modals/proposal-detail',
      params: {
        proposalId: String(p.id),
        title: p.title,
        description: p.description,
        category: p.category,
      },
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* header */}
        <View style={{ gap: SPACE.xs, marginBottom: SPACE.sm }}>
          <Eyebrow>Vote</Eyebrow>
          <T variant="titleSerif" color={colors.text}>Open for your verified voice</T>
        </View>

        {/* loading */}
        {proposals === null && !error && (
          <View style={{ paddingTop: 80, alignItems: 'center' }}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}

        {/* error (distinct from empty) */}
        {error && (
          <View style={{ paddingTop: 60, alignItems: 'center', gap: SPACE.lg }}>
            <T variant="proposalTitle" color={colors.text} style={{ textAlign: 'center' }}>
              Couldn't load proposals
            </T>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>
              {error}
            </T>
            <Button label="Try again" variant="secondary" fullWidth={false} onPress={load} />
          </View>
        )}

        {/* empty (genuinely no proposals) */}
        {proposals !== null && proposals.length === 0 && (
          <View style={{ paddingTop: 60, alignItems: 'center', gap: SPACE.sm }}>
            <T variant="proposalTitle" color={colors.text} style={{ textAlign: 'center' }}>
              No open proposals in your area yet
            </T>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>
              When a proposal opens for your verified region, it appears here.
            </T>
          </View>
        )}

        {/* list */}
        {proposals?.map((p) => (
          <ProposalCard key={String(p.id)} data={toCard(p)} onPress={() => openProposal(p)} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
