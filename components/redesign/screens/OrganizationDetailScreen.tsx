// Redesign · Screen 11b — Organization detail
// Member-facing org view: header credential, about, announcements, org proposals
// to vote on, and members. Wired to organizationsApi. Heavy admin CRUD (invite
// codes, roster, member roles, creating org proposals) routes into the existing
// vetted org modal via "Manage" so nothing regresses.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { organizationsApi, type Organization, type OrganizationProposal } from '../../../lib/api';
import { T, Eyebrow, Button, TrustChip, TallyBar, BackBar } from '../index';
import { SPACE, RADIUS } from '../../../lib/redesign';

export function OrganizationDetailScreen() {
  const { colors } = useTheme();
  const { organizationId } = useLocalSearchParams<{ organizationId?: string }>();
  const orgId = organizationId ?? '';

  const [org, setOrg] = useState<Organization | null>(null);
  const [proposals, setProposals] = useState<OrganizationProposal[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = org?.role === 'admin';

  const load = useCallback(async () => {
    setError(null);
    const [o, p, a] = await Promise.all([
      organizationsApi.getOrganization(orgId),
      organizationsApi.getOrganizationProposals(orgId),
      organizationsApi.getOrganizationAnnouncements(orgId),
    ]);
    if (o.error) setError(o.error);
    setOrg(o.data ?? null);
    setProposals(Array.isArray(p.data) ? p.data : []);
    setAnnouncements(Array.isArray(a.data) ? a.data : []);
    // members only matter for admins; fetch after we know the role
    if (o.data?.role === 'admin') {
      const m = await organizationsApi.getMembers(orgId);
      setMembers(Array.isArray(m.data) ? m.data : []);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openProposal = (p: OrganizationProposal) =>
    router.push({
      pathname: '/redesign-org-proposal',
      params: {
        orgId,
        proposalId: String(p.id),
        title: p.title,
        description: p.description,
        support: String(p.supportVotes ?? 0),
        oppose: String(p.opposeVotes ?? 0),
        userVote: p.userVote ?? '',
        official: p.isOfficial ? 'true' : 'false',
      },
    });

  if (!org && !error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <BackBar />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <BackBar />
      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {error && (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: SPACE.lg }}>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>{error}</T>
            <Button label="Try again" variant="secondary" fullWidth={false} onPress={load} />
          </View>
        )}

        {org && (
          <>
            {/* header credential */}
            <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.goldSurfaceStrong, padding: SPACE.xxl, gap: SPACE.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Eyebrow>Organization</Eyebrow>
                {org.verified && <TrustChip label="Verified" kind="gold" dot />}
              </View>
              <T variant="titleSerif" color={colors.text}>{org.name}</T>
              {!!org.description && <T variant="body" color={colors.textSecondary}>{org.description}</T>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs }}>
                <TrustChip label={`${org.memberCount ?? 0} members`} kind="neutral" />
                {org.tier && org.tier !== 'free' && <TrustChip label={org.tier.toUpperCase()} kind="citizens" />}
                {isAdmin && <TrustChip label="Admin" kind="citizens" />}
              </View>
            </View>

            {/* admin manage entry */}
            {isAdmin && (
              <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                <Button label="Manage" variant="secondary" onPress={() => router.push({ pathname: '/modals/organization-detail', params: { organizationId: orgId } })} />
              </View>
            )}

            {/* announcements */}
            {announcements.length > 0 && (
              <View style={{ gap: SPACE.md }}>
                <Eyebrow>Announcements</Eyebrow>
                {announcements.slice(0, 3).map((a, i) => (
                  <View key={a.id ?? i} style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.xs }}>
                    {!!(a.title) && <T variant="bodyMedium" color={colors.text}>{a.title}</T>}
                    <T variant="body" color={colors.textTertiary}>{a.body ?? a.message ?? a.content ?? ''}</T>
                  </View>
                ))}
              </View>
            )}

            {/* proposals */}
            <View style={{ gap: SPACE.md }}>
              <Eyebrow>Proposals</Eyebrow>
              {proposals.length === 0 ? (
                <T variant="body" color={colors.textTertiary}>No proposals in this organization yet.</T>
              ) : (
                proposals.map((p) => {
                  const closed = p.deadline ? new Date(p.deadline).getTime() < Date.now() : false;
                  return (
                    <Pressable key={String(p.id)} onPress={() => openProposal(p)}>
                      <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.md }}>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
                          <TrustChip label={closed ? 'Voting closed' : 'Open for voting'} kind={closed ? 'closed' : 'open'} dot />
                          {p.isOfficial && <TrustChip label="Official" kind="citizens" />}
                          {p.userVote && <TrustChip label={`You voted ${p.userVote}`} kind="gold" />}
                        </View>
                        <T variant="proposalTitle" color={colors.text}>{p.title}</T>
                        <TallyBar support={p.supportVotes ?? 0} oppose={p.opposeVotes ?? 0} compact />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                          <T variant="caption" color={colors.gold}>View →</T>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            {/* members (admin) */}
            {isAdmin && members.length > 0 && (
              <View style={{ gap: SPACE.md }}>
                <Eyebrow>Members</Eyebrow>
                {members.slice(0, 8).map((m, i) => (
                  <View key={m.id ?? m.userId ?? i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: RADIUS.button, borderWidth: 1, borderColor: colors.border, paddingVertical: SPACE.md, paddingHorizontal: SPACE.lg }}>
                    <T variant="bodyMedium" color={colors.text} numberOfLines={1} style={{ flex: 1 }}>
                      {m.name ?? m.userName ?? m.email ?? m.userEmail ?? 'Member'}
                    </T>
                    {(m.role === 'admin') && <TrustChip label="Admin" kind="citizens" />}
                  </View>
                ))}
                {members.length > 8 && (
                  <T variant="caption" color={colors.textTertiary}>+{members.length - 8} more · manage in the admin panel</T>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
