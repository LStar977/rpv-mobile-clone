// App Store Server Notifications V2 handler. Mirrors webhookHandlers.ts
// (which handles Stripe events) but for Apple's IAP lifecycle.
//
// Receives signed JWS payloads from Apple, verifies the signature against
// Apple's root CAs, and routes the decoded notification to the right user
// or org row by `originalTransactionId` (set on initial purchase by
// validateReceipt in routes.ts).
//
// Configure App Store Connect → My Apps → [app] → App Information →
// App Store Server Notifications → Production/Sandbox URL = this endpoint,
// Version = V2.
//
// References:
//   https://developer.apple.com/documentation/appstoreservernotifications
//   https://github.com/apple/app-store-server-library-node

import {
  SignedDataVerifier,
  Environment,
  NotificationTypeV2,
  Subtype,
} from '@apple/app-store-server-library';
import { db } from './db';
import { users, organizations } from '@shared/schema';
import { storage } from './storage-db';
import { eq } from 'drizzle-orm';

function log(message: string) {
  console.log(`[IAPWebhook] ${message}`);
}

// Apple Root CA-G3 — used to sign App Store Server Notifications V2.
// We fetch it on first use and cache in memory. The cert is public,
// immutable, and well under 2KB. Caching avoids a network call per event.
//
// If we ever need additional roots (e.g. legacy AppleRootCA / G2 for older
// receipts), add their URLs to ROOT_CA_URLS.
const ROOT_CA_URLS = [
  'https://www.apple.com/appleca/AppleIncRootCertificate.cer',
  'https://www.apple.com/certificateauthority/AppleRootCA-G2.cer',
  'https://www.apple.com/certificateauthority/AppleRootCA-G3.cer',
];

let cachedRootCAs: Buffer[] | null = null;
let cachedVerifier: { verifier: SignedDataVerifier; env: Environment } | null = null;

async function getRootCAs(): Promise<Buffer[]> {
  if (cachedRootCAs) return cachedRootCAs;
  const fetched = await Promise.all(
    ROOT_CA_URLS.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch Apple root CA at ${url}: ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      log(`Fetched Apple root CA from ${url} (${buf.length} bytes)`);
      return buf;
    }),
  );
  cachedRootCAs = fetched;
  return fetched;
}

async function getVerifier(): Promise<SignedDataVerifier> {
  // Environment: Apple sends Sandbox notifications during development +
  // TestFlight, Production for live App Store sales. The notification's
  // own signedTransactionInfo also carries an environment field, but
  // SignedDataVerifier needs the expected environment up front to validate
  // the cert chain correctly.
  const envName = (process.env.APPLE_IAP_ENVIRONMENT || 'Production').toLowerCase();
  const env =
    envName === 'sandbox' ? Environment.SANDBOX :
    envName === 'xcode' ? Environment.XCODE :
    envName === 'localtesting' || envName === 'local_testing' ? Environment.LOCAL_TESTING :
    Environment.PRODUCTION;

  if (cachedVerifier && cachedVerifier.env === env) return cachedVerifier.verifier;

  const bundleId = process.env.APPLE_BUNDLE_ID || 'com.representwallet.app';
  // appAppleId is the numeric App ID from App Store Connect → App Info.
  // REQUIRED for Production environment; the library throws otherwise.
  const appAppleIdRaw = process.env.APPLE_APP_ID;
  const appAppleId = appAppleIdRaw ? Number(appAppleIdRaw) : undefined;
  if (env === Environment.PRODUCTION && !appAppleId) {
    log('WARNING: APPLE_APP_ID not set; production verification will fail. Set the numeric App ID from App Store Connect.');
  }

  const roots = await getRootCAs();
  // enableOnlineChecks=true asks the verifier to check OCSP revocation +
  // current cert validity. Recommended for production. Adds latency
  // (~50-200ms per notification) but Apple's CDN keeps OCSP fast.
  const verifier = new SignedDataVerifier(roots, true, env, bundleId, appAppleId);
  cachedVerifier = { verifier, env };
  log(`Verifier initialized: env=${env}, bundleId=${bundleId}, appAppleId=${appAppleId ?? '(unset)'}`);
  return verifier;
}

export class IAPWebhookHandlers {
  static async processNotification(signedPayload: string): Promise<void> {
    const verifier = await getVerifier();
    const payload = await verifier.verifyAndDecodeNotification(signedPayload);
    const notificationType = payload.notificationType as NotificationTypeV2;
    const subtype = payload.subtype as Subtype | undefined;

    log(`Processing notification: type=${notificationType} subtype=${subtype ?? '(none)'}`);

    // TEST notifications carry no signedTransactionInfo. Apple sends one
    // when the operator clicks "Send Test Notification" in App Store
    // Connect. We log and bail — nothing to update.
    if (notificationType === NotificationTypeV2.TEST) {
      log(`Test notification received successfully`);
      return;
    }

    const signedTxInfo = payload.data?.signedTransactionInfo;
    if (!signedTxInfo) {
      log(`Notification has no signedTransactionInfo; nothing to attribute. Skipping.`);
      return;
    }
    const txInfo = await verifier.verifyAndDecodeTransaction(signedTxInfo);

    const originalTxId = txInfo.originalTransactionId;
    const productId = txInfo.productId;
    const expiresMs = txInfo.expiresDate;
    const expiresAt = expiresMs ? new Date(expiresMs) : null;
    const environment = txInfo.environment;

    if (!originalTxId) {
      log(`Notification missing originalTransactionId; cannot attribute. Skipping.`);
      return;
    }

    // Renewal info is optional but useful for DID_CHANGE_RENEWAL_STATUS
    // and for distinguishing voluntary vs billing-failure cancellations.
    let renewalInfo: any = null;
    const signedRenewalInfo = payload.data?.signedRenewalInfo;
    if (signedRenewalInfo) {
      try {
        renewalInfo = await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo);
      } catch (err: any) {
        log(`Failed to decode renewal info: ${err?.message ?? err}`);
      }
    }

    // Attribute to either a user (personal Premium) or an org (org IAP).
    // Look up by the dedicated iapOriginalTransactionId column populated
    // by validateReceipt on initial purchase. If both lookups miss, this
    // is most likely a notification for a transaction we never saw the
    // initial receipt for — log and move on rather than 5xx (Apple
    // would retry up to 5 times over 5 days).
    const user = await storage.findUserByIapTxId(originalTxId);
    const org = user ? null : await storage.findOrganizationByIapTxId(originalTxId);

    if (!user && !org) {
      log(`No user or org found for originalTransactionId=${originalTxId} (productId=${productId}). Was the initial validateReceipt call missed? Logging and skipping.`);
      return;
    }

    const target = user ? { kind: 'user' as const, id: user.id } : { kind: 'org' as const, id: org!.id };
    log(`Attributed to ${target.kind}=${target.id}, productId=${productId}, env=${environment}`);

    switch (notificationType) {
      case NotificationTypeV2.SUBSCRIBED: {
        // Initial purchase is already handled by validateReceipt before this
        // notification arrives. Treat as a state-refresh: ensure status is
        // 'active' and end date is in sync.
        await applySubscriptionUpdate(target, {
          subscriptionStatus: 'active',
          subscriptionEndDate: expiresAt,
        });
        break;
      }

      case NotificationTypeV2.DID_RENEW: {
        // Successful auto-renewal. Push out the end date.
        await applySubscriptionUpdate(target, {
          subscriptionStatus: 'active',
          subscriptionEndDate: expiresAt,
        });
        break;
      }

      case NotificationTypeV2.DID_FAIL_TO_RENEW: {
        // Billing failure. GRACE_PERIOD subtype means Apple is still
        // retrying and the user retains access; no subtype means the
        // grace period also failed and the sub is effectively dead.
        if (subtype === Subtype.GRACE_PERIOD) {
          await applySubscriptionUpdate(target, { subscriptionStatus: 'past_due' });
        } else {
          await applySubscriptionUpdate(target, {
            subscriptionStatus: 'canceled',
            subscriptionEndDate: expiresAt,
          });
        }
        break;
      }

      case NotificationTypeV2.GRACE_PERIOD_EXPIRED: {
        await applySubscriptionUpdate(target, {
          subscriptionStatus: 'canceled',
          subscriptionEndDate: expiresAt,
        });
        break;
      }

      case NotificationTypeV2.EXPIRED: {
        // Subscription has fully expired (could be voluntary cancel that
        // ran out, or BILLING_RETRY that never recovered). Either way,
        // access ends.
        await applySubscriptionUpdate(target, {
          subscriptionStatus: 'canceled',
          subscriptionEndDate: expiresAt,
        });
        break;
      }

      case NotificationTypeV2.REFUND:
      case NotificationTypeV2.REVOKE: {
        // REFUND: customer-issued refund, access revoked immediately.
        // REVOKE: Family Sharing revocation — same effect.
        await applySubscriptionUpdate(target, {
          subscriptionStatus: 'canceled',
          subscriptionEndDate: new Date(), // end now
        });
        break;
      }

      case NotificationTypeV2.REFUND_REVERSED: {
        // The refund was reversed (chargeback dispute won). Restore access
        // until the original expiresDate.
        await applySubscriptionUpdate(target, {
          subscriptionStatus: 'active',
          subscriptionEndDate: expiresAt,
        });
        break;
      }

      case NotificationTypeV2.DID_CHANGE_RENEWAL_STATUS: {
        // User toggled auto-renew in iOS Settings. Status stays whatever
        // it is (active/past_due) until period end; the UI may want to
        // surface "ends on X" when AUTO_RENEW_DISABLED. We don't model
        // a dedicated cancelAt column today — log only.
        log(`Renewal status changed for ${target.kind}=${target.id}: ${subtype ?? '(no subtype)'} (expiresAt=${expiresAt?.toISOString()})`);
        break;
      }

      case NotificationTypeV2.PRICE_INCREASE:
      case NotificationTypeV2.DID_CHANGE_RENEWAL_PREF:
      case NotificationTypeV2.OFFER_REDEEMED:
      case NotificationTypeV2.RENEWAL_EXTENDED:
      case NotificationTypeV2.RENEWAL_EXTENSION:
      case NotificationTypeV2.PRICE_CHANGE:
      case NotificationTypeV2.METADATA_UPDATE:
      case NotificationTypeV2.MIGRATION:
        // Informational events — no DB state change needed at this stage.
        log(`Informational event ${notificationType}; no action.`);
        break;

      case NotificationTypeV2.CONSUMPTION_REQUEST:
        // Apple is asking for our consumption data (used for refund
        // adjudication on consumable IAPs). We only sell subscriptions
        // today, so this shouldn't fire — log if it does.
        log(`Unexpected CONSUMPTION_REQUEST for subscription product ${productId}`);
        break;

      default:
        log(`Unhandled notification type: ${notificationType}`);
        break;
    }
  }
}

// Apply a subscription state update to the right table. Centralizing this
// keeps each switch arm a one-liner.
async function applySubscriptionUpdate(
  target: { kind: 'user'; id: string } | { kind: 'org'; id: string },
  patch: { subscriptionStatus?: string; subscriptionEndDate?: Date | null },
): Promise<void> {
  if (target.kind === 'user') {
    const update: Record<string, any> = {};
    if (patch.subscriptionStatus !== undefined) update.subscriptionStatus = patch.subscriptionStatus;
    if (patch.subscriptionEndDate !== undefined) update.subscriptionEndDate = patch.subscriptionEndDate;
    if (Object.keys(update).length === 0) return;
    await db.update(users).set(update).where(eq(users.id, target.id));
    log(`Updated user ${target.id}: ${JSON.stringify(update)}`);
  } else {
    const update: Record<string, any> = {};
    if (patch.subscriptionStatus !== undefined) update.subscriptionStatus = patch.subscriptionStatus;
    // organizations table doesn't have a subscriptionEndDate column today.
    // The Stripe path also doesn't set one for orgs. If we want per-org
    // expiry tracking, that's a separate schema change.
    if (Object.keys(update).length === 0) return;
    await db.update(organizations).set(update).where(eq(organizations.id, target.id));
    log(`Updated org ${target.id}: ${JSON.stringify(update)}`);
  }
}
