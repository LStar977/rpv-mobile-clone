// Authoritative tier limits and feature gates for organization plans.
// Read by both the mobile UI (for upgrade-prompt copy) and the backend
// (for enforcement). When you change a number here, both surfaces update.
//
// Stage 3 (UPDATE 23) — new tier structure:
//   Free $0 (25 members) · Pro $59 (250) · Plus $179 (1,000)
//   Business $499 (5,000) · Government custom (unlimited)
// Pre-Stage-3 orgs are migrated to `legacy` (uncapped) by ops SQL.
//
// UPDATE 26 — verification unlock fee (supersedes UPDATE 24/25 metered).
//   Pro+ orgs can flip `requireMemberVerification` ON after paying a
//   one-time tier-priced unlock fee ($199 / $499 / $999). Once paid,
//   identity verification is unlocked permanently for the org — platform
//   absorbs per-verification cost. `verificationUnlockFeeCents` is the
//   one-time price; null = feature unavailable on this tier (Free) or
//   custom contract (Government).

export type OrgTier =
  | 'free'
  | 'pro'
  | 'plus'
  | 'business'
  | 'government'
  // 'legacy' grandfathers customers from the pre-Stage-3 pricing. Sales
  // migrates them to a current tier on next renewal.
  | 'legacy';

export interface TierLimits {
  members: number;          // Infinity for unlimited
  csvImport: boolean;
  analyticsAdvanced: boolean;
  apiAccess: boolean;
  whiteLabel: boolean;
  oauthSso: boolean;
  subOrganizations: boolean;
  // Tamper-evident export of every vote in the org with HMAC receipts.
  // Plus+ feature — small orgs running yes/no votes don't need
  // audit-grade receipts. See backend/server/routes.ts /audit-log endpoint.
  auditLogExport: boolean;
  // Pro+: org admin can toggle `requireMemberVerification` ON.
  requireVerification: boolean;
  // One-time unlock fee in cents for the verification feature. Org pays
  // once; verification is then unlocked forever. Null on Free (feature
  // unavailable) and Government (custom annual contract).
  verificationUnlockFeeCents: number | null;
}

export const TIER_LIMITS: Record<OrgTier, TierLimits> = {
  free: {
    members: 25,
    csvImport: false,
    analyticsAdvanced: false,
    apiAccess: false,
    whiteLabel: false,
    oauthSso: false,
    subOrganizations: false,
    auditLogExport: false,
    requireVerification: false,
    verificationUnlockFeeCents: null,
  },
  pro: {
    members: 250,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: false,
    oauthSso: false,
    subOrganizations: false,
    auditLogExport: false,
    requireVerification: true,
    verificationUnlockFeeCents: 19900,
  },
  plus: {
    members: 1000,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: false,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
    requireVerification: true,
    verificationUnlockFeeCents: 49900,
  },
  business: {
    members: 5000,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
    requireVerification: true,
    verificationUnlockFeeCents: 99900,
  },
  government: {
    members: Infinity,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
    requireVerification: true,
    // Government runs on custom annual contracts; no self-serve unlock.
    verificationUnlockFeeCents: null,
  },
  legacy: {
    // Pre-Stage-3 customers (paid the old $29/$99/$299 ladder before this
    // migration). Uncapped on every dimension so the new caps don't break
    // their member counts or feature access. Sales migrates them to a new
    // tier on next renewal.
    members: Infinity,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
    requireVerification: true,
    // Legacy customers priced at the Pro unlock — sales migrates them to
    // a current tier on next renewal anyway.
    verificationUnlockFeeCents: 19900,
  },
};

export function getTierLimits(tier?: string | null): TierLimits {
  // Unknown / null tiers fall back to free so misconfigured rows don't
  // accidentally get unlimited everything. Legacy grandfathering must be
  // explicit — set tier='legacy' in SQL during migration.
  if (!tier) return TIER_LIMITS.free;
  return TIER_LIMITS[tier as OrgTier] ?? TIER_LIMITS.free;
}

export function getMemberLimit(tier?: string | null): number {
  return getTierLimits(tier).members;
}

type BooleanFeatureKey =
  | 'csvImport'
  | 'analyticsAdvanced'
  | 'apiAccess'
  | 'whiteLabel'
  | 'oauthSso'
  | 'subOrganizations'
  | 'auditLogExport'
  | 'requireVerification';

export function isFeatureEnabled(tier: string | null | undefined, feature: BooleanFeatureKey): boolean {
  return getTierLimits(tier)[feature];
}

export function tierDisplayName(tier?: string | null): string {
  if (!tier) return 'Free';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function getVerificationUnlockFeeCents(tier?: string | null): number | null {
  return getTierLimits(tier).verificationUnlockFeeCents;
}
