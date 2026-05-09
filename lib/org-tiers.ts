// Shared tier metadata for the create-organization tier picker and the
// org-billing screen. Display copy + Stripe/IAP product mapping live in
// shared/tier-limits.ts (server enforcement) and lib/iap.ts (IAP SKUs).

import type { Ionicons } from '@expo/vector-icons';

export type OrgTier = 'free' | 'pro' | 'plus' | 'business' | 'government';

export interface OrgTierMeta {
  name: string;
  price: string;
  priceValue: number;
  description: string;
  features: string[];
  icon: keyof typeof Ionicons.glyphMap;
  popular?: boolean;
  contactOnly?: boolean;
}

export const ORG_TIERS: Record<OrgTier, OrgTierMeta> = {
  free: {
    name: 'Free',
    price: '$0',
    priceValue: 0,
    description: 'Get started with verified voting for small groups',
    icon: 'people-circle-outline',
    features: [
      'Up to 25 members',
      'Yes/No, multiple-choice, and ranked-choice voting',
      'Invite codes',
      'Community support',
    ],
  },
  pro: {
    name: 'Pro',
    price: '$59',
    priceValue: 59,
    description: 'For small unions, HOAs, and active community groups',
    icon: 'people-outline',
    features: [
      'Up to 250 members',
      '25 verifications/mo included, then $2.99 each',
      'Everything in Free',
      'CSV roster import',
      'Advanced analytics',
      'API access',
      'Email support',
    ],
  },
  plus: {
    name: 'Plus',
    price: '$179',
    priceValue: 179,
    description: 'For mid-size unions, school PTAs, and political parties',
    icon: 'business-outline',
    popular: true,
    features: [
      'Up to 1,000 members',
      '100 verifications/mo included, then $2.49 each',
      'Everything in Pro',
      'Sub-organization hierarchy',
      'OAuth/SSO (MyAUPE, OPSEU, custom)',
      'Audit log export with HMAC receipts',
      'Priority support',
    ],
  },
  business: {
    name: 'Business',
    price: '$499',
    priceValue: 499,
    description: 'For federations, school districts, and large unions',
    icon: 'shield-checkmark-outline',
    features: [
      'Up to 5,000 members',
      '500 verifications/mo included, then $1.99 each',
      'Everything in Plus',
      'White-label & custom domain',
      'Dedicated onboarding',
      '99.9% SLA + 4h response',
    ],
  },
  government: {
    // Hidden from the public picker (UI filters this entry out). Set by
    // sales via direct DB update or a future admin endpoint. Resolves
    // correctly server-side (unlimited everything) for orgs that have it.
    name: 'Government',
    price: 'Contact Us',
    priceValue: 0,
    description: 'For cities, counties, and government agencies',
    icon: 'globe-outline',
    contactOnly: true,
    features: [
      'Unlimited members',
      'Unlimited verifications (custom rate)',
      'Annual contracts only',
      'SOC 2 Type II + custom DPA',
      'Custom integrations',
      'Dedicated CSM',
    ],
  },
};
