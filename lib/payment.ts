import { Platform, Alert } from 'react-native';
import { iapAvailable, purchaseProduct, validateReceipt, IAP_PRODUCTS } from './iap';
import {
  fetchVerificationPaymentIntent,
  fetchVerificationCheckoutUrl,
  fetchPremiumPaymentIntent,
  fetchPremiumCheckoutUrl,
  fetchOrganizationPaymentIntent,
  processPayment as stripeProcessPayment,
  showPaymentError,
  showPaymentSuccess,
} from './stripe';
import { useAuthStore } from './auth';

export interface PaymentResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
}

/**
 * Determine if IAP should be used (iOS with IAP available)
 */
export function shouldUseIAP(): boolean {
  return Platform.OS === 'ios' && iapAvailable;
}

/**
 * Process verification payment
 * NOTE: Verification is now FREE - this function returns immediate success
 * for backward compatibility with any code that still calls it
 */
export async function processVerificationPayment(token: string | null): Promise<PaymentResult> {
  // Verification is now free - return immediate success
  return { success: true };
}

/**
 * Process premium subscription ($7.99/month)
 */
export async function processPremiumPayment(token: string | null): Promise<PaymentResult> {
  if (shouldUseIAP()) {
    return processIAPPurchase(IAP_PRODUCTS.premium, token);
  }
  return processStripePremium(token);
}

/**
 * Process organization subscription
 */
export async function processOrganizationPayment(
  token: string | null,
  tier: 'community' | 'professional' | 'enterprise',
  organizationId: string
): Promise<PaymentResult> {
  const tierToProduct: Record<string, string> = {
    community: IAP_PRODUCTS.orgCommunity,
    professional: IAP_PRODUCTS.orgProfessional,
    enterprise: IAP_PRODUCTS.orgEnterprise,
  };

  if (shouldUseIAP()) {
    return processIAPPurchase(tierToProduct[tier], token, organizationId);
  }
  return processStripeOrganization(token, tier, organizationId);
}

// --- IAP flow ---

async function processIAPPurchase(
  productId: string,
  token: string | null,
  organizationId?: string
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

// --- Stripe flows ---

async function processStripeVerification(token: string | null): Promise<PaymentResult> {
  try {
    const paymentIntent = await fetchVerificationPaymentIntent(token);

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
    // Fallback to web checkout
    try {
      const url = await fetchVerificationCheckoutUrl(token);
      const { Linking } = require('react-native');
      await Linking.openURL(url);
      return { success: true };
    } catch (fallbackError: any) {
      return { success: false, error: fallbackError.message || 'Payment failed' };
    }
  }
}

async function processStripePremium(token: string | null): Promise<PaymentResult> {
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
  tier: 'community' | 'professional' | 'enterprise',
  organizationId: string
): Promise<PaymentResult> {
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
