import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, RefreshControl } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, FONTS, ThemePreference } from '../../lib/theme';
import { adminApi, organizationsApi, userApi } from '../../lib/api';
import { restorePurchases } from '../../lib/iap';
import { PassportCard, type PassportStatus } from '../../components/identity/PassportCard';
import { InviteFriendsCard } from '../../components/referrals/InviteFriendsCard';
import { useTutorialStore } from '../../lib/tutorial';
import type { UserTier } from '../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

const BADGES_TOTAL = 15;

// Compact badge metadata for the CIVIC BADGES tiles (full list lives in
// /modals/badges). Ionicons stand in for the mock's Lucide icons.
const BADGE_META: { id: string; name: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'first_vote', name: 'First Vote', icon: 'checkbox-outline' },
  { id: 'first_vote_country', name: 'National Voice', icon: 'flag-outline' },
  { id: 'first_vote_state', name: 'State Advocate', icon: 'map-outline' },
  { id: 'first_vote_city', name: 'Local Champion', icon: 'business-outline' },
  { id: 'vote_streak_5', name: 'Consistent Voter', icon: 'flame-outline' },
  { id: 'vote_streak_25', name: 'Dedicated Citizen', icon: 'star-outline' },
  { id: 'vote_streak_100', name: 'Democracy Hero', icon: 'trophy-outline' },
  { id: 'first_proposal', name: 'Proposal Pioneer', icon: 'create-outline' },
  { id: 'proposal_5', name: 'Active Legislator', icon: 'documents-outline' },
  { id: 'referral_5', name: 'Community Builder', icon: 'people-outline' },
  { id: 'referral_20', name: 'Movement Leader', icon: 'people-circle-outline' },
  { id: 'passport_minted', name: 'Verified Citizen', icon: 'shield-checkmark-outline' },
  { id: 'early_adopter', name: 'Early Adopter', icon: 'rocket-outline' },
  { id: 'democratic_spirit', name: 'Democratic Spirit', icon: 'scale-outline' },
  { id: 'global_citizen', name: 'Global Citizen', icon: 'globe-outline' },
];

// ── Section label (mock 14 row styling) ──────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>{children}</Text>;
}

// ── Settings row (mock 14) ───────────────────────────────────────────
function SettingsRow({
  label,
  sub,
  value,
  valueMono,
  valueColor,
  last,
  onPress,
}: {
  label: string;
  sub?: string;
  value?: string;
  valueMono?: boolean;
  valueColor?: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}
      {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {sub && <Text style={[styles.rowSub, { color: colors.textTertiary }]}>{sub}</Text>}
      </View>
      {value && (
        <Text
          style={[
            valueMono ? styles.rowValueMono : styles.rowValue,
            { color: valueColor || colors.textTertiary },
          ]}
        >
          {value}
        </Text>
      )}
      {onPress && <Text style={[styles.rowArrow, { color: colors.textTertiary }]}>→</Text>}
    </Container>
  );
}

// ── Row card wrapper (mock 14 grouped list) ──────────────────────────
function RowCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.rowCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      {children}
    </View>
  );
}

// ── Scope row (mock X3 hierarchy treatment) ──────────────────────────
function ScopeRow({
  icon,
  name,
  sub,
  indent,
  eligible,
  last,
  onVerify,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  name: string;
  sub: string;
  indent: number;
  eligible: boolean;
  last?: boolean;
  onVerify?: () => void;
}) {
  const { colors } = useTheme();
  const Container: any = !eligible && onVerify ? TouchableOpacity : View;
  return (
    <Container
      style={[styles.scopeRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}
      {...(!eligible && onVerify ? { onPress: onVerify, activeOpacity: 0.7 } : {})}
    >
      <View
        style={[
          styles.scopeIcon,
          { backgroundColor: eligible ? colors.goldSurface : colors.surfaceHighlight, marginLeft: indent },
        ]}
      >
        <Ionicons name={icon} size={16} color={eligible ? colors.gold : colors.textTertiary} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={[styles.scopeName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[styles.scopeSub, { color: colors.textTertiary }]} numberOfLines={1}>{sub}</Text>
      </View>
      {eligible ? (
        <View style={styles.scopeStatus}>
          <Ionicons name="checkmark" size={12} color={colors.gold} />
          <Text style={[styles.scopeStatusText, { color: colors.gold }]}>ELIGIBLE</Text>
        </View>
      ) : (
        <View style={styles.scopeStatus}>
          <Text style={[styles.scopeStatusText, { color: colors.textTertiary }]}>VERIFY</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
        </View>
      )}
    </Container>
  );
}

// ── Record stat tile (mock 10) ───────────────────────────────────────
function StatTile({ value, label }: { value: number | null; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>
        {value !== null ? value.toLocaleString() : '—'}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

// ── Badge tile (mock 10 civic badges) ────────────────────────────────
function BadgeTile({
  name,
  icon,
  earned,
  onPress,
}: {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  earned: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.badgeTile,
        { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
        !earned && { opacity: 0.5 },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.badgeTileIcon,
          { backgroundColor: earned ? colors.goldSurface : colors.surfaceHighlight },
        ]}
      >
        <Ionicons
          name={earned ? icon : 'lock-closed-outline'}
          size={17}
          color={earned ? colors.gold : colors.textTertiary}
        />
      </View>
      <Text
        style={[styles.badgeTileName, { color: earned ? colors.text : colors.textSecondary }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ── Theme segmented control (mock 14 "Theme · Dark/Light/Auto") ──────
function ThemeSegments({
  currentTheme,
  onThemeChange,
}: {
  currentTheme: ThemePreference;
  onThemeChange: (t: ThemePreference) => void;
}) {
  const { colors } = useTheme();
  const options: { value: ThemePreference; label: string }[] = [
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' },
    { value: 'system', label: 'Auto' },
  ];
  return (
    <View
      style={[styles.segments, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle }]}
    >
      {options.map(({ value, label }) => {
        const active = currentTheme === value;
        return (
          <TouchableOpacity
            key={value}
            style={[styles.segment, active && { backgroundColor: colors.surfaceHighlight }]}
            onPress={() => onThemeChange(value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                { color: active ? colors.text : colors.textTertiary },
                active && { fontFamily: FONTS.sansSemiBold },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, themePreference, setThemePreference } = useTheme();
  const { user, logout, token, isAuthenticated } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [userTier, setUserTier] = useState<UserTier>('free');
  const [refreshing, setRefreshing] = useState(false);
  const [badgesEarned, setBadgesEarned] = useState<number | null>(null);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<string[] | null>(null);
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

  // Live badge data for the CIVIC BADGES tiles + count. Falls back to null
  // on failure so the section degrades gracefully (no stale counts).
  useEffect(() => {
    if (!token || !user?.id) return;
    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/badges/user/${user.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const earned = await response.json();
          if (Array.isArray(earned)) {
            setBadgesEarned(earned.length);
            setEarnedBadgeIds(earned.map((b: any) => b.badgeId || b.badge?.id || b.id).filter(Boolean));
          } else {
            setBadgesEarned(0);
            setEarnedBadgeIds([]);
          }
        }
      } catch {
        // Keep null; section will hide the count.
      }
    })();
  }, [token, user?.id]);

  // Live counts for record stats + verification status for the credential
  // card. Each falls back to null on failure so the tile shows an em dash
  // rather than a stale value.
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

  const getLocationParts = () => {
    // Demo account should use hardcoded location for App Store review
    const isDemoAccount = user?.email === 'demo@represent.app';
    if (isDemoAccount) {
      return { city: 'Toronto', state: 'Ontario', country: 'Canada' };
    }
    return {
      city: profileLocation?.city || user?.city,
      state: profileLocation?.state || user?.state,
      country: profileLocation?.country || user?.country,
    };
  };

  const getLocationString = () => {
    const { city, state, country } = getLocationParts();
    const parts = [city, state, country].filter(Boolean);
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

  // Credential ID from the user id, styled after the mock's RV-CIT-88291-CA
  const getFolioCode = () => {
    const base = user?.id?.replace(/[^a-zA-Z0-9]/g, '')?.slice(-5)?.toUpperCase() || '88291';
    const country = getLocationParts().country;
    const cc = country ? `-${country.slice(0, 2).toUpperCase()}` : '';
    return `RV-CIT-${base}${cc}`;
  };

  const { city, state, country } = getLocationParts();
  const hasScope = !!(city || state || country);

  // Badge tiles: earned first (up to 3), locked fillers after.
  const earnedSet = new Set(earnedBadgeIds ?? []);
  const earnedTiles = BADGE_META.filter((b) => earnedSet.has(b.id)).slice(0, 3);
  const lockedTiles = BADGE_META.filter((b) => !earnedSet.has(b.id)).slice(0, Math.max(0, 3 - earnedTiles.length));
  const badgeTiles = [
    ...earnedTiles.map((b) => ({ ...b, earned: true })),
    ...lockedTiles.map((b) => ({ ...b, earned: false })),
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />
        }
      >
        {/* Header: Identity + settings entry */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Identity</Text>
          <TouchableOpacity
            style={[styles.headerGear, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onPress={() => navigateTo('/modals/privacy')}
            activeOpacity={0.7}
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Civic credential card + verify prompt for unverified users */}
        <PassportCard
          name={user?.name || 'Citizen'}
          location={getLocationString() || ''}
          verified={verification.verified}
          status={verification.status}
          folio={getFolioCode()}
          memberSince={getMemberSinceShort()}
          country={country || undefined}
          onVerify={handleStartKyc}
          startingKyc={startingKyc}
        />

        {/* Record stats */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.statsRow}>
          <StatTile value={votesCast} label="BALLOTS CAST" />
          <StatTile value={adminOrgCount} label="ORGANIZATIONS" />
        </Animated.View>

        {/* Voting scope (X3 treatment) */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
          <SectionLabel>VOTING SCOPE</SectionLabel>
          <RowCard>
            {hasScope ? (
              <>
                {country && (
                  <ScopeRow
                    icon="globe-outline"
                    name={country}
                    sub={
                      verification.citizenshipVerified
                        ? 'Federal proposals · citizens only'
                        : 'Citizens only · passport + proof of address required'
                    }
                    indent={0}
                    eligible={verification.citizenshipVerified}
                    onVerify={handleStartCitizenKyc}
                    last={!state && !city}
                  />
                )}
                {state && (
                  <ScopeRow
                    icon="business-outline"
                    name={state}
                    sub="Provincial & state proposals"
                    indent={country ? 18 : 0}
                    eligible={verification.verified}
                    onVerify={handleStartKyc}
                    last={!city}
                  />
                )}
                {city && (
                  <ScopeRow
                    icon="location-outline"
                    name={city}
                    sub="Municipal proposals"
                    indent={(country ? 18 : 0) + (state ? 18 : 0)}
                    eligible={verification.verified}
                    onVerify={handleStartKyc}
                    last
                  />
                )}
              </>
            ) : (
              <ScopeRow
                icon="location-outline"
                name="Residence not set"
                sub="Verify your address to unlock your voting scope"
                indent={0}
                eligible={false}
                onVerify={handleStartKyc}
                last
              />
            )}
          </RowCard>
          <Text style={[styles.scopeCaption, { color: colors.textTertiary }]}>
            Where you can vote is determined by your verified residence and citizenship — not by choice.
          </Text>
        </Animated.View>

        {/* Civic badges */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.section}>
          <View style={styles.badgesHeader}>
            <SectionLabel>CIVIC BADGES</SectionLabel>
            <TouchableOpacity
              style={styles.badgesLink}
              onPress={() => navigateTo('/modals/badges')}
              activeOpacity={0.7}
            >
              {badgesEarned !== null && (
                <Text style={[styles.badgesCount, { color: colors.textTertiary }]}>
                  {badgesEarned} / {BADGES_TOTAL}
                </Text>
              )}
              <Text style={[styles.rowArrow, { color: colors.textTertiary }]}>→</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.badgesGrid}>
            {badgeTiles.map((b) => (
              <BadgeTile
                key={b.id}
                name={b.name}
                icon={b.icon}
                earned={b.earned}
                onPress={() => navigateTo('/modals/badges')}
              />
            ))}
          </View>
        </Animated.View>

        {/* Civic record */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.section}>
          <SectionLabel>CIVIC RECORD</SectionLabel>
          <RowCard>
            <SettingsRow
              label="Voting History"
              value={votesCast !== null ? votesCast.toLocaleString() : undefined}
              valueMono
              onPress={() => navigateTo('/modals/voting-history')}
            />
            <SettingsRow
              label="Analytics"
              sub="Patterns & impact"
              last
              onPress={() => navigateTo('/modals/analytics')}
            />
          </RowCard>
        </Animated.View>

        {/* Membership */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.section}>
          <SectionLabel>MEMBERSHIP</SectionLabel>
          <RowCard>
            <SettingsRow
              label="Subscription"
              sub={`${tierLabel} tier`}
              value={userTier === 'premium' ? undefined : 'Upgrade'}
              valueColor={userTier === 'premium' ? undefined : colors.gold}
              last={Platform.OS !== 'ios'}
              onPress={() => navigateTo('/modals/subscription')}
            />
            {Platform.OS === 'ios' && (
              <SettingsRow
                label="Restore purchases"
                last
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
          </RowCard>
        </Animated.View>

        {/* Referral program */}
        <InviteFriendsCard delay={425} />

        {/* Account */}
        <Animated.View entering={FadeInUp.delay(450).duration(400)} style={styles.section}>
          <SectionLabel>ACCOUNT</SectionLabel>
          <RowCard>
            {adminApi.isAdmin() && (
              <SettingsRow
                label="Admin dashboard"
                sub={adminOrgCount !== null ? `${adminOrgCount} organization${adminOrgCount === 1 ? '' : 's'}` : undefined}
                onPress={() => navigateTo('/modals/admin')}
              />
            )}
            <SettingsRow label="Settings & privacy" onPress={() => navigateTo('/modals/privacy')} />
            <SettingsRow label="Legal" last onPress={() => navigateTo('/modals/legal')} />
          </RowCard>
        </Animated.View>

        {/* Appearance */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.section}>
          <SectionLabel>APPEARANCE</SectionLabel>
          <RowCard>
            <View style={styles.themeRow}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>Theme</Text>
              <ThemeSegments currentTheme={themePreference} onThemeChange={setThemePreference} />
            </View>
          </RowCard>
        </Animated.View>

        {/* Sign out + version */}
        <Animated.View entering={FadeInUp.delay(550).duration(400)} style={styles.signOutSection}>
          <TouchableOpacity
            style={[styles.signOutButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={[styles.signOutText, { color: colors.text }]}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={[styles.versionText, { color: colors.textTertiary }]}>REPRESENT v1.0.0</Text>
        </Animated.View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.screenPadding,
    // paddingTop is set dynamically via insets
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    lineHeight: 35,
    letterSpacing: -0.38,
  },
  headerGear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
  section: {
    marginBottom: 16,
    gap: 7,
  },
  sectionLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47,
  },

  // Record stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 2,
  },
  statValue: {
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
    fontSize: 24,
  },
  statLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
  },

  // Grouped row card (mock 14)
  rowCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 8,
  },
  rowLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  rowSub: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  rowValue: {
    fontFamily: FONTS.sans,
    fontSize: 12,
  },
  rowValueMono: {
    fontFamily: FONTS.mono,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
  },
  rowArrow: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },

  // Scope (X3)
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
  },
  scopeIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
  scopeSub: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
  },
  scopeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scopeStatusText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 0.76,
  },
  scopeCaption: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
  },

  // Badges
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgesCount: {
    fontFamily: FONTS.mono,
    fontVariant: ['tabular-nums'],
    fontSize: 11,
  },
  badgesGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  badgeTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 7,
  },
  badgeTileIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTileName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    textAlign: 'center',
  },

  // Theme row
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 12,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 11,
    borderWidth: 1,
    padding: 3,
  },
  segment: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },

  // Sign out
  signOutSection: {
    gap: 10,
    marginTop: 4,
  },
  signOutButton: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14.5,
  },
  versionText: {
    fontFamily: FONTS.mono,
    fontVariant: ['tabular-nums'],
    fontSize: 9.5,
    letterSpacing: 1.33,
    textAlign: 'center',
  },

  bottomPadding: { height: 100 },
});
