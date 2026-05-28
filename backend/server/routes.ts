import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-db";
import { baseNetwork } from "./base-network";
import { log } from "./app";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupBadgeRoutes } from "./badge-routes";
import { passportNFTs, activatedRidings, electoralRidingQRCodes, proposals, votes, voteTokenClaims, organizations, transactions, proposalReports, userMutes } from "@shared/schema";
import { getMemberLimit, getTierLimits, isFeatureEnabled, tierDisplayName, type OrgTier } from "@shared/tier-limits";
import {
  ORG_VERIFICATION_UNLOCK_PRICE_IDS,
  ORG_VERIFICATION_UNLOCK_IAP_PRODUCT_IDS,
  getUnlockPriceCents,
  isOrgUnlocked,
  markOrgUnlocked,
  packVendorData,
  parseVendorData,
} from "./verificationUnlock";
import { checkContent } from "./profanityFilter";
import { eq, count, and, sql } from "drizzle-orm";
import { db } from "./db";
import { savePushToken, notifyNewProposal, notifyTokenClaimed, notifyProposalVote } from "./notifications";
import { sendEmail, buildOrgInviteEmail } from "./email";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import jwt from "jsonwebtoken";
import { randomUUID, createHmac, timingSafeEqual } from "crypto";

// Redact PII before logging. Returns first 8 chars + ellipsis so logs stay
// useful for tracing a single request through the system without spilling
// full identifiers to disk / Sentry / log aggregators.
function rid(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 8) return value;
  return value.slice(0, 8) + "…";
}

// Tiny in-memory IP rate limiter — windowMs / max bucket per ip+key.
// Single-instance only; resets on restart, which is fine for our threat model.
function makeIpRateLimiter(windowMs: number, max: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: any, res: any, next: any) => {
    const ip = (req.ip || req.socket?.remoteAddress || "unknown") as string;
    const now = Date.now();
    const b = buckets.get(ip);
    if (!b || b.resetAt < now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (b.count >= max) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
    b.count += 1;
    next();
  };
}

// Verifies the x-hmac-signature header that Veriff attaches to every webhook
// payload (HMAC-SHA256 of the raw body, keyed with VERIFF_MASTER_SIGNATURE_KEY).
// Without this check, an attacker who knows the webhook URL could mark any
// arbitrary userId as verified by POSTing crafted JSON.
function verifyVeriffSignature(req: any): boolean {
  const secret = process.env.VERIFF_MASTER_SIGNATURE_KEY;
  if (!secret) {
    log("VERIFF_MASTER_SIGNATURE_KEY not configured — refusing webhook");
    return false;
  }
  const sig = (req.headers["x-hmac-signature"] || req.headers["x-signature"]) as string | undefined;
  if (!sig || typeof sig !== "string") return false;

  const rawBody: Buffer | undefined = req.rawBody as Buffer | undefined;
  if (!rawBody) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  // timingSafeEqual requires equal-length buffers; bail if Veriff sent a sig of
  // unexpected length.
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

// Didit webhook signature: HMAC-SHA256 of the raw body keyed with
// DIDIT_WEBHOOK_SECRET, sent in the X-Signature header. X-Timestamp gives a
// freshness window — reject anything older than 5 minutes to block replays.
function verifyDiditSignature(req: any): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) {
    log("DIDIT_WEBHOOK_SECRET not configured — refusing webhook");
    return false;
  }
  const sig = req.headers["x-signature"] as string | undefined;
  const ts = req.headers["x-timestamp"] as string | undefined;
  if (!sig || !ts) return false;

  // 5-minute freshness window. Didit sends the timestamp in seconds.
  const tsNum = parseInt(ts, 10);
  if (Number.isNaN(tsNum)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) return false;

  const rawBody: Buffer | undefined = req.rawBody as Buffer | undefined;
  if (!rawBody) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}

// Create a Didit verification session via their REST API. Returns the hosted
// verification URL the mobile WebView loads, plus the session_id we persist
// on the user record for later decision lookups.
async function createDiditSession(
  userId: string,
  firstName?: string,
  lastName?: string,
  originatingOrgId?: string | null,
  flow: 'standard' | 'citizen' = 'standard',
): Promise<{ sessionId: string; sessionUrl: string }> {
  const apiKey = process.env.DIDIT_API_KEY;
  // 'citizen' uses a separate Didit workflow (passport + proof of address)
  // that proves citizenship. Falls back to the standard workflow if the
  // citizen workflow env var isn't set.
  const workflowId = flow === 'citizen'
    ? (process.env.DIDIT_WORKFLOW_ID_CITIZEN || process.env.DIDIT_WORKFLOW_ID)
    : process.env.DIDIT_WORKFLOW_ID;
  if (!apiKey || !workflowId) {
    throw new Error("Didit not configured (set DIDIT_API_KEY + DIDIT_WORKFLOW_ID)");
  }
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT_URL || "localhost:5000";
  // Per-session `callback` is where Didit redirects the user's browser
  // AFTER they finish verification — NOT the server-to-server webhook
  // (that's configured separately in the Didit dashboard and stays at
  // /api/didit/webhook). We give it a dedicated user-facing page so the
  // WebView in the mobile app can intercept it and close cleanly, with
  // a friendly fallback HTML if interception ever misses.
  const callbackUrl = `https://${domain}/verification-complete`;
  const body: any = {
    workflow_id: workflowId,
    callback: callbackUrl,
    vendor_data: packVendorData(userId, originatingOrgId ?? null),
  };
  if (firstName && lastName) {
    body.expected_details = { first_name: firstName.trim(), last_name: lastName.trim() };
  }
  const res = await fetch("https://verification.didit.me/v3/session/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Didit session creation failed: ${res.status} ${errText}`);
  }
  const data: any = await res.json();
  // Response: { session_id, session_token, url, status, workflow_id, ... }
  return { sessionId: data.session_id, sessionUrl: data.url };
}

// Fetch the latest verification decision for a Didit session.
async function fetchDiditDecision(sessionId: string): Promise<any> {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) throw new Error("Didit not configured");
  const res = await fetch(`https://verification.didit.me/v3/session/${sessionId}/decision/`, {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Didit decision fetch failed: ${res.status} ${errText}`);
  }
  return res.json();
}

// Map Didit's decision payload to the user fields we persist. Didit's exact
// shape needs to be confirmed against a real test session — this mapper makes
// best-effort guesses that fall back to undefined so a missing field never
// throws. Sandbox-test once with a real verification and adjust the field
// paths as needed.
function mapDiditDecisionToUserFields(decision: any): {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  documentType?: string;
  country?: string;
  state?: string;
  city?: string;
} {
  const id = decision?.id_verification ?? decision?.kyc ?? decision ?? {};
  const address = id.address ?? {};
  const isPassport = String(id.document_type ?? id.documentType ?? "").toUpperCase().includes("PASSPORT");
  return {
    firstName: id.first_name ?? id.firstName,
    lastName: id.last_name ?? id.lastName,
    dateOfBirth: id.date_of_birth ?? id.dateOfBirth,
    gender: normalizeGender(id.gender),
    documentType: id.document_type ?? id.documentType,
    // Passport: nationality from doc; ID card / driver's license: address country
    country: isPassport
      ? (id.document_country ?? id.documentCountry ?? address.country)
      : (address.country ?? id.document_country ?? id.documentCountry),
    state: address.state ?? address.region,
    city: address.city,
  };
}

function normalizeGender(g: any): string | undefined {
  if (!g || typeof g !== "string") return undefined;
  const u = g.trim().toUpperCase();
  if (u === "M" || u === "MALE") return "male";
  if (u === "F" || u === "FEMALE") return "female";
  return g.toLowerCase();
}

// One-time bulk RPV transfer per user, fired when verification is approved.
// Idempotent — safe to call from every verification-approved branch; only the
// first call actually transfers tokens. Failures are swallowed so a transient
// blockchain hiccup never blocks the verification itself.
const INITIAL_BALLOT_GRANT = 1000;

async function grantInitialBallotsIfNeeded(userId: string): Promise<void> {
  try {
    const user = await storage.getUser(userId);
    if (!user || (user as any).initialBallotsGranted) return;

    const wallet = await storage.getUserWallet(userId);
    if (!wallet) {
      log(`grantInitialBallots: user ${userId} has no wallet yet, skipping`);
      return;
    }

    const rpvTokenAddress = process.env.RPV_TOKEN_ADDRESS;
    if (!rpvTokenAddress) {
      log(`grantInitialBallots: RPV_TOKEN_ADDRESS not configured`);
      return;
    }

    const result = await baseNetwork.transferRPVToken(rpvTokenAddress, wallet.address, INITIAL_BALLOT_GRANT);
    if (result.success) {
      await (storage as any).markInitialBallotsGranted(userId);
      log(`✅ Granted ${INITIAL_BALLOT_GRANT} RPV to user ${userId} (tx=${result.txHash})`);
    } else {
      log(`grantInitialBallots: transfer failed for user ${userId}: ${result.error}`);
    }
  } catch (e) {
    log(`grantInitialBallots error for user ${userId}: ${e}`);
  }
}

const DAILY_BALLOT_CAP = 20;

// Tier enforcement helper. Returns null if the org has room for one more
// member; returns a 402-shaped error payload (with structured upgrade hint)
// if at cap. The `additional` param lets the CSV importer pre-flight a batch.
async function checkMemberCap(
  orgId: string,
  additional: number = 1,
): Promise<{ ok: true } | { ok: false; status: number; body: any }> {
  const org = await storage.getOrganization(orgId);
  if (!org) return { ok: false, status: 404, body: { error: "Organization not found" } };

  const limit = getMemberLimit(org.tier);
  if (!Number.isFinite(limit)) return { ok: true };

  const current = await storage.getOrganizationMemberCount(orgId);
  if (current + additional > limit) {
    return {
      ok: false,
      status: 402, // Payment Required — signals upgrade path
      body: {
        error: "Member limit reached",
        message: `${tierDisplayName(org.tier)} plan allows up to ${limit} members. This org has ${current}; adding ${additional} would exceed the cap.`,
        code: "MEMBER_LIMIT_EXCEEDED",
        currentMembers: current,
        limit,
        tier: org.tier ?? 'starter',
        upgradeRequired: true,
      },
    };
  }
  return { ok: true };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // User-facing page Didit redirects to after the verification session
  // completes. The mobile WebView intercepts this URL and bounces the
  // user back into the app — this HTML is only shown if interception
  // misses (web SPA users, slow networks, or stale clients).
  // The actual server-to-server webhook is /api/didit/webhook (below).
  app.get("/verification-complete", (_req: any, res: any) => {
    res
      .status(200)
      .type("html")
      .send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verification complete</title>
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; padding: 0; height: 100%; background: #0b0b0c; color: #f5efe1; font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; }
    .wrap { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
    .badge { width: 72px; height: 72px; border-radius: 36px; background: rgba(234,186,88,0.15); display: flex; align-items: center; justify-content: center; margin-bottom: 24px; border: 1px solid rgba(234,186,88,0.4); }
    .check { color: #eaba58; font-size: 36px; font-weight: 700; }
    h1 { font-family: Georgia, serif; font-weight: 500; font-size: 28px; margin: 0 0 12px; color: #f5efe1; }
    p { font-size: 15px; line-height: 1.55; max-width: 320px; color: rgba(245,239,225,0.7); margin: 0 0 32px; }
    .btn { display: inline-flex; align-items: center; gap: 8px; background: #eaba58; color: #0b0b0c; font-weight: 600; padding: 14px 22px; border-radius: 12px; text-decoration: none; font-size: 15px; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="badge"><span class="check">&#10003;</span></div>
    <h1>Verification complete</h1>
    <p>You can return to the Represent app. If it didn't reopen automatically, switch back to it now.</p>
    <a class="btn" href="represent://verification-complete">Return to Represent</a>
  </main>
</body>
</html>`);
  });

  // Setup OAuth authentication (Google, Apple, GitHub)
  await setupAuth(app);

  // Setup badge system routes
  setupBadgeRoutes(app);

  // Setup object storage routes for image uploads
  registerObjectStorageRoutes(app);

  // Stripe webhook — must be reachable at https://representportal.com/api/stripe/webhook
  // with events: invoice.paid, invoice.payment_failed, customer.subscription.updated,
  // customer.subscription.deleted, checkout.session.completed.
  // Raw body capture is set up in app.ts via express.json({ verify }) so req.rawBody
  // is a Buffer of the original payload — required by stripe-replit-sync's
  // processWebhook for HMAC verification.
  app.post("/api/stripe/webhook", async (req: any, res: any) => {
    try {
      const signature = req.headers['stripe-signature'] as string | undefined;
      if (!signature) {
        log(`Stripe webhook rejected: missing stripe-signature header`);
        return res.status(400).send('Missing stripe-signature header');
      }
      if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
        log(`Stripe webhook rejected: rawBody missing or not a Buffer (middleware misconfigured)`);
        return res.status(400).send('Missing raw body');
      }

      const { WebhookHandlers } = await import('./webhookHandlers');
      // The third arg is a de-duplication key for stripe-replit-sync. The
      // signature is unique per delivery and known-good after verification,
      // so it works as the dedup key without leaking anything sensitive.
      await WebhookHandlers.processWebhook(req.rawBody, signature, signature);
      res.json({ received: true });
    } catch (error: any) {
      log(`Stripe webhook error: ${error?.message || error}`);
      res.status(400).send(`Webhook Error: ${error?.message ?? 'unknown'}`);
    }
  });

  // App Store Server Notifications V2 — IAP analogue of the Stripe webhook
  // above. Configure App Store Connect to point at
  // https://representportal.com/api/iap/notifications (Production +
  // Sandbox URLs, Version V2). Authentication is via JWS signature on the
  // signedPayload — no shared secret header.
  //
  // We always return 200 (even on internal failure) because Apple retries
  // up to 5 times over 5 days on any non-2xx response; a buggy handler
  // would flood the system. Errors are logged for investigation.
  app.post("/api/iap/notifications", async (req: any, res: any) => {
    try {
      const { signedPayload } = req.body || {};
      if (!signedPayload || typeof signedPayload !== 'string') {
        log(`IAP notification rejected: missing or invalid signedPayload`);
        return res.status(400).send('Missing signedPayload');
      }

      const { IAPWebhookHandlers } = await import('./iapWebhookHandlers');
      await IAPWebhookHandlers.processNotification(signedPayload);
      res.status(200).send('OK');
    } catch (error: any) {
      log(`IAP notification error: ${error?.message ?? error}`);
      // 200 instead of 5xx — see comment above.
      res.status(200).send('Logged');
    }
  });

  // Push notification token registration
  app.post("/api/push-token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { token, platform } = req.body;

      if (!userId || !token) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      await savePushToken(userId, token, platform || 'unknown');
      log(`Push token saved: user=${userId}, platform=${platform}`);

      res.json({ success: true });
    } catch (error) {
      log(`Push token save error: ${error}`);
      res.status(500).json({ error: "Failed to save push token" });
    }
  });

  // Debug endpoint to check current user
  app.get("/api/debug/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      const passport = await storage.getPassportNFT(userId);
      console.log(`📱 Debug user: userId=${userId}, hasPassport=${!!passport}, passport=${JSON.stringify(passport)}`);
      res.json({ userId, user: { ...user, passport: passport || null } });
    } catch (error) {
      console.error(`❌ Debug user error: ${error}`);
      res.json({ error: String(error) });
    }
  });

  // Protected wallet route (by userId param)
  app.get("/api/wallet/:userId", isAuthenticated, async (req, res) => {
    const { userId } = req.params;

    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const wallet = await storage.getUserWallet(userId);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      const balance = await baseNetwork.getWalletBalance(wallet.address);

      res.json({
        wallet: {
          address: wallet.address,
          balance: balance,
          deployedAt: wallet.deployedAt,
        },
      });
    } catch (error) {
      log(`Wallet fetch error: ${error}`);
      res.status(500).json({ error: "Failed to fetch wallet" });
    }
  });

  // Get current user's wallet (for mobile app)
  app.get("/api/user/wallet", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(400).json({ error: "User not found" });
      }

      const user = await storage.getUser(userId);
      const wallet = await storage.getUserWallet(userId);

      if (!wallet) {
        return res.json({ address: user?.walletAddress || null, network: 'Base Sepolia' });
      }

      const rpvTokenAddress = process.env.RPV_TOKEN_ADDRESS;
      let rpvBalance = 0;
      if (rpvTokenAddress) {
        try {
          const balance = await baseNetwork.getRPVBalance(rpvTokenAddress, wallet.address);
          rpvBalance = parseFloat(balance) || 0;
        } catch (e) {
          log(`Error fetching RPV balance: ${e}`);
        }
      }

      res.json({
        address: wallet.address,
        network: 'Base Sepolia',
        chainId: 84532,
        rpvBalance,
        deployedAt: wallet.deployedAt,
      });
    } catch (error) {
      log(`User wallet fetch error: ${error}`);
      res.status(500).json({ error: "Failed to fetch wallet" });
    }
  });

  // Voting Routes - users transfer RPV token to support/oppose address or option address
  app.post("/api/voting/submit", isAuthenticated, async (req: any, res) => {
    // Read userId from session, never from request body. Body-supplied userId
    // was an IDOR vector — any authenticated user could vote as anyone else.
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { proposalId, position, selectedOption, rankings } = req.body;
    if (!proposalId || !position) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Check if user has already voted on this proposal (prevent duplicate votes)
      const votedProposals = await (storage as any).getUserVotedProposals(userId);
      if (votedProposals.includes(proposalId)) {
        return res.status(403).json({ error: "You have already voted on this proposal" });
      }

      const user = await storage.getUser(userId);
      const proposal = await storage.getProposal(proposalId);
      const wallet = await storage.getUserWallet(userId);

      // Ranked-choice voting branch. Validates the rankings against the
      // proposal's options, stores the array as JSON in `selectedOption`,
      // and skips the on-chain transfer + tally-counter increment paths
      // (those are yes/no specific). The /results endpoint computes IRV
      // at read time from the stored ballots.
      if (position === 'ranked-choice') {
        if (!proposal) return res.status(404).json({ error: "Proposal not found" });
        if (proposal.voteType !== 'ranked-choice') {
          return res.status(400).json({ error: "This proposal is not ranked-choice" });
        }
        if (!Array.isArray(rankings) || rankings.length === 0) {
          return res.status(400).json({ error: "rankings must be a non-empty array" });
        }
        if (new Set(rankings).size !== rankings.length) {
          return res.status(400).json({ error: "rankings must not contain duplicates" });
        }
        const validOptions = new Set((proposal.options ?? []) as string[]);
        if (!rankings.every((r: any) => typeof r === 'string' && validOptions.has(r))) {
          return res.status(400).json({ error: "rankings contains options not on this proposal" });
        }
        // Identity / org-membership / deadline checks are below in the
        // shared path — call into them by short-circuiting after the
        // rankings-specific validation.
        if (proposal.deadline && new Date(proposal.deadline).getTime() < Date.now()) {
          return res.status(400).json({ error: "Voting has closed for this proposal" });
        }
        if ((proposal as any).requiresCitizenship && !(user as any)?.citizenshipVerified) {
          return res.status(403).json({
            error: "This proposal is open to verified citizens only",
            code: "CITIZENSHIP_REQUIRED",
          });
        }
        if (proposal.organizationId) {
          const isMember = await storage.isOrganizationMember(proposal.organizationId, userId);
          if (!isMember) {
            return res.status(403).json({ error: "You must be a member of this organization to vote" });
          }
          const proposalOrg = await storage.getOrganization(proposal.organizationId);
          if (proposalOrg?.requireMemberVerification && !user?.verified) {
            return res.status(403).json({
              error: "This organization requires identity verification before voting",
              code: "VERIFICATION_REQUIRED_BY_ORG",
              orgId: proposal.organizationId,
              orgName: proposalOrg.name,
              requiresVerification: true,
            });
          }
          // UPDATE 26: no per-vote billing. The org pays the one-time
          // unlock fee at toggle-on; subsequent votes are free for the org.
        }
        await storage.recordVote(userId, proposalId, 'ranked-choice', undefined, null as any, JSON.stringify(rankings));
        log(`✅ RCV ballot recorded: user=${userId}, proposal=${proposalId}, rankings=${rankings.length}`);
        return res.json({ success: true });
      }

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Identity gate. Two paths:
      // - Org-scoped proposals: org membership replaces Veriff. The org admin's
      //   invite code is the gate, so schools, unions, neighborhood groups,
      //   etc. can run polls for their unverified members. These votes are
      //   recorded off-chain (DB only) — see the on-chain branch further down.
      // - Public / geo-gated proposals: Veriff verification still required.
      //   This is the credibility moat for civic-scale referenda.
      const isOrgScoped = !!proposal.organizationId;
      if (isOrgScoped) {
        const isMember = await storage.isOrganizationMember(proposal.organizationId, userId);
        if (!isMember) {
          return res.status(403).json({ error: "You must be a member of this organization to vote on this proposal" });
        }
        const proposalOrg = await storage.getOrganization(proposal.organizationId);
        if (proposalOrg?.requireMemberVerification && !user?.verified) {
          return res.status(403).json({
            error: "This organization requires identity verification before voting",
            code: "VERIFICATION_REQUIRED_BY_ORG",
            orgId: proposal.organizationId,
            orgName: proposalOrg.name,
            requiresVerification: true,
          });
        }
        // UPDATE 26: no per-vote billing. The org pays the one-time
        // unlock fee at toggle-on; subsequent votes are free for the org.
      } else if (!user?.verified) {
        return res.status(403).json({ error: "You must complete identity verification before voting." });
      }

      // Citizens-only gate. Independent of org membership and standard
      // verification — requires the Didit Citizen workflow pass.
      if ((proposal as any).requiresCitizenship && !(user as any)?.citizenshipVerified) {
        return res.status(403).json({
          error: "This proposal is open to verified citizens only",
          code: "CITIZENSHIP_REQUIRED",
        });
      }

      // On-chain voting requires a smart wallet (created at signup). For
      // off-chain org votes the wallet isn't used, but we don't need to
      // special-case its absence here — every account has one.
      if (!wallet && !isOrgScoped) {
        return res.status(400).json({ error: "User wallet not found" });
      }

      // Check if proposal deadline has passed
      if (proposal.deadline) {
        const deadline = new Date(proposal.deadline);
        if (deadline < new Date()) {
          return res.status(403).json({ error: "This proposal's voting deadline has passed" });
        }
      }

      // Parse geoRestrictions - ensure it's an array
      let geoRestrictions: string[] = [];
      if (proposal.geoRestrictions) {
        try {
          if (typeof proposal.geoRestrictions === 'string') {
            // Handle JSON string parsing
            const parsed = JSON.parse(proposal.geoRestrictions);
            geoRestrictions = Array.isArray(parsed) ? parsed : [parsed];
          } else if (Array.isArray(proposal.geoRestrictions)) {
            geoRestrictions = proposal.geoRestrictions;
          }
        } catch (e) {
          log(`Error parsing geoRestrictions: ${e}`);
        }
      }

      // Check if proposal is geo-gated
      const isGeoGated = geoRestrictions && geoRestrictions.length > 0;

      // If geo-gated, require verification
      if (isGeoGated && !user?.verified) {
        return res.status(403).json({ error: "This proposal requires identity verification to vote" });
      }

      // Check demographic restrictions
      let demographicRestrictions: any = {};
      if (proposal.demographicRestrictions) {
        try {
          if (typeof proposal.demographicRestrictions === 'string') {
            demographicRestrictions = JSON.parse(proposal.demographicRestrictions);
          } else if (typeof proposal.demographicRestrictions === 'object') {
            demographicRestrictions = proposal.demographicRestrictions;
          }
        } catch (e) {
          log(`Error parsing demographicRestrictions: ${e}`);
        }
      }

      // Check gender restriction
      if (demographicRestrictions.gender && demographicRestrictions.gender !== 'all') {
        const userGender = (user as any)?.gender ? String(user.gender).toLowerCase().trim() : '';
        const restrictedGender = String(demographicRestrictions.gender).toLowerCase().trim();
        if (userGender !== restrictedGender) {
          return res.status(403).json({ error: `This proposal is restricted to ${demographicRestrictions.gender} voters only` });
        }
      }

      // Check age restriction
      if (demographicRestrictions.ageMin || demographicRestrictions.ageMax) {
        const userDOB = (user as any)?.dateOfBirth;
        if (!userDOB) {
          return res.status(403).json({ error: "Please add your date of birth to your profile to vote on age-restricted proposals" });
        }

        const birthDate = new Date(userDOB);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        if (demographicRestrictions.ageMin && age < demographicRestrictions.ageMin) {
          return res.status(403).json({ error: `You must be at least ${demographicRestrictions.ageMin} years old to vote on this proposal` });
        }
        if (demographicRestrictions.ageMax && age > demographicRestrictions.ageMax) {
          return res.status(403).json({ error: `You must be ${demographicRestrictions.ageMax} years old or younger to vote on this proposal` });
        }
      }

      // Check geo-restrictions for geo-gated proposals
      if (isGeoGated) {
        // Use user's verified profile location from database
        const userCountry = user?.country;
        const userState = user?.state;
        const userCity = user?.city;

        log(`Vote validation START - userCountry="${userCountry}", userState="${userState}", userCity="${userCity}", geoRestrictions=${JSON.stringify(geoRestrictions)}`);

        // Build user location variations from most specific to least
        const userGeoVariations: string[] = [];
        if (userCountry) {
          userGeoVariations.push(userCountry);
        }
        if (userCountry && userState) {
          userGeoVariations.push(`${userCountry}-${userState}`);
        }
        if (userCountry && userState && userCity) {
          userGeoVariations.push(`${userCountry}-${userState}-${userCity}`);
        }

        log(`User geo variations: ${JSON.stringify(userGeoVariations)}`);

        // Check if any proposal geo-restriction matches any user location variation
        let canVote = false;
        for (const geo of geoRestrictions) {
          if (!geo) continue; // Skip empty entries
          const geoTrimmed = String(geo).trim();
          log(`Checking geo restriction: "${geoTrimmed}"`);
          for (const variation of userGeoVariations) {
            const variationTrimmed = String(variation).trim();
            // Exact match or hierarchical match (e.g., "Canada-AB-Calgary" matches "Canada" or "Canada-AB")
            const isExactMatch = variationTrimmed === geoTrimmed;
            const isHierarchicalMatch = variationTrimmed.startsWith(geoTrimmed + '-');
            const matches = isExactMatch || isHierarchicalMatch;
            log(`  Variation "${variationTrimmed}" vs Geo "${geoTrimmed}": exact=${isExactMatch}, hierarchical=${isHierarchicalMatch}, result=${matches}`);
            if (matches) {
              canVote = true;
              break;
            }
          }
          if (canVote) break;
        }

        log(`Vote validation result: canVote=${canVote}, geoRestrictions=${JSON.stringify(geoRestrictions)}, userVariations=${JSON.stringify(userGeoVariations)}`);

        if (!canVote) {
          return res.status(403).json({ error: "You don't meet the geographic restrictions for this proposal" });
        }
      }

      // Daily ballot cap enforcement: atomic UPDATE that lazy-resets at UTC
      // midnight, increments, and rejects when over cap — all in one statement.
      // The previous read-then-write pattern had a TOCTOU window where two
      // concurrent requests at cap-1 could both succeed.
      // Premium subscribers ($7.99/mo) bypass the cap entirely.
      const isPremium = user?.subscriptionStatus === 'active';
      if (!isPremium) {
        const consumed = await (storage as any).consumeBallot(userId, DAILY_BALLOT_CAP);
        if (!consumed) {
          return res.status(403).json({
            error: `Daily voting limit reached (${DAILY_BALLOT_CAP}/day). Upgrade to Premium for unlimited voting.`,
            dailyCapReached: true,
          });
        }
      }

      // Check if proposal is closed (applies to all proposals).
      const isClosed = await (storage as any).isProposalClosed(proposalId);
      if (isClosed) {
        return res.status(403).json({ error: "Voting on this proposal has ended" });
      }

      // On-chain vote (only for non-org proposals). Org-scoped proposals are
      // recorded off-chain because (1) unverified org members have no RPV
      // grant to transfer, and (2) classroom polls / internal org votes
      // don't need Base mainnet immutability — the engagement value comes
      // from the tally itself, not from a verifiable on-chain trail.
      let txHash: string | undefined = undefined;
      if (!isOrgScoped) {
        const rpvTokenAddress = process.env.RPV_TOKEN_ADDRESS;
        if (!rpvTokenAddress) {
          return res.status(500).json({ error: "RPV token not configured" });
        }

        // Check user's RPV balance and top up if they've fully drained their grant.
        // Most users will never hit this — they got 1000 tokens at verification.
        const balance = await baseNetwork.getRPVBalance(rpvTokenAddress, wallet!.address);
        const userBalance = parseFloat(balance);

        log(`User ${rid(userId)} RPV balance: ${balance}`);

        if (userBalance < 1) {
          log(`Top-up: transferring ${INITIAL_BALLOT_GRANT} RPV to user ${rid(userId)}`);
          const transferResult = await baseNetwork.transferRPVToken(rpvTokenAddress, wallet!.address, INITIAL_BALLOT_GRANT);
          if (!transferResult.success) {
            log(`Warning: top-up transfer failed for user ${rid(userId)}: ${transferResult.error}`);
            // Continue anyway — vote will fail if transfer didn't work
          }
        }

        // For multiple-choice, find the option address; for yes/no use the position directly
        let optionAddress: string | undefined;
        if (position === 'multiple-choice' && selectedOption && proposal.optionAddresses && Array.isArray(proposal.optionAddresses)) {
          const optionIndex = proposal.options?.indexOf(selectedOption) ?? -1;
          if (optionIndex >= 0 && optionIndex < proposal.optionAddresses.length) {
            optionAddress = proposal.optionAddresses[optionIndex];
          }
        }

        // User votes by transferring their token to vote address (signed with their key, relayed by server)
        const voteResult = await baseNetwork.voteWithRelayPattern(rpvTokenAddress, wallet!.privateKey, wallet!.address, position as 'support' | 'oppose' | 'multiple-choice', proposalId, optionAddress);

        if (!voteResult.success) {
          return res.status(400).json({ error: voteResult.error || "Failed to transfer vote token" });
        }
        txHash = voteResult.txHash;
      }

      // Record vote in database (txHash is null for off-chain org votes).
      await storage.recordVote(userId, proposalId, position, undefined, txHash, selectedOption);

      // Demo account is sandboxed: vote is recorded in the user's history,
      // but real proposal counters don't move so App Store reviewers can't
      // pollute production stats.
      const isDemoAccount = user?.email === 'demo@represent.app';
      if (!selectedOption && !isDemoAccount) {
        await storage.updateProposalVotes(proposalId, position);
      }
      // (ballot counter was already incremented atomically by consumeBallot above)

      // Check and award badges
      let newBadges = [];
      try {
        const { db } = await import('./db');
        const { badges, userBadges, votes } = await import('@shared/schema');
        const { eq, and } = await import('drizzle-orm');

        // Get user votes to check for badges
        const userVotes = await db.select().from(votes).where(eq(votes.userId, userId));

        // Award first vote badge
        if (userVotes.length === 1) {
          const firstVoteBadges = await db.select().from(badges).where(eq(badges.badgeType, 'first_vote_global')).limit(1);
          const firstVoteBadge = firstVoteBadges[0];
          if (firstVoteBadge) {
            const existing = await db.select().from(userBadges).where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, firstVoteBadge.id))).limit(1);
            if (!existing.length) {
              await db.insert(userBadges).values({ userId, badgeId: firstVoteBadge.id });
              newBadges.push({ id: firstVoteBadge.id, name: firstVoteBadge.name, tier: firstVoteBadge.tier });
            }
          }
        }

        // Award voting streak badges
        const voteCount = userVotes.length;
        const streakBadges = [
          { count: 5, type: 'voting_streak_5' },
          { count: 25, type: 'voting_streak_25' },
          { count: 100, type: 'voting_streak_100' },
        ];

        for (const streakBadge of streakBadges) {
          if (voteCount === streakBadge.count) {
            const badgesList = await db.select().from(badges).where(eq(badges.badgeType, streakBadge.type)).limit(1);
            const badge = badgesList[0];
            if (badge) {
              const existing = await db.select().from(userBadges).where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id))).limit(1);
              if (!existing.length) {
                await db.insert(userBadges).values({ userId, badgeId: badge.id });
                newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
              }
            }
          }
        }
      } catch (badgeError) {
        log(`Badge check error (non-critical): ${badgeError}`);
      }

      log(`Vote recorded ${isOrgScoped ? 'off-chain (org)' : 'on-chain'}: user=${rid(userId)}, proposal=${proposalId}, position=${position}${txHash ? `, tx=${txHash}` : ''}`);

      // Notify proposal owner that someone voted on their proposal
      if (proposal.userId !== userId) {
        const voterName = user?.name || 'Someone';
        notifyProposalVote({ id: proposal.id, title: proposal.title, userId: proposal.userId }, voterName);
      }

      res.json({
        success: true,
        message: isOrgScoped ? "Vote recorded" : "Vote recorded on-chain via token transfer",
        txHash,
        newBadges,
      });
    } catch (error) {
      log(`Vote error: ${error}`);
      res.status(500).json({ error: "Failed to record vote" });
    }
  });

  // Public stats endpoint (no auth required)
  app.get("/api/stats", async (_req, res) => {
    try {
      const [voteResult, proposalResult] = await Promise.all([
        db.select({ count: count() }).from(votes),
        db.select({ count: count() }).from(proposals),
      ]);
      res.json({
        votes: Number(voteResult[0]?.count ?? 0),
        proposals: Number(proposalResult[0]?.count ?? 0),
      });
    } catch (error) {
      res.json({ votes: 0, proposals: 0 });
    }
  });

  // Get proposals endpoint (supports filtering by organizationId)
  app.get("/api/proposals", async (req: any, res) => {
    try {
      const { orgId } = req.query;
      let proposals = await storage.getAllProposals();

      // Filter by organization if specified
      if (orgId) {
        proposals = proposals.filter((p: any) => p.organizationId === orgId);
      }

      // UPDATE 27 — UGC moderation. Hide proposals auto-flagged by the
      // report system (hiddenAt non-null) from every requester.
      proposals = proposals.filter((p: any) => !p.hiddenAt);

      // UPDATE 27 — apply requester's mute set so muted creators' proposals
      // disappear from the feed for that user only. Skipped for unauth'd
      // requests (no userId, no mute set).
      const requesterId = req.user?.claims?.sub as string | undefined;
      if (requesterId) {
        try {
          const mutedRows = await db
            .select({ mutedId: userMutes.mutedId })
            .from(userMutes)
            .where(eq(userMutes.muterId, requesterId));
          if (mutedRows.length > 0) {
            const mutedSet = new Set(mutedRows.map((r) => r.mutedId));
            proposals = proposals.filter((p: any) => !mutedSet.has(p.userId));
          }
        } catch {
          // Fail open — better to show all proposals than 5xx the feed.
        }
      }

      res.json({ proposals });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  // Unified results endpoint. Branches on proposal.voteType:
  //   yes-no          → { type, supportVotes, opposeVotes }
  //   multiple-choice → { type, options, counts }
  //   ranked-choice   → { type, ...RCVTally }  (computed in-process via IRV)
  //
  // For org-scoped proposals, requires the caller to be a member.
  app.get("/api/proposals/:proposalId/results", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims?.sub;
      const { proposalId } = req.params;
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });

      if (proposal.organizationId) {
        const isMember = await storage.isOrganizationMember(proposal.organizationId, userId);
        if (!isMember) {
          return res.status(403).json({ error: "You must be a member to view results" });
        }
      }

      if (proposal.voteType === 'multiple-choice') {
        const counts = await storage.countVotesPerOption(proposalId);
        // Ensure every option appears in counts (even 0) so the UI can
        // render a stable list without conditional fallbacks.
        const options = (proposal.options ?? []) as string[];
        const fullCounts: Record<string, number> = {};
        for (const opt of options) fullCounts[opt] = counts[opt] ?? 0;
        return res.json({ type: 'multiple-choice', options, counts: fullCounts });
      }

      if (proposal.voteType === 'ranked-choice') {
        const { computeIRV } = await import('./rcvTally');
        const rawBallots = await storage.getRankedBallots(proposalId);
        const ballots: string[][] = [];
        for (const raw of rawBallots) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.every(p => typeof p === 'string')) {
              ballots.push(parsed);
            }
          } catch {
            // Malformed ballot — skip. Should not happen since the submit
            // endpoint validates JSON.stringify roundtrip, but defensive.
          }
        }
        const tally = computeIRV(ballots, (proposal.options ?? []) as string[]);
        return res.json({ type: 'ranked-choice', ...tally });
      }

      // Default: yes-no.
      return res.json({
        type: 'yes-no',
        supportVotes: proposal.supportVotes ?? 0,
        opposeVotes: proposal.opposeVotes ?? 0,
      });
    } catch (error: any) {
      log(`Get proposal results error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to fetch results" });
    }
  });

  // Claim RPV vote token for a proposal
  app.post("/api/proposals/:proposalId/claim-vote-token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { proposalId } = req.params;

      if (!userId || !proposalId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get user wallet
      const wallet = await storage.getUserWallet(userId);
      if (!wallet) {
        return res.status(400).json({ error: "User wallet not found" });
      }

      // Get proposal
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // Check if user already claimed token for this proposal
      const alreadyClaimed = await storage.hasClaimedToken(userId, proposalId);
      if (alreadyClaimed) {
        return res.status(400).json({ error: "You have already claimed a vote token for this proposal" });
      }

      const rpvTokenAddress = process.env.RPV_TOKEN_ADDRESS;
      if (!rpvTokenAddress) {
        return res.status(500).json({ error: "RPV token not configured" });
      }

      let txHash = '';

      // Transfer RPV tokens on-chain
      try {
        const transferResult = await baseNetwork.transferRPVToken(rpvTokenAddress, wallet.address, 1);
        if (transferResult.success) {
          txHash = transferResult.txHash || '';
          log(`RPV token transferred: tx=${txHash}, user=${userId}`);
        } else {
          log(`Warning: RPV transfer failed: ${transferResult.error}`);
        }
      } catch (chainError: any) {
        log(`Warning: On-chain transfer failed: ${chainError.message}`);
      }

      // Record token claim in database
      const success = await storage.claimVoteToken(userId, proposalId, rpvTokenAddress);
      if (!success) {
        return res.status(500).json({ error: "Failed to claim token" });
      }

      log(`Vote token claimed: user=${userId}, proposal=${proposalId}, tx=${txHash}`);

      // Send push notification for token claimed
      notifyTokenClaimed(userId, proposal.title, proposalId).catch(err => {
        log(`Push notification error: ${err}`);
      });

      res.json({
        success: true,
        message: "RPV vote token claimed successfully",
        voteTokenAddress: rpvTokenAddress,
        txHash: txHash,
      });
    } catch (error) {
      log(`Claim token error: ${error}`);
      res.status(500).json({ error: "Failed to claim vote token" });
    }
  });

  // Get user's claimed tokens for all proposals
  app.get("/api/user/claimed-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(400).json({ error: "User not found" });
      }

      const allProposals = await storage.getAllProposals();
      const claimedProposalIds: string[] = [];

      for (const proposal of allProposals) {
        const hasClaimed = await storage.hasClaimedToken(userId, proposal.id);
        if (hasClaimed) {
          claimedProposalIds.push(proposal.id);
        }
      }

      res.json({ claimedTokens: claimedProposalIds });
    } catch (error) {
      log(`Error fetching claimed tokens: ${error}`);
      res.status(500).json({ error: "Failed to fetch claimed tokens" });
    }
  });

  // Get user's voted proposals (one person one vote enforcement)
  app.get("/api/user/voted-proposals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(400).json({ error: "User not found" });
      }

      const { db } = await import('./db');
      const { eq, desc } = await import('drizzle-orm');
      const { votes, proposals } = await import('@shared/schema');

      const votedWithDetails = await db
        .select({
          proposalId: votes.proposalId,
          title: proposals.title,
          position: votes.position,
          votedAt: votes.timestamp,
          voteTokenId: votes.voteTokenId,
          txHash: votes.txHash,
          supportVotes: proposals.supportVotes,
          opposeVotes: proposals.opposeVotes,
        })
        .from(votes)
        .innerJoin(proposals, eq(votes.proposalId, proposals.id))
        .where(eq(votes.userId, userId))
        .orderBy(desc(votes.timestamp));

      res.json({ votedProposals: votedWithDetails });
    } catch (error) {
      log(`Error fetching voted proposals: ${error}`);
      res.status(500).json({ error: "Failed to fetch voted proposals" });
    }
  });

  // Get user's earned badges
  app.get("/api/badges/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ error: "User ID required" });
      }

      const { db } = await import('./db');
      const { eq } = await import('drizzle-orm');
      const { badges, userBadges } = await import('@shared/schema');

      const earnedBadges = await db
        .select({
          id: userBadges.id,
          badgeId: badges.id,
          name: badges.name,
          description: badges.description,
          icon: badges.icon,
          tier: badges.tier,
          badgeType: badges.badgeType,
          earnedAt: userBadges.awardedAt,
        })
        .from(userBadges)
        .innerJoin(badges, eq(userBadges.badgeId, badges.id))
        .where(eq(userBadges.userId, userId));

      res.json(earnedBadges);
    } catch (error) {
      log(`Error fetching user badges: ${error}`);
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  // Get user dashboard data (my proposals and votes)
  app.get("/api/user/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(400).json({ error: "User not found" });
      }

      const user = await storage.getUser(userId);
      const myProposals = await (storage as any).getProposalsByUser(userId);
      const votedProposals = await (storage as any).getUserVotedProposals(userId);
      const votedDetails = [];

      for (const proposalId of votedProposals) {
        try {
          const proposal = await storage.getProposal(proposalId);
          const voteRecord = await (storage as any).hasUserVotedOnProposal(userId, proposalId);
          if (proposal) {
            votedDetails.push({
              proposalId,
              title: proposal.title,
              position: 'voted',
              votedAt: new Date(),
            });
          }
        } catch (e) {
          log(`Error fetching vote details for ${proposalId}: ${e}`);
        }
      }

      res.json({
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.name,
          walletAddress: user?.walletAddress,
          verified: user?.verified,
        },
        myProposals,
        votedProposals: votedDetails,
      });
    } catch (error) {
      log(`Error fetching dashboard: ${error}`);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // Get user's verified ridings
  app.get("/api/user/verified-ridings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const ridings = await (storage as any).getUserVerifiedRidings(userId);
      res.json({ ridings: ridings || [] });
    } catch (error) {
      log(`Error fetching verified ridings: ${error}`);
      res.status(500).json({ error: "Failed to fetch verified ridings" });
    }
  });

  // Get user's votes count and voting streak
  app.get("/api/user/votes-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { votes } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");

      // Get total vote count
      const voteRecords = await db.select().from(votes).where(eq(votes.userId, userId));
      const count = voteRecords.length;

      // Calculate voting streak (consecutive days with votes, starting from today going backwards)
      let streak = 0;
      if (voteRecords.length > 0) {
        // Create a set of unique dates with votes
        const voteDateSet = new Set(voteRecords.map((v: any) => {
          const d = new Date(v.createdAt);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        }));

        // Count backwards from today
        let checkDate = new Date();
        checkDate.setHours(0, 0, 0, 0);

        while (voteDateSet.has(checkDate.getTime())) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }

      res.json({ count, streak });
    } catch (error) {
      log(`Error fetching votes count: ${error}`);
      res.status(500).json({ error: "Failed to fetch votes count" });
    }
  });

  // Toggle proposal featured status (admin only)
  app.post("/api/proposals/:id/toggle-featured", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { id: proposalId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Only admins can feature proposals" });
      }

      const updated = await (storage as any).toggleProposalFeatured(proposalId);
      if (!updated) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      log(`Admin ${userId} toggled featured status on proposal ${proposalId}`);
      res.json({ success: true, isFeatured: updated.isFeatured, proposal: updated });
    } catch (error) {
      log(`Error toggling featured proposal: ${error}`);
      res.status(500).json({ error: "Failed to toggle featured status" });
    }
  });

  app.delete("/api/proposals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.email !== 'masonwoods45@gmail.com') {
        return res.status(403).json({ error: "Unauthorized: Admin access required" });
      }

      const proposalId = req.params.id;

      await db.delete(votes).where(eq(votes.proposalId, proposalId));
      await db.delete(voteTokenClaims).where(eq(voteTokenClaims.proposalId, proposalId));

      const result = await db.delete(proposals).where(eq(proposals.id, proposalId)).returning({ id: proposals.id });

      if (result.length === 0) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      log(`Admin ${user.email} deleted proposal ${proposalId}`);
      res.json({ success: true });
    } catch (error) {
      log(`Error deleting proposal: ${error}`);
      res.status(500).json({ error: "Failed to delete proposal" });
    }
  });

  // Get featured proposals
  app.get("/api/proposals/featured", async (req, res) => {
    try {
      const featured = await (storage as any).getFeaturedProposals();
      res.json({ featured: featured || [] });
    } catch (error) {
      log(`Error fetching featured proposals: ${error}`);
      res.status(500).json({ error: "Failed to fetch featured proposals" });
    }
  });

  // Get count of proposals eligible for user to vote on
  app.get("/api/proposals/eligible-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { proposals, votes } = await import("@shared/schema");
      const { eq, isNull, and } = await import("drizzle-orm");

      // Get all proposals where user hasn't voted
      const allProposals = await db.select().from(proposals).where(isNull(proposals.deadline));
      const userVotes = await db.select({ proposalId: votes.proposalId }).from(votes).where(eq(votes.userId, userId));
      const votedProposalIds = new Set(userVotes.map((v: any) => v.proposalId));

      // Filter for proposals user hasn't voted on and is eligible for
      let eligibleCount = 0;
      for (const proposal of allProposals) {
        // Skip if already voted
        if (votedProposalIds.has(proposal.id)) continue;

        // Check deadline
        if (proposal.deadline && new Date(proposal.deadline) < new Date()) continue;

        // Check geo restriction (simplified: if user has country set and proposal has no restrictions, eligible)
        if (proposal.geoRestrictions && proposal.geoRestrictions.length > 0) {
          const proposalLocation = proposal.geoRestrictions[0];
          const userLocation = user.country || '';
          const doesMatch = proposalLocation.startsWith(userLocation) &&
            (proposalLocation === userLocation || proposalLocation.startsWith(userLocation + '-'));
          if (!doesMatch) continue;
        }

        // Check demographic restrictions
        if (proposal.demographicRestrictions && proposal.demographicRestrictions.length > 0) {
          let meetsRestrictions = true;
          for (const restriction of proposal.demographicRestrictions) {
            if (restriction.type === 'gender' && user.gender && user.gender.toLowerCase() !== restriction.value.toLowerCase()) {
              meetsRestrictions = false;
              break;
            }
            if (restriction.type === 'age') {
              // Parse age range (e.g., "18-25")
              const [minAge, maxAge] = restriction.value.split('-').map(Number);
              if (user.dateOfBirth) {
                const today = new Date();
                const birthDate = new Date(user.dateOfBirth);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                  age--;
                }
                if (age < minAge || age > maxAge) {
                  meetsRestrictions = false;
                  break;
                }
              } else {
                meetsRestrictions = false;
                break;
              }
            }
          }
          if (!meetsRestrictions) continue;
        }

        eligibleCount++;
      }

      res.json({ count: eligibleCount });
    } catch (error) {
      log(`Error fetching eligible proposals count: ${error}`);
      res.status(500).json({ error: "Failed to fetch eligible proposals count" });
    }
  });

  // Create proposal endpoint
  app.post("/api/proposals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if verification is required for creating proposals (default: true)
      let requireVerification = true;
      try {
        const setting = await storage.getPlatformSetting('requireVerificationForProposals');
        // Setting can be: false (boolean), "false" (string), null, or undefined
        requireVerification = setting === true || setting === "true";
        log(`Proposal creation - requireVerification=${requireVerification}, setting=${JSON.stringify(setting)}, user.verified=${user?.verified}`);
      } catch (e) {
        log(`Error fetching verification setting: ${e}`);
        // If setting doesn't exist, default to true
        requireVerification = true;
      }

      if (requireVerification && !user?.verified) {
        return res.status(403).json({ error: "Identity verification required to create proposals" });
      }

      const { title, description, category, geoRestrictions, riding, demographicRestrictions, voteType, options, organizationId, imageUrl, requiresCitizenship } = req.body;

      // UPDATE 27 — UGC profanity gate (Apple Guideline 1.2). Cheap
      // pre-publish filter; layered moderation (managed APIs, user
      // reports, admin review) is handled separately.
      const profanity = checkContent({ title, description });
      if (!profanity.ok) {
        return res.status(400).json({
          error: "Your proposal contains language that isn't allowed. Please revise and try again.",
          code: "CONTENT_REJECTED",
          field: profanity.field,
        });
      }

      // Validate organization membership if creating org-restricted proposal
      if (organizationId) {
        const isMember = await storage.isOrganizationMember(organizationId, userId);
        if (!isMember) {
          return res.status(403).json({ error: "You must be an organization member to create proposals for it" });
        }
      }

      // Validate riding if provided
      if (riding) {
        const hasVerifiedRiding = await (storage as any).getRidingVerification(userId, riding);
        if (!hasVerifiedRiding) {
          return res.status(403).json({ error: "You have not verified this electoral riding. Scan the QR code to verify." });
        }
      }

      // If proposal has geo-restrictions, validate they match user's profile location
      if (geoRestrictions && geoRestrictions.length > 0) {
        const proposalLocation = geoRestrictions[0]; // Format: "COUNTRY-STATE-CITY" or "COUNTRY-STATE" or "COUNTRY"
        const userLocation = user.country ? user.country : null;
        const userState = user.state ? `-${user.state}` : '';
        const userCity = user.city ? `-${user.city}` : '';
        const userFullLocation = userLocation ? userLocation + userState + userCity : '';

        log(`Proposal location validation: proposalLocation="${proposalLocation}", userFullLocation="${userFullLocation}", userCountry="${user.country}", userState="${user.state}", userCity="${user.city}"`);

        // Check if proposal location matches user's profile (must start with user's country and state if applicable)
        const doesLocationMatch = proposalLocation.startsWith(userLocation) &&
          (proposalLocation === userLocation || proposalLocation.startsWith(userLocation + '-'));

        if (!doesLocationMatch) {
          return res.status(403).json({
            error: `You can only create proposals for your location (${userFullLocation || 'not set in profile'}). Please update your profile location first.`
          });
        }
      }

      // voteType validation. Defaults to yes-no for backward compatibility
      // (existing clients don't send voteType). Mirrors the org-proposal
      // create endpoint validation from UPDATE 20.
      const resolvedVoteType: string = voteType || 'yes-no';
      if (!['yes-no', 'multiple-choice', 'ranked-choice'].includes(resolvedVoteType)) {
        return res.status(400).json({ error: "voteType must be 'yes-no', 'multiple-choice', or 'ranked-choice'" });
      }
      if (resolvedVoteType !== 'yes-no') {
        if (!Array.isArray(options) || options.length < 2) {
          return res.status(400).json({ error: `${resolvedVoteType} proposals require at least 2 options` });
        }
        if (options.some((o: any) => typeof o !== 'string' || o.trim().length === 0)) {
          return res.status(400).json({ error: "options must be non-empty strings" });
        }
        if (new Set(options).size !== options.length) {
          return res.status(400).json({ error: "options must be unique" });
        }
      }

      const proposal = await storage.createProposal(userId, title, description, category, geoRestrictions, undefined, riding, demographicRestrictions);

      // Update proposal with organization and image if provided
      const updateData: any = {};
      if (organizationId) {
        updateData.organizationId = organizationId;
      }
      if (imageUrl) {
        updateData.imageUrl = imageUrl;
      }
      if (requiresCitizenship === true) {
        updateData.requiresCitizenship = true;
      }

      // Persist voteType + options. Only multiple-choice gets on-chain
      // optionAddresses (yes/no uses deterministic per-position addresses
      // generated at vote time; ranked-choice is off-chain per UPDATE 20).
      if (resolvedVoteType === 'multiple-choice') {
        const optionAddresses = [];
        for (let i = 0; i < options.length; i++) {
          const optionAddress = await baseNetwork.generateDeterministicAddress(proposal.id, i);
          optionAddresses.push(optionAddress);
        }
        updateData.voteType = 'multiple-choice';
        updateData.options = options;
        updateData.optionAddresses = optionAddresses;
      } else if (resolvedVoteType === 'ranked-choice') {
        updateData.voteType = 'ranked-choice';
        updateData.options = options;
      }

      if (Object.keys(updateData).length > 0) {
        await storage.updateProposal(proposal.id, updateData);
      }

      log(`Proposal created with riding: proposalId=${proposal.id}, riding=${riding}`);

      // Create vote token for this proposal on Base Sepolia
      const voteTokenAddress = await baseNetwork.createProposalVoteToken(proposal.id);
      if (voteTokenAddress) {
        await storage.updateProposal(proposal.id, { voteTokenAddress });
        log(`Vote token created for proposal ${proposal.id}: ${voteTokenAddress}`);
      }

      // Send push notification to eligible users about new proposal
      notifyNewProposal({
        id: proposal.id,
        title: proposal.title,
        category: proposal.category,
        geoRestrictions: geoRestrictions || [],
      }).catch(err => {
        log(`Push notification error: ${err}`);
      });

      res.json({ proposal: { ...proposal, voteTokenAddress } });
    } catch (error) {
      log(`Proposal creation error: ${error}`);
      res.status(500).json({ error: "Failed to create proposal" });
    }
  });

  // Geo-gated Voting Route
  app.post("/api/voting/geo-gated", async (req, res) => {
    const { userId, proposalId, position, latitude, longitude, country, state } = req.body;

    if (!userId || !proposalId || !position || !latitude || !longitude) {
      return res.status(400).json({ error: "Location data required for geo-gated voting" });
    }

    try {
      // Check if user is verified for geo-gated proposals
      const user = await storage.getUser(userId);
      if (!user?.verified) {
        return res.status(403).json({ error: "Identity verification required for this proposal" });
      }

      await storage.recordVote(userId, proposalId, position);

      log(`Geo-gated vote recorded: user=${rid(userId)}, proposal=${proposalId}, location=${country}/${state}`);

      res.json({
        success: true,
        message: "Geo-gated vote recorded successfully",
      });
    } catch (error) {
      log(`Geo-gated vote error: ${error}`);
      res.status(500).json({ error: "Failed to record geo-gated vote" });
    }
  });


  // Debug: Reset verification for testing
  app.post("/api/debug/reset-verification", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims?.sub;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    try {
      await storage.updateUserVerification(userId, {
        verified: false,
        verificationId: null,
        verificationMethod: null,
      });
      log(`✅ Verification reset for user=${userId}. You can now test the Veriff flow again.`);
      res.json({ success: true, message: "Verification reset - you can now test the Veriff flow again" });
    } catch (error) {
      log(`❌ Reset verification error: ${error}`);
      res.status(500).json({ error: "Failed to reset verification" });
    }
  });

  // Identity Verification with Veriff Integration
  app.post("/api/identity/verify", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims?.sub;
    const { verificationMethod, firstName, lastName } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    log(`Identity verify request: userId=${rid(userId)}, method=${verificationMethod}`);

    try {
      if (verificationMethod === 'veriff') {
        // Store first/last name in user record
        if (firstName || lastName) {
          await storage.updateUser(userId, {
            firstName: firstName || '',
            lastName: lastName || ''
          });
          log(`User name updated: firstName="${firstName}", lastName="${lastName}"`);
        }

        // Create Veriff session
        const veriffApiKey = process.env.VERIFF_API_KEY;
        const veriffMasterKey = process.env.VERIFF_MASTER_SIGNATURE_KEY;

        if (!veriffApiKey || !veriffMasterKey) {
          return res.status(500).json({ error: "Veriff not configured" });
        }

        // Create session with Veriff API
        const domain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DEPLOYMENT_URL || 'localhost:5000';
        const callbackUrl = `https://${domain}/api/verification-callback`;

        const verificationObject: any = {
          callback: callbackUrl,
          vendorData: userId,
        };

        // Add person info with full name if provided
        if (firstName && lastName) {
          verificationObject.person = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          };
          log(`Veriff person object: ${JSON.stringify(verificationObject.person)}`);
        }

        const requestBody = JSON.stringify({
          verification: verificationObject,
        });

        log(`Veriff request body: ${requestBody}`);

        // Create HMAC signature
        const crypto = await import('crypto');
        const hmacSignature = crypto.createHmac('sha256', veriffMasterKey)
          .update(requestBody)
          .digest('hex');

        log(`HMAC signature: ${hmacSignature}`);

        const sessionResponse = await fetch('https://stationapi.veriff.com/v1/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-AUTH-CLIENT': veriffApiKey,
            'X-HMAC-SIGNATURE': hmacSignature,
          },
          body: requestBody,
        });

        if (!sessionResponse.ok) {
          const error = await sessionResponse.text();
          log(`Veriff session creation failed: ${error}`);
          return res.status(500).json({ error: "Failed to create verification session" });
        }

        const sessionData = await sessionResponse.json();
        const sessionUrl = sessionData.verification?.url;
        const sessionId = sessionData.verification?.id;

        log(`Veriff session created successfully: user=${userId}, sessionId=${sessionId}`);

        // Store sessionId in user record for later status checks
        if (sessionId) {
          await storage.updateUserVerification(userId, {
            verified: false,
            verificationId: sessionId,
            verificationMethod: 'veriff',
          });
          log(`Stored Veriff sessionId=${sessionId} for user=${userId}`);
        }

        res.json({
          success: true,
          sessionUrl,
          sessionId,
          message: "Veriff session created successfully",
        });
      } else {
        // Manual verification (for testing)
        await storage.updateUserVerification(userId, {
          verified: true,
          verificationMethod: 'manual',
          verifiedAt: new Date(),
        });

        await grantInitialBallotsIfNeeded(userId);

        log(`User manually verified: user=${userId}`);

        res.json({
          success: true,
          message: "Identity verified successfully",
        });
      }
    } catch (error) {
      log(`Verification error: ${error}`);
      res.status(500).json({ error: "Failed to verify identity" });
    }
  });

  // Profile Update - manually set user profile details
  app.post("/api/profile/update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { name, country, state, city, documentType, gender, dateOfBirth } = req.body;

      if (!name?.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      await storage.updateUser(userId, {
        name: name.trim(),
        country: country?.trim() || null,
        state: state?.trim() || null,
        city: city?.trim() || null,
        documentType: documentType?.trim() || null,
        gender: gender || null,
        dateOfBirth: dateOfBirth || null,
      });

      log(`Profile updated: userId=${rid(userId)}, country="${country}", state="${state}", city="${city}", documentType="${documentType}"`);

      res.json({
        success: true,
        message: "Profile updated successfully",
      });
    } catch (error) {
      log(`Profile update error: ${error}`);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Re-sync location data from Veriff for verified users
  app.post("/api/verification/sync-location", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (!user.verified) {
        return res.status(403).json({ error: "You must complete identity verification first" });
      }

      const verificationId = user.verificationId;
      if (!verificationId) {
        return res.status(400).json({ error: "No Veriff session found. Please contact support." });
      }

      const VERIFF_API_KEY = process.env.VERIFF_API_KEY;
      if (!VERIFF_API_KEY) {
        return res.status(500).json({ error: "Veriff not configured" });
      }

      log(`🔄 Re-syncing Veriff data for user ${userId}, session ${verificationId}`);

      // Fetch the decision from Veriff
      const response = await fetch(`https://stationapi.veriff.com/v1/sessions/${verificationId}/decision`, {
        headers: {
          'X-AUTH-CLIENT': VERIFF_API_KEY,
        },
      });

      if (!response.ok) {
        log(`Veriff decision fetch failed: ${response.status}`);
        return res.status(400).json({ error: "Could not fetch verification data from Veriff" });
      }

      const data = await response.json();
      log(`Veriff sync response: ${JSON.stringify(data).substring(0, 1000)}`);

      const verification = data.verification || {};
      const person = verification.person || {};
      const document = verification.document || {};
      const address = person.address || {};

      const updateData: any = {};

      if (document.type) updateData.documentType = document.type;

      // For passports: use document.country (issuing country)
      // For driver's licenses/IDs: use address data
      if (document.type === 'PASSPORT') {
        if (document.country) updateData.country = document.country;
      } else {
        if (address.country) updateData.country = address.country;
        if (address.state) updateData.state = address.state;
        if (address.city) updateData.city = address.city;
      }

      // Extract demographic data
      if (person.dateOfBirth) updateData.dateOfBirth = person.dateOfBirth;
      if (person.gender) {
        updateData.gender = person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : person.gender.toLowerCase();
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No location data found in Veriff response" });
      }

      await storage.updateUser(userId, updateData);
      log(`✅ Synced Veriff data for user ${userId}: country=${updateData.country}, state=${updateData.state}, city=${updateData.city}`);

      res.json({
        success: true,
        message: "Location data synced from Veriff",
        country: updateData.country,
        state: updateData.state,
        city: updateData.city,
        documentType: updateData.documentType,
      });
    } catch (error) {
      log(`Sync location error: ${error}`);
      res.status(500).json({ error: "Failed to sync location data" });
    }
  });

  // One-time admin fix for masonwoods45@gmail.com account (missing production data)
  app.post("/api/admin/fix-mason-account", async (req, res) => {
    try {
      const userId = 'google_101276366323354871507';
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Only fix if location is missing
      if (user.country && user.state && user.city) {
        return res.json({ message: "Account already has location data", country: user.country, state: user.state, city: user.city });
      }

      await storage.updateUser(userId, {
        verificationId: 'cea9bd2a-ceed-45d2-8a13-1ecf66fd3c67',
        country: 'Canada',
        state: 'Ontario',
        city: 'Toronto',
      });

      log(`✅ Fixed Mason's account with location data: Canada/Ontario/Toronto`);

      res.json({
        success: true,
        message: "Account fixed with location data",
        country: 'Canada',
        state: 'Ontario',
        city: 'Toronto'
      });
    } catch (error) {
      log(`Admin fix error: ${error}`);
      res.status(500).json({ error: "Failed to fix account" });
    }
  });

  // Check Veriff verification status (polls API to get decision)
  app.get("/api/verification/check-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // If already verified, return success
      if (user.verified) {
        return res.json({ verified: true, message: "Already verified" });
      }

      const veriffApiKey = process.env.VERIFF_API_KEY;
      const veriffMasterKey = process.env.VERIFF_MASTER_SIGNATURE_KEY;
      if (!veriffApiKey || !veriffMasterKey) {
        return res.json({ verified: false, message: "Veriff not configured" });
      }

      // Get stored session ID from user record
      const sessionId = (user as any).verificationId;
      log(`Checking Veriff status for user=${userId}, sessionId=${sessionId}`);

      if (!sessionId) {
        return res.json({
          verified: false,
          message: "No verification session found. Please start the verification process first."
        });
      }

      // For GET requests to Veriff decision endpoint, signature is based on the query ID
      // The signature should be HMAC-SHA256 of the sessionId using the master key
      const crypto = await import('crypto');
      const hmacSignature = crypto.createHmac('sha256', veriffMasterKey)
        .update(sessionId)
        .digest('hex');

      // Query the specific session's decision endpoint
      const decisionResponse = await fetch(`https://stationapi.veriff.com/v1/sessions/${sessionId}/decision`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-CLIENT': veriffApiKey,
          'X-HMAC-SIGNATURE': hmacSignature,
        },
      });

      if (decisionResponse.ok) {
        const decisionData = await decisionResponse.json();
        log(`Veriff full response: ${JSON.stringify(decisionData).substring(0, 500)}`);

        // Try multiple possible response structures
        let status = decisionData.verification?.status || decisionData.status || decisionData.decision?.status;
        log(`Veriff decision response: status=${status} for sessionId=${sessionId}`);

        if (status === 'approved') {
          // User is approved! Update database
          await storage.updateUserVerification(userId, {
            verified: true,
            verificationId: sessionId,
            verificationMethod: 'veriff',
            verifiedAt: new Date(),
          });

          await grantInitialBallotsIfNeeded(userId);

          return res.json({
            verified: true,
            message: "Identity verified! You can now mint your passport."
          });
        } else if (status === 'pending') {
          return res.json({
            verified: false,
            message: "Verification is still pending. Check back in a moment."
          });
        } else if (status === 'declined') {
          return res.json({
            verified: false,
            message: "Your verification was declined. Please try again."
          });
        } else if (status === 'expired') {
          return res.json({
            verified: false,
            message: "Your verification session has expired. Please start again."
          });
        } else {
          // Status is still undefined from /decision - try /attempts endpoint as fallback
          log(`Veriff /decision returned null, trying /attempts endpoint for sessionId=${sessionId}`);

          const attemptsResponse = await fetch(`https://stationapi.veriff.com/v1/sessions/${sessionId}/attempts`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-AUTH-CLIENT': veriffApiKey,
              'X-HMAC-SIGNATURE': hmacSignature,
            },
          });

          if (attemptsResponse.ok) {
            const attemptsData = await attemptsResponse.json();
            log(`Veriff /attempts response: ${JSON.stringify(attemptsData).substring(0, 500)}`);

            // Check if any verification in the attempts is approved
            const verifications = attemptsData.verifications || [];
            const approvedVerification = verifications.find((v: any) => v.status === 'approved');

            if (approvedVerification) {
              log(`Found approved verification in /attempts: ${approvedVerification.id}`);

              // User is approved! Update database
              await storage.updateUserVerification(userId, {
                verified: true,
                verificationId: sessionId,
                verificationMethod: 'veriff',
                verifiedAt: new Date(),
              });

              await grantInitialBallotsIfNeeded(userId);

              return res.json({
                verified: true,
                message: "Identity verified! You can now mint your passport."
              });
            }
          }

          log(`Veriff response keys: ${Object.keys(decisionData).join(', ')}`);
          if (decisionData.verification) log(`verification keys: ${Object.keys(decisionData.verification).join(', ')}`);
          if (decisionData.decision) log(`decision keys: ${Object.keys(decisionData.decision).join(', ')}`);
          return res.json({
            verified: false,
            message: "Verification status unclear. Your Veriff session may still be processing. Try again in a moment."
          });
        }
      } else {
        log(`Veriff decision query failed: status=${decisionResponse.status}, sessionId=${sessionId}`);
        const errorText = await decisionResponse.text();
        log(`Veriff error response: ${errorText}`);
      }

      res.json({
        verified: false,
        message: "Unable to check verification status. Please try again."
      });
    } catch (error) {
      log(`Check verification status error: ${error}`);
      res.status(500).json({ error: "Failed to check status" });
    }
  });

  // Veriff Redirect Handler - user redirect after completing KYC
  app.get("/api/verification-callback", (req, res) => {
    // Veriff redirects users here after completion - redirect to dashboard
    log(`Veriff redirect received - redirecting to dashboard`);
    res.redirect("/dashboard");
  });

  // Veriff Webhook - called by Veriff when verification completes
  app.post("/api/verification-callback", async (req, res) => {
    if (!verifyVeriffSignature(req)) {
      log(`Veriff webhook rejected: invalid or missing HMAC signature on /api/verification-callback`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    try {
      const { verification } = req.body;
      if (!verification) {
        return res.status(400).json({ error: "No verification data" });
      }

      const userId = verification.vendorData;
      const verificationId = verification.id;
      const status = verification.status;

      log(`Veriff webhook received: userId=${rid(userId)}, status=${status}`);

      if (status === 'approved') {
        // Extract location and document data from Veriff response
        const person = verification.person || {};
        const document = verification.document || {};
        const address = person.address || {};

        const updateData: any = {
          verified: true,
          verificationId,
          verificationMethod: 'veriff',
          verifiedAt: new Date(),
        };

        // Capture document type (passport, driver's_license, id_card, etc.)
        if (document.type) {
          updateData.documentType = document.type;
        }

        // Capture location information - prioritize document.country (issuing country) over address
        // For passports, document.country is the citizenship/issuing country
        // For driver's licenses, address.country is the residence address
        const country = document.country || address.country;
        if (country) {
          updateData.country = country;
        }
        if (address.state) {
          updateData.state = address.state;
        }
        if (address.city) {
          updateData.city = address.city;
        }

        log(`Veriff data: document.country=${document.country}, address.country=${address.country}, address.state=${address.state}, address.city=${address.city}`);

        await storage.updateUserVerification(userId, updateData);

        await grantInitialBallotsIfNeeded(userId);

        log(`User verified via Veriff webhook: user=${rid(userId)}, verificationId=${rid(verificationId)}, document=${document.type}, country=${address.country}`);
      }

      // Always respond 200 to Veriff webhook
      res.status(200).json({ received: true });
    } catch (error) {
      log(`Verification callback error: ${error}`);
      res.status(200).json({ received: true });
    }
  });

  // Veriff Webhook - alternate endpoint (same logic as /api/verification-callback)
  app.post("/api/veriff/webhook", async (req, res) => {
    if (!verifyVeriffSignature(req)) {
      log(`Veriff webhook rejected: invalid or missing HMAC signature on /api/veriff/webhook`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    try {
      const { verification } = req.body;
      log(`Veriff webhook received at /api/veriff/webhook: ${JSON.stringify(req.body).substring(0, 500)}`);

      if (!verification) {
        return res.status(200).json({ received: true });
      }

      const { userId, originatingOrgId } = parseVendorData(verification.vendorData);
      const verificationId = verification.id;
      const status = verification.status;

      log(`Veriff webhook: userId=${rid(userId)}, originatingOrgId=${rid(originatingOrgId)}, status=${status}, verificationId=${rid(verificationId)}`);

      if (status === 'approved') {
        const person = verification.person || {};
        const document = verification.document || {};
        const address = person.address || {};

        const updateData: any = {
          verified: true,
          verificationId,
          verificationMethod: 'veriff',
          verifiedAt: new Date(),
        };

        if (document.type) updateData.documentType = document.type;

        // Prioritize document.country (issuing country for passports) over address.country
        const country = document.country || address.country;
        if (country) updateData.country = country;
        if (address.state) updateData.state = address.state;
        if (address.city) updateData.city = address.city;

        // Extract demographic data from Veriff
        if (person.dateOfBirth) updateData.dateOfBirth = person.dateOfBirth;
        if (person.gender) {
          // Veriff returns 'M' or 'F', normalize to 'male'/'female'
          updateData.gender = person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : person.gender.toLowerCase();
        }

        log(`Veriff webhook data: document.country=${document.country}, address.country=${address.country}`);
        await storage.updateUserVerification(userId, updateData);
        await grantInitialBallotsIfNeeded(userId);
        // UPDATE 25: org billing has moved to vote-time. The originatingOrgId
        // is logged above for diagnostic correlation but no longer drives
        // a Stripe charge here.
        log(`User verified via /api/veriff/webhook: user=${rid(userId)}, verificationId=${rid(verificationId)}, country=${country}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      log(`Veriff webhook error: ${error}`);
      res.status(200).json({ received: true });
    }
  });

  // Sentinel AI Document Analysis (calls OpenAI). Two-layer cost protection:
  //  1) IP-level: 10 requests / minute / IP — defends against scrape bursts.
  //  2) Per-user daily: 5/day free, 50/day premium — caps OpenAI spend per user.
  // Auth required so per-user accounting is meaningful.
  const sentinelIpLimiter = makeIpRateLimiter(60_000, 10);
  const SENTINEL_FREE_DAILY = 5;
  const SENTINEL_PREMIUM_DAILY = 50;

  app.post("/api/sentinel/analyze", isAuthenticated, sentinelIpLimiter, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { title, text, issueType } = req.body;
    if (!text || !title) {
      return res.status(400).json({ error: "title and text required" });
    }

    try {
      const user = await storage.getUser(userId);
      const isPremium = user?.subscriptionStatus === "active";
      const dailyCap = isPremium ? SENTINEL_PREMIUM_DAILY : SENTINEL_FREE_DAILY;
      const consumed = await (storage as any).consumeSentinelUse(userId, dailyCap);
      if (!consumed) {
        return res.status(429).json({
          error: `Daily Sentinel limit reached (${dailyCap}/day).${isPremium ? "" : " Upgrade to Premium for higher limits."}`,
          dailyCapReached: true,
        });
      }

      const { analyzeGovernanceText } = await import("./lib/analysis");
      const analysis = await analyzeGovernanceText({ title, text, issueType: issueType || "policy" });

      log(`Sentinel analysis: user=${userId}, title=${title}, issueType=${issueType || "policy"}`);

      res.json({
        success: true,
        analysis,
        message: "Document analyzed successfully",
      });
    } catch (error) {
      log(`Sentinel error: ${error}`);
      res.status(500).json({ error: "Failed to analyze document" });
    }
  });

  // Admin pricing routes
  const isAdmin = async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const userId = req.user.claims?.sub;
    const user = await storage.getUser(userId);
    if (!user?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  };

  app.get("/api/admin/pricing", isAdmin, async (req, res) => {
    try {
      const plans = await storage.getAllPricingPlans();
      res.json({ plans });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pricing plans" });
    }
  });

  app.post("/api/admin/pricing", isAdmin, async (req, res) => {
    try {
      const { name, description, price, billingPeriod, features } = req.body;
      const plan = await storage.createPricingPlan({
        name,
        description,
        price: parseInt(price),
        billingPeriod: billingPeriod || 'monthly',
        features: features || [],
        isActive: true,
      });
      res.json({ plan });
    } catch (error) {
      res.status(500).json({ error: "Failed to create pricing plan" });
    }
  });

  app.put("/api/admin/pricing/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, price, billingPeriod, features, isActive } = req.body;
      const plan = await storage.updatePricingPlan(id, {
        name,
        description,
        price: price ? parseInt(price) : undefined,
        billingPeriod,
        features,
        isActive,
      });
      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }
      res.json({ plan });
    } catch (error) {
      res.status(500).json({ error: "Failed to update pricing plan" });
    }
  });

  app.delete("/api/admin/pricing/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePricingPlan(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pricing plan" });
    }
  });

  // Platform Settings Routes
  app.get("/api/admin/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const value = await storage.getPlatformSetting('requireVerificationForProposals');
      // Handle JSONB boolean: could be boolean, string, or null
      const requireVerification = value === true || value === "true" || (value !== false && value !== "false" && value !== null && value !== undefined);
      res.json({
        requireVerificationForProposals: requireVerification,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/admin/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { requireVerificationForProposals } = req.body;
      await storage.setPlatformSetting('requireVerificationForProposals', requireVerificationForProposals, 'Require users to be verified before creating proposals');

      res.json({ success: true, requireVerificationForProposals });
    } catch (error) {
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Admin toggle (for testing - makes a user admin)
  app.get("/api/admin/toggle", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: "userId required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Toggle admin status
      const updated = await storage.updateUser(userId, { isAdmin: !user.isAdmin });
      log(`Admin toggle: user=${userId}, isAdmin=${updated?.isAdmin}`);
      res.json({
        success: true,
        message: `User ${updated?.isAdmin ? 'IS NOW' : 'IS NO LONGER'} admin`,
        isAdmin: updated?.isAdmin
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle admin status" });
    }
  });

  // Admin Analytics endpoint
  app.get("/api/admin/analytics", isAdmin, async (req: any, res) => {
    try {
      const allUsers = await (storage as any).getAllUsers?.() || [];
      const allProposals = await (storage as any).getAllProposals?.() || [];
      const allVotes = await (storage as any).getAllVotes?.() || [];
      const allPlans = await storage.getAllPricingPlans();

      const analytics = {
        totalUsers: allUsers.length,
        verifiedUsers: allUsers.filter((u: any) => u.verified).length,
        adminUsers: allUsers.filter((u: any) => u.isAdmin).length,
        totalWallets: allUsers.filter((u: any) => u.walletAddress).length,
        totalProposals: allProposals.length,
        totalVotes: allVotes.length,
        documentsAnalyzed: 0,
        totalPricingPlans: allPlans.length,
        users: allUsers.map((u: any) => ({
          id: u.id,
          email: u.email,
          walletAddress: u.walletAddress,
          verified: u.verified,
          isAdmin: u.isAdmin,
          createdAt: u.createdAt,
          name: u.name,
        })),
      };

      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Get passport status
  app.get("/api/passport/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const passport = await storage.getPassportNFT(userId);

      res.json({
        hasMinted: !!passport,
        tokenId: passport?.tokenId || null,
        contractAddress: passport?.contractAddress || null,
      });
    } catch (error) {
      log(`Passport status error: ${error}`);
      res.status(500).json({ error: "Failed to fetch passport status" });
    }
  });

  // Create Veriff verification session.
  //
  // Two flows merge here:
  //   - Self-paid (no originatingOrgId): user previously paid via the Stripe
  //     verification checkout; we trust the upstream gate.
  //   - Org-paid (originatingOrgId supplied + the org has requireMemberVerification=true
  //     + the user is a member + the org has budget room): no payment prompt,
  //     org's saved card is charged via Stripe metered usage when the webhook
  //     fires. vendor_data is packed as "userId|orgId" for attribution.
  app.post("/api/veriff/create-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.verified) {
        return res.status(400).json({ error: "User already verified" });
      }

      const VERIFF_API_KEY = process.env.VERIFF_API_KEY;
      if (!VERIFF_API_KEY) {
        return res.status(500).json({ error: "Veriff not configured" });
      }

      const originatingOrgId: string | undefined = typeof req.body?.originatingOrgId === 'string' ? req.body.originatingOrgId : undefined;
      let attributedOrgId: string | null = null;
      if (originatingOrgId) {
        const org = await storage.getOrganization(originatingOrgId);
        if (!org || !org.requireMemberVerification) {
          return res.status(400).json({ error: "Org-paid verification not active for this organization" });
        }
        const isMember = await storage.isOrganizationMember(originatingOrgId, userId);
        if (!isMember) {
          return res.status(403).json({ error: "Not a member of this organization" });
        }
        attributedOrgId = originatingOrgId;
      }

      const verificationId = `verify_${userId}_${Date.now()}`;

      const response = await fetch('https://stationapi.veriff.com/v1/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-AUTH-CLIENT': VERIFF_API_KEY,
        },
        body: JSON.stringify({
          verification: {
            callback: 'https://representportal.com/api/veriff/webhook',
            person: {
              firstName: user.firstName || user.name?.split(' ')[0] || 'User',
              lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || 'Citizen',
            },
            vendorData: packVendorData(userId, attributedOrgId),
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        log(`Veriff session creation failed: ${JSON.stringify(error)}`);
        return res.status(500).json({ error: "Failed to create verification session" });
      }

      const data = await response.json();

      log(`Veriff session created: ${data.verification?.id}`);

      res.json({
        sessionToken: data.verification?.id,
        verificationId: data.verification?.id,
        sessionUrl: data.verification?.url,
      });
    } catch (error) {
      log(`Veriff create session error: ${error}`);
      res.status(500).json({ error: "Failed to create verification session" });
    }
  });

  // ─── Didit verification routes (replacing Veriff) ──────────────────────────
  // Didit's pricing model is dramatically cheaper than Veriff (500 free / month
  // / feature, then $0.15/verification) and the integration shape is similar:
  // hosted verification URL + REST decision + HMAC-signed webhook. The Veriff
  // routes above stay wired during the rollout for rollback safety.

  app.post("/api/didit/create-session", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // 'citizen' flow gates on citizenshipVerified (a standard-verified user
      // can still need the stronger citizen pass). Standard flow gates on
      // `verified` as before.
      const flow: 'standard' | 'citizen' = req.body?.flow === 'citizen' ? 'citizen' : 'standard';
      if (flow === 'citizen') {
        if ((user as any).citizenshipVerified) {
          return res.status(400).json({ error: "Citizenship already verified" });
        }
      } else if (user.verified) {
        return res.status(400).json({ error: "User already verified" });
      }

      // Org-paid verification branch (mirror of /api/veriff/create-session above).
      // When originatingOrgId is supplied, the user is verifying because their
      // org has requireMemberVerification=true. Skip the upstream payment gate
      // (the org has paid the one-time unlock fee at toggle-on, so all
      // member verifications are platform-absorbed), enforce membership, and
      // pack the orgId into vendor_data for log correlation.
      const originatingOrgId: string | undefined = typeof req.body?.originatingOrgId === 'string' ? req.body.originatingOrgId : undefined;
      let attributedOrgId: string | null = null;
      if (originatingOrgId) {
        const org = await storage.getOrganization(originatingOrgId);
        if (!org || !org.requireMemberVerification) {
          return res.status(400).json({ error: "Org-paid verification not active for this organization" });
        }
        const isMember = await storage.isOrganizationMember(originatingOrgId, userId);
        if (!isMember) {
          return res.status(403).json({ error: "Not a member of this organization" });
        }
        attributedOrgId = originatingOrgId;
      }

      const { sessionId, sessionUrl } = await createDiditSession(
        userId,
        user.firstName || (user.name?.split(" ")[0]),
        user.lastName || (user.name?.split(" ").slice(1).join(" ")),
        attributedOrgId,
        flow,
      );

      // Persist session id so check-decision and sync-location can look it up
      await storage.updateUserVerification(userId, {
        verificationId: sessionId,
        verificationMethod: "didit",
        verified: false,
      });

      log(`Didit session created: user=${rid(userId)}, sessionId=${rid(sessionId)}`);

      res.json({
        sessionToken: sessionId,
        verificationId: sessionId,
        sessionUrl,
      });
    } catch (error: any) {
      log(`Didit create session error: ${error?.message || error}`);
      res.status(500).json({ error: error?.message || "Failed to create verification session" });
    }
  });

  app.post("/api/didit/webhook", async (req: any, res) => {
    if (!verifyDiditSignature(req)) {
      log(`Didit webhook rejected: invalid signature, missing header, or stale timestamp`);
      return res.status(401).json({ error: "Invalid signature" });
    }
    try {
      const { session_id, status, vendor_data, decision, workflow_id } = req.body || {};
      const { userId, originatingOrgId } = parseVendorData(vendor_data);
      log(`Didit webhook: userId=${rid(userId)}, originatingOrgId=${rid(originatingOrgId)}, status=${status}, sessionId=${rid(session_id)}`);

      if (!session_id || !userId) {
        return res.status(200).json({ received: true });
      }

      // Was this the Citizen workflow (passport + proof of address)? If so we
      // also stamp citizenshipVerified so the user can vote on citizens-only
      // proposals. Compare against the configured citizen workflow id.
      const citizenWorkflowId = process.env.DIDIT_WORKFLOW_ID_CITIZEN;
      const sessionWorkflowId = workflow_id || decision?.workflow_id;
      const isCitizenSession = !!citizenWorkflowId && sessionWorkflowId === citizenWorkflowId;

      if (status === "Approved" || status === "approved") {
        const fields = mapDiditDecisionToUserFields(decision || req.body);
        const updateData: any = {
          verified: true,
          verificationId: session_id,
          verificationMethod: "didit",
          verifiedAt: new Date(),
        };
        if (fields.documentType) updateData.documentType = fields.documentType;
        if (fields.country) updateData.country = fields.country;
        if (fields.state) updateData.state = fields.state;
        if (fields.city) updateData.city = fields.city;
        if (fields.dateOfBirth) updateData.dateOfBirth = fields.dateOfBirth;
        if (fields.gender) updateData.gender = fields.gender;
        if (fields.firstName) updateData.firstName = fields.firstName;
        if (fields.lastName) updateData.lastName = fields.lastName;
        if (isCitizenSession) {
          updateData.citizenshipVerified = true;
          updateData.citizenshipVerifiedAt = new Date();
        }

        await storage.updateUserVerification(userId, updateData);
        await grantInitialBallotsIfNeeded(userId);
        // UPDATE 25: org billing has moved to vote-time (see comment in
        // /api/veriff/webhook above). originatingOrgId is logged for
        // diagnostic correlation only.
        log(`User verified via Didit webhook: user=${rid(userId)}, country=${fields.country}`);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      log(`Didit webhook error: ${error?.message || error}`);
      // Always 200 so Didit doesn't retry storms; we logged the failure
      res.status(200).json({ received: true });
    }
  });

  app.get("/api/didit/check-decision", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const verificationId = String(req.query.verificationId || "");
      if (!verificationId) {
        return res.status(400).json({ error: "verificationId is required" });
      }

      const decision = await fetchDiditDecision(verificationId);
      const status = decision?.status as string | undefined;
      log(`Didit check-decision: user=${rid(userId)}, sessionId=${rid(verificationId)}, status=${status}`);

      if (status === "Approved" || status === "approved") {
        const user = await storage.getUser(userId);
        if (user && !user.verified) {
          const fields = mapDiditDecisionToUserFields(decision);
          const updateData: any = {
            verified: true,
            verificationId,
            verificationMethod: "didit",
            verifiedAt: new Date(),
          };
          if (fields.documentType) updateData.documentType = fields.documentType;
          if (fields.country) updateData.country = fields.country;
          if (fields.state) updateData.state = fields.state;
          if (fields.city) updateData.city = fields.city;
          if (fields.dateOfBirth) updateData.dateOfBirth = fields.dateOfBirth;
          if (fields.gender) updateData.gender = fields.gender;
          if (fields.firstName) updateData.firstName = fields.firstName;
          if (fields.lastName) updateData.lastName = fields.lastName;
          await storage.updateUserVerification(userId, updateData);
          await grantInitialBallotsIfNeeded(userId);
          log(`User verified via Didit check-decision: user=${rid(userId)}, country=${fields.country}`);
        }
      }

      res.json({
        status: status?.toLowerCase() || "unknown",
        decision: status?.toLowerCase() || "unknown",
      });
    } catch (error: any) {
      log(`Didit check-decision error: ${error?.message || error}`);
      res.status(500).json({ error: error?.message || "Failed to check decision" });
    }
  });

  // Admin endpoint to directly mark user as verified (secured by admin key header)
  app.post("/api/admin/verify-user", async (req: any, res) => {
    try {
      const adminKey = req.headers['x-admin-key'];
      const ADMIN_KEY = process.env.VERIFF_MASTER_SIGNATURE_KEY;

      if (!ADMIN_KEY || adminKey !== ADMIN_KEY) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const { email, country, state, city } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Missing email" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      await storage.updateUserVerification(user.id, {
        verified: true,
        verificationMethod: 'admin',
        verifiedAt: new Date(),
        country: country || 'US',
        state: state || null,
        city: city || null,
      });

      await grantInitialBallotsIfNeeded(user.id);

      log(`✅ Admin verified user: ${rid(user.id)}`);

      res.json({ success: true, userId: user.id, verified: true });
    } catch (error) {
      log(`Admin verify-user error: ${error}`);
      res.status(500).json({ error: "Failed to verify user" });
    }
  });

  // Check Veriff decision
  app.get("/api/veriff/check-decision", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { verificationId } = req.query;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!verificationId) return res.status(400).json({ error: "Missing verificationId" });

      const VERIFF_API_KEY = process.env.VERIFF_API_KEY;
      if (!VERIFF_API_KEY) {
        return res.status(500).json({ error: "Veriff not configured" });
      }

      log(`📋 Checking Veriff decision for session: ${verificationId}, user: ${userId}`);

      const response = await fetch(`https://stationapi.veriff.com/v1/sessions/${verificationId}/decision`, {
        headers: {
          'X-AUTH-CLIENT': VERIFF_API_KEY,
        },
      });

      if (!response.ok) {
        log(`Veriff decision not ready for session: ${verificationId}`);
        return res.json({ status: 'pending' });
      }

      const data = await response.json();
      log(`Veriff decision response: ${JSON.stringify(data).substring(0, 1000)}`);

      const verification = data.verification || {};
      const decision = verification.decision || verification.status;

      if (decision === 'approved') {
        const person = verification.person || {};
        const document = verification.document || {};
        const address = person.address || {};

        const updateData: any = {
          verified: true,
          verificationId: verificationId as string,
          verificationMethod: 'veriff',
          verifiedAt: new Date(),
        };

        if (document.type) updateData.documentType = document.type;

        // For passports: use document.country (issuing country)
        // For driver's licenses: use address.country (residence address)
        if (document.type === 'PASSPORT') {
          if (document.country) updateData.country = document.country;
          // Passports don't have reliable address data
        } else {
          // Driver's license or ID card - use address data
          if (address.country) updateData.country = address.country;
          if (address.state) updateData.state = address.state;
          if (address.city) updateData.city = address.city;
        }

        // Extract demographic data from Veriff
        if (person.dateOfBirth) updateData.dateOfBirth = person.dateOfBirth;
        if (person.gender) {
          // Veriff returns 'M' or 'F', normalize to 'male'/'female'
          updateData.gender = person.gender === 'M' ? 'male' : person.gender === 'F' ? 'female' : person.gender.toLowerCase();
        }

        log(`Veriff check-decision: Updating user ${userId} with: ${JSON.stringify(updateData)}`);
        await storage.updateUserVerification(userId, updateData);
        await grantInitialBallotsIfNeeded(userId);
        log(`✅ User ${userId} verified via Veriff check-decision. Country: ${updateData.country}, State: ${updateData.state}, City: ${updateData.city}`);
      }

      res.json({
        status: decision || 'pending',
        decision: decision,
      });
    } catch (error) {
      log(`Veriff check decision error: ${error}`);
      res.status(500).json({ error: "Failed to check verification status" });
    }
  });

  // Mint NFT Passport after verification
  app.post("/api/passport/mint", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const userEmail = req.user.claims?.email;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      // Try to find user by ID first, then by email
      let user = await storage.getUser(userId);
      if (!user && userEmail) {
        user = await storage.getUserByEmail(userEmail);
      }

      if (!user?.verified) {
        return res.status(403).json({ error: "User must be verified to mint passport" });
      }

      const effectiveUserId = user.id;
      log(`🎫 Passport mint check: sessionUserId=${userId}, effectiveUserId=${effectiveUserId}`);

      // Check if already minted using the effective user ID
      const existing = await storage.getPassportNFT(effectiveUserId);
      if (existing) {
        log(`✅ Passport already exists for user: ${effectiveUserId}`);
        return res.json({
          success: true,
          alreadyMinted: true,
          passport: {
            tokenId: existing.nftTokenId,
            contractAddress: existing.contractAddress,
            txHash: existing.txHash,
          },
          message: "You already have a soulbound passport NFT! You can vote on all proposals.",
        });
      }

      const wallet = await storage.getUserWallet(effectiveUserId);
      if (!wallet) return res.status(400).json({ error: "Wallet not found" });

      const passportContractAddress = process.env.PASSPORT_NFT_ADDRESS;
      if (!passportContractAddress) {
        return res.status(500).json({ error: "Passport contract address not configured. Set PASSPORT_NFT_ADDRESS in environment." });
      }

      // Generate unique tokenId based on userId and timestamp
      const tokenId = Math.floor(Math.random() * 1000000).toString();

      log(`🎫 Passport mint request: userId=${rid(effectiveUserId)}, contractAddress=${passportContractAddress}`);

      // Call the actual minting function
      const mintResult = await baseNetwork.mintPassportNFT(
        passportContractAddress,
        wallet.address,
        tokenId
      );

      if (!mintResult.success) {
        // Handle "Already minted" or "Nonce already used" errors gracefully
        // These mean a passport was already minted for this wallet on-chain
        if (mintResult.error?.includes('Already minted') || mintResult.error?.includes('Nonce already used')) {
          log(`⚠️ Blockchain indicates passport already exists for user: ${effectiveUserId}`);

          // Save a record to the database so the UI shows the passport
          try {
            await (storage as any).savePassportNFT(
              effectiveUserId,
              'recovered',
              passportContractAddress,
              'recovered-from-chain'
            );
            log(`✅ Created DB record for existing on-chain passport: ${effectiveUserId}`);
          } catch (dbErr) {
            log(`Could not save recovered passport record: ${dbErr}`);
          }

          return res.json({
            success: true,
            alreadyMinted: true,
            message: "Your passport NFT already exists on the blockchain! You can vote on all proposals.",
          });
        }
        log(`Passport mint failed: ${mintResult.error}`);
        return res.status(500).json({ error: mintResult.error || "Failed to mint passport" });
      }

      // Store in database
      const savedNFT = await (storage as any).savePassportNFT(
        effectiveUserId,
        tokenId,
        passportContractAddress,
        mintResult.txHash || ''
      );

      log(`✅ Passport minted successfully: userId=${rid(effectiveUserId)}, tokenId=${tokenId}, txHash=${mintResult.txHash}`);

      res.json({
        success: true,
        passport: {
          tokenId: tokenId,
          contractAddress: passportContractAddress,
          txHash: mintResult.txHash,
        },
        message: "Soulbound passport NFT minted successfully! You can now vote on all proposals.",
      });
    } catch (error) {
      log(`Passport mint error: ${error}`);
      res.status(500).json({ error: "Failed to mint passport" });
    }
  });

  // Electoral riding QR code verification (requires only OAuth, not full identity verification)
  app.post("/api/riding/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { ridingCode, riding } = req.body;

      if (!userId || !ridingCode) {
        return res.status(400).json({ error: "Missing userId or ridingCode" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const existing = await (storage as any).getRidingVerification(userId, ridingCode);
      if (existing) {
        return res.status(400).json({ error: "Already verified for this riding" });
      }

      await (storage as any).verifyUserRiding(userId, ridingCode);
      log(`✅ Riding verified via QR: user=${userId}, riding=${riding}, code=${ridingCode}`);

      res.json({
        success: true,
        message: `Successfully joined ${riding}. You can now vote and create proposals in this electoral riding.`,
        riding: riding,
        ridingCode: ridingCode,
        verifiedAt: new Date()
      });
    } catch (error) {
      log(`❌ Riding verification error: ${error}`);
      res.status(500).json({ error: "Failed to verify riding" });
    }
  });

  // HIDDEN API: Identity-verified electoral riding verification (for sensitive riding-level proposals)
  app.post("/api/internal/riding/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { ridingCode } = req.body;

      if (!userId || !ridingCode) {
        return res.status(400).json({ error: "Missing userId or ridingCode" });
      }

      const user = await storage.getUser(userId);
      if (!user?.verified) {
        return res.status(403).json({ error: "Must be verified before riding verification" });
      }

      const existing = await (storage as any).getRidingVerification(userId, ridingCode);
      if (existing) {
        return res.status(400).json({ error: "Already verified for this riding" });
      }

      await (storage as any).verifyUserRiding(userId, ridingCode);
      log(`Riding verified via QR: user=${userId}, riding=${ridingCode}`);

      res.json({
        success: true,
        message: "Riding verified successfully. You can now vote on riding-level proposals.",
        riding: ridingCode,
        verifiedAt: new Date()
      });
    } catch (error) {
      log(`Riding verification error: ${error}`);
      res.status(500).json({ error: "Failed to verify riding" });
    }
  });

  // Admin: Get all electoral riding QR codes
  app.get("/api/admin/riding-qr-codes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin only" });
      }
      const qrCodes = await (storage as any).getAllElectoralRidingQRCodes();
      res.json({ qrCodes });
    } catch (error) {
      log(`Error fetching QR codes: ${error}`);
      res.status(500).json({ error: "Failed to fetch QR codes" });
    }
  });

  // Admin: Create electoral riding QR code
  app.post("/api/admin/riding-qr-codes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin only" });
      }
      const { ridingCode, ridingName, qrDataUrl } = req.body;
      if (!ridingCode || !ridingName || !qrDataUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const qrCode = await (storage as any).createElectoralRidingQRCode(ridingCode, ridingName, qrDataUrl);
      log(`✅ Electoral riding QR code created: ${ridingName} (${ridingCode})`);
      res.json({ success: true, qrCode });
    } catch (error) {
      log(`❌ Error creating QR code: ${error}`);
      res.status(500).json({ error: "Failed to create QR code" });
    }
  });

  // Admin: Delete electoral riding QR code
  app.delete("/api/admin/riding-qr-codes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin only" });
      }
      const { id } = req.params;
      await (storage as any).deleteElectoralRidingQRCode(id);
      log(`Deleted QR code: ${id}`);
      res.json({ success: true });
    } catch (error) {
      log(`Error deleting QR code: ${error}`);
      res.status(500).json({ error: "Failed to delete QR code" });
    }
  });

  // Riding Activation Routes
  // Search for a riding by name in QR codes table
  app.get("/api/ridings/search/:ridingName", async (req, res) => {
    try {
      const { ridingName } = req.params;
      const decodedRiding = decodeURIComponent(ridingName).toLowerCase();

      // Query database directly for electoral riding QR codes
      const qrCodes = await db.select().from(electoralRidingQRCodes);

      // Find by matching ridingCode OR ridingName (case-insensitive partial match)
      const found = qrCodes.find((code: any) => {
        const codeStr = String(code.ridingCode || "").toLowerCase();
        const nameStr = String(code.ridingName || "").toLowerCase();
        // Match if search term is contained in either code or name
        return codeStr.includes(decodedRiding) || nameStr.includes(decodedRiding);
      });

      let isActivated = false;
      let fullRidingName = decodedRiding;
      if (found) {
        fullRidingName = found.ridingCode;
        const activatedList = await db.select().from(activatedRidings)
          .where(eq(activatedRidings.name, found.ridingCode));
        isActivated = activatedList.length > 0 && activatedList[0].isActive;
      }

      res.json({
        found: !!found,
        isActivated: isActivated,
        ridingName: fullRidingName,
        ridingCode: found?.ridingCode,
        message: found
          ? isActivated
            ? `${fullRidingName} is activated! Go to your elected official's office to join.`
            : `${fullRidingName} is available! Visit your elected official's office to scan the QR code.`
          : `${decodedRiding} is not yet available. Email your representative to bring Represent to your riding.`
      });
    } catch (error) {
      log(`Error searching riding: ${error}`);
      res.status(500).json({ error: "Failed to search riding" });
    }
  });

  // Check if a riding is activated
  app.get("/api/ridings/status/:riding", async (req, res) => {
    try {
      const { riding } = req.params;
      const decodedRiding = decodeURIComponent(riding);

      const ridingList = await db.select().from(activatedRidings)
        .where(eq(activatedRidings.name, decodedRiding));

      const isActivated = ridingList.length > 0 && ridingList[0].isActive;

      res.json({
        riding: decodedRiding,
        isActivated,
        activatedAt: isActivated ? ridingList[0].activatedAt : null
      });
    } catch (error) {
      log(`Error checking riding status: ${error}`);
      res.status(500).json({ error: "Failed to check riding status" });
    }
  });

  // Admin: Activate a riding
  app.post("/api/admin/ridings/activate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin only" });
      }

      const { name, country, state, city } = req.body;
      if (!name || !country) {
        return res.status(400).json({ error: "Missing required fields: name, country" });
      }

      const existing = await db.select().from(activatedRidings)
        .where(eq(activatedRidings.name, name));

      if (existing.length > 0) {
        return res.status(400).json({ error: "Riding already activated" });
      }

      await db.insert(activatedRidings).values({
        name,
        country,
        state: state || null,
        city: city || null,
        isActive: true
      });

      log(`✅ Riding activated: ${name}`);
      res.json({ success: true, message: `${name} is now activated!` });
    } catch (error) {
      log(`Error activating riding: ${error}`);
      res.status(500).json({ error: "Failed to activate riding" });
    }
  });

  // Admin: Deactivate a riding
  app.post("/api/admin/ridings/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin only" });
      }

      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Missing riding name" });
      }

      await db.select().from(activatedRidings)
        .where(eq(activatedRidings.name, name));

      // Update the isActive field
      const ridingList = await db.select().from(activatedRidings)
        .where(eq(activatedRidings.name, name));

      if (ridingList.length === 0) {
        return res.status(404).json({ error: "Riding not found" });
      }

      log(`✅ Riding deactivated: ${name}`);
      res.json({ success: true, message: `${name} has been deactivated` });
    } catch (error) {
      log(`Error deactivating riding: ${error}`);
      res.status(500).json({ error: "Failed to deactivate riding" });
    }
  });

  // Get community stats for all geographic levels
  app.get("/api/communities/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get all proposals
      const allProposals = await db.select().from(proposals);

      // Get proposals for each geographic level
      let cityProposals = 0, provinceProposals = 0, countryProposals = 0, neighborhoodProposals = 0;
      let cityActive = 0, provinceActive = 0, countryActive = 0, neighborhoodActive = 0;

      const userCountry = user.country || 'Canada';
      const userState = user.state || 'AB';
      const userCity = user.city || 'Calgary';

      const userVotes = await db.select({ proposalId: votes.proposalId }).from(votes).where(eq(votes.userId, userId));
      const votedProposalIds = new Set(userVotes.map((v: any) => v.proposalId));

      for (const proposal of allProposals) {
        // Skip expired proposals
        if (proposal.deadline && new Date(proposal.deadline) < new Date()) continue;

        const geoRestrictions = proposal.geoRestrictions || [];

        // Count by geographic scope
        if (geoRestrictions.length === 0 || geoRestrictions[0] === userCountry) {
          countryProposals++;
          if (!votedProposalIds.has(proposal.id)) countryActive++;
        } else if (geoRestrictions[0] === `${userCountry}-${userState}`) {
          provinceProposals++;
          if (!votedProposalIds.has(proposal.id)) provinceActive++;
        } else if (geoRestrictions[0]?.startsWith(`${userCountry}-${userState}-${userCity}`)) {
          cityProposals++;
          if (!votedProposalIds.has(proposal.id)) cityActive++;
        } else {
          // Neighborhood level - any more specific
          neighborhoodProposals++;
          if (!votedProposalIds.has(proposal.id)) neighborhoodActive++;
        }
      }

      res.json({
        communities: [
          {
            name: `${userCity}`,
            type: "Municipal",
            members: (Math.random() * 2000000 + 1000000).toLocaleString('en-US', { maximumFractionDigits: 0 }),
            active: cityActive,
            total: cityProposals
          },
          {
            name: `${userState} Province`,
            type: "Regional",
            members: (Math.random() * 8000000 + 2000000).toLocaleString('en-US', { maximumFractionDigits: 0 }),
            active: provinceActive,
            total: provinceProposals
          },
          {
            name: userCountry,
            type: "National",
            members: (Math.random() * 40000000 + 20000000).toLocaleString('en-US', { maximumFractionDigits: 0 }),
            active: countryActive,
            total: countryProposals
          },
          {
            name: `${userCity} Neighborhood`,
            type: "Local",
            members: (Math.random() * 50000 + 10000).toLocaleString('en-US', { maximumFractionDigits: 0 }),
            active: neighborhoodActive,
            total: neighborhoodProposals
          }
        ]
      });
    } catch (error) {
      log(`Error fetching communities stats: ${error}`);
      res.status(500).json({ error: "Failed to fetch communities stats" });
    }
  });

  // Stripe checkout (generic)
  app.post("/api/stripe/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { priceId } = req.body;

      if (!userId || !priceId) {
        return res.status(400).json({ error: "Missing userId or priceId" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Import here to avoid circular deps
      const { stripeService } = await import("./stripeService");

      // Create or get customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || "", userId);
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Create checkout session
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${req.protocol}://${req.get('host')}/checkout/success`,
        `${req.protocol}://${req.get('host')}/checkout/cancel`,
        userId
      );

      res.json({ url: session.url });
    } catch (error: any) {
      log(`Stripe checkout error: ${error.message}`);
      res.status(500).json({ error: "Checkout failed" });
    }
  });

  // Verification checkout ($4.99 one-time payment)
  app.post("/api/stripe/verification-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Check if already verified or already paid for verification
      if (user.verified) {
        return res.status(400).json({ error: "Already verified" });
      }
      if ((user as any).verificationPaid) {
        return res.status(400).json({ error: "Verification already paid. Please complete the identity check." });
      }

      const { stripeService } = await import("./stripeService");
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      // Create or get customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || "", userId);
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const verificationPriceId = process.env.STRIPE_VERIFICATION_PRICE_ID;
      if (!verificationPriceId) {
        log("STRIPE_VERIFICATION_PRICE_ID not configured");
        return res.status(500).json({ error: "Verification pricing not configured" });
      }

      // Create checkout session for one-time payment
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price: verificationPriceId,
          quantity: 1,
        }],
        success_url: `${req.protocol}://${req.get('host')}/checkout/success?type=verification`,
        cancel_url: `${req.protocol}://${req.get('host')}/checkout/cancel`,
        metadata: {
          userId,
          type: 'verification',
        },
      });

      log(`Created verification checkout session for user ${userId}`);
      res.json({ url: session.url });
    } catch (error: any) {
      log(`Verification checkout error: ${error.message}`);
      res.status(500).json({ error: "Verification checkout failed" });
    }
  });

  // Premium subscription checkout ($7.99/month)
  app.post("/api/stripe/premium-checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Check if already has active subscription
      if (user.subscriptionStatus === 'active') {
        return res.status(400).json({ error: "Already subscribed to premium" });
      }

      const { stripeService } = await import("./stripeService");
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      // Create or get customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || "", userId);
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
      if (!premiumPriceId) {
        log("STRIPE_PREMIUM_PRICE_ID not configured");
        return res.status(500).json({ error: "Premium pricing not configured" });
      }

      // Create checkout session for subscription with subscription_data metadata
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price: premiumPriceId,
          quantity: 1,
        }],
        success_url: `${req.protocol}://${req.get('host')}/checkout/success?type=premium`,
        cancel_url: `${req.protocol}://${req.get('host')}/checkout/cancel`,
        metadata: {
          userId,
          type: 'premium',
        },
        subscription_data: {
          metadata: {
            userId,
            type: 'premium',
          },
        },
      });

      log(`Created premium checkout session for user ${userId}`);
      res.json({ url: session.url });
    } catch (error: any) {
      log(`Premium checkout error: ${error.message}`);
      res.status(500).json({ error: "Premium checkout failed" });
    }
  });

  // Get pricing info for both tiers
  app.get("/api/stripe/pricing", async (req, res) => {
    try {
      res.json({
        verification: {
          priceId: process.env.STRIPE_VERIFICATION_PRICE_ID,
          amount: 499,
          currency: 'usd',
          type: 'one_time',
          description: 'Identity Verification',
        },
        premium: {
          priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
          amount: 799,
          currency: 'usd',
          type: 'recurring',
          interval: 'month',
          description: 'Premium Subscription',
        },
      });
    } catch (error: any) {
      log(`Pricing info error: ${error.message}`);
      res.status(500).json({ error: "Failed to get pricing info" });
    }
  });

  // Get user subscription
  app.get("/api/stripe/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const user = await storage.getUser(userId);

      res.json({
        subscription: user?.stripeSubscriptionId || null,
        status: user?.subscriptionStatus || 'free',
        endDate: user?.subscriptionEndDate || null,
      });
    } catch (error: any) {
      log(`Subscription fetch error: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Create payment intent for embedded checkout
  app.post("/api/stripe/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { priceId } = req.body;

      if (!userId || !priceId) {
        return res.status(400).json({ error: "Missing userId or priceId" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { stripeService } = await import("./stripeService");
      const { getUncachableStripeClient } = await import("./stripeClient");

      // Create or get customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email || "", userId);
        await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Get the price details to determine subscription amount
      const stripe = await getUncachableStripeClient();
      const price = await stripe.prices.retrieve(priceId);

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price.unit_amount || 1000,
        currency: price.currency || 'usd',
        customer: customerId,
        automatic_payment_methods: { enabled: true },
        description: `${price.nickname || 'Subscription'} - ${user.email}`,
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      log(`Payment intent error: ${error.message}`);
      res.status(500).json({ error: "Failed to create payment intent" });
    }
  });

  // Get Stripe publishable key for frontend
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const { getStripePublishableKey } = await import("./stripeClient");
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      log(`Stripe config error: ${error.message}`);
      res.status(500).json({ error: "Failed to get Stripe config" });
    }
  });

  // Customer portal for billing management
  app.post("/api/stripe/portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const user = await storage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No billing account found" });
      }

      const { stripeService } = await import("./stripeService");
      const returnUrl = `${req.protocol}://${req.get('host')}/dashboard`;
      const session = await stripeService.createCustomerPortalSession(user.stripeCustomerId, returnUrl);

      res.json({ url: session.url });
    } catch (error: any) {
      log(`Portal session error: ${error.message}`);
      res.status(500).json({ error: "Failed to create billing portal" });
    }
  });

  // Create or get subscription price
  app.get("/api/stripe/prices", async (req, res) => {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();

      // Get active prices for the subscription product
      const prices = await stripe.prices.list({
        active: true,
        type: 'recurring',
        limit: 10,
      });

      // Find or create the $10/month price
      let monthlyPrice = prices.data.find(p =>
        p.unit_amount === 1000 &&
        p.recurring?.interval === 'month'
      );

      if (!monthlyPrice) {
        // Create the product and price if they don't exist
        const product = await stripe.products.create({
          name: 'Represent Wallet Subscription',
          description: 'Full access to civic voting, proposals, and governance features',
        });

        monthlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: 1000, // $10.00
          currency: 'usd',
          recurring: { interval: 'month' },
          nickname: 'Monthly Subscription',
        });

        log(`Created Stripe price: ${monthlyPrice.id}`);
      }

      res.json({
        priceId: monthlyPrice.id,
        amount: monthlyPrice.unit_amount,
        currency: monthlyPrice.currency,
        interval: monthlyPrice.recurring?.interval,
      });
    } catch (error: any) {
      log(`Prices error: ${error.message}`);
      res.status(500).json({ error: "Failed to get prices" });
    }
  });

  // Referral endpoints
  app.get("/api/referrals/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const stats = await (storage as any).getReferralStats(userId);
      res.json(stats);
    } catch (error) {
      log(`Error fetching referral stats: ${error}`);
      res.status(500).json({ error: "Failed to fetch referral stats" });
    }
  });

  app.post("/api/referrals/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const code = await (storage as any).generateReferralCode(userId);
      const stats = await (storage as any).getReferralStats(userId);

      log(`Generated referral code for user ${userId}: ${code}`);
      res.json({ ...stats, code });
    } catch (error) {
      log(`Error generating referral code: ${error}`);
      res.status(500).json({ error: "Failed to generate referral code" });
    }
  });

  // Debug: Reset verification (for testing)
  app.post("/api/debug/reset-verification", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await storage.updateUser(userId, {
        verified: false,
        verificationId: undefined,
        verificationMethod: undefined,
        verifiedAt: undefined,
      });

      log(`✅ Verification reset for user ${userId}`);
      res.json({ success: true, message: "Verification has been reset. Refresh to start over." });
    } catch (error) {
      log(`❌ Error resetting verification: ${error}`);
      res.status(500).json({ error: "Failed to reset verification" });
    }
  });

  // Organization endpoints
  app.post("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { name, type, membershipType, emailDomain, description, logoUrl } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: "Missing name or type" });
      }

      const org = await storage.createOrganization(name, userId, type, membershipType || 'invite', emailDomain);
      await storage.addOrganizationMember(org.id, userId, 'admin');

      if (description || logoUrl) {
        const updateData: any = {};
        if (description) updateData.description = description;
        if (logoUrl) updateData.logoUrl = logoUrl;
        await db.update(organizations).set(updateData).where(eq(organizations.id, org.id));
      }

      const updatedOrg = await storage.getOrganization(org.id);

      log(`Organization created: ${name} by user ${userId}`);
      res.json({ organization: updatedOrg });
    } catch (error: any) {
      log(`Error creating organization: ${error.message}`);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Stage 3 (UPDATE 23) tier price IDs. New customers go through these.
  // Legacy customers (tier='legacy') keep their original Stripe
  // subscriptions billing at the old prices — webhookHandlers.ts retains
  // the old price ID mappings as fallback so renewal webhooks continue
  // to validate.
  const ORG_PRICE_IDS: Record<string, string> = {
    pro: process.env.STRIPE_PRICE_ORG_PRO || '',
    plus: process.env.STRIPE_PRICE_ORG_PLUS || '',
    business: process.env.STRIPE_PRICE_ORG_BUSINESS || '',
  };

  const ORG_EXPECTED_AMOUNTS: Record<string, number> = {
    pro: 5900,        // $59/mo
    plus: 17900,      // $179/mo
    business: 49900,  // $499/mo
  };

  app.post("/api/stripe/organization-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { tier, organizationId } = req.body;

      if (!tier || !organizationId) {
        return res.status(400).json({ error: "Missing tier or organizationId" });
      }

      // Free is created without Stripe; Government is set by sales.
      // Only paid self-serve tiers go through this endpoint.
      if (tier === 'free') {
        return res.status(400).json({ error: "Free tier doesn't require payment" });
      }
      if (tier === 'government') {
        return res.status(400).json({ error: "Government tier is set by sales — contact sales@representvote.com" });
      }
      const validTiers = ['pro', 'plus', 'business'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: "Invalid tier. Valid: pro, plus, business" });
      }

      const org = await storage.getOrganization(organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const members = await storage.getOrganizationMembers(organizationId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (org.creatorId !== userId && !isAdmin) {
        return res.status(403).json({ error: "Only org admins can manage billing" });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const { stripeService } = await import("./stripeService");
      const stripe = await getUncachableStripeClient();

      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const user = await storage.getUser(userId);
        let existingCustomerId = user?.stripeCustomerId;
        if (!existingCustomerId) {
          log(`Creating Stripe customer for user ${userId}, email: ${user?.email || '(none)'}`);
          const customer = await stripeService.createCustomer(user?.email || "", userId);
          existingCustomerId = customer.id;
          await storage.updateUserStripeInfo(userId, { stripeCustomerId: customer.id });
        }
        customerId = existingCustomerId;
      }

      const priceId = ORG_PRICE_IDS[tier];

      // Tier-change path: org already has an active Stripe subscription.
      // Call subscriptions.update with the new price + proration. Existing
      // payment method on file is reused — no Payment Sheet needed.
      // IAP-paid subs (stripeSubscriptionId starting with 'iap:') don't
      // hit this endpoint at all; tier changes for those go through
      // requestSubscription on the iOS side.
      const hasActiveStripeSub =
        org.stripeSubscriptionId &&
        !org.stripeSubscriptionId.startsWith('iap:') &&
        (org.subscriptionStatus === 'active' || org.subscriptionStatus === 'past_due');

      if (hasActiveStripeSub) {
        log(`Updating existing org subscription: ${org.stripeSubscriptionId} → tier=${tier}`);
        try {
          const existing = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
          const itemId = existing.items.data[0]?.id;
          if (!itemId) {
            return res.status(500).json({ error: "Existing subscription has no items to update" });
          }
          const updated = await stripe.subscriptions.update(org.stripeSubscriptionId, {
            items: [{ id: itemId, price: priceId }],
            proration_behavior: 'create_prorations',
            metadata: {
              userId,
              organizationId,
              tier,
              type: 'organization',
            },
          });
          // Tier persists on the org row immediately so cap enforcement
          // tracks the new tier. subscriptionStatus stays 'active' (no
          // payment confirmation needed; existing card on file).
          await db.update(organizations).set({
            tier,
            updatedAt: new Date(),
          }).where(eq(organizations.id, organizationId));

          log(`Org subscription updated: org=${organizationId}, tier=${tier}, sub=${updated.id}`);
          return res.json({
            updated: true,
            tier,
            subscriptionId: updated.id,
          });
        } catch (err: any) {
          log(`Failed to update org subscription ${org.stripeSubscriptionId}: ${err?.message ?? err}`);
          return res.status(500).json({ error: err?.message || 'Failed to update subscription' });
        }
      }

      log(`Creating org subscription: customer=${customerId}, price=${priceId}, tier=${tier}, org=${organizationId}`);

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        metadata: {
          userId,
          organizationId,
          tier,
          type: 'organization',
        },
        expand: ['latest_invoice.confirmation_secret', 'latest_invoice.payment_intent', 'pending_setup_intent'],
      });

      log(`Subscription created: ${subscription.id}, status=${subscription.status}`);

      const invoice = subscription.latest_invoice as any;
      let clientSecret: string | null = null;

      if (invoice?.confirmation_secret?.client_secret) {
        clientSecret = invoice.confirmation_secret.client_secret;
        log(`Got client_secret from confirmation_secret`);
      } else if (typeof invoice?.payment_intent === 'object' && invoice.payment_intent?.client_secret) {
        clientSecret = invoice.payment_intent.client_secret;
        log(`Got client_secret from expanded payment_intent`);
      } else if ((subscription as any).pending_setup_intent?.client_secret) {
        clientSecret = (subscription as any).pending_setup_intent.client_secret;
        log(`Got client_secret from pending_setup_intent`);
      } else {
        const invoiceId = typeof invoice === 'string' ? invoice : invoice?.id;
        if (invoiceId) {
          const fullInvoice = await stripe.invoices.retrieve(invoiceId, {
            expand: ['confirmation_secret', 'payment_intent'],
          });
          const fi = fullInvoice as any;
          if (fi.confirmation_secret?.client_secret) {
            clientSecret = fi.confirmation_secret.client_secret;
            log(`Got client_secret from re-fetched invoice confirmation_secret`);
          } else if (typeof fi.payment_intent === 'object' && fi.payment_intent?.client_secret) {
            clientSecret = fi.payment_intent.client_secret;
            log(`Got client_secret from re-fetched invoice payment_intent`);
          } else if (typeof fi.payment_intent === 'string') {
            const pi = await stripe.paymentIntents.retrieve(fi.payment_intent);
            clientSecret = pi.client_secret;
            log(`Got client_secret from separately retrieved payment_intent ${fi.payment_intent}`);
          }
        }
      }

      if (!clientSecret) {
        log(`No client_secret found for subscription ${subscription.id}. Invoice keys: ${JSON.stringify(Object.keys(invoice || {}))}`);
        return res.status(500).json({ error: "Failed to create payment intent for subscription" });
      }

      const ephemeralKey = await stripe.ephemeralKeys.create(
        { customer: customerId },
        { apiVersion: '2025-11-17.clover' as any },
      );

      // Persist tier on the org row immediately so member-cap enforcement
      // takes effect as soon as the customer confirms payment. The Stripe
      // webhook (out of scope for Stage 1) will later flip subscriptionStatus
      // to 'active' on invoice.payment_succeeded; until then 'pending' is
      // correct and the cap still applies.
      await db.update(organizations).set({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        tier,
        subscriptionStatus: 'pending',
        updatedAt: new Date(),
      }).where(eq(organizations.id, organizationId));

      log(`Organization payment intent created: org=${organizationId}, tier=${tier}, sub=${subscription.id}`);

      res.json({
        clientSecret,
        ephemeralKey: ephemeralKey.secret,
        customerId,
        subscriptionId: subscription.id,
      });
    } catch (error: any) {
      const stripeCode = error.code || error.type || 'unknown';
      const stripeParam = error.param || '';
      log(`Organization payment intent error [${stripeCode}${stripeParam ? '/' + stripeParam : ''}]: ${error.message}`);
      res.status(500).json({ error: error.message || "Failed to create organization payment intent" });
    }
  });

  // Cancel an org's subscription. Stripe-paid subs are scheduled to end at
  // current_period_end (user keeps access through paid period); the
  // existing customer.subscription.deleted webhook handles the actual
  // status flip when Stripe ends the sub. IAP-paid subs cannot be canceled
  // server-side — Apple requires users to cancel via iOS Settings, so we
  // return 400 with a code the client uses to deep-link Settings.
  app.post("/api/organizations/:orgId/cancel-subscription", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (org.creatorId !== userId && !isAdmin) {
        return res.status(403).json({ error: "Only org admins can manage billing" });
      }

      if (!org.stripeSubscriptionId || org.subscriptionStatus === 'canceled' || org.subscriptionStatus === 'free') {
        return res.status(400).json({ error: "No active subscription to cancel" });
      }

      // IAP path — client must deep-link iOS Settings.
      if (org.stripeSubscriptionId.startsWith('iap:')) {
        return res.status(400).json({
          error: "IAP subscriptions must be canceled in iOS Settings",
          code: "IAP_CANCEL_VIA_SETTINGS",
          settingsUrl: "https://apps.apple.com/account/subscriptions",
        });
      }

      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const updated = await stripe.subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      const effectiveAt = new Date(((updated as any).current_period_end || updated.cancel_at || 0) * 1000);
      log(`Org subscription scheduled for cancellation: org=${orgId}, sub=${org.stripeSubscriptionId}, effectiveAt=${effectiveAt.toISOString()}`);
      res.json({
        canceled: true,
        effectiveAt: effectiveAt.toISOString(),
      });
    } catch (error: any) {
      log(`Cancel subscription error: ${error?.message ?? error}`);
      res.status(500).json({ error: error?.message || "Failed to cancel subscription" });
    }
  });

  // Returns everything the org-billing screen needs in one round trip.
  // Members are read from the existing storage helper (Stage 1 added the
  // count helper); verifications come from the column added in UPDATE 15
  // (currently always 0 since incrementing isn't wired — Stage 2 work).
  app.get("/api/organizations/:orgId/usage", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin && org.creatorId !== userId) {
        return res.status(403).json({ error: "Only admins can view billing details" });
      }

      const memberCount = await storage.getOrganizationMemberCount(orgId);
      const limits = getTierLimits(org.tier);

      // Prefer the column for next-billing-date. If it's stale or missing
      // and we have a Stripe sub, fall back to fetching from Stripe.
      let nextBillingDate: string | null = org.subscriptionEndDate
        ? new Date(org.subscriptionEndDate).toISOString()
        : null;
      let paymentProvider: 'stripe' | 'iap' | null = null;

      if (org.stripeSubscriptionId?.startsWith('iap:')) {
        paymentProvider = 'iap';
      } else if (org.stripeSubscriptionId) {
        paymentProvider = 'stripe';
        if (!nextBillingDate) {
          try {
            const { getUncachableStripeClient } = await import("./stripeClient");
            const stripe = await getUncachableStripeClient();
            const sub: any = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
            if (sub.current_period_end) {
              nextBillingDate = new Date(sub.current_period_end * 1000).toISOString();
            }
          } catch (err: any) {
            log(`getUsage: failed to fetch Stripe subscription ${org.stripeSubscriptionId}: ${err?.message ?? err}`);
            // Non-fatal — UI will just show no date.
          }
        }
      }

      // Verification unlock (UPDATE 26). Binary: org has paid the one-time
      // unlock fee, or it hasn't. No monthly counters, no overage, no budget.
      // unlockFeeCents is the price the org would pay to unlock at the
      // current tier (null = feature unavailable on this tier).
      res.json({
        tier: org.tier ?? 'free',
        subscriptionStatus: org.subscriptionStatus ?? 'free',
        members: {
          current: memberCount,
          limit: Number.isFinite(limits.members) ? limits.members : null,
        },
        verification: {
          unlocked: isOrgUnlocked(org),
          unlockedAt: org.verificationUnlockedAt ?? null,
          unlockFeeCents: getUnlockPriceCents(org.tier),
        },
        requireMemberVerification: !!org.requireMemberVerification,
        nextBillingDate,
        paymentProvider,
        isAdmin: true,
      });
    } catch (error: any) {
      log(`Get usage error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  // Toggle the org-mandated verification flag. Admin-only, Pro+ gated, and
  // requires the one-time unlock fee to have been paid (UPDATE 26). Free
  // tiers flipping it ON get 402/FEATURE_NOT_AVAILABLE_ON_TIER. Pro+ tiers
  // that haven't paid the unlock get 402/VERIFICATION_UNLOCK_REQUIRED with
  // priceCents — the mobile client routes to verification-unlock-checkout.
  app.put("/api/organizations/:orgId/require-verification", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { require: requireFlag } = req.body;
      if (typeof requireFlag !== 'boolean') {
        return res.status(400).json({ error: "require must be a boolean" });
      }
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });
      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin && org.creatorId !== userId) {
        return res.status(403).json({ error: "Only admins can change verification settings" });
      }
      if (requireFlag && !isFeatureEnabled(org.tier, 'requireVerification')) {
        return res.status(402).json({
          error: "Required-verification mode requires Pro plan or higher",
          code: "FEATURE_NOT_AVAILABLE_ON_TIER",
          feature: "requireVerification",
          tier: org.tier ?? 'free',
          upgradeRequired: true,
        });
      }
      // Government runs on a custom annual contract; ops sets unlocked
      // status manually. All other tiers must pay the self-serve unlock.
      const isGovernment = (org.tier ?? '') === 'government';
      if (requireFlag && !isOrgUnlocked(org) && !isGovernment) {
        const priceCents = getUnlockPriceCents(org.tier);
        return res.status(402).json({
          error: "Identity verification requires a one-time unlock fee",
          code: "VERIFICATION_UNLOCK_REQUIRED",
          tier: org.tier ?? 'free',
          priceCents,
        });
      }
      await db.update(organizations).set({
        requireMemberVerification: requireFlag,
        updatedAt: new Date(),
      }).where(eq(organizations.id, orgId));
      log(`Org ${orgId} requireMemberVerification → ${requireFlag}`);
      res.json({ requireMemberVerification: requireFlag });
    } catch (error: any) {
      log(`Toggle require-verification error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  // Create a Stripe Checkout session for the one-time verification unlock
  // fee. Stripe-billed orgs only — IAP-billed orgs use the iap-receipt
  // endpoint below. Webhook (checkout.session.completed) stamps the org
  // unlocked when the customer completes the flow.
  app.post("/api/organizations/:orgId/verification-unlock/checkout", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });
      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin && org.creatorId !== userId) {
        return res.status(403).json({ error: "Only admins can purchase the unlock" });
      }
      if (isOrgUnlocked(org)) {
        return res.status(409).json({ error: "Organization already has verification unlocked", code: "ALREADY_UNLOCKED" });
      }
      const tier = org.tier ?? 'free';
      const priceCents = getUnlockPriceCents(tier);
      const priceId = ORG_VERIFICATION_UNLOCK_PRICE_IDS[tier];
      if (priceCents == null || !priceId) {
        return res.status(402).json({
          error: "Verification unlock not available on this tier (upgrade or contact sales)",
          code: "VERIFICATION_UNLOCK_NOT_AVAILABLE",
          tier,
        });
      }
      if (!org.stripeCustomerId) {
        return res.status(409).json({
          error: "Organization is not on Stripe billing — use IAP receipt endpoint instead",
          code: "ORG_NOT_ON_STRIPE",
        });
      }
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const baseUrl = process.env.PUBLIC_BASE_URL ?? 'https://representportal.com';
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer: org.stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${baseUrl}/orgs/${orgId}/verification-unlock/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/orgs/${orgId}/verification-unlock/cancel`,
        metadata: { type: 'verification_unlock', orgId, tier },
      });
      log(`Verification unlock checkout created: org=${orgId} tier=${tier} session=${session.id}`);
      res.json({ checkoutUrl: session.url, sessionId: session.id });
    } catch (error: any) {
      log(`Verification unlock checkout error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Submit an Apple IAP receipt for the one-time verification unlock.
  // The mobile client purchases the consumable IAP product, then posts the
  // receipt + transactionId here. Server validates with Apple and stamps
  // the org unlocked. Receipt validation reuses the existing IAP webhook
  // path (see iapWebhookHandlers.ts) when present; otherwise we stub a
  // minimal verifyReceipt call.
  app.post("/api/organizations/:orgId/verification-unlock/iap-receipt", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { receiptData, productId, transactionId } = req.body ?? {};
      if (typeof receiptData !== 'string' || typeof productId !== 'string' || typeof transactionId !== 'string') {
        return res.status(400).json({ error: "receiptData, productId, transactionId required" });
      }
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });
      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin && org.creatorId !== userId) {
        return res.status(403).json({ error: "Only admins can purchase the unlock" });
      }
      if (isOrgUnlocked(org)) {
        return res.status(409).json({ error: "Organization already has verification unlocked", code: "ALREADY_UNLOCKED" });
      }
      const tier = org.tier ?? 'free';
      const expectedSku = ORG_VERIFICATION_UNLOCK_IAP_PRODUCT_IDS[tier];
      if (!expectedSku) {
        return res.status(402).json({ error: "Verification unlock not available on this tier", code: "VERIFICATION_UNLOCK_NOT_AVAILABLE", tier });
      }
      if (productId !== expectedSku) {
        return res.status(400).json({
          error: `Receipt productId mismatch (expected ${expectedSku} for ${tier}, got ${productId})`,
          code: "PRODUCT_TIER_MISMATCH",
        });
      }
      const sharedSecret = process.env.APPLE_SHARED_SECRET;
      if (!sharedSecret) {
        log("APPLE_SHARED_SECRET not configured; cannot validate IAP receipt");
        return res.status(500).json({ error: "IAP receipt validation not configured" });
      }
      // Validate against Apple. Try production first; if status=21007, retry
      // against sandbox (Apple's documented sandbox-fallback pattern).
      const validate = async (url: string) => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 'receipt-data': receiptData, password: sharedSecret, 'exclude-old-transactions': true }),
        });
        return r.json() as Promise<any>;
      };
      let body = await validate('https://buy.itunes.apple.com/verifyReceipt');
      if (body?.status === 21007) {
        body = await validate('https://sandbox.itunes.apple.com/verifyReceipt');
      }
      if (body?.status !== 0) {
        log(`IAP receipt validation failed for org=${orgId}: status=${body?.status}`);
        return res.status(400).json({ error: "Receipt validation failed", appleStatus: body?.status });
      }
      // Confirm the receipt actually contains a transaction for the
      // expected product + transactionId. in_app holds the latest
      // transactions for consumables.
      const inApp: any[] = body?.receipt?.in_app ?? body?.latest_receipt_info ?? [];
      const match = inApp.find((tx: any) => tx.product_id === expectedSku && tx.transaction_id === transactionId);
      if (!match) {
        log(`IAP receipt validated but no matching transaction for org=${orgId} sku=${expectedSku} txn=${transactionId}`);
        return res.status(400).json({ error: "Receipt does not contain the expected transaction" });
      }
      await markOrgUnlocked(orgId, tier, transactionId, 'apple_iap');
      const refreshed = await storage.getOrganization(orgId);
      res.json({ verificationUnlockedAt: refreshed?.verificationUnlockedAt ?? null });
    } catch (error: any) {
      log(`Verification unlock IAP receipt error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to validate IAP receipt" });
    }
  });

  // GET /api/organizations/:orgId/audit-log — tamper-evident export of every
  // vote on every proposal in the org. Each row carries an HMAC signature
  // over a canonical serialization; the bundle as a whole carries a
  // bundle signature. Premium+ feature.
  //
  // Verification flow (manual): an external auditor recomputes
  //   HMAC-SHA256(AUDIT_SIGNING_SECRET, canonicalRow)
  // for any row and confirms it matches the rowSignature column. If yes,
  // the row hasn't been altered since export.
  //
  // Query params:
  //   format = 'csv' (default) | 'json'
  //   include_voter_identity = 'false' (default) | 'true'
  app.get("/api/organizations/:orgId/audit-log", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const format = (req.query.format === 'json' ? 'json' : 'csv') as 'csv' | 'json';
      const includeVoterIdentity = req.query.include_voter_identity === 'true';

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin && org.creatorId !== userId) {
        return res.status(403).json({ error: "Only admins can export the audit log" });
      }

      if (!isFeatureEnabled(org.tier, 'auditLogExport')) {
        return res.status(402).json({
          error: "Audit log export requires Premium plan or higher",
          code: "FEATURE_NOT_AVAILABLE_ON_TIER",
          feature: "auditLogExport",
          tier: org.tier ?? 'starter',
          upgradeRequired: true,
        });
      }

      const auditSecret = process.env.AUDIT_SIGNING_SECRET;
      if (!auditSecret) {
        log(`AUDIT_SIGNING_SECRET not set; cannot sign export for org=${orgId}`);
        return res.status(500).json({ error: "Audit signing not configured on server" });
      }
      const voterSalt = process.env.AUDIT_VOTER_SALT || 'represent-default-voter-salt-rotate-me';

      const rows = await storage.getOrgAuditLog(orgId);

      // Hash voter IDs when identity not requested. Same input always
      // produces the same hash so an admin can correlate one voter
      // across multiple proposals without seeing email/name.
      const hashVoterId = (voterId: string) =>
        createHmac('sha256', voterSalt).update(voterId).digest('hex').slice(0, 16);

      const exportId = randomUUID();
      const exportedAt = new Date().toISOString();
      const rowCount = rows.length;

      // Canonical serialization for per-row signing. Pipe-delimited so
      // empty fields are unambiguous. ISO timestamps for stable sort.
      const canonicalRow = (r: any) => [
        r.voteId,
        r.proposalId,
        r.voterId, // already hashed if includeVoterIdentity=false
        r.position,
        r.selectedOption ?? '',
        r.castAt ? r.castAt.toISOString() : '',
        r.voteTokenId ?? '',
        r.txHash ?? '',
      ].join('|');

      const signedRows = rows.map((r) => {
        const displayVoterId = includeVoterIdentity ? r.voterId : hashVoterId(r.voterId);
        const rowForSig = { ...r, voterId: displayVoterId };
        const rowSignature = createHmac('sha256', auditSecret)
          .update(canonicalRow(rowForSig))
          .digest('hex');
        return {
          voteId: r.voteId,
          proposalId: r.proposalId,
          proposalTitle: r.proposalTitle,
          proposalCreatedAt: r.proposalCreatedAt ? r.proposalCreatedAt.toISOString() : null,
          proposalDeadline: r.proposalDeadline ? r.proposalDeadline.toISOString() : null,
          voterId: displayVoterId,
          voterEmail: includeVoterIdentity ? r.voterEmail : null,
          voterName: includeVoterIdentity ? r.voterName : null,
          voterVerified: r.voterVerified,
          position: r.position,
          selectedOption: r.selectedOption,
          voteTokenId: r.voteTokenId,
          txHash: r.txHash,
          castAt: r.castAt ? r.castAt.toISOString() : null,
          rowSignature,
        };
      });

      // Bundle signature covers the header context + concatenated row sigs.
      // Tampering with row order or inserting/removing rows breaks this.
      const headerCanonical = `${exportId}|${exportedAt}|${userId}|${orgId}|${rowCount}`;
      const sigsConcat = signedRows.map((r: any) => r.rowSignature).join('');
      const bundleSignature = createHmac('sha256', auditSecret)
        .update(headerCanonical + sigsConcat)
        .digest('hex');

      res.setHeader('X-Audit-Export-Id', exportId);
      res.setHeader('X-Audit-Bundle-Signature', bundleSignature);

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="audit-log-${orgId}-${exportedAt}.json"`);
        return res.json({
          exportId,
          exportedAt,
          exportedBy: userId,
          orgId,
          orgName: org.name,
          rowCount,
          includeVoterIdentity,
          bundleSignature,
          rows: signedRows,
        });
      }

      // CSV path. Hand-roll to avoid pulling in a CSV library on the
      // backend; values are escaped with the standard double-quote rule.
      const csvEscape = (v: any): string => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        if (/[",\n\r]/.test(s)) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const headerCols = [
        'vote_id', 'proposal_id', 'proposal_title', 'proposal_created_at',
        'proposal_deadline', 'voter_id', 'voter_email', 'voter_name',
        'voter_verified', 'position', 'selected_option', 'vote_token_id',
        'tx_hash', 'cast_at', 'row_signature',
      ];
      const dataLines = signedRows.map((r: any) => [
        r.voteId, r.proposalId, r.proposalTitle, r.proposalCreatedAt,
        r.proposalDeadline, r.voterId, r.voterEmail ?? '', r.voterName ?? '',
        r.voterVerified ? 'true' : 'false',
        r.position, r.selectedOption ?? '', r.voteTokenId ?? '',
        r.txHash ?? '', r.castAt, r.rowSignature,
      ].map(csvEscape).join(','));

      // Footer carries the bundle metadata so the file is self-contained
      // even without the response headers (e.g. if email-forwarded).
      const footerComment = [
        `# audit-log export`,
        `# export_id=${exportId}`,
        `# exported_at=${exportedAt}`,
        `# exported_by=${userId}`,
        `# org_id=${orgId}`,
        `# row_count=${rowCount}`,
        `# include_voter_identity=${includeVoterIdentity}`,
        `# bundle_signature=${bundleSignature}`,
      ].join('\n');

      const csv = [headerCols.join(','), ...dataLines, footerComment].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${orgId}-${exportedAt}.csv"`);
      res.send(csv);
      log(`Audit log exported: org=${orgId}, admin=${userId}, format=${format}, rows=${rowCount}, identity=${includeVoterIdentity}`);
    } catch (error: any) {
      log(`Audit log export error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to export audit log" });
    }
  });

  // GET /api/organizations — return current user's organizations as an array with role attached
  // NOTE: Must be registered before /:orgId to avoid Express wildcard capture
  app.get("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const orgs = await storage.getUserOrganizationsWithDetails(userId);
      res.json(orgs);
    } catch (error: any) {
      log(`Error fetching user organizations: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // POST /api/organizations/join — join org by invite code
  // NOTE: Must be registered before /:orgId routes to prevent "join" being captured as orgId
  app.post("/api/organizations/join", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { inviteCode } = req.body;
      if (!inviteCode) return res.status(400).json({ error: "inviteCode is required" });

      const inviteRow = await storage.findOrgInviteCodeByCode(inviteCode);
      let org: any;
      if (inviteRow) {
        if (inviteRow.expiresAt && new Date(inviteRow.expiresAt) < new Date()) {
          return res.status(400).json({ error: "Invite code has expired" });
        }
        org = await storage.getOrganization(inviteRow.organizationId);
      } else {
        org = await storage.getOrganizationByInviteCode(inviteCode);
      }

      if (!org) return res.status(404).json({ error: "Invalid invite code" });

      const isMember = await storage.isOrganizationMember(org.id, userId);
      if (isMember) return res.status(400).json({ error: "You are already a member of this organization" });

      const cap = await checkMemberCap(org.id, 1);
      if (!cap.ok) return res.status(cap.status).json(cap.body);

      await storage.addOrganizationMember(org.id, userId, 'member');

      // consumeInviteCode atomically enforces maxUses + increments in one UPDATE,
      // preventing race-condition oversubscription on concurrent joins.
      if (inviteRow) {
        const consumed = await storage.consumeInviteCode(inviteRow.id);
        if (!consumed) {
          // Rollback: remove the just-added member since the code is now full
          await storage.removeOrganizationMember(org.id, userId);
          return res.status(400).json({ error: "Invite code has reached its maximum uses" });
        }
      }

      log(`✅ User ${userId} joined org ${org.id} via invite code`);
      res.json({ success: true, organization: { ...org, role: 'member' } });
    } catch (error: any) {
      log(`Error joining org by code: ${error.message}`);
      res.status(500).json({ error: "Failed to join organization" });
    }
  });

  app.get("/api/organizations/:orgId", async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const org = await storage.getOrganization(orgId);

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      let role: string | null = null;

      // Resolve caller's userId + email from JWT Bearer token (mobile) or
      // from passport session (web OAuth). Both paths are handled so that
      // membership role is always included when the caller is authenticated.
      let callerUserId: string | null = null;
      let callerEmail: string | null = null;

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ') && process.env.SESSION_SECRET) {
        try {
          const token = authHeader.split(' ')[1];
          const decoded = jwt.verify(token, process.env.SESSION_SECRET) as { sub: string; email: string };
          callerUserId = decoded.sub;
          callerEmail = decoded.email;
        } catch (e) {
          // invalid token — treat as unauthenticated
        }
      } else if (req.user?.claims?.sub) {
        // Session-based auth (Google OAuth web login via passport.session())
        callerUserId = req.user.claims.sub;
        callerEmail = req.user.claims.email || req.user.email || null;
      }

      if (callerUserId) {
        if (callerEmail === 'demo@represent.app') {
          role = 'admin';
        } else {
          const members = await storage.getOrganizationMembers(orgId);
          const membership = members.find((m: any) => m.userId === callerUserId);
          role = membership?.role || null;
        }
      }

      res.json({ ...org, role });
    } catch (error: any) {
      log(`Error fetching organization: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.post("/api/organizations/:orgId/members", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { inviteCode } = req.body;

      const org = await storage.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Verify invite code if org uses it
      if (org.membershipType === 'invite' && org.inviteCode !== inviteCode) {
        return res.status(403).json({ error: "Invalid invite code" });
      }

      // Auto-add if email domain matches
      if (org.membershipType === 'domain') {
        const user = await storage.getUser(userId);
        const userDomain = user?.email?.split('@')[1];
        if (userDomain !== org.emailDomain) {
          return res.status(403).json({ error: "Email domain does not match organization" });
        }
      }

      const cap = await checkMemberCap(orgId, 1);
      if (!cap.ok) return res.status(cap.status).json(cap.body);

      await storage.addOrganizationMember(orgId, userId, 'member');
      log(`✅ User ${userId} joined organization ${orgId}`);
      res.json({ success: true, message: "Successfully joined organization" });
    } catch (error: any) {
      log(`Error joining organization: ${error.message}`);
      res.status(500).json({ error: "Failed to join organization" });
    }
  });

  app.post("/api/organizations/join-by-code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { inviteCode } = req.body;

      if (!inviteCode) {
        return res.status(400).json({ error: "Invite code required" });
      }

      const org = await storage.getOrganizationByInviteCode(inviteCode);
      if (!org) {
        return res.status(404).json({ error: "Organization not found with this invite code" });
      }

      const isMember = await storage.isOrganizationMember(org.id, userId);
      if (isMember) {
        return res.status(400).json({ error: "You are already a member of this organization" });
      }

      const cap = await checkMemberCap(org.id, 1);
      if (!cap.ok) return res.status(cap.status).json(cap.body);

      await storage.addOrganizationMember(org.id, userId, 'member');
      log(`✅ User ${userId} joined organization ${org.id} via invite code`);
      res.json({ success: true, message: "Successfully joined organization", organization: org });
    } catch (error: any) {
      log(`Error joining by code: ${error.message}`);
      res.status(500).json({ error: "Failed to join organization" });
    }
  });

  app.get("/api/organizations/:orgId/members", async (req, res) => {
    try {
      const { orgId } = req.params;
      const members = await storage.getOrganizationMembers(orgId);

      // Fetch user details for each member
      const membersWithDetails = await Promise.all(
        members.map(async (m: any) => {
          const user = await storage.getUser(m.userId);
          return { ...m, userEmail: user?.email, userName: user?.email?.split('@')[0] };
        })
      );

      res.json({ members: membersWithDetails });
    } catch (error: any) {
      log(`Error fetching org members: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  app.post("/api/organizations/:orgId/members/:userId/remove", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims?.sub;
      const { orgId, userId } = req.params;

      // Only allow user to leave themselves, or org admin to remove others
      if (currentUserId !== userId) {
        const user = await storage.getUser(currentUserId);
        const isMember = await storage.isOrganizationMember(orgId, currentUserId);
        if (!user?.isAdmin || !isMember) {
          return res.status(403).json({ error: "You can only leave yourself from an organization" });
        }
      }

      await storage.removeOrganizationMember(orgId, userId);
      log(`✅ User ${userId} removed from organization ${orgId}`);
      res.json({ success: true, message: "Successfully left organization" });
    } catch (error: any) {
      log(`Error removing from organization: ${error.message}`);
      res.status(500).json({ error: "Failed to leave organization" });
    }
  });

  app.get("/api/user/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const orgs = await storage.getUserOrganizations(userId);
      res.json({ organizations: orgs });
    } catch (error: any) {
      log(`Error fetching user organizations: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Organization branding settings (with logo file upload support)
  app.put("/api/organizations/:orgId/branding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      let { logoUrl, primaryColor, secondaryColor, customDomain } = req.body;

      // Check if user is org admin
      const member = await storage.getOrganizationMembers(orgId);
      const isAdmin = member.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) {
        return res.status(403).json({ error: "Only org admins can update branding" });
      }

      // Validate and truncate base64 logos if too large (max 2MB)
      if (logoUrl && logoUrl.startsWith('data:')) {
        const base64Size = logoUrl.length;
        const sizeInMB = base64Size / (1024 * 1024);
        if (sizeInMB > 2) {
          return res.status(400).json({ error: "Logo file too large. Maximum 2MB allowed." });
        }
      }

      const updated = await (storage as any).updateOrganizationBranding(orgId, {
        logoUrl,
        primaryColor,
        secondaryColor,
        customDomain,
      });

      log(`✅ Organization ${orgId} branding updated (logo: ${logoUrl ? logoUrl.substring(0, 20) + '...' : 'none'})`);
      res.json({ organization: updated });
    } catch (error: any) {
      log(`Error updating org branding: ${error.message}`);
      res.status(500).json({ error: "Failed to update branding" });
    }
  });

  // Organization OAuth settings
  app.put("/api/organizations/:orgId/oauth", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { oauthProvider, oauthClientId, oauthClientSecret, oauthAuthorizationUrl, oauthTokenUrl, oauthUserInfoUrl, memberRoleMapping } = req.body;

      // Check if user is org admin
      const member = await storage.getOrganizationMembers(orgId);
      const isAdmin = member.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) {
        return res.status(403).json({ error: "Only org admins can configure OAuth" });
      }

      const updated = await (storage as any).updateOrganizationOAuth(orgId, {
        oauthProvider,
        oauthClientId,
        oauthClientSecret,
        oauthAuthorizationUrl,
        oauthTokenUrl,
        oauthUserInfoUrl,
        memberRoleMapping: memberRoleMapping || {},
      });

      log(`✅ Organization ${orgId} OAuth configured for provider: ${oauthProvider}`);
      res.json({ organization: updated });
    } catch (error: any) {
      log(`Error updating OAuth config: ${error.message}`);
      res.status(500).json({ error: "Failed to update OAuth settings" });
    }
  });

  // Get org by custom domain
  app.get("/api/organizations/domain/:customDomain", async (req, res) => {
    try {
      const { customDomain } = req.params;
      const org = await (storage as any).getOrganizationByCustomDomain(customDomain);

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      res.json({ organization: org });
    } catch (error: any) {
      log(`Error fetching org by domain: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  // ─── Organization sub-resource endpoints (mobile app) ─────────────────────
  // NOTE: GET /api/organizations and POST /api/organizations/join are registered
  //       above (before GET /api/organizations/:orgId) to prevent Express
  //       treating "join" as an orgId wildcard segment.

  // DELETE /api/organizations/:orgId — delete org and all its data (admin only)
  app.delete("/api/organizations/:orgId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only org admins can delete an organization" });

      await storage.deleteOrganization(orgId);
      log(`✅ Organization ${orgId} deleted by user ${rid(userId)}`);
      res.json({ success: true });
    } catch (error: any) {
      // Surface the underlying DB error so the client can show what failed
      // (FK constraint name, missing column, etc.). Without this, every
      // failure looks like a generic "Failed to delete organization".
      log(`Error deleting organization: ${error.message}`);
      res.status(500).json({ error: `Failed to delete organization: ${error.message || 'unknown error'}` });
    }
  });

  // GET /api/organizations/:orgId/sub-orgs — list direct sub-organizations.
  // Visible to any member of the parent org (effective membership counts).
  app.get("/api/organizations/:orgId/sub-orgs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const parentOrg = await storage.getOrganization(orgId);
      if (!parentOrg) return res.status(404).json({ error: "Organization not found" });

      const isMember = await storage.isOrganizationMember(orgId, userId);
      if (!isMember) return res.status(403).json({ error: "You must be a member of this organization" });

      const subOrgs = await storage.getSubOrganizations(orgId);
      res.json({ subOrgs });
    } catch (error: any) {
      log(`Error listing sub-orgs: ${error.message}`);
      res.status(500).json({ error: "Failed to list sub-organizations" });
    }
  });

  // POST /api/organizations/:orgId/sub-orgs — create a sub-org under :orgId.
  // Caller must be a direct admin of the parent org. The creator becomes the
  // first admin of the new sub-org so they can configure it independently.
  app.post("/api/organizations/:orgId/sub-orgs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId: parentOrgId } = req.params;
      const { name, type, membershipType, description } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: "name and type are required" });
      }

      const parentOrg = await storage.getOrganization(parentOrgId);
      if (!parentOrg) return res.status(404).json({ error: "Parent organization not found" });

      // Only direct admins of the parent org can create sub-orgs. Effective
      // (inherited from grandparent) admin rights aren't enough — keeps the
      // create capability intentional and auditable.
      const parentMembers = await storage.getOrganizationMembers(parentOrgId);
      const isParentAdmin = parentMembers.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isParentAdmin) {
        return res.status(403).json({ error: "Only admins of the parent organization can create sub-organizations" });
      }

      const subOrg = await storage.createSubOrganization(
        parentOrgId,
        name,
        userId,
        type,
        membershipType || 'invite',
        description,
      );
      // Creator is the first admin of the sub-org.
      await storage.addOrganizationMember(subOrg.id, userId, 'admin');

      log(`Sub-org created: parent=${parentOrgId}, sub=${subOrg.id}, by=${rid(userId)}`);
      res.json({ subOrg });
    } catch (error: any) {
      log(`Error creating sub-org: ${error.message}`);
      res.status(500).json({ error: "Failed to create sub-organization" });
    }
  });

  // DELETE /api/organizations/:orgId/sub-orgs/:subOrgId — remove a sub-org.
  // Caller must be an admin of the PARENT org (sub-org admins can't delete
  // themselves out from under their parent without parent oversight).
  app.delete("/api/organizations/:orgId/sub-orgs/:subOrgId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId: parentOrgId, subOrgId } = req.params;

      const subOrg = await storage.getOrganization(subOrgId);
      if (!subOrg || (subOrg as any).parentOrgId !== parentOrgId) {
        return res.status(404).json({ error: "Sub-organization not found under this parent" });
      }

      const parentMembers = await storage.getOrganizationMembers(parentOrgId);
      const isParentAdmin = parentMembers.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isParentAdmin) {
        return res.status(403).json({ error: "Only admins of the parent organization can delete sub-organizations" });
      }

      await storage.deleteOrganization(subOrgId);
      log(`Sub-org deleted: parent=${parentOrgId}, sub=${subOrgId}, by=${rid(userId)}`);
      res.json({ success: true });
    } catch (error: any) {
      log(`Error deleting sub-org: ${error.message}`);
      res.status(500).json({ error: "Failed to delete sub-organization" });
    }
  });

  // GET /api/organizations/:orgId/insights — aggregate analytics for the org
  // and all its descendants. Admins see everything; members get a stripped
  // version (totals only, no per-member breakdowns).
  app.get("/api/organizations/:orgId/insights", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const periodDays = Math.min(parseInt(String(req.query.period || '30'), 10) || 30, 365);

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const isMember = await storage.isOrganizationMember(orgId, userId);
      if (!isMember) return res.status(403).json({ error: "You must be a member of this organization" });

      const directMembers = await storage.getOrganizationMembers(orgId);
      const isAdmin = directMembers.some((m: any) => m.userId === userId && m.role === 'admin');

      const insights = await storage.getOrganizationInsights(orgId, periodDays);
      // Members get the topline only; admins get the per-sub-org breakdown.
      if (!isAdmin) {
        res.json({
          totalMembers: insights.totalMembers,
          subOrgCount: insights.subOrgCount,
          totalProposals: insights.totalProposals,
          totalVotes: insights.totalVotes,
          participationRate: insights.participationRate,
          periodDays: insights.periodDays,
        });
        return;
      }
      res.json(insights);
    } catch (error: any) {
      log(`Error fetching insights: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch insights" });
    }
  });

  // GET /api/organizations/:orgId/proposals — list proposals belonging to this org
  app.get("/api/organizations/:orgId/proposals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const isMember = await storage.isOrganizationMember(orgId, userId);
      if (!isMember) return res.status(403).json({ error: "You must be a member to view proposals" });

      const orgProposals = await storage.getOrgProposals(orgId);
      res.json({ proposals: orgProposals });
    } catch (error: any) {
      log(`Error fetching org proposals: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch proposals" });
    }
  });

  // POST /api/organizations/:orgId/proposals — create proposal in org
  app.post("/api/organizations/:orgId/proposals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { title, description, category, isOfficial, voteType, options, requiresCitizenship } = req.body;

      if (!title || !description || !category) {
        return res.status(400).json({ error: "title, description, and category are required" });
      }

      // voteType validation. Defaults to yes-no for backward compatibility
      // (existing clients don't send voteType).
      const resolvedVoteType: string = voteType || 'yes-no';
      if (!['yes-no', 'multiple-choice', 'ranked-choice'].includes(resolvedVoteType)) {
        return res.status(400).json({ error: "voteType must be 'yes-no', 'multiple-choice', or 'ranked-choice'" });
      }
      if (resolvedVoteType !== 'yes-no') {
        if (!Array.isArray(options) || options.length < 2) {
          return res.status(400).json({ error: `${resolvedVoteType} proposals require at least 2 options` });
        }
        if (options.some((o: any) => typeof o !== 'string' || o.trim().length === 0)) {
          return res.status(400).json({ error: "options must be non-empty strings" });
        }
        if (new Set(options).size !== options.length) {
          return res.status(400).json({ error: "options must be unique" });
        }
      }

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const membership = members.find((m: any) => m.userId === userId);
      if (!membership) return res.status(403).json({ error: "You must be a member to create proposals" });

      const isAdmin = membership.role === 'admin';
      if (isOfficial && !isAdmin) {
        return res.status(403).json({ error: "Only admins can create official proposals" });
      }

      const proposal = await storage.createProposal(userId, title, description, category, [], undefined, undefined, {});
      const updateData: any = {
        organizationId: orgId,
        voteType: resolvedVoteType,
      };
      if (resolvedVoteType !== 'yes-no') updateData.options = options;
      if (isOfficial && isAdmin) updateData.isOfficial = true;
      if (requiresCitizenship === true) updateData.requiresCitizenship = true;
      await storage.updateProposal(proposal.id, updateData);

      const updated = await storage.getProposal(proposal.id);
      log(`✅ Org proposal created: ${proposal.id} in org ${orgId}, voteType=${resolvedVoteType}`);
      res.status(201).json(updated);
    } catch (error: any) {
      log(`Error creating org proposal: ${error.message}`);
      res.status(500).json({ error: "Failed to create proposal" });
    }
  });

  // DELETE /api/organizations/:orgId/proposals/:proposalId — delete proposal (admin only)
  app.delete("/api/organizations/:orgId/proposals/:proposalId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId, proposalId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can delete proposals" });

      const proposal = await storage.getProposal(proposalId);
      if (!proposal || proposal.organizationId !== orgId) {
        return res.status(404).json({ error: "Proposal not found in this organization" });
      }

      // Cascade: remove FK-dependent rows first (votes, voteTokenClaims) before
      // deleting the proposal to avoid FK constraint violations on existing votes.
      await db.transaction(async (tx) => {
        await tx.delete(voteTokenClaims).where(eq(voteTokenClaims.proposalId, proposalId));
        await tx.delete(votes).where(eq(votes.proposalId, proposalId));
        await tx.delete(proposals).where(and(eq(proposals.id, proposalId), eq(proposals.organizationId, orgId)));
      });
      log(`✅ Org proposal ${proposalId} deleted (with cascaded votes) by admin ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      log(`Error deleting org proposal: ${error.message}`);
      res.status(500).json({ error: "Failed to delete proposal" });
    }
  });

  // POST /api/organizations/:orgId/proposals/:proposalId/vote — vote on org proposal
  app.post("/api/organizations/:orgId/proposals/:proposalId/vote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId, proposalId } = req.params;
      const { vote } = req.body;

      if (!vote || !['support', 'oppose'].includes(vote)) {
        return res.status(400).json({ error: "vote must be 'support' or 'oppose'" });
      }

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const isMember = await storage.isOrganizationMember(orgId, userId);
      if (!isMember) return res.status(403).json({ error: "You must be a member to vote" });

      const proposal = await storage.getProposal(proposalId);
      if (!proposal || proposal.organizationId !== orgId) {
        return res.status(404).json({ error: "Proposal not found in this organization" });
      }

      if ((proposal as any).requiresCitizenship) {
        const voter = await storage.getUser(userId);
        if (!(voter as any)?.citizenshipVerified) {
          return res.status(403).json({
            error: "This proposal is open to verified citizens only",
            code: "CITIZENSHIP_REQUIRED",
          });
        }
      }

      const alreadyVoted = await storage.hasUserVotedOnProposal(userId, proposalId);
      if (alreadyVoted) return res.status(400).json({ error: "You have already voted on this proposal" });

      await storage.recordVote(userId, proposalId, vote);
      await storage.updateProposalVotes(proposalId, vote);

      log(`✅ User ${userId} voted ${vote} on org proposal ${proposalId}`);
      res.json({ success: true, vote });
    } catch (error: any) {
      log(`Error voting on org proposal: ${error.message}`);
      res.status(500).json({ error: "Failed to submit vote" });
    }
  });

  // GET /api/organizations/:orgId/invite-codes — list invite codes (admin only)
  app.get("/api/organizations/:orgId/invite-codes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can view invite codes" });

      const codes = await storage.getOrgInviteCodes(orgId);
      // Return { codes: [...] } to match mobile getInviteCodes() parser
      res.json({ codes });
    } catch (error: any) {
      log(`Error fetching invite codes: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch invite codes" });
    }
  });

  // POST /api/organizations/:orgId/invite-codes — generate invite code (admin only)
  app.post("/api/organizations/:orgId/invite-codes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { maxUses, expiresAt } = req.body;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can generate invite codes" });

      const created = await storage.createOrgInviteCode(
        orgId, userId,
        maxUses ? parseInt(maxUses) : undefined,
        expiresAt ? new Date(expiresAt) : undefined
      );

      log(`✅ Invite code created for org ${orgId} by admin ${userId}`);
      // Return { code, expiresAt, ... } at top level to match mobile generateInviteCode() contract
      res.status(201).json({
        code: created.code,
        expiresAt: created.expiresAt,
        id: created.id,
        uses: created.uses,
        maxUses: created.maxUses,
        createdAt: created.createdAt,
      });
    } catch (error: any) {
      log(`Error creating invite code: ${error.message}`);
      res.status(500).json({ error: "Failed to create invite code" });
    }
  });

  // DELETE /api/organizations/:orgId/invite-codes/:codeValue — revoke invite code (admin only)
  // NOTE: :codeValue is the invite code STRING (e.g. "INV-XXXX"), not a DB row id.
  // This matches mobile client: organizationsApi.revokeInviteCode(orgId, code.code)
  app.delete("/api/organizations/:orgId/invite-codes/:codeValue", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId, codeValue: codeId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can revoke invite codes" });

      // codeId is the invite code STRING (e.g. "INV-XXXX"), not the DB row id —
      // that is what the mobile client passes. Scoped by orgId to prevent IDOR.
      const deleted = await storage.revokeOrgInviteCode(codeId, orgId);
      if (!deleted) return res.status(404).json({ error: "Invite code not found in this organization" });
      log(`✅ Invite code ${codeId} revoked by admin ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      log(`Error revoking invite code: ${error.message}`);
      res.status(500).json({ error: "Failed to revoke invite code" });
    }
  });

  // ---------- Per-email invitations (CSV roster import) ----------
  // These differ from /invite-codes (share-link codes consumed by anyone).
  // Each invite is bound to one email address; the invitee accepts via a
  // tokenized magic link, signs in with Google, and is added to the org.

  const INVITE_EXPIRY_DAYS = 30;
  const MAX_INVITES_PER_REQUEST = 1000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const WEB_PORTAL_URL = process.env.WEB_PORTAL_URL || "https://representportal.com";

  // POST /api/organizations/:orgId/invites/import — bulk-import roster (admin only)
  // Body: { rows: [{ email, firstName?, lastName?, role?, metadata? }, ...] }
  // Returns: { created, skippedExistingMembers, skippedAlreadyInvited, invalid, sentEmails }
  app.post("/api/organizations/:orgId/invites/import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { rows } = req.body || {};

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "rows must be a non-empty array" });
      }
      if (rows.length > MAX_INVITES_PER_REQUEST) {
        return res.status(400).json({ error: `Too many rows (max ${MAX_INVITES_PER_REQUEST}). Split your CSV into smaller files.` });
      }

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can import members" });

      // Tier gate: CSV bulk import is a Professional+ feature. Starter orgs
      // must use single-invite or invite-code flows. Marketing-aligned.
      if (!isFeatureEnabled(org.tier, 'csvImport')) {
        return res.status(402).json({
          error: "CSV roster import requires Professional plan or higher",
          code: "FEATURE_NOT_AVAILABLE_ON_TIER",
          feature: "csvImport",
          tier: org.tier ?? 'starter',
          upgradeRequired: true,
        });
      }

      // Pre-flight member cap. Worst-case headroom — if every row is unique
      // and accepts, the org would gain `rows.length` members. Use that
      // upper bound for the check; under-estimates of headroom are fine
      // (we'd allow it when we shouldn't). Over-estimates of need would
      // wrongly block, but the validate/dedupe stages below shrink the
      // batch only — never grow it — so this is safe.
      const cap = await checkMemberCap(orgId, rows.length);
      if (!cap.ok) return res.status(cap.status).json(cap.body);

      // Stage 1: validate + dedupe
      type Row = { email: string; firstName?: string; lastName?: string; role?: string; metadata?: any };
      const valid: Row[] = [];
      const invalid: Array<{ email: string; reason: string }> = [];
      const seenInBatch = new Set<string>();

      for (const raw of rows) {
        const email = String(raw?.email ?? '').toLowerCase().trim();
        if (!email || !EMAIL_RE.test(email)) {
          invalid.push({ email: String(raw?.email ?? ''), reason: "invalid email" });
          continue;
        }
        if (seenInBatch.has(email)) {
          invalid.push({ email, reason: "duplicate in upload" });
          continue;
        }
        seenInBatch.add(email);
        valid.push({
          email,
          firstName: raw?.firstName ? String(raw.firstName).slice(0, 100) : undefined,
          lastName: raw?.lastName ? String(raw.lastName).slice(0, 100) : undefined,
          role: raw?.role === 'admin' ? 'admin' : 'member',
          metadata: raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : undefined,
        });
      }

      // Stage 2: filter out emails that already belong to existing members
      const existingMemberEmails = await storage.getExistingMemberEmails(orgId, valid.map(r => r.email));
      const skippedExistingMembers = valid.filter(r => existingMemberEmails.has(r.email)).map(r => r.email);
      const candidates = valid.filter(r => !existingMemberEmails.has(r.email));

      // Stage 3: filter out emails with an active pending invite
      const existingInvites = await storage.getOrgInvites(orgId, 'pending');
      const pendingEmails = new Set(existingInvites.map((i: any) => (i.email || '').toLowerCase()));
      const skippedAlreadyInvited = candidates.filter(r => pendingEmails.has(r.email)).map(r => r.email);
      const fresh = candidates.filter(r => !pendingEmails.has(r.email));

      // Stage 4: create invite rows. Use crypto.randomUUID() twice and concat
      // for a 64-hex-char token — high entropy, URL-safe, no extra deps.
      const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      const invitesToCreate = fresh.map(r => ({
        organizationId: orgId,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        role: r.role,
        metadata: r.metadata,
        invitedBy: userId,
        inviteToken: (randomUUID() + randomUUID()).replace(/-/g, ''),
        expiresAt,
      }));

      const created = await storage.createOrgInvites(invitesToCreate);

      // Stage 5: send emails (fire-and-forget so we don't block the response).
      // Each send is independent; failures are logged but don't unwind the
      // import. Admin can re-send via revoke-then-reimport if needed.
      const inviter = await storage.getUser(userId);
      const inviterName = (inviter?.firstName && inviter?.lastName)
        ? `${inviter.firstName} ${inviter.lastName}`
        : (inviter?.name || inviter?.email || 'A team admin');

      let sentEmails = 0;
      const sendPromises = created.map(async (inv: any) => {
        const inviteUrl = `${WEB_PORTAL_URL}/invite/${inv.inviteToken}`;
        const { subject, html, text } = buildOrgInviteEmail({
          inviteeFirstName: inv.firstName,
          orgName: org.name,
          inviterName,
          inviteUrl,
          expiresInDays: INVITE_EXPIRY_DAYS,
        });
        const ok = await sendEmail({ to: inv.email, subject, html, text });
        if (ok) sentEmails++;
      });
      // Don't await — let them run in the background. If RESEND_API_KEY is
      // missing in dev, sendEmail returns false synchronously without
      // network I/O, so this is still safe.
      Promise.all(sendPromises).catch(err => log(`Background invite email error: ${err?.message}`));

      log(`Org invite import: org=${orgId} admin=${userId} requested=${rows.length} created=${created.length} skipped_member=${skippedExistingMembers.length} skipped_pending=${skippedAlreadyInvited.length} invalid=${invalid.length}`);

      res.json({
        created: created.length,
        skippedExistingMembers,
        skippedAlreadyInvited,
        invalid,
        // sentEmails is approximate — sends are async. Surface the count
        // we attempted so admin sees something. Real delivery is logged.
        sentEmails: created.length,
      });
    } catch (error: any) {
      log(`Error importing roster: ${error.message}`);
      res.status(500).json({ error: "Failed to import roster" });
    }
  });

  // GET /api/organizations/:orgId/invites — list pending invites (admin only)
  app.get("/api/organizations/:orgId/invites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const status = typeof req.query.status === 'string' ? req.query.status : 'pending';

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can view invites" });

      const invites = await storage.getOrgInvites(orgId, status);
      // Strip token from list response — only needed when accepting.
      res.json({
        invites: invites.map((i: any) => ({
          id: i.id,
          email: i.email,
          firstName: i.firstName,
          lastName: i.lastName,
          role: i.role,
          status: i.status,
          invitedAt: i.invitedAt,
          expiresAt: i.expiresAt,
          acceptedAt: i.acceptedAt,
        })),
      });
    } catch (error: any) {
      log(`Error fetching invites: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  // DELETE /api/organizations/:orgId/invites/:inviteId — revoke pending invite
  app.delete("/api/organizations/:orgId/invites/:inviteId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId, inviteId } = req.params;

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can revoke invites" });

      const ok = await storage.revokeOrgInvite(inviteId, orgId);
      if (!ok) return res.status(404).json({ error: "Invite not found or already accepted/revoked" });
      log(`Invite ${inviteId} revoked by admin ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      log(`Error revoking invite: ${error.message}`);
      res.status(500).json({ error: "Failed to revoke invite" });
    }
  });

  // GET /api/invites/:token — public: fetch invite details so the web/landing
  // page can render "You've been invited to {orgName} by {inviter}" before
  // the user signs in. Only returns non-sensitive fields.
  app.get("/api/invites/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      const invite = await storage.findOrgInviteByToken(token);
      if (!invite) return res.status(404).json({ error: "Invite not found" });

      // Auto-mark expired invites without modifying the row aggressively —
      // status update happens lazily on accept attempts.
      const expired = invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now();
      if (invite.status !== 'pending' || expired) {
        return res.status(410).json({
          error: invite.status === 'accepted' ? "Invite already accepted"
            : invite.status === 'revoked' ? "Invite has been revoked"
            : "Invite has expired",
        });
      }

      const org = await storage.getOrganization(invite.organizationId);
      const inviter = await storage.getUser(invite.invitedBy);
      const inviterName = (inviter?.firstName && inviter?.lastName)
        ? `${inviter.firstName} ${inviter.lastName}`
        : (inviter?.name || 'Someone');

      res.json({
        organizationId: invite.organizationId,
        organizationName: org?.name || 'an organization',
        organizationLogoUrl: org?.logoUrl || null,
        inviterName,
        email: invite.email,
        firstName: invite.firstName,
        role: invite.role,
        expiresAt: invite.expiresAt,
      });
    } catch (error: any) {
      log(`Error fetching invite: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch invite" });
    }
  });

  // POST /api/invites/:token/accept — authenticated. Accepts the invite for
  // the currently-signed-in user (whose email may differ from the invited
  // email — the token itself is the proof of consent, not the email match).
  app.post("/api/invites/:token/accept", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { token } = req.params;

      const invite = await storage.findOrgInviteByToken(token);
      if (!invite) return res.status(404).json({ error: "Invite not found" });
      if (invite.status !== 'pending') {
        return res.status(410).json({ error: `Invite is ${invite.status}` });
      }
      if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
        return res.status(410).json({ error: "Invite has expired" });
      }

      // Already a member? Silently mark accepted and succeed (idempotent).
      const alreadyMember = await storage.isOrganizationMember(invite.organizationId, userId);
      if (!alreadyMember) {
        const cap = await checkMemberCap(invite.organizationId, 1);
        if (!cap.ok) return res.status(cap.status).json(cap.body);
        await storage.addOrganizationMember(invite.organizationId, userId, invite.role || 'member');
      }
      await storage.markInviteAccepted(invite.id);

      log(`Invite ${invite.id} accepted by user ${userId} for org ${invite.organizationId}`);
      res.json({
        success: true,
        organizationId: invite.organizationId,
        role: invite.role,
      });
    } catch (error: any) {
      log(`Error accepting invite: ${error.message}`);
      res.status(500).json({ error: "Failed to accept invite" });
    }
  });

  // GET /api/organizations/:orgId/announcements — list announcements (members only)
  app.get("/api/organizations/:orgId/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const isMember = await storage.isOrganizationMember(orgId, userId);
      if (!isMember) return res.status(403).json({ error: "You must be a member to view announcements" });

      const announcements = await storage.getOrgAnnouncements(orgId);
      res.json({ announcements });
    } catch (error: any) {
      log(`Error fetching announcements: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch announcements" });
    }
  });

  // POST /api/organizations/:orgId/announcements — create announcement (admin only)
  app.post("/api/organizations/:orgId/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;
      const { title, content, pinned } = req.body;

      if (!title || !content) return res.status(400).json({ error: "title and content are required" });

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const members = await storage.getOrganizationMembers(orgId);
      const isAdmin = members.some((m: any) => m.userId === userId && m.role === 'admin');
      if (!isAdmin) return res.status(403).json({ error: "Only admins can create announcements" });

      const announcement = await storage.createOrgAnnouncement(orgId, title, content, !!pinned);
      log(`✅ Announcement created for org ${orgId} by admin ${userId}`);
      res.status(201).json({ announcement });
    } catch (error: any) {
      log(`Error creating announcement: ${error.message}`);
      res.status(500).json({ error: "Failed to create announcement" });
    }
  });

  // GET /api/organizations/:orgId/proposal-limits — return rate-limit info for calling user
  app.get("/api/organizations/:orgId/proposal-limits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { orgId } = req.params;

      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const isMember = await storage.isOrganizationMember(orgId, userId);
      if (!isMember) return res.status(403).json({ error: "You must be a member to check limits" });

      const limits = await storage.getOrgProposalLimits(orgId, userId);
      res.json(limits);
    } catch (error: any) {
      log(`Error fetching proposal limits: ${error.message}`);
      res.status(500).json({ error: "Failed to fetch proposal limits" });
    }
  });

  // ─── End organization sub-resource endpoints ────────────────────────────────

  // ─── Apple In-App Purchase (IAP) receipt validation ─────────────────────────
  // Mobile (lib/iap.ts) POSTs { receipt, productId, organizationId? } here
  // after a successful App Store purchase. We verify the receipt with Apple,
  // ─── UPDATE 27 — UGC moderation (Apple Guideline 1.2) ────────────────
  //
  // Five endpoints + a server-side report counter + auto-hide threshold.
  // Mobile UI shipped earlier in components/moderation/ProposalModerationMenu
  // and lib/moderation.ts; the API client lives at lib/api.ts moderationApi.
  // Until these endpoints landed, the client swallowed 404s and showed
  // soft-success — those stubs are removed in lib/api.ts.

  // Fixed reason enum. Mirror in lib/api.ts ReportReason.
  const REPORT_REASONS = new Set([
    "spam", "hate_speech", "threat", "sexual", "illegal", "misinformation", "other",
  ]);
  // Auto-hide threshold. Once reportCount >= AUTO_HIDE_AT and hiddenAt is
  // null, stamp hiddenAt = now() so the proposal disappears from listings.
  // Admin review can clear hiddenAt to restore.
  const AUTO_HIDE_AT = 3;

  // POST /api/proposals/:proposalId/report — submit a report against a
  // proposal. One row per submission; reporter can submit multiple times
  // but each fires admin email + counter increment (let admin dedupe).
  app.post("/api/proposals/:proposalId/report", isAuthenticated, async (req: any, res) => {
    try {
      const reporterId = req.user.claims?.sub;
      if (!reporterId) return res.status(401).json({ error: "Unauthorized" });
      const { proposalId } = req.params;
      const { reason, note } = req.body ?? {};
      if (typeof reason !== "string" || !REPORT_REASONS.has(reason)) {
        return res.status(400).json({ error: "Invalid reason" });
      }
      const trimmedNote = typeof note === "string" ? note.slice(0, 500) : null;

      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ error: "Proposal not found" });

      await db.insert(proposalReports).values({
        proposalId,
        reporterId,
        reason,
        note: trimmedNote,
      });

      // Increment counter; auto-hide once threshold hits.
      const newCount = (proposal.reportCount ?? 0) + 1;
      const shouldHide = newCount >= AUTO_HIDE_AT && !proposal.hiddenAt;
      await db.update(proposals).set({
        reportCount: newCount,
        ...(shouldHide ? { hiddenAt: new Date() } : {}),
      }).where(eq(proposals.id, proposalId));

      // Best-effort admin email. Don't fail the request if email is down.
      try {
        const adminEmail = process.env.MODERATION_ADMIN_EMAIL;
        if (adminEmail) {
          const text =
            `Proposal: ${proposalId} — ${proposal.title}\n` +
            `Reporter: ${reporterId}\n` +
            `Reason: ${reason}\n` +
            `Reports total: ${newCount}\n` +
            `Auto-hidden: ${shouldHide ? "yes" : "no"}\n\n` +
            `Note:\n${trimmedNote ?? "(none)"}\n`;
          await sendEmail({
            to: adminEmail,
            subject: `[Represent] Proposal report: ${reason}${shouldHide ? " (auto-hidden)" : ""}`,
            html: `<pre style="font-family:monospace;font-size:13px;">${text.replace(/[<>&]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!))}</pre>`,
            text,
          });
        }
      } catch (e: any) {
        log(`moderation report email failed: ${e?.message ?? e}`);
      }

      log(`Proposal report: proposal=${proposalId} reporter=${reporterId} reason=${reason} count=${newCount} hidden=${shouldHide}`);
      res.json({ ok: true, hidden: shouldHide });
    } catch (error: any) {
      log(`Proposal report error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to submit report" });
    }
  });

  // POST /api/users/:userId/mute — server-side mute. Survives reinstall,
  // syncs across devices. Idempotent — second mute is a no-op via the
  // (muterId, mutedId) unique constraint.
  app.post("/api/users/:userId/mute", isAuthenticated, async (req: any, res) => {
    try {
      const muterId = req.user.claims?.sub;
      if (!muterId) return res.status(401).json({ error: "Unauthorized" });
      const { userId: mutedId } = req.params;
      if (mutedId === muterId) {
        return res.status(400).json({ error: "Cannot mute yourself" });
      }
      try {
        await db.insert(userMutes).values({ muterId, mutedId });
      } catch (e: any) {
        // Unique constraint hit on (muterId, mutedId) — already muted.
        // Accept idempotently.
        if (!String(e?.message ?? "").toLowerCase().includes("unique")) throw e;
      }
      res.json({ ok: true });
    } catch (error: any) {
      log(`Mute error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to mute user" });
    }
  });

  // DELETE /api/users/:userId/mute — unmute. Idempotent — deleting a
  // non-existent edge succeeds silently.
  app.delete("/api/users/:userId/mute", isAuthenticated, async (req: any, res) => {
    try {
      const muterId = req.user.claims?.sub;
      if (!muterId) return res.status(401).json({ error: "Unauthorized" });
      const { userId: mutedId } = req.params;
      await db.delete(userMutes).where(
        and(eq(userMutes.muterId, muterId), eq(userMutes.mutedId, mutedId)),
      );
      res.json({ ok: true });
    } catch (error: any) {
      log(`Unmute error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to unmute user" });
    }
  });

  // GET /api/user/mutes — return the requester's mute list as an array of
  // muted user IDs. Mobile lib/moderation.ts calls this on auth and caches.
  app.get("/api/user/mutes", isAuthenticated, async (req: any, res) => {
    try {
      const muterId = req.user.claims?.sub;
      if (!muterId) return res.status(401).json({ error: "Unauthorized" });
      const rows = await db
        .select({ mutedId: userMutes.mutedId })
        .from(userMutes)
        .where(eq(userMutes.muterId, muterId));
      res.json({ mutedUsers: rows.map((r) => r.mutedId) });
    } catch (error: any) {
      log(`Get mutes error: ${error?.message ?? error}`);
      res.status(500).json({ error: "Failed to fetch mute list" });
    }
  });

  // ───────────────────────────────────────────────────────────────────

  // map the productId to a feature, and update the user/org subscription
  // state. Idempotent on Apple's transaction_id.
  //
  // Requires APPLE_SHARED_SECRET env var (generated in App Store Connect).
  app.post("/api/iap/validate-receipt", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { receipt, productId, organizationId } = req.body;
      if (!receipt || !productId) {
        return res.status(400).json({ error: "Missing receipt or productId" });
      }

      const sharedSecret = process.env.APPLE_SHARED_SECRET;
      if (!sharedSecret) {
        log("APPLE_SHARED_SECRET not configured — set it in env after generating in App Store Connect");
        return res.status(500).json({ error: "IAP validation not configured" });
      }

      const verifyWithApple = async (url: string) => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            'receipt-data': receipt,
            'password': sharedSecret,
            'exclude-old-transactions': true,
          }),
        });
        return response.json();
      };

      // Try production first; on status 21007 ("sandbox receipt sent to prod"),
      // retry against sandbox. This is Apple's recommended pattern so the same
      // code works in TestFlight + App Store.
      let appleResponse: any = await verifyWithApple('https://buy.itunes.apple.com/verifyReceipt');
      if (appleResponse.status === 21007) {
        log(`IAP: sandbox receipt detected, retrying for user=${userId}`);
        appleResponse = await verifyWithApple('https://sandbox.itunes.apple.com/verifyReceipt');
      }

      if (appleResponse.status !== 0) {
        log(`IAP validation failed: status=${appleResponse.status}, user=${userId}, product=${productId}`);
        return res.status(400).json({ error: `Apple receipt invalid (status ${appleResponse.status})` });
      }

      // Find the matching transaction in the receipt. Apple returns transactions
      // in receipt.in_app (one-time purchases) and latest_receipt_info (subs).
      const inApp: any[] = appleResponse.receipt?.in_app || [];
      const latestReceiptInfo: any[] = appleResponse.latest_receipt_info || [];
      const allTransactions = [...inApp, ...latestReceiptInfo];
      const matchingTx = allTransactions.find((tx: any) => tx.product_id === productId);

      if (!matchingTx) {
        log(`IAP: no matching transaction for productId=${productId}, user=${userId}`);
        return res.status(400).json({ error: "Product not found in receipt" });
      }

      const appleTxId: string = matchingTx.transaction_id;
      const originalTxId: string = matchingTx.original_transaction_id || appleTxId;

      // Idempotency: skip if we've already processed this Apple transaction
      const existingTx = await db.select().from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.txHash, appleTxId)))
        .limit(1);
      if (existingTx.length > 0) {
        log(`IAP: transaction ${appleTxId} already processed for user=${userId}`);
        return res.json({ valid: true, message: "Already processed" });
      }

      // Map productId → feature and update DB
      let productType = 'unknown';
      let expiresAt: Date | undefined;
      const expiresMs = matchingTx.expires_date_ms ? parseInt(matchingTx.expires_date_ms, 10) : null;
      if (expiresMs) expiresAt = new Date(expiresMs);

      if (productId === 'com.representwallet.app.verification') {
        productType = 'verification';
        await storage.updateUser(userId, { verificationPaid: true } as any);
      } else if (productId === 'com.representwallet.app.premium') {
        productType = 'premium';
        // Write iapOriginalTransactionId to the dedicated column so the
        // App Store Server Notifications V2 webhook can find this user
        // by Apple's originalTransactionId on renewal/refund/cancel events.
        // The legacy stripeSubscriptionId 'iap:' prefix is kept for now
        // for backward compatibility with any existing readers — both
        // columns track the same value until the prefix is fully retired.
        await storage.updateUser(userId, {
          subscriptionStatus: 'active',
          subscriptionEndDate: expiresAt,
          stripeSubscriptionId: `iap:${originalTxId}`,
          iapOriginalTransactionId: originalTxId,
          iapEnvironment: appleResponse.environment,
        } as any);
      } else if (productId.startsWith('com.representwallet.app.org.')) {
        productType = 'organization';
        if (!organizationId) {
          return res.status(400).json({ error: "organizationId required for org subscriptions" });
        }
        // Caller must be a member of the org before we activate its subscription
        const isMember = await storage.isOrganizationMember(organizationId, userId);
        if (!isMember) {
          return res.status(403).json({ error: "Not a member of this organization" });
        }
        await db.update(organizations).set({
          subscriptionStatus: 'active',
          stripeSubscriptionId: `iap:${originalTxId}`,
          iapOriginalTransactionId: originalTxId,
          iapEnvironment: appleResponse.environment,
        }).where(eq(organizations.id, organizationId));
      } else if (productId.startsWith('com.representwallet.app.ballots.')) {
        // Ballot packs were retired in favor of the daily-allowance model.
        // We return 410 Gone so any in-flight purchases from older app builds
        // get a clear error instead of silently succeeding.
        log(`IAP: ballot pack purchase rejected (deprecated product) productId=${productId}, user=${userId}`);
        return res.status(410).json({ error: "Ballot packs are no longer sold. Upgrade to Premium for unlimited voting." });
      } else {
        log(`IAP: unknown productId=${productId}, user=${userId}`);
        return res.status(400).json({ error: "Unknown product" });
      }

      // Record transaction for audit + idempotency
      await db.insert(transactions).values({
        id: randomUUID(),
        userId,
        txHash: appleTxId,
        type: `iap_${productType}`,
        amount: matchingTx.price ? String(matchingTx.price) : null,
        status: 'completed',
        data: { productId, originalTxId, organizationId, environment: appleResponse.environment } as any,
        createdAt: new Date(),
      });

      log(`✅ IAP validated: user=${userId}, product=${productId}, tx=${appleTxId}`);

      res.json({
        valid: true,
        productType,
        expiresAt: expiresAt?.toISOString(),
      });
    } catch (error: any) {
      log(`IAP validation error: ${error.message}`);
      res.status(500).json({ error: "Failed to validate receipt" });
    }
  });

  // Admin: one-shot backfill of the initial 1000-RPV grant for users who
  // verified before the daily-allowance system shipped. Idempotent — only
  // touches users where initialBallotsGranted=false. Safe to run multiple
  // times. Gated by VERIFF_MASTER_SIGNATURE_KEY (existing admin secret).
  app.post("/api/admin/backfill-initial-ballots", async (req: any, res) => {
    try {
      const adminKey = req.headers['x-admin-key'];
      if (!adminKey || adminKey !== process.env.VERIFF_MASTER_SIGNATURE_KEY) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const pending = await (storage as any).getUsersNeedingInitialGrant();
      log(`Backfill: ${pending.length} verified users need initial ballot grant`);

      let granted = 0;
      let skipped = 0;
      for (const user of pending) {
        await grantInitialBallotsIfNeeded(user.id);
        // Re-check to count successes (helper swallows errors)
        const refreshed = await storage.getUser(user.id);
        if ((refreshed as any)?.initialBallotsGranted) {
          granted++;
        } else {
          skipped++;
        }
      }

      log(`Backfill complete: granted=${granted}, skipped=${skipped}`);
      res.json({ success: true, total: pending.length, granted, skipped });
    } catch (error: any) {
      log(`Backfill error: ${error.message}`);
      res.status(500).json({ error: "Backfill failed" });
    }
  });

  // Health check
  // Real health check: probes the DB and verifies critical env vars are set.
  // Replit's autoscaler + external uptime monitors call this; a static "ok"
  // would mask outages. Returns 503 if anything fails so monitors fire.
  app.get("/api/health", async (req, res) => {
    const checks: Record<string, "ok" | string> = {};
    const required = [
      "DATABASE_URL",
      "VERIFF_MASTER_SIGNATURE_KEY",
      "RPV_TOKEN_ADDRESS",
      "JWT_SECRET",
    ];
    for (const k of required) {
      checks[k] = process.env[k] ? "ok" : "missing";
    }
    try {
      await db.execute(sql`SELECT 1`);
      checks.db = "ok";
    } catch (e: any) {
      checks.db = `error: ${e?.message || "unknown"}`;
    }
    const failed = Object.entries(checks).filter(([, v]) => v !== "ok");
    if (failed.length > 0) {
      return res.status(503).json({ status: "degraded", checks, network: "Base Sepolia" });
    }
    res.json({ status: "ok", checks, network: "Base Sepolia" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
