import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, Organization } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Organization Card Component
function OrganizationCard({
  organization,
  onPress,
  index,
}: {
  organization: Organization;
  onPress: () => void;
  index: number;
}) {
  const { colors } = useTheme();

  const getTierColor = () => {
    return organization.tier === 'professional' ? colors.gold : colors.success;
  };

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(index * 100).duration(400)}
      style={[styles.orgCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.orgCardContent}>
        {/* Logo */}
        <View style={[styles.orgLogo, { backgroundColor: `${getTierColor()}15` }]}>
          {organization.logoUrl ? (
            <Animated.Image
              source={{ uri: organization.logoUrl }}
              style={styles.orgLogoImage}
            />
          ) : (
            <Ionicons name="business" size={24} color={getTierColor()} />
          )}
        </View>

        {/* Info */}
        <View style={styles.orgInfo}>
          <View style={styles.orgNameRow}>
            <Text style={[styles.orgName, { color: colors.text }]} numberOfLines={1}>
              {organization.name || 'Unnamed Organization'}
            </Text>
            {organization.verified && (
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            )}
          </View>
          <Text style={[styles.orgDescription, { color: colors.textSecondary }]} numberOfLines={2}>
            {organization.description}
          </Text>
          <View style={styles.orgMeta}>
            <View style={styles.orgMetaItem}>
              <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
              <Text style={[styles.orgMetaText, { color: colors.textTertiary }]}>
                {organization.memberCount ?? 0} members
              </Text>
            </View>
            {organization.role === 'admin' && (
              <View style={[styles.roleBadge, { backgroundColor: `${colors.gold}15` }]}>
                <Text style={[styles.roleBadgeText, { color: colors.gold }]}>Admin</Text>
              </View>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </View>
    </AnimatedTouchable>
  );
}

// Empty State Component
function EmptyState({ onJoinPress, onCreatePress }: { onJoinPress: () => void; onCreatePress: () => void }) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.emptyIconBg, { backgroundColor: `${colors.gold}15` }]}>
        <Ionicons name="business-outline" size={48} color={colors.gold} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Organizations Yet</Text>
      <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
        Join an organization to access their proposals, announcements, and community features.
      </Text>
      <TouchableOpacity
        style={[styles.emptyButton, { backgroundColor: colors.gold }]}
        onPress={onJoinPress}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={20} color="#000" />
        <Text style={styles.emptyButtonText}>Join with Invite Code</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.emptyCreateButton, { borderColor: colors.gold }]}
        onPress={onCreatePress}
        activeOpacity={0.8}
      >
        <Ionicons name="business" size={18} color={colors.gold} />
        <Text style={[styles.emptyCreateButtonText, { color: colors.gold }]}>Create Your Own</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Join Organization Modal
function JoinOrganizationSheet({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: (org: Organization) => void;
}) {
  const { colors } = useTheme();
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setJoining(true);

    try {
      const result = await organizationsApi.joinWithInviteCode(inviteCode.trim().toUpperCase());

      if (result.error) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', result.error);
        return;
      }

      if (result.data?.organization) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess(result.data.organization);
        setInviteCode('');
        onClose();
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to join organization. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={[styles.joinSheet, { backgroundColor: colors.background }]}>
      <View style={[styles.joinSheetHandle, { backgroundColor: colors.border }]} />

      <Text style={[styles.joinSheetTitle, { color: colors.text }]}>Join Organization</Text>
      <Text style={[styles.joinSheetDescription, { color: colors.textSecondary }]}>
        Enter the invite code provided by your organization administrator.
      </Text>

      <View style={[styles.inviteCodeContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="key-outline" size={20} color={colors.textTertiary} />
        <TextInput
          style={[styles.inviteCodeInput, { color: colors.text }]}
          placeholder="Enter invite code"
          placeholderTextColor={colors.textTertiary}
          value={inviteCode}
          onChangeText={(text) => setInviteCode(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
        />
      </View>

      <View style={styles.joinSheetButtons}>
        <TouchableOpacity
          style={[styles.joinSheetCancelBtn, { borderColor: colors.border }]}
          onPress={onClose}
          disabled={joining}
        >
          <Text style={[styles.joinSheetCancelText, { color: colors.text }]}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.joinSheetJoinBtn, { backgroundColor: colors.gold, opacity: joining ? 0.6 : 1 }]}
          onPress={handleJoin}
          disabled={joining}
        >
          {joining ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="enter-outline" size={18} color="#000" />
              <Text style={styles.joinSheetJoinText}>Join</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={[styles.infoCard, { backgroundColor: `${colors.info}10`, borderColor: `${colors.info}25` }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.info} />
        <Text style={[styles.infoCardText, { color: colors.textSecondary }]}>
          Invite codes are case-insensitive and typically 6-12 characters. Contact your organization admin if you don't have one.
        </Text>
      </View>
    </View>
  );
}

export default function OrganizationsScreen() {
  const { colors } = useTheme();
  const { token } = useAuthStore();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showJoinSheet, setShowJoinSheet] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const result = await organizationsApi.getMyOrganizations();
      if (result.data) {
        setOrganizations(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchOrganizations();
  }, [fetchOrganizations]);

  const handleOrganizationPress = (org: Organization) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/modals/organization-detail',
      params: { orgId: org.id, orgName: org.name, orgRole: org.role },
    });
  };

  const handleJoinSuccess = (org: Organization) => {
    setOrganizations((prev) => [...prev, org]);
    Alert.alert('Welcome!', `You've successfully joined ${org.name}.`);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Organizations</Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowJoinSheet(true);
          }}
          style={[styles.addButton, { backgroundColor: `${colors.gold}15` }]}
        >
          <Ionicons name="add" size={22} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading organizations...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.gold}
            />
          }
        >
          {organizations.length === 0 ? (
            <EmptyState
              onJoinPress={() => setShowJoinSheet(true)}
              onCreatePress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/modals/create-organization');
              }}
            />
          ) : (
            <>
              {/* Stats Row */}
              <Animated.View entering={FadeInDown.duration(400)} style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: colors.gold }]}>{organizations.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Organizations</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.statValue, { color: colors.gold }]}>
                    {organizations.filter((o) => o.role === 'admin').length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Admin Roles</Text>
                </View>
              </Animated.View>

              {/* Organizations List */}
              {organizations.map((org, index) => (
                <OrganizationCard
                  key={org.id}
                  organization={org}
                  onPress={() => handleOrganizationPress(org)}
                  index={index}
                />
              ))}

              {/* Upsell Card for Organizations */}
              <Animated.View
                entering={FadeInUp.delay(organizations.length * 100 + 100).duration(400)}
                style={[styles.upsellCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}
              >
                <LinearGradient
                  colors={[`${colors.gold}10`, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={styles.upsellContent}>
                  <View style={[styles.upsellIcon, { backgroundColor: colors.gold }]}>
                    <Ionicons name="business" size={24} color="#000" />
                  </View>
                  <View style={styles.upsellText}>
                    <Text style={[styles.upsellTitle, { color: colors.text }]}>Create Your Organization</Text>
                    <Text style={[styles.upsellDescription, { color: colors.textSecondary }]}>
                      Start at $29/month for unions, nonprofits, and community groups.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.upsellButton, { borderColor: colors.gold }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/modals/create-organization');
                  }}
                >
                  <Text style={[styles.upsellButtonText, { color: colors.gold }]}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.gold} />
                </TouchableOpacity>
              </Animated.View>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      {/* Join Organization Sheet */}
      {showJoinSheet && (
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBackdrop}
            onPress={() => setShowJoinSheet(false)}
            activeOpacity={1}
          />
          <JoinOrganizationSheet
            visible={showJoinSheet}
            onClose={() => setShowJoinSheet(false)}
            onSuccess={handleJoinSuccess}
          />
        </View>
      )}
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
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  statValue: {
    ...TYPOGRAPHY.headlineLarge,
    fontWeight: '700',
  },
  statLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xxs,
  },

  // Organization Card
  orgCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  orgCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orgLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  orgLogoImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  orgInfo: {
    flex: 1,
  },
  orgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xxs,
  },
  orgName: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  orgDescription: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  orgMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  orgMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  orgMetaText: {
    ...TYPOGRAPHY.labelSmall,
  },
  roleBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  roleBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontSize: 10,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    marginTop: SPACING.xl,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.sm,
  },
  emptyDescription: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
    maxWidth: 280,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  emptyButtonText: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    fontWeight: '600',
  },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  emptyCreateButtonText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },

  // Upsell Card
  upsellCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    marginTop: SPACING.lg,
    overflow: 'hidden',
  },
  upsellContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  upsellIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  upsellText: {
    flex: 1,
  },
  upsellTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
    marginBottom: SPACING.xxs,
  },
  upsellDescription: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 18,
  },
  upsellButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1.5,
    gap: SPACING.sm,
  },
  upsellButtonText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Join Sheet
  joinSheet: {
    borderTopLeftRadius: BORDER_RADIUS.xxl,
    borderTopRightRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  joinSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  },
  joinSheetTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.sm,
  },
  joinSheetDescription: {
    ...TYPOGRAPHY.bodyMedium,
    marginBottom: SPACING.xl,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  inviteCodeInput: {
    flex: 1,
    ...TYPOGRAPHY.bodyLarge,
    letterSpacing: 2,
  },
  joinSheetButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  joinSheetCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  joinSheetCancelText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  joinSheetJoinBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
  },
  joinSheetJoinText: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
  },
  infoCardText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 20,
  },

  bottomSpacer: {
    height: 100,
  },
});
