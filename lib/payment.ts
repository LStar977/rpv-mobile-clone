import { Platform, Alert } from 'react-native';
import { iapAvailable, purchaseProduct, validateReceipt, IAP_PRODUCTS } from './iap';
import {
  fetchPremiumPaymentIntent,
  fetchPremiumCheckoutUrl,
  fetchOrganizationPaymentIntent,
  processPayment as stripeProcessPayment,
} from './stripe';
import { useAuthStore } from './auth';

export interface PaymentResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
}

/**
 * Determine if IAP should be used (iOS with IAP available).
 * Apple Guideline 3.1: digital subscriptions on iOS MUST use Apple IAP.
 * Stripe is the Android-only path.
 */
export function shouldUseIAP(): boolean {
  return Platform.OS === 'ios' && iapAvailable;
}

/**
 * Process verification payment.
 * Verification is FREE for everyone — this returns immediate success
 * for backward compatibility with any code that still calls it.
 */
export async function processVerificationPayment(_token: string | null): Promise<PaymentResult> {
  return { success: true };
}

/**
 * Process premium subscription ($7.99/month).
 *
 * iOS: Apple IAP, never Stripe (App Store Guideline 3.1).
 * Android: Stripe Payment Sheet.
 */
export async function processPremiumPayment(token: string | null): Promise<PaymentResult> {
  if (Platform.OS === 'ios') {
    if (!iapAvailable) {
      Alert.alert(
        'In-app purchase unavailable',
        'Please update the app or restart and try again. If the problem persists, contact support@representvote.com.',
      );
      return {
        success: false,
        error: 'IAP unavailable on this device',
      };
    }
    return processIAPPurchase(IAP_PRODUCTS.premium, token);
  }
  return processStripePremium(token);
}

/**
 * Process organization subscription.
 *
 * iOS: Apple IAP, never Stripe.
 * Android: Stripe Payment Sheet.
 */
// Stage 3 tier names. Free is no-payment (org just exists at tier='free').
// Government is set by sales — no payment flow.
export type OrgTier = 'free' | 'pro' | 'plus' | 'business' | 'government';

export async function processOrganizationPayment(
  token: string | null,
  tier: OrgTier,
  organizationId: string,
): Promise<PaymentResult> {
  // Free tier doesn't go through any payment flow — the org just gets
  // tier='free' in the DB and the user is done. The caller decides whether
  // to create the org with this tier or upgrade an existing org.
  if (tier === 'free') {
    return { success: true };
  }

  if (tier === 'government') {
    Alert.alert(
      'Contact sales',
      'Government plans are quoted individually. Email sales@representvote.com to get started.',
    );
    return { success: false, error: 'Government tier is set by sales' };
  }

  const tierToProduct: Record<'pro' | 'plus' | 'business', string> = {
    // IAP product IDs follow the same .org.<tier> pattern as the legacy
    // SKUs. Operators must register the new ones in App Store Connect.
    pro: (IAP_PRODUCTS as any).orgPro || (IAP_PRODUCTS as any).orgProfessional || '',
    plus: (IAP_PRODUCTS as any).orgPlus || (IAP_PRODUCTS as any).orgPremium || '',
    business: (IAP_PRODUCTS as any).orgBusiness || (IAP_PRODUCTS as any).orgEnterprise || '',
  };

  if (Platform.OS === 'ios') {
    if (!iapAvailable) {
      Alert.alert(
        'In-app purchase unavailable',
        'Please update the app or restart and try again. If the problem persists, contact support@representvote.com.',
      );
      return {
        success: false,
        error: 'IAP unavailable on this device',
      };
    }
    return processIAPPurchase(tierToProduct[tier], token, organizationId);
  }
  // Free + Government short-circuited above; this branch only runs for
  // paid self-serve tiers.
  return processStripeOrganization(token, tier as 'pro' | 'plus' | 'business', organizationId);
}

// --- IAP flow (iOS only) ---

async function processIAPPurchase(
  productId: string,
  token: string | null,
  organizationId?: string,
): Promise<PaymentResult> {
  const result = await purchaseProduct(productId);

  if (result.cancelled) {
    return { success: false, cancelled: true };
  }

  if (!result.success || !result.receipt) {
    return { success: false, error: result.error || 'Purchase failed' };
  }

  // Validate receipt with backend
  const validation = await validateReceipt(result.receipt, token, productId, organizationId);
  if (!validation.valid) {
    return { success: false, error: validation.error || 'Receipt validation failed' };
  }

  // Refetch the user object so subscriptionStatus flips to 'active' in the
  // app immediately. The ballot store's useSyncBallotTier hook listens to
  // the user object and will flip tier='premium' as a side-effect, which
  // updates the Free→Premium UI state without a manual pull-to-refresh.
  try {
    await useAuthStore.getState().checkAuth();
  } catch (e) {
    // Non-fatal — purchase succeeded, the next route load will sync state.
  }

  return { success: true };
}

// --- Stripe flows (Android only) ---
//
// CRITICAL: these functions must never be called when Platform.OS === 'ios'.
// The entry-point gates above enforce that. Linking.openURL to a Stripe URL
// from iOS would violate App Store Guideline 3.1.3(a) and trigger rejection.

async function processStripePremium(token: string | null): Promise<PaymentResult> {
  if (Platform.OS === 'ios') {
    // Defensive guard. Should never reach here.
    return { success: false, error: 'Stripe flow blocked on iOS' };
  }
  try {
    const paymentIntent = await fetchPremiumPaymentIntent(token);

    if (paymentIntent.clientSecret) {
      const result = await stripeProcessPayment({
        clientSecret: paymentIntent.clientSecret,
        ephemeralKey: paymentIntent.ephemeralKey,
        customerId: paymentIntent.customerId,
        merchantDisplayName: 'Represent Wallet',
      });
      return result;
    } else if (paymentIntent.url) {
      const { Linking } = require('react-native');
      await Linking.openURL(paymentIntent.url);
      return { success: true };
    }
    return { success: false, error: 'No payment method available' };
  } catch (error: any) {
    try {
      const url = await fetchPremiumCheckoutUrl(token);
      const { Linking } = require('react-native');
      await Linking.openURL(url);
      return { success: true };
    } catch (fallbackError: any) {
      return { success: false, error: fallbackError.message || 'Payment failed' };
    }
  }
}

async function processStripeOrganization(
  token: string | null,
  // Stripe path is only reached for paid self-serve tiers — Free is
  // short-circuited and Government goes through sales. Narrow the type
  // accordingly so fetchOrganizationPaymentIntent's stricter signature
  // is satisfied without a cast.
  tier: 'pro' | 'plus' | 'business',
  organizationId: string,
): Promise<PaymentResult> {
  if (Platform.OS === 'ios') {
    // Defensive guard. Should never reach here.
    return { success: false, error: 'Stripe flow blocked on iOS' };
  }
  try {
    const paymentIntent = await fetchOrganizationPaymentIntent(token, tier, organizationId);

    // Tier-change response: server detected the org already has an active
    // subscription and called subscriptions.update with the new price.
    // No payment sheet needed (existing card on file). Refresh and succeed.
    if ((paymentIntent as any).updated) {
      try {
        await useAuthStore.getState().checkAuth();
      } catch {
        // Non-fatal — UI will refresh on next route load.
      }
      return { success: true };
    }

    if (paymentIntent.clientSecret) {
      const result = await stripeProcessPayment({
        clientSecret: paymentIntent.clientSecret,
        ephemeralKey: paymentIntent.ephemeralKey,
        customerId: paymentIntent.customerId,
        merchantDisplayName: 'Represent Wallet',
      });
      return result;
    } else if (paymentIntent.url) {
      const { Linking } = require('react-native');
      await Linking.openURL(paymentIntent.url);
      return { success: true };
    }
    return { success: false, error: 'No payment method available' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Payment failed' };
  }
}

/**
 * Cancel an org's Stripe subscription. Schedules cancel-at-period-end so
 * the org keeps access through the paid period; the existing
 * customer.subscription.deleted webhook flips the status when Stripe ends
 * the sub. IAP-paid orgs cannot use this path — the caller must redirect
 * to iOS Settings (the backend returns code IAP_CANCEL_VIA_SETTINGS in
 * that case for the UI to detect).
 */
export async function cancelOrganizationStripe(
  token: string | null,
  organizationId: string,
): Promise<{ success: boolean; effectiveAt?: string; error?: string; iapRedirect?: boolean }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';
    const response = await fetch(`${API_URL}/api/organizations/${organizationId}/cancel-subscription`, {
      method: 'POST',
      headers,
    });
    const body = await response.json();
    if (!response.ok) {
      if (body?.code === 'IAP_CANCEL_VIA_SETTINGS') {
        return { success: false, iapRedirect: true, error: body.error };
      }
      return { success: false, error: body?.error || `HTTP ${response.status}` };
    }
    return { success: true, effectiveAt: body.effectiveAt };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Cancel failed' };
  }
}
