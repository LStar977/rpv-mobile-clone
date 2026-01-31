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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { router } from 'expo-router';

import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';
import { userApi } from '../../lib/api';
import { Button } from '../../components/ui';
import { haptics } from '../../lib/haptics';

type VerificationState = {
  verified: boolean;
  status?: 'unverified' | 'pending' | 'verified' | 'failed';
  provider?: 'veriff' | string;
  verifiedAt?: string | null; // ISO date from backend
};

type ProfileState = {
  name?: string;
  email?: string;
  country?: string;
  state?: string;
  city?: string;
  // any other fields your backend returns, but we will display only
};

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>
        {value && value.trim().length > 0 ? value : '—'}
      </Text>
    </View>
  );
}

export default function IdentityScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [verification, setVerification] = useState<VerificationState>({
    verified: false,
    status: 'unverified',
    provider: 'veriff',
    verifiedAt: null,
  });

  const [profile, setProfile] = useState<ProfileState | null>(null);

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
    } catch (e) {
      console.error('Identity fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchIdentity();
  }, [fetchIdentity]);

  const statusUI = useMemo(() => {
    if (!isAuthenticated) {
      return {
        title: 'Sign in required',
        subtitle: 'Sign in to complete identity verification.',
        icon: 'log-in-outline' as const,
        tone: 'warning' as const,
      };
    }

    if (verification.verified) {
      return {
        title: 'Verified',
        subtitle: 'Your identity is verified and locked to your government document.',
        icon: 'shield-checkmark' as const,
        tone: 'success' as const,
      };
    }

    if (verification.status === 'pending') {
      return {
        title: 'Verification pending',
        subtitle: 'We’re confirming your verification status with the provider.',
        icon: 'time-outline' as const,
        tone: 'info' as const,
      };
    }

    if (verification.status === 'failed') {
      return {
        title: 'Verification failed',
        subtitle: 'Your submission was not approved. Please try again.',
        icon: 'close-circle-outline' as const,
        tone: 'error' as const,
      };
    }

    return {
      title: 'Not verified',
      subtitle: 'Verify your identity to vote on proposals and access geo-gated communities.',
      icon: 'shield-outline' as const,
      tone: 'warning' as const,
    };
  }, [isAuthenticated, verification.verified, verification.status]);

  const toneColors = useMemo(() => {
    const tone = statusUI.tone;
    if (tone === 'success') return { bg: colors.successLight, border: colors.success, fg: colors.success };
    if (tone === 'error') return { bg: colors.errorLight, border: colors.error, fg: colors.error };
    if (tone === 'info') return { bg: colors.infoLight, border: colors.info, fg: colors.info };
    return { bg: colors.warningLight, border: colors.warning, fg: colors.warning };
  }, [statusUI.tone, colors]);

  const handleStartKyc = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to begin verification.');
      return;
    }

    haptics.medium();

    // Hook this to your actual Veriff/KYC flow.
    // Examples:
    // - router.push('/modals/kyc')
    // - Linking.openURL(verificationSessionUrlFromBackend)
    // - open a WebView modal
    Alert.alert(
      'Start Verification',
      'Connect this button to your Veriff session start endpoint / flow.',
      [{ text: 'OK' }]
    );
  };

  const handleRefreshStatus = async () => {
    // Only allowed while NOT verified
    if (verification.verified) return;

    haptics.selection();
    setRefreshing(true);
    await fetchIdentity();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={colors.gold} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading identity…</Text>
      </View>
    );
  }

  const displayName = profile?.name || user?.name || 'Citizen';
  const displayEmail = profile?.email || user?.email || '';
  const displayCountry = profile?.country || user?.country || '';
  const displayState = profile?.state || user?.state || '';
  const displayCity = profile?.city || user?.city || '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={[styles.headerCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <LinearGradient
            colors={[`${colors.gold}10`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: colors.cardBgLight, borderColor: colors.border }]}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Identity</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: toneColors.bg, borderColor: toneColors.border }]}>
            <View style={[styles.statusIconBg, { backgroundColor: `${toneColors.fg}20` }]}>
              <Ionicons name={statusUI.icon} size={22} color={toneColors.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>{statusUI.title}</Text>
              <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>{statusUI.subtitle}</Text>
            </View>
          </View>

          {/* Verified Lock Note */}
          {verification.verified && (
            <View style={[styles.lockNote, { borderTopColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.lockText, { color: colors.textSecondary }]}>
                Verified identity fields are read-only and match your government document.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Identity Details (Read-only) */}
        <Animated.View entering={FadeInUp.delay(100).duration(350)} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your Details</Text>

          <InfoRow label="Name" value={displayName} />
          <InfoRow label="Email" value={displayEmail} />
          <InfoRow label="Country" value={displayCountry} />
          <InfoRow label="State/Province" value={displayState} />
          <InfoRow label="City" value={displayCity} />

          <InfoRow
            label="Verification Provider"
            value={verification.provider ? String(verification.provider).toUpperCase() : '—'}
          />
          <InfoRow
            label="Verified Date"
            value={verification.verified ? (formatDate(verification.verifiedAt) || 'Verified') : '—'}
          />
        </Animated.View>

        {/* Actions */}
        {!isAuthenticated ? (
          <Animated.View entering={FadeInUp.delay(180).duration(350)} style={styles.actions}>
            <Button
              title="Sign In"
              onPress={() => router.replace('/')}
              variant="primary"
              size="lg"
              fullWidth
              icon="log-in-outline"
            />
          </Animated.View>
        ) : verification.verified ? (
          // VERIFIED: no refresh, no edit, no “update” controls
          <Animated.View entering={FadeInUp.delay(180).duration(350)} style={styles.actions}>
            <View style={[styles.verifiedCard, { backgroundColor: colors.goldLight, borderColor: colors.gold }]}>
              <Ionicons name="checkmark-circle" size={20} color={colors.gold} />
              <Text style={[styles.verifiedText, { color: colors.gold }]}>
                You’re verified. You can now vote and create geo-gated proposals.
              </Text>
            </View>

            <Button
              title="Go to Proposals"
              onPress={() => router.push('/(tabs)/proposals')}
              variant="primary"
              size="lg"
              fullWidth
              icon="arrow-forward"
              iconPosition="right"
            />
          </Animated.View>
        ) : (
          // NOT VERIFIED: allow start + refresh
          <Animated.View entering={FadeInUp.delay(180).duration(350)} style={styles.actions}>
            <Button
              title="Start Verification"
              onPress={handleStartKyc}
              variant="primary"
              size="lg"
              fullWidth
              icon="shield-checkmark-outline"
            />

            {/* Only show refresh while NOT verified */}
            <TouchableOpacity
              style={[styles.refreshRow, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
              onPress={handleRefreshStatus}
              activeOpacity={0.75}
              disabled={refreshing}
            >
              <View style={[styles.refreshIconBg, { backgroundColor: colors.goldLight }]}>
                {refreshing ? (
                  <ActivityIndicator size="small" color={colors.gold} />
                ) : (
                  <Ionicons name="refresh" size={18} color={colors.gold} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.refreshTitle, { color: colors.text }]}>Refresh status</Text>
                <Text style={[styles.refreshSubtitle, { color: colors.textSecondary }]}>
                  If you just completed KYC, pull the latest status from the backend.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={[styles.noteBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                Verification details are determined by your identity document and the verification provider. You can’t edit them manually.
              </Text>
            </View>
          </Animated.View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingTop: 70,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  loadingText: {
    marginTop: SPACING.md,
    ...TYPOGRAPHY.bodySmall,
  },

  headerCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.md,
    marginBottom: SPACING.lg,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
  },

  statusBanner: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  statusIconBg: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    ...TYPOGRAPHY.labelLarge,
  },
  statusSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
    lineHeight: 18,
  },

  lockNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.lg,
    marginTop: SPACING.lg,
    borderTopWidth: 1,
  },
  lockText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 18,
  },

  card: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    ...SHADOWS.sm,
    marginBottom: SPACING.lg,
  },
  cardTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.md,
  },

  infoRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  infoLabel: {
    ...TYPOGRAPHY.labelSmall,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  infoValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },

  actions: {
    gap: SPACING.md,
  },

  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  refreshIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshTitle: {
    ...TYPOGRAPHY.labelLarge,
  },
  refreshSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
    lineHeight: 18,
  },

  noteBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  noteText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 18,
  },

  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  verifiedText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
  },
});
