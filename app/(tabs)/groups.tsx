import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl, Image, Modal } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path, Rect, Defs, Pattern, G } from 'react-native-svg';
import { useAuthStore } from '../../lib/auth';
import { FONTS } from '../../lib/theme';
import { organizationsApi, Organization } from '../../lib/api';
import { UpgradeModal } from '../../components/ui/UpgradeModal';

// ─── design tokens (matches PassportCard / Identity surface) ──────────
const G_GOLD = '#EABA58';
const G_GOLD_D = '#C89A3E';
const G_GOLD_L = '#F4D28C';
const G_BG = '#040707';
const G_BG_CARD = '#0D0F12';
const G_BG_RAISED = '#15181C';
const G_LINE = '#1E2228';
const G_LINE_STRONG = '#2A2F37';
const G_FG = '#F4F5F6';
const G_FG_MUTED = '#C7CACD';
const G_FG_FAINT = '#8E9297';
const G_GREEN = '#34C759';

const SERIF = FONTS.serif;
const MONO = FONTS.mono;

// ─── helpers ──────────────────────────────────────────────────────────
function monogramFromName(name: string): string {
  const parts = (name || '').split(/\s+/).filter(Boolean);
  if (!parts.length) return 'O';
  return parts[0][0].toUpperCase();
}

// ─── atoms ────────────────────────────────────────────────────────────
function Guilloche({ opacity = 0.07, color = G_GOLD, id = 'gguil' }: { opacity?: number; color?: string; id?: string }) {
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity }}
      preserveAspectRatio="none"
      viewBox="0 0 400 260"
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={id} x={0} y={0} width={40} height={40} patternUnits="userSpaceOnUse">
          <Path d="M 0 20 Q 10 0, 20 20 T 40 20" stroke={color} fill="none" strokeWidth={0.5} />
          <Path d="M 0 20 Q 10 40, 20 20 T 40 20" stroke={color} fill="none" strokeWidth={0.5} />
        </Pattern>
      </Defs>
      <Rect width={400} height={260} fill={`url(#${id})`} />
    </Svg>
  );
}

function CornerTicks({ color = G_GOLD, size = 8, weight = 1.2 }: { color?: string; size?: number; weight?: number }) {
  return (
    <>
      <View pointerEvents="none" style={{
        position: 'absolute', top: -1, left: -1, width: size, height: size,
        borderTopWidth: weight, borderLeftWidth: weight, borderColor: color,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', top: -1, right: -1, width: size, height: size,
        borderTopWidth: weight, borderRightWidth: weight, borderColor: color,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', bottom: -1, left: -1, width: size, height: size,
        borderBottomWidth: weight, borderLeftWidth: weight, borderColor: color,
      }} />
      <View pointerEvents="none" style={{
        position: 'absolute', bottom: -1, right: -1, width: size, height: size,
        borderBottomWidth: weight, borderRightWidth: weight, borderColor: color,
      }} />
    </>
  );
}

function GEyebrow({ children, color = G_FG_FAINT, style }: { children: React.ReactNode; color?: string; style?: any }) {
  return (
    <Text style={[{
      fontFamily: FONTS.sansSemiBold,
      fontSize: 9.5,
      letterSpacing: 2,
      textTransform: 'uppercase',
      color,
    }, style]}>{children}</Text>
  );
}

function VerifiedTick({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Circle cx={7} cy={7} r={6.4} fill="rgba(52,199,89,0.12)" stroke={G_GREEN} strokeWidth={0.6} />
      <Path d="M4.2 7.2l2 2 3.6-4" stroke={G_GREEN} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// ─── header ───────────────────────────────────────────────────────────
function GHeader({ stat, admins, onAddPress, insetTop }: { stat: number; admins: number; onAddPress: () => void; insetTop: number }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ paddingTop: insetTop + 12, paddingHorizontal: 24, paddingBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <Text style={{
          fontFamily: SERIF, fontSize: 38,
          letterSpacing: -0.8, lineHeight: 40, color: G_FG, flex: 1,
        }}>
          My{' '}
          <Text style={{ fontFamily: FONTS.serifItalic, color: G_GOLD_L }}>groups</Text>
        </Text>
        <TouchableOpacity
          onPress={onAddPress}
          activeOpacity={0.7}
          style={{
            width: 36, height: 36, borderRadius: 8,
            backgroundColor: G_BG_RAISED,
            borderWidth: 1, borderColor: G_LINE_STRONG,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="add" size={18} color={G_FG_MUTED} />
        </TouchableOpacity>
      </View>
      {stat > 0 && (
        <Text style={{ fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 13, color: G_FG_MUTED, letterSpacing: -0.05 }}>
          {stat} {stat === 1 ? 'organization' : 'organizations'}
          {admins > 0 && (
            <Text style={{ color: G_FG_FAINT }}> · admin in {admins}</Text>
          )}
        </Text>
      )}
    </Animated.View>
  );
}

// ─── ORG CARD ─────────────────────────────────────────────────────────
function OrgLogo({ name, logoUrl, size = 48 }: { name: string; logoUrl?: string; size?: number }) {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: 10, backgroundColor: G_BG_RAISED }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: 10,
      backgroundColor: G_BG_RAISED,
      borderWidth: 1, borderColor: G_LINE,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{
        fontFamily: FONTS.serifMediumItalic, fontSize: size * 0.46,
        color: G_GOLD_L, letterSpacing: -0.5,
      }}>
        {monogramFromName(name)}
      </Text>
    </View>
  );
}

function OrgCard({ org, onPress, index }: { org: Organization; onPress: () => void; index: number }) {
  const isAdmin = org.role === 'admin';
  const memberCount = org.memberCount ?? 0;
  const memberLabel = `${memberCount.toLocaleString()} ${memberCount === 1 ? 'member' : 'members'}`;
  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(280)}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        <View style={{
          backgroundColor: G_BG_CARD,
          borderWidth: 1, borderColor: G_LINE,
          borderRadius: 14,
          padding: 14,
          flexDirection: 'row', gap: 13, alignItems: 'flex-start',
        }}>
          <OrgLogo name={org.name} logoUrl={org.logoUrl} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: SERIF, fontSize: 17,
                  color: G_FG, lineHeight: 21, letterSpacing: -0.2,
                }}
              >
                {org.name || 'Unnamed organization'}
              </Text>
              {org.verified && <VerifiedTick size={13} />}
            </View>
            {!!org.description && (
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 12.5, color: G_FG_MUTED,
                  letterSpacing: -0.05, lineHeight: 17,
                  marginBottom: 6,
                }}
              >
                {org.description}
              </Text>
            )}
            <Text style={{ fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], fontSize: 12, color: G_FG_FAINT, letterSpacing: -0.05 }}>
              {memberLabel}
              {isAdmin && (
                <Text>
                  <Text style={{ color: G_FG_FAINT }}>  ·  </Text>
                  <Text style={{ fontFamily: FONTS.sansMedium, color: G_GOLD_L }}>Admin</Text>
                </Text>
              )}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={G_FG_FAINT} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── empty ledger ─────────────────────────────────────────────────────
function EmptyLedger({ onJoinPress, onCreatePress }: { onJoinPress: () => void; onCreatePress: () => void }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
      <View style={{
        position: 'relative',
        backgroundColor: G_BG_CARD,
        borderRadius: 18,
        borderWidth: 1, borderColor: G_LINE,
        paddingHorizontal: 24, paddingTop: 36, paddingBottom: 28,
        minHeight: 320,
      }}>
        {/* icon */}
        <View style={{
          alignSelf: 'center', width: 64, height: 64, borderRadius: 32,
          backgroundColor: G_BG_RAISED,
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 18,
        }}>
          <Ionicons name="people-outline" size={28} color={G_GOLD_L} />
        </View>

        <Text style={{
          fontFamily: SERIF, fontSize: 24,
          color: G_FG, letterSpacing: -0.3, lineHeight: 28,
          textAlign: 'center', marginBottom: 8,
        }}>
          No groups yet
        </Text>
        <Text style={{
          fontFamily: FONTS.sans,
          fontSize: 13, color: G_FG_MUTED, letterSpacing: -0.05, lineHeight: 19,
          textAlign: 'center', maxWidth: 280, alignSelf: 'center', marginBottom: 22,
        }}>
          Join one with an invite code from your union, school, or community group — or start your own.
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onJoinPress}
          style={{
            paddingHorizontal: 18, paddingVertical: 13,
            backgroundColor: G_GOLD, borderRadius: 999,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, marginBottom: 10,
          }}
        >
          <Ionicons name="key-outline" size={15} color="#0A0C0F" />
          <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#0A0C0F' }}>
            Enter invite code
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onCreatePress}
          style={{
            paddingHorizontal: 18, paddingVertical: 13,
            backgroundColor: 'transparent',
            borderWidth: 1, borderColor: G_GOLD_D,
            borderRadius: 999,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 14, color: G_GOLD }}>
            Start your own
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
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,7,7,0.7)' }]}
        />
      <View style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        backgroundColor: G_BG_CARD,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        borderTopWidth: 1, borderTopColor: G_GOLD_D,
        borderLeftWidth: 1, borderLeftColor: G_LINE_STRONG,
        borderRightWidth: 1, borderRightColor: G_LINE_STRONG,
        paddingTop: 12,
        paddingBottom: 36 + insets.bottom,
        shadowColor: '#000', shadowOffset: { width: 0, height: -20 },
        shadowOpacity: 0.6, shadowRadius: 60, elevation: 24,
      }}>
        {/* grabber */}
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: G_LINE_STRONG, alignSelf: 'center', marginBottom: 18 }} />

        {/* title + close */}
        <View style={{ paddingHorizontal: 22, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontFamily: SERIF, fontSize: 24,
              color: G_FG, letterSpacing: -0.3, lineHeight: 28,
            }}>
              Join with an{' '}
              <Text style={{ fontFamily: FONTS.serifMediumItalic, color: G_GOLD_L }}>invite code</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{
              width: 32, height: 32, borderRadius: 16,
              borderWidth: 1, borderColor: G_LINE_STRONG,
              backgroundColor: G_BG_RAISED,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={14} color={G_FG_FAINT} />
          </TouchableOpacity>
        </View>

        {/* copy */}
        <Text style={{
          paddingHorizontal: 22, fontFamily: FONTS.sans, fontSize: 13, color: G_FG_MUTED,
          letterSpacing: -0.05, lineHeight: 19, marginBottom: 18,
        }}>
          Ask an admin of your union, school, or community group for their invite code.
        </Text>

        {/* code field */}
        <View style={{ paddingHorizontal: 22, marginBottom: 14 }}>
          <View style={{
            position: 'relative',
            borderWidth: 1, borderColor: G_GOLD_D,
            backgroundColor: '#0A0C0F',
            borderRadius: 4,
            paddingLeft: 46, paddingRight: 16, paddingVertical: 18,
            shadowColor: G_GOLD, shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06, shadowRadius: 14,
          }}>
            <View style={{
              position: 'absolute', left: 14, top: 0, bottom: 0,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Svg width={18} height={18} viewBox="0 0 20 20">
                <Circle cx={7} cy={10} r={3.2} stroke={G_GOLD} strokeWidth={1.1} fill="none" />
                <Path d="M10 10h8M16 10v3M14 10v2" stroke={G_GOLD} strokeWidth={1.1} strokeLinecap="round" fill="none" />
              </Svg>
            </View>
            <TextInput
              style={{
                fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 22,
                letterSpacing: 6, color: G_GOLD_L,
                padding: 0,
              }}
              placeholder="ENTER CODE"
              placeholderTextColor="rgba(244,210,140,0.25)"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              selectionColor={G_GOLD}
            />
          </View>
          <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: G_FG_FAINT, letterSpacing: 0.6, marginTop: 8, textAlign: 'right' }}>
            {codeLen} / 12
          </Text>
        </View>

        {/* primary action */}
        <View style={{ paddingHorizontal: 22 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleJoin}
            disabled={joining || !lengthOk}
            style={{
              paddingHorizontal: 16, paddingVertical: 14,
              backgroundColor: lengthOk ? G_GOLD : 'rgba(234,186,88,0.3)',
              borderRadius: 999,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8,
            }}
          >
            {joining ? (
              <ActivityIndicator size="small" color="#0A0C0F" />
            ) : (
              <>
                <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#0A0C0F' }}>
                  Join organization
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#0A0C0F" />
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
// ── Groups screen ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════
export default function GroupsScreen() {
  const { token } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);

  const fetchOrganizations = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const result = await organizationsApi.getMyOrganizations();
      if (result.data) setOrganizations(result.data);
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

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
      <View style={[styles.container, { backgroundColor: G_BG, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={G_GOLD} />
        <Text style={{ fontFamily: MONO, fontVariant: ['tabular-nums'], fontSize: 10, color: G_FG_FAINT, letterSpacing: 1.4, marginTop: 12, textTransform: 'uppercase' }}>
          Loading
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: G_BG }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={G_GOLD}
          />
        }
      >
        <GHeader
          stat={organizations.length}
          admins={adminCount}
          onAddPress={handleAdd}
          insetTop={insets.top}
        />

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
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              {organizations.map((org, i) => (
                <OrgCard
                  key={org.id}
                  org={org}
                  index={i}
                  onPress={() => handleOrgPress(org)}
                />
              ))}
            </View>
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
