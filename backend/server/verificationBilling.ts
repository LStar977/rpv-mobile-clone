// Org-paid verification billing (UPDATE 24, Model A+).
//
// When a verify-required org's member completes Veriff/Didit, the
// organization is billed via Stripe metered usage above its included
// monthly quota. Members never see a payment prompt — the org's saved
// card is charged at month-end.
//
// Attribution: the verification session is created with
// `vendor_data: "userId|orgId"`. The webhook splits on `|`, finds the
// org row, and calls chargeOrgForVerification(orgId, userId).
//
// This module is intentionally side-effect-tolerant: failures inside
// chargeOrgForVerification are logged and swallowed by the caller (the
// webhook). The user's verified=true flag is the source of truth; if
// metering ever drops a unit we eat the cost rather than blocking the
// user.

import { eq } from "drizzle-orm";
import { db } from "./db";
import { organizations } from "@shared/schema";
import { storage } from "./storage-db";
import { getTierLimits } from "@shared/tier-limits";
import { log } from "./app";

// Stripe metered prices, attached as a second subscription_item on each
// paid org subscription. Created in the Stripe dashboard by the platform
// operator before this code ships. Per-unit pricing:
//   pro:      $0.0299/unit
//   plus:     $0.0249/unit
//   business: $0.0199/unit
// Government subs are billed via custom annual contract (no metered item).
export const ORG_VERIFICATION_PRICE_IDS: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_VERIFICATION_PRO,
  plus: process.env.STRIPE_PRICE_VERIFICATION_PLUS,
  business: process.env.STRIPE_PRICE_VERIFICATION_BUSINESS,
};

// Attribution helper. The Veriff/Didit session is created with
//   vendor_data: `${userId}|${orgId}`
// when the user is starting org-paid verification. Plain "userId" (no
// pipe) means self-paid — return null and skip billing.
export function parseVendorData(raw: string | undefined | null): { userId: string; originatingOrgId: string | null } {
  if (!raw) return { userId: "", originatingOrgId: null };
  const idx = raw.indexOf("|");
  if (idx < 0) return { userId: raw, originatingOrgId: null };
  return { userId: raw.slice(0, idx), originatingOrgId: raw.slice(idx + 1) || null };
}

export function packVendorData(userId: string, originatingOrgId?: string | null): string {
  if (!originatingOrgId) return userId;
  return `${userId}|${originatingOrgId}`;
}

// Lazy monthly reset. The current row may have a `verificationCountResetAt`
// in a previous calendar month; if so, zero the counter before we
// increment. Returns the new (post-increment) count.
async function incrementWithReset(orgId: string, currentCount: number, resetAt: Date | null | undefined): Promise<number> {
  const now = new Date();
  const inSameMonth =
    !!resetAt &&
    resetAt.getUTCFullYear() === now.getUTCFullYear() &&
    resetAt.getUTCMonth() === now.getUTCMonth();
  const newCount = inSameMonth ? (currentCount ?? 0) + 1 : 1;
  await db
    .update(organizations)
    .set({
      verificationCountThisMonth: newCount,
      verificationCountResetAt: now,
      updatedAt: now,
    })
    .where(eq(organizations.id, orgId));
  return newCount;
}

// Find or lazy-create the metered subscription item on the org's Stripe
// subscription. Returns null if the org doesn't have a Stripe subscription
// (e.g., IAP-paid orgs use originalTransactionId, not subscriptionId — Apple
// doesn't expose a metered-billing equivalent, so IAP orgs eat the
// verification cost as part of the tier price; document and accept).
async function ensureMeteredSubscriptionItem(
  stripe: any,
  orgRow: any,
  tier: string,
): Promise<string | null> {
  const subId = orgRow.stripeSubscriptionId;
  if (!subId || subId.startsWith("iap:")) return null;

  const meteredPriceId = ORG_VERIFICATION_PRICE_IDS[tier];
  if (!meteredPriceId) return null;

  const sub: any = await stripe.subscriptions.retrieve(subId);
  const existing = sub.items?.data?.find((it: any) => it.price?.id === meteredPriceId);
  if (existing) return existing.id;

  const created = await stripe.subscriptionItems.create({
    subscription: subId,
    price: meteredPriceId,
  });
  log(`Bootstrapped verification metered item for org=${orgRow.id} sub=${subId} item=${created.id}`);
  return created.id;
}

// Charge the org for one verification: increment counter, post a Stripe
// usage record if the org is past its included quota. Idempotency: this
// is called once per webhook firing — Veriff/Didit only fires the
// approved webhook once per session, and we attribute by sessionId on
// the user-verification side. Double-firing would over-bill, but is
// extremely rare in practice.
export async function chargeOrgForVerification(orgId: string, userId: string): Promise<void> {
  try {
    const org = await storage.getOrganization(orgId);
    if (!org) {
      log(`chargeOrgForVerification: org=${orgId} not found, skipping`);
      return;
    }
    if (!org.requireMemberVerification) {
      // Toggle was flipped OFF between session start and webhook. Don't
      // bill — the org doesn't want the feature anymore. The user is
      // still verified; that's fine.
      log(`chargeOrgForVerification: org=${orgId} toggled OFF mid-flight, skipping bill for user=${userId}`);
      return;
    }

    const tier = org.tier ?? "free";
    const limits = getTierLimits(tier);
    const newCount = await incrementWithReset(
      orgId,
      org.verificationCountThisMonth ?? 0,
      org.verificationCountResetAt ?? null,
    );

    // Within the included monthly quota — no Stripe usage record needed.
    if (newCount <= limits.verificationsIncluded) {
      log(`Org verification credited (within quota): org=${orgId} count=${newCount}/${limits.verificationsIncluded}`);
      return;
    }

    // Over quota: post a metered usage record to Stripe.
    const overageRate = limits.verificationOverageRateCents;
    if (!overageRate) {
      // Shouldn't happen — only Free has null overage rate, and Free
      // can't have requireMemberVerification=true (gated by
      // isFeatureEnabled at toggle time). Log and bail.
      log(`chargeOrgForVerification: tier=${tier} has null overage rate; skipping bill`);
      return;
    }

    const { getUncachableStripeClient } = await import("./stripeClient");
    const stripe = await getUncachableStripeClient();

    const itemId = await ensureMeteredSubscriptionItem(stripe, org, tier);
    if (!itemId) {
      log(`chargeOrgForVerification: org=${orgId} has no Stripe subscription (IAP or missing); cost absorbed`);
      return;
    }

    await stripe.subscriptionItems.createUsageRecord(itemId, {
      quantity: 1,
      timestamp: Math.floor(Date.now() / 1000),
      action: "increment",
    });
    log(
      `Org verification billed: org=${orgId} user=${userId} count=${newCount} ` +
        `(included=${limits.verificationsIncluded}) rate=${overageRate}c`,
    );
  } catch (err: any) {
    // Never throw out of here — the caller is a webhook that needs to
    // 200 to avoid retry storms. Log and move on.
    log(`chargeOrgForVerification error org=${orgId}: ${err?.message ?? err}`);
  }
}

// Pre-flight cap check for the org-paid session-create endpoint. Returns
// true if the org has budget left for one more verification at the
// current tier's overage rate. Returns false (and the caller should
// reject with ORG_VERIFICATION_BUDGET_EXHAUSTED) if the next verification
// would push spend past the cap.
//
// Within the included quota, always allowed (no overage = no spend).
// If budgetMonthlyCents is null, also always allowed (unlimited).
export function hasVerificationBudgetRoom(
  org: { tier: string | null; verificationCountThisMonth: number | null; verificationBudgetMonthlyCents: number | null },
): boolean {
  if (org.verificationBudgetMonthlyCents == null) return true;
  const limits = getTierLimits(org.tier);
  const currentCount = org.verificationCountThisMonth ?? 0;
  // The hypothetical NEXT verification would be currentCount + 1.
  const nextCount = currentCount + 1;
  if (nextCount <= limits.verificationsIncluded) return true;
  const overageRate = limits.verificationOverageRateCents ?? 0;
  if (overageRate === 0) return true;
  const overageUnits = nextCount - limits.verificationsIncluded;
  const projectedSpendCents = overageUnits * overageRate;
  return projectedSpendCents <= org.verificationBudgetMonthlyCents;
}
