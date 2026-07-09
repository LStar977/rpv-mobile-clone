import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Image, Modal } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuthStore } from '../../lib/auth';
import { FONTS, RADIUS, SPACING, useTheme } from '../../lib/theme';
import { organizationsApi, Organization } from '../../lib/api';
import { UpgradeModal } from '../../components/ui/UpgradeModal';

// ─── helpers ──────────────────────────────────────────────────────────
function monogramFromName(name: string): string {
  const parts = (name || '').split(/\s+/).filter(Boolean);
  if (!parts.length) return 'O';
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

// Open = not explicitly closed/decided and deadline (if any) in the future.
function isOpenProposal(p: any): boolean {
  const s = (p?.status || '').toLowerCase();
  if (['passed', 'approved', 'failed', 'rejected', 'closed', 'archived'].includes(s)) return false;
  if (p?.deadline) {
    const d = new Date(p.deadline);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now()) return false;
  }
  return true;
}

// ─── atoms ────────────────────────────────────────────────────────────
function VerifiedTick({ size = 13 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={6.4} fill={colors.supportSurface} stroke={colors.support} strokeWidth={0.6} />
      <Path d="M4.2 7.2l2 2 3.6-4" stroke={colors.support} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function RoleChip({ role }: { role: 'admin' | 'member' }) {
  const { colors } = useTheme();
  const isAdmin = role === 'admin';
  return (
    <View style={{
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.chip,
      backgroundColor: isAdmin ? colors.goldFill : colors.surfaceHighlight,
    }}>
      <Text style={{
        fontFamily: FONTS.sansSemiBold, fontSize: 9.5, letterSpacing: 1.14,
        color: isAdmin ? '#040707' : colors.textSecondary,
      }}>{isAdmin ? 'ADMIN' : 'MEMBER'}</Text>
    </View>
  );
}

function OpenVotesChip({ count }: { count: number }) {
  const { colors } = useTheme();
  if (count <= 0) {
    return (
      <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 10.5, color: colors.textTertiary }}>
        No open votes
      </Text>
    );
  }
  return (
    <View style={{
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.chip,
      backgroundColor: colors.goldSurface,
      borderWidth: 1, borderColor: colors.goldSurfaceStrong,
    }}>
      <Text style={{
        fontFamily: FONTS.sansSemiBold, fontSize: 9.5, letterSpacing: 1.14,
        color: colors.gold, fontVariant: ['tabular-nums'],
      }}>{count} OPEN {count === 1 ? 'VOTE' : 'VOTES'}</Text>
    </View>
  );
}

// ─── header ───────────────────────────────────────────────────────────
function HubHeader({ onAddPress }: { onAddPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ gap: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{
          fontFamily: FONTS.serif, fontSize: 32, lineHeight: 35,
          letterSpacing: -0.38, color: colors.text,
        }}>
          Organizations
        </Text>
        <TouchableOpacity
          onPress={onAddPress}
          activeOpacity={0.7}
          accessibilityLabel="Add organization"
          style={{
            width: 40, height: 40, borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1, borderColor: colors.borderSubtle,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={19} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={{ fontFamily: FONTS.sans, fontSize: 14, lineHeight: 21, color: colors.textSecondary }}>
        Verified governance for the groups you belong to.
      </Text>
    </Animated.View>
  );
}

// ─── ORG CARD ─────────────────────────────────────────────────────────
function OrgLogo({ name, logoUrl, size = 42 }: { name: string; logoUrl?: string; size?: number }) {
  const { colors } = useTheme();
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: 13, backgroundColor: colors.surfaceHighlight }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: 13,
      backgroundColor: colors.surfaceHighlight,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontFamily: FONTS.serifSemiBold, fontSize: 15, color: colors.text }}>
        {monogramFromName(name)}
      </Text>
    </View>
  );
}

function OrgCard({ org, openVotes, onPress, index }: {
  org: Organization;
  openVotes: number | undefined;
  onPress: () => void;
  index: number;
}) {
  const { colors } = useTheme();
  const memberCount = org.memberCount ?? 0;
  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        <View style={{
          backgroundColor: colors.surface,
          borderWidth: 1, borderColor: colors.borderSubtle,
          borderRadius: RADIUS.card,
          paddingHorizontal: 18, paddingVertical: 17,
          gap: 11,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <OrgLogo name={org.name} logoUrl={org.logoUrl} size={42} />
            <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text numberOfLines={1} style={{
                  fontFamily: FONTS.sansSemiBold, fontSize: 15, color: colors.text, flexShrink: 1,
                }}>
                  {org.name || 'Unnamed organization'}
                </Text>
                {org.verified && <VerifiedTick size={13} />}
              </View>
              <Text style={{
                fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 10.5,
                color: colors.textTertiary, letterSpacing: 0.2,
              }}>
                {memberCount.toLocaleString()} {memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
              </Text>
            </View>
          </View>
          {!!org.description && (
            <Text numberOfLines={2} style={{
              fontFamily: FONTS.sans, fontSize: 12.5, color: colors.textSecondary, lineHeight: 17.5,
            }}>
              {org.description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <RoleChip role={org.role === 'admin' ? 'admin' : 'member'} />
            {openVotes !== undefined && <OpenVotesChip count={openVotes} />}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── join / create entries ────────────────────────────────────────────
function JoinInviteCard({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={{
        borderWidth: 1.5, borderColor: colors.borderStrong, borderStyle: 'dashed',
        borderRadius: RADIUS.card,
        paddingHorizontal: 18, paddingVertical: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9,
      }}
    >
      <Ionicons name="mail-outline" size={16} color={colors.textSecondary} />
      <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 13.5, color: colors.textSecondary }}>
        Join With an Invite Code
      </Text>
    </TouchableOpacity>
  );
}

// ─── empty state ──────────────────────────────────────────────────────
function EmptyLedger({ onJoinPress, onCreatePress }: { onJoinPress: () => void; onCreatePress: () => void }) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: RADIUS.card,
        borderWidth: 1, borderColor: colors.borderSubtle,
        paddingHorizontal: 24, paddingTop: 36, paddingBottom: 28,
      }}>
        <View style={{
          alignSelf: 'center', width: 64, height: 64, borderRadius: 32,
          backgroundColor: colors.surfaceHighlight,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <Ionicons name="people-outline" size={28} color={colors.gold} />
        </View>

        <Text style={{
          fontFamily: FONTS.serif, fontSize: 24,
          color: colors.text, letterSpacing: -0.3, lineHeight: 28,
          textAlign: 'center', marginBottom: 8,
        }}>
          No organizations yet
        </Text>
        <Text style={{
          fontFamily: FONTS.sans,
          fontSize: 13, color: colors.textSecondary, lineHeight: 19,
          textAlign: 'center', maxWidth: 280, alignSelf: 'center', marginBottom: 22,
        }}>
          Join one with an invite code from your union, school, or community group — or start your own.
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onJoinPress}
          style={{
            height: 50,
            backgroundColor: colors.goldFill, borderRadius: 15,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 10,
          }}
        >
          <Ionicons name="key-outline" size={15} color="#040707" />
          <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 15, color: '#040707' }}>
            Enter Invite Code
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCreatePress}
          style={{
            height: 48,
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1, borderColor: colors.border,
            borderRadius: RADIUS.button,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 13.5, color: colors.text }}>
            Start a New Organization
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── invite sheet ─────────────────────────────────────────────────────
function InviteSheet({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (org: Organization) => void;
}) {
  const { colors } = useTheme();
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  // The joiner can't fix a member-cap error themselves — only the org admin
  // can upgrade. Show an explanatory modal instead of a generic Alert.
  const [orgFullModal, setOrgFullModal] = useState<{ visible: boolean; details?: any }>({ visible: false });
  const insets = useSafeAreaInsets();

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
        if (result.errorCode === 'MEMBER_LIMIT_EXCEEDED') {
          setOrgFullModal({ visible: true, details: result.errorDetails });
          return;
        }
        Alert.alert('Error', result.error);
        return;
      }
      if (result.data?.organization) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSuccess(result.data.organization);
        setInviteCode('');
        onClose();
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to join organization. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const codeLen = inviteCode.length;
  const lengthOk = codeLen >= 6 && codeLen <= 12;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        <View style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          backgroundColor: colors.surfaceElevated,
          borderTopLeftRadius: RADIUS.modal, borderTopRightRadius: RADIUS.modal,
          borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border,
          paddingTop: 12,
          paddingBottom: 36 + insets.bottom,
          shadowColor: '#000', shadowOffset: { width: 0, height: -20 },
          shadowOpacity: 0.6, shadowRadius: 60, elevation: 24,
        }}>
          {/* grabber */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: 18 }} />

          {/* title + close */}
          <View style={{ paddingHorizontal: 24, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={{
              fontFamily: FONTS.serif, fontSize: 24,
              color: colors.text, letterSpacing: -0.3, lineHeight: 28, flex: 1,
            }}>
              Join with an invite code
            </Text>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close"
              style={{
                width: 32, height: 32, borderRadius: 16,
                borderWidth: 1, borderColor: colors.borderSubtle,
                backgroundColor: colors.surface,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* copy */}
          <Text style={{
            paddingHorizontal: 24, fontFamily: FONTS.sans, fontSize: 13, color: colors.textSecondary,
            lineHeight: 19, marginBottom: 18,
          }}>
            Ask an admin of your union, school, or community group for their invite code.
          </Text>

          {/* code field */}
          <View style={{ paddingHorizontal: 24, marginBottom: 14 }}>
            <View style={{
              borderWidth: 1.5, borderColor: lengthOk ? colors.goldFill : colors.border,
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 15,
              paddingLeft: 46, paddingRight: 16, paddingVertical: 16,
            }}>
              <View style={{
                position: 'absolute', left: 14, top: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="key-outline" size={17} color={colors.gold} />
              </View>
              <TextInput
                style={{
                  fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 22,
                  letterSpacing: 6, color: colors.text,
                  padding: 0,
                }}
                placeholder="ENTER CODE"
                placeholderTextColor={colors.textTertiary}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                selectionColor={colors.gold}
              />
            </View>
            <Text style={{ fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, letterSpacing: 0.6, marginTop: 8, textAlign: 'right' }}>
              {codeLen} / 12
            </Text>
          </View>

          {/* primary action */}
          <View style={{ paddingHorizontal: 24 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleJoin}
              disabled={joining || !lengthOk}
              style={{
                height: 54,
                backgroundColor: colors.goldFill,
                opacity: lengthOk ? 1 : 0.35,
                borderRadius: 15,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                gap: 8,
              }}
            >
              {joining ? (
                <ActivityIndicator size="small" color="#040707" />
              ) : (
                <>
                  <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#040707' }}>
                    Join Organization
                  </Text>
                  <Ionicons name="arrow-forward" size={15} color="#040707" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <UpgradeModal
        visible={orgFullModal.visible}
        onClose={() => setOrgFullModal({ visible: false })}
        type="orgTier"
        title="Organization is full"
        message={
          orgFullModal.details?.limit
            ? `This organization has reached its plan limit (${orgFullModal.details.currentMembers}/${orgFullModal.details.limit} members on the ${orgFullModal.details.tier ?? 'current'} plan). Contact the organization admin to upgrade.`
            : 'This organization has reached its member limit. Contact the organization admin to upgrade their plan.'
        }
        hideCta
        hidePrice
      />
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ── Groups screen (Organizations hub) ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export default function GroupsScreen() {
  const { token } = useAuthStore();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  // Count each org's open ballots so the hub cards can show "N OPEN VOTES"
  // honestly. Failures leave the count unknown (chip hidden) rather than
  // showing a fake zero.
  const fetchOpenCounts = useCallback(async (orgs: Organization[]) => {
    const entries = await Promise.all(
      orgs.map(async (o) => {
        try {
          const result = await organizationsApi.getOrganizationProposals(o.id);
          if (!result.data) return null;
          return [o.id, result.data.filter(isOpenProposal).length] as const;
        } catch {
          return null;
        }
      })
    );
    const next: Record<string, number> = {};
    entries.forEach((e) => { if (e) next[e[0]] = e[1]; });
    setOpenCounts(next);
  }, []);

  const fetchOrganizations = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const result = await organizationsApi.getMyOrganizations();
      if (result.data) {
        setOrganizations(result.data);
        fetchOpenCounts(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, fetchOpenCounts]);

  useFocusEffect(useCallback(() => { fetchOrganizations(); }, [fetchOrganizations]));

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchOrganizations();
  }, [fetchOrganizations]);

  const adminCount = useMemo(
    () => organizations.filter((o) => o.role === 'admin').length,
    [organizations]
  );

  const handleOrgPress = (org: Organization) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/modals/organization-detail',
      params: { orgId: org.id, orgName: org.name, orgRole: org.role || 'member' },
    });
  };

  const handleCharter = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/modals/create-organization');
  };

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Add organization', undefined, [
      { text: 'Join with invite code', onPress: () => setShowInviteSheet(true) },
      { text: 'Start a new organization', onPress: handleCharter },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleInviteSuccess = (org: Organization) => {
    setOrganizations((prev) => [...prev, org]);
    Alert.alert('Welcome!', `You've been admitted to ${org.name}.`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={colors.gold} />
        <Text style={{ fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 10, color: colors.textTertiary, letterSpacing: 1.4, marginTop: 12, textTransform: 'uppercase' }}>
          Loading
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingHorizontal: SPACING.screenPadding,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      >
        <HubHeader onAddPress={handleAdd} />

        {organizations.length === 0 ? (
          <EmptyLedger
            onJoinPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowInviteSheet(true);
            }}
            onCreatePress={handleCharter}
          />
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{
                fontFamily: FONTS.sansSemiBold, fontSize: 11, letterSpacing: 1.54,
                textTransform: 'uppercase', color: colors.textTertiary,
              }}>
                Your organizations
              </Text>
              <Text style={{
                fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 10.5,
                color: colors.textTertiary, letterSpacing: 0.4,
              }}>
                {organizations.length}{adminCount > 0 ? ` · ADMIN IN ${adminCount}` : ''}
              </Text>
            </View>

            <View style={{ gap: 12, marginBottom: 16 }}>
              {organizations.map((org, i) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  openVotes={openCounts[org.id]}
                  index={i}
                  onPress={() => handleOrgPress(org)}
                />
              ))}
            </View>

            <JoinInviteCard
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowInviteSheet(true);
              }}
            />

            <TouchableOpacity
              onPress={handleCharter}
              activeOpacity={0.7}
              style={{ alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 10 }}
            >
              <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13, color: colors.textSecondary }}>
                or start a new organization →
              </Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>

      {showInviteSheet && (
        <InviteSheet
          onClose={() => setShowInviteSheet(false)}
          onSuccess={handleInviteSuccess}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
