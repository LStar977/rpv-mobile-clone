import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Switch, Clipboard } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, Organization, OrganizationProposal } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

const CATEGORIES = ['Transportation', 'Environment', 'Housing', 'Education', 'Healthcare', 'Economy', 'Public Safety', 'Infrastructure', 'Other'];

type TabType = 'proposals' | 'announcements' | 'about' | 'admin';

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
      <Text style={[styles.tabButtonText, { color: active ? colors.gold : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Proposal Card Component
function ProposalCard({
  proposal,
  index,
  isAdmin,
  onDelete,
}: {
  proposal: OrganizationProposal;
  index: number;
  isAdmin?: boolean;
  onDelete?: (proposalId: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(400)}
      style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.proposalCardHeader}>
        {proposal.isOfficial && (
          <View style={[styles.officialBadge, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="ribbon" size={12} color={colors.gold} />
            <Text style={[styles.officialBadgeText, { color: colors.gold }]}>Official</Text>
          </View>
        )}
        {isAdmin && onDelete && (
          <TouchableOpacity
            style={[styles.proposalDeleteBtn, { backgroundColor: `${colors.error}15` }]}
            onPress={() => onDelete(String(proposal.id))}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
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
  const { token, user } = useAuthStore();
  const params = useLocalSearchParams<{ orgId: string; orgName: string; orgRole?: string }>();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [proposals, setProposals] = useState<OrganizationProposal[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('proposals');
  const [leaving, setLeaving] = useState(false);

  // Admin proposal creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [proposalLimits, setProposalLimits] = useState<{ created: number; limit: number; period: 'month' | 'week'; resetDate: string } | null>(null);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    category: 'Other',
  });

  // Admin panel state
  const [members, setMembers] = useState<any[]>([]);
  const [inviteCodes, setInviteCodes] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [creatingAnnouncement, setCreatingAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', pinned: false });

  const fetchData = useCallback(async () => {
    if (!token || !params.orgId) {
      setLoading(false);
      return;
    }

    try {
      const [orgResult, proposalsResult, announcementsResult, limitsResult] = await Promise.all([
        organizationsApi.getOrganization(params.orgId),
        organizationsApi.getOrganizationProposals(params.orgId),
        organizationsApi.getOrganizationAnnouncements(params.orgId),
        organizationsApi.getProposalLimits(params.orgId),
      ]);

      if (orgResult.data) {
        // For demo account, always use admin role
        const isDemoUser = user?.email === 'demo@represent.app';
        const role = isDemoUser ? 'admin' : (orgResult.data.role || (params.orgRole as 'admin' | 'member' | undefined));
        setOrganization({ ...orgResult.data, role });
      }
      if (proposalsResult.data) setProposals(proposalsResult.data);
      if (announcementsResult.data) setAnnouncements(announcementsResult.data);
      if (limitsResult.data) setProposalLimits(limitsResult.data);
    } catch (error) {
      console.error('Failed to fetch organization data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, params.orgId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Fetch admin data when Admin tab is selected
  const fetchAdminData = useCallback(async () => {
    if (!params.orgId || organization?.role !== 'admin') return;

    setAdminLoading(true);
    try {
      const [membersResult, codesResult] = await Promise.all([
        organizationsApi.getMembers(params.orgId),
        organizationsApi.getInviteCodes(params.orgId),
      ]);

      if (membersResult.data) setMembers(membersResult.data);
      if (codesResult.data) setInviteCodes(codesResult.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
    } finally {
      setAdminLoading(false);
    }
  }, [params.orgId, organization?.role]);

  useEffect(() => {
    if (activeTab === 'admin' && organization?.role === 'admin') {
      fetchAdminData();
    }
  }, [activeTab, fetchAdminData, organization?.role]);

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

  const handleCreateProposal = async () => {
    if (!newProposal.title.trim() || !newProposal.description.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both title and description.');
      return;
    }

    // Check limits
    if (proposalLimits && proposalLimits.created >= proposalLimits.limit) {
      Alert.alert(
        'Limit Reached',
        `You've reached your ${proposalLimits.period}ly proposal limit. Limits reset on ${new Date(proposalLimits.resetDate).toLocaleDateString()}.`
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreating(true);

    try {
      const result = await organizationsApi.createProposal(params.orgId, {
        title: newProposal.title.trim(),
        description: newProposal.description.trim(),
        category: newProposal.category,
      });

      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateModal(false);
      setNewProposal({ title: '', description: '', category: 'Other' });

      // Refresh data
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to create proposal. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Admin handlers
  const handleGenerateInviteCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGeneratingCode(true);

    try {
      const result = await organizationsApi.generateInviteCode(params.orgId);
      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchAdminData();
    } catch (error) {
      Alert.alert('Error', 'Failed to generate invite code.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = (code: string) => {
    Clipboard.setString(code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied', 'Invite code copied to clipboard.');
  };

  const handleRevokeCode = (code: string) => {
    Alert.alert('Revoke Code', `Are you sure you want to revoke the invite code "${code}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            await organizationsApi.revokeInviteCode(params.orgId, code);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchAdminData();
          } catch (error) {
            Alert.alert('Error', 'Failed to revoke code.');
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (userId: string, name: string) => {
    Alert.alert('Remove Member', `Are you sure you want to remove ${name} from this organization?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await organizationsApi.removeMember(params.orgId, userId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchAdminData();
          } catch (error) {
            Alert.alert('Error', 'Failed to remove member.');
          }
        },
      },
    ]);
  };

  const handleToggleMemberRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await organizationsApi.updateMemberRole(params.orgId, userId, newRole);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchAdminData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update role.');
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      Alert.alert('Missing Fields', 'Please fill in both title and content.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreatingAnnouncement(true);

    try {
      const result = await organizationsApi.createAnnouncement(params.orgId, {
        title: newAnnouncement.title.trim(),
        content: newAnnouncement.content.trim(),
        pinned: newAnnouncement.pinned,
      });

      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAnnouncementModal(false);
      setNewAnnouncement({ title: '', content: '', pinned: false });
      fetchData(); // Refresh announcements
    } catch (error) {
      Alert.alert('Error', 'Failed to create announcement.');
    } finally {
      setCreatingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = (announcementId: string, title: string) => {
    Alert.alert('Delete Announcement', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await organizationsApi.deleteAnnouncement(params.orgId, announcementId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete announcement.');
          }
        },
      },
    ]);
  };

  const handleDeleteProposal = (proposalId: string) => {
    const proposal = proposals.find(p => String(p.id) === proposalId);
    const proposalTitle = proposal?.title || 'this proposal';

    Alert.alert('Delete Proposal', `Are you sure you want to delete "${proposalTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          try {
            const result = await organizationsApi.deleteProposal(params.orgId, proposalId);
            if (result.error) {
              Alert.alert('Error', result.error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Update local state immediately
            setProposals(prev => prev.filter(p => String(p.id) !== proposalId));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete proposal.');
          }
        },
      },
    ]);
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollView}
          contentContainerStyle={styles.tabsRow}
        >
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
          {organization?.role === 'admin' && (
            <TabButton
              label="Admin"
              icon="settings-outline"
              active={activeTab === 'admin'}
              onPress={() => setActiveTab('admin')}
            />
          )}
        </ScrollView>

        {/* Tab Content */}
        {activeTab === 'proposals' && (
          <>
            {/* Admin Create Proposal Button */}
            {organization?.role === 'admin' && (
              <Animated.View entering={FadeInUp.duration(300)} style={{ marginBottom: SPACING.md }}>
                <TouchableOpacity
                  style={[styles.createProposalBtn, { backgroundColor: colors.gold }]}
                  onPress={() => setShowCreateModal(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={20} color="#000" />
                  <Text style={styles.createProposalBtnText}>Create Proposal</Text>
                  {proposalLimits && (
                    <View style={[styles.limitBadge, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
                      <Text style={styles.limitBadgeText}>
                        {proposalLimits.created}/{proposalLimits.limit}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

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
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  index={index}
                  isAdmin={organization?.role === 'admin'}
                  onDelete={handleDeleteProposal}
                />
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

        {/* Admin Tab Content */}
        {activeTab === 'admin' && organization?.role === 'admin' && (
          <>
            {adminLoading ? (
              <View style={styles.adminLoadingContainer}>
                <ActivityIndicator size="large" color={colors.gold} />
              </View>
            ) : (
              <>
                {/* Invite Codes Section */}
                <Animated.View
                  entering={FadeInUp.duration(400)}
                  style={[styles.adminSection, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.adminSectionHeader}>
                    <View style={styles.adminSectionTitleRow}>
                      <Ionicons name="key-outline" size={20} color={colors.gold} />
                      <Text style={[styles.adminSectionTitle, { color: colors.text }]}>Invite Codes</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.adminActionBtn, { backgroundColor: colors.gold }]}
                      onPress={handleGenerateInviteCode}
                      disabled={generatingCode}
                    >
                      {generatingCode ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Ionicons name="add" size={16} color="#000" />
                          <Text style={styles.adminActionBtnText}>Generate</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {inviteCodes.length === 0 ? (
                    <Text style={[styles.adminEmptyText, { color: colors.textSecondary }]}>
                      No active invite codes. Generate one to invite members.
                    </Text>
                  ) : (
                    inviteCodes.map((code, index) => (
                      <View
                        key={code.code || index}
                        style={[styles.inviteCodeRow, { borderTopColor: colors.border }]}
                      >
                        <View style={styles.inviteCodeInfo}>
                          <Text style={[styles.inviteCodeText, { color: colors.text }]}>{code.code}</Text>
                          {code.expiresAt && (
                            <Text style={[styles.inviteCodeExpiry, { color: colors.textTertiary }]}>
                              Expires {new Date(code.expiresAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.inviteCodeActions}>
                          <TouchableOpacity
                            style={[styles.inviteCodeActionBtn, { backgroundColor: `${colors.info}15` }]}
                            onPress={() => handleCopyCode(code.code)}
                          >
                            <Ionicons name="copy-outline" size={16} color={colors.info} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.inviteCodeActionBtn, { backgroundColor: `${colors.error}15` }]}
                            onPress={() => handleRevokeCode(code.code)}
                          >
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </Animated.View>

                {/* Members Section */}
                <Animated.View
                  entering={FadeInUp.delay(100).duration(400)}
                  style={[styles.adminSection, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.adminSectionHeader}>
                    <View style={styles.adminSectionTitleRow}>
                      <Ionicons name="people-outline" size={20} color={colors.gold} />
                      <Text style={[styles.adminSectionTitle, { color: colors.text }]}>
                        Members ({members.length})
                      </Text>
                    </View>
                  </View>

                  {members.length === 0 ? (
                    <Text style={[styles.adminEmptyText, { color: colors.textSecondary }]}>
                      No members yet.
                    </Text>
                  ) : (
                    members.map((member, index) => (
                      <View
                        key={member.id || index}
                        style={[styles.memberRow, { borderTopColor: colors.border }]}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: `${colors.gold}15` }]}>
                          <Text style={[styles.memberAvatarText, { color: colors.gold }]}>
                            {(member.name || member.email || 'U')[0].toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={[styles.memberName, { color: colors.text }]}>
                            {member.name || member.email || 'Unknown'}
                          </Text>
                          <View style={styles.memberRoleRow}>
                            <View
                              style={[
                                styles.memberRoleBadge,
                                { backgroundColor: member.role === 'admin' ? `${colors.gold}15` : `${colors.textTertiary}15` },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.memberRoleText,
                                  { color: member.role === 'admin' ? colors.gold : colors.textSecondary },
                                ]}
                              >
                                {member.role === 'admin' ? 'Admin' : 'Member'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.memberActions}>
                          <TouchableOpacity
                            style={[styles.memberActionBtn, { backgroundColor: `${colors.info}15` }]}
                            onPress={() => handleToggleMemberRole(member.id, member.role)}
                          >
                            <Ionicons
                              name={member.role === 'admin' ? 'arrow-down' : 'arrow-up'}
                              size={14}
                              color={colors.info}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.memberActionBtn, { backgroundColor: `${colors.error}15` }]}
                            onPress={() => handleRemoveMember(member.id, member.name || 'this member')}
                          >
                            <Ionicons name="person-remove-outline" size={14} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </Animated.View>

                {/* Announcements Management Section */}
                <Animated.View
                  entering={FadeInUp.delay(200).duration(400)}
                  style={[styles.adminSection, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.adminSectionHeader}>
                    <View style={styles.adminSectionTitleRow}>
                      <Ionicons name="megaphone-outline" size={20} color={colors.gold} />
                      <Text style={[styles.adminSectionTitle, { color: colors.text }]}>Announcements</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.adminActionBtn, { backgroundColor: colors.gold }]}
                      onPress={() => setShowAnnouncementModal(true)}
                    >
                      <Ionicons name="add" size={16} color="#000" />
                      <Text style={styles.adminActionBtnText}>New</Text>
                    </TouchableOpacity>
                  </View>

                  {announcements.length === 0 ? (
                    <Text style={[styles.adminEmptyText, { color: colors.textSecondary }]}>
                      No announcements. Create one to communicate with members.
                    </Text>
                  ) : (
                    announcements.map((announcement, index) => (
                      <View
                        key={announcement.id || index}
                        style={[styles.announcementManageRow, { borderTopColor: colors.border }]}
                      >
                        <View style={styles.announcementManageInfo}>
                          {announcement.pinned && (
                            <View style={[styles.pinnedIndicator, { backgroundColor: `${colors.info}15` }]}>
                              <Ionicons name="pin" size={10} color={colors.info} />
                            </View>
                          )}
                          <Text style={[styles.announcementManageTitle, { color: colors.text }]} numberOfLines={1}>
                            {announcement.title}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.announcementDeleteBtn, { backgroundColor: `${colors.error}15` }]}
                          onPress={() => handleDeleteAnnouncement(announcement.id, announcement.title)}
                        >
                          <Ionicons name="trash-outline" size={14} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </Animated.View>
              </>
            )}
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Create Proposal Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Proposal</Text>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: creating ? colors.textTertiary : colors.gold }]}
              onPress={handleCreateProposal}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Limits Display */}
            {proposalLimits && (
              <View style={[styles.limitsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="analytics-outline" size={18} color={colors.gold} />
                <Text style={[styles.limitsText, { color: colors.textSecondary }]}>
                  {proposalLimits.created} of {proposalLimits.limit} proposals this {proposalLimits.period}
                </Text>
              </View>
            )}

            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="What are you proposing?"
                placeholderTextColor={colors.textTertiary}
                value={newProposal.title}
                onChangeText={(text) => setNewProposal((prev) => ({ ...prev, title: text }))}
                maxLength={100}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {newProposal.title.length}/100
              </Text>
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Provide details about your proposal..."
                placeholderTextColor={colors.textTertiary}
                value={newProposal.description}
                onChangeText={(text) => setNewProposal((prev) => ({ ...prev, description: text }))}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {newProposal.description.length}/1000
              </Text>
            </View>

            {/* Category Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: newProposal.category === cat ? colors.gold : colors.surface,
                        borderColor: newProposal.category === cat ? colors.gold : colors.border,
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewProposal((prev) => ({ ...prev, category: cat }));
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: newProposal.category === cat ? '#000' : colors.textSecondary },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Official Notice */}
            <View style={[styles.officialNotice, { backgroundColor: `${colors.gold}10`, borderColor: `${colors.gold}30` }]}>
              <Ionicons name="ribbon" size={18} color={colors.gold} />
              <Text style={[styles.officialNoticeText, { color: colors.gold }]}>
                This proposal will be marked as an official proposal from {organization?.name}
              </Text>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Announcement Modal */}
      <Modal
        visible={showAnnouncementModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAnnouncementModal(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowAnnouncementModal(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Announcement</Text>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: creatingAnnouncement ? colors.textTertiary : colors.gold }]}
              onPress={handleCreateAnnouncement}
              disabled={creatingAnnouncement}
            >
              {creatingAnnouncement ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Title Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Announcement title"
                placeholderTextColor={colors.textTertiary}
                value={newAnnouncement.title}
                onChangeText={(text) => setNewAnnouncement((prev) => ({ ...prev, title: text }))}
                maxLength={100}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {newAnnouncement.title.length}/100
              </Text>
            </View>

            {/* Content Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Content</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Write your announcement..."
                placeholderTextColor={colors.textTertiary}
                value={newAnnouncement.content}
                onChangeText={(text) => setNewAnnouncement((prev) => ({ ...prev, content: text }))}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text style={[styles.charCount, { color: colors.textTertiary }]}>
                {newAnnouncement.content.length}/2000
              </Text>
            </View>

            {/* Pin Toggle */}
            <View style={[styles.pinToggleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.pinToggleInfo}>
                <Ionicons name="pin" size={20} color={colors.gold} />
                <View>
                  <Text style={[styles.pinToggleLabel, { color: colors.text }]}>Pin Announcement</Text>
                  <Text style={[styles.pinToggleHint, { color: colors.textSecondary }]}>
                    Pinned announcements appear at the top
                  </Text>
                </View>
              </View>
              <Switch
                value={newAnnouncement.pinned}
                onValueChange={(value) => setNewAnnouncement((prev) => ({ ...prev, pinned: value }))}
                trackColor={{ false: colors.border, true: colors.gold }}
                thumbColor="#fff"
              />
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  tabsScrollView: {
    marginBottom: SPACING.lg,
    marginHorizontal: -SPACING.lg,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
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
  proposalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  proposalDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Admin Create Proposal Button
  createProposalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  createProposalBtnText: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    fontWeight: '700',
  },
  limitBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: SPACING.xs,
  },
  limitBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '600',
    fontSize: 10,
  },

  // Create Proposal Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  modalSubmitBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 70,
    alignItems: 'center',
  },
  modalSubmitBtnText: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  limitsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  limitsText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
  },
  inputGroup: {
    marginBottom: SPACING.xl,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.sm,
  },
  textInput: {
    ...TYPOGRAPHY.bodyMedium,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  textArea: {
    ...TYPOGRAPHY.bodyMedium,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    minHeight: 120,
  },
  charCount: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  categoryScroll: {
    marginHorizontal: -SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  categoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  categoryChipText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  officialNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  officialNoticeText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 20,
  },

  // Admin Panel Styles
  adminLoadingContainer: {
    paddingVertical: SPACING.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminSection: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  adminSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  adminSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  adminSectionTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xxs,
  },
  adminActionBtnText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '600',
  },
  adminEmptyText: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },

  // Invite Codes
  inviteCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    marginTop: SPACING.md,
    borderTopWidth: 1,
  },
  inviteCodeInfo: {
    flex: 1,
  },
  inviteCodeText: {
    ...TYPOGRAPHY.labelMedium,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  inviteCodeExpiry: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
  inviteCodeActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  inviteCodeActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.md,
    marginTop: SPACING.md,
    borderTopWidth: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  memberAvatarText: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
    marginBottom: 2,
  },
  memberRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberRoleBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  memberRoleText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 10,
    fontWeight: '600',
  },
  memberActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  memberActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Announcements Management
  announcementManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: SPACING.md,
    marginTop: SPACING.md,
    borderTopWidth: 1,
  },
  announcementManageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.sm,
  },
  pinnedIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementManageTitle: {
    ...TYPOGRAPHY.labelMedium,
    flex: 1,
  },
  announcementDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Pin Toggle in Modal
  pinToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  pinToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  pinToggleLabel: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },
  pinToggleHint: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
});
