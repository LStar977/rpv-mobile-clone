import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// Conditionally import Stripe native modules to handle missing native module (e.g., in Expo Go)
let initPaymentSheet: any = null;
let presentPaymentSheet: any = null;
let PaymentSheetError: any = { Canceled: 'Canceled' };
let ApplePay: any = null;
let GooglePay: any = null;
let stripeAvailable = false;

try {
  const stripe = require('@stripe/stripe-react-native');
  initPaymentSheet = stripe.initPaymentSheet;
  presentPaymentSheet = stripe.presentPaymentSheet;
  PaymentSheetError = stripe.PaymentSheetError;
  ApplePay = stripe.ApplePay;
  GooglePay = stripe.GooglePay;
  stripeAvailable = true;
} catch (e) {
  // Stripe native module not available - payment features disabled
}

export { stripeAvailable };

// Stripe publishable key
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_live_51SXWK5D2jsTroGJyzClzoHiUPBego83bH9EwfQncDVt9D7ArUNiB6KzIJRlTT0CiGBaPKKVlyOP2DaltuuFf8T1o00xmHM5kGX';

// Merchant identifier for Apple Pay
export const MERCHANT_IDENTIFIER = 'merchant.com.representwallet.app';

export interface PaymentIntentResponse {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  // For backwards compatibility with web checkout
  url?: string;
}

export interface PaymentResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
}

/**
 * Fetch payment intent for verification ($4.99 one-time)
 */
export async function fetchVerificationPaymentIntent(token: string | null): Promise<PaymentIntentResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api/stripe/verification-payment-intent`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment intent');
  }

  return response.json();
}

/**
 * Fetch payment intent for premium subscription ($7.99/month)
 */
export async function fetchPremiumPaymentIntent(token: string | null): Promise<PaymentIntentResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api/stripe/premium-payment-intent`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment intent');
  }

  return response.json();
}

/**
 * Fetch payment intent for organization subscription ($29-299/month)
 * Requires organizationId - org must be created first with pending status
 */
export async function fetchOrganizationPaymentIntent(
  token: string | null,
  tier: 'starter' | 'professional' | 'premium' | 'enterprise',
  organizationId: string
): Promise<PaymentIntentResponse & { paymentIntentId?: string; subscriptionId?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api/stripe/organization-payment-intent`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tier, organizationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create payment intent');
  }

  return response.json();
}

/**
 * Legacy checkout URL fetchers for backwards compatibility
 */
export async function fetchVerificationCheckoutUrl(token: string | null): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api/stripe/verification-checkout`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const { url } = await response.json();
  return url;
}

export async function fetchPremiumCheckoutUrl(token: string | null): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/api/stripe/premium-checkout`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const { url } = await response.json();
  return url;
}

/**
 * Initialize and present the Stripe Payment Sheet
 */
export async function initializePaymentSheet(params: {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  merchantDisplayName?: string;
  allowsDelayedPaymentMethods?: boolean;
}): Promise<{ error?: any }> {
  if (!stripeAvailable || !initPaymentSheet) {
    return { error: { message: 'Stripe is not available. Please use a production build.' } };
  }

  const {
    clientSecret,
    ephemeralKey,
    customerId,
    merchantDisplayName = 'Represent Wallet',
    allowsDelayedPaymentMethods = false,
  } = params;

  return initPaymentSheet({
    paymentIntentClientSecret: clientSecret,
    customerEphemeralKeySecret: ephemeralKey,
    customerId,
    merchantDisplayName,
    allowsDelayedPaymentMethods,
    // Apple Pay configuration
    applePay: {
      merchantCountryCode: 'US',
    },
    // Google Pay configuration
    googlePay: {
      merchantCountryCode: 'US',
      testEnv: __DEV__, // Use test environment in development
    },
    // Style configuration
    appearance: {
      colors: {
        primary: '#C9A227', // Gold accent color
        background: '#040707',
        componentBackground: '#1A1A1A',
        componentText: '#FFFFFF',
        componentBorder: '#333333',
        placeholderText: '#888888',
        icon: '#C9A227',
      },
      shapes: {
        borderRadius: 12,
        borderWidth: 1,
      },
    },
    returnURL: 'represent://payment-complete',
  });
}

/**
 * Present the Payment Sheet and handle the result
 */
export async function presentPayment(): Promise<PaymentResult> {
  if (!stripeAvailable || !presentPaymentSheet) {
    return { success: false, error: 'Stripe is not available. Please use a production build.' };
  }

  const { error } = await presentPaymentSheet();

  if (error) {
    if (error.code === PaymentSheetError.Canceled) {
      return { success: false, cancelled: true };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Complete payment flow: initialize and present Payment Sheet
 */
export async function processPayment(params: {
  clientSecret: string;
  ephemeralKey: string;
  customerId: string;
  merchantDisplayName?: string;
}): Promise<PaymentResult> {
  // Initialize the Payment Sheet
  const { error: initError } = await initializePaymentSheet(params);

  if (initError) {
    return { success: false, error: initError.message };
  }

  // Present the Payment Sheet
  return presentPayment();
}

/**
 * Check if Apple Pay is available
 */
export async function isApplePaySupported(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !stripeAvailable || !ApplePay) return false;

  try {
    const result = await ApplePay.isApplePaySupported();
    return result.isApplePaySupported;
  } catch {
    return false;
  }
}

/**
 * Check if Google Pay is available
 */
export async function isGooglePaySupported(): Promise<boolean> {
  if (Platform.OS !== 'android' || !stripeAvailable || !GooglePay) return false;

  try {
    const { isReady } = await GooglePay.isGooglePaySupported({
      testEnv: __DEV__,
    });
    return isReady;
  } catch {
    return false;
  }
}

/**
 * Show payment error alert
 */
export function showPaymentError(message: string) {
  Alert.alert(
    'Payment Failed',
    message || 'There was an error processing your payment. Please try again.',
    [{ text: 'OK' }]
  );
}

/**
 * Show payment success - navigate to receipt modal
 */
export function showPaymentSuccess(
  type: 'verification' | 'premium' | 'organization',
  options?: {
    amount?: string;
    transactionId?: string;
    organizationName?: string;
    tier?: string;
  }
) {
  const amounts = {
    verification: '$4.99',
    premium: '$7.99',
    organization:
      options?.tier === 'Premium' ? '$299.00'
        : options?.tier === 'Professional' ? '$99.00'
        : '$29.00',
  };

  router.push({
    pathname: '/modals/receipt',
    params: {
      type,
      amount: options?.amount || amounts[type],
      transactionId: options?.transactionId || `TXN-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      paymentMethod: Platform.OS === 'ios' ? 'Apple Pay' : 'Card',
      organizationName: options?.organizationName,
      tier: options?.tier,
    },
  });
}
