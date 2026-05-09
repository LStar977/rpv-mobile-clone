import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage-db";
import { db } from "./db";
import { users, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  ORG_VERIFICATION_UNLOCK_PRICE_IDS,
  markOrgUnlocked,
  markOrgUnlockRefunded,
  findOrgByUnlockPaymentId,
} from "./verificationUnlock";
import { getVerificationUnlockFeeCents } from "@shared/tier-limits";

function log(message: string) {
  console.log(`[Webhook] ${message}`);
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string, uuid: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('Payload must be a Buffer. Webhook route must be registered BEFORE express.json()');
    }

    const sync = await getStripeSync();
    const event = await sync.processWebhook(payload, signature, uuid);

    if (!event) return;

    log(`Processing event: ${event.type}`);

    // Handle checkout session completed (subscription or one-time payment)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const paymentType = session.metadata?.type;
      const userId = session.metadata?.userId || session.client_reference_id;

      // Handle premium subscription
      if (session.mode === 'subscription' && session.subscription) {
        const stripe = await getUncachableStripeClient();
        const subscription = await stripe.subscriptions.retrieve(session.subscription) as any;
        const subUserId = subscription.metadata?.userId || userId;

        if (subUserId) {
          log(`Activating premium subscription for user ${subUserId}`);
          await db.update(users).set({
            stripeCustomerId: session.customer,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: 'active',
            subscriptionEndDate: new Date(subscription.current_period_end * 1000),
          }).where(eq(users.id, subUserId));
        }
      }

      // Handle org verification unlock fee (UPDATE 26): one-time payment
      // that unlocks identity verification for an organization.
      if (session.mode === 'payment' && paymentType === 'verification_unlock') {
        const orgId = session.metadata?.orgId as string | undefined;
        const tier = session.metadata?.tier as string | undefined;
        if (!orgId || !tier) {
          log(`ERROR: verification_unlock checkout missing orgId/tier in metadata (session=${session.id})`);
          return;
        }

        const stripe = await getUncachableStripeClient();
        const expectedPriceId = ORG_VERIFICATION_UNLOCK_PRICE_IDS[tier];
        const expectedAmount = getVerificationUnlockFeeCents(tier);
        if (!expectedPriceId || expectedAmount == null) {
          log(`ERROR: verification_unlock for tier=${tier} not configured (priceId or fee missing)`);
          return;
        }

        const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ['line_items.data.price'],
        }) as any;
        const lineItems = fullSession.line_items?.data || [];
        const actualPriceId = lineItems[0]?.price?.id;
        const actualAmount = fullSession.amount_total;
        const currency = fullSession.currency;

        if (actualPriceId !== expectedPriceId) {
          log(`ERROR: verification_unlock price ID mismatch for org=${orgId}. Expected ${expectedPriceId}, got ${actualPriceId}.`);
          return;
        }
        if (actualAmount !== expectedAmount) {
          log(`ERROR: verification_unlock amount mismatch for org=${orgId}. Expected ${expectedAmount}, got ${actualAmount}.`);
          return;
        }
        if (currency !== 'usd') {
          log(`ERROR: verification_unlock currency mismatch for org=${orgId}. Expected usd, got ${currency}.`);
          return;
        }

        const paymentId = (fullSession.payment_intent as string | null) ?? session.id;
        await markOrgUnlocked(orgId, tier, paymentId, 'stripe');
        return;
      }

      // Handle one-time verification payment
      if (session.mode === 'payment' && paymentType === 'verification') {
        if (userId) {
          const stripe = await getUncachableStripeClient();
          const expectedPriceId = process.env.STRIPE_VERIFICATION_PRICE_ID;
          const expectedAmount = 499; // $4.99 in cents

          // Require expectedPriceId to be configured
          if (!expectedPriceId) {
            log(`ERROR: STRIPE_VERIFICATION_PRICE_ID not configured. Cannot validate verification payment for user ${userId}.`);
            return;
          }

          // Retrieve the session with expanded line items to verify price ID
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items.data.price'],
          }) as any;

          const lineItems = fullSession.line_items?.data || [];
          const actualPriceId = lineItems[0]?.price?.id;
          const actualAmount = fullSession.amount_total;
          const currency = fullSession.currency;

          // Verify price ID matches expected
          if (expectedPriceId && actualPriceId !== expectedPriceId) {
            log(`ERROR: Verification payment price ID mismatch for user ${userId}. Expected ${expectedPriceId}, got ${actualPriceId}. Not marking as paid.`);
            return;
          }

          // Verify amount
          if (actualAmount !== expectedAmount) {
            log(`ERROR: Verification payment amount mismatch for user ${userId}. Expected ${expectedAmount}, got ${actualAmount}. Not marking as paid.`);
            return;
          }

          // Verify currency
          if (currency !== 'usd') {
            log(`ERROR: Verification payment currency mismatch for user ${userId}. Expected usd, got ${currency}. Not marking as paid.`);
            return;
          }

          // Check idempotency - don't re-set if already paid
          const existingUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          if (existingUser.length > 0 && (existingUser[0] as any).verificationPaid) {
            log(`Verification already paid for user ${userId}, skipping duplicate webhook`);
            return;
          }

          log(`Processing verification payment for user ${userId} (priceId: ${actualPriceId}, amount: ${actualAmount})`);
          await db.update(users).set({
            stripeCustomerId: session.customer,
            verificationPaid: true,
          }).where(eq(users.id, userId));
          log(`Verification payment recorded for user ${userId}`);
        }
      }
    }

    // Handle subscription updates
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as any;
      const userId = subscription.metadata?.userId;
      const orgId = subscription.metadata?.organizationId;
      const subType = subscription.metadata?.type;

      if (subType === 'organization' && orgId) {
        log(`Updating organization subscription ${orgId}: ${subscription.status}`);
        await db.update(organizations).set({
          subscriptionStatus: subscription.status === 'active' ? 'active' : subscription.status,
        }).where(eq(organizations.id, orgId));
      } else if (userId) {
        log(`Updating subscription for user ${userId}: ${subscription.status}`);
        await db.update(users).set({
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionEndDate: new Date(subscription.current_period_end * 1000),
        }).where(eq(users.id, userId));
      }
    }

    // Handle subscription deletion/cancellation
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any;
      const userId = subscription.metadata?.userId;
      const orgId = subscription.metadata?.organizationId;
      const subType = subscription.metadata?.type;

      if (subType === 'organization' && orgId) {
        log(`Organization subscription canceled: ${orgId}`);
        await db.update(organizations).set({
          subscriptionStatus: 'canceled',
        }).where(eq(organizations.id, orgId));
      } else if (userId) {
        log(`Subscription canceled for user ${userId}`);
        await db.update(users).set({
          subscriptionStatus: 'canceled',
        }).where(eq(users.id, userId));
      }
    }

    // Handle failed payments
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        const stripe = await getUncachableStripeClient();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.userId;
        const orgId = subscription.metadata?.organizationId;
        const subType = subscription.metadata?.type;

        if (subType === 'organization' && orgId) {
          log(`Organization payment failed: ${orgId}`);
          await db.update(organizations).set({
            subscriptionStatus: 'past_due',
          }).where(eq(organizations.id, orgId));
        } else if (userId) {
          log(`Payment failed for user ${userId}`);
          await db.update(users).set({
            subscriptionStatus: 'past_due',
          }).where(eq(users.id, userId));
        }
      }
    }

    // Handle refund / dispute on a verification unlock payment (UPDATE 26).
    // Stripe fires charge.refunded when a Refund object is created against
    // a charge, and charge.dispute.created when a customer files a dispute.
    // For either, look up whether the underlying payment_intent corresponds
    // to an org's stored verificationUnlockPaymentId and clear the unlock.
    if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      const charge = event.data.object as any;
      const paymentIntentId: string | null =
        (typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id) ?? null;
      if (paymentIntentId) {
        const org = await findOrgByUnlockPaymentId(paymentIntentId);
        if (org) {
          log(`Verification unlock refund/dispute for org=${org.id} payment=${paymentIntentId}; clearing unlock`);
          await markOrgUnlockRefunded(org.id);
        }
      }
    }

    // Handle invoice.paid for organization subscription activation
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as any;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        const stripe = await getUncachableStripeClient();
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const orgId = subscription.metadata?.organizationId;
        const subType = subscription.metadata?.type;

        if (subType === 'organization' && orgId) {
          // Stage 3 (UPDATE 23) introduced new tier names + prices. The
          // legacy names (starter/professional/premium/enterprise) stay
          // in the validation map so renewals on grandfathered subs
          // continue to succeed without manual migration.
          const ORG_PRICE_IDS: Record<string, string> = {
            pro: process.env.STRIPE_PRICE_ORG_PRO || '',
            plus: process.env.STRIPE_PRICE_ORG_PLUS || '',
            business: process.env.STRIPE_PRICE_ORG_BUSINESS || '',
            // Grandfathered (Stage 1 / pre-Stage-3) — keep so old subs validate.
            starter: process.env.STRIPE_PRICE_ORG_STARTER
              || process.env.STRIPE_PRICE_ORG_COMMUNITY
              || 'price_1SwhrED2jsTroGJyAvU4bZ4r',
            professional: process.env.STRIPE_PRICE_ORG_PROFESSIONAL || 'price_1SwhsSD2jsTroGJyps2LHaah',
            premium: process.env.STRIPE_PRICE_ORG_PREMIUM || '',
            enterprise: process.env.STRIPE_PRICE_ORG_ENTERPRISE || 'price_1SwhtFD2jsTroGJylQOkB8tu',
          };
          const ORG_EXPECTED_AMOUNTS: Record<string, number> = {
            pro: 5900, plus: 17900, business: 49900,
            starter: 2900, professional: 9900, premium: 29900, enterprise: 9900,
          };

          const priceId = subscription.items.data[0]?.price?.id;
          const amount = subscription.items.data[0]?.price?.unit_amount;
          const expectedPriceIds = Object.values(ORG_PRICE_IDS);

          if (!expectedPriceIds.includes(priceId || '')) {
            log(`ERROR: Invalid org price ID for subscription ${subscriptionId}: ${priceId}`);
            return;
          }

          const tier = Object.keys(ORG_PRICE_IDS).find(t => ORG_PRICE_IDS[t] === priceId);
          if (tier && amount !== ORG_EXPECTED_AMOUNTS[tier]) {
            log(`ERROR: Org amount mismatch for ${subscriptionId}: expected ${ORG_EXPECTED_AMOUNTS[tier]}, got ${amount}`);
            return;
          }

          if (subscription.status === 'active') {
            log(`Organization ${orgId} subscription activated via verified webhook`);
            await db.update(organizations).set({
              subscriptionStatus: 'active',
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string,
            }).where(eq(organizations.id, orgId));
          }
        }
      }
    }
  }
}
