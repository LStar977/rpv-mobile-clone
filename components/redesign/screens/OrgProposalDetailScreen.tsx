// Redesign · Organization proposal detail + vote
// Org proposals are yes/no and vote through organizationsApi.voteOnProposal()
// (not the global submitVote). Shows the ballot, the live tally, and — if the
// member already voted — a read-only "you voted" state. Shares VoteReceipt.
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { organizationsApi } from '../../../lib/api';
import { T, Eyebrow, TrustChip, TallyBar, VoteReceipt, BackBar } from '../index';
import { SPACE, RADIUS, SIDE, FONTS } from '../../../lib/redesign';

type Side = 'support' | 'oppose';

export function OrgProposalDetailScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    orgId?: string;
    proposalId?: string;
    title?: string;
    description?: string;
    support?: string;
    oppose?: string;
    userVote?: string;
    official?: string;
  }>();

  const orgId = params.orgId ?? '';
  const proposalId = params.proposalId ?? '';
  const title = params.title ?? 'Proposal';
  const description = params.description ?? '';
  const official = params.official === 'true';

  const [support, setSupport] = useState(Number(params.support ?? 0));
  const [oppose, setOppose] = useState(Number(params.oppose ?? 0));
  const [voted, setVoted] = useState<Side | ''>((params.userVote as Side) || '');
  const [busy, setBusy] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ side: Side; at: string } | null>(null);

  const cast = async (side: Side) => {
    if (busy || voted) return;
    setBusy(side);
    setError(null);
    const res = await organizationsApi.voteOnProposal(orgId, proposalId, side);
    setBusy(null);
    if (res.error) return setError(res.error);
    if (res.data) {
      setSupport(res.data.supportVotes ?? support + (side === 'support' ? 1 : 0));
      setOppose(res.data.opposeVotes ?? oppose + (side === 'oppose' ? 1 : 0));
    }
    setVoted(side);
    const now = new Date();
    setReceipt({ side, at: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC` });
  };

  if (receipt) {
    return (
      <VoteReceipt
        choiceRows={[{ label: 'Your ballot', value: receipt.side === 'support' ? 'SUPPORT' : 'OPPOSE', emphasize: receipt.side === 'support' }]}
        recordedAt={receipt.at}
      >
        <TallyBar support={support} oppose={oppose} />
      </VoteReceipt>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <BackBar />
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.lg, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
          {official && <TrustChip label="Official" kind="citizens" />}
          {voted ? <TrustChip label={`You voted ${voted}`} kind="gold" dot /> : <TrustChip label="Open for voting" kind="open" dot />}
        </View>

        <View style={{ gap: SPACE.sm }}>
          <Eyebrow>The question</Eyebrow>
          <T variant="proposalTitle" color={colors.text}>{title}</T>
        </View>

        {!!description && <T variant="bodyLg" color={colors.textSecondary}>{description}</T>}

        <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl }}>
          <TallyBar support={support} oppose={oppose} />
        </View>

        {error && <T variant="body" color={colors.error}>{error}</T>}

        {voted ? (
          <T variant="caption" color={colors.textTertiary} style={{ textAlign: 'center' }}>
            You’ve already cast your ballot in this organization vote.
          </T>
        ) : (
          <View style={{ gap: SPACE.sm, marginTop: SPACE.sm }}>
            <Pressable onPress={() => cast('support')} disabled={!!busy}>
              <View style={{ height: 58, borderRadius: RADIUS.button, backgroundColor: SIDE.supportFill, borderWidth: 1, borderColor: SIDE.supportInk, alignItems: 'center', justifyContent: 'center', opacity: busy && busy !== 'support' ? 0.4 : 1 }}>
                <T variant="button" color={SIDE.supportInk} style={{ fontFamily: FONTS.sansSemibold }}>{busy === 'support' ? 'Recording…' : 'Support'}</T>
              </View>
            </Pressable>
            <Pressable onPress={() => cast('oppose')} disabled={!!busy}>
              <View style={{ height: 58, borderRadius: RADIUS.button, backgroundColor: SIDE.opposeFill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: busy && busy !== 'oppose' ? 0.4 : 1 }}>
                <T variant="button" color={colors.text} style={{ fontFamily: FONTS.sansSemibold }}>{busy === 'oppose' ? 'Recording…' : 'Oppose'}</T>
              </View>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
