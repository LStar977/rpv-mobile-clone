import { Share, Platform } from 'react-native';

export interface ShareProposalData { id: number | string; title: string; description?: string; }

// Public-facing URLs. Proposal pages are served by the backend at
// representportal.com/p/:id (server-rendered HTML with og: tags so links
// unfurl on social). The App Store link is the conversion target for
// anyone without the app installed.
const PROPOSAL_URL_BASE = 'https://representportal.com/p';
const APP_STORE_URL = 'https://apps.apple.com/ca/app/id6756912022';

// iOS NOTE: passing `message` and `url` together breaks the share sheet's
// Copy action (the pair serializes as "bplist00…" clipboard garbage), while
// URL-only shares give both the rich iMessage preview card (the backend
// serves og: tags with the live tally) AND a clean URL on Copy. So on iOS
// we share ONLY the URL and let the preview card do the talking; Android
// has no url field, so it gets the text with the link inline.
export async function shareProposal(proposal: ShareProposalData): Promise<boolean> {
  try {
    const proposalUrl = `${PROPOSAL_URL_BASE}/${proposal.id}`;
    const message = `Vote on this: "${proposal.title}" — verified voting on Represent`;
    const result = await Share.share(
      Platform.OS === 'ios' ? { url: proposalUrl } : { message: `${message}\n\n${proposalUrl}` },
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
      Platform.OS === 'ios' ? { url } : { message: `${message}\n\n${url}` },
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

// Invite with a referral code. Both sides get a premium reward once the
// invitee verifies, so the message leads with the code.
export async function shareReferralInvite(code: string): Promise<boolean> {
  try {
    const message =
      `Join me on Represent — identity-verified voting on the issues that shape your community. ` +
      `Use my code ${code} when you sign up and we both get a free month of Premium once you verify.`;
    const result = await Share.share(
      { message: `${message}\n\n${APP_STORE_URL}` },
      { dialogTitle: 'Invite Friends', subject: 'Join me on Represent' }
    );
    return result.action === Share.sharedAction;
  } catch (error) { console.error('Error sharing referral invite:', error); return false; }
}
