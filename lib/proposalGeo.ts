import type { Proposal } from './api';

export function getTierLabel(geoRestrictions?: string[]): string {
  if (!geoRestrictions || geoRestrictions.length === 0) return 'GLOBAL';
  if (geoRestrictions.length === 1) return 'FEDERAL';
  if (geoRestrictions.length === 2) return 'PROVINCIAL';
  return 'MUNICIPAL';
}

export function getLocationLabel(geoRestrictions?: string[]): string {
  if (!geoRestrictions || geoRestrictions.length === 0) return 'Global';
  return geoRestrictions[geoRestrictions.length - 1];
}

export function canUserVoteOnProposal(
  proposal: Proposal,
  userCountry: string,
  userState: string,
  userCity: string,
  isVerified: boolean,
): boolean {
  const proposalGeo = proposal.geoRestrictions || [];
  if (proposalGeo.length === 0) return true;
  if (!isVerified) return false;
  const userLocation = [userCountry, userState, userCity].filter(Boolean);
  return proposalGeo.every((restriction, index) => {
    const userLevel = userLocation[index];
    return !!userLevel && userLevel.toLowerCase() === restriction.toLowerCase();
  });
}

// Citizens-only gate. A proposal flagged requiresCitizenship can only be
// voted on by users who passed the Didit Citizen workflow. Independent of
// the geo gate above — both must pass.
export function meetsCitizenshipRequirement(
  proposal: Proposal,
  citizenshipVerified: boolean,
): boolean {
  if (!proposal.requiresCitizenship) return true;
  return citizenshipVerified;
}

const COUNTRY_ALIASES: Record<string, string> = {
  'united states': 'United States of America',
  'usa': 'United States of America',
  'u.s.a.': 'United States of America',
  'us': 'United States of America',
  'uk': 'United Kingdom',
  'great britain': 'United Kingdom',
  'russian federation': 'Russia',
  'czech republic': 'Czechia',
  'south korea': 'Republic of Korea',
  'north korea': "Dem. Rep. Korea",
  'ivory coast': "Côte d'Ivoire",
  'burma': 'Myanmar',
  'east timor': 'Timor-Leste',
  'vatican': 'Vatican',
};

export function normalizeCountryName(name: string): string {
  const lower = name.trim().toLowerCase();
  return COUNTRY_ALIASES[lower] ?? name.trim();
}
