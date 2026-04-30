import { db } from './db';
import { pushTokens, users, proposals } from '@shared/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export async function savePushToken(userId: string, token: string, platform: string): Promise<void> {
  try {
    await db.insert(pushTokens)
      .values({
        userId,
        token,
        platform,
      })
      .onConflictDoUpdate({
        target: [pushTokens.userId, pushTokens.token],
        set: {
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

export async function removePushToken(userId: string, token: string): Promise<void> {
  try {
    await db.delete(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}

async function getUserPushTokens(userId: string): Promise<string[]> {
  const tokens = await db.select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId));
  return tokens.map(t => t.token);
}

// Tokens whose Expo response says they're permanently dead. Each one will
// keep producing errors on every notification round-trip until removed.
const TERMINAL_PUSH_ERRORS = new Set([
  'DeviceNotRegistered',
  'InvalidCredentials',
]);

async function pruneDeadPushTokens(deadTokens: string[]): Promise<void> {
  if (deadTokens.length === 0) return;
  try {
    // Token uniquely identifies a device-install; if it's dead, drop every
    // row carrying it regardless of which userId owns it.
    for (const token of deadTokens) {
      await db.delete(pushTokens).where(eq(pushTokens.token, token));
    }
    console.log(`Pruned ${deadTokens.length} dead push token(s)`);
  } catch (e) {
    console.error('Error pruning dead push tokens:', e);
  }
}

async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // Expo returns { data: [{ status: 'ok' | 'error', details?: { error } }] }
    // in the same order as our messages. Any "error" with a terminal code
    // means that token is dead — prune it so subsequent rounds don't waste
    // network calls on it.
    const tickets = Array.isArray(result?.data) ? result.data : [];
    const dead: string[] = [];
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      if (t?.status === 'error' && t?.details?.error && TERMINAL_PUSH_ERRORS.has(t.details.error)) {
        const token = messages[i]?.to;
        if (token) dead.push(token);
      }
    }
    if (dead.length > 0) {
      await pruneDeadPushTokens(dead);
    }
  } catch (error) {
    console.error('Error sending push notifications:', error);
  }
}

export async function notifyNewProposal(proposal: {
  id: string;
  title: string;
  category: string;
  geoRestrictions?: any[];
}): Promise<void> {
  let eligibleUsers: { id: string; country: string | null; state: string | null; city: string | null }[];

  if (proposal.geoRestrictions && proposal.geoRestrictions.length > 0) {
    const allUsers = await db.select({
      id: users.id,
      country: users.country,
      state: users.state,
      city: users.city
    }).from(users);

    eligibleUsers = allUsers.filter(user => {
      if (!user.country) return false;

      return proposal.geoRestrictions!.some((geoRestriction: string) => {
        if (typeof geoRestriction !== 'string') return false;

        const parts = geoRestriction.split('-');
        const [reqCountry, reqState, reqCity] = parts;

        if (reqCountry && user.country !== reqCountry) return false;
        if (reqState && user.state !== reqState) return false;
        if (reqCity && user.city !== reqCity) return false;

        return true;
      });
    });
  } else {
    eligibleUsers = await db.select({
      id: users.id,
      country: users.country,
      state: users.state,
      city: users.city
    }).from(users);
  }

  const messages: ExpoPushMessage[] = [];
  for (const user of eligibleUsers) {
    const tokens = await getUserPushTokens(user.id);
    for (const token of tokens) {
      messages.push({
        to: token,
        title: 'New Proposal in Your Area',
        body: `${proposal.title} - ${proposal.category}`,
        data: { proposalId: proposal.id, type: 'new_proposal' },
        sound: 'default',
      });
    }
  }

  await sendPushNotifications(messages);
}

export async function notifyDeadlineApproaching(proposal: {
  id: string;
  title: string;
  deadline: Date;
}): Promise<void> {
  const allTokens = await db.select({
    token: pushTokens.token,
    userId: pushTokens.userId,
  }).from(pushTokens);

  const messages: ExpoPushMessage[] = allTokens.map(t => ({
    to: t.token,
    title: 'Voting Deadline Approaching',
    body: `"${proposal.title}" closes in 24 hours. Vote now!`,
    data: { proposalId: proposal.id, type: 'deadline_reminder' },
    sound: 'default',
  }));

  await sendPushNotifications(messages);
}

export async function notifyVoteResults(proposal: {
  id: string;
  title: string;
  supportVotes: number;
  opposeVotes: number;
}, voterUserIds: string[]): Promise<void> {
  const totalVotes = proposal.supportVotes + proposal.opposeVotes;
  const supportPercent = totalVotes > 0 ? Math.round((proposal.supportVotes / totalVotes) * 100) : 0;
  const result = proposal.supportVotes > proposal.opposeVotes ? 'passed' : 'did not pass';

  const messages: ExpoPushMessage[] = [];
  for (const userId of voterUserIds) {
    const tokens = await getUserPushTokens(userId);
    for (const token of tokens) {
      messages.push({
        to: token,
        title: 'Voting Results Are In',
        body: `"${proposal.title}" ${result} with ${supportPercent}% support.`,
        data: { proposalId: proposal.id, type: 'vote_results' },
        sound: 'default',
      });
    }
  }

  await sendPushNotifications(messages);
}

export async function notifyTokenClaimed(userId: string, proposalTitle: string, proposalId: string): Promise<void> {
  const tokens = await getUserPushTokens(userId);

  const messages: ExpoPushMessage[] = tokens.map(token => ({
    to: token,
    title: 'Vote Token Claimed',
    body: `Your voting token for "${proposalTitle}" is ready. Cast your vote now!`,
    data: { proposalId, type: 'token_claimed' },
    sound: 'default',
  }));

  await sendPushNotifications(messages);
}

export async function notifyProposalVote(proposal: {
  id: string;
  title: string;
  userId: string;
}, voterName: string): Promise<void> {
  const tokens = await getUserPushTokens(proposal.userId);

  const messages: ExpoPushMessage[] = tokens.map(token => ({
    to: token,
    title: 'New Vote on Your Proposal',
    body: `${voterName} voted on "${proposal.title}"`,
    data: { proposalId: proposal.id, type: 'proposal_vote' },
    sound: 'default',
  }));

  await sendPushNotifications(messages);
}
