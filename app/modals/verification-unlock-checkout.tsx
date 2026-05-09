// One-time identity-verification unlock checkout (UPDATE 26).
//
// Routes the buying flow based on the org's billing rail:
//   - Stripe-billed: open the server-issued Checkout URL in the system
//     browser. The webhook (checkout.session.completed) stamps the org
//     unlocked. We poll the org row for up to 30s and dismiss when we see
//     verificationUnlockedAt populated.
//   - Apple IAP-billed: invoke purchaseProduct(verification_unlock_<tier>)
//     via the existing IAP flow, post the receipt to the iap-receipt
//     endpoint, refresh the org, dismiss.
//
// On success, the toggle (requireMemberVerification) is auto-flipped ON
// since that was the admin's intent before they got rerouted here.

import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useTheme, SPACING, BORDER_RADIUS, SHADOWS } from '../../lib/theme';
import { organizationsApi, type Organization } from '../../lib/api';
import { iapAvailable, purchaseProduct, unlockSkuForTier } from '../../lib/iap';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

type Phase = 'idle' | 'starting' | 'awaiting' | 'success' | 'error';

export default function VerificationUnlockCheckoutScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ orgId?: string }>();
  const orgId = typeof params.orgId === 'string' ? params.orgId : '';

  const [org, setOrg] = useState<Organization | null>(null);
  const [unlockFeeCents, setUnlockFeeCents] = useState<number | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'iap' | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initial load: fetch the org's usage shape so we know the price + rail.
  useEffect(() => {
    if (!orgId) {
      setErrorMessage('Missing organization id');
      setPhase('error');
      return;
    }
    let cancelled = false;
    (async () => {
      const result = await organizationsApi.getUsage(orgId);
      if (cancelled) return;
      if (result.error || !result.data) {
        setErrorMessage(result.error || 'Could not load organization billing');
        setPhase('error');
        return;
      }
      setUnlockFeeCents(result.data.verification.unlockFeeCents);
      setPaymentProvider(result.data.paymentProvider);
      const orgResp = await organizationsApi.getOrganization(orgId);
      if (orgResp.data) setOrg(orgResp.data);
      if (result.data.verification.unlocked) {
        setPhase('success');
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  const tierName = useMemo(() => {
    const t = org?.tier ?? '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }, [org?.tier]);

  const priceLabel = useMemo(() => {
    if (unlockFeeCents == null) return '—';
    return `$${(unlockFeeCents / 100).toFixed(0)}`;
  }, [unlockFeeCents]);

  const handlePurchase = async () => {
    if (!orgId || !org) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('starting');
    setErrorMessage(null);

    // iOS always uses IAP for digital goods, regardless of how the org's
    // tier subscription is billed (Guideline 3.1.1 — no external payment
    // for in-app digital purchases). The unlock IAP charges the admin's
    // Apple ID and the receipt is server-validated and credited to the org.
    // Android routes by paymentProvider: IAP-billed orgs use IAP, Stripe-
    // billed orgs use Stripe Checkout.
    const useIap = Platform.OS === 'ios' || paymentProvider === 'iap';
    if (useIap) {
      if (!iapAvailable) {
        setErrorMessage('In-app purchases unavailable on this device.');
        setPhase('error');
        return;
      }
      const sku = unlockSkuForTier(org.tier ?? '');
      if (!sku) {
        setErrorMessage(`No unlock product configured for tier "${org.tier}".`);
        setPhase('error');
        return;
      }
      const purchase = await purchaseProduct(sku);
      if (purchase.cancelled) {
        setPhase('idle');
        return;
      }
      if (!purchase.success || !purchase.receipt || !purchase.transactionId) {
        setErrorMessage(purchase.error || 'Purchase failed.');
        setPhase('error');
        return;
      }
      const validate = await organizationsApi.submitVerificationUnlockIapReceipt(
        orgId,
        purchase.receipt,
        purchase.productId ?? sku,
        purchase.transactionId,
      );
      if (validate.error) {
        setErrorMessage(validate.error);
        setPhase('error');
        return;
      }
      await flipToggleOn();
      setPhase('success');
      return;
    }

    // Stripe path. Open the Checkout URL in the system browser; webhook
    // stamps the org unlocked once payment completes. Poll for the unlock
    // state and auto-dismiss on success.
    const checkout = await organizationsApi.createVerificationUnlockCheckout(orgId);
    if (checkout.error || !checkout.data?.checkoutUrl) {
      setErrorMessage(checkout.error || 'Could not start checkout.');
      setPhase('error');
      return;
    }
    try {
      await Linking.openURL(checkout.data.checkoutUrl);
    } catch {
      setErrorMessage('Could not open checkout. Please try again.');
      setPhase('error');
      return;
    }
    setPhase('awaiting');
    // Poll the usage endpoint until verificationUnlockedAt flips or timeout.
    const startedAt = Date.now();
    const tick = async () => {
      const r = await organizationsApi.getUsage(orgId);
      if (r.data?.verification?.unlocked) {
        await flipToggleOn();
        setPhase('success');
        return;
      }
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setErrorMessage(
          "Payment didn't confirm in time. If you completed checkout, the unlock will activate shortly — close this and re-open settings.",
        );
        setPhase('error');
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    setTimeout(tick, POLL_INTERVAL_MS);
  };

  const flipToggleOn = async () => {
    // Best-effort: flip the toggle ON since that was the admin's intent
    // when they hit the unlock-required 402. If this fails the admin can
    // still toggle manually — the unlock itself succeeded.
    try {
      await organizationsApi.setRequireVerification(orgId, true);
    } catch {
      // swallowed — caller (org-detail) refetches on focus and shows
      // the current state.
    }
  };

  const onSuccessDismiss = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'flex-start', justifyContent: 'center' }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text }}>
          Unlock verification
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg }}>
        {/* Price + tier */}
        <View style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.lg,
          alignItems: 'center',
          marginBottom: SPACING.lg,
          ...SHADOWS.sm,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 6 }}>
            {tierName} plan · one-time
          </Text>
          <Text style={{ fontSize: 44, fontWeight: '700', color: colors.gold, letterSpacing: -1 }}>
            {priceLabel}
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>
            Unlimited verifications, no per-vote cost
          </Text>
        </View>

        {/* What this unlocks */}
        <View style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: BORDER_RADIUS.lg,
          padding: SPACING.lg,
          marginBottom: SPACING.lg,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: SPACING.sm }}>
            What you get
          </Text>
          <Bullet color={colors.success} text="Members must verify their identity (Veriff/Didit) before voting in this org." textColor={colors.text} />
          <Bullet color={colors.success} text="Verification is fully covered — members never see a payment prompt." textColor={colors.text} />
          <Bullet color={colors.success} text="One-time charge. Toggle the feature on and off freely after payment." textColor={colors.text} />
          <Bullet color={colors.success} text="Receipt + refund eligibility per Stripe / App Store policy." textColor={colors.text} />
        </View>

        {/* Status */}
        {phase === 'awaiting' && (
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            padding: SPACING.md,
            backgroundColor: `${colors.gold}10`,
            borderColor: colors.gold, borderWidth: 1,
            borderRadius: BORDER_RADIUS.md,
            marginBottom: SPACING.lg, gap: 10,
          }}>
            <ActivityIndicator size="small" color={colors.gold} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>
              Confirming payment… complete the checkout in your browser, then return to the app.
            </Text>
          </View>
        )}

        {phase === 'error' && errorMessage && (
          <View style={{
            padding: SPACING.md,
            backgroundColor: `${colors.error}10`,
            borderColor: colors.error, borderWidth: 1,
            borderRadius: BORDER_RADIUS.md,
            marginBottom: SPACING.lg,
          }}>
            <Text style={{ fontSize: 13, color: colors.error }}>{errorMessage}</Text>
          </View>
        )}

        {phase === 'success' && (
          <View style={{
            padding: SPACING.md,
            backgroundColor: `${colors.success}10`,
            borderColor: colors.success, borderWidth: 1,
            borderRadius: BORDER_RADIUS.md,
            marginBottom: SPACING.lg,
          }}>
            <Text style={{ fontSize: 13, color: colors.success, fontWeight: '600' }}>
              Verification unlocked. Members will now be required to verify before voting.
            </Text>
          </View>
        )}

        {/* CTA */}
        {phase !== 'success' ? (
          <TouchableOpacity
            onPress={handlePurchase}
            disabled={phase === 'starting' || phase === 'awaiting' || unlockFeeCents == null}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.gold,
              borderRadius: BORDER_RADIUS.md,
              paddingVertical: SPACING.md,
              alignItems: 'center',
              opacity: phase === 'starting' || phase === 'awaiting' || unlockFeeCents == null ? 0.6 : 1,
            }}
          >
            {phase === 'starting' || phase === 'awaiting' ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>
                Unlock for {priceLabel}
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onSuccessDismiss}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.gold,
              borderRadius: BORDER_RADIUS.md,
              paddingVertical: SPACING.md,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#000' }}>Done</Text>
          </TouchableOpacity>
        )}

        <Text style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.lg, lineHeight: 16 }}>
          {Platform.OS === 'ios'
            ? 'Charged through your Apple ID and credited to your organization. Manage refunds in iOS Settings.'
            : paymentProvider === 'iap'
              ? 'Charged through your Apple ID. Manage refunds in iOS Settings.'
              : 'Charged through your organization\'s saved card. Manage refunds via Stripe.'}
        </Text>
      </ScrollView>
    </View>
  );
}

function Bullet({ color, text, textColor }: { color: string; text: string; textColor: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
      <View style={{ marginTop: 2 }}>
        <Ionicons name="checkmark-circle" size={16} color={color} />
      </View>
      <Text style={{ flex: 1, fontSize: 13, color: textColor, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}
