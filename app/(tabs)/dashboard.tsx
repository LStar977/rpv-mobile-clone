import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { proposalsApi, userApi } from '../../lib/api';

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

export default function HomeScreen() {
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
      const votedIds = new Set((votedRes.data || []).map((v: any) => typeof v === 'object' ? v.proposalId : v));
      const claimedIds = new Set((claimedRes.data || []).map((c: any) => typeof c === 'object' ? c.proposalId : c));

      const now = new Date();
      const urgent: UrgentProposal[] = [];
      let pendingCount = 0;

      proposals.forEach((p: any) => {
        if (!votedIds.has(p.id)) pendingCount++;
        if (p.deadline && typeof p.deadline === 'string') {
          try {
            const deadline = new Date(p.deadline);
            if (!isNaN(deadline.getTime()) && deadline > now) {
              const hoursLeft = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
              if (hoursLeft <= 48 && hoursLeft > 0 && !votedIds.has(p.id)) {
                urgent.push({ id: p.id, title: p.title || 'Untitled', hoursLeft, category: p.category || 'General' });
              }
            }
          } catch { }
        }
      });

      urgent.sort((a, b) => a.hoursLeft - b.hoursLeft);

      const unclaimed = proposals.filter((p: any) => !claimedIds.has(p.id) && !votedIds.has(p.id)).length;

      const profile = profileRes.data;
      const userCountry = profile?.country || user?.country || '';
      const userState = profile?.state || user?.state || '';
      const userCity = profile?.city || user?.city || '';

      const countryFlags: Record<string, string> = {
        'Canada': '🇨🇦',
        'United States': '🇺🇸',
        'United Kingdom': '🇬🇧',
        'Australia': '🇦🇺',
        'Germany': '🇩🇪',
        'France': '🇫🇷',
        'Japan': '🇯🇵',
        'India': '🇮🇳',
        'Brazil': '🇧🇷',
        'Mexico': '🇲🇽',
        'Spain': '🇪🇸',
        'Italy': '🇮🇹',
        'Netherlands': '🇳🇱',
        'Sweden': '🇸🇪',
        'Norway': '🇳🇴',
        'Denmark': '🇩🇰',
        'Finland': '🇫🇮',
        'Ireland': '🇮🇪',
        'New Zealand': '🇳🇿',
        'South Korea': '🇰🇷',
        'Singapore': '🇸🇬',
      };

      const communityMap: Record<string, Community> = {};
      
      if (userCountry) {
        communityMap['country'] = { 
          id: 'country', 
          name: userCountry, 
          type: 'country', 
          icon: countryFlags[userCountry] || '🌍', 
          proposalCount: 0, 
          unvotedCount: 0 
        };
      }
      if (userState) {
        communityMap['state'] = { 
          id: 'state', 
          name: userState, 
          type: 'state', 
          icon: '🏛️', 
          proposalCount: 0, 
          unvotedCount: 0 
        };
      }
      if (userCity) {
        communityMap['city'] = { 
          id: 'city', 
          name: userCity, 
          type: 'city', 
          icon: '🏙️', 
          proposalCount: 0, 
          unvotedCount: 0 
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
        
        if (userState && communityMap['state'] && geoRestrictions.length === 2 && geoRestrictions[0] === userCountry && geoRestrictions[1] === userState) {
          communityMap['state'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['state'].unvotedCount++;
        }
        
        if (userCity && communityMap['city'] && geoRestrictions.length === 3 && geoRestrictions[0] === userCountry && geoRestrictions[1] === userState && geoRestrictions[2] === userCity) {
          communityMap['city'].proposalCount++;
          if (!votedIds.has(p.id)) communityMap['city'].unvotedCount++;
        }
      });

      const passedCount = proposals.filter((p: any) => {
        const total = (p.supportVotes || 0) + (p.opposeVotes || 0);
        return total > 0 && (p.supportVotes || 0) > (p.opposeVotes || 0) && votedIds.has(p.id);
      }).length;

      setStats({ pending: pendingCount, voted: votedIds.size, passed: passedCount });
      setCommunities(Object.values(communityMap).filter(c => c.proposalCount > 0));
      setUrgentProposals(urgent.slice(0, 3));
      setUnclaimedTokens(unclaimed);
      setVotingStreak(Math.min(votedIds.size, 7));
      setIsVerified(verificationRes.data?.verified || false);

      const recentActivities: ActivityItem[] = [];
      if (proposals.length > 0) {
        const newest = proposals[0];
        const title = newest.title || 'New proposal';
        recentActivities.push({
          id: '1',
          type: 'new_proposal',
          message: `New: ${title.length > 35 ? title.substring(0, 35) + '...' : title}`,
          time: '2h ago',
          icon: 'document-text',
          color: colors.gold,
        });
      }
      if (votedIds.size > 0) {
        recentActivities.push({
          id: '2',
          type: 'badge_earned',
          message: `You've cast ${votedIds.size} vote${votedIds.size > 1 ? 's' : ''}!`,
          time: 'Recent',
          icon: 'trophy',
          color: colors.gold,
        });
      }
      setActivities(recentActivities);

    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, user, colors.gold]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const navigateToProposals = (filter?: string) => {
    router.push('/(tabs)/proposals');
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.cardBg }]}>
        <View style={[styles.welcomeCard, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}>
          <View style={styles.welcomeContent}>
            <Text style={[styles.welcomeTitle, { color: colors.gold }]}>Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>Your voice matters in civic governance</Text>
            <View style={[styles.citizenBadge, { backgroundColor: isVerified ? colors.gold : colors.goldLight }]}>
              <Ionicons name={isVerified ? "shield-checkmark" : "shield-outline"} size={14} color={isVerified ? colors.background : colors.gold} />
              <Text style={[styles.citizenText, { color: isVerified ? colors.background : colors.gold }]}>{isVerified ? 'Verified Citizen' : 'Active Citizen'}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      >
        {!isVerified && isAuthenticated && (
          <TouchableOpacity 
            style={[styles.verifyBanner, { backgroundColor: `${colors.warning}20`, borderColor: colors.warning }]}
            onPress={() => router.push('/(tabs)/identity')}
          >
            <Ionicons name="warning" size={24} color={colors.warning} />
            <View style={styles.verifyBannerText}>
              <Text style={[styles.verifyTitle, { color: colors.text }]}>Verify Your Identity</Text>
              <Text style={[styles.verifySubtitle, { color: colors.textSecondary }]}>Complete verification to vote on proposals</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.warning} />
          </TouchableOpacity>
        )}

        {votingStreak > 0 && (
          <View style={[styles.streakCard, { backgroundColor: colors.goldLight, borderColor: colors.gold }]}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <View style={styles.streakInfo}>
              <Text style={[styles.streakTitle, { color: colors.gold }]}>{votingStreak} Day Voting Streak!</Text>
              <Text style={[styles.streakSubtitle, { color: colors.text }]}>Keep voting to maintain your streak</Text>
            </View>
          </View>
        )}

        {unclaimedTokens > 0 && (
          <TouchableOpacity 
            style={[styles.tokensBanner, { backgroundColor: `${colors.success}15`, borderColor: colors.success }]}
            onPress={() => router.push('/(tabs)/proposals')}
          >
            <View style={[styles.tokenIcon, { backgroundColor: colors.success }]}>
              <Ionicons name="ticket" size={20} color="#fff" />
            </View>
            <View style={styles.tokenInfo}>
              <Text style={[styles.tokenTitle, { color: colors.text }]}>{unclaimedTokens} Vote Token{unclaimedTokens > 1 ? 's' : ''} Available</Text>
              <Text style={[styles.tokenSubtitle, { color: colors.textSecondary }]}>Claim now to participate</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color={colors.success} />
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>YOUR STATS</Text>
        <View style={styles.statsGrid}>
          {[
            { icon: 'time-outline', value: stats.pending.toString(), label: 'Pending', color: colors.warning },
            { icon: 'checkmark-done-outline', value: stats.voted.toString(), label: 'Voted', color: colors.success },
            { icon: 'trophy-outline', value: stats.passed.toString(), label: 'Passed', color: colors.gold },
          ].map((stat, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Ionicons name={stat.icon as any} size={22} color={stat.color} />
              <Text style={[styles.statValue, { color: colors.gold }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {urgentProposals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="alarm" size={18} color={colors.error} />
                <Text style={[styles.sectionTitle, { color: colors.text, marginLeft: 8 }]}>Closing Soon</Text>
              </View>
            </View>
            {urgentProposals.map((proposal) => (
              <TouchableOpacity 
                key={proposal.id} 
                style={[styles.urgentCard, { backgroundColor: colors.cardBg, borderColor: colors.error }]}
                onPress={() => router.push('/(tabs)/proposals')}
              >
                <View style={styles.urgentInfo}>
                  <Text style={[styles.urgentTitle, { color: colors.text }]} numberOfLines={1}>{proposal.title}</Text>
                  <Text style={[styles.urgentCategory, { color: colors.gold }]}>{proposal.category}</Text>
                </View>
                <View style={[styles.urgentTime, { backgroundColor: `${colors.error}20` }]}>
                  <Ionicons name="time" size={14} color={colors.error} />
                  <Text style={[styles.urgentTimeText, { color: colors.error }]}>{proposal.hoursLeft}h</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {communities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>YOUR COMMUNITIES</Text>
            </View>
            {communities.map((community) => (
              <TouchableOpacity 
                key={community.id} 
                style={[styles.communityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => navigateToProposals(community.id)}
              >
                <Text style={styles.communityIcon}>{community.icon}</Text>
                <View style={styles.communityInfo}>
                  <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
                  <Text style={[styles.communityMeta, { color: colors.textSecondary }]}>
                    {community.proposalCount} proposal{community.proposalCount !== 1 ? 's' : ''}
                  </Text>
                </View>
                {community.unvotedCount > 0 && (
                  <View style={[styles.communityBadge, { backgroundColor: colors.gold }]}>
                    <Text style={[styles.communityBadgeText, { color: colors.background }]}>{community.unvotedCount}</Text>
                  </View>
                )}
                {community.unvotedCount === 0 && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                )}
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>RECENT ACTIVITY</Text>
            </View>
            {activities.map((activity) => (
              <View key={activity.id} style={[styles.activityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                <View style={[styles.activityIcon, { backgroundColor: `${activity.color}20` }]}>
                  <Ionicons name={activity.icon as any} size={18} color={activity.color} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={[styles.activityMessage, { color: colors.text }]}>{activity.message}</Text>
                  <Text style={[styles.activityTime, { color: colors.textSecondary }]}>{activity.time}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={[styles.exploreButton, { backgroundColor: colors.gold }]} 
          onPress={() => router.push('/(tabs)/proposals')}
        >
          <Text style={[styles.exploreButtonText, { color: colors.background }]}>Explore All Proposals</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.background} />
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  welcomeCard: { borderRadius: 16, padding: 20, borderWidth: 1 },
  welcomeContent: { alignItems: 'flex-start' },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  welcomeSubtitle: { fontSize: 14, marginBottom: 16 },
  citizenBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  citizenText: { fontSize: 12, fontWeight: '600' },
  content: { padding: 16 },

  verifyBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  verifyBannerText: { flex: 1, marginLeft: 12 },
  verifyTitle: { fontSize: 15, fontWeight: '600' },
  verifySubtitle: { fontSize: 12, marginTop: 2 },

  streakCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  streakEmoji: { fontSize: 28 },
  streakInfo: { marginLeft: 12, flex: 1 },
  streakTitle: { fontSize: 16, fontWeight: '700' },
  streakSubtitle: { fontSize: 13, marginTop: 2 },

  tokensBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  tokenIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tokenInfo: { flex: 1, marginLeft: 12 },
  tokenTitle: { fontSize: 15, fontWeight: '600' },
  tokenSubtitle: { fontSize: 12, marginTop: 2 },

  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1 },
  statValue: { fontSize: 22, fontWeight: 'bold', marginTop: 6 },
  statLabel: { fontSize: 11, marginTop: 2 },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },

  urgentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  urgentInfo: { flex: 1 },
  urgentTitle: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  urgentCategory: { fontSize: 12 },
  urgentTime: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  urgentTimeText: { fontSize: 13, fontWeight: '600' },

  communityCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  communityIcon: { fontSize: 24, marginRight: 12 },
  communityInfo: { flex: 1 },
  communityName: { fontSize: 16, fontWeight: '600' },
  communityMeta: { fontSize: 12, marginTop: 2 },
  communityBadge: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  communityBadgeText: { fontSize: 14, fontWeight: '700' },

  activityCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  activityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  activityInfo: { flex: 1, marginLeft: 12 },
  activityMessage: { fontSize: 14, fontWeight: '500' },
  activityTime: { fontSize: 12, marginTop: 2 },

  exploreButton: { borderRadius: 30, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  exploreButtonText: { fontSize: 16, fontWeight: '600' },

  bottomPadding: { height: 100 },
});
