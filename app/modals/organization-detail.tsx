import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, Organization, OrganizationProposal } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

type TabType = 'proposals' | 'announcements' | 'about';

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
          backgroundColor: active ? `${colors.gold}15` : 'transparent',
          borderColor: active ? colors.gold : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon as any} size={16} color={active ? colors.gold : colors.textSecondary} />
      <Text style={[styles.tabButtonText, { color: active ? colors.gold : colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Proposal Card Component
function ProposalCard({
  proposal,
  index,
}: {
  proposal: OrganizationProposal;
  index: number;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(400)}
      style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {proposal.isOfficial && (
        <View style={[styles.officialBadge, { backgroundColor: `${colors.gold}15` }]}>
          <Ionicons name="ribbon" size={12} color={colors.gold} />
          <Text style={[styles.officialBadgeText, { color: colors.gold }]}>Official</Text>
        </View>
      )}
      <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>
        {proposal.title}
      </Text>
      <Text style={[styles.proposalDescription, { color: colors.textSecondary }]} numberOfLines={3}>
        {proposal.description}
      </Text>
      <View style={styles.proposalMeta}>
        <View style={styles.proposalVotes}>
          <View style={styles.voteItem}>
            <Ionicons name="thumbs-up" size={14} color={colors.success} />
            <Text style={[styles.voteText, { color: colors.textSecondary }]}>{proposal.supportVotes}</Text>
          </View>
          <View style={styles.voteItem}>
            <Ionicons name="thumbs-down" size={14} color={colors.error} />
            <Text style={[styles.voteText, { color: colors.textSecondary }]}>{proposal.opposeVotes}</Text>
          </View>
        </View>
        <Text style={[styles.proposalCategory, { color: colors.textTertiary }]}>{proposal.category}</Text>
      </View>
    </Animated.View>
  );
}

// Announcement Card Component
function AnnouncementCard({
  announcement,
  index,
}: {
  announcement: { id: string; title: string; content: string; createdAt: string; pinned?: boolean };
  index: number;
}) {
  const { colors } = useTheme();
  const date = new Date(announcement.createdAt);
  const formattedDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(400)}
      style={[styles.announcementCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {announcement.pinned && (
        <View style={[styles.pinnedBadge, { backgroundColor: `${colors.info}15` }]}>
          <Ionicons name="pin" size={12} color={colors.info} />
          <Text style={[styles.pinnedBadgeText, { color: colors.info }]}>Pinned</Text>
        </View>
      )}
      <Text style={[styles.announcementTitle, { color: colors.text }]}>{announcement.title}</Text>
      <Text style={[styles.announcementContent, { color: colors.textSecondary }]} numberOfLines={4}>
        {announcement.content}
      </Text>
      <Text style={[styles.announcementDate, { color: colors.textTertiary }]}>{formattedDate}</Text>
    </Animated.View>
  );
}

export default function OrganizationDetailScreen() {
  const { colors } = useTheme();
  const { token } = useAuthStore();
  const params = useLocalSearchParams<{ orgId: string; orgName: string }>();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [proposals, setProposals] = useState<OrganizationProposal[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('proposals');
  const [leaving, setLeaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!token || !params.orgId) {
      setLoading(false);
      return;
    }

    try {
      const [orgResult, proposalsResult, announcementsResult] = await Promise.all([
        organizationsApi.getOrganization(params.orgId),
        organizationsApi.getOrganizationProposals(params.orgId),
        organizationsApi.getOrganizationAnnouncements(params.orgId),
      ]);

      if (orgResult.data) setOrganization(orgResult.data);
      if (proposalsResult.data) setProposals(proposalsResult.data);
      if (announcementsResult.data) setAnnouncements(announcementsResult.data);
    } catch (error) {
      console.error('Failed to fetch organization data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, params.orgId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleLeaveOrganization = () => {
    if (!organization) return;

    Alert.alert(
      'Leave Organization',
      `Are you sure you want to leave ${organization.name}? You'll need a new invite code to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setLeaving(true);

            try {
              const result = await organizationsApi.leaveOrganization(params.orgId);

              if (result.error) {
                Alert.alert('Error', result.error);
                return;
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to leave organization. Please try again.');
            } finally {
              setLeaving(false);
            }
          },
        },
      ]
    );
  };

  const getTierBadge = () => {
    if (!organization) return null;

    const isPro = organization.tier === 'professional';
    return (
      <View style={[styles.tierBadge, { backgroundColor: isPro ? colors.gold : colors.success }]}>
        <Text style={styles.tierBadgeText}>{isPro ? 'PRO' : 'STARTER'}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {params.orgName || 'Organization'}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {organization?.name || params.orgName || 'Organization'}
        </Text>
        <TouchableOpacity
          onPress={handleLeaveOrganization}
          style={styles.menuButton}
          disabled={leaving}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Organization Hero */}
        {organization && (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <LinearGradient
              colors={[`${colors.gold}08`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.heroContent}>
              <View style={[styles.heroLogo, { backgroundColor: `${colors.gold}15` }]}>
                {organization.logoUrl ? (
                  <Animated.Image source={{ uri: organization.logoUrl }} style={styles.heroLogoImage} />
                ) : (
                  <Ionicons name="business" size={32} color={colors.gold} />
                )}
              </View>
              <View style={styles.heroInfo}>
                <View style={styles.heroNameRow}>
                  <Text style={[styles.heroName, { color: colors.text }]}>{organization.name}</Text>
                  {organization.verified && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  )}
                </View>
                {getTierBadge()}
              </View>
            </View>

            {/* Stats */}
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: colors.gold }]}>{organization.memberCount}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Members</Text>
              </View>
              <View style={[styles.heroStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: colors.gold }]}>{proposals.length}</Text>
                <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Proposals</Text>
              </View>
              <View style={[styles.heroStatDivider, { backgroundColor: colors.border }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroStatValue, { color: colors.gold }]}>
                  {organization.role === 'admin' ? 'Admin' : 'Member'}
                </Text>
                <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>Your Role</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TabButton
            label="Proposals"
            icon="document-text-outline"
            active={activeTab === 'proposals'}
            onPress={() => setActiveTab('proposals')}
          />
          <TabButton
            label="Announcements"
            icon="megaphone-outline"
            active={activeTab === 'announcements'}
            onPress={() => setActiveTab('announcements')}
          />
          <TabButton
            label="About"
            icon="information-circle-outline"
            active={activeTab === 'about'}
            onPress={() => setActiveTab('about')}
          />
        </View>

        {/* Tab Content */}
        {activeTab === 'proposals' && (
          <>
            {proposals.length === 0 ? (
              <Animated.View
                entering={FadeInUp.duration(400)}
                style={[styles.emptyTab, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
                <Text style={[styles.emptyTabTitle, { color: colors.text }]}>No Proposals Yet</Text>
                <Text style={[styles.emptyTabDescription, { color: colors.textSecondary }]}>
                  This organization hasn't created any proposals yet.
                </Text>
              </Animated.View>
            ) : (
              proposals.map((proposal, index) => (
                <ProposalCard key={proposal.id} proposal={proposal} index={index} />
              ))
            )}
          </>
        )}

        {activeTab === 'announcements' && (
          <>
            {announcements.length === 0 ? (
              <Animated.View
                entering={FadeInUp.duration(400)}
                style={[styles.emptyTab, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="megaphone-outline" size={40} color={colors.textTertiary} />
                <Text style={[styles.emptyTabTitle, { color: colors.text }]}>No Announcements</Text>
                <Text style={[styles.emptyTabDescription, { color: colors.textSecondary }]}>
                  Stay tuned for updates from this organization.
                </Text>
              </Animated.View>
            ) : (
              announcements.map((announcement, index) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} index={index} />
              ))
            )}
          </>
        )}

        {activeTab === 'about' && organization && (
          <Animated.View
            entering={FadeInUp.duration(400)}
            style={[styles.aboutCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.aboutTitle, { color: colors.text }]}>About</Text>
            <Text style={[styles.aboutDescription, { color: colors.textSecondary }]}>
              {organization.description}
            </Text>

            <View style={[styles.aboutDivider, { backgroundColor: colors.border }]} />

            <View style={styles.aboutRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.aboutRowLabel, { color: colors.textSecondary }]}>Created</Text>
              <Text style={[styles.aboutRowValue, { color: colors.text }]}>
                {new Date(organization.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                })}
              </Text>
            </View>

            <View style={styles.aboutRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.aboutRowLabel, { color: colors.textSecondary }]}>Verification</Text>
              <Text style={[styles.aboutRowValue, { color: organization.verified ? colors.success : colors.textTertiary }]}>
                {organization.verified ? 'Verified Organization' : 'Unverified'}
              </Text>
            </View>

            <View style={styles.aboutRow}>
              <Ionicons name="ribbon-outline" size={18} color={colors.textTertiary} />
              <Text style={[styles.aboutRowLabel, { color: colors.textSecondary }]}>Plan</Text>
              <Text style={[styles.aboutRowValue, { color: colors.gold }]}>
                {organization.tier === 'professional' ? 'Professional' : 'Starter'}
              </Text>
            </View>

            {/* Leave Button */}
            <TouchableOpacity
              style={[styles.leaveButton, { borderColor: colors.error }]}
              onPress={handleLeaveOrganization}
              disabled={leaving}
            >
              {leaving ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={18} color={colors.error} />
                  <Text style={[styles.leaveButtonText, { color: colors.error }]}>Leave Organization</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.bottomSpacer} />
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
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineSmall,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.md,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },

  // Hero Card
  heroCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  heroLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  heroLogoImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  heroInfo: {
    flex: 1,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  heroName: {
    ...TYPOGRAPHY.headlineSmall,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  tierBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
    fontSize: 10,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
  },
  heroStatLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xxs,
  },
  heroStatDivider: {
    width: 1,
    height: 40,
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  tabButtonText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },

  // Empty Tab
  emptyTab: {
    alignItems: 'center',
    padding: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
  },
  emptyTabTitle: {
    ...TYPOGRAPHY.labelLarge,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyTabDescription: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
  },

  // Proposal Card
  proposalCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xxs,
    marginBottom: SPACING.sm,
  },
  officialBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 10,
    fontWeight: '600',
  },
  proposalTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  proposalDescription: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  proposalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proposalVotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  voteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  voteText: {
    ...TYPOGRAPHY.labelSmall,
  },
  proposalCategory: {
    ...TYPOGRAPHY.labelSmall,
  },

  // Announcement Card
  announcementCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xxs,
    marginBottom: SPACING.sm,
  },
  pinnedBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 10,
    fontWeight: '600',
  },
  announcementTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  announcementContent: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  announcementDate: {
    ...TYPOGRAPHY.labelSmall,
  },

  // About Card
  aboutCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    ...SHADOWS.sm,
  },
  aboutTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.md,
  },
  aboutDescription: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },
  aboutDivider: {
    height: 1,
    marginVertical: SPACING.xl,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  aboutRowLabel: {
    ...TYPOGRAPHY.labelMedium,
    flex: 1,
  },
  aboutRowValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1.5,
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  leaveButtonText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },

  bottomSpacer: {
    height: 100,
  },
});
