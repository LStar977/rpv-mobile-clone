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
import { useTheme, SPACING, RADIUS, FONTS } from '../../lib/theme';
import { ORG_TIERS, type OrgTier } from '../../lib/org-tiers';
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

// Mono ledger-style date — "AUG 01 2026" — for the plan card footer.
function formatDateMono(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const day = String(d.getDate()).padStart(2, '0');
    return `${month} ${day} ${d.getFullYear()}`;
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
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: SPACING.screenPadding }]}>
        <Text style={{ fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' }}>
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

  const currentTierMeta = usage.tier === 'legacy' ? null : ORG_TIERS[usage.tier as OrgTier] ?? null;
  const currentPlanName = usage.tier === 'legacy' ? 'Legacy' : (currentTierMeta?.name ?? usage.tier);
  const currentPriceValue = currentTierMeta?.priceValue ?? null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: SPACING.screenPadding,
          paddingBottom: insets.bottom + SPACING['3xl'],
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)} style={{ gap: 15 }}>
          {/* Header — back circle + serif title + ADMIN chip */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                Billing & Plan
              </Text>
            </View>
            {usage.isAdmin && (
              <View style={[styles.adminChip, { backgroundColor: colors.goldFill }]}>
                <Text style={styles.adminChipText}>ADMIN</Text>
              </View>
            )}
          </View>

          {!!orgName && (
            <Text style={[styles.orgEyebrow, { color: colors.textTertiary }]} numberOfLines={1}>
              {String(orgName).toUpperCase()}
            </Text>
          )}

          {/* Legacy banner: pre-Stage-3 customers grandfathered to uncapped
              everything. Surfaces the migration nudge without forcing them. */}
          {usage.tier === 'legacy' && (
            <View style={[styles.legacyBanner, { backgroundColor: colors.goldSurface, borderColor: colors.gold }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
              <Text style={[styles.legacyBannerText, { color: colors.text }]}>
                You're on a legacy plan from before our new pricing. Your features and caps stay unchanged. Contact <Text style={{ color: colors.gold, fontFamily: FONTS.sansSemiBold }}>support@representvote.com</Text> when you'd like to migrate to a current plan.
              </Text>
            </View>
          )}

          {/* Current plan card */}
          <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: 'rgba(234,186,88,0.3)' }]}>
            <View style={styles.planCardTop}>
              <View style={{ gap: 3 }}>
                <Text style={[styles.planEyebrow, { color: colors.gold }]}>GOVERNANCE PLAN</Text>
                <Text style={[styles.planName, { color: colors.text }]}>{currentPlanName}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.planPrice, { color: colors.text }]}>
                  {currentPriceValue != null ? `$${currentPriceValue}` : '—'}
                </Text>
                <Text style={[styles.planPricePeriod, { color: colors.textTertiary }]}>per month</Text>
              </View>
            </View>

            <View style={{ gap: 7 }}>
              <View style={styles.monoRow}>
                <Text style={[styles.monoRowLabel, { color: colors.textSecondary }]}>VERIFIED MEMBER SEATS</Text>
                <Text style={[styles.monoRowValue, { color: colors.text }]}>
                  {usage.members.current.toLocaleString()}{usage.members.limit ? ` / ${usage.members.limit.toLocaleString()}` : ' / ∞'}
                </Text>
              </View>
              {memberPct !== null && (
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceHighlight }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: memberPct >= 90 ? colors.error : memberPct >= 70 ? (colors.warning ?? colors.gold) : colors.goldFill,
                        width: `${memberPct}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            <View style={styles.monoRow}>
              <Text style={[styles.monoFooter, { color: colors.textTertiary }]}>STATUS</Text>
              <Text style={[styles.monoFooter, { color: statusColor }]}>{status.text.toUpperCase()}</Text>
            </View>

            {/* UPDATE 26 — verification unlock row. Three states:
                - Active: org paid the unlock; show date.
                - Inactive on Pro+: feature available, show price.
                - Free: unavailable on this tier. */}
            <View style={styles.monoRow}>
              <Text style={[styles.monoFooter, { color: colors.textTertiary }]}>IDENTITY VERIFICATION</Text>
              <Text style={[styles.verificationValue, { color: colors.textSecondary }]} numberOfLines={2}>
                {usage.verification.unlocked
                  ? `Active${usage.verification.unlockedAt ? ` · unlocked ${formatDate(usage.verification.unlockedAt)}` : ''}`
                  : usage.verification.unlockFeeCents != null
                    ? `Inactive · enable in Settings ($${(usage.verification.unlockFeeCents / 100).toFixed(0)} one-time)`
                    : usage.tier === 'government'
                      ? 'Custom contract'
                      : 'Pro plan or higher required'}
              </Text>
            </View>

            <View style={styles.monoRow}>
              <Text style={[styles.monoFooter, { color: colors.textTertiary }]}>
                {usage.nextBillingDate ? `RENEWS ${formatDateMono(usage.nextBillingDate)}` : 'RENEWS —'}
              </Text>
              {usage.paymentProvider && (
                <Text style={[styles.monoFooter, { color: colors.textTertiary }]}>
                  {usage.paymentProvider === 'iap' ? 'APPLE IAP' : 'CARD · STRIPE'}
                </Text>
              )}
            </View>
          </View>

          {/* Plan picker — Government is hidden (sales-set tier). */}
          <View style={{ gap: 7 }}>
            <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>PLANS</Text>
            <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              {(Object.entries(ORG_TIERS) as [OrgTier, typeof ORG_TIERS.free][])
                .filter(([key]) => key !== 'government')
                .map(([key, tier], idx, arr) => {
                  const isCurrent = key === usage.tier;
                  const isSelected = selectedTier === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => handleSelectTier(key)}
                      activeOpacity={0.7}
                      style={[
                        styles.planRow,
                        idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 1, paddingRight: SPACING.sm }}>
                        <Text style={[styles.planRowName, { color: isSelected ? colors.gold : colors.text }]}>
                          {tier.name}{isCurrent ? ' — current' : ''}
                        </Text>
                        <Text style={[styles.planRowDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                          {tier.description}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.planRowPrice, { color: isSelected ? colors.gold : colors.textSecondary }]}>
                          {tier.contactOnly ? 'CONTACT' : `${tier.price}/MO`}
                        </Text>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={16} color={colors.gold} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </View>
          </View>

          {selectedTier && selectedTier !== usage.tier && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.goldFill }]}
                onPress={handleConfirmTierChange}
                disabled={actionLoading !== null}
                activeOpacity={0.8}
              >
                {actionLoading === 'upgrade' ? (
                  <ActivityIndicator color="#040707" />
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
          <View style={{ gap: 7, marginTop: SPACING.sm }}>
            <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>MANAGE</Text>

            {usage.subscriptionStatus !== 'free' && usage.subscriptionStatus !== 'canceled' && (
              usage.paymentProvider === 'iap' ? (
                <TouchableOpacity
                  style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
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
                  style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.error }]}
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

            <Text style={[styles.helpText, { color: colors.textTertiary }]}>
              {usage.paymentProvider === 'iap'
                ? 'Apple subscriptions are managed in iOS Settings. To update payment method or cancel, open Settings → Apple ID → Subscriptions.'
                : Platform.OS === 'ios'
                ? 'Existing subscriptions purchased on iOS are managed in Settings.'
                : 'Cancellations take effect at the end of your current billing period — you keep access until then.'}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  adminChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
  },
  adminChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.14,
    color: '#040707',
  },
  orgEyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 0.72,
    fontVariant: ['tabular-nums'],
  },
  legacyBanner: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    alignItems: 'flex-start',
  },
  legacyBannerText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  planCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  planEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  planName: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    lineHeight: 29,
  },
  planPrice: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  planPricePeriod: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  monoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  monoRowLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  monoRowValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  monoFooter: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  verificationValue: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    flexShrink: 1,
    textAlign: 'right',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  sectionEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47,
  },
  listCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  planRowName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  planRowDesc: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  planRowPrice: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  primaryButton: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.xs,
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
  helpText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16.5,
    marginTop: SPACING.xs,
  },
});
