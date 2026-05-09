// Org verification unlock fee (UPDATE 26 — supersedes UPDATE 24/25 metered).
//
// Pro+ orgs pay a one-time tier-priced fee to unlock identity verification:
//   Pro      $199
//   Plus     $499
//   Business $999
//   Government — custom annual contract (no self-serve unlock)
//
// Once unlocked (organizations.verificationUnlockedAt is non-null), the org
// can toggle requireMemberVerification on/off freely without re-charge.
// Members never see a payment prompt; the platform absorbs per-verification
// Veriff/Didit cost out of the unlock fee + ongoing platform margin.
//
// The unlock survives tier changes and subscription cancellation, but is
// invalidated by Stripe refund (charge.refunded) or Apple IAP refund
// (REFUND server notification) — webhook handlers call markOrgUnlockRefunded
// in those paths.
//
// ─── Deploy notes ───────────────────────────────────────────────────────
// 1. drizzle-kit push (adds the four verification_unlock_* columns; old
//    metered columns are kept in DB for safety and ignored by the runtime).
// 2. Grandfather any orgs that already had requireMemberVerification=true
//    under the UPDATE 24/25 metered model — they paid via metered usage,
//    not an unlock fee, but we don't want to surprise-bill them with the
//    new $199/$499/$999 fee. One-line SQL:
//
//      UPDATE organizations
//        SET verification_unlocked_at = NOW(),
//            verification_unlocked_tier = tier,
//            verification_unlock_source = 'grandfathered'
//        WHERE require_member_verification = true
//          AND verification_unlocked_at IS NULL;
//
//    'grandfathered' rows have no payment_id, so refund webhooks can't
//    accidentally invalidate them (findOrgByUnlockPaymentId never matches).
// 3. Stripe dashboard: create one-time products + prices for each tier:
//      STRIPE_PRICE_VERIFICATION_UNLOCK_PRO       (one-time $199)
//      STRIPE_PRICE_VERIFICATION_UNLOCK_PLUS      (one-time $499)
//      STRIPE_PRICE_VERIFICATION_UNLOCK_BUSINESS  (one-time $999)
//    Drop the old metered prices (STRIPE_PRICE_VERIFICATION_PRO/PLUS/BUSINESS)
//    from the env — they're no longer referenced. Existing metered
//    subscription_items on prior subscriptions can be left alone; usage
//    records stop posting and the line items zero out.
// 4. App Store Connect: create three consumable IAP products with IDs
//      verification_unlock_pro       (price tier $199.99)
//      verification_unlock_plus      (price tier $499.99)
//      verification_unlock_business  (price tier $999.99)
//    These MUST exist before the iOS build can pass review.

import { eq } from "drizzle-orm";
import { db } from "./db";
import { organizations } from "@shared/schema";
import { getVerificationUnlockFeeCents } from "@shared/tier-limits";
import { log } from "./app";

// Stripe one-time price IDs for the unlock fees. Created in the Stripe
// dashboard as products with one-time prices ($199 / $499 / $999), separate
// from the recurring tier subscription products. Government tier is custom
// contract — no Stripe SKU.
export const ORG_VERIFICATION_UNLOCK_PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_VERIFICATION_UNLOCK_PRO,
  plus: process.env.STRIPE_PRICE_VERIFICATION_UNLOCK_PLUS,
  business: process.env.STRIPE_PRICE_VERIFICATION_UNLOCK_BUSINESS,
  // Legacy customers: priced at the Pro unlock; sales migrates them to a
  // current tier on next renewal anyway.
  legacy: process.env.STRIPE_PRICE_VERIFICATION_UNLOCK_PRO,
};

// IAP product IDs (consumable). Server validates the receipt against
// Apple's verifyReceipt endpoint and stamps the org. Consumable (not
// non-consumable) so Apple's per-account entitlement system can't
// auto-restore an unlock to a different org if the admin changes orgs.
export const ORG_VERIFICATION_UNLOCK_IAP_PRODUCT_IDS: Record<string, string> = {
  pro: "verification_unlock_pro",
  plus: "verification_unlock_plus",
  business: "verification_unlock_business",
  legacy: "verification_unlock_pro",
};

export function getUnlockPriceCents(tier?: string | null): number | null {
  return getVerificationUnlockFeeCents(tier);
}

export function isUnlockSku(productId: string): boolean {
  return Object.values(ORG_VERIFICATION_UNLOCK_IAP_PRODUCT_IDS).includes(productId);
}

export function tierForUnlockSku(productId: string): string | null {
  for (const [tier, sku] of Object.entries(ORG_VERIFICATION_UNLOCK_IAP_PRODUCT_IDS)) {
    if (sku === productId) return tier;
  }
  return null;
}

export type UnlockSource = "stripe" | "apple_iap" | "google_play" | "grandfathered";

// Stamps the org as unlocked. Idempotent: if already unlocked, no-op
// (preserves the original payment_id and source — webhooks may fire
// multiple times for the same checkout session).
export async function markOrgUnlocked(
  orgId: string,
  tier: string,
  paymentId: string,
  source: UnlockSource,
): Promise<void> {
  const rows = await db
    .select({ verificationUnlockedAt: organizations.verificationUnlockedAt })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (rows.length === 0) {
    log(`markOrgUnlocked: org=${orgId} not found`);
    return;
  }
  if (rows[0].verificationUnlockedAt) {
    log(`markOrgUnlocked: org=${orgId} already unlocked, skipping (payment=${paymentId})`);
    return;
  }
  await db
    .update(organizations)
    .set({
      verificationUnlockedAt: new Date(),
      verificationUnlockedTier: tier,
      verificationUnlockPaymentId: paymentId,
      verificationUnlockSource: source,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
  log(`Org verification unlocked: org=${orgId} tier=${tier} source=${source} payment=${paymentId}`);
}

// Clears the unlock + auto-disables requireMemberVerification. Called from
// Stripe charge.refunded webhook and Apple REFUND server notification when
// the original unlock payment is refunded. Idempotent.
export async function markOrgUnlockRefunded(orgId: string): Promise<void> {
  await db
    .update(organizations)
    .set({
      verificationUnlockedAt: null,
      verificationUnlockedTier: null,
      verificationUnlockPaymentId: null,
      verificationUnlockSource: null,
      requireMemberVerification: false,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, orgId));
  log(`Org verification unlock refunded: org=${orgId}`);
}

export function isOrgUnlocked(org: { verificationUnlockedAt?: Date | null } | null | undefined): boolean {
  return !!org?.verificationUnlockedAt;
}

// Resolve an org by its unlock payment id. Used by refund webhooks to
// route a refunded payment_intent / IAP transaction back to the org row.
// Rows with source='grandfathered' have no payment_id and so are never
// matched here — refund webhooks for those rows would be no-ops anyway
// since there's no real payment to refund.
export async function findOrgByUnlockPaymentId(
  paymentId: string,
): Promise<{ id: string } | null> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.verificationUnlockPaymentId, paymentId))
    .limit(1);
  return rows[0] ?? null;
}

// Vendor-data plumbing — kept for diagnostic log correlation only. Veriff
// and Didit session-create endpoints pack `userId|orgId` so logs can
// attribute a verification to its originating org. No longer used for
// billing (UPDATE 26 removed billing from this code path entirely).
export function parseVendorData(
  raw: string | undefined | null,
): { userId: string; originatingOrgId: string | null } {
  if (!raw) return { userId: "", originatingOrgId: null };
  const idx = raw.indexOf("|");
  if (idx < 0) return { userId: raw, originatingOrgId: null };
  return { userId: raw.slice(0, idx), originatingOrgId: raw.slice(idx + 1) || null };
}

export function packVendorData(userId: string, originatingOrgId?: string | null): string {
  if (!originatingOrgId) return userId;
  return `${userId}|${originatingOrgId}`;
}
