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
export type OrgTier = 'starter' | 'professional' | 'premium' | 'enterprise';

export async function processOrganizationPayment(
  token: string | null,
  tier: OrgTier,
  organizationId: string,
): Promise<PaymentResult> {
  const tierToProduct: Record<OrgTier, string> = {
    starter: IAP_PRODUCTS.orgStarter,
    professional: IAP_PRODUCTS.orgProfessional,
    premium: IAP_PRODUCTS.orgPremium,
    enterprise: IAP_PRODUCTS.orgEnterprise,
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
  return processStripeOrganization(token, tier, organizationId);
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
  tier: OrgTier,
  organizationId: string,
): Promise<PaymentResult> {
  if (Platform.OS === 'ios') {
    // Defensive guard. Should never reach here.
    return { success: false, error: 'Stripe flow blocked on iOS' };
  }
  try {
    const paymentIntent = await fetchOrganizationPaymentIntent(token, tier, organizationId);

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
