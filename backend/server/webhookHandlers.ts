import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage-db";
import { db } from "./db";
import { users, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";

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
          const ORG_PRICE_IDS: Record<string, string> = {
            community: process.env.STRIPE_PRICE_ORG_COMMUNITY || 'price_1SwhrED2jsTroGJyAvU4bZ4r',
            professional: process.env.STRIPE_PRICE_ORG_PROFESSIONAL || 'price_1SwhsSD2jsTroGJyps2LHaah',
            enterprise: process.env.STRIPE_PRICE_ORG_ENTERPRISE || 'price_1SwhtFD2jsTroGJylQOkB8tu',
          };
          const ORG_EXPECTED_AMOUNTS: Record<string, number> = {
            community: 2900, professional: 4900, enterprise: 9900,
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
