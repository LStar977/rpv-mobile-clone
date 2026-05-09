// Org-paid verification billing (UPDATE 24 + UPDATE 25).
//
// When a verified member of a verify-required org casts their FIRST vote
// in that org, the organization is billed via Stripe metered usage above
// its included monthly quota. Members never see a payment prompt — the
// org's saved card is charged at month-end.
//
// Attribution model (UPDATE 25): lifetime per org-member edge. Each row
// in organization_members carries verificationBilledAt; on first qualifying
// vote we stamp it and post a usage record. Subsequent votes by the same
// member in the same org never re-bill. Leave + rejoin = new edge = new
// bill (the row is recreated).
//
// Why first-vote, not first-verification (UPDATE 25 supersedes UPDATE 24):
// self-pay verification is free for users (legacy $4.99 paywall is dead
// code). Without this, any user could verify free first then join a
// verify-required org without the org paying. Vote-time attribution closes
// that arbitrage and aligns the charge with when the verification actually
// delivers value to the org.
//
// `vendor_data: "userId|orgId"` is still packed during session creation
// for log correlation, but no longer drives billing. The `chargeOrgForVerification`
// helper is deprecated; webhooks no longer call it.
//
// This module is intentionally side-effect-tolerant on the deprecated
// path. The new vote-time helper (`billOrgForFirstVote`) does throw on
// failure since the caller (vote-submit) needs to know whether to block
// the vote (budget exhausted) vs continue (billed/within-quota).

import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { organizationMembers, organizations } from "@shared/schema";
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

// @deprecated Use billOrgForFirstVote instead. This is the UPDATE 24 path
// that fires from Veriff/Didit webhooks — kept exported during the rollout
// in case any caller still references it, but no longer invoked from
// production code paths. Remove on the next cycle once all references
// are gone. UPDATE 25 moves attribution to vote-time.
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

// UPDATE 25: vote-time billing. Called from /api/voting/submit when a
// verified member votes in a verify-required org. Lifetime per-edge:
// stamps organization_members.verificationBilledAt on first qualifying
// vote, posts a Stripe metered usage record if past the included quota,
// and never re-bills the same edge.
//
// Return shape lets the caller distinguish:
//   already-billed   — silent, just continue
//   within-quota     — counter bumped, no Stripe charge, continue
//   billed           — Stripe usage record posted, continue
//   budget-exhausted — refuse the vote, let the caller emit the 403
//   no-stripe-sub    — IAP-paid org or missing sub, cost absorbed, continue
//
// budget-exhausted is the ONLY result that should block the vote. The
// rest are continue-and-log paths.
export type BillFirstVoteResult = {
  billed: boolean;
  reason: 'billed' | 'already-billed' | 'within-quota' | 'budget-exhausted' | 'no-stripe-sub';
  cents?: number;
};

export async function billOrgForFirstVote(orgId: string, userId: string): Promise<BillFirstVoteResult> {
  // Edge lookup. The caller has already verified isOrganizationMember(),
  // so a missing row would be a race (member removed between membership
  // check and billing call). Treat as already-billed to avoid blocking.
  const omRows = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), eq(organizationMembers.userId, userId)))
    .limit(1);
  const om = omRows[0];
  if (!om) return { billed: false, reason: 'already-billed' };
  if (om.verificationBilledAt) return { billed: false, reason: 'already-billed' };

  const org = await storage.getOrganization(orgId);
  if (!org || !org.requireMemberVerification) {
    // Toggle flipped OFF between membership check and now — stamp anyway
    // so we don't re-check this edge on every subsequent vote, but skip
    // the bill (the org doesn't want the feature anymore).
    await db.update(organizationMembers)
      .set({ verificationBilledAt: new Date() })
      .where(eq(organizationMembers.id, om.id));
    return { billed: false, reason: 'already-billed' };
  }

  // Budget gate. Authoritative — if exhausted, block the vote here.
  if (!hasVerificationBudgetRoom(org)) {
    return { billed: false, reason: 'budget-exhausted' };
  }

  const tier = org.tier ?? 'free';
  const limits = getTierLimits(tier);
  const newCount = await incrementWithReset(
    orgId,
    org.verificationCountThisMonth ?? 0,
    org.verificationCountResetAt ?? null,
  );

  // Stamp the OM row regardless of whether we Stripe-charge below.
  // Within-quota billings still consume a "verified-member slot" and
  // shouldn't double-bill on the next vote.
  await db.update(organizationMembers)
    .set({ verificationBilledAt: new Date() })
    .where(eq(organizationMembers.id, om.id));

  if (newCount <= limits.verificationsIncluded) {
    log(`Org first-vote billed (within quota): org=${orgId} user=${userId} count=${newCount}/${limits.verificationsIncluded}`);
    return { billed: false, reason: 'within-quota' };
  }

  const overageRate = limits.verificationOverageRateCents;
  if (!overageRate) {
    log(`billOrgForFirstVote: tier=${tier} has null overage rate; counter bumped, no Stripe charge`);
    return { billed: false, reason: 'within-quota' };
  }

  try {
    const { getUncachableStripeClient } = await import("./stripeClient");
    const stripe = await getUncachableStripeClient();
    const itemId = await ensureMeteredSubscriptionItem(stripe, org, tier);
    if (!itemId) {
      log(`billOrgForFirstVote: org=${orgId} has no Stripe subscription (IAP or missing); cost absorbed`);
      return { billed: false, reason: 'no-stripe-sub' };
    }
    await stripe.subscriptionItems.createUsageRecord(itemId, {
      quantity: 1,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    });
    log(
      `Org first-vote billed: org=${orgId} user=${userId} count=${newCount} ` +
      `(included=${limits.verificationsIncluded}) rate=${overageRate}c`,
    );
    return { billed: true, reason: 'billed', cents: overageRate };
  } catch (err: any) {
    // Stripe call failed — counter is already bumped + edge is stamped,
    // so we don't double-bill. Eat the cost rather than block the vote.
    log(`billOrgForFirstVote Stripe error org=${orgId}: ${err?.message ?? err}`);
    return { billed: false, reason: 'no-stripe-sub' };
  }
}
