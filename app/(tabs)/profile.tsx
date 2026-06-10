import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ThemePreference, responsive } from '../../lib/theme';
import { Button, TierBadge } from '../../components/ui';
import { adminApi, organizationsApi, userApi, veriffApi } from '../../lib/api';
import { restorePurchases } from '../../lib/iap';
import { PassportCard, type PassportStatus } from '../../components/identity/PassportCard';
import { useTutorialStore } from '../../lib/tutorial';
import type { UserTier } from '../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// ── Profile colors - static fallbacks for StyleSheet ─────────────────
// These are dark mode defaults; components override with useProfileColors()
const PR_G = '#EABA58';
const PR_GD = '#C89A3E';
const PR_GL = '#F4D28C';
const PR_BG = '#040707';
const PR_BG_CARD = '#0D0F12';
const PR_BG_RAISED = '#15181C';
const PR_LINE = '#1E2228';
const PR_LINE_STRONG = '#2A2F37';
const PR_FG = '#F4F5F6';
const PR_FG_MUTED = '#C7CACD';
const PR_FG_FAINT = '#8E9297';
const PR_GREEN = '#34C759';

// Dynamic hook for components to get theme-aware colors
function useProfileColors() {
  const { colors } = useTheme();
  return {
    G: colors.gold,
    GD: colors.goldDark,
    GL: colors.goldLight,
    BG: colors.background,
    BG_CARD: colors.surface,
    BG_RAISED: colors.surfaceElevated,
    LINE: colors.border,
    LINE_STRONG: colors.borderStrong,
    FG: colors.text,
    FG_MUTED: colors.textSecondary,
    FG_FAINT: colors.textTertiary,
    GREEN: colors.success,
  };
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Menu Item Component
function MenuItem({
  icon,
  label,
  onPress,
  delay = 0,
  showBorder = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  delay?: number;
  showBorder?: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(delay).duration(300)}
      style={[
        styles.menuItem,
        { borderBottomColor: showBorder ? colors.border : 'transparent' },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <View style={[styles.menuIconBg, { backgroundColor: `${colors.gold}15` }]}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </AnimatedTouchable>
  );
}

function ThemeChip({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: ThemePreference;
  selected: boolean;
  onPress: (v: ThemePreference) => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 16, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.themeChip,
        {
          backgroundColor: selected ? colors.gold : colors.surface,
          borderColor: selected ? colors.gold : colors.border,
        },
        animatedStyle,
      ]}
      onPress={() => onPress(value)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Text style={[styles.themeChipText, { color: selected ? '#000' : colors.text }]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ PREMIUM PROFILE UI COMPONENTS ═════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

// ── Premium Eyebrow ──────────────────────────────────────────────────
function PrEyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const pr = useProfileColors();
  return (
    <Text style={{
      fontFamily: 'System',
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      color: color || pr.FG_FAINT,
    }}>{children}</Text>
  );
}

// ── Header ───────────────────────────────────────────────────────────
function PrHeader({ folio }: { folio: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={prStyles.header}>
      <PrEyebrow>Profile</PrEyebrow>
    </Animated.View>
  );
}

// ── Section Heading ──────────────────────────────────────────────────
function PrSectionHeading({ roman, title, sub }: { roman?: string; title: string; sub?: string }) {
  const pr = useProfileColors();
  return (
    <View style={prStyles.sectionHeading}>
      {roman && <Text style={[prStyles.sectionRoman, { color: pr.FG_FAINT }]}>{roman}</Text>}
      <View style={{ flex: 1 }}>
        <Text style={[prStyles.sectionTitle, { color: pr.FG }]}>{title}</Text>
        {sub && <Text style={[prStyles.sectionSub, { color: pr.FG_FAINT }]}>{sub}</Text>}
      </View>
    </View>
  );
}

// ── Directory Row ────────────────────────────────────────────────────
function PrRow({
  icon,
  label,
  sub,
  value,
  valueColor,
  last,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const pr = useProfileColors();
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={[prStyles.row, !last && { borderBottomWidth: 1, borderBottomColor: pr.LINE }]}
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
    >
      <View style={[prStyles.rowIcon, { backgroundColor: pr.BG_RAISED, borderColor: pr.LINE }]}>
        <Ionicons name={icon} size={18} color={pr.GL} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[prStyles.rowLabel, { color: pr.FG }]}>{label}</Text>
        {sub && <Text style={[prStyles.rowSub, { color: pr.FG_FAINT }]}>{sub}</Text>}
      </View>
      {value && <Text style={[prStyles.rowValue, { color: valueColor || pr.FG_MUTED }]}>{value}</Text>}
      {onPress && <Ionicons name="chevron-forward" size={14} color={pr.FG_FAINT} />}
    </Container>
  );
}

// ── Section Card Wrapper ─────────────────────────────────────────────
function PrSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const pr = useProfileColors();
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={prStyles.section}>
      <View style={[prStyles.sectionCard, { backgroundColor: pr.BG_CARD, borderColor: pr.LINE }]}>
        {children}
      </View>
    </Animated.View>
  );
}

// ── Premium Appearance Picker ────────────────────────────────────────
function PrAppearance({
  currentTheme,
  onThemeChange,
}: {
  currentTheme: ThemePreference;
  onThemeChange: (t: ThemePreference) => void;
}) {
  const pr = useProfileColors();
  const themeLabel = currentTheme === 'system' ? 'System' : currentTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(400)} style={prStyles.section}>
      <View style={[prStyles.appearanceCard, { backgroundColor: pr.BG_CARD, borderColor: pr.LINE }]}>
        <Text style={[prStyles.appearanceLabel, { color: pr.FG_MUTED, marginBottom: 14 }]}>
          Currently set to <Text style={{ color: pr.GL, fontWeight: '600' }}>{themeLabel}</Text>
        </Text>
        <View style={prStyles.appearanceRow}>
          {(['system', 'dark', 'light'] as ThemePreference[]).map((mode) => {
            const active = currentTheme === mode;
            const label = mode.charAt(0).toUpperCase() + mode.slice(1);
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  prStyles.appearanceChip,
                  { borderColor: active ? pr.GD : pr.LINE_STRONG },
                  active && { backgroundColor: `${pr.G}2E` }
                ]}
                onPress={() => onThemeChange(mode)}
                activeOpacity={0.7}
              >
                <Text style={[
                  prStyles.appearanceChipText,
                  { color: active ? pr.GL : pr.FG_MUTED },
                  active && { fontWeight: '600' }
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// ── Sign Out Button ──────────────────────────────────────────────────
function PrSignOut({ onPress }: { onPress: () => void }) {
  const pr = useProfileColors();
  return (
    <Animated.View entering={FadeInUp.delay(500).duration(400)} style={prStyles.signOutContainer}>
      <TouchableOpacity style={[prStyles.signOutButton, { borderColor: pr.LINE_STRONG }]} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={14} color={pr.FG_MUTED} />
        <Text style={[prStyles.signOutText, { color: pr.FG_MUTED }]}>Sign out</Text>
      </TouchableOpacity>
      <Text style={[prStyles.footerVersion, { color: pr.FG_FAINT }]}>
        Represent <Text style={prStyles.footerVersionMono}>v1.0.0</Text>
      </Text>
    </Animated.View>
  );
}

// ── Premium Styles ───────────────────────────────────────────────────
const prStyles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  folioCode: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: PR_FG_FAINT,
    letterSpacing: 1,
  },

  // Portrait Card
  portraitCard: {
    marginHorizontal: 24,
    marginBottom: 28,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: PR_LINE_STRONG,
    padding: 24,
    paddingBottom: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  cornerTick: {
    position: 'absolute',
    width: 10,
    height: 10,
  },
  portraitMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  monogramContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  monogramGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
  },
  monogramText: {
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '500',
    color: '#1A1308',
    letterSpacing: 0.5,
  },
  monogramRing: {
    position: 'absolute',
    top: -5,
    left: -5,
  },
  portraitName: {
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '500',
    color: PR_FG,
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 4,
  },
  portraitEmail: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: PR_FG_MUTED,
    letterSpacing: 0.2,
  },

  // Membership strip
  membershipStrip: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: PR_LINE,
    flexDirection: 'row',
  },
  membershipCell: {
    flex: 1,
  },
  membershipLabel: {
    fontFamily: 'System',
    fontSize: 8.5,
    fontWeight: '600',
    color: PR_FG_FAINT,
    letterSpacing: 2,
    marginBottom: 4,
  },
  membershipValue: {
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: '500',
    color: PR_FG,
    letterSpacing: -0.1,
  },
  tierValue: {
    fontStyle: 'italic',
    color: PR_GL,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: PR_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },

  // Section
  section: {
    marginBottom: 22,
  },
  sectionHeading: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 10,
  },
  sectionRoman: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: PR_FG_FAINT,
    letterSpacing: 1.8,
  },
  sectionTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
    color: PR_FG,
    letterSpacing: -0.1,
  },
  sectionSub: {
    fontFamily: 'System',
    fontSize: 10.5,
    color: PR_FG_FAINT,
    marginTop: 3,
    letterSpacing: 0.05,
  },
  sectionCard: {
    backgroundColor: PR_BG_CARD,
    borderWidth: 1,
    borderColor: PR_LINE,
    borderRadius: 16,
    paddingHorizontal: 18,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: PR_LINE,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: PR_BG_RAISED,
    borderWidth: 1,
    borderColor: PR_LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '500',
    color: PR_FG,
    letterSpacing: -0.1,
  },
  rowSub: {
    fontFamily: 'System',
    fontSize: 12.5,
    color: PR_FG_FAINT,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '500',
  },

  // Appearance
  appearanceCard: {
    backgroundColor: PR_BG_CARD,
    borderWidth: 1,
    borderColor: PR_LINE,
    borderRadius: 16,
    padding: 18,
  },
  appearanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  appearanceLabel: {
    fontFamily: 'System',
    fontSize: 12,
    color: PR_FG_MUTED,
  },
  appearanceVersion: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: PR_FG_FAINT,
    letterSpacing: 1,
  },
  appearanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  appearanceChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PR_LINE_STRONG,
    alignItems: 'center',
  },
  appearanceChipActive: {
    borderColor: PR_GD,
    backgroundColor: `${PR_G}2E`,
  },
  appearanceChipText: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '500',
    color: PR_FG_MUTED,
    letterSpacing: -0.1,
  },
  appearanceChipTextActive: {
    fontWeight: '600',
    color: PR_GL,
  },

  // Sign out
  signOutContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    alignItems: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: PR_LINE_STRONG,
    borderRadius: 999,
  },
  signOutText: {
    fontFamily: 'Georgia',
    fontSize: 16,
    fontStyle: 'italic',
    color: PR_FG_MUTED,
    letterSpacing: -0.1,
  },
  footerVersion: {
    marginTop: 18,
    fontFamily: 'Georgia',
    fontSize: 12,
    fontStyle: 'italic',
    color: PR_FG_FAINT,
  },
  footerVersionMono: {
    fontFamily: 'Courier',
    fontStyle: 'normal',
  },
});

export default function ProfileScreen() {
  const { colors, themePreference, setThemePreference, isDark } = useTheme();
  const { user, logout, token, isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [userTier, setUserTier] = useState<UserTier>('free');
  const [refreshing, setRefreshing] = useState(false);
  const [badgesEarned, setBadgesEarned] = useState<number | null>(null);
  const [adminOrgCount, setAdminOrgCount] = useState<number | null>(null);
  const [votesCast, setVotesCast] = useState<number | null>(null);
  const [verification, setVerification] = useState<{ verified: boolean; status: PassportStatus; verifiedAt?: string | null; citizenshipVerified: boolean }>({
    verified: false,
    status: 'unverified',
    verifiedAt: null,
    citizenshipVerified: false,
  });
  const [profileLocation, setProfileLocation] = useState<{ country?: string; state?: string; city?: string } | null>(null);
  const [startingKyc, setStartingKyc] = useState(false);
  const { isActive: tutorialActive, completeAction: completeTutorialAction } = useTutorialStore();
  const BADGES_TOTAL = 15;

  // Fetch user's subscription tier
  const fetchTier = useCallback(async () => {
    const isDemoAccount = user?.email === 'demo@represent.app';
    if (isDemoAccount) {
      setUserTier('premium');
      return;
    }

    if (!token) return;

    // Source-agnostic check first: the auth user carries subscriptionStatus
    // from /api/auth/verify, updated by BOTH the Stripe webhook and the
    // Apple IAP receipt path. /api/stripe/subscription only knows Stripe,
    // so IAP-paid Premium users were shown "Free tier" here.
    if (user?.isPremium || user?.subscriptionStatus === 'active') {
      setUserTier('premium');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/stripe/subscription`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tier === 'premium' && data.status === 'active') {
          setUserTier('premium');
        } else if (data.verificationPaid || data.tier === 'verified') {
          setUserTier('verified');
        } else {
          setUserTier('free');
        }
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  }, [token, user?.email, user?.subscriptionStatus, user?.isPremium]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  // Live badge count for the profile menu row. Falls back to null on
  // failure so the row label degrades gracefully ("Badges & achievements").
  useEffect(() => {
    if (!token || !user?.id) return;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/badges/user/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const earned = await response.json();
          setBadgesEarned(Array.isArray(earned) ? earned.length : 0);
        }
      } catch {
        // Keep null; row will hide the count.
      }
    })();
  }, [token, user?.id]);

  // Live counts for Activity rows + verification status for the passport
  // card. Each falls back to null on failure so the row hides its secondary
  // label rather than showing a stale value.
  const fetchProfileData = useCallback(async () => {
    if (!token) return;
    try {
      const orgsRes = await organizationsApi.getMyOrganizations();
      if (Array.isArray(orgsRes.data)) {
        setAdminOrgCount(orgsRes.data.filter((o: any) => o.role === 'admin').length);
      }
    } catch { /* keep null */ }
    try {
      const votedRes = await userApi.getVotedProposals();
      if (Array.isArray(votedRes.data)) {
        setVotesCast(votedRes.data.length);
      }
    } catch { /* keep null */ }
    try {
      const [verRes, profRes] = await Promise.allSettled([
        userApi.getVerificationStatus(),
        userApi.getProfile(),
      ]);
      const isDemoAccount = user?.email === 'demo@represent.app';
      if (verRes.status === 'fulfilled') {
        const v = (verRes.value?.data || {}) as any;
        // citizenshipVerified comes from the user object on /api/auth/verify
        // (not the verification-status subset), so pick it off profRes too.
        const profUser: any = (profRes.status === 'fulfilled' ? profRes.value?.data : null) || {};
        setVerification({
          verified: isDemoAccount ? true : !!v.verified,
          status: isDemoAccount ? 'verified' : ((v.status as PassportStatus) || (v.verified ? 'verified' : 'unverified')),
          verifiedAt: isDemoAccount ? new Date().toISOString() : (v.verifiedAt || v.verified_at || null),
          citizenshipVerified: isDemoAccount
            ? true
            : !!(profUser.citizenshipVerified || profUser.citizenship_verified),
        });
      }
      if (profRes.status === 'fulfilled') {
        const p: any = profRes.value?.data || null;
        if (p) {
          setProfileLocation({ country: p.country, state: p.state, city: p.city });
        }
      }
    } catch { /* keep defaults */ }
  }, [token, user?.email]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useFocusEffect(
    useCallback(() => {
      fetchTier();
      fetchProfileData();
    }, [fetchTier, fetchProfileData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([fetchTier(), fetchProfileData()]);
    setRefreshing(false);
  }, [fetchTier, fetchProfileData]);

  const handleStartKyc = useCallback(() => {
    if (tutorialActive) {
      completeTutorialAction('tap-button');
      return;
    }
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to begin verification.');
      return;
    }
    if (verification.status === 'pending') {
      // Pending: re-fetch status instead of routing.
      fetchProfileData();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Route to the verification picker so the user can choose Standard or
    // Citizen verification.
    router.push('/modals/verification-payment');
  }, [tutorialActive, completeTutorialAction, isAuthenticated, verification.status, fetchProfileData]);

  // Citizenship row also goes through the picker so the choice + tradeoffs
  // are explicit. The user can pick Citizen if that's what they want.
  const handleStartCitizenKyc = useCallback(() => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to begin verification.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/modals/verification-payment');
  }, [isAuthenticated]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const navigateTo = (screen: string) => router.push(screen as any);

  const getLocationString = () => {
    // Demo account should use hardcoded location for App Store review
    const isDemoAccount = user?.email === 'demo@represent.app';
    if (isDemoAccount) {
      return 'Toronto, Ontario, Canada';
    }
    const parts = [
      profileLocation?.city || user?.city,
      profileLocation?.state || user?.state,
      profileLocation?.country || user?.country,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  const getMemberSinceShort = () => {
    if (!verification.verifiedAt) return 'Apr 2026';
    const d = new Date(verification.verifiedAt);
    if (Number.isNaN(d.getTime())) return 'Apr 2026';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  };

  // Get tier label for display
  const tierLabel = userTier === 'premium' ? 'Premium' : userTier === 'verified' ? 'Verified' : 'Free';

  // Generate folio code from user id
  const getFolioCode = () => {
    const base = user?.id?.slice(-4)?.toUpperCase() || '1719';
    return `${base}/2033`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Passport Card (replaces former PortraitCard) */}
        <PassportCard
          name={user?.name || 'Citizen'}
          location={getLocationString() || ''}
          verified={verification.verified}
          status={verification.status}
          folio={getFolioCode()}
          memberSince={getMemberSinceShort()}
          onVerify={handleStartKyc}
          startingKyc={startingKyc}
        />

        {/* Section I: Civic Record */}
        <PrSection delay={200}>
          <PrRow
            icon="shield-checkmark-outline"
            label="Citizenship"
            sub={verification.citizenshipVerified ? 'Verified citizen' : 'Passport + proof of address required for citizens-only proposals'}
            value={verification.citizenshipVerified ? 'Verified' : 'Verify'}
            valueColor={verification.citizenshipVerified ? colors.success : colors.goldLight}
            onPress={verification.citizenshipVerified ? undefined : handleStartCitizenKyc}
          />
          <PrRow icon="time-outline" label="Voting history" sub={votesCast !== null ? `${votesCast.toLocaleString()} ballots cast` : undefined} onPress={() => navigateTo('/modals/voting-history')} />
          <PrRow icon="analytics-outline" label="Analytics" sub="Patterns & impact" onPress={() => navigateTo('/modals/analytics')} />
          <PrRow icon="trophy-outline" label="Badges & achievements" value={badgesEarned !== null ? `${badgesEarned} / ${BADGES_TOTAL}` : undefined} valueColor={colors.goldLight} last onPress={() => navigateTo('/modals/badges')} />
        </PrSection>

        {/* Section II: Membership */}
        <PrSection delay={250}>
          <PrRow icon="card-outline" label="Subscription" sub={`${tierLabel} tier`} value="Upgrade" valueColor={colors.goldLight} onPress={() => navigateTo('/modals/subscription')} />
          {Platform.OS === 'ios' && (
            <PrRow
              icon="refresh-outline"
              label="Restore purchases"
              last={!adminApi.isAdmin()}
              onPress={async () => {
                const result = await restorePurchases(token);
                if (result.restored) {
                  Alert.alert('Purchases Restored', 'Your previous purchases have been restored successfully.');
                } else if (result.error) {
                  Alert.alert('Error', result.error);
                } else {
                  Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
                }
              }}
            />
          )}
        </PrSection>

        {/* Section III: Administration */}
        <PrSection delay={300}>
          {adminApi.isAdmin() && (
            <PrRow icon="shield-checkmark-outline" label="Admin dashboard" sub={adminOrgCount !== null ? `${adminOrgCount} organization${adminOrgCount === 1 ? '' : 's'}` : undefined} onPress={() => navigateTo('/modals/admin')} />
          )}
          <PrRow icon="settings-outline" label="Settings & privacy" onPress={() => navigateTo('/modals/privacy')} />
          <PrRow icon="document-text-outline" label="Legal" last onPress={() => navigateTo('/modals/legal')} />
        </PrSection>

        {/* Section IV: Appearance */}
        <PrAppearance currentTheme={themePreference} onThemeChange={setThemePreference} />

        {/* Sign Out */}
        <PrSignOut onPress={handleLogout} />

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    // paddingTop is set dynamically via insets
    paddingBottom: 40,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    padding: SPACING.xxxl,
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1.5,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  avatarText: { fontSize: 36, fontWeight: '700' },
  userName: { ...TYPOGRAPHY.headlineLarge, fontSize: responsive(20, 22, 24), marginBottom: SPACING.xs },
  userEmail: { ...TYPOGRAPHY.bodyMedium, marginBottom: SPACING.sm },
  tierBadgeContainer: {
    marginBottom: SPACING.lg,
  },

  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  locationText: { ...TYPOGRAPHY.labelMedium },

  // Menu Card
  menuCard: {
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.xl,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  menuLabel: {
    ...TYPOGRAPHY.bodyLarge,
    flex: 1,
    fontWeight: '500',
  },

  // Theme Card
  themeCard: {
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.sm,
  },
  themeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  themeIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
  },
  themeSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  themeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  themeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  themeChipText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '700',
  },

  // Logout
  logoutContainer: { marginBottom: SPACING.xl },
  versionText: { ...TYPOGRAPHY.bodySmall, textAlign: 'center' },
  bottomPadding: { height: 100 },
});
