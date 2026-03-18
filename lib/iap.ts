import { Platform, Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// Product IDs - must match App Store Connect
export const IAP_PRODUCTS = {
  verification: 'com.representwallet.app.verification',
  premium: 'com.representwallet.app.premium',
  orgCommunity: 'com.representwallet.app.org.community',
  orgProfessional: 'com.representwallet.app.org.professional',
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
          // Finish the transaction
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
 * Get available products from the App Store
 */
export async function getProducts(skus?: string[]): Promise<IAPProduct[]> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') return [];

  const productIds = skus || Object.values(IAP_PRODUCTS);

  try {
    // Get both regular products and subscriptions
    const [products, subscriptions] = await Promise.all([
      RNIap.getProducts({ skus: [IAP_PRODUCTS.verification] }).catch(() => []),
      RNIap.getSubscriptions({ skus: productIds.filter(id => id !== IAP_PRODUCTS.verification) }).catch(() => []),
    ]);

    const allProducts = [...products, ...subscriptions];

    return allProducts.map((p: any) => ({
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
 * Purchase a product
 */
export async function purchaseProduct(sku: string): Promise<IAPPurchaseResult> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') {
    return { success: false, error: 'In-app purchases not available' };
  }

  return new Promise((resolve) => {
    pendingPurchaseResolve = resolve;

    // Determine if this is a subscription or one-time purchase
    const isSubscription = sku !== IAP_PRODUCTS.verification;

    if (isSubscription) {
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
    } else {
      RNIap.requestPurchase({ sku }).catch((error: any) => {
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
    }
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
