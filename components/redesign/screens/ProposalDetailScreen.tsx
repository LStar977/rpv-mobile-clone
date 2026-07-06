// Redesign · Screen 06 (+ X1 confirm / 08 receipt) — Proposal Detail & Vote
// The heart of the core loop. Pre-vote shows the full ballot question + live
// tally + Support/Oppose. On cast it calls the real proposalsApi.submitVote()
// and transitions to the "recorded" receipt state. Ranked / multiple-choice
// proposals are NOT voted here (guards the audit's miscast bug) — they route to
// the dedicated ballot screen.
//
// Trust copy is honest: the ledger is PUBLIC + tamper-evident + one-per-person,
// not "secret" (the mockup's "secret until sealed" line is deliberately dropped).
import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { proposalsApi } from '../../../lib/api';
import { T, Eyebrow, Button, TrustChip, TallyBar, VoteReceipt } from '../index';
import { SPACE, RADIUS, SIDE, FONTS } from '../../../lib/redesign';

type Side = 'support' | 'oppose';

export function ProposalDetailScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    proposalId?: string;
    title?: string;
    description?: string;
    scope?: string;
    voteType?: string;
    requiresCitizenship?: string;
    support?: string;
    oppose?: string;
    closed?: string;
    options?: string;
  }>();

  const proposalId = params.proposalId ?? '';
  const title = params.title ?? 'Proposal';
  const description = params.description ?? '';
  const scope = params.scope ?? 'Global';
  const voteType = (params.voteType ?? 'yes-no') as string;
  const requiresCitizenship = params.requiresCitizenship === 'true';
  const closed = params.closed === 'true';
  const isYesNo = voteType === 'yes-no';

  const [support, setSupport] = useState(Number(params.support ?? 0));
  const [oppose, setOppose] = useState(Number(params.oppose ?? 0));
  const [busy, setBusy] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [receipt, setReceipt] = useState<{ side: Side; ref?: string; at: string } | null>(null);

  const cast = async (side: Side) => {
    if (busy || closed) return;
    setBusy(side);
    setError(null);
    const res = await proposalsApi.submitVote(proposalId, side);
    setBusy(null);
    if (res.requiresVerification) {
      setNeedsVerify(true);
      return;
    }
    if (res.error) {
      setError(res.error);
      return;
    }
    // optimistic tally bump + receipt
    if (side === 'support') setSupport((n) => n + 1);
    else setOppose((n) => n + 1);
    const now = new Date();
    setReceipt({
      side,
      ref: res.data?.txHash,
      at: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    });
  };

  // ─── RECEIPT STATE (screen 08) ───
  if (receipt) {
    return (
      <VoteReceipt
        choiceRows={[{ label: 'Your ballot', value: receipt.side === 'support' ? 'SUPPORT' : 'OPPOSE', emphasize: receipt.side === 'support' }]}
        ledgerRef={receipt.ref}
        recordedAt={receipt.at}
      >
        {isYesNo ? <TallyBar support={support} oppose={oppose} /> : null}
      </VoteReceipt>
    );
  }

  // ─── PRE-VOTE STATE (screen 06a) ───
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.lg, paddingBottom: 40 }}>
        {/* back */}
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
          <T variant="bodyMedium" color={colors.textTertiary}>← Back</T>
        </Pressable>

        {/* chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
          <TrustChip label={closed ? 'Voting closed' : 'Open for voting'} kind={closed ? 'closed' : 'open'} dot />
          {requiresCitizenship && <TrustChip label="Citizens only" kind="citizens" />}
          <TrustChip label={scope} kind="neutral" />
        </View>

        {/* eyebrow + serif title */}
        <View style={{ gap: SPACE.sm }}>
          <Eyebrow>The question</Eyebrow>
          <T variant="proposalTitle" color={colors.text}>{title}</T>
        </View>

        {/* full ballot text */}
        {!!description && (
          <T variant="bodyLg" color={colors.textSecondary}>{description}</T>
        )}

        {/* current tally */}
        {isYesNo && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: RADIUS.card,
              borderWidth: 1,
              borderColor: colors.border,
              padding: SPACE.xl,
            }}
          >
            <TallyBar support={support} oppose={oppose} />
          </View>
        )}

        {/* verification gate */}
        {needsVerify && (
          <View style={{ backgroundColor: colors.goldSurface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.gold, padding: SPACE.xl, gap: SPACE.md }}>
            <T variant="bodyMedium" color={colors.text}>Verify your identity to cast a verified ballot.</T>
            <Button label="Verify to vote" onPress={() => router.push('/redesign-verify')} />
          </View>
        )}

        {/* error */}
        {error && <T variant="body" color={colors.error}>{error}</T>}

        {/* CAST — yes/no only; ranked/multi routes to the full ballot */}
        {!closed && isYesNo && !needsVerify && (
          <View style={{ gap: SPACE.sm, marginTop: SPACE.sm }}>
            <Pressable onPress={() => cast('support')} disabled={!!busy}>
              <View
                style={{
                  height: 58,
                  borderRadius: RADIUS.button,
                  backgroundColor: SIDE.supportFill,
                  borderWidth: 1,
                  borderColor: SIDE.supportInk,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy && busy !== 'support' ? 0.4 : 1,
                }}
              >
                <T variant="button" color={SIDE.supportInk} style={{ fontFamily: FONTS.sansSemibold }}>
                  {busy === 'support' ? 'Recording…' : 'Support'}
                </T>
              </View>
            </Pressable>
            <Pressable onPress={() => cast('oppose')} disabled={!!busy}>
              <View
                style={{
                  height: 58,
                  borderRadius: RADIUS.button,
                  backgroundColor: SIDE.opposeFill,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: busy && busy !== 'oppose' ? 0.4 : 1,
                }}
              >
                <T variant="button" color={colors.text} style={{ fontFamily: FONTS.sansSemibold }}>
                  {busy === 'oppose' ? 'Recording…' : 'Oppose'}
                </T>
              </View>
            </Pressable>
            <T variant="caption" color={colors.textTertiary} style={{ textAlign: 'center', marginTop: SPACE.xs }}>
              One person, one ballot · recorded on the public ledger
            </T>
          </View>
        )}

        {/* ranked / multiple-choice guard */}
        {!closed && !isYesNo && (
          <View style={{ gap: SPACE.md, marginTop: SPACE.sm }}>
            <T variant="caption" color={colors.textTertiary}>
              This proposal uses a {voteType === 'ranked' ? 'ranked-choice' : 'multiple-choice'} ballot.
            </T>
            <Button
              label="Open the full ballot"
              onPress={() =>
                router.push({ pathname: '/redesign-ballot', params: { proposalId, title, voteType, options: params.options ?? '[]' } })
              }
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
