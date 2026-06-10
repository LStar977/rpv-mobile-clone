import { Share, Platform } from 'react-native';

export interface ShareProposalData { id: number | string; title: string; description?: string; }

// Public-facing URLs. Proposal pages are served by the backend at
// representportal.com/p/:id (server-rendered HTML with og: tags so links
// unfurl on social). The App Store link is the conversion target for
// anyone without the app installed.
const PROPOSAL_URL_BASE = 'https://representportal.com/p';
const APP_STORE_URL = 'https://apps.apple.com/ca/app/id6756912022';

export async function shareProposal(proposal: ShareProposalData): Promise<boolean> {
  try {
    const proposalUrl = `${PROPOSAL_URL_BASE}/${proposal.id}`;
    const message = `Vote on this: "${proposal.title}" — verified voting on Represent`;
    const result = await Share.share(
      Platform.OS === 'ios' ? { message, url: proposalUrl } : { message: `${message}\n\n${proposalUrl}` },
      { dialogTitle: 'Share Proposal', subject: `Represent: ${proposal.title}` }
    );
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing proposal:', error); return false; }
}

export async function shareVoteAchievement(proposalTitle: string, choice: 'support' | 'oppose', proposalId?: number | string): Promise<boolean> {
  try {
    const url = proposalId != null ? `${PROPOSAL_URL_BASE}/${proposalId}` : APP_STORE_URL;
    const message = `I just cast a verified ${choice} vote on "${proposalTitle}". Add your voice:`;
    const result = await Share.share(
      Platform.OS === 'ios' ? { message, url } : { message: `${message}\n\n${url}` },
      { dialogTitle: 'Share Your Vote' }
    );
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing vote:', error); return false; }
}

export async function shareBadge(badgeName: string, badgeDescription: string): Promise<boolean> {
  try {
    const message = `I just earned the "${badgeName}" badge on Represent! ${badgeDescription}`;
    const result = await Share.share({ message: `${message}\n\nJoin me: ${APP_STORE_URL}` }, { dialogTitle: 'Share Badge' });
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing badge:', error); return false; }
}

export async function shareApp(): Promise<boolean> {
  try {
    const message = `Join Represent — identity-verified voting on the issues that shape your community.`;
    const result = await Share.share({ message: `${message}\n\n${APP_STORE_URL}` }, { dialogTitle: 'Share Represent' });
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing app:', error); return false; }
}
