import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (REQUIRED for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Updated users table for OAuth (email optional, OAuth ID required)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  name: text("name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  walletAddress: varchar("wallet_address"),
  verified: boolean("verified").default(false),
  verificationId: varchar("verification_id"),
  verificationMethod: varchar("verification_method"),
  documentType: varchar("document_type"),
  country: varchar("country"),
  state: varchar("state"),
  city: varchar("city"),
  gender: varchar("gender"), // 'male', 'female', 'other', 'prefer_not_to_say'
  dateOfBirth: varchar("date_of_birth"), // ISO 8601 date string
  verifiedAt: timestamp("verified_at"),
  isAdmin: boolean("is_admin").default(false),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default('free'), // 'free', 'active', 'canceled', 'past_due'
  subscriptionEndDate: timestamp("subscription_end_date"),
  // IAP attribution. Apple notifications arrive identified only by the
  // originalTransactionId, not by our user id. We need a queryable column
  // to look up the right user when a renewal/refund/cancel notification
  // comes in. Backfill from the legacy 'iap:' prefix on stripeSubscriptionId.
  iapOriginalTransactionId: varchar("iap_original_transaction_id").unique(),
  iapEnvironment: varchar("iap_environment"), // 'Sandbox' | 'Production'
  verificationPaid: boolean("verification_paid").default(false), // Legacy from $4.99 payment; verification is now free
  initialBallotsGranted: boolean("initial_ballots_granted").default(false), // True after one-time RPV token grant on verification
  ballotsUsedToday: integer("ballots_used_today").default(0), // Daily vote counter, capped at 20 for non-premium users
  ballotsResetAt: timestamp("ballots_reset_at").defaultNow(), // Timestamp of last daily-counter reset; used for lazy-reset pattern
  sentinelUsesToday: integer("sentinel_uses_today").default(0), // Per-user daily Sentinel AI counter (cost control)
  sentinelResetAt: timestamp("sentinel_reset_at").defaultNow(), // Last Sentinel counter reset
  deleted: boolean("deleted").default(false), // Soft-deleted (PII anonymized); user can no longer log in
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  address: varchar("address").notNull().unique(),
  privateKey: text("private_key").notNull(),
  encrypted: boolean("encrypted").default(false),
  deployedAt: timestamp("deployed_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  issueId: varchar("issue_id"), // Keep for backwards compatibility
  proposalId: varchar("proposal_id").notNull().references(() => proposals.id),
  position: varchar("position").notNull(),
  selectedOption: varchar("selected_option"), // For multiple-choice votes
  voteTokenId: varchar("vote_token_id"),
  txHash: varchar("tx_hash"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => ({
  uniqueUserProposal: unique().on(table.userId, table.proposalId),
}));

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // 'corporation', 'union', 'school', 'nonprofit', 'other'
  membershipType: varchar("membership_type").notNull().default('invite'), // 'invite', 'domain', 'manual'
  emailDomain: varchar("email_domain"), // For auto-membership via email domain
  inviteCode: varchar("invite_code").unique(), // For invite-based membership
  isActive: boolean("is_active").default(true),

  // Hierarchical orgs: when set, this row is a sub-organization of parentOrgId.
  // Recursive — sub-orgs can have their own sub-orgs (district > school > class).
  // Membership of a sub-org confers effective membership in all ancestors.
  parentOrgId: varchar("parent_org_id"),

  // NEW: Branding fields
  logoUrl: varchar("logo_url"), // URL to org logo
  primaryColor: varchar("primary_color").default("#EABA58"), // Primary brand color
  secondaryColor: varchar("secondary_color").default("#040707"), // Secondary brand color

  // NEW: OAuth configuration
  oauthProvider: varchar("oauth_provider"), // 'myaupe', 'opseu', 'google', etc.
  oauthClientId: varchar("oauth_client_id"), // OAuth client ID
  oauthClientSecret: varchar("oauth_client_secret"), // OAuth client secret (stored encrypted)
  oauthAuthorizationUrl: varchar("oauth_authorization_url"), // Authorization endpoint
  oauthTokenUrl: varchar("oauth_token_url"), // Token endpoint
  oauthUserInfoUrl: varchar("oauth_user_info_url"), // User info endpoint

  // NEW: Organization settings
  memberRoleMapping: jsonb("member_role_mapping").default(sql`'{}'::jsonb`), // Map external roles to internal
  isWhiteLabelEnabled: boolean("is_white_label_enabled").default(false),
  customDomain: varchar("custom_domain"), // Custom subdomain

  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeCustomerId: varchar("stripe_customer_id"),
  subscriptionStatus: varchar("subscription_status").default('pending'),

  // IAP attribution for org subscriptions purchased via Apple IAP. See the
  // matching columns on `users` for the rationale — Apple's notifications
  // identify the subscription by originalTransactionId only.
  iapOriginalTransactionId: varchar("iap_original_transaction_id").unique(),
  iapEnvironment: varchar("iap_environment"), // 'Sandbox' | 'Production'

  // Subscription tier — drives member caps and feature gating.
  // Values: 'starter' | 'professional' | 'premium' | 'enterprise' | 'legacy'.
  // Existing rows pre-enforcement should be migrated to 'legacy' (uncapped) to
  // grandfather customers; new rows default to 'starter' (100-member cap).
  // See shared/tier-limits.ts for the authoritative limits.
  tier: varchar("tier").default('starter'),

  // Per-month verification counter for overage protection. The reset
  // timestamp lets us amortize across calendar months without a cron job —
  // any handler can call resetIfStale() and the counter zeroes if the month
  // has rolled over since verificationCountResetAt.
  // TODO(stage-2): wire incrementing into Veriff/Didit success webhooks
  // (backend/server/routes.ts:1769, 1836, 2229). Requires plumbing an
  // originatingOrgId through verification session creation
  // (POST /api/didit/create-session ~line 2191) and parsing it out of
  // vendor_data on the webhook side. Counter is currently dead — limits
  // in shared/tier-limits.ts are advertised but not enforced for verifications.
  verificationCountThisMonth: integer("verification_count_this_month").default(0),
  verificationCountResetAt: timestamp("verification_count_reset_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").notNull().default('member'), // 'admin', 'member'
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  uniqueOrgMember: unique().on(table.organizationId, table.userId),
}));

export const organizationInviteCodes = pgTable("organization_invite_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  code: varchar("code").notNull().unique(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  uses: integer("uses").default(0),
  maxUses: integer("max_uses"), // null = unlimited
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Per-email invitations created via the CSV roster importer (and later, the
// single-invite admin UI). Distinct from `organizationInviteCodes`, which
// stores share-link codes consumed by anyone who has the code. An invite row
// is bound to ONE email address and represents pending consent — the invitee
// is NOT a member until they sign in via the magic link and accept.
export const organizationInvites = pgTable("organization_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  email: varchar("email").notNull(), // lowercased before insert
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  inviteToken: varchar("invite_token").notNull().unique(), // 32-char URL-safe random
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  role: varchar("role").notNull().default('member'), // 'admin' | 'member'
  status: varchar("status").notNull().default('pending'), // 'pending' | 'accepted' | 'expired' | 'revoked'
  metadata: jsonb("metadata"), // arbitrary extra columns from the CSV
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => ({
  uniqueOrgEmail: unique().on(table.organizationId, table.email),
  emailIdx: index("org_invites_email_idx").on(table.email),
}));

export const organizationAnnouncements = pgTable("organization_announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().references(() => organizations.id),
  title: varchar("title").notNull(),
  content: text("content").notNull(),
  pinned: boolean("pinned").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(),
  supportVotes: integer("support_votes").default(0),
  opposeVotes: integer("oppose_votes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  deadline: timestamp("deadline"),
  voteTokenAddress: varchar("vote_token_address"),
  geoRestrictions: jsonb("geo_restrictions").default(sql`'[]'::jsonb`),
  supportAddress: varchar("support_address"),
  opposeAddress: varchar("oppose_address"),
  riding: varchar("riding"), // Electoral riding/district for proposal scoping
  demographicRestrictions: jsonb("demographic_restrictions").default(sql`'{}'::jsonb`), // {gender: 'female', ageMin: 25, ageMax: 30}
  organizationId: varchar("organization_id").references(() => organizations.id), // Org-restricted proposals
  isFeatured: boolean("is_featured").default(false),
  voteType: varchar("vote_type").default('yes-no'), // 'yes-no' or 'multiple-choice'
  options: jsonb("options").default(sql`'[]'::jsonb`), // Array of option strings for multiple-choice
  optionAddresses: jsonb("option_addresses").default(sql`'[]'::jsonb`), // Array of addresses corresponding to each option
  imageUrl: varchar("image_url"), // URL to proposal image attachment from object storage
  isOfficial: boolean("is_official").default(false), // Org-official proposals (admin-only)
});

// Table to store option addresses for multiple-choice proposals
export const proposalOptionAddresses = pgTable("proposal_option_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull().references(() => proposals.id),
  optionIndex: integer("option_index").notNull(),
  address: varchar("address").notNull(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  txHash: varchar("tx_hash"),
  type: varchar("type").notNull(),
  amount: varchar("amount"),
  status: varchar("status").notNull(),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pricingPlans = pgTable("pricing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(),
  billingPeriod: varchar("billing_period").notNull().default('monthly'),
  features: jsonb("features").default(sql`'[]'::jsonb`),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").unique().notNull(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const voteTokenClaims = pgTable("vote_token_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  proposalId: varchar("proposal_id").notNull().references(() => proposals.id),
  voteTokenAddress: varchar("vote_token_address").notNull(),
  tokenId: varchar("token_id"),
  claimedAt: timestamp("claimed_at").defaultNow(),
});

export const passportNFTs = pgTable("passport_nfts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  nftTokenId: varchar("nft_token_id").notNull(),
  contractAddress: varchar("contract_address").notNull(),
  txHash: varchar("tx_hash").notNull(),
  mintedAt: timestamp("minted_at").defaultNow(),
});

export const ridingVerifications = pgTable("riding_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  riding: varchar("riding").notNull(),
  ridingCode: varchar("riding_code").notNull(),
  verifiedAt: timestamp("verified_at").defaultNow(),
}, (table) => ({
  uniqueUserRiding: unique().on(table.userId, table.riding),
}));

export const electoralRidingQRCodes = pgTable("electoral_riding_qr_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ridingCode: varchar("riding_code").notNull().unique(),
  ridingName: varchar("riding_name").notNull(),
  qrDataUrl: text("qr_data_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referral system tables
export const referralCodes = pgTable("referral_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  code: varchar("code").notNull().unique(), // e.g., "REP7K9X2"
  createdAt: timestamp("created_at").defaultNow(),
});

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull().references(() => users.id),
  refereeId: varchar("referee_id").notNull().references(() => users.id),
  referralCode: varchar("referral_code").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueReferral: unique().on(table.referrerId, table.refereeId),
}));

export const referralConfig = pgTable("referral_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerRewardType: varchar("referrer_reward_type").notNull().default('subscription_months'), // subscription_months or credit
  referrerRewardAmount: integer("referrer_reward_amount").notNull().default(1), // 1 month or $10
  referrerThreshold: integer("referrer_threshold").notNull().default(3), // refer 3 people to get reward
  refereeRewardType: varchar("referee_reward_type").notNull().default('credit'), // credit or discount_percent
  refereeRewardAmount: varchar("referee_reward_amount").notNull().default('10'), // $10 or 15%
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Badge system tables
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  badgeType: varchar("badge_type").notNull(), // 'first_vote', 'passport_minted', 'voting_streak', 'community_leader', etc
  tier: varchar("tier").notNull().default('common'), // 'common', 'rare', 'epic', 'legendary'
  icon: text("icon").notNull(), // SVG or emoji
  createdAt: timestamp("created_at").defaultNow(),
});

export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  badgeId: varchar("badge_id").notNull().references(() => badges.id),
  location: varchar("location"), // For location-based badges: country, state, city
  awardedAt: timestamp("awarded_at").defaultNow(),
}, (table) => ({
  uniqueUserBadgeLocation: unique().on(table.userId, table.badgeId, table.location),
}));

// Push notification tokens for mobile devices
export const pushTokens = pgTable("push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  platform: varchar("platform").notNull(), // 'ios', 'android'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserToken: unique().on(table.userId, table.token),
}));

// Activated Ridings table - tracks which electoral ridings have Represent active
export const activatedRidings = pgTable("activated_ridings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // Electoral riding/district name (e.g., "Toronto—St. Paul's")
  country: varchar("country").notNull(), // Country (e.g., "Canada")
  state: varchar("state"), // State/Province (e.g., "ON")
  city: varchar("city"), // City (optional)
  activatedAt: timestamp("activated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export type ReferralCode = typeof referralCodes.$inferSelect;
export type Referral = typeof referrals.$inferSelect;
export type ReferralConfig = typeof referralConfig.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type UserBadge = typeof userBadges.$inferSelect;
export type ActivatedRiding = typeof activatedRidings.$inferSelect;
export type PushToken = typeof pushTokens.$inferSelect;
export type OrganizationInviteCode = typeof organizationInviteCodes.$inferSelect;
export type OrganizationAnnouncement = typeof organizationAnnouncements.$inferSelect;

export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type PricingPlan = typeof pricingPlans.$inferSelect;
export type PassportNFT = typeof passportNFTs.$inferSelect;
export type RidingVerification = typeof ridingVerifications.$inferSelect;
export type ElectoralRidingQRCode = typeof electoralRidingQRCodes.$inferSelect;
