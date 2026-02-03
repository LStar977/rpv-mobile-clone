import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { badgesApi } from './api';

// Badge display names and icons
const BADGE_INFO: Record<string, { name: string; emoji: string; description: string }> = {
  // Voting badges
  first_vote: {
    name: 'First Vote',
    emoji: '🗳️',
    description: 'Cast your first vote',
  },
  first_vote_country: {
    name: 'National Voice',
    emoji: '🏛️',
    description: 'Vote on a national proposal',
  },
  first_vote_state: {
    name: 'State Advocate',
    emoji: '🏢',
    description: 'Vote on a state-level proposal',
  },
  first_vote_city: {
    name: 'Local Champion',
    emoji: '🏘️',
    description: 'Vote on a city-level proposal',
  },
  vote_streak_5: {
    name: 'Consistent Voter',
    emoji: '⭐',
    description: 'Cast 5 votes',
  },
  vote_streak_25: {
    name: 'Dedicated Citizen',
    emoji: '🌟',
    description: 'Cast 25 votes',
  },
  vote_streak_100: {
    name: 'Democracy Hero',
    emoji: '👑',
    description: 'Cast 100 votes',
  },

  // Creator badges
  first_proposal: {
    name: 'Proposal Pioneer',
    emoji: '📝',
    description: 'Create your first proposal',
  },
  proposal_5: {
    name: 'Active Legislator',
    emoji: '📜',
    description: 'Create 5 proposals',
  },
  proposal_passed: {
    name: 'Changemaker',
    emoji: '✅',
    description: 'Have a proposal pass',
  },

  // Identity badges
  passport_minted: {
    name: 'Verified Citizen',
    emoji: '🛂',
    description: 'Mint your Represent Passport NFT',
  },
  verified_identity: {
    name: 'Identity Verified',
    emoji: '🛡️',
    description: 'Complete identity verification',
  },

  // Special badges
  early_adopter: {
    name: 'Early Adopter',
    emoji: '🚀',
    description: 'Join during the beta period',
  },
  democratic_spirit: {
    name: 'Democratic Spirit',
    emoji: '⚖️',
    description: 'Vote both support and oppose on different proposals',
  },
  global_citizen: {
    name: 'Global Citizen',
    emoji: '🌍',
    description: 'Vote on proposals from multiple regions',
  },

  // Organization badges
  org_member: {
    name: 'Team Player',
    emoji: '👥',
    description: 'Join an organization',
  },
  org_admin: {
    name: 'Community Leader',
    emoji: '👔',
    description: 'Become an organization admin',
  },
};

/**
 * Check for newly earned badges and show a celebratory alert
 * Call this after actions that could earn badges (voting, creating proposals, etc.)
 */
export async function checkForNewBadges(): Promise<void> {
  try {
    const result = await badgesApi.checkNewBadges();

    if (result.error) {
      console.log('Badge check skipped:', result.error);
      return;
    }

    if (result.data?.newBadges && result.data.newBadges.length > 0) {
      // Process each new badge
      for (const badge of result.data.newBadges) {
        const badgeId = badge.badgeId || badge.id;
        const badgeInfo = BADGE_INFO[badgeId] || {
          name: badge.name || 'New Badge',
          emoji: '🏆',
          description: badge.description || 'You earned a new badge!',
        };

        // Haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Show celebratory alert
        Alert.alert(
          `${badgeInfo.emoji} Badge Earned!`,
          `You've earned the "${badgeInfo.name}" badge!\n\n${badgeInfo.description}`,
          [{ text: 'Awesome!', style: 'default' }]
        );

        // Small delay between multiple badges
        if (result.data.newBadges.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  } catch (error) {
    // Silently fail - badge notifications are not critical
    console.log('Error checking badges:', error);
  }
}

/**
 * Get badge display info for a badge ID
 */
export function getBadgeInfo(badgeId: string): { name: string; emoji: string; description: string } {
  return BADGE_INFO[badgeId] || {
    name: 'Unknown Badge',
    emoji: '🏅',
    description: 'A special achievement',
  };
}

export default { checkForNewBadges, getBadgeInfo };
