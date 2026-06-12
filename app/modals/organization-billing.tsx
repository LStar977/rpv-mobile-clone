import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, type OrgUsage } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { ORG_TIERS, type OrgTier } from '../../lib/org-tiers';
import { TierCard } from '../../components/ui/TierCard';
import { processOrganizationPayment, cancelOrganizationStripe } from '../../lib/payment';
import { showPaymentError, showPaymentSuccess } from '../../lib/stripe';
import { SubscriptionLegal } from '../../components/ui/SubscriptionLegal';

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

function statusLabel(status: string): { text: string; color: 'success' | 'warning' | 'error' | 'muted' } {
  switch (status) {
    case 'active': return { text: 'Active', color: 'success' };
    case 'pending': return { text: 'Pending payment', color: 'warning' };
    case 'past_due': return { text: 'Past due', color: 'error' };
    case 'canceled': return { text: 'Canceled', color: 'error' };
    case 'free': return { text: 'No active plan', color: 'muted' };
    default: return { text: status, color: 'muted' };
  }
}

export default function OrganizationBillingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();
  const { orgId, orgName } = useLocalSearchParams<{ orgId: string; orgName?: string }>();

  const [usage, setUsage] = useState<OrgUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<OrgTier | null>(null);

  useEffect(() => {
    if (orgId) fetchUsage();
  }, [orgId]);

  const fetchUsage = async () => {
    setLoading(true);
    const result = await organizationsApi.getUsage(orgId);
    if (result.error || !result.data) {
      Alert.alert('Error', result.error || 'Failed to load billing details');
      setLoading(false);
      return;
    }
    setUsage(result.data);
    setLoading(false);
  };

  const handleSelectTier = (tier: OrgTier) => {
    if (!usage) return;
    if (tier === usage.tier) return; // already on this plan
    if (ORG_TIERS[tier].contactOnly) {
      Alert.alert(
        'Enterprise plan',
        'Contact our team at sales@representvote.com to discuss enterprise pricing and custom integrations.',
      );
      return;
    }
    setSelectedTier(tier);
  };

  const handleConfirmTierChange = async () => {
    if (!selectedTier || !usage) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionLoading('upgrade');
    try {
      const result = await processOrganizationPayment(token, selectedTier, orgId);
      if (result.cancelled) {
        setActionLoading(null);
        setSelectedTier(null);
        return;
      }
      if (!result.success) {
        showPaymentError(result.error || 'Payment failed');
        setActionLoading(null);
        return;
      }
      Alert.alert('Plan updated', `Your organization is now on the ${ORG_TIERS[selectedTier].name} plan.`);
      setSelectedTier(null);
      await fetchUsage();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = () => {
    if (!usage) return;
    // IAP-paid: redirect to iOS Settings (Apple-required path).
    if (usage.paymentProvider === 'iap') {
      Linking.openURL(APPLE_SUBSCRIPTIONS_URL).catch(() => {
        Alert.alert('Could not open Settings', 'Open the iOS Settings app → Apple ID → Subscriptions to manage.');
      });
      return;
    }
    Alert.alert(
      'Cancel subscription?',
      'Your organization will keep access through the end of the current billing period, then revert to the free tier. You can resubscribe anytime.',
      [
        { text: 'Keep subscription', style: 'cancel' },
        {
          text: 'Cancel at period end',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('cancel');
            const result = await cancelOrganizationStripe(token, orgId);
            setActionLoading(null);
            if (!result.success) {
              if (result.iapRedirect) {
                Linking.openURL(APPLE_SUBSCRIPTIONS_URL).catch(() => {});
                return;
              }
              Alert.alert('Cancel failed', result.error || 'Try again later.');
              return;
            }
            Alert.alert(
              'Subscription canceled',
              `Your organization keeps access until ${formatDate(result.effectiveAt ?? null)}.`,
            );
            await fetchUsage();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (!usage) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg }]}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          Billing details unavailable. Pull to refresh.
        </Text>
      </View>
    );
  }

  const status = statusLabel(usage.subscriptionStatus);
  const statusColor =
    status.color === 'success' ? colors.success :
    status.color === 'warning' ? colors.warning ?? colors.gold :
    status.color === 'error' ? colors.error :
    colors.textSecondary;

  const memberPct = usage.members.limit
    ? Math.min(100, Math.round((usage.members.current / usage.members.limit) * 100))
    : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {orgName ? `${orgName} — Billing` : 'Billing'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['3xl'] }}>
        <Animated.View entering={FadeIn.duration(300)}>
          {/* Legacy banner: pre-Stage-3 customers grandfathered to uncapped
              everything. Surfaces the migration nudge without forcing them. */}
          {usage.tier === 'legacy' && (
            <View style={[styles.legacyBanner, { backgroundColor: `${colors.gold}10`, borderColor: colors.gold }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
              <Text style={[styles.legacyBannerText, { color: colors.text }]}>
                You're on a legacy plan from before our new pricing. Your features and caps stay unchanged. Contact <Text style={{ color: colors.gold, fontWeight: '600' }}>support@representvote.com</Text> when you'd like to migrate to a current plan.
              </Text>
            </View>
          )}

          {/* Status + usage summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border, ...SHADOWS.sm }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Current plan</Text>
              <Text style={[styles.summaryValue, { color: colors.gold }]}>
                {usage.tier === 'legacy'
                  ? 'Legacy'
                  : (ORG_TIERS[usage.tier as OrgTier]?.name ?? usage.tier)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Status</Text>
              <Text style={[styles.summaryValue, { color: statusColor }]}>{status.text}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Members</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {usage.members.current}{usage.members.limit ? ` / ${usage.members.limit}` : ' (unlimited)'}
              </Text>
            </View>
            {memberPct !== null && (
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: memberPct >= 90 ? colors.error : memberPct >= 70 ? (colors.warning ?? colors.gold) : colors.gold,
                      width: `${memberPct}%`,
                    },
                  ]}
                />
              </View>
            )}
            {/* UPDATE 26 — verification unlock row. Three states:
                - Active: org paid the unlock; show date.
                - Inactive on Pro+: feature available, show price.
                - Free: unavailable on this tier. */}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Identity verification</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {usage.verification.unlocked
                  ? `Active${usage.verification.unlockedAt ? ` · unlocked ${formatDate(usage.verification.unlockedAt)}` : ''}`
                  : usage.verification.unlockFeeCents != null
                    ? `Inactive · enable in Settings ($${(usage.verification.unlockFeeCents / 100).toFixed(0)} one-time)`
                    : usage.tier === 'government'
                      ? 'Custom contract'
                      : 'Pro plan or higher required'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Next billing</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>
                {formatDate(usage.nextBillingDate)}
              </Text>
            </View>
            {usage.paymentProvider && (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Payment method</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {usage.paymentProvider === 'iap' ? 'Apple In-App Purchase' : 'Credit card (Stripe)'}
                </Text>
              </View>
            )}
          </View>

          {/* Plan picker — Government is hidden (sales-set tier). */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Change plan</Text>
          {(Object.entries(ORG_TIERS) as [OrgTier, typeof ORG_TIERS.free][])
            .filter(([key]) => key !== 'government')
            .map(([key, tier]) => (
              <TierCard
                key={key}
                tier={tier}
                tierKey={key}
                selected={selectedTier === key}
                onSelect={() => handleSelectTier(key)}
                currentTier={key === usage.tier}
              />
            ))}

          {selectedTier && selectedTier !== usage.tier && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.gold }]}
                onPress={handleConfirmTierChange}
                disabled={actionLoading !== null}
                activeOpacity={0.8}
              >
                {actionLoading === 'upgrade' ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {ORG_TIERS[selectedTier].priceValue > (ORG_TIERS[usage.tier as OrgTier]?.priceValue ?? 0)
                      ? `Upgrade to ${ORG_TIERS[selectedTier].name}`
                      : `Switch to ${ORG_TIERS[selectedTier].name}`}
                  </Text>
                )}
              </TouchableOpacity>
              {/* Apple Guideline 3.1.2(c) — subscription disclosure */}
              <SubscriptionLegal
                mode="subscription"
                productTitle={`${ORG_TIERS[selectedTier].name} — Organization plan`}
                productLength="1 month"
                productPrice={`${ORG_TIERS[selectedTier].price}/month`}
              />
            </>
          )}

          {/* Manage section */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.xl }]}>Manage</Text>

          {usage.subscriptionStatus !== 'free' && usage.subscriptionStatus !== 'canceled' && (
            usage.paymentProvider === 'iap' ? (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={handleCancel}
                disabled={actionLoading !== null}
                activeOpacity={0.7}
              >
                <Ionicons name="open-outline" size={18} color={colors.text} />
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Manage in iOS Settings
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.error }]}
                onPress={handleCancel}
                disabled={actionLoading !== null}
                activeOpacity={0.7}
              >
                {actionLoading === 'cancel' ? (
                  <ActivityIndicator color={colors.error} size="small" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                    <Text style={[styles.secondaryButtonText, { color: colors.error }]}>
                      Cancel subscription
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )
          )}

          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            {usage.paymentProvider === 'iap'
              ? 'Apple subscriptions are managed in iOS Settings. To update payment method or cancel, open Settings → Apple ID → Subscriptions.'
              : Platform.OS === 'ios'
              ? 'Existing subscriptions purchased on iOS are managed in Settings.'
              : 'Cancellations take effect at the end of your current billing period — you keep access until then.'}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  summaryCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  legacyBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'flex-start',
  },
  legacyBannerText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...TYPOGRAPHY.bodySmall,
  },
  summaryValue: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: SPACING.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
    marginBottom: SPACING.md,
    marginTop: SPACING.sm,
  },
  primaryButton: {
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
    color: '#000',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  helpText: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
  },
});
