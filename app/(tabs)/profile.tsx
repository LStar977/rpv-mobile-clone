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
import { adminApi } from '../../lib/api';
import { restorePurchases } from '../../lib/iap';
import type { UserTier } from '../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// ── Profile Premium Design Tokens ────────────────────────────────────
const PR_G = '#EABA58';       // Gold primary
const PR_GD = '#C89A3E';      // Gold dark
const PR_GL = '#F4D28C';      // Gold light
const PR_BG = '#040707';      // Background
const PR_BG_CARD = '#0D0F12'; // Card background
const PR_BG_RAISED = '#15181C'; // Raised surface
const PR_LINE = '#1E2228';    // Border/line
const PR_LINE_STRONG = '#2A2F37'; // Strong border
const PR_FG = '#F4F5F6';      // Primary text
const PR_FG_MUTED = '#C7CACD'; // Secondary text
const PR_FG_FAINT = '#8E9297'; // Tertiary text
const PR_GREEN = '#34C759';   // Success/active

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
function PrEyebrow({ children, color = PR_FG_FAINT }: { children: React.ReactNode; color?: string }) {
  return (
    <Text style={{
      fontFamily: 'System',
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      color,
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

// ── Portrait Card (replaces profile card) ────────────────────────────
function PortraitCard({
  name,
  email,
  tier,
  memberSince,
  isActive,
  onTierPress,
}: {
  name: string;
  email: string;
  tier: string;
  memberSince: string;
  isActive: boolean;
  onTierPress: () => void;
}) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <Animated.View entering={FadeInUp.delay(100).duration(400)} style={prStyles.portraitCard}>
      <LinearGradient
        colors={['#11141A', '#0B0D11']}
        style={StyleSheet.absoluteFill}
      />

      {/* Corner ticks */}
      {[
        { top: 10, left: 10, borders: ['Top', 'Left'] },
        { top: 10, right: 10, borders: ['Top', 'Right'] },
        { bottom: 10, left: 10, borders: ['Bottom', 'Left'] },
        { bottom: 10, right: 10, borders: ['Bottom', 'Right'] },
      ].map((c, i) => (
        <View
          key={i}
          style={[
            prStyles.cornerTick,
            { top: c.top, left: c.left, right: c.right, bottom: c.bottom },
            c.borders.includes('Top') && { borderTopWidth: 1, borderTopColor: `${PR_GD}A6` },
            c.borders.includes('Bottom') && { borderBottomWidth: 1, borderBottomColor: `${PR_GD}A6` },
            c.borders.includes('Left') && { borderLeftWidth: 1, borderLeftColor: `${PR_GD}A6` },
            c.borders.includes('Right') && { borderRightWidth: 1, borderRightColor: `${PR_GD}A6` },
          ]}
        />
      ))}

      <View style={prStyles.portraitMain}>
        {/* Monogram */}
        <View style={prStyles.monogramContainer}>
          <LinearGradient
            colors={[PR_GL, PR_GD]}
            style={prStyles.monogramGradient}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
          />
          <Text style={prStyles.monogramText}>{initials}</Text>
          {/* Outer engraved ring */}
          <Svg width={74} height={74} viewBox="0 0 74 74" style={prStyles.monogramRing}>
            <Circle cx={37} cy={37} r={35} fill="none" stroke={PR_GD} strokeWidth={0.5} strokeDasharray="1 3" opacity={0.6} />
          </Svg>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <PrEyebrow>Registered name</PrEyebrow>
          <Text style={prStyles.portraitName}>{name || 'Citizen'}</Text>
          <Text style={prStyles.portraitEmail}>{email}</Text>
        </View>
      </View>

      {/* Membership strip */}
      <View style={prStyles.membershipStrip}>
        <TouchableOpacity style={prStyles.membershipCell} onPress={onTierPress} activeOpacity={0.7}>
          <Text style={prStyles.membershipLabel}>TIER</Text>
          <Text style={[prStyles.membershipValue, prStyles.tierValue]}>{tier}</Text>
        </TouchableOpacity>
        <View style={prStyles.membershipCell}>
          <Text style={prStyles.membershipLabel}>JOINED</Text>
          <Text style={prStyles.membershipValue}>{memberSince}</Text>
        </View>
        <View style={prStyles.membershipCell}>
          <Text style={prStyles.membershipLabel}>STANDING</Text>
          <View style={prStyles.standingRow}>
            <View style={[prStyles.statusDot, { backgroundColor: isActive ? PR_GREEN : PR_FG_FAINT }]} />
            <Text style={[prStyles.membershipValue, { color: isActive ? PR_GREEN : PR_FG_FAINT }]}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Section Heading ──────────────────────────────────────────────────
function PrSectionHeading({ roman, title, sub }: { roman: string; title: string; sub?: string }) {
  return (
    <View style={prStyles.sectionHeading}>
      <Text style={prStyles.sectionRoman}>{roman}</Text>
      <View style={{ flex: 1 }}>
        <Text style={prStyles.sectionTitle}>{title}</Text>
        {sub && <Text style={prStyles.sectionSub}>{sub}</Text>}
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
  valueColor = PR_FG_MUTED,
  last,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value?: string;
  valueColor?: string;
  last?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[prStyles.row, !last && prStyles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={prStyles.rowIcon}>
        <Ionicons name={icon} size={16} color={PR_GL} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={prStyles.rowLabel}>{label}</Text>
        {sub && <Text style={prStyles.rowSub}>{sub}</Text>}
      </View>
      {value && <Text style={[prStyles.rowValue, { color: valueColor }]}>{value}</Text>}
      <Ionicons name="chevron-forward" size={12} color={PR_FG_FAINT} />
    </TouchableOpacity>
  );
}

// ── Section Card Wrapper ─────────────────────────────────────────────
function PrSection({
  roman,
  title,
  sub,
  children,
  delay = 0,
}: {
  roman: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={prStyles.section}>
      <PrSectionHeading roman={roman} title={title} sub={sub} />
      <View style={prStyles.sectionCard}>
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
  const themeLabel = currentTheme === 'system' ? 'System' : currentTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(400)} style={prStyles.section}>
      <PrSectionHeading title="Appearance" />
      <View style={prStyles.appearanceCard}>
        <View style={prStyles.appearanceHeader}>
          <Text style={prStyles.appearanceLabel}>
            Currently set to <Text style={{ color: PR_GL, fontWeight: '600' }}>{themeLabel}</Text>
          </Text>
          <Text style={prStyles.appearanceVersion}>UI · v4.26</Text>
        </View>
        <View style={prStyles.appearanceRow}>
          {(['system', 'dark', 'light'] as ThemePreference[]).map((mode) => {
            const active = currentTheme === mode;
            const label = mode.charAt(0).toUpperCase() + mode.slice(1);
            return (
              <TouchableOpacity
                key={mode}
                style={[prStyles.appearanceChip, active && prStyles.appearanceChipActive]}
                onPress={() => onThemeChange(mode)}
                activeOpacity={0.7}
              >
                <Text style={[prStyles.appearanceChipText, active && prStyles.appearanceChipTextActive]}>
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
  return (
    <Animated.View entering={FadeInUp.delay(500).duration(400)} style={prStyles.signOutContainer}>
      <TouchableOpacity style={prStyles.signOutButton} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="log-out-outline" size={14} color={PR_FG_MUTED} />
        <Text style={prStyles.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <Text style={prStyles.footerVersion}>
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
    marginBottom: 26,
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
    marginHorizontal: 24,
    backgroundColor: PR_BG_CARD,
    borderWidth: 1,
    borderColor: PR_LINE,
    borderRadius: 14,
    paddingHorizontal: 16,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: PR_LINE,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: PR_BG_RAISED,
    borderWidth: 1,
    borderColor: PR_LINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontFamily: 'System',
    fontSize: 14,
    fontWeight: '500',
    color: PR_FG,
    letterSpacing: -0.1,
  },
  rowSub: {
    fontFamily: 'System',
    fontSize: 11,
    color: PR_FG_FAINT,
    marginTop: 2,
  },
  rowValue: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '500',
  },

  // Appearance
  appearanceCard: {
    marginHorizontal: 24,
    backgroundColor: PR_BG_CARD,
    borderWidth: 1,
    borderColor: PR_LINE,
    borderRadius: 14,
    padding: 16,
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
  const { user, logout, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [userTier, setUserTier] = useState<UserTier>('free');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch user's subscription tier
  const fetchTier = useCallback(async () => {
    const isDemoAccount = user?.email === 'demo@represent.app';
    if (isDemoAccount) {
      setUserTier('premium');
      return;
    }

    if (!token) return;

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
  }, [token, user?.email]);

  useEffect(() => {
    fetchTier();
  }, [fetchTier]);

  useFocusEffect(
    useCallback(() => {
      fetchTier();
    }, [fetchTier])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchTier();
    setRefreshing(false);
  }, [fetchTier]);

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

  const getInitial = () =>
    user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';

  const getLocationString = () => {
    // Demo account should use hardcoded location for App Store review
    const isDemoAccount = user?.email === 'demo@represent.app';
    if (isDemoAccount) {
      return 'Toronto, Ontario, Canada';
    }
    const parts = [user?.city, user?.state, user?.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  // Get tier label for display
  const tierLabel = userTier === 'premium' ? 'Premium' : userTier === 'verified' ? 'Verified' : 'Free';

  // Get member since date
  const getMemberSince = () => {
    // Use a reasonable default; in production, pull from user object
    return 'Apr 2026';
  };

  // Generate folio code from user id
  const getFolioCode = () => {
    const base = user?.id?.slice(-4)?.toUpperCase() || '1719';
    return `${base}/2033`;
  };

  return (
    <View style={[styles.container, { backgroundColor: PR_BG }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PR_G} />
        }
      >
        {/* Premium Header */}
        <PrHeader folio={getFolioCode()} />

        {/* Portrait Card */}
        <PortraitCard
          name={user?.name || 'Citizen'}
          email={user?.email || ''}
          tier={tierLabel}
          memberSince={getMemberSince()}
          isActive={true}
          onTierPress={() => navigateTo('/modals/subscription')}
        />

        {/* Section I: Civic Record */}
        <PrSection title="Activity" delay={200}>
          <PrRow icon="business-outline" label="My organizations" value="3" onPress={() => navigateTo('/modals/organizations')} />
          <PrRow icon="time-outline" label="Voting history" sub="234 ballots cast" onPress={() => navigateTo('/modals/voting-history')} />
          <PrRow icon="analytics-outline" label="Analytics" sub="Patterns & impact" onPress={() => navigateTo('/modals/analytics')} />
          <PrRow icon="trophy-outline" label="Badges & achievements" value="1 / 15" valueColor={PR_GL} last onPress={() => navigateTo('/modals/badges')} />
        </PrSection>

        {/* Section II: Membership */}
        <PrSection title="Membership" delay={250}>
          <PrRow icon="card-outline" label="Subscription" sub={`${tierLabel} tier`} value="Upgrade" valueColor={PR_GL} onPress={() => navigateTo('/modals/subscription')} />
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
        <PrSection title="Administration" delay={300}>
          {adminApi.isAdmin() && (
            <PrRow icon="shield-checkmark-outline" label="Admin dashboard" sub="2 organizations" onPress={() => navigateTo('/modals/admin')} />
          )}
          <PrRow icon="notifications-outline" label="Notifications" value="On" valueColor={PR_GREEN} onPress={() => navigateTo('/modals/privacy')} />
          <PrRow icon="settings-outline" label="Settings & privacy" onPress={() => navigateTo('/modals/privacy')} />
          <PrRow icon="document-text-outline" label="Legal" last onPress={() => navigateTo('/modals/privacy')} />
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
    borderRadius: BORDER_RADIUS.xxl,
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
    borderRadius: BORDER_RADIUS.xxl,
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
    borderRadius: BORDER_RADIUS.xxl,
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
