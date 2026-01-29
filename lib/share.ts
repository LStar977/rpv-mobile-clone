import { Share, Platform } from 'react-native';

export interface ShareProposalData { id: number; title: string; description?: string; }

const APP_URL = 'https://representwallet.replit.app';

export async function shareProposal(proposal: ShareProposalData): Promise<boolean> {
  try {
    const proposalUrl = `${APP_URL}/proposals/${proposal.id}`;
    const message = `Check out this proposal on Represent: "${proposal.title}"`;
    const result = await Share.share(
      Platform.OS === 'ios' ? { message, url: proposalUrl } : { message: `${message}\n\n${proposalUrl}` },
      { dialogTitle: 'Share Proposal', subject: `Represent: ${proposal.title}` }
    );
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing proposal:', error); return false; }
}

export async function shareVoteAchievement(proposalTitle: string, choice: 'support' | 'oppose'): Promise<boolean> {
  try {
    const message = `I just voted to ${choice} "${proposalTitle}" on Represent! Make your voice heard too.`;
    const result = await Share.share({ message: `${message}\n\n${APP_URL}` }, { dialogTitle: 'Share Your Vote' });
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing vote:', error); return false; }
}

export async function shareBadge(badgeName: string, badgeDescription: string): Promise<boolean> {
  try {
    const message = `I just earned the "${badgeName}" badge on Represent! ${badgeDescription}`;
    const result = await Share.share({ message: `${message}\n\nJoin me: ${APP_URL}` }, { dialogTitle: 'Share Badge' });
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing badge:', error); return false; }
}

export async function shareApp(): Promise<boolean> {
  try {
    const message = `Join Represent - the civic platform for identity, voting, and community governance.`;
    const result = await Share.share({ message: `${message}\n\n${APP_URL}` }, { dialogTitle: 'Share Represent' });
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing app:', error); return false; }
}
