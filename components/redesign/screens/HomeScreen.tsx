// Redesign · Screen 04 — Home / Vote (the tab entry)
// The first thing a verified citizen sees: their verified status, the countdown
// to the Oct-19 referendum, and the proposals open to them right now. Wired to
// the auth store (verified state) + proposalsApi. "See all" and each card lead
// into the same Feed → Detail → vote flow.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../lib/auth';
import { proposalsApi, type Proposal } from '../../../lib/api';
import { T, Eyebrow, Button, TrustChip, ProposalCard, type ProposalCardData } from '../index';
import { SPACE, RADIUS, FONTS } from '../../../lib/redesign';

// The launch moment. Countdown is illustrative brand furniture, not a hard gate.
const REFERENDUM = new Date('2026-10-19T00:00:00-06:00'); // Alberta (MDT)

function daysUntil(target: Date): number {
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000));
}

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

export function HomeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [featured, setFeatured] = useState<Proposal[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const verified = !!user?.verified;
  const region = [user?.city, user?.state].filter(Boolean).join(', ') || user?.country || 'Your region';
  const days = daysUntil(REFERENDUM);

  const load = useCallback(async () => {
    const res = await proposalsApi.getFeatured();
    if (!res.error && res.data) setFeatured(res.data.slice(0, 3));
    else {
      // fall back to the full list if there's no featured endpoint data
      const all = await proposalsApi.getAll();
      setFeatured(all.data ? all.data.slice(0, 3) : []);
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

  const openProposal = (p: Proposal) => {
    const geo = Array.isArray(p.geoRestrictions) ? p.geoRestrictions : [];
    const { closed } = deadlineLabel(p.deadline);
    router.push({
      pathname: '/redesign-proposal',
      params: {
        proposalId: String(p.id),
        title: p.title,
        description: p.description,
        scope: geo.length ? geo[geo.length - 1] : 'Global',
        voteType: (p.voteType as string) ?? 'yes-no',
        requiresCitizenship: p.requiresCitizenship ? 'true' : 'false',
        support: String(p.supportVotes ?? 0),
        oppose: String(p.opposeVotes ?? 0),
        closed: closed ? 'true' : 'false',
        options: JSON.stringify(Array.isArray(p.options) ? p.options : []),
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {/* greeting + verified status */}
        <View style={{ gap: SPACE.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ gap: SPACE.xs, flex: 1 }}>
              <Eyebrow>{verified ? 'Verified citizen' : 'Welcome'}</Eyebrow>
              <T variant="titleSerif" color={colors.text}>
                {user?.name ? user.name.split(' ')[0] : 'Represent'}
              </T>
            </View>
            <TrustChip
              label={verified ? 'Verified' : 'Unverified'}
              kind={verified ? 'gold' : 'neutral'}
              dot
            />
          </View>
          <T variant="body" color={colors.textTertiary}>{region}</T>
        </View>

        {/* countdown card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: colors.goldSurfaceStrong,
            padding: SPACE.xxl,
            gap: SPACE.sm,
          }}
        >
          <Eyebrow>Alberta votes in</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SPACE.md }}>
            <T variant="heroSerif" color={colors.gold} style={{ fontFamily: FONTS.monoMedium }}>
              {days}
            </T>
            <T variant="h2" color={colors.text}>days</T>
          </View>
          <T variant="body" color={colors.textSecondary}>
            The Shadow Referendum is live — all 10 official questions, verified Albertans only.
          </T>
        </View>

        {/* open for you */}
        <View style={{ gap: SPACE.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Eyebrow>Open for you</Eyebrow>
            <T variant="caption" color={colors.gold} onPress={() => router.push('/redesign-feed')}>
              See all →
            </T>
          </View>

          {featured === null ? (
            <T variant="body" color={colors.textTertiary}>Loading…</T>
          ) : featured.length === 0 ? (
            <T variant="body" color={colors.textTertiary}>No open proposals in your region yet.</T>
          ) : (
            featured.map((p) => <ProposalCard key={String(p.id)} data={toCard(p)} onPress={() => openProposal(p)} />)
          )}
        </View>

        {!verified && (
          <Button label="Verify to start voting" onPress={() => router.push('/redesign-verify')} />
        )}

        <Button label="Propose something" variant="secondary" onPress={() => router.push('/redesign-create')} />
      </ScrollView>
    </SafeAreaView>
  );
}
