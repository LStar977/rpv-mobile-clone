import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, FONTS } from '../../lib/theme';
import { showPaymentError, showPaymentSuccess } from '../../lib/stripe';
import { processPremiumPayment } from '../../lib/payment';
import { restorePurchases } from '../../lib/iap';
import { referralsApi } from '../../lib/api';
import { shareReferralInvite } from '../../lib/share';
import { SubscriptionLegal } from '../../components/ui/SubscriptionLegal';
import { SENTINEL_FREE_PER_DAY, SENTINEL_PREMIUM_PER_DAY } from '../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// ═══════════════════════════════════════════════════════════════════════════════
// S1 · THE PREMIUM PAYWALL — one product, honest numbers, one gold moment.
//
// ANNUAL PLAN: no annual IAP product exists in App Store Connect yet, so the
// paywall is monthly-only for now. The monthly/annual toggle UI is built and
// gated behind this flag — once the annual SKU is registered in App Store
// Connect (and added to lib/iap.ts IAP_PRODUCTS), flipping this to true
// re-enables the s1b two-card toggle. Do NOT enable before the product exists:
// StoreKit throws "Invalid product ID" for unregistered SKUs.
// ═══════════════════════════════════════════════════════════════════════════════
const ANNUAL_PLAN_ENABLED = false;
const MONTHLY_PRICE = '$7.99';
const ANNUAL_PRICE = '$79';

interface SubscriptionData {
  subscription: string | null;
  tier: 'free' | 'verified' | 'premium';
  status: string;
  endDate: string | null;
}

// Feature ledger — every line carries a real mono number against its free
// counterpart. Sentinel numbers come from backend/server/routes.ts
// (SENTINEL_FREE_DAILY / SENTINEL_PREMIUM_DAILY) via the shared constants.
const FEATURE_ROWS: { label: string; value?: string; valueDim?: string; check?: boolean }[] = [
  {
    label: 'Sentinel governance analysis',
    value: `${SENTINEL_PREMIUM_PER_DAY}/DAY`,
    valueDim: ` · FREE ${SENTINEL_FREE_PER_DAY}`,
  },
  { label: 'Proposal creation', value: 'UNLIMITED', valueDim: ' · FREE 1 ACTIVE' },
  { label: 'Analytics — geo + demographic', value: 'FULL' },
  { label: 'Custom proposal alerts', value: 'UNLIMITED' },
  { label: 'Voting history export', value: 'CSV + PDF' },
  { label: 'Patron badge on your credential', check: true },
];

const FREE_FOREVER_CHIPS = ["Voting on everything you're eligible for", 'Verification', 'Results'];

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  // Monthly/annual toggle — annual is only selectable once the App Store
  // Connect product exists (ANNUAL_PLAN_ENABLED).
  const [plan, setPlan] = useState<'monthly' | 'annual'>('monthly');

  // Demo account should appear as premium (for App Store review)
  const isDemoAccount = user?.email === 'demo@represent.app';
  // Premium is source-agnostic: the auth user's subscriptionStatus is
  // updated by BOTH the Stripe webhook and the Apple IAP receipt path.
  // The /api/stripe/subscription fetch below only knows about Stripe and
  // reports IAP-paid subscribers as free — it stays as a fallback only.
  const isPremium = isDemoAccount
    ? true
    : (user?.isPremium || user?.subscriptionStatus === 'active' ||
       (subscription?.tier === 'premium' && subscription?.status === 'active'));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/stripe/subscription`, { headers });
      if (response.ok) {
        setSubscription(await response.json());
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribePremium = async () => {
    setActionLoading('premium');
    try {
      const result = await processPremiumPayment(token);

      if (result.success) {
        showPaymentSuccess('premium');
        fetchData();
      } else if (result.cancelled) {
        // User cancelled - do nothing
      } else {
        showPaymentError(result.error || 'Payment failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start checkout');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestorePurchases = async () => {
    setActionLoading('restore');
    try {
      const result = await restorePurchases(token);
      if (result.restored) {
        Alert.alert('Purchases Restored', 'Your previous purchases have been restored successfully.');
        fetchData();
      } else if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to restore purchases');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // iOS subscriptions are managed in Apple's settings, not a web portal.
    // App Review rejects external payment-management URLs for digital subs.
    await Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const handleContactOrganizations = () => {
    router.push('/modals/create-organization');
  };

  // "Or earn a free month — invite a friend" → the existing referral program.
  // Shares the user's real code directly when one exists; otherwise generates
  // one (backend only regenerates when none exists — same rule as
  // InviteFriendsCard). Falls back to the Identity tab's referral card.
  const handleReferralInvite = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActionLoading('referral');
    try {
      const stats = await referralsApi.stats();
      let code = stats.data?.code;
      if (!code || code === 'NO_CODE') {
        const generated = await referralsApi.generate();
        code = generated.data?.code;
      }
      if (code && code !== 'NO_CODE') {
        await shareReferralInvite(code);
      } else {
        router.push('/(tabs)/profile');
      }
    } catch {
      router.push('/(tabs)/profile');
    } finally {
      setActionLoading(null);
    }
  };

  const selectPlan = (next: 'monthly' | 'annual') => {
    if (next === 'annual' && !ANNUAL_PLAN_ENABLED) return;
    Haptics.selectionAsync();
    setPlan(next);
  };

  const renewsLabel = subscription?.endDate
    ? new Date(subscription.endDate)
        .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        .toUpperCase()
    : null;
  const renewsSentence = subscription?.endDate
    ? new Date(subscription.endDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const goldBorderStrong = 'rgba(234, 186, 88, 0.5)';
  const goldBorderMid = 'rgba(234, 186, 88, 0.25)';

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
          <View style={{ width: 36 }} />
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  // ── S1c · Already premium — manage state, no re-sell ──────────────────────
  if (isPremium) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.closeBtn, { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.premiumChip, { backgroundColor: colors.goldSurface, borderColor: goldBorderMid }]}>
              <Ionicons name="checkmark" size={11} color={colors.gold} />
              <Text style={[styles.premiumChipText, { color: colors.gold }]}>PREMIUM</Text>
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCol}>
            <Text style={[styles.manageTitle, { color: colors.text }]}>Your Premium</Text>
            <Text style={[styles.manageSub, { color: colors.textSecondary }]}>
              Thank you for keeping the count independent.
            </Text>
          </Animated.View>

          {/* Membership card — the credential's visual language, mono facts */}
          <Animated.View
            entering={FadeInUp.delay(100).duration(400)}
            style={[styles.membershipCard, { backgroundColor: colors.surface, borderColor: 'rgba(234, 186, 88, 0.4)' }]}
          >
            <View style={styles.membershipHead}>
              <Text style={[styles.membershipEyebrow, { color: colors.gold }]}>MEMBERSHIP</Text>
              {isDemoAccount && (
                <Text style={[styles.membershipMeta, { color: colors.textTertiary }]}>DEMO ACCOUNT</Text>
              )}
            </View>
            <View style={styles.membershipRows}>
              <View style={styles.membershipRow}>
                <Text style={[styles.membershipKey, { color: colors.textTertiary }]}>PLAN</Text>
                <Text style={[styles.membershipVal, { color: colors.text }]}>
                  MONTHLY · {MONTHLY_PRICE}/MO
                </Text>
              </View>
              {renewsLabel ? (
                <View style={styles.membershipRow}>
                  <Text style={[styles.membershipKey, { color: colors.textTertiary }]}>RENEWS</Text>
                  <Text style={[styles.membershipVal, { color: colors.text }]}>{renewsLabel}</Text>
                </View>
              ) : (
                <View style={styles.membershipRow}>
                  <Text style={[styles.membershipKey, { color: colors.textTertiary }]}>STATUS</Text>
                  <Text style={[styles.membershipVal, { color: colors.text }]}>ACTIVE</Text>
                </View>
              )}
              <View style={styles.membershipRow}>
                <Text style={[styles.membershipKey, { color: colors.textTertiary }]}>SENTINEL</Text>
                <Text style={[styles.membershipVal, { color: colors.text }]}>
                  {SENTINEL_PREMIUM_PER_DAY}/DAY
                </Text>
              </View>
              <View style={styles.membershipRow}>
                <Text style={[styles.membershipKey, { color: colors.textTertiary }]}>ACTIVE PROPOSALS</Text>
                <Text style={[styles.membershipVal, { color: colors.text }]}>UNLIMITED</Text>
              </View>
            </View>
          </Animated.View>

          {/* Patron badge */}
          <Animated.View
            entering={FadeInUp.delay(160).duration(400)}
            style={[styles.patronCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          >
            <View style={[styles.patronTile, { backgroundColor: colors.goldSurface }]}>
              <Ionicons name="shield-checkmark-outline" size={19} color={colors.gold} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.patronTitle, { color: colors.text }]}>Patron badge active</Text>
              <Text style={[styles.patronSub, { color: colors.textTertiary }]}>
                Shown on your civic credential
              </Text>
            </View>
          </Animated.View>

          {/* Management rows — plain, no sell */}
          <Animated.View
            entering={FadeInUp.delay(220).duration(400)}
            style={[styles.manageList, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          >
            <TouchableOpacity
              style={[styles.manageRow, { borderBottomColor: colors.borderSubtle }]}
              onPress={handleManageBilling}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Manage in App Store"
            >
              <Text style={[styles.manageRowText, { color: colors.text }]}>
                Manage in {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}
              </Text>
              <Text style={[styles.manageRowArrow, { color: colors.textTertiary }]}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.manageRow,
                Platform.OS === 'ios'
                  ? { borderBottomColor: colors.borderSubtle }
                  : { borderBottomWidth: 0 },
              ]}
              onPress={handleReferralInvite}
              disabled={actionLoading !== null}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Invite a friend"
            >
              <Text style={[styles.manageRowText, { color: colors.text }]}>
                Invite a friend — you both earn a month
              </Text>
              {actionLoading === 'referral' ? (
                <ActivityIndicator size="small" color={colors.textTertiary} />
              ) : (
                <Text style={[styles.manageRowArrow, { color: colors.textTertiary }]}>→</Text>
              )}
            </TouchableOpacity>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.manageRow, { borderBottomWidth: 0 }]}
                onPress={handleRestorePurchases}
                disabled={actionLoading !== null}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Restore purchases"
              >
                <Text style={[styles.manageRowText, { color: colors.text }]}>Restore Purchases</Text>
                {actionLoading === 'restore' ? (
                  <ActivityIndicator size="small" color={colors.textTertiary} />
                ) : (
                  <Text style={[styles.manageRowArrow, { color: colors.textTertiary }]}>→</Text>
                )}
              </TouchableOpacity>
            )}
          </Animated.View>

          <Animated.Text
            entering={FadeInUp.delay(280).duration(400)}
            style={[styles.cancelNote, { color: colors.textTertiary }]}
          >
            {renewsSentence
              ? `Cancelling keeps Premium until ${renewsSentence}. Your votes, record, and verification are never affected.`
              : 'Cancelling keeps Premium until the end of your billing period. Your votes, record, and verification are never affected.'}
          </Animated.Text>
        </ScrollView>
      </View>
    );
  }

  // ── S1a · Free user — the sell ─────────────────────────────────────────────
  const ctaLabel =
    ANNUAL_PLAN_ENABLED && plan === 'annual'
      ? `Start Premium — ${ANNUAL_PRICE}/yr`
      : `Start Premium — ${MONTHLY_PRICE}/mo`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.topRow, { paddingTop: insets.top + 8 }]}>
          <View style={{ width: 36 }} />
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.closeBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Eyebrow + serif statement */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCol}>
          <Text style={[styles.eyebrow, { color: colors.gold }]}>REPRESENT PREMIUM</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Sharpen your voice. Keep the count independent.
          </Text>
        </Animated.View>

        {/* Plan cards. Monthly-only until the annual App Store Connect product
            exists (ANNUAL_PLAN_ENABLED) — then this renders the s1b two-card
            toggle with the gold "2 MONTHS FREE" chip. */}
        <Animated.View entering={FadeInUp.delay(80).duration(400)} style={styles.planRow}>
          <TouchableOpacity
            style={[
              styles.planCard,
              {
                backgroundColor: colors.surface,
                borderColor: plan === 'monthly' ? goldBorderStrong : colors.border,
                borderWidth: plan === 'monthly' ? 1.5 : 1,
              },
            ]}
            onPress={() => selectPlan('monthly')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Monthly plan, $7.99 per month"
            accessibilityState={{ selected: plan === 'monthly' }}
          >
            {ANNUAL_PLAN_ENABLED && plan === 'monthly' && (
              <View style={[styles.selectedChip, { backgroundColor: colors.goldFill }]}>
                <Text style={styles.selectedChipText}>SELECTED</Text>
              </View>
            )}
            <Text style={[styles.planLabel, { color: colors.textTertiary }]}>MONTHLY</Text>
            <Text style={[styles.planPrice, { color: colors.text }]}>
              {MONTHLY_PRICE}
              <Text style={[styles.planPeriod, { color: colors.textTertiary }]}>/mo</Text>
            </Text>
          </TouchableOpacity>

          {ANNUAL_PLAN_ENABLED && (
            <TouchableOpacity
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: plan === 'annual' ? goldBorderStrong : colors.border,
                  borderWidth: plan === 'annual' ? 1.5 : 1,
                },
              ]}
              onPress={() => selectPlan('annual')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Annual plan, $79 per year, two months free"
              accessibilityState={{ selected: plan === 'annual' }}
            >
              {plan === 'annual' ? (
                <View style={[styles.selectedChip, { backgroundColor: colors.goldFill }]}>
                  <Text style={styles.selectedChipText}>SELECTED</Text>
                </View>
              ) : (
                <View style={[styles.freeMonthsChip, { backgroundColor: colors.goldSurface, borderColor: goldBorderMid }]}>
                  <Text style={[styles.freeMonthsChipText, { color: colors.gold }]}>2 MONTHS FREE</Text>
                </View>
              )}
              <Text style={[styles.planLabel, { color: colors.textTertiary }]}>ANNUAL</Text>
              <Text style={[styles.planPrice, { color: colors.text }]}>
                {ANNUAL_PRICE}
                <Text style={[styles.planPeriod, { color: colors.textTertiary }]}>/yr</Text>
              </Text>
              {plan === 'annual' && (
                <Text style={[styles.planEffective, { color: colors.gold }]}>
                  = $6.58/MO · 2 MONTHS FREE
                </Text>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Feature ledger — real mono numbers against the free counterpart */}
        <Animated.View
          entering={FadeInUp.delay(140).duration(400)}
          style={[styles.featureList, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
        >
          {FEATURE_ROWS.map((row, i) => (
            <View
              key={row.label}
              style={[
                styles.featureRow,
                i < FEATURE_ROWS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
              ]}
            >
              <Text style={[styles.featureLabel, { color: colors.text }]}>{row.label}</Text>
              {row.check ? (
                <Ionicons name="checkmark" size={14} color={colors.gold} />
              ) : (
                <Text style={[styles.featureValue, { color: colors.gold }]}>
                  {row.value}
                  {row.valueDim ? (
                    <Text style={{ color: colors.textTertiary }}>{row.valueDim}</Text>
                  ) : null}
                </Text>
              )}
            </View>
          ))}
        </Animated.View>

        {/* Mission card — the emotional core */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.missionCard, { backgroundColor: colors.goldSurface, borderColor: goldBorderMid }]}
        >
          <Ionicons name="shield-outline" size={17} color={colors.gold} style={{ marginTop: 2 }} />
          <Text style={[styles.missionText, { color: colors.textSecondary }]}>
            <Text style={[styles.missionLead, { color: colors.text }]}>
              Premium keeps Represent independent.
            </Text>{' '}
            No ads. No data sales. One person, one ballot — forever.
          </Text>
        </Animated.View>

        {/* What stays free forever — voting is never paid */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.freeForeverCol}>
          <Text style={[styles.freeForeverLabel, { color: colors.textTertiary }]}>FREE FOREVER</Text>
          <View style={styles.freeForeverChips}>
            {FREE_FOREVER_CHIPS.map((chip) => (
              <View
                key={chip}
                style={[styles.freeChip, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              >
                <Text style={[styles.freeChipText, { color: colors.textSecondary }]}>{chip}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Org plans are sold in the Orgs tab flow, not on the personal
            paywall — pointer removed to keep this screen to one decision. */}

        {/* CTA + referral alternative + footer links */}
        <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.ctaCol}>
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: colors.goldFill }]}
            onPress={handleSubscribePremium}
            disabled={actionLoading !== null}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
          >
            {actionLoading === 'premium' ? (
              <ActivityIndicator size="small" color="#040707" />
            ) : (
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReferralInvite}
            disabled={actionLoading !== null}
            style={styles.referralRow}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Earn a free month by inviting a friend"
          >
            {actionLoading === 'referral' ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={[styles.referralText, { color: colors.textSecondary }]}>
                Or earn a free month — invite a friend →
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            {Platform.OS === 'ios' && (
              <>
                <TouchableOpacity
                  onPress={handleRestorePurchases}
                  disabled={actionLoading !== null}
                  accessibilityRole="button"
                  accessibilityLabel="Restore purchases"
                >
                  {actionLoading === 'restore' ? (
                    <ActivityIndicator size="small" color={colors.textTertiary} />
                  ) : (
                    <Text style={[styles.footerLinkText, { color: colors.textTertiary }]}>
                      Restore Purchases
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={[styles.footerLinkText, { color: colors.textTertiary }]}>·</Text>
              </>
            )}
            <Text style={[styles.footerLinkText, { color: colors.textTertiary }]}>
              Billed via {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} · cancel anytime
            </Text>
          </View>
        </Animated.View>

        {/* Apple Guideline 3.1.2 disclosure — required on the purchase screen */}
        <Animated.View entering={FadeInUp.delay(400).duration(400)}>
          <SubscriptionLegal
            mode="subscription"
            productTitle="Premium"
            productLength={ANNUAL_PLAN_ENABLED && plan === 'annual' ? '1 year' : '1 month'}
            productPrice={ANNUAL_PLAN_ENABLED && plan === 'annual' ? ANNUAL_PRICE : MONTHLY_PRICE}
          />
        </Animated.View>

        {/* FAQ removed — the paywall makes one clean pitch; cancellation and
            billing terms live in SubscriptionLegal above and the App Store
            manages the rest. */}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 26,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCol: {
    gap: 5,
    marginBottom: 14,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 2.1,
  },
  heroTitle: {
    fontFamily: FONTS.serif,
    fontSize: 31,
    lineHeight: 35,
    letterSpacing: -0.37,
  },
  // Plan cards
  planRow: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  planCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 15,
    gap: 2,
  },
  selectedChip: {
    position: 'absolute',
    top: -9,
    left: 13,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  selectedChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1.02,
    color: '#040707',
  },
  freeMonthsChip: {
    position: 'absolute',
    top: -9,
    right: 13,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  freeMonthsChipText: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 8.5,
    letterSpacing: 0.85,
    fontVariant: ['tabular-nums'],
  },
  planLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.33,
  },
  planPrice: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
  },
  planPeriod: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  planEffective: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontVariant: ['tabular-nums'],
  },
  // Feature ledger
  featureList: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 3,
    marginBottom: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
  },
  featureLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12.5,
    flexShrink: 1,
  },
  featureValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  // Mission card
  missionCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  missionText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19.5,
  },
  missionLead: {
    fontFamily: FONTS.sansSemiBold,
  },
  // Free forever
  freeForeverCol: {
    gap: 6,
    marginBottom: 14,
  },
  freeForeverLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.33,
  },
  freeForeverChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  freeChip: {
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  freeChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10.5,
  },
  // Organizations pointer
  orgCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  orgTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
  },
  orgSub: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
  },
  orgArrow: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  // CTA block
  ctaCol: {
    gap: 8,
  },
  cta: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16.5,
    color: '#040707',
  },
  referralRow: {
    alignItems: 'center',
    paddingVertical: 2,
    minHeight: 20,
    justifyContent: 'center',
  },
  referralText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerLinkText: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
  },
  // FAQ
  faqSection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
  },
  faqTitle: {
    fontFamily: FONTS.serif,
    fontSize: 20,
    marginBottom: SPACING.lg,
  },
  faqItem: {
    marginBottom: SPACING.lg,
  },
  faqQuestion: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
    marginBottom: 4,
  },
  faqAnswer: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 20,
  },
  // S1c manage state
  premiumChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 100,
    borderWidth: 1,
  },
  premiumChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.33,
  },
  manageTitle: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.36,
  },
  manageSub: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  membershipCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 13,
    marginBottom: 14,
  },
  membershipHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  membershipEyebrow: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.9,
    fontVariant: ['tabular-nums'],
  },
  membershipMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  membershipRows: {
    gap: 8,
  },
  membershipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  membershipKey: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  membershipVal: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  patronCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    marginBottom: 14,
  },
  patronTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patronTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
  },
  patronSub: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
  },
  manageList: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  manageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 10,
  },
  manageRowText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13.5,
    flexShrink: 1,
  },
  manageRowArrow: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  cancelNote: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
