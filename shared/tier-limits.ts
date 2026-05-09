// Authoritative tier limits and feature gates for organization plans.
// Read by both the mobile UI (for upgrade-prompt copy) and the backend
// (for enforcement). When you change a number here, both surfaces update.
//
// Stage 3 (UPDATE 23) — new tier structure:
//   Free $0 (25 members) · Pro $59 (250) · Plus $179 (1,000)
//   Business $499 (5,000) · Government custom (unlimited)
// Pre-Stage-3 orgs are migrated to `legacy` (uncapped) by ops SQL.

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
  verificationsPerMonth: number;
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
}

export const TIER_LIMITS: Record<OrgTier, TierLimits> = {
  free: {
    members: 25,
    verificationsPerMonth: 25,
    csvImport: false,
    analyticsAdvanced: false,
    apiAccess: false,
    whiteLabel: false,
    oauthSso: false,
    subOrganizations: false,
    auditLogExport: false,
  },
  pro: {
    members: 250,
    verificationsPerMonth: 250,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: false,
    oauthSso: false,
    subOrganizations: false,
    auditLogExport: false,
  },
  plus: {
    members: 1000,
    verificationsPerMonth: 1000,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: false,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
  },
  business: {
    members: 5000,
    verificationsPerMonth: 5000,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
  },
  government: {
    members: Infinity,
    verificationsPerMonth: Infinity,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
  },
  legacy: {
    // Pre-Stage-3 customers (paid the old $29/$99/$299 ladder before this
    // migration). Uncapped on every dimension so the new caps don't break
    // their member counts or feature access. Sales migrates them to a new
    // tier on next renewal.
    members: Infinity,
    verificationsPerMonth: Infinity,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
    auditLogExport: true,
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

export function isFeatureEnabled(tier: string | null | undefined, feature: keyof Omit<TierLimits, 'members' | 'verificationsPerMonth'>): boolean {
  return getTierLimits(tier)[feature];
}

export function tierDisplayName(tier?: string | null): string {
  if (!tier) return 'Free';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
