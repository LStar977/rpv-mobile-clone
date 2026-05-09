import { Platform, Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// Product IDs - must match App Store Connect
// Note: orgStarter intentionally points at the legacy `.org.community` SKU.
// The App Store SKU was registered as "community" originally; we kept the
// existing string here so existing subscribers + App Store Connect stay
// aligned. Only the JS-side identifier was renamed.
//
// Verification is FREE for everyone now, so there's no verification SKU.
// All remaining products are auto-renewable subscriptions.
export const IAP_PRODUCTS = {
  premium: 'com.representwallet.app.premium',
  orgStarter: 'com.representwallet.app.org.community',
  orgProfessional: 'com.representwallet.app.org.professional',
  orgPremium: 'com.representwallet.app.org.premium',
  orgEnterprise: 'com.representwallet.app.org.enterprise',
} as const;

// Conditionally import react-native-iap to handle missing native module (e.g., in Expo Go)
let RNIap: any = null;
let iapAvailable = false;

try {
  RNIap = require('react-native-iap');
  iapAvailable = true;
} catch (e) {
  // react-native-iap native module not available
}

export { iapAvailable };

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
}

export interface IAPPurchaseResult {
  success: boolean;
  receipt?: string;
  transactionId?: string;
  error?: string;
  cancelled?: boolean;
}

let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;
let pendingPurchaseResolve: ((result: IAPPurchaseResult) => void) | null = null;

/**
 * Initialize IAP connection and listeners
 */
export async function initIAP(): Promise<boolean> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') return false;

  try {
    await RNIap.initConnection();

    // Set up purchase update listener
    purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(
      async (purchase: any) => {
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          // No more consumables — verification is one-time, premium/org are
          // subscriptions. Always finish as non-consumable.
          try {
            await RNIap.finishTransaction({ purchase, isConsumable: false });
          } catch (e) {
            console.error('Error finishing transaction:', e);
          }

          if (pendingPurchaseResolve) {
            pendingPurchaseResolve({
              success: true,
              receipt,
              transactionId: purchase.transactionId,
            });
            pendingPurchaseResolve = null;
          }
        }
      }
    );

    // Set up purchase error listener
    purchaseErrorSubscription = RNIap.purchaseErrorListener(
      (error: any) => {
        if (pendingPurchaseResolve) {
          const cancelled = error.code === 'E_USER_CANCELLED';
          pendingPurchaseResolve({
            success: false,
            cancelled,
            error: cancelled ? undefined : error.message,
          });
          pendingPurchaseResolve = null;
        }
      }
    );

    return true;
  } catch (error) {
    console.error('IAP init error:', error);
    return false;
  }
}

/**
 * Clean up IAP listeners
 */
export function endIAP() {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }
  if (iapAvailable && RNIap) {
    RNIap.endConnection();
  }
}

/**
 * Get available products from the App Store. All remaining products are
 * auto-renewable subscriptions.
 */
export async function getProducts(skus?: string[]): Promise<IAPProduct[]> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') return [];

  const productIds = skus || Object.values(IAP_PRODUCTS);

  try {
    const subscriptions = await RNIap.getSubscriptions({ skus: productIds }).catch(() => []);

    return subscriptions.map((p: any) => ({
      productId: p.productId,
      title: p.title || p.name || '',
      description: p.description || '',
      price: p.price || '0',
      localizedPrice: p.localizedPrice || p.price || '$0.00',
      currency: p.currency || 'USD',
    }));
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
}

/**
 * Purchase a subscription. (All remaining IAP products are subscriptions.)
 */
export async function purchaseProduct(sku: string): Promise<IAPPurchaseResult> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') {
    return { success: false, error: 'In-app purchases not available' };
  }

  return new Promise((resolve) => {
    pendingPurchaseResolve = resolve;

    RNIap.requestSubscription({ sku }).catch((error: any) => {
      if (pendingPurchaseResolve) {
        const cancelled = error.code === 'E_USER_CANCELLED';
        pendingPurchaseResolve({
          success: false,
          cancelled,
          error: cancelled ? undefined : error.message,
        });
        pendingPurchaseResolve = null;
      }
    });
  });
}

/**
 * Validate receipt with backend
 */
export async function validateReceipt(
  receipt: string,
  token: string | null,
  productId: string,
  organizationId?: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/api/iap/validate-receipt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ receipt, productId, organizationId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return { valid: false, error: error.message || 'Receipt validation failed' };
    }

    return { valid: true };
  } catch (error: any) {
    return { valid: false, error: error.message || 'Network error during validation' };
  }
}

/**
 * Restore previous purchases
 */
export async function restorePurchases(token: string | null): Promise<{
  restored: boolean;
  products: string[];
  error?: string;
}> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') {
    return { restored: false, products: [], error: 'In-app purchases not available' };
  }

  try {
    const purchases = await RNIap.getAvailablePurchases();

    if (!purchases || purchases.length === 0) {
      return { restored: false, products: [] };
    }

    // Validate each purchase with backend
    const restoredProducts: string[] = [];
    for (const purchase of purchases) {
      if (purchase.transactionReceipt) {
        const result = await validateReceipt(purchase.transactionReceipt, token, purchase.productId);
        if (result.valid) {
          restoredProducts.push(purchase.productId);
        }
      }
    }

    return {
      restored: restoredProducts.length > 0,
      products: restoredProducts,
    };
  } catch (error: any) {
    return { restored: false, products: [], error: error.message };
  }
}
