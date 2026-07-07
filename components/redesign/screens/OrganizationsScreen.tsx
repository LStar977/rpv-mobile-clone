// Redesign · Screen 11 — Organizations hub
// Groups the user belongs to or governs. Wired to organizationsApi. Each card
// opens the existing org-detail modal (keeps the working org flow); empty state
// leads into create/join.
import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { organizationsApi, type Organization } from '../../../lib/api';
import { T, Eyebrow, Button, TrustChip } from '../index';
import { SPACE, RADIUS } from '../../../lib/redesign';

export function OrganizationsScreen() {
  const { colors } = useTheme();
  const [orgs, setOrgs] = useState<Organization[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await organizationsApi.getMyOrganizations();
    if (res.error) setError(res.error);
    else setOrgs(res.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const open = (o: Organization) =>
    router.push({ pathname: '/redesign-org', params: { organizationId: o.id } });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        <View style={{ gap: SPACE.xs, marginBottom: SPACE.sm }}>
          <Eyebrow>Organizations</Eyebrow>
          <T variant="titleSerif" color={colors.text}>Verified governance</T>
        </View>

        {orgs === null && !error && (
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

        {orgs !== null && orgs.length === 0 && (
          <View style={{ paddingTop: 40, alignItems: 'center', gap: SPACE.md }}>
            <T variant="proposalTitle" color={colors.text} style={{ textAlign: 'center' }}>
              You're not in any organizations yet
            </T>
            <T variant="body" color={colors.textTertiary} style={{ textAlign: 'center' }}>
              Run verified voting for a union, association, or community — or join one with an invite code.
            </T>
            <Button label="Create an organization" onPress={() => router.push('/modals/create-organization')} />
          </View>
        )}

        {orgs?.map((o) => (
          <Pressable key={o.id} onPress={() => open(o)}>
            <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.xl, gap: SPACE.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <T variant="proposalTitle" color={colors.text} style={{ flex: 1, paddingRight: SPACE.md }}>{o.name}</T>
                {o.verified && <TrustChip label="Verified" kind="gold" dot />}
              </View>
              {!!o.description && <T variant="body" color={colors.textTertiary} numberOfLines={2}>{o.description}</T>}
              <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
                <TrustChip label={`${o.memberCount ?? 0} members`} kind="neutral" />
                {o.role === 'admin' && <TrustChip label="Admin" kind="citizens" />}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
