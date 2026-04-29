import type { Express } from 'express';
import { db } from './db';
import { badges, userBadges, votes, proposals, users } from '../shared/schema';
import { eq, and, count } from 'drizzle-orm';

export function setupBadgeRoutes(app: Express) {
  // Initialize badges in database
  app.post('/api/badges/init', async (req, res) => {
    try {
      const badgeDefinitions = [
        { badgeType: 'first_vote_global', name: '🗳️ First Voice', description: 'Cast your first vote on any proposal', tier: 'common', icon: '🗳️' },
        { badgeType: 'passport_minted', name: '🎫 Passport Minted', description: 'Successfully minted your soulbound passport NFT', tier: 'rare', icon: '🎫' },
        { badgeType: 'voting_streak_5', name: '🔥 Active Voter', description: 'Cast 5 votes in a single month', tier: 'common', icon: '🔥' },
        { badgeType: 'voting_streak_25', name: '🌟 Civic Champion', description: 'Cast 25 votes total', tier: 'rare', icon: '🌟' },
        { badgeType: 'voting_streak_100', name: '👑 Voting Legend', description: 'Cast 100 votes total', tier: 'epic', icon: '👑' },
        { badgeType: 'proposal_creator', name: '💡 Idea Spark', description: 'Created your first proposal', tier: 'common', icon: '💡' },
        { badgeType: 'proposal_creator_5', name: '📋 Thought Leader', description: 'Created 5 proposals', tier: 'rare', icon: '📋' },
        { badgeType: 'referral_5', name: '🤝 Community Builder', description: 'Referred 5 people to Represent', tier: 'rare', icon: '🤝' },
        { badgeType: 'referral_20', name: '🌍 Network Connector', description: 'Referred 20 people to Represent', tier: 'epic', icon: '🌍' },
        { badgeType: 'first_vote_country', name: '🌐 Regional Voice', description: 'First vote in your country', tier: 'common', icon: '🌐' },
        { badgeType: 'first_vote_state', name: '🏛️ State Pioneer', description: 'First vote in your state/province', tier: 'common', icon: '🏛️' },
        { badgeType: 'first_vote_city', name: '🏘️ Local Hero', description: 'First vote in your city', tier: 'common', icon: '🏘️' },
        { badgeType: 'voting_consensus', name: '🎯 On Point', description: 'Vote on a proposal that passed with 80%+ support', tier: 'rare', icon: '🎯' },
        { badgeType: 'early_adopter', name: '🚀 Early Adopter', description: 'Joined Represent in the first month', tier: 'epic', icon: '🚀' },
        { badgeType: 'democratic_spirit', name: '✨ Democratic Spirit', description: 'Voted on proposals from all categories', tier: 'legendary', icon: '✨' },
      ];

      for (const badgeDef of badgeDefinitions) {
        const existing = await db.query.badges.findFirst({
          where: eq(badges.badgeType, badgeDef.badgeType),
        });
        if (!existing) {
          await db.insert(badges).values(badgeDef);
        }
      }

      res.json({ success: true, message: 'Badges initialized' });
    } catch (error) {
      console.error('Badge init error:', error);
      res.status(500).json({ error: 'Failed to initialize badges' });
    }
  });

  // Check and award badges
  app.post('/api/badges/check-and-award', async (req, res) => {
    try {
      const { userId, type, data } = req.body;
      const newBadges: any[] = [];

      if (type === 'vote_cast') {
        // Award first vote badge
        const userVotes = await db.query.votes.findMany({ where: eq(votes.userId, userId) });

        if (userVotes.length === 1) {
          const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'first_vote_global') });
          if (badge) {
            const existing = await db.query.userBadges.findFirst({
              where: and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id!)),
            });
            if (!existing) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id! });
              newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
            }
          }
        }

        // Award location-based badges
        const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
        if (user?.country) {
          const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'first_vote_country') });
          if (badge) {
            const existing = await db.query.userBadges.findFirst({
              where: and(
                eq(userBadges.userId, userId),
                eq(userBadges.badgeId, badge.id!),
                eq(userBadges.location, user.country)
              ),
            });
            if (!existing) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id!, location: user.country });
              newBadges.push({ id: badge.id, name: badge.name, location: user.country, tier: badge.tier });
            }
          }
        }

        // Award voting streak badges
        if (userVotes.length === 5) {
          const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'voting_streak_5') });
          if (badge) {
            const existing = await db.query.userBadges.findFirst({
              where: and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id!)),
            });
            if (!existing) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id! });
              newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
            }
          }
        }
        if (userVotes.length === 25) {
          const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'voting_streak_25') });
          if (badge) {
            const existing = await db.query.userBadges.findFirst({
              where: and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id!)),
            });
            if (!existing) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id! });
              newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
            }
          }
        }
        if (userVotes.length === 100) {
          const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'voting_streak_100') });
          if (badge) {
            const existing = await db.query.userBadges.findFirst({
              where: and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id!)),
            });
            if (!existing) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id! });
              newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
            }
          }
        }
      }

      if (type === 'proposal_created') {
        const userProposals = await db.query.proposals.findMany({ where: eq(proposals.userId, userId) });
        if (userProposals.length === 1) {
          const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'proposal_creator') });
          if (badge) {
            const existing = await db.query.userBadges.findFirst({
              where: and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id!)),
            });
            if (!existing) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id! });
              newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
            }
          }
        }
        if (userProposals.length === 5) {
          const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'proposal_creator_5') });
          if (badge) {
            const existing = await db.query.userBadges.findFirst({
              where: and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id!)),
            });
            if (!existing) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id! });
              newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
            }
          }
        }
      }

      if (type === 'passport_minted') {
        const badge = await db.query.badges.findFirst({ where: eq(badges.badgeType, 'passport_minted') });
        if (badge) {
          const existing = await db.query.userBadges.findFirst({
            where: and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id!)),
          });
          if (!existing) {
            await db.insert(userBadges).values({ userId, badgeId: badge.id! });
            newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier });
          }
        }
      }

      res.json({ newBadges });
    } catch (error) {
      console.error('Badge error:', error);
      res.status(500).json({ error: 'Failed to check badges' });
    }
  });

  // Retroactively check and backfill all badges based on user's stats
  app.post('/api/badges/backfill/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const newBadges: any[] = [];

      // Get user stats
      const userVotes = await db.select().from(votes).where(eq(votes.userId, userId));
      const userProposals = await db.select().from(proposals).where(eq(proposals.userId, userId));
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const voteCount = userVotes.length;
      const proposalCount = userProposals.length;

      // Check all badge types and award if criteria met
      const badgeChecks = [
        // Voting badges
        { type: 'first_vote_global', condition: () => voteCount >= 1 },
        { type: 'voting_streak_5', condition: () => voteCount >= 5 },
        { type: 'voting_streak_25', condition: () => voteCount >= 25 },
        { type: 'voting_streak_100', condition: () => voteCount >= 100 },
        // Proposal badges
        { type: 'proposal_creator', condition: () => proposalCount >= 1 },
        { type: 'proposal_creator_5', condition: () => proposalCount >= 5 },
        // Location badges
        { type: 'first_vote_country', condition: () => voteCount >= 1 && user[0]?.country },
        { type: 'first_vote_state', condition: () => voteCount >= 1 && user[0]?.state },
        { type: 'first_vote_city', condition: () => voteCount >= 1 && user[0]?.city },
      ];

      for (const check of badgeChecks) {
        if (check.condition()) {
          const badgesList = await db.select().from(badges).where(eq(badges.badgeType, check.type)).limit(1);
          const badge = badgesList[0];
          if (badge) {
            const existing = await db.select().from(userBadges).where(and(eq(userBadges.userId, userId), eq(userBadges.badgeId, badge.id))).limit(1);
            if (!existing.length) {
              await db.insert(userBadges).values({ userId, badgeId: badge.id });
              newBadges.push({ id: badge.id, name: badge.name, tier: badge.tier, badgeType: check.type });
            }
          }
        }
      }

      res.json({ success: true, newBadges, totalStats: { votes: voteCount, proposals: proposalCount } });
    } catch (error) {
      console.error('Badge backfill error:', error);
      res.status(500).json({ error: 'Failed to backfill badges' });
    }
  });

  // Get user badges
  app.get('/api/badges/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const userBadgesList = await db.select().from(userBadges).where(eq(userBadges.userId, userId));

      // Fetch badge details for each user badge
      const badgesWithDetails = await Promise.all(userBadgesList.map(async (ub) => {
        const badgeDetail = await db.select().from(badges).where(eq(badges.id, ub.badgeId)).limit(1);
        return { ...ub, badge: badgeDetail[0] };
      }));

      res.json(badgesWithDetails);
    } catch (error) {
      console.error('Get badges error:', error);
      res.status(500).json({ error: 'Failed to fetch badges' });
    }
  });
}
