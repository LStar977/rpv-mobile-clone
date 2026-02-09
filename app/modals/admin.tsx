import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { adminApi, proposalsApi, Proposal, AdminStats } from '../../lib/api';
import { FeaturedStat, StatsGrid } from '../../components/ui';

type TabType = 'stats' | 'proposals';

// Tab Button Component
function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.tabButton,
        {
          backgroundColor: active ? `${colors.warning}15` : 'transparent',
          borderColor: active ? colors.warning : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={16} color={active ? colors.warning : colors.textSecondary} />
      <Text style={[styles.tabButtonText, { color: active ? colors.warning : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Proposal Card for Admin
function AdminProposalCard({
  proposal,
  index,
  onDelete,
}: {
  proposal: Proposal;
  index: number;
  onDelete: (proposal: Proposal) => void;
}) {
  const { colors } = useTheme();
  const isSeed = typeof proposal.id === 'string' && proposal.id.toString().startsWith('seed-');

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).duration(300)}
      style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.proposalHeader}>
        <View style={styles.proposalTitleRow}>
          {isSeed && (
            <View style={[styles.seedBadge, { backgroundColor: `${colors.info}20` }]}>
              <Text style={[styles.seedBadgeText, { color: colors.info }]}>SEED</Text>
            </View>
          )}
          <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>
            {proposal.title}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.deleteButton, { backgroundColor: `${colors.error}15` }]}
          onPress={() => onDelete(proposal)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.proposalMeta}>
        <View style={[styles.categoryBadge, { backgroundColor: `${colors.gold}15` }]}>
          <Text style={[styles.categoryText, { color: colors.gold }]}>{proposal.category}</Text>
        </View>
        <View style={styles.voteStats}>
          <View style={styles.voteStat}>
            <Ionicons name="thumbs-up" size={12} color={colors.success} />
            <Text style={[styles.voteText, { color: colors.textSecondary }]}>{proposal.supportVotes}</Text>
          </View>
          <View style={styles.voteStat}>
            <Ionicons name="thumbs-down" size={12} color={colors.error} />
            <Text style={[styles.voteText, { color: colors.textSecondary }]}>{proposal.opposeVotes}</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.proposalId, { color: colors.textTertiary }]}>
        ID: {proposal.id}
      </Text>
    </Animated.View>
  );
}

export default function AdminDashboard() {
  const { colors } = useTheme();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabType>('stats');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check admin access
  useEffect(() => {
    const checkAdmin = adminApi.isAdmin();
    setIsAdmin(checkAdmin);
    if (!checkAdmin) {
      setLoading(false);
    }
  }, [user?.email]);

  const fetchData = useCallback(async () => {
    try {
      const [statsResult, proposalsResult] = await Promise.all([
        adminApi.getPlatformStats(),
        adminApi.getAllProposals(),
      ]);

      if (statsResult.data) {
        setStats(statsResult.data);
      }
      if (proposalsResult.data) {
        setProposals(proposalsResult.data);
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, fetchData]);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchData();
  };

  const handleDeleteProposal = (proposal: Proposal) => {
    Alert.alert(
      'Delete Proposal',
      `Are you sure you want to delete "${proposal.title}"?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            const result = await proposalsApi.deleteProposal(proposal.id);

            if (result.error) {
              Alert.alert('Error', result.error);
              return;
            }

            // Remove from local state
            setProposals(prev => prev.filter(p => p.id !== proposal.id));

            // Update stats
            if (stats) {
              setStats({
                ...stats,
                totalProposals: stats.totalProposals - 1,
                activeProposals: stats.activeProposals - 1,
              });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (result.data?.isSeedProposal) {
              Alert.alert(
                'Seed Proposal Removed',
                'This seed proposal has been removed from view. Note: Seed proposals will reappear when the app restarts.'
              );
            }
          },
        },
      ]
    );
  };

  // Unauthorized view
  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface }]}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Dashboard</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.unauthorizedContainer}>
          <View style={[styles.unauthorizedIcon, { backgroundColor: `${colors.error}15` }]}>
            <Ionicons name="shield-outline" size={48} color={colors.error} />
          </View>
          <Text style={[styles.unauthorizedTitle, { color: colors.text }]}>
            Access Denied
          </Text>
          <Text style={[styles.unauthorizedText, { color: colors.textSecondary }]}>
            You don't have permission to access the admin dashboard.
          </Text>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.backBtnText, { color: colors.text }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading view
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.warning} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading admin data...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons name="shield-checkmark" size={20} color={colors.warning} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Dashboard</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TabButton
          label="Statistics"
          icon="bar-chart-outline"
          active={activeTab === 'stats'}
          onPress={() => setActiveTab('stats')}
        />
        <TabButton
          label="Proposals"
          icon="document-text-outline"
          active={activeTab === 'proposals'}
          onPress={() => setActiveTab('proposals')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.warning}
          />
        }
      >
        {/* Stats Tab */}
        {activeTab === 'stats' && stats && (
          <>
            {/* Admin Badge */}
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.adminBadge, { backgroundColor: `${colors.warning}10` }]}
            >
              <LinearGradient
                colors={[`${colors.warning}15`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="shield-checkmark" size={24} color={colors.warning} />
              <Text style={[styles.adminBadgeText, { color: colors.warning }]}>
                Platform Administrator
              </Text>
            </Animated.View>

            {/* Hero Stat */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <FeaturedStat
                value={stats.totalUsers}
                label="Total Users"
                description="Registered on the platform"
                icon="people"
                gradient
                style={{ marginBottom: SPACING.lg }}
              />
            </Animated.View>

            {/* User Stats Grid */}
            <Animated.View entering={FadeInUp.delay(200).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>User Metrics</Text>
              <StatsGrid
                stats={[
                  {
                    value: stats.verifiedUsers,
                    label: 'Verified',
                    icon: 'checkmark-circle-outline',
                    iconColor: colors.success,
                  },
                  {
                    value: stats.premiumUsers,
                    label: 'Premium',
                    icon: 'star-outline',
                    iconColor: colors.gold,
                  },
                  {
                    value: stats.recentSignups,
                    label: '7-Day Signups',
                    icon: 'person-add-outline',
                    iconColor: colors.info,
                  },
                ]}
                columns={3}
                compact
                style={{ marginBottom: SPACING.xl }}
              />
            </Animated.View>

            {/* Proposal Stats Grid */}
            <Animated.View entering={FadeInUp.delay(300).duration(400)}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Proposal Metrics</Text>
              <StatsGrid
                stats={[
                  {
                    value: stats.totalProposals,
                    label: 'Total',
                    icon: 'document-text-outline',
                    iconColor: colors.info,
                  },
                  {
                    value: stats.activeProposals,
                    label: 'Active',
                    icon: 'flame-outline',
                    iconColor: colors.warning,
                  },
                  {
                    value: stats.totalVotesCast,
                    label: 'Votes Cast',
                    icon: 'hand-left-outline',
                    iconColor: colors.success,
                  },
                ]}
                columns={3}
                compact
                style={{ marginBottom: SPACING.xl }}
              />
            </Animated.View>

            {/* Activity Stats */}
            <Animated.View
              entering={FadeInUp.delay(400).duration(400)}
              style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.activityTitle, { color: colors.text }]}>Recent Activity (7 Days)</Text>
              <View style={styles.activityRow}>
                <View style={styles.activityItem}>
                  <Ionicons name="person-add" size={20} color={colors.success} />
                  <Text style={[styles.activityValue, { color: colors.text }]}>{stats.recentSignups}</Text>
                  <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>New Users</Text>
                </View>
                <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
                <View style={styles.activityItem}>
                  <Ionicons name="hand-left" size={20} color={colors.info} />
                  <Text style={[styles.activityValue, { color: colors.text }]}>{stats.recentVotes}</Text>
                  <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Votes Cast</Text>
                </View>
                <View style={[styles.activityDivider, { backgroundColor: colors.border }]} />
                <View style={styles.activityItem}>
                  <Ionicons name="business" size={20} color={colors.gold} />
                  <Text style={[styles.activityValue, { color: colors.text }]}>{stats.totalOrganizations}</Text>
                  <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Organizations</Text>
                </View>
              </View>
            </Animated.View>
          </>
        )}

        {/* Proposals Tab */}
        {activeTab === 'proposals' && (
          <>
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.proposalsHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.proposalsHeaderContent}>
                <Ionicons name="document-text" size={20} color={colors.warning} />
                <Text style={[styles.proposalsHeaderText, { color: colors.text }]}>
                  {proposals.length} Proposals
                </Text>
              </View>
              <Text style={[styles.proposalsHeaderNote, { color: colors.textSecondary }]}>
                Tap the trash icon to delete a proposal
              </Text>
            </Animated.View>

            {proposals.length === 0 ? (
              <Animated.View
                entering={FadeIn.duration(400)}
                style={styles.emptyState}
              >
                <Ionicons name="document-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No proposals found
                </Text>
              </Animated.View>
            ) : (
              proposals.map((proposal, index) => (
                <AdminProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  index={index}
                  onDelete={handleDeleteProposal}
                />
              ))
            )}
          </>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl + 20,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.h4.fontSize,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  tabButtonText: {
    fontSize: TYPOGRAPHY.bodySmall.fontSize,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.body.fontSize,
  },
  unauthorizedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  unauthorizedIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  unauthorizedTitle: {
    fontSize: TYPOGRAPHY.h3.fontSize,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  unauthorizedText: {
    fontSize: TYPOGRAPHY.body.fontSize,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  backBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  backBtnText: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  adminBadgeText: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.h5.fontSize,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  activityCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  activityTitle: {
    fontSize: TYPOGRAPHY.bodyLarge.fontSize,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityItem: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  activityValue: {
    fontSize: TYPOGRAPHY.h4.fontSize,
    fontWeight: '700',
  },
  activityLabel: {
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  activityDivider: {
    width: 1,
    height: 48,
  },
  proposalsHeader: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  proposalsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  proposalsHeaderText: {
    fontSize: TYPOGRAPHY.bodyLarge.fontSize,
    fontWeight: '600',
  },
  proposalsHeaderNote: {
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  proposalCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  proposalTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginRight: SPACING.sm,
  },
  seedBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  seedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  proposalTitle: {
    flex: 1,
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '600',
    lineHeight: 20,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  categoryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: '600',
  },
  voteStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  voteStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteText: {
    fontSize: TYPOGRAPHY.caption.fontSize,
  },
  proposalId: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING['2xl'],
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.body.fontSize,
  },
  bottomPadding: {
    height: SPACING['2xl'],
  },
});
