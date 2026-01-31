import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi } from '../../lib/api';

const QUICK_ACTIONS = [
  { id: 'verify', label: 'Verify identity', icon: 'shield-checkmark' },
  { id: 'proposals', label: 'Browse proposals', icon: 'document-text' },
  { id: 'sentinel', label: 'Run Sentinel', icon: 'sparkles' },
];

type Community = {
  id: string;
  name: string;
  type: 'country' | 'state' | 'city' | 'organization';
  icon: string;
  proposalCount: number;
  unvotedCount: number;
};

type UrgentProposal = {
  id: number;
  title: string;
  hoursLeft: number;
  category: string;
};

type ActivityItem = {
  id: string;
  type: 'new_proposal' | 'vote_result' | 'badge_earned' | 'proposal_closed';
  message: string;
  time: string;
  icon: string;
  color: string;
};

function StatTile({ label, value, icon }: { label: string; value: string; icon: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
    >
      <View style={[styles.statIcon, { backgroundColor: colors.goldLight }]}
      >
        <Ionicons name={icon as any} size={16} color={colors.gold} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

function CommunityCard({ community }: { community: Community }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.communityCard, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
    >
      <Text style={styles.communityIcon}>{community.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
        <Text style={[styles.communityMeta, { color: colors.textMuted }]}
        >
          {community.proposalCount} proposals · {community.unvotedCount} new
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ pending: 0, voted: 0, passed: 0 });
  const [communities, setCommunities] = useState<Community[]>([]);
  const [urgentProposals, setUrgentProposals] = useState<UrgentProposal[]>([]);
  const [unclaimedTokens, setUnclaimedTokens] = useState(0);
  const [votingStreak, setVotingStreak] = useState(0);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isVerified, setIsVerified] = useState(false);

  const displayName = useMemo(() => user?.name?.split(' ')[0] || 'Citizen', [user?.name]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        proposalsApi.getAll(),
        isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [] }),
        isAuthenticated ? userApi.getClaimedTokens() : Promise.resolve({ data: [] }),
        isAuthenticated ? userApi.getVerificationStatus() : Promise.resolve({ data: { verified: false } }),
        isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null }),
      ]);

      const proposalsRes = results[0].status === 'fulfilled' ? results[0].value : { data: [] };
      const votedRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
      const claimedRes = results[2].status === 'fulfilled' ? results[2].value : { data: [] };
      const verificationRes = results[3].status === 'fulfilled' ? results[3].value : { data: { verified: false } };
      const profileRes = results[4].status === 'fulfilled' ? results[4].value : { data: null };

      const proposals = Array.isArray(proposalsRes.data) ? proposalsRes.data : [];
      const votedIds = new Set((votedRes.data || []).map((v: any) => (typeof v === 'object' ? v.proposalId : v)));
      const claimedIds = new Set((claimedRes.data || []).map((c: any) => (typeof c === 'object' ? c.proposalId : c)));

      const now = new Date();
      const urgent: UrgentProposal[] = [];
      let pendingCount = 0;

      proposals.forEach((p: any) => {
        if (!votedIds.has(p.id)) pendingCount++;
        if (p.deadline && typeof p.deadline === 'string') {
          const deadline = new Date(p.deadline);
          if (!Number.isNaN(deadline.getTime()) && deadline > now) {
            const hoursLeft = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
            if (hoursLeft <= 48 && hoursLeft > 0 && !votedIds.has(p.id)) {
              urgent.push({
                id: p.id,
                title: p.title || 'Untitled',
                hoursLeft,
                category: p.category || 'General',
              });
            }
          }
        }
      });

      urgent.sort((a, b) => a.hoursLeft - b.hoursLeft);

      const unclaimed = proposals.filter((p: any) => !claimedIds.has(p.id) && !votedIds.has(p.id)).length;

      const profile = profileRes.data;
      const userCountry = profile?.country || user?.country || '';
      const userState = profile?.state || user?.state || '';
      const userCity = profile?.city || user?.city || '';

      const countryFlags: Record<string, string> = {
        Canada: '🇨🇦',
        'United States': '🇺🇸',
        'United Kingdom': '🇬🇧',
        Australia: '🇦🇺',
        Germany: '🇩🇪',
        France: '🇫🇷',
        Japan: '🇯🇵',
        India: '🇮🇳',
        Brazil: '🇧🇷',
        Mexico: '🇲🇽',
        Spain: '🇪🇸',
        Italy: '🇮🇹',
      };

      const communityMap: Record<string, Community> = {};

      if (userCountry) {
        communityMap['country'] = {
          id: 'country',
          name: userCountry,
          type: 'country',
          icon: countryFlags[userCountry] || '🌍',
          proposalCount: 0,
          unvotedCount: 0,
        };
      }
      if (userState) {
        communityMap['state'] = {
          id: 'state',
          name: userState,
          type: 'state',
          icon: '🏛️',
          proposalCount: 0,
          unvotedCount: 0,
        };
      }
      if (userCity) {
        communityMap['city'] = {
          id: 'city',
          name: userCity,
          type: 'city',
          icon: '🏙️',
          proposalCount: 0,
          unvotedCount: 0,
        };
      }

      proposals.forEach((p: any) => {
        const geoRestrictions: string[] = p.geoRestrictions || [];
        const isGlobal = geoRestrictions.length === 0;
        const matchesCountry = isGlobal || (geoRestrictions.length >= 1 && geoRestrictions[0] === userCountry);

        if (userCountry && communityMap['country'] && matchesCountry && geoRestrictions.length <= 1) {
          communityMap['country'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['country'].unvotedCount++;
        }

        if (
          userState &&
          communityMap['state'] &&
          geoRestrictions.length === 2 &&
          geoRestrictions[0] === userCountry &&
          geoRestrictions[1] === userState
        ) {
          communityMap['state'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['state'].unvotedCount++;
        }

        if (
          userCity &&
          communityMap['city'] &&
          geoRestrictions.length === 3 &&
          geoRestrictions[0] === userCountry &&
          geoRestrictions[1] === userState &&
          geoRestrictions[2] === userCity
        ) {
          communityMap['city'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['city'].unvotedCount++;
        }
      });

      const votedCount = votedIds.size;
      const passedCount = proposals.filter((p: any) => p.status === 'passed').length;

      setStats({ pending: pendingCount, voted: votedCount, passed: passedCount });
      setCommunities(Object.values(communityMap));
      setUrgentProposals(urgent.slice(0, 3));
      setUnclaimedTokens(unclaimed);
      setVotingStreak(Math.min(votedCount, 7));
      setIsVerified(!!verificationRes.data?.verified);
      setActivities([
        { id: '1', type: 'new_proposal', message: 'New transit proposal posted', time: '2h ago', icon: '🚌', color: colors.info },
        { id: '2', type: 'vote_result', message: 'Clean energy vote passed', time: '1d ago', icon: '✅', color: colors.success },
        { id: '3', type: 'badge_earned', message: 'You earned a streak badge', time: '3d ago', icon: '🏅', color: colors.gold },
      ]);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [colors.gold, colors.info, colors.success, isAuthenticated, user?.city, user?.country, user?.state]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      <LinearGradient
        colors={[colors.backgroundSecondary, colors.background]}
        style={styles.hero}
      >
        <Text style={[styles.heroLabel, { color: colors.textMuted }]}>Welcome back</Text>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Hello, {displayName}</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}
        >
          {isVerified ? 'Your identity is verified.' : 'Verify your identity to unlock voting.'}
        </Text>
        <View style={styles.heroPills}>
          <View style={[styles.heroPill, { backgroundColor: colors.cardBg }]}
          >
            <Ionicons name="flame" size={14} color={colors.gold} />
            <Text style={[styles.heroPillText, { color: colors.text }]}>{votingStreak} day streak</Text>
          </View>
          <View style={[styles.heroPill, { backgroundColor: colors.cardBg }]}
          >
            <Ionicons name="cube" size={14} color={colors.gold} />
            <Text style={[styles.heroPillText, { color: colors.text }]}>{unclaimedTokens} tokens to claim</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.statsRow}>
        <StatTile label="Pending" value={`${stats.pending}`} icon="time" />
        <StatTile label="Voted" value={`${stats.voted}`} icon="checkmark" />
        <StatTile label="Passed" value={`${stats.passed}`} icon="ribbon" />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick actions</Text>
        <View style={styles.actionGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionTile, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => {
                if (action.id === 'verify') router.push('/(tabs)/identity');
                if (action.id === 'proposals') router.push('/(tabs)/proposals');
                if (action.id === 'sentinel') router.push('/(tabs)/sentinel');
              }}
            >
              <Ionicons name={action.icon as any} size={20} color={colors.gold} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your communities</Text>
        {communities.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}
            >Add your location to see local proposals.</Text>
          </View>
        ) : (
          <View style={{ gap: SPACING.md }}>
            {communities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Urgent proposals</Text>
        {urgentProposals.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}
            >No urgent votes right now.</Text>
          </View>
        ) : (
          urgentProposals.map((proposal) => (
            <View
              key={proposal.id}
              style={[styles.urgentCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <View>
                <Text style={[styles.urgentTitle, { color: colors.text }]}>{proposal.title}</Text>
                <Text style={[styles.urgentMeta, { color: colors.textMuted }]}
                >{proposal.category} · {proposal.hoursLeft}h left</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/proposals')}>
                <Ionicons name="arrow-forward" size={18} color={colors.gold} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent activity</Text>
        {loading ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading activity…</Text>
        ) : (
          <View style={{ gap: SPACING.sm }}>
            {activities.map((activity) => (
              <View
                key={activity.id}
                style={[styles.activityRow, { borderColor: colors.border }]}
              >
                <View style={[styles.activityIcon, { backgroundColor: activity.color + '22' }]}
                >
                  <Text>{activity.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityText, { color: colors.text }]}>{activity.message}</Text>
                  <Text style={[styles.activityTime, { color: colors.textMuted }]}>{activity.time}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  heroLabel: {
    ...TYPOGRAPHY.bodySmall,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroTitle: {
    ...TYPOGRAPHY.displaySmall,
    marginTop: SPACING.xs,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xs,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  heroPillText: {
    ...TYPOGRAPHY.bodySmall,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statTile: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.xs,
    ...SHADOWS.soft,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.headlineMedium,
  },
  statLabel: {
    ...TYPOGRAPHY.bodySmall,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionTile: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    alignItems: 'flex-start',
    ...SHADOWS.soft,
  },
  actionLabel: {
    ...TYPOGRAPHY.bodyMedium,
  },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOWS.soft,
  },
  communityIcon: {
    fontSize: 22,
  },
  communityName: {
    ...TYPOGRAPHY.bodyLarge,
  },
  communityMeta: {
    ...TYPOGRAPHY.bodySmall,
  },
  urgentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.soft,
  },
  urgentTitle: {
    ...TYPOGRAPHY.bodyLarge,
  },
  urgentMeta: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOWS.soft,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  activityTime: {
    ...TYPOGRAPHY.bodySmall,
  },
});
