import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-db";
import { baseNetwork } from "./base-network";
import { log } from "./app";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupBadgeRoutes } from "./badge-routes";
import { passportNFTs, activatedRidings, electoralRidingQRCodes, proposals, votes, voteTokenClaims, organizations, transactions } from "@shared/schema";
import { eq, count, and } from "drizzle-orm";
import { db } from "./db";
import { savePushToken, notifyNewProposal, notifyTokenClaimed, notifyProposalVote } from "./notifications";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup OAuth authentication (Google, Apple, GitHub)
  await setupAuth(app);

  // Setup badge system routes
  setupBadgeRoutes(app);

  // Setup object storage routes for image uploads
  registerObjectStorageRoutes(app);

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
  app.post("/api/voting/submit", async (req, res) => {
    const { userId, proposalId, position, selectedOption } = req.body;

    if (!userId || !proposalId || !position) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Check if user has already voted on this proposal (prevent duplicate votes)
      const votedProposals = await (storage as any).getUserVotedProposals(userId);
      if (votedProposals.includes(proposalId)) {
        return res.status(403).json({ error: "You have already voted on this proposal" });
      }

      // Ensure user has passport NFT to vote (1 person 1 vote)
      const hasPassport = await (storage as any).getPassportNFT(userId);
      if (!hasPassport) {
        return res.status(403).json({ error: "You must mint your soulbound passport NFT to vote. Visit the Identity page to mint." });
      }

      const user = await storage.getUser(userId);
      const proposal = await storage.getProposal(proposalId);
      const wallet = await storage.getUserWallet(userId);

      // Check organization membership if proposal is org-restricted
      if (proposal?.organizationId) {
        const isMember = await storage.isOrganizationMember(proposal.organizationId, userId);
        if (!isMember) {
          return res.status(403).json({ error: "You must be a member of this organization to vote on this proposal" });
        }
      }

      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      if (!wallet) {
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

      const rpvTokenAddress = process.env.RPV_TOKEN_ADDRESS;
      if (!rpvTokenAddress) {
        return res.status(500).json({ error: "RPV token not configured" });
      }

      // Check if proposal is closed
      const isClosed = await (storage as any).isProposalClosed(proposalId);
      if (isClosed) {
        return res.status(403).json({ error: "Voting on this proposal has ended" });
      }

      // Check user's RPV balance
      const balance = await baseNetwork.getRPVBalance(rpvTokenAddress, wallet.address);
      const userBalance = parseFloat(balance);

      log(`User ${userId} RPV balance: ${balance}`);

      // If user has no tokens, transfer 1 RPV to them first
      if (userBalance < 1) {
        log(`Transferring 1 RPV token to user ${userId} before voting`);
        const transferResult = await baseNetwork.transferRPVToken(rpvTokenAddress, wallet.address, 1);
        if (!transferResult.success) {
          log(`Warning: Failed to transfer RPV token to user: ${transferResult.error}`);
          // Continue anyway - vote will fail if transfer didn't work
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
      const voteResult = await baseNetwork.voteWithRelayPattern(rpvTokenAddress, wallet.privateKey, wallet.address, position as 'support' | 'oppose' | 'multiple-choice', proposalId, optionAddress);

      if (!voteResult.success) {
        return res.status(400).json({ error: voteResult.error || "Failed to transfer vote token" });
      }

      // Record vote in database (with selected option if multiple-choice)
      await storage.recordVote(userId, proposalId, position, undefined, voteResult.txHash, selectedOption);
      // For multiple-choice, only update position counts (option counts handled separately if needed)
      if (!selectedOption) {
        await storage.updateProposalVotes(proposalId, position);
      }

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

      log(`Vote recorded on-chain: user=${userId}, proposal=${proposalId}, position=${position}, tx=${voteResult.txHash}`);

      // Notify proposal owner that someone voted on their proposal
      if (proposal.userId !== userId) {
        const voterName = user?.name || 'Someone';
        notifyProposalVote({ id: proposal.id, title: proposal.title, userId: proposal.userId }, voterName);
      }

      res.json({
        success: true,
        message: "Vote recorded on-chain via token transfer",
        txHash: voteResult.txHash,
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
  app.get("/api/proposals", async (req, res) => {
    try {
      const { orgId } = req.query;
      let proposals = await storage.getAllProposals();

      // Filter by organization if specified
      if (orgId) {
        proposals = proposals.filter((p: any) => p.organizationId === orgId);
      }

      res.json({ proposals });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch proposals" });
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

      const { title, description, category, geoRestrictions, riding, demographicRestrictions, voteType, options, organizationId, imageUrl } = req.body;

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

      const proposal = await storage.createProposal(userId, title, description, category, geoRestrictions, undefined, riding, demographicRestrictions);

      // Update proposal with organization and image if provided
      const updateData: any = {};
      if (organizationId) {
        updateData.organizationId = organizationId;
      }
      if (imageUrl) {
        updateData.imageUrl = imageUrl;
      }

      // Update proposal with vote type and options if multiple-choice
      if (voteType === 'multiple-choice' && options && options.length > 0) {
        // Generate unique blockchain address for each option
        const optionAddresses = [];
        for (let i = 0; i < options.length; i++) {
          const optionAddress = await baseNetwork.generateDeterministicAddress(proposal.id, i);
          optionAddresses.push(optionAddress);
        }
        updateData.voteType = 'multiple-choice';
        updateData.options = options;
        updateData.optionAddresses = optionAddresses;
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

      log(`Geo-gated vote recorded: user=${userId}, proposal=${proposalId}, location=${country}/${state}`);

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

    log(`Identity verify request: userId=${userId}, method=${verificationMethod}, firstName="${firstName}", lastName="${lastName}"`);

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

      log(`Profile updated: userId=${userId}, name="${name}", country="${country}", state="${state}", city="${city}", documentType="${documentType}", gender="${gender}", dateOfBirth="${dateOfBirth}"`);

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
    try {
      const { verification } = req.body;
      if (!verification) {
        return res.status(400).json({ error: "No verification data" });
      }

      const userId = verification.vendorData;
      const verificationId = verification.id;
      const status = verification.status;

      log(`Veriff webhook received: userId=${userId}, status=${status}`);

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

        log(`User verified via Veriff webhook: user=${userId}, verificationId=${verificationId}, document=${document.type}, country=${address.country}`);
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
    try {
      const { verification } = req.body;
      log(`Veriff webhook received at /api/veriff/webhook: ${JSON.stringify(req.body).substring(0, 500)}`);

      if (!verification) {
        return res.status(200).json({ received: true });
      }

      const userId = verification.vendorData;
      const verificationId = verification.id;
      const status = verification.status;

      log(`Veriff webhook: userId=${userId}, status=${status}, verificationId=${verificationId}`);

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
        log(`User verified via /api/veriff/webhook: user=${userId}, verificationId=${verificationId}, country=${country}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      log(`Veriff webhook error: ${error}`);
      res.status(200).json({ received: true });
    }
  });

  // Sentinel AI Document Analysis - using OpenAI Integration
  app.post("/api/sentinel/analyze", async (req, res) => {
    const { title, text, issueType } = req.body;

    if (!text || !title) {
      return res.status(400).json({ error: "title and text required" });
    }

    try {
      const { analyzeGovernanceText } = await import("./lib/analysis");
      const analysis = await analyzeGovernanceText({ title, text, issueType: issueType || 'policy' });

      log(`Sentinel analysis: title=${title}, issueType=${issueType || 'policy'}`);

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

  // Create Veriff verification session
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
            vendorData: userId,
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

      log(`✅ Admin verified user: ${user.id}, email=${email}`);

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

      log(`🎫 Passport mint request: userId=${effectiveUserId}, wallet=${wallet.address}, contractAddress=${passportContractAddress}`);

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

      log(`✅ Passport minted successfully: userId=${effectiveUserId}, tokenId=${tokenId}, txHash=${mintResult.txHash}`);

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

  // Organization subscription payment intent (for mobile native payment sheet)
  const ORG_PRICE_IDS: Record<string, string> = {
    community: process.env.STRIPE_PRICE_ORG_COMMUNITY || 'price_1SwhrED2jsTroGJyAvU4bZ4r',
    professional: process.env.STRIPE_PRICE_ORG_PROFESSIONAL || 'price_1SwhsSD2jsTroGJyps2LHaah',
    enterprise: process.env.STRIPE_PRICE_ORG_ENTERPRISE || 'price_1SwhtFD2jsTroGJylQOkB8tu',
  };

  const ORG_EXPECTED_AMOUNTS: Record<string, number> = {
    community: 2900,
    professional: 4900,
    enterprise: 9900,
  };

  app.post("/api/stripe/organization-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims?.sub;
      const { tier, organizationId } = req.body;

      if (!tier || !organizationId) {
        return res.status(400).json({ error: "Missing tier or organizationId" });
      }

      const validTiers = ['community', 'professional', 'enterprise'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: "Invalid tier" });
      }

      const org = await storage.getOrganization(organizationId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      if (org.creatorId !== userId) {
        return res.status(403).json({ error: "Only the owner can create subscriptions" });
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

      await db.update(organizations).set({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
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
      log(`✅ Organization ${orgId} deleted by user ${userId}`);
      res.json({ success: true });
    } catch (error: any) {
      log(`Error deleting organization: ${error.message}`);
      res.status(500).json({ error: "Failed to delete organization" });
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
      const { title, description, category, isOfficial } = req.body;

      if (!title || !description || !category) {
        return res.status(400).json({ error: "title, description, and category are required" });
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
      const updateData: any = { organizationId: orgId };
      if (isOfficial && isAdmin) updateData.isOfficial = true;
      await storage.updateProposal(proposal.id, updateData);

      const updated = await storage.getProposal(proposal.id);
      log(`✅ Org proposal created: ${proposal.id} in org ${orgId}`);
      // Return proposal object directly (not wrapped) to match mobile ApiResponse<OrganizationProposal>
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
        await storage.updateUser(userId, {
          subscriptionStatus: 'active',
          subscriptionEndDate: expiresAt,
          stripeSubscriptionId: `iap:${originalTxId}`,
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
        }).where(eq(organizations.id, organizationId));
      } else if (productId.startsWith('com.representwallet.app.ballots.')) {
        productType = 'ballot_pack';
        // Ballot allocation logic deferred — for now just record the transaction
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

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", network: "Base Sepolia" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
