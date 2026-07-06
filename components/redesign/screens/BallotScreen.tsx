// Redesign · Screen 07 — Ranked / Multiple-choice ballot
// A distinct, unmistakable ballot for non-yes/no proposals (so nothing is ever
// miscast as binary — the audit's swipe bug). Multiple-choice = single select.
// Ranked = tap options in order to assign 1st/2nd/3rd (tap again to unrank) — a
// reliable no-drag interaction. Submits via proposalsApi.submitVote() with the
// right position + extras, then shows the shared VoteReceipt.
import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { proposalsApi } from '../../../lib/api';
import { T, Eyebrow, Button, VoteReceipt } from '../index';
import { SPACE, RADIUS, FONTS } from '../../../lib/redesign';

export function BallotScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    proposalId?: string;
    title?: string;
    voteType?: string;
    options?: string;
  }>();

  const proposalId = params.proposalId ?? '';
  const title = params.title ?? 'Proposal';
  const isRanked = (params.voteType ?? 'multiple-choice') === 'ranked';
  const options: string[] = useMemo(() => {
    try {
      const parsed = JSON.parse(params.options ?? '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, [params.options]);

  const [selected, setSelected] = useState<string | null>(null); // multiple-choice
  const [ranking, setRanking] = useState<string[]>([]); // ranked
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [receipt, setReceipt] = useState<{ rows: { label: string; value: string; emphasize?: boolean }[]; ref?: string; at: string } | null>(null);

  const toggleRank = (opt: string) => {
    setRanking((r) => (r.includes(opt) ? r.filter((o) => o !== opt) : [...r, opt]));
  };

  const canSubmit = isRanked ? ranking.length > 0 : selected !== null;

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const res = isRanked
      ? await proposalsApi.submitVote(proposalId, 'ranked-choice', { rankings: ranking })
      : await proposalsApi.submitVote(proposalId, 'multiple-choice', { selectedOption: selected! });
    setBusy(false);
    if (res.requiresVerification) return setNeedsVerify(true);
    if (res.error) return setError(res.error);
    const now = new Date();
    const rows = isRanked
      ? ranking.map((o, i) => ({ label: `Rank ${i + 1}`, value: o, emphasize: i === 0 }))
      : [{ label: 'Your choice', value: selected!, emphasize: true }];
    setReceipt({ rows, ref: res.data?.txHash, at: `${now.toISOString().slice(0, 16).replace('T', ' ')} UTC` });
  };

  if (receipt) {
    return <VoteReceipt choiceRows={receipt.rows} ledgerRef={receipt.ref} recordedAt={receipt.at} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.lg, paddingBottom: 40 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ alignSelf: 'flex-start' }}>
          <T variant="bodyMedium" color={colors.textTertiary}>← Back</T>
        </Pressable>

        <View style={{ gap: SPACE.sm }}>
          <Eyebrow>{isRanked ? 'Rank your choices' : 'Choose one'}</Eyebrow>
          <T variant="proposalTitle" color={colors.text}>{title}</T>
          <T variant="caption" color={colors.textTertiary}>
            {isRanked
              ? 'Tap options in order of preference. Tap again to remove. Your 1st choice is counted first.'
              : 'Select the option you support. One person, one ballot.'}
          </T>
        </View>

        {options.length === 0 && (
          <T variant="body" color={colors.textTertiary}>No options available for this ballot.</T>
        )}

        <View style={{ gap: SPACE.sm }}>
          {options.map((opt) => {
            const rank = ranking.indexOf(opt);
            const isSel = isRanked ? rank >= 0 : selected === opt;
            return (
              <Pressable key={opt} onPress={() => (isRanked ? toggleRank(opt) : setSelected(opt))} disabled={busy}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: SPACE.md,
                    minHeight: 56,
                    paddingHorizontal: SPACE.lg,
                    paddingVertical: SPACE.md,
                    borderRadius: RADIUS.button,
                    backgroundColor: isSel ? colors.goldSurface : colors.surface,
                    borderWidth: 1,
                    borderColor: isSel ? colors.gold : colors.border,
                  }}
                >
                  {/* rank badge / radio */}
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      borderWidth: isSel ? 0 : 1.5,
                      borderColor: colors.borderStrong,
                      backgroundColor: isSel ? colors.gold : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSel && (
                      <T variant="monoData" color={colors.textInverse} style={{ fontFamily: FONTS.monoSemibold }}>
                        {isRanked ? String(rank + 1) : '✓'}
                      </T>
                    )}
                  </View>
                  <T variant="bodyLg" color={colors.text} style={{ flex: 1 }}>{opt}</T>
                </View>
              </Pressable>
            );
          })}
        </View>

        {needsVerify && (
          <View style={{ backgroundColor: colors.goldSurface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.gold, padding: SPACE.xl, gap: SPACE.md }}>
            <T variant="bodyMedium" color={colors.text}>Verify your identity to cast a verified ballot.</T>
            <Button label="Verify to vote" onPress={() => router.push('/modals/verification-payment')} />
          </View>
        )}
        {error && <T variant="body" color={colors.error}>{error}</T>}

        {!needsVerify && (
          <Button
            label={isRanked ? `Cast ranked ballot (${ranking.length})` : 'Cast ballot'}
            onPress={submit}
            disabled={!canSubmit}
            loading={busy}
            style={{ marginTop: SPACE.sm }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
