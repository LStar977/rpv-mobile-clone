// Shared tier metadata for the create-organization tier picker and the
// org-billing screen. Display copy + Stripe/IAP product mapping live in
// shared/tier-limits.ts (server enforcement) and lib/iap.ts (IAP SKUs).

import type { Ionicons } from '@expo/vector-icons';

export type OrgTier = 'starter' | 'professional' | 'premium' | 'enterprise';

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
  starter: {
    name: 'Starter',
    price: '$29',
    priceValue: 29,
    description: 'Perfect for small groups and local organizations',
    icon: 'people-outline',
    features: [
      'Up to 100 members',
      'Internal proposals & voting',
      'Basic announcements',
      'Invite code management',
      'Community support',
    ],
  },
  professional: {
    name: 'Professional',
    price: '$99',
    priceValue: 99,
    description: 'For growing organizations with advanced needs',
    icon: 'business-outline',
    popular: true,
    features: [
      'Up to 500 members',
      'Everything in Starter',
      'Advanced analytics',
      'Custom branding',
      'Priority support',
      'API access',
    ],
  },
  premium: {
    name: 'Premium',
    price: '$299',
    priceValue: 299,
    description: 'For large unions, parties, and federations',
    icon: 'shield-checkmark-outline',
    features: [
      'Up to 2,500 members',
      'Everything in Professional',
      'Sub-organization hierarchy (district → school)',
      'Roster import (CSV)',
      'Dedicated onboarding',
      'SLA + 24h response time',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Contact Us',
    priceValue: 0,
    description: 'For 2,500+ member organizations',
    icon: 'globe-outline',
    contactOnly: true,
    features: [
      'Unlimited members',
      'Everything in Premium',
      'Dedicated account manager',
      'Custom integrations',
      'Custom SLA',
      'White-label options',
    ],
  },
};
