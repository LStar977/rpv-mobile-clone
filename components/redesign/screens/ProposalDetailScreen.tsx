// Redesign · Screen 06 (+ X1 confirm / 08 receipt) — Proposal Detail & Vote
// The heart of the core loop. Pre-vote shows the full ballot question + live
// tally + Support/Oppose. On cast it calls the real proposalsApi.submitVote()
// and transitions to the "recorded" receipt state. Ranked / multiple-choice
// proposals are NOT voted here (guards the audit's miscast bug) — they route to
// the dedicated ballot screen.
//
// Trust copy is honest: the ledger is PUBLIC + tamper-evident + one-per-person,
// not "secret" (the mockup's "secret until sealed" line is deliberately dropped).
import React, { useRef, useState } from 'react';
import { View, ScrollView, Animated, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { proposalsApi } from '../../../lib/api';
import { T, Eyebrow, Button, TrustChip, TallyBar } from '../index';
import { SPACE, RADIUS, SIDE, FONTS, MOTION } from '../../../lib/redesign';

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

  const checkScale = useRef(new Animated.Value(0.5)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

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
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(checkOpacity, { toValue: 1, duration: MOTION.tick, useNativeDriver: true }),
    ]).start();
  };

  // ─── RECEIPT STATE (screen 08) ───
  if (receipt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, flexGrow: 1, justifyContent: 'center' }}>
          <View style={{ alignItems: 'center', gap: SPACE.lg }}>
            <Animated.View
              style={{
                width: 84,
                height: 84,
                borderRadius: 42,
                backgroundColor: colors.goldSurface,
                borderWidth: 1,
                borderColor: colors.gold,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ scale: checkScale }],
                opacity: checkOpacity,
              }}
            >
              <T variant="heroSerif" color={colors.gold} style={{ fontSize: 40, lineHeight: 44 }}>✓</T>
            </Animated.View>
            <T variant="resultSerif" color={colors.text} style={{ textAlign: 'center' }}>
              Ballot recorded
            </T>
            <T variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
              Recorded on the public ledger · one person, one ballot · verifiable by anyone.
            </T>
          </View>

          {/* receipt block */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: RADIUS.card,
              borderWidth: 1,
              borderColor: colors.border,
              padding: SPACE.xl,
              gap: SPACE.md,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T variant="monoLabel" color={colors.textTertiary}>Your ballot</T>
              <T variant="monoData" color={receipt.side === 'support' ? SIDE.supportInk : colors.textSecondary}>
                {receipt.side === 'support' ? 'SUPPORT' : 'OPPOSE'}
              </T>
            </View>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T variant="monoLabel" color={colors.textTertiary}>Recorded</T>
              <T variant="monoData" color={colors.textSecondary}>{receipt.at}</T>
            </View>
            {receipt.ref ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.md }}>
                <T variant="monoLabel" color={colors.textTertiary}>Ledger ref</T>
                <T variant="monoData" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                  {receipt.ref.slice(0, 10)}…{receipt.ref.slice(-6)}
                </T>
              </View>
            ) : (
              <T variant="caption" color={colors.textTertiary}>Confirming on the ledger…</T>
            )}
          </View>

          {/* live tally after voting */}
          {isYesNo && <TallyBar support={support} oppose={oppose} />}

          <View style={{ gap: SPACE.sm }}>
            <Button label="Keep voting" onPress={() => router.back()} />
            <Button label="Done" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </SafeAreaView>
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
            <Button label="Verify to vote" onPress={() => router.push('/modals/verification-payment')} />
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
                router.push({ pathname: '/redesign-ballot', params: { proposalId, title, voteType } })
              }
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
