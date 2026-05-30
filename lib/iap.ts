import { Platform, Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// Product IDs - must match App Store Connect
// Note: orgStarter intentionally points at the legacy `.org.community` SKU.
// The App Store SKU was registered as "community" originally; we kept the
// existing string here so existing subscribers + App Store Connect stay
// aligned. Only the JS-side identifier was renamed.
//
// Subscription products: premium + 4 org tiers. Auto-renewable.
// Consumable products (UPDATE 26): one-time identity-verification unlock
// fees per org tier. Server is the source of truth — receipt validation
// stamps the org row, and Apple's restore-purchases path is intentionally
// not honored for these (an admin moving orgs shouldn't carry the unlock).
export const IAP_PRODUCTS = {
  premium: 'com.representwallet.app.premium',
  orgStarter: 'com.representwallet.app.org.community',
  orgProfessional: 'com.representwallet.app.org.professional',
  orgPremium: 'com.representwallet.app.org.premium',
  orgEnterprise: 'com.representwallet.app.org.enterprise',
  verificationUnlockPro: 'verification_unlock_pro',
  verificationUnlockPlus: 'verification_unlock_plus',
  verificationUnlockBusiness: 'verification_unlock_business',
} as const;

// SKUs that should be finished as consumables (not non-consumables) and
// purchased via requestPurchase / getProducts (not requestSubscription /
// getSubscriptions). Keep this list in sync with the unlock entries above.
const CONSUMABLE_SKUS = new Set<string>([
  IAP_PRODUCTS.verificationUnlockPro,
  IAP_PRODUCTS.verificationUnlockPlus,
  IAP_PRODUCTS.verificationUnlockBusiness,
]);

export function isConsumableSku(sku: string): boolean {
  return CONSUMABLE_SKUS.has(sku);
}

export function unlockSkuForTier(tier: string): string | null {
  switch (tier) {
    case 'pro':
    case 'legacy':
      return IAP_PRODUCTS.verificationUnlockPro;
    case 'plus':
      return IAP_PRODUCTS.verificationUnlockPlus;
    case 'business':
      return IAP_PRODUCTS.verificationUnlockBusiness;
    default:
      return null;
  }
}

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
  productId?: string;
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
          // Verification-unlock SKUs are consumables (server-side state
          // is the source of truth). Subscriptions stay non-consumable.
          const consumable = isConsumableSku(purchase.productId);
          try {
            await RNIap.finishTransaction({ purchase, isConsumable: consumable });
          } catch (e) {
            console.error('Error finishing transaction:', e);
          }

          if (pendingPurchaseResolve) {
            pendingPurchaseResolve({
              success: true,
              receipt,
              transactionId: purchase.transactionId,
              productId: purchase.productId,
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
 * Get available products from the App Store. Splits SKUs across the
 * subscriptions and (consumable) products endpoints; merges the two lists.
 */
export async function getProducts(skus?: string[]): Promise<IAPProduct[]> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') return [];

  const productIds = skus || Object.values(IAP_PRODUCTS);
  const subscriptionSkus = productIds.filter((s) => !isConsumableSku(s));
  const consumableSkus = productIds.filter((s) => isConsumableSku(s));

  try {
    const [subs, prods] = await Promise.all([
      subscriptionSkus.length ? RNIap.getSubscriptions({ skus: subscriptionSkus }).catch(() => []) : Promise.resolve([]),
      consumableSkus.length ? RNIap.getProducts({ skus: consumableSkus }).catch(() => []) : Promise.resolve([]),
    ]);

    return [...subs, ...prods].map((p: any) => ({
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
 * Purchase a product. Routes to requestSubscription for auto-renewable
 * subscriptions and requestPurchase for consumables (verification unlock).
 */
export async function purchaseProduct(sku: string): Promise<IAPPurchaseResult> {
  if (!iapAvailable || !RNIap || Platform.OS !== 'ios') {
    return { success: false, error: 'In-app purchases not available' };
  }

  const consumable = isConsumableSku(sku);

  // CRITICAL: StoreKit must have the product loaded into its cache before
  // requestPurchase/requestSubscription will work. Calling the purchase
  // request for a SKU that was never fetched throws "Invalid product ID"
  // (E_DEVELOPER_ERROR / SKErrorDomain) even when the product is correctly
  // configured in App Store Connect. Prefetch the specific SKU first.
  try {
    if (consumable) {
      await RNIap.getProducts({ skus: [sku] });
    } else {
      await RNIap.getSubscriptions({ skus: [sku] });
    }
  } catch (e: any) {
    return {
      success: false,
      error:
        'This purchase is temporarily unavailable. Please make sure you are signed in to the App Store and try again.',
    };
  }

  return new Promise((resolve) => {
    pendingPurchaseResolve = resolve;

    const request = consumable
      ? RNIap.requestPurchase({ sku })
      : RNIap.requestSubscription({ sku });

    request.catch((error: any) => {
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

    // Validate each purchase with backend. Skip consumable SKUs
    // (verification unlock) — Apple's getAvailablePurchases shouldn't
    // return them anyway, but defense in depth: server is the source of
    // truth for unlock state, restore-purchases must not re-credit one.
    const restoredProducts: string[] = [];
    for (const purchase of purchases) {
      if (isConsumableSku(purchase.productId)) continue;
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
