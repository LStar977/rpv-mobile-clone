import { type User, type InsertUser, type UpsertUser, type Wallet, type PricingPlan } from "@shared/schema";
import { randomUUID } from "crypto";

export interface VerificationData {
  verified: boolean;
  verificationId?: string;
  verificationMethod?: 'veriff' | 'didit' | 'manual';
  verifiedAt?: Date;
  country?: string;
  state?: string;
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
  recordVote(userId: string, issueId: string, position: string, geo?: GeoLocation): Promise<void>;
  recordProposal(userId: string, title: string, description: string, category: string, geoRestriction?: string[]): Promise<void>;
  updateUserVerification(userId: string, verification: VerificationData): Promise<void>;
  canVoteInGeo(userId: string, proposalGeoRestrictions: string[]): Promise<boolean>;
  createPricingPlan(plan: Omit<PricingPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<PricingPlan>;
  updatePricingPlan(id: string, updates: Partial<PricingPlan>): Promise<PricingPlan | undefined>;
  deletePricingPlan(id: string): Promise<void>;
  getPricingPlan(id: string): Promise<PricingPlan | undefined>;
  getAllPricingPlans(): Promise<PricingPlan[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private wallets: Map<string, Wallet>;
  private votes: Map<string, any>;
  private proposals: Map<string, any>;
  private verifications: Map<string, VerificationData>;
  private geoLocations: Map<string, GeoLocation[]>;
  private pricingPlans: Map<string, PricingPlan>;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.votes = new Map();
    this.proposals = new Map();
    this.verifications = new Map();
    this.geoLocations = new Map();
    this.pricingPlans = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      walletAddress: null,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(upsertUser: UpsertUser): Promise<User> {
    const id = upsertUser.id || randomUUID();
    const existingUser = this.users.get(id);
    const user: User = {
      ...existingUser,
      ...upsertUser,
      id,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    const user: User = {
      ...existingUser,
      ...updates,
      id,
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async getUserWallet(userId: string): Promise<Wallet | undefined> {
    return Array.from(this.wallets.values()).find(
      (wallet) => wallet.userId === userId,
    );
  }

  async createWallet(userId: string, address: string, privateKey?: string): Promise<Wallet> {
    const wallet: Wallet = {
      id: randomUUID(),
      userId,
      address,
      privateKey: privateKey || '',
      deployedAt: new Date(),
    };
    this.wallets.set(wallet.id, wallet);

    // Update user with wallet address
    const user = this.users.get(userId);
    if (user) {
      user.walletAddress = address;
      this.users.set(userId, user);
    }

    return wallet;
  }

  async recordVote(userId: string, issueId: string, position: string, geo?: GeoLocation): Promise<void> {
    const voteId = randomUUID();
    this.votes.set(voteId, { userId, issueId, position, timestamp: new Date(), geo });
    if (geo) {
      const locations = this.geoLocations.get(userId) || [];
      locations.push(geo);
      this.geoLocations.set(userId, locations);
    }
  }

  async recordProposal(userId: string, title: string, description: string, category: string, geoRestriction?: string[]): Promise<void> {
    const proposalId = randomUUID();
    this.proposals.set(proposalId, {
      id: proposalId,
      userId,
      title,
      description,
      category,
      geoRestriction: geoRestriction || [],
      supportVotes: 0,
      opposeVotes: 0,
      createdAt: new Date(),
      deadline: "2 weeks left",
    });
  }

  async updateUserVerification(userId: string, verification: VerificationData): Promise<void> {
    this.verifications.set(userId, verification);
    const user = this.users.get(userId);
    if (user) {
      user.verified = verification.verified;
      this.users.set(userId, user);
    }
  }

  async canVoteInGeo(userId: string, proposalGeoRestrictions: string[]): Promise<boolean> {
    // If no geo restrictions, anyone can vote
    if (!proposalGeoRestrictions || proposalGeoRestrictions.length === 0) {
      return true;
    }

    // Get user's latest geo location
    const locations = this.geoLocations.get(userId) || [];
    if (locations.length === 0) {
      return false;
    }

    const latestGeo = locations[locations.length - 1];

    // Check if user's location matches geo restriction
    return proposalGeoRestrictions.includes(latestGeo.country) ||
           proposalGeoRestrictions.includes(latestGeo.state || '');
  }

  async createPricingPlan(plan: Omit<PricingPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<PricingPlan> {
    const id = randomUUID();
    const pricingPlan: PricingPlan = {
      ...plan,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.pricingPlans.set(id, pricingPlan);
    return pricingPlan;
  }

  async updatePricingPlan(id: string, updates: Partial<PricingPlan>): Promise<PricingPlan | undefined> {
    const plan = this.pricingPlans.get(id);
    if (!plan) return undefined;
    const updated = { ...plan, ...updates, updatedAt: new Date() };
    this.pricingPlans.set(id, updated);
    return updated;
  }

  async deletePricingPlan(id: string): Promise<void> {
    this.pricingPlans.delete(id);
  }

  async getPricingPlan(id: string): Promise<PricingPlan | undefined> {
    return this.pricingPlans.get(id);
  }

  async getAllPricingPlans(): Promise<PricingPlan[]> {
    return Array.from(this.pricingPlans.values());
  }
}

export const storage = new MemStorage();
