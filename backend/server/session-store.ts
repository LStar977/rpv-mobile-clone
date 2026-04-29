import { Store } from 'express-session';
import { db } from './db';
import { sessions } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class PostgresSessionStore extends Store {
  async get(sid: string, callback: (err: Error | null, session?: Express.SessionData | null) => void) {
    try {
      const result = await db.select().from(sessions).where(eq(sessions.sid, sid)).limit(1);
      const row = result[0];

      if (!row) {
        callback(null, null);
        return;
      }

      const sess = row.sess;
      if (typeof sess === 'string') {
        callback(null, JSON.parse(sess));
      } else {
        callback(null, sess as any);
      }
    } catch (err) {
      callback(err as Error);
    }
  }

  async set(sid: string, session: Express.SessionData, callback?: (err?: Error | null) => void) {
    try {
      const expire = new Date(session.cookie.expires || Date.now() + 7 * 24 * 60 * 60 * 1000);
      const sess = JSON.stringify(session);

      // Check if session exists
      const existing = await db.select().from(sessions).where(eq(sessions.sid, sid)).limit(1);

      if (existing.length > 0) {
        // Update existing session
        await db.update(sessions)
          .set({ sess, expire })
          .where(eq(sessions.sid, sid));
      } else {
        // Insert new session
        await db.insert(sessions).values({ sid, sess, expire });
      }

      if (callback) callback();
    } catch (err) {
      if (callback) callback(err as Error);
    }
  }

  async destroy(sid: string, callback?: (err?: Error | null) => void) {
    try {
      await db.delete(sessions).where(eq(sessions.sid, sid));
      if (callback) callback();
    } catch (err) {
      if (callback) callback(err as Error);
    }
  }

  async touch(sid: string, session: Express.SessionData, callback?: (err?: Error | null) => void) {
    try {
      const expire = new Date(session.cookie.expires || Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.update(sessions)
        .set({ expire })
        .where(eq(sessions.sid, sid));

      if (callback) callback();
    } catch (err) {
      if (callback) callback(err as Error);
    }
  }
}
