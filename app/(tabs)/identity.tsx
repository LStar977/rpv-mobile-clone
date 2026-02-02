import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';

import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { userApi, veriffApi } from '../../lib/api';
import { Button } from '../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type VerificationState = {
  verified: boolean;
  status?: 'unverified' | 'pending' | 'verified' | 'failed';
  provider?: 'veriff' | string;
  verifiedAt?: string | null;
};

type ProfileState = {
  name?: string;
  email?: string;
  country?: string;
  state?: string;
  city?: string;
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Premium Info Row
function InfoRow({
  label,
  value,
  icon,
  verified,
}: {
  label: string;
  value?: string | null;
  icon?: string;
  verified?: boolean;
}) {
  const { colors } = useTheme();
  const hasValue = value && value.trim().length > 0;

  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <View style={styles.infoRowContent}>
        {icon && (
          <View style={[styles.infoIcon, { backgroundColor: `${colors.gold}12` }]}>
            <Ionicons name={icon as any} size={16} color={colors.gold} />
          </View>
        )}
        <View style={styles.infoText}>
          <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>{label}</Text>
          <Text style={[styles.infoValue, { color: hasValue ? colors.text : colors.textTertiary }]} numberOfLines={2}>
            {hasValue ? value : '—'}
          </Text>
        </View>
      </View>
      {verified && (
        <View style={[styles.verifiedTag, { backgroundColor: `${colors.success}15` }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
        </View>
      )}
    </View>
  );
}

// Premium Shield Badge
function ShieldBadge({
  status,
  size = 'large',
}: {
  status: 'verified' | 'pending' | 'failed' | 'unverified';
  size?: 'small' | 'large';
}) {
  const { colors } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (status === 'verified') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1,
        true
      );
    }
  }, [status]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const config = {
    verified: {
      icon: 'shield-checkmark',
      colors: [colors.success, '#0F8A5F'] as const,
      glow: colors.success,
    },
    pending: {
      icon: 'time',
      colors: [colors.info, '#2563EB'] as const,
      glow: colors.info,
    },
    failed: {
      icon: 'shield',
      colors: [colors.error, '#DC2626'] as const,
      glow: colors.error,
    },
    unverified: {
      icon: 'shield-outline',
      colors: [colors.gold, colors.goldDark || '#A68523'] as const,
      glow: colors.gold,
    },
  };

  const { icon, colors: gradientColors, glow } = config[status];
  const iconSize = size === 'large' ? 48 : 28;
  const containerSize = size === 'large' ? 100 : 56;

  return (
    <Animated.View style={[animatedStyle, { alignItems: 'center' }]}>
      <View style={[styles.shieldGlow, { backgroundColor: `${glow}15`, width: containerSize + 20, height: containerSize + 20 }]}>
        <LinearGradient
          colors={gradientColors}
          style={[styles.shieldContainer, { width: containerSize, height: containerSize }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name={icon as any} size={iconSize} color="#FFFFFF" />
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

export default function IdentityScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user, token } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [verification, setVerification] = useState<VerificationState>({
    verified: false,
    status: 'unverified',
    provider: 'veriff',
    verifiedAt: null,
  });

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [startingKyc, setStartingKyc] = useState(false);

  // Payment/subscription state for gating verification
  const [hasPaidVerification, setHasPaidVerification] = useState(false);
  const [isPremium, setIsPremium] = useState(false);

  const fetchIdentity = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        isAuthenticated ? userApi.getVerificationStatus() : Promise.resolve({ data: { verified: false } }),
        isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null }),
      ]);

      const verificationRes =
        results[0].status === 'fulfilled' ? results[0].value : { data: { verified: false } };
      const profileRes = results[1].status === 'fulfilled' ? results[1].value : { data: null };

      const v = verificationRes?.data || {};
      const p = profileRes?.data || null;

      setVerification({
        verified: !!v.verified,
        status: (v.status as any) || (v.verified ? 'verified' : 'unverified'),
        provider: v.provider || 'veriff',
        verifiedAt: v.verifiedAt || v.verified_at || null,
      });

      setProfile(p);

      // Check subscription status (for premium users, verification is included)
      if (isAuthenticated && token) {
        try {
          const subResponse = await fetch(`${API_URL}/api/stripe/subscription`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
          if (subResponse.ok) {
            const subData = await subResponse.json();
            const userIsPremium = subData.tier === 'premium' && subData.status === 'active';
            const userHasPaid = subData.verificationPaid === true || userIsPremium;
            setIsPremium(userIsPremium);
            setHasPaidVerification(userHasPaid);
          }
        } catch (subError) {
          console.error('Subscription check error:', subError);
        }
      }
    } catch (e) {
      console.error('Identity fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    fetchIdentity();
  }, [fetchIdentity]);

  const statusConfig = useMemo(() => {
    if (!isAuthenticated) {
      return {
        title: 'Sign in Required',
        subtitle: 'Sign in to access identity verification and unlock voting.',
        status: 'unverified' as const,
        actionLabel: 'Sign In',
        actionIcon: 'log-in-outline',
      };
    }

    if (verification.verified) {
      return {
        title: 'Identity Verified',
        subtitle: 'Your identity is verified and secured with government-issued documentation.',
        status: 'verified' as const,
        actionLabel: 'Explore Proposals',
        actionIcon: 'arrow-forward',
      };
    }

    if (verification.status === 'pending') {
      return {
        title: 'Verification Pending',
        subtitle: 'Your identity verification is being processed. This usually takes a few minutes.',
        status: 'pending' as const,
        actionLabel: 'Refresh Status',
        actionIcon: 'refresh',
      };
    }

    if (verification.status === 'failed') {
      return {
        title: 'Verification Failed',
        subtitle: 'Your submission was not approved. Please try again with a valid document.',
        status: 'failed' as const,
        actionLabel: 'Try Again',
        actionIcon: 'refresh',
      };
    }

    return {
      title: 'Verify Your Identity',
      subtitle: 'Complete identity verification to vote on proposals and access geo-restricted communities.',
      status: 'unverified' as const,
      actionLabel: 'Start Verification',
      actionIcon: 'shield-checkmark-outline',
    };
  }, [isAuthenticated, verification.verified, verification.status]);

  const handleStartKyc = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to begin verification.');
      return;
    }

    // Check if user has paid for verification or is premium
    if (!hasPaidVerification && !isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Payment Required',
        'Identity verification requires a one-time payment of $4.99, or is included free with Premium membership.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Get Verified ($4.99)',
            onPress: () => router.push('/modals/verification-payment'),
          },
          {
            text: 'View Premium',
            onPress: () => router.push('/modals/subscription'),
          },
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStartingKyc(true);

    try {
      const response = await veriffApi.createSession();

      if (response.data?.sessionUrl && response.data?.verificationId) {
        router.push({
          pathname: '/modals/veriff',
          params: {
            sessionUrl: response.data.sessionUrl,
            verificationId: response.data.verificationId,
          },
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          'Verification Error',
          response.data?.error || 'Could not start verification session. Please try again.'
        );
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('Veriff session error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the verification service. Please check your connection and try again.'
      );
    } finally {
      setStartingKyc(false);
    }
  };

  const handleAction = () => {
    if (!isAuthenticated) {
      router.replace('/');
      return;
    }

    if (verification.verified) {
      router.push('/(tabs)/proposals');
      return;
    }

    if (verification.status === 'pending') {
      onRefresh();
      return;
    }

    handleStartKyc();
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading identity...</Text>
        </View>
      </View>
    );
  }

  const displayName = profile?.name || user?.name || '';
  const displayEmail = profile?.email || user?.email || '';
  const displayCountry = profile?.country || user?.country || '';
  const displayState = profile?.state || user?.state || '';
  const displayCity = profile?.city || user?.city || '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Identity</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
            Verification status and profile
          </Text>
        </Animated.View>

        {/* Status Card */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <LinearGradient
            colors={[`${colors.gold}08`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />

          <ShieldBadge status={statusConfig.status} />

          <Text style={[styles.statusTitle, { color: colors.text }]}>{statusConfig.title}</Text>
          <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>{statusConfig.subtitle}</Text>

          {verification.verified && (
            <View style={[styles.verifiedBanner, { backgroundColor: `${colors.success}12`, borderColor: `${colors.success}25` }]}>
              <Ionicons name="lock-closed" size={16} color={colors.success} />
              <Text style={[styles.verifiedBannerText, { color: colors.success }]}>
                Identity verified and secured
              </Text>
            </View>
          )}

          <View style={styles.statusAction}>
            <Button
              title={startingKyc ? 'Starting...' : statusConfig.actionLabel}
              onPress={handleAction}
              variant="primary"
              size="lg"
              fullWidth
              icon={statusConfig.actionIcon}
              iconPosition={verification.verified ? 'right' : 'left'}
              loading={startingKyc}
              disabled={startingKyc}
            />
          </View>
        </Animated.View>

        {/* Details Card */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.detailsHeader}>
            <Text style={[styles.detailsTitle, { color: colors.text }]}>Your Details</Text>
            {verification.verified && (
              <View style={[styles.lockedBadge, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="lock-closed-outline" size={12} color={colors.gold} />
                <Text style={[styles.lockedBadgeText, { color: colors.gold }]}>Verified</Text>
              </View>
            )}
          </View>

          <InfoRow
            label="Full Name"
            value={displayName}
            icon="person-outline"
            verified={verification.verified}
          />
          <InfoRow
            label="Email"
            value={displayEmail}
            icon="mail-outline"
          />
          <InfoRow
            label="Country"
            value={displayCountry}
            icon="globe-outline"
            verified={verification.verified}
          />
          <InfoRow
            label="State / Province"
            value={displayState}
            icon="map-outline"
            verified={verification.verified}
          />
          <InfoRow
            label="City"
            value={displayCity}
            icon="business-outline"
            verified={verification.verified}
          />
        </Animated.View>

        {/* Verification Info Card */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.infoCardHeader}>
            <View style={[styles.infoCardIcon, { backgroundColor: `${colors.gold}12` }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.gold} />
            </View>
            <Text style={[styles.infoCardTitle, { color: colors.text }]}>Verification Details</Text>
          </View>

          <View style={styles.infoCardContent}>
            <View style={styles.infoCardRow}>
              <Text style={[styles.infoCardLabel, { color: colors.textTertiary }]}>Provider</Text>
              <Text style={[styles.infoCardValue, { color: colors.text }]}>
                {verification.provider ? verification.provider.toUpperCase() : '—'}
              </Text>
            </View>

            <View style={[styles.infoCardDivider, { backgroundColor: colors.border }]} />

            <View style={styles.infoCardRow}>
              <Text style={[styles.infoCardLabel, { color: colors.textTertiary }]}>Status</Text>
              <View style={[
                styles.statusBadge,
                {
                  backgroundColor: verification.verified
                    ? `${colors.success}15`
                    : verification.status === 'pending'
                    ? `${colors.info}15`
                    : verification.status === 'failed'
                    ? `${colors.error}15`
                    : `${colors.warning}15`,
                },
              ]}>
                <Text style={[
                  styles.statusBadgeText,
                  {
                    color: verification.verified
                      ? colors.success
                      : verification.status === 'pending'
                      ? colors.info
                      : verification.status === 'failed'
                      ? colors.error
                      : colors.warning,
                  },
                ]}>
                  {verification.verified ? 'Verified' : (verification.status || 'Unverified').charAt(0).toUpperCase() + (verification.status || 'Unverified').slice(1)}
                </Text>
              </View>
            </View>

            <View style={[styles.infoCardDivider, { backgroundColor: colors.border }]} />

            <View style={styles.infoCardRow}>
              <Text style={[styles.infoCardLabel, { color: colors.textTertiary }]}>Verified Date</Text>
              <Text style={[styles.infoCardValue, { color: colors.text }]}>
                {verification.verified ? (formatDate(verification.verifiedAt) || 'Verified') : '—'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Help Card */}
        {!verification.verified && isAuthenticated && (
          <Animated.View
            entering={FadeInUp.delay(400).duration(400)}
            style={[styles.helpCard, { backgroundColor: `${colors.info}10`, borderColor: `${colors.info}25` }]}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.info} />
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>
              Verification is powered by Veriff and requires a valid government-issued ID. Your data is encrypted and securely processed.
            </Text>
          </Animated.View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
  },

  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },

  // Header
  header: {
    marginBottom: SPACING.xl,
  },
  pageTitle: {
    ...TYPOGRAPHY.displaySmall,
  },
  pageSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xs,
  },

  // Status Card
  statusCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xxl,
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.lg,
  },
  shieldGlow: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  shieldContainer: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },
  statusTitle: {
    ...TYPOGRAPHY.headlineLarge,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  statusSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginTop: SPACING.lg,
  },
  verifiedBannerText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  statusAction: {
    width: '100%',
    marginTop: SPACING.xl,
  },

  // Details Card
  detailsCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  detailsTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  lockedBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  infoRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACING.md,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    ...TYPOGRAPHY.labelSmall,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },
  verifiedTag: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },

  // Info Card
  infoCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    ...SHADOWS.sm,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardTitle: {
    ...TYPOGRAPHY.labelLarge,
  },
  infoCardContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  infoCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  infoCardLabel: {
    ...TYPOGRAPHY.labelMedium,
  },
  infoCardValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },
  infoCardDivider: {
    height: 1,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },

  // Help Card
  helpCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  helpText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 20,
  },

  bottomSpacer: {
    height: 100,
  },
});
