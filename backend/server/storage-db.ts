import { db } from "./db";
import { users, wallets, votes, proposals, proposalOptionAddresses, pricingPlans, platformSettings, voteTokenClaims, passportNFTs, ridingVerifications, electoralRidingQRCodes, referralCodes, referrals, organizations, organizationMembers, organizationInviteCodes, organizationInvites, organizationAnnouncements } from "@shared/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { encryptPrivateKey, decryptPrivateKey, isEncrypted } from "./crypto";
import type { User, Wallet, PricingPlan, InsertUser, UpsertUser, PassportNFT, ElectoralRidingQRCode } from "@shared/schema";

export interface VerificationData {
  verified: boolean;
  verificationId?: string;
  verificationMethod?: 'veriff' | 'didit' | 'manual';
  verifiedAt?: Date;
  country?: string;
  state?: string;
  citizenshipVerified?: boolean;
  citizenshipVerifiedAt?: Date;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
  country: string;
  state?: string;
  city?: string;
  zipCode?: string;
  timestamp: Date;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  getUserWallet(userId: string): Promise<Wallet | undefined>;
  createWallet(userId: string, address: string, privateKey?: string): Promise<Wallet>;
  recordVote(userId: string, proposalId: string, position: string, voteTokenId?: string, txHash?: string): Promise<void>;
  createProposal(userId: string, title: string, description: string, category: string, geoRestrictions?: string[], voteTokenAddress?: string): Promise<any>;
  updateProposal(proposalId: string, updates: any): Promise<any | undefined>;
  updateProposalVotes(proposalId: string, position: string): Promise<void>;
  getProposal(proposalId: string): Promise<any | undefined>;
  getAllProposals(): Promise<any[]>;
  updateUserVerification(userId: string, verification: VerificationData): Promise<void>;
  canVoteInGeo(userId: string, proposalGeoRestrictions: string[]): Promise<boolean>;
  createPricingPlan(plan: Omit<PricingPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<PricingPlan>;
  updatePricingPlan(id: string, updates: Partial<PricingPlan>): Promise<PricingPlan | undefined>;
  deletePricingPlan(id: string): Promise<void>;
  getPricingPlan(id: string): Promise<PricingPlan | undefined>;
  getAllPricingPlans(): Promise<PricingPlan[]>;
  getPlatformSetting(key: string): Promise<any>;
  setPlatformSetting(key: string, value: any, description?: string): Promise<void>;
  claimVoteToken(userId: string, proposalId: string, voteTokenAddress: string): Promise<boolean>;
  hasClaimedToken(userId: string, proposalId: string): Promise<boolean>;
  getTokenClaim(userId: string, proposalId: string): Promise<any>;
  getPassportNFT(userId: string): Promise<PassportNFT | undefined>;
  // Org management (mobile app endpoints)
  getUserOrganizationsWithDetails(userId: string): Promise<any[]>;
  deleteOrganization(orgId: string): Promise<void>;
  hasUserVotedOnProposal(userId: string, proposalId: string): Promise<boolean>;
  // Org invite codes
  getOrgInviteCodes(orgId: string): Promise<any[]>;
  createOrgInviteCode(orgId: string, createdBy: string, maxUses?: number, expiresAt?: Date): Promise<any>;
  revokeOrgInviteCode(codeString: string, orgId: string): Promise<boolean>;
  findOrgInviteCodeByCode(code: string): Promise<any>;
  incrementInviteCodeUses(codeId: string): Promise<void>;
  consumeInviteCode(codeId: string): Promise<boolean>;
  // Org announcements
  getOrgAnnouncements(orgId: string): Promise<any[]>;
  createOrgAnnouncement(orgId: string, title: string, content: string, pinned: boolean): Promise<any>;
  // Org proposals
  getOrgProposals(orgId: string): Promise<any[]>;
  getOrgProposalLimits(orgId: string, userId: string): Promise<{ created: number; limit: number; period: string; resetDate: Date }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = result[0];
    if (user) {
      console.log(`[STORAGE DEBUG] getUser(${id}) returned: country=${user.country}, state=${user.state}, city=${user.city}, verified=${user.verified}`);
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const newUser: User = {
      ...insertUser,
      id,
      walletAddress: null,
      verified: false,
      isAdmin: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.insert(users).values(newUser);
    return newUser;
  }

  async upsertUser(upsertUser: UpsertUser): Promise<User> {
    const id = upsertUser.id || randomUUID();

    // First check if user exists by ID
    let existingUser = await this.getUser(id);

    // If not found by ID, check by email to unify accounts across auth providers
    if (!existingUser && upsertUser.email) {
      existingUser = await this.getUserByEmail(upsertUser.email);
    }

    // If found by email (different auth provider), use existing user's ID
    const effectiveId = existingUser?.id || id;

    // Only include defined fields from upsertUser to avoid overwriting existing data with undefined
    const definedFields: Partial<User> = {};
    for (const [key, value] of Object.entries(upsertUser)) {
      if (value !== undefined) {
        (definedFields as any)[key] = value;
      }
    }

    const user: User = {
      ...existingUser,
      ...definedFields,
      id: effectiveId,
      // Preserve verification data - never overwrite with undefined/null
      verified: existingUser?.verified || false,
      verificationId: existingUser?.verificationId || null,
      verificationMethod: existingUser?.verificationMethod || null,
      verifiedAt: existingUser?.verifiedAt || null,
      // Preserve location data - never overwrite with undefined/null from OAuth
      country: existingUser?.country || (definedFields as any).country || null,
      state: existingUser?.state || (definedFields as any).state || null,
      city: existingUser?.city || (definedFields as any).city || null,
      documentType: existingUser?.documentType || (definedFields as any).documentType || null,
      gender: existingUser?.gender || (definedFields as any).gender || null,
      dateOfBirth: existingUser?.dateOfBirth || (definedFields as any).dateOfBirth || null,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    if (existingUser) {
      await db.update(users).set(user).where(eq(users.id, effectiveId));
    } else {
      await db.insert(users).values(user);
    }
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existingUser = await this.getUser(id);
    if (!existingUser) return undefined;

    const user: User = {
      ...existingUser,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    await db.update(users).set(user).where(eq(users.id, id));
    return user;
  }

  async getUserWallet(userId: string): Promise<Wallet | undefined> {
    const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
    const wallet = result[0];
    if (!wallet) return undefined;
    const needsDecrypt = wallet.encrypted || (!wallet.encrypted && wallet.privateKey && isEncrypted(wallet.privateKey));
    if (needsDecrypt && wallet.privateKey) {
      // Fail fast — if decryption fails the key is unusable; callers must not silently proceed
      const decrypted = decryptPrivateKey(wallet.privateKey);
      return { ...wallet, privateKey: decrypted };
    }
    return wallet;
  }

  async createWallet(userId: string, address: string, privateKey?: string): Promise<Wallet> {
    const id = randomUUID();
    const rawKey = privateKey || '';
    const encryptedKey = rawKey ? encryptPrivateKey(rawKey) : '';
    const wallet: Wallet = {
      id,
      userId,
      address,
      privateKey: encryptedKey,
      encrypted: true,
      deployedAt: new Date(),
    };

    await db.insert(wallets).values(wallet);

    // Update user with wallet address
    const user = await this.getUser(userId);
    if (user) {
      await db.update(users).set({ walletAddress: address }).where(eq(users.id, userId));
    }

    // Return wallet with the original (decrypted) private key so callers can use it immediately
    return { ...wallet, privateKey: rawKey };
  }

  async recordVote(userId: string, proposalId: string, position: string, voteTokenId?: string, txHash?: string, selectedOption?: string): Promise<void> {
    const voteId = randomUUID();
    await db.insert(votes).values({
      id: voteId,
      userId,
      proposalId,
      position,
      selectedOption,
      voteTokenId,
      txHash,
      timestamp: new Date(),
    });
  }

  // Backfills the on-chain tx hash after the fire-and-forget relay confirms.
  // Safe because (userId, proposalId) is unique — one vote per person per ballot.
  async updateVoteTxHash(userId: string, proposalId: string, txHash: string): Promise<void> {
    await db.update(votes).set({ txHash }).where(and(eq(votes.userId, userId), eq(votes.proposalId, proposalId)));
  }

  async getUserVotedProposals(userId: string): Promise<string[]> {
    const result = await db.select({ proposalId: votes.proposalId }).from(votes).where(eq(votes.userId, userId));
    return result.map(r => r.proposalId);
  }

  async hasUserVotedOnProposal(userId: string, proposalId: string): Promise<boolean> {
    const result = await db.select().from(votes).where(and(eq(votes.userId, userId), eq(votes.proposalId, proposalId))).limit(1);
    return result.length > 0;
  }

  async getProposalsByUser(userId: string): Promise<any[]> {
    return await db.select().from(proposals).where(eq(proposals.userId, userId));
  }

  async isProposalClosed(proposalId: string): Promise<boolean> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal || !proposal.deadline) return false;
    return new Date(proposal.deadline) < new Date();
  }

  async createProposal(userId: string, title: string, description: string, category: string, geoRestrictions?: string[], voteTokenAddress?: string, riding?: string, demographicRestrictions?: any): Promise<any> {
    const proposalId = randomUUID();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 14);
    await db.insert(proposals).values({
      id: proposalId,
      userId,
      title,
      description,
      category,
      supportVotes: 0,
      opposeVotes: 0,
      createdAt: new Date(),
      deadline,
      geoRestrictions: geoRestrictions || [],
      voteTokenAddress,
      riding: riding || null,
      demographicRestrictions: demographicRestrictions || {},
    });
    return this.getProposal(proposalId);
  }

  async getUserVerifiedRidings(userId: string): Promise<string[]> {
    const result = await db.select({ riding: ridingVerifications.riding }).from(ridingVerifications).where(eq(ridingVerifications.userId, userId));
    return result.map(r => r.riding);
  }

  async updateProposal(proposalId: string, updates: any): Promise<any | undefined> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return undefined;

    const updated = { ...proposal, ...updates };
    await db.update(proposals).set(updated).where(eq(proposals.id, proposalId));
    return updated;
  }

  async toggleProposalFeatured(proposalId: string): Promise<any | undefined> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return undefined;
    const newFeatured = !proposal.isFeatured;
    return this.updateProposal(proposalId, { isFeatured: newFeatured });
  }

  async getFeaturedProposals(): Promise<any[]> {
    return await db.select().from(proposals).where(eq(proposals.isFeatured, true)).limit(5);
  }

  async updateProposalVotes(proposalId: string, position: string): Promise<void> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) return;

    const updates = position === 'support'
      ? { supportVotes: proposal.supportVotes + 1 }
      : { opposeVotes: proposal.opposeVotes + 1 };

    await db.update(proposals).set(updates).where(eq(proposals.id, proposalId));
  }

  async getProposal(proposalId: string): Promise<any | undefined> {
    const result = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    return result[0];
  }

  async getAllProposals(): Promise<any[]> {
    return await db.select().from(proposals);
  }

  async updateUserVerification(userId: string, verification: VerificationData): Promise<void> {
    const updateData: any = {
      verified: verification.verified,
      verificationId: verification.verificationId,
      verificationMethod: verification.verificationMethod,
      verifiedAt: verification.verifiedAt,
    };

    // Include optional geographic and demographic fields if provided
    if (verification.country) updateData.country = verification.country;
    if (verification.state) updateData.state = verification.state;
    if (verification.city) updateData.city = verification.city;
    if (verification.documentType) updateData.documentType = verification.documentType;
    if (verification.gender) updateData.gender = verification.gender;
    if (verification.dateOfBirth) updateData.dateOfBirth = verification.dateOfBirth;
    if ((verification as any).citizenshipVerified) {
      updateData.citizenshipVerified = true;
      updateData.citizenshipVerifiedAt = (verification as any).citizenshipVerifiedAt ?? new Date();
    }

    await db.update(users).set(updateData).where(eq(users.id, userId));
  }

  async canVoteInGeo(userId: string, proposalGeoRestrictions: string[]): Promise<boolean> {
    if (!proposalGeoRestrictions || proposalGeoRestrictions.length === 0) {
      return true;
    }

    // For now, allow all votes (simplified logic)
    return true;
  }

  async createPricingPlan(plan: Omit<PricingPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<PricingPlan> {
    const id = randomUUID();
    const pricingPlan: PricingPlan = {
      ...plan,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await db.insert(pricingPlans).values(pricingPlan);
    return pricingPlan;
  }

  async updatePricingPlan(id: string, updates: Partial<PricingPlan>): Promise<PricingPlan | undefined> {
    const plan = await this.getPricingPlan(id);
    if (!plan) return undefined;

    const updated: PricingPlan = { ...plan, ...updates, updatedAt: new Date() };
    await db.update(pricingPlans).set(updated).where(eq(pricingPlans.id, id));
    return updated;
  }

  async deletePricingPlan(id: string): Promise<void> {
    await db.delete(pricingPlans).where(eq(pricingPlans.id, id));
  }

  async getPricingPlan(id: string): Promise<PricingPlan | undefined> {
    const result = await db.select().from(pricingPlans).where(eq(pricingPlans.id, id)).limit(1);
    return result[0];
  }

  async getAllPricingPlans(): Promise<PricingPlan[]> {
    return await db.select().from(pricingPlans);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getAllVotes(): Promise<any[]> {
    return await db.select().from(votes);
  }

  async getPlatformSetting(key: string): Promise<any> {
    const result = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    return result[0]?.value || null;
  }

  async setPlatformSetting(key: string, value: any, description?: string): Promise<void> {
    const existing = await db.select().from(platformSettings).where(eq(platformSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(platformSettings).set({ value, description, updatedAt: new Date() }).where(eq(platformSettings.key, key));
    } else {
      await db.insert(platformSettings).values({ id: randomUUID(), key, value, description, updatedAt: new Date() });
    }
  }

  async claimVoteToken(userId: string, proposalId: string, voteTokenAddress: string): Promise<boolean> {
    try {
      // Check if already claimed
      const existing = await db.select().from(voteTokenClaims).where(
        and(eq(voteTokenClaims.userId, userId), eq(voteTokenClaims.proposalId, proposalId))
      ).limit(1);

      if (existing.length > 0) {
        return false; // Already claimed
      }

      // Create claim
      await db.insert(voteTokenClaims).values({
        id: randomUUID(),
        userId,
        proposalId,
        voteTokenAddress,
        claimedAt: new Date(),
      });

      return true;
    } catch (error) {
      console.error('Error claiming token:', error);
      return false;
    }
  }

  async hasClaimedToken(userId: string, proposalId: string): Promise<boolean> {
    const result = await db.select().from(voteTokenClaims).where(
      and(eq(voteTokenClaims.userId, userId), eq(voteTokenClaims.proposalId, proposalId))
    ).limit(1);
    return result.length > 0;
  }

  async getTokenClaim(userId: string, proposalId: string): Promise<any> {
    const result = await db.select().from(voteTokenClaims).where(
      and(eq(voteTokenClaims.userId, userId), eq(voteTokenClaims.proposalId, proposalId))
    ).limit(1);
    return result[0];
  }

  async getPassportNFT(userId: string): Promise<PassportNFT | undefined> {
    const result = await db.select().from(passportNFTs).where(eq(passportNFTs.userId, userId)).limit(1);
    return result[0];
  }

  async savePassportNFT(userId: string, nftTokenId: string, contractAddress: string, txHash: string): Promise<PassportNFT> {
    const result = await db.insert(passportNFTs).values({
      id: randomUUID(),
      userId,
      nftTokenId,
      contractAddress,
      txHash,
      mintedAt: new Date(),
    }).returning();
    return result[0];
  }

  async verifyUserRiding(userId: string, ridingCode: string): Promise<void> {
    const verificationId = randomUUID();
    await db.insert(ridingVerifications).values({
      id: verificationId,
      userId,
      riding: ridingCode,
      ridingCode,
      verifiedAt: new Date(),
    });
  }

  async getRidingVerification(userId: string, ridingCode: string): Promise<any> {
    const result = await db.select().from(ridingVerifications)
      .where(and(eq(ridingVerifications.userId, userId), eq(ridingVerifications.riding, ridingCode)))
      .limit(1);
    return result[0];
  }

  async createElectoralRidingQRCode(ridingCode: string, ridingName: string, qrDataUrl: string): Promise<ElectoralRidingQRCode> {
    const result = await db.insert(electoralRidingQRCodes).values({
      id: randomUUID(),
      ridingCode,
      ridingName,
      qrDataUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getAllElectoralRidingQRCodes(): Promise<ElectoralRidingQRCode[]> {
    return await db.select().from(electoralRidingQRCodes).orderBy(electoralRidingQRCodes.createdAt);
  }

  async deleteElectoralRidingQRCode(id: string): Promise<void> {
    await db.delete(electoralRidingQRCodes).where(eq(electoralRidingQRCodes.id, id));
  }

  async updateUserStripeInfo(userId: string, stripeInfo: any): Promise<void> {
    await db.update(users).set(stripeInfo).where(eq(users.id, userId));
  }

  // ─── Ballot system: daily-cap enforcement and one-time grant tracking ──────

  async markInitialBallotsGranted(userId: string): Promise<void> {
    await db.update(users).set({ initialBallotsGranted: true } as any).where(eq(users.id, userId));
  }

  async incrementBallotsUsedToday(userId: string): Promise<void> {
    await db.update(users)
      .set({ ballotsUsedToday: sql`coalesce(${users.ballotsUsedToday}, 0) + 1` } as any)
      .where(eq(users.id, userId));
  }

  // Lazy daily reset: if ballotsResetAt is on a previous calendar day (UTC),
  // reset counter to 0 and stamp a new resetAt. Returns the (possibly reset)
  // current count so the caller can enforce the cap in one read.
  async resetBallotsIfStale(userId: string): Promise<number> {
    const result = await db.select({
      usedToday: users.ballotsUsedToday,
      resetAt: users.ballotsResetAt,
    }).from(users).where(eq(users.id, userId)).limit(1);
    const row = result[0];
    if (!row) return 0;
    const now = new Date();
    const lastReset = row.resetAt ? new Date(row.resetAt) : new Date(0);
    const sameDay = lastReset.getUTCFullYear() === now.getUTCFullYear()
      && lastReset.getUTCMonth() === now.getUTCMonth()
      && lastReset.getUTCDate() === now.getUTCDate();
    if (!sameDay) {
      await db.update(users)
        .set({ ballotsUsedToday: 0, ballotsResetAt: now } as any)
        .where(eq(users.id, userId));
      return 0;
    }
    return row.usedToday ?? 0;
  }

  async getUsersNeedingInitialGrant(): Promise<any[]> {
    return await db.select().from(users).where(
      and(eq(users.verified, true), eq(users.initialBallotsGranted, false))
    );
  }

  async createOrganization(name: string, creatorId: string, type: string, membershipType: string, emailDomain?: string): Promise<any> {
    const inviteCode = 'ORG-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const result = await db.insert(organizations).values({
      id: randomUUID(),
      name,
      creatorId,
      type,
      membershipType,
      emailDomain: emailDomain || null,
      inviteCode,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return result[0];
  }

  async getOrganization(orgId: string): Promise<any> {
    const result = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    return result[0];
  }

  async addOrganizationMember(organizationId: string, userId: string, role: string = 'member'): Promise<void> {
    await db.insert(organizationMembers).values({
      id: randomUUID(),
      organizationId,
      userId,
      role,
      joinedAt: new Date(),
    }).onConflictDoNothing();
  }

  // (isOrganizationMember moved further down — recursive variant that includes
  // sub-org descendants. The strict direct-membership check is exposed as
  // isDirectOrganizationMember for places that need it.)

  async getUserOrganizations(userId: string): Promise<any[]> {
    const result = await db.select().from(organizationMembers).where(
      eq(organizationMembers.userId, userId)
    );
    return result;
  }

  async getOrganizationMembers(organizationId: string): Promise<any[]> {
    const result = await db.select().from(organizationMembers).where(
      eq(organizationMembers.organizationId, organizationId)
    );
    return result;
  }

  async getOrganizationMemberCount(organizationId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
    return Number(result[0]?.count ?? 0);
  }

  // IAP attribution lookups. Apple's App Store Server Notifications V2
  // identify the subscription only by originalTransactionId; we need to
  // find the right user or org row to update on renewal/refund/cancel.
  async findUserByIapTxId(originalTransactionId: string): Promise<any | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.iapOriginalTransactionId, originalTransactionId))
      .limit(1);
    return result[0];
  }

  async findOrganizationByIapTxId(originalTransactionId: string): Promise<any | undefined> {
    const result = await db
      .select()
      .from(organizations)
      .where(eq(organizations.iapOriginalTransactionId, originalTransactionId))
      .limit(1);
    return result[0];
  }

  async getOrganizationByInviteCode(inviteCode: string): Promise<any> {
    const result = await db.select().from(organizations).where(
      eq(organizations.inviteCode, inviteCode)
    ).limit(1);
    return result[0];
  }

  async removeOrganizationMember(organizationId: string, userId: string): Promise<void> {
    await db.delete(organizationMembers).where(
      and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId))
    );
  }

  async updateOrganizationBranding(organizationId: string, branding: any): Promise<any> {
    const org = await this.getOrganization(organizationId);
    if (!org) return undefined;

    // Explicitly map branding fields to schema field names
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (branding.logoUrl !== undefined) updateData.logoUrl = branding.logoUrl;
    if (branding.primaryColor !== undefined) updateData.primaryColor = branding.primaryColor;
    if (branding.secondaryColor !== undefined) updateData.secondaryColor = branding.secondaryColor;
    if (branding.customDomain !== undefined) updateData.customDomain = branding.customDomain;

    await db.update(organizations).set(updateData).where(eq(organizations.id, organizationId));

    const updated = await this.getOrganization(organizationId);
    return updated;
  }

  async updateOrganizationOAuth(organizationId: string, oauthConfig: any): Promise<any> {
    const org = await this.getOrganization(organizationId);
    if (!org) return undefined;

    const updated = { ...org, ...oauthConfig, updatedAt: new Date() };
    await db.update(organizations).set(updated).where(eq(organizations.id, organizationId));
    return updated;
  }

  async getOrganizationByCustomDomain(customDomain: string): Promise<any> {
    const result = await db.select().from(organizations).where(
      eq(organizations.customDomain, customDomain)
    ).limit(1);
    return result[0];
  }

  async getOrganizationByOAuthProvider(provider: string): Promise<any[]> {
    const result = await db.select().from(organizations).where(
      eq(organizations.oauthProvider, provider)
    );
    return result;
  }

  async generateReferralCode(userId: string): Promise<string> {
    const code = 'REP' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const existing = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);

    if (existing.length > 0) {
      // Delete old code and create new one
      await db.delete(referralCodes).where(eq(referralCodes.userId, userId));
    }

    await db.insert(referralCodes).values({
      id: randomUUID(),
      userId,
      code,
      createdAt: new Date(),
    });

    return code;
  }

  async getReferralCode(userId: string): Promise<string | null> {
    const result = await db.select().from(referralCodes).where(eq(referralCodes.userId, userId)).limit(1);
    return result[0]?.code || null;
  }

  async getReferralStats(userId: string): Promise<any> {
    const code = await this.getReferralCode(userId);
    const referralList = code ? await db.select().from(referrals).where(eq(referrals.referralCode, code)) : [];

    return {
      code: code || 'NO_CODE',
      referredCount: referralList.length,
      rewardsEarned: Math.floor(referralList.length / 3),
      rewardType: 'subscription_months',
      rewardAmount: '1',
      config: {
        referrerThreshold: 3
      }
    };
  }

  async getUserOrganizationsWithDetails(userId: string): Promise<any[]> {
    const memberships = await db.select().from(organizationMembers).where(
      eq(organizationMembers.userId, userId)
    );
    const orgs = await Promise.all(
      memberships.map(async (m) => {
        const org = await this.getOrganization(m.organizationId);
        if (!org) return null;
        const countRes: any = await db.execute(sql`
          SELECT COUNT(*)::int AS count FROM organization_members
          WHERE organization_id = ${m.organizationId}
        `);
        const rows = Array.isArray(countRes) ? countRes : (countRes?.rows ?? []);
        const memberCount = Number(rows[0]?.count) || 0;
        return { ...org, role: m.role, memberCount };
      })
    );
    return orgs.filter(Boolean);
  }

  async deleteOrganization(orgId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Gather all proposal IDs for this org so we can delete their dependents
      const orgProposals = await tx.select({ id: proposals.id }).from(proposals)
        .where(eq(proposals.organizationId, orgId));
      const proposalIds = orgProposals.map(p => p.id);

      // Delete votes, token claims, and option addresses that reference org
      // proposals (FK deps must go before the proposal rows themselves).
      for (const proposalId of proposalIds) {
        await tx.delete(votes).where(eq(votes.proposalId, proposalId));
        await tx.delete(voteTokenClaims).where(eq(voteTokenClaims.proposalId, proposalId));
        await tx.delete(proposalOptionAddresses).where(eq(proposalOptionAddresses.proposalId, proposalId));
      }

      // Delete org proposals themselves
      await tx.delete(proposals).where(eq(proposals.organizationId, orgId));

      // Delete org-level tables then the org itself
      await tx.delete(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
      await tx.delete(organizationInviteCodes).where(eq(organizationInviteCodes.organizationId, orgId));
      await tx.delete(organizationAnnouncements).where(eq(organizationAnnouncements.organizationId, orgId));
      await tx.delete(organizations).where(eq(organizations.id, orgId));
    });
  }

  async getOrgInviteCodes(orgId: string): Promise<any[]> {
    return await db.select().from(organizationInviteCodes)
      .where(eq(organizationInviteCodes.organizationId, orgId))
      .orderBy(organizationInviteCodes.createdAt);
  }

  async createOrgInviteCode(orgId: string, createdBy: string, maxUses?: number, expiresAt?: Date): Promise<any> {
    const code = 'INV-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const result = await db.insert(organizationInviteCodes).values({
      id: randomUUID(),
      organizationId: orgId,
      code,
      createdBy,
      uses: 0,
      maxUses: maxUses || null,
      expiresAt: expiresAt || null,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async revokeOrgInviteCode(codeString: string, orgId: string): Promise<boolean> {
    // Mobile passes the invite code string (e.g. "INV-XXXX"), not the DB row id.
    // Delete by the `code` column scoped to this org to prevent cross-org IDOR.
    const result = await db.delete(organizationInviteCodes).where(
      and(eq(organizationInviteCodes.code, codeString), eq(organizationInviteCodes.organizationId, orgId))
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findOrgInviteCodeByCode(code: string): Promise<any> {
    const result = await db.select().from(organizationInviteCodes)
      .where(eq(organizationInviteCodes.code, code)).limit(1);
    return result[0];
  }

  async incrementInviteCodeUses(codeId: string): Promise<void> {
    // Atomic increment — single SQL update avoids read-then-write race condition
    await db.update(organizationInviteCodes)
      .set({ uses: sql`coalesce(${organizationInviteCodes.uses}, 0) + 1` })
      .where(eq(organizationInviteCodes.id, codeId));
  }

  async consumeInviteCode(codeId: string): Promise<boolean> {
    // Atomically enforce maxUses AND increment in a single conditional UPDATE.
    // Returns true if the increment succeeded (slot was available), false if
    // maxUses was already reached (the WHERE clause blocked the update).
    const result = await db.update(organizationInviteCodes)
      .set({ uses: sql`coalesce(${organizationInviteCodes.uses}, 0) + 1` })
      .where(
        and(
          eq(organizationInviteCodes.id, codeId),
          sql`(${organizationInviteCodes.maxUses} IS NULL OR coalesce(${organizationInviteCodes.uses}, 0) < ${organizationInviteCodes.maxUses})`
        )
      );
    return (result.rowCount ?? 0) > 0;
  }

  // ---------- Per-email invitations (CSV roster import + single-invite UI) ----------

  async createOrgInvites(rows: Array<{
    organizationId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    metadata?: any;
    invitedBy: string;
    inviteToken: string;
    expiresAt: Date;
  }>): Promise<any[]> {
    if (rows.length === 0) return [];
    const values = rows.map(r => ({
      id: randomUUID(),
      organizationId: r.organizationId,
      email: r.email.toLowerCase().trim(),
      firstName: r.firstName ?? null,
      lastName: r.lastName ?? null,
      inviteToken: r.inviteToken,
      invitedBy: r.invitedBy,
      role: r.role ?? 'member',
      status: 'pending',
      metadata: r.metadata ?? null,
      invitedAt: new Date(),
      expiresAt: r.expiresAt,
    }));
    // ON CONFLICT DO NOTHING: if a pending invite already exists for the same
    // (orgId, email) — e.g. the admin re-uploads a CSV with overlap — we skip
    // silently rather than erroring. The unique constraint catches it.
    const result = await db.insert(organizationInvites).values(values)
      .onConflictDoNothing({ target: [organizationInvites.organizationId, organizationInvites.email] })
      .returning();
    return result;
  }

  async getOrgInvites(orgId: string, status?: string): Promise<any[]> {
    const conds = [eq(organizationInvites.organizationId, orgId)];
    if (status) conds.push(eq(organizationInvites.status, status));
    return await db.select().from(organizationInvites)
      .where(and(...conds))
      .orderBy(organizationInvites.invitedAt);
  }

  async findOrgInviteByToken(token: string): Promise<any> {
    const result = await db.select().from(organizationInvites)
      .where(eq(organizationInvites.inviteToken, token)).limit(1);
    return result[0];
  }

  async findPendingInviteForUser(orgId: string, email: string): Promise<any> {
    const result = await db.select().from(organizationInvites)
      .where(and(
        eq(organizationInvites.organizationId, orgId),
        eq(organizationInvites.email, email.toLowerCase().trim()),
        eq(organizationInvites.status, 'pending'),
      )).limit(1);
    return result[0];
  }

  async markInviteAccepted(inviteId: string): Promise<void> {
    await db.update(organizationInvites)
      .set({ status: 'accepted', acceptedAt: new Date() })
      .where(eq(organizationInvites.id, inviteId));
  }

  async revokeOrgInvite(inviteId: string, orgId: string): Promise<boolean> {
    const result = await db.update(organizationInvites)
      .set({ status: 'revoked' })
      .where(and(
        eq(organizationInvites.id, inviteId),
        eq(organizationInvites.organizationId, orgId),
        eq(organizationInvites.status, 'pending'),
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async getExistingMemberEmails(orgId: string, emails: string[]): Promise<Set<string>> {
    if (emails.length === 0) return new Set();
    const lower = emails.map(e => e.toLowerCase().trim());
    const rows = await db.select({ email: users.email })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(and(
        eq(organizationMembers.organizationId, orgId),
        sql`lower(${users.email}) = ANY(${lower})`,
      ));
    return new Set(rows.map(r => (r.email || '').toLowerCase()));
  }

  async getOrgAnnouncements(orgId: string): Promise<any[]> {
    return await db.select().from(organizationAnnouncements)
      .where(eq(organizationAnnouncements.organizationId, orgId))
      .orderBy(organizationAnnouncements.createdAt);
  }

  async createOrgAnnouncement(orgId: string, title: string, content: string, pinned: boolean = false): Promise<any> {
    const result = await db.insert(organizationAnnouncements).values({
      id: randomUUID(),
      organizationId: orgId,
      title,
      content,
      pinned,
      createdAt: new Date(),
    }).returning();
    return result[0];
  }

  async getOrgProposals(orgId: string): Promise<any[]> {
    return await db.select().from(proposals)
      .where(eq(proposals.organizationId, orgId))
      .orderBy(proposals.createdAt);
  }

  // Per-option vote counts for multiple-choice proposals.
  // RCV uses getRankedBallots below — these helpers don't share code
  // because the column semantics differ ('selected_option' is the chosen
  // option string for multi-choice but a JSON-encoded rankings array for
  // ranked-choice).
  async countVotesPerOption(proposalId: string): Promise<Record<string, number>> {
    const rows = await db
      .select({ option: votes.selectedOption, count: sql<number>`count(*)::int` })
      .from(votes)
      .where(and(
        eq(votes.proposalId, proposalId),
        eq(votes.position, 'multiple-choice'),
      ))
      .groupBy(votes.selectedOption);
    const result: Record<string, number> = {};
    for (const r of rows as any[]) {
      if (r.option) result[r.option] = Number(r.count ?? 0);
    }
    return result;
  }

  // Raw ballot strings for RCV proposals. Each entry is the JSON
  // serialization of the voter's preference array. Caller (the /results
  // endpoint) parses + feeds to computeIRV.
  async getRankedBallots(proposalId: string): Promise<string[]> {
    const rows = await db
      .select({ rankings: votes.selectedOption })
      .from(votes)
      .where(and(
        eq(votes.proposalId, proposalId),
        eq(votes.position, 'ranked-choice'),
      ));
    return (rows as any[])
      .map(r => r.rankings)
      .filter((r): r is string => typeof r === 'string' && r.length > 0);
  }

  // Audit log: every vote on every proposal in this org. Joins through
  // proposals (votes don't carry organizationId directly) and through users
  // for verification status. Voter identity (email/name) is included only
  // when the caller asked for it; the route handler hashes voter ids when
  // includeVoterIdentity=false. Returned fields map 1:1 to AuditLogRow in
  // the export endpoint.
  async getOrgAuditLog(orgId: string): Promise<Array<{
    voteId: string;
    proposalId: string;
    proposalTitle: string;
    proposalCreatedAt: Date | null;
    proposalDeadline: Date | null;
    voterId: string;
    voterEmail: string | null;
    voterName: string | null;
    voterVerified: boolean;
    position: string;
    selectedOption: string | null;
    voteTokenId: string | null;
    txHash: string | null;
    castAt: Date | null;
  }>> {
    const rows = await db
      .select({
        voteId: votes.id,
        proposalId: votes.proposalId,
        proposalTitle: proposals.title,
        proposalCreatedAt: proposals.createdAt,
        proposalDeadline: proposals.deadline,
        voterId: votes.userId,
        voterEmail: users.email,
        voterName: users.name,
        voterVerified: users.verified,
        position: votes.position,
        selectedOption: votes.selectedOption,
        voteTokenId: votes.voteTokenId,
        txHash: votes.txHash,
        castAt: votes.timestamp,
      })
      .from(votes)
      .innerJoin(proposals, eq(votes.proposalId, proposals.id))
      .leftJoin(users, eq(votes.userId, users.id))
      .where(eq(proposals.organizationId, orgId))
      .orderBy(votes.timestamp);

    return rows.map((r: any) => ({
      voteId: r.voteId,
      proposalId: r.proposalId,
      proposalTitle: r.proposalTitle ?? '',
      proposalCreatedAt: r.proposalCreatedAt,
      proposalDeadline: r.proposalDeadline,
      voterId: r.voterId,
      voterEmail: r.voterEmail ?? null,
      voterName: r.voterName ?? null,
      voterVerified: !!r.voterVerified,
      position: r.position ?? '',
      selectedOption: r.selectedOption ?? null,
      voteTokenId: r.voteTokenId ?? null,
      txHash: r.txHash ?? null,
      castAt: r.castAt,
    }));
  }

  async getOrgProposalLimits(orgId: string, userId: string): Promise<{ created: number; limit: number; period: string; resetDate: Date }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const result = await db.select().from(proposals).where(
      and(
        eq(proposals.organizationId, orgId),
        eq(proposals.userId, userId),
        gte(proposals.createdAt, startOfMonth),
        lt(proposals.createdAt, startOfNextMonth)
      )
    );

    return {
      created: result.length,
      limit: 10,
      period: 'month',
      resetDate: startOfNextMonth,
    };
  }

  // Atomic ballot consumption: combines lazy reset + cap check + increment in
  // a single SQL UPDATE. Eliminates the TOCTOU race where two concurrent
  // requests could both pass the read-time cap check.
  // Returns true if a ballot was consumed; false if the daily cap was reached.
  async consumeBallot(userId: string, dailyCap: number): Promise<boolean> {
    const result = await db.execute(sql`
      UPDATE users
      SET
        ballots_used_today = CASE
          WHEN ballots_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date THEN 1
          ELSE COALESCE(ballots_used_today, 0) + 1
        END,
        ballots_reset_at = CASE
          WHEN ballots_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date THEN NOW()
          ELSE ballots_reset_at
        END
      WHERE id = ${userId}
        AND (
          ballots_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date
          OR COALESCE(ballots_used_today, 0) < ${dailyCap}
        )
      RETURNING ballots_used_today
    `);
    // neon-http returns an array of rows directly; pg returns { rows, rowCount }
    const r: any = result;
    if (Array.isArray(r)) return r.length > 0;
    if (typeof r?.rowCount === "number") return r.rowCount > 0;
    if (Array.isArray(r?.rows)) return r.rows.length > 0;
    return false;
  }

  // Same atomic-update pattern for Sentinel AI daily quota.
  async consumeSentinelUse(userId: string, dailyCap: number): Promise<boolean> {
    const result = await db.execute(sql`
      UPDATE users
      SET
        sentinel_uses_today = CASE
          WHEN sentinel_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date THEN 1
          ELSE COALESCE(sentinel_uses_today, 0) + 1
        END,
        sentinel_reset_at = CASE
          WHEN sentinel_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date THEN NOW()
          ELSE sentinel_reset_at
        END
      WHERE id = ${userId}
        AND (
          sentinel_reset_at::date < (NOW() AT TIME ZONE 'UTC')::date
          OR COALESCE(sentinel_uses_today, 0) < ${dailyCap}
        )
      RETURNING sentinel_uses_today
    `);
    // neon-http returns an array of rows directly; pg returns { rows, rowCount }
    const r: any = result;
    if (Array.isArray(r)) return r.length > 0;
    if (typeof r?.rowCount === "number") return r.rowCount > 0;
    if (Array.isArray(r?.rows)) return r.rows.length > 0;
    return false;
  }

  // Soft-delete: anonymize PII but keep the user row so vote counts and
  // proposal authorship stay intact. Email is rewritten to a sentinel value
  // so the unique index is satisfied and the original address is freed.
  async deleteUser(userId: string): Promise<void> {
    const sentinelEmail = `deleted_${userId}@represent.invalid`;
    await db.update(users)
      .set({
        email: sentinelEmail,
        name: null,
        firstName: null,
        lastName: null,
        profileImageUrl: null,
        walletAddress: null,
        verificationId: null,
        country: null,
        state: null,
        city: null,
        gender: null,
        dateOfBirth: null,
        deleted: true,
        updatedAt: new Date(),
      } as any)
      .where(eq(users.id, userId));
  }

  // ─── Sub-organizations: hierarchical orgs (parent → child) ─────────────────

  // Create a sub-org under an existing parent. The parent must exist; the
  // creator becomes the admin of the sub-org via addOrganizationMember.
  async createSubOrganization(
    parentOrgId: string,
    name: string,
    creatorId: string,
    type: string,
    membershipType: string = 'invite',
    description?: string,
  ): Promise<any> {
    const inviteCode = 'ORG-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    const result = await db.insert(organizations).values({
      id: randomUUID(),
      name,
      description,
      creatorId,
      type,
      membershipType,
      inviteCode,
      isActive: true,
      parentOrgId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any).returning();
    return result[0];
  }

  // Direct children only (one level down).
  async getSubOrganizations(parentOrgId: string): Promise<any[]> {
    const result = await db.select().from(organizations).where(
      and(eq(organizations.parentOrgId as any, parentOrgId), eq(organizations.isActive, true))
    );
    return result;
  }

  // Recursive: every descendant (children, grandchildren, …) including the
  // root itself. Used for visibility queries — "all orgs under X."
  async getOrganizationDescendantIds(rootOrgId: string): Promise<string[]> {
    const result: any = await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM organizations WHERE id = ${rootOrgId}
        UNION
        SELECT o.id FROM organizations o
        JOIN descendants d ON o.parent_org_id = d.id
        WHERE o.is_active = true
      )
      SELECT id FROM descendants
    `);
    const rows = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.map((r: any) => r.id);
  }

  // Effective membership: user is considered a member of orgId if they are
  // a direct member of orgId OR a direct member of any descendant of orgId.
  // This is the check used by the voting endpoint and proposal visibility.
  async isOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
    const result: any = await db.execute(sql`
      WITH RECURSIVE descendants AS (
        SELECT id FROM organizations WHERE id = ${organizationId}
        UNION
        SELECT o.id FROM organizations o
        JOIN descendants d ON o.parent_org_id = d.id
        WHERE o.is_active = true
      )
      SELECT 1 FROM organization_members om
      WHERE om.user_id = ${userId}
        AND om.organization_id IN (SELECT id FROM descendants)
      LIMIT 1
    `);
    const rows = Array.isArray(result) ? result : (result?.rows ?? []);
    return rows.length > 0;
  }

  // Strict variant: only direct membership in this exact org. Used when the
  // hierarchy traversal would be wrong — e.g., admin operations on the org
  // itself shouldn't grant from a parent admin without explicit ancestor
  // permission checks.
  async isDirectOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
    const result = await db.select().from(organizationMembers).where(
      and(eq(organizationMembers.organizationId, organizationId), eq(organizationMembers.userId, userId))
    ).limit(1);
    return result.length > 0;
  }

  // ─── Org insights: aggregate analytics across an org and its descendants ──

  // Returns counts + per-sub-org breakdown + 30-day vote time series, all
  // scoped to the given org and its descendants.
  async getOrganizationInsights(rootOrgId: string, periodDays: number = 30): Promise<any> {
    const descendantIds = await this.getOrganizationDescendantIds(rootOrgId);
    if (descendantIds.length === 0) {
      return { totalMembers: 0, subOrgCount: 0, totalProposals: 0, totalVotes: 0, participationRate: 0, subOrgs: [], voteTimeSeries: [] };
    }

    // Total unique members across this org and all descendants.
    const memberCountResult: any = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id)::int AS count FROM organization_members
      WHERE organization_id = ANY(${descendantIds})
    `);
    const memberRows = Array.isArray(memberCountResult) ? memberCountResult : (memberCountResult?.rows ?? []);
    const totalMembers = memberRows[0]?.count || 0;

    // Direct sub-orgs only (children, not grandchildren) for the breakdown.
    const directSubs = await this.getSubOrganizations(rootOrgId);

    // Total proposals in this org tree.
    const propCountResult: any = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM proposals
      WHERE organization_id = ANY(${descendantIds})
    `);
    const propRows = Array.isArray(propCountResult) ? propCountResult : (propCountResult?.rows ?? []);
    const totalProposals = propRows[0]?.count || 0;

    // Total votes on proposals in this org tree, within the period.
    const voteCountResult: any = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM votes v
      JOIN proposals p ON v.proposal_id = p.id
      WHERE p.organization_id = ANY(${descendantIds})
        AND v.timestamp >= NOW() - (${periodDays}::int * INTERVAL '1 day')
    `);
    const voteRows = Array.isArray(voteCountResult) ? voteCountResult : (voteCountResult?.rows ?? []);
    const totalVotes = voteRows[0]?.count || 0;

    // Participation rate: distinct voters / total members. Coarse but useful.
    const participantsResult: any = await db.execute(sql`
      SELECT COUNT(DISTINCT v.user_id)::int AS count FROM votes v
      JOIN proposals p ON v.proposal_id = p.id
      WHERE p.organization_id = ANY(${descendantIds})
        AND v.timestamp >= NOW() - (${periodDays}::int * INTERVAL '1 day')
    `);
    const partRows = Array.isArray(participantsResult) ? participantsResult : (participantsResult?.rows ?? []);
    const participants = partRows[0]?.count || 0;
    const participationRate = totalMembers > 0 ? participants / totalMembers : 0;

    // Per-sub-org breakdown (one level down only — keep payload bounded).
    const subOrgBreakdown = await Promise.all(directSubs.map(async (sub: any) => {
      const subDescendants = await this.getOrganizationDescendantIds(sub.id);
      const memberRes: any = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int AS count FROM organization_members
        WHERE organization_id = ANY(${subDescendants})
      `);
      const memCount = (Array.isArray(memberRes) ? memberRes : memberRes?.rows ?? [])[0]?.count || 0;
      const propRes: any = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM proposals
        WHERE organization_id = ANY(${subDescendants})
      `);
      const propCount = (Array.isArray(propRes) ? propRes : propRes?.rows ?? [])[0]?.count || 0;
      const voteRes: any = await db.execute(sql`
        SELECT COUNT(*)::int AS count FROM votes v
        JOIN proposals p ON v.proposal_id = p.id
        WHERE p.organization_id = ANY(${subDescendants})
          AND v.timestamp >= NOW() - (${periodDays}::int * INTERVAL '1 day')
      `);
      const vCount = (Array.isArray(voteRes) ? voteRes : voteRes?.rows ?? [])[0]?.count || 0;
      const partRes: any = await db.execute(sql`
        SELECT COUNT(DISTINCT v.user_id)::int AS count FROM votes v
        JOIN proposals p ON v.proposal_id = p.id
        WHERE p.organization_id = ANY(${subDescendants})
          AND v.timestamp >= NOW() - (${periodDays}::int * INTERVAL '1 day')
      `);
      const subParticipants = (Array.isArray(partRes) ? partRes : partRes?.rows ?? [])[0]?.count || 0;
      return {
        id: sub.id,
        name: sub.name,
        memberCount: memCount,
        proposalCount: propCount,
        voteCount: vCount,
        participationRate: memCount > 0 ? subParticipants / memCount : 0,
      };
    }));

    // 30-day vote time series for the sparkline.
    const seriesResult: any = await db.execute(sql`
      SELECT DATE(v.timestamp) AS day, COUNT(*)::int AS count
      FROM votes v
      JOIN proposals p ON v.proposal_id = p.id
      WHERE p.organization_id = ANY(${descendantIds})
        AND v.timestamp >= NOW() - (${periodDays}::int * INTERVAL '1 day')
      GROUP BY day
      ORDER BY day
    `);
    const seriesRows = Array.isArray(seriesResult) ? seriesResult : (seriesResult?.rows ?? []);
    const voteTimeSeries = seriesRows.map((r: any) => ({
      date: r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
      count: r.count,
    }));

    return {
      totalMembers,
      subOrgCount: directSubs.length,
      totalProposals,
      totalVotes,
      participationRate,
      subOrgs: subOrgBreakdown,
      voteTimeSeries,
      periodDays,
    };
  }
}

export const storage = new DatabaseStorage();
