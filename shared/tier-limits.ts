// Authoritative tier limits and feature gates for organization plans.
// Read by both the mobile UI (for upgrade-prompt copy) and the backend
// (for enforcement). When you change a number here, both surfaces update.
//
// Stage 1 enforces the EXISTING tier names and member ceilings as published
// at app/modals/create-organization.tsx. The new pricing structure from
// UPDATE 15 of the plan file (Free/Pro/Plus/Business) is intentionally not
// wired here yet — that's Stage 3.

export type OrgTier =
  | 'starter'
  | 'professional'
  | 'premium'
  | 'enterprise'
  // 'legacy' is for orgs created before enforcement existed. Operations team
  // sets this via SQL during migration to grandfather existing customers.
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
}

export const TIER_LIMITS: Record<OrgTier, TierLimits> = {
  starter: {
    members: 100,
    verificationsPerMonth: 100,
    csvImport: false,
    analyticsAdvanced: false,
    apiAccess: false,
    whiteLabel: false,
    oauthSso: false,
    subOrganizations: false,
  },
  professional: {
    members: 500,
    verificationsPerMonth: 500,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: false,
    oauthSso: false,
    subOrganizations: false,
  },
  premium: {
    members: 2500,
    verificationsPerMonth: 2500,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: false,
    oauthSso: true,
    subOrganizations: true,
  },
  enterprise: {
    members: Infinity,
    verificationsPerMonth: Infinity,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
  },
  legacy: {
    // Pre-enforcement orgs are uncapped to avoid breaking existing customers.
    // Sales should migrate them to a real tier on next renewal.
    members: Infinity,
    verificationsPerMonth: Infinity,
    csvImport: true,
    analyticsAdvanced: true,
    apiAccess: true,
    whiteLabel: true,
    oauthSso: true,
    subOrganizations: true,
  },
};

export function getTierLimits(tier?: string | null): TierLimits {
  // Unknown / null tiers fall back to starter so misconfigured rows don't
  // accidentally get unlimited everything. Legacy grandfathering must be
  // explicit — set tier='legacy' in SQL during migration.
  if (!tier) return TIER_LIMITS.starter;
  return TIER_LIMITS[tier as OrgTier] ?? TIER_LIMITS.starter;
}

export function getMemberLimit(tier?: string | null): number {
  return getTierLimits(tier).members;
}

export function isFeatureEnabled(tier: string | null | undefined, feature: keyof Omit<TierLimits, 'members' | 'verificationsPerMonth'>): boolean {
  return getTierLimits(tier)[feature];
}

export function tierDisplayName(tier?: string | null): string {
  if (!tier) return 'Starter';
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
