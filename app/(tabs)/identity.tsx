import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}
    >
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}
      >
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
        tone: colors.warning,
        cta: 'Sign in',
        onPress: () => router.replace('/'),
      };
    }

    if (verification.status === 'pending') {
      return {
        title: 'Verification in progress',
        subtitle: 'We are reviewing your documents.',
        icon: 'time-outline' as const,
        tone: colors.warning,
      };
    }

    if (verification.verified) {
      return {
        title: 'Identity verified',
        subtitle: `Verified on ${formatDate(verification.verifiedAt) || 'recently'}.`,
        icon: 'shield-checkmark' as const,
        tone: colors.success,
      };
    }

    return {
      title: 'Verification needed',
      subtitle: 'Complete verification to vote and claim rewards.',
      icon: 'alert-circle-outline' as const,
      tone: colors.error,
      cta: 'Start verification',
      onPress: () => router.push('/(tabs)/identity'),
    };
  }, [colors.error, colors.success, colors.warning, isAuthenticated, verification]);

  const profileData = profile || user || {};

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      <LinearGradient
        colors={[colors.backgroundSecondary, colors.background]}
        style={styles.hero}
      >
        <Text style={[styles.heroTitle, { color: colors.text }]}>Identity center</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Secure your civic passport and manage verification.
        </Text>
      </LinearGradient>

      <View style={[styles.statusCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
      >
        <View style={[styles.statusIcon, { backgroundColor: `${statusUI.tone}22` }]}>
          <Ionicons name={statusUI.icon} size={22} color={statusUI.tone} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>{statusUI.title}</Text>
          <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}
          >{statusUI.subtitle}</Text>
        </View>
        {statusUI.cta && statusUI.onPress && (
          <TouchableOpacity
            style={[styles.statusCta, { backgroundColor: statusUI.tone }]}
            onPress={() => {
              haptics.selection();
              statusUI.onPress?.();
            }}
          >
            <Text style={[styles.statusCtaText, { color: colors.background }]}
            >{statusUI.cta}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Profile snapshot</Text>
        <View style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <>
              <InfoRow label="Name" value={profileData.name} />
              <InfoRow label="Email" value={profileData.email} />
              <InfoRow label="Country" value={profileData.country} />
              <InfoRow label="State" value={profileData.state} />
              <InfoRow label="City" value={profileData.city} />
            </>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Next steps</Text>
        <View style={[styles.actionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          <View style={styles.actionRow}>
            <Ionicons name="document-text" size={18} color={colors.gold} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Submit a proof of address to unlock local voting.
            </Text>
          </View>
          <View style={styles.actionRow}>
            <Ionicons name="ribbon" size={18} color={colors.gold} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Earn rewards for consistent participation.
            </Text>
          </View>
          <Button title="Manage verification" onPress={() => router.push('/(tabs)/identity')} variant="secondary" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  heroTitle: {
    ...TYPOGRAPHY.displaySmall,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xs,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  statusSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  statusCta: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusCtaText: {
    ...TYPOGRAPHY.labelMedium,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.sm,
  },
  profileCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOWS.soft,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  infoLabel: {
    ...TYPOGRAPHY.bodySmall,
  },
  infoValue: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'right',
    flex: 1,
  },
  actionCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.md,
    ...SHADOWS.soft,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
});
