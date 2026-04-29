import passport from "passport";
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage-db";
import { baseNetwork } from "./base-network";
import { log } from "./app";
import { PostgresSessionStore } from "./session-store";

const JWT_SECRET = process.env.SESSION_SECRET;
const JWT_EXPIRES_IN = '7d';

if (!JWT_SECRET) {
  console.warn('WARNING: SESSION_SECRET not set. Mobile auth will be disabled.');
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  return session({
    store: new PostgresSessionStore(),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

async function upsertUserFromGoogle(profile: any) {
  const userId = `google_${profile.id}`;
  const email = profile.emails?.[0]?.value;
  const firstName = profile.name?.givenName;
  const lastName = profile.name?.familyName;
  const displayName = profile.displayName || [firstName, lastName].filter(Boolean).join(" ") || email;
  const profileImageUrl = profile.photos?.[0]?.value;

  const user = await storage.upsertUser({
    id: userId,
    email: email,
    firstName: firstName,
    lastName: lastName,
    name: displayName,
    profileImageUrl: profileImageUrl,
  });

  const wallet = await storage.getUserWallet(user.id);
  if (!wallet) {
    const { address, privateKey } = await baseNetwork.generateSmartWallet(user.id);
    await storage.createWallet(user.id, address, privateKey);
    log(`Auto-generated wallet for Google OAuth user: ${user.id}`);
  }

  return user;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    console.error('ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for authentication');
    return;
  }

  const callbackURL = process.env.NODE_ENV === 'production'
    ? 'https://representportal.com/api/auth/google/callback'
    : `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/api/auth/google/callback`;

  passport.use(new GoogleStrategy({
    clientID: googleClientId,
    clientSecret: googleClientSecret,
    callbackURL: callbackURL,
  }, async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
    try {
      const user = await upsertUserFromGoogle(profile);
      const sessionUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        profileImageUrl: user.profileImageUrl,
        accessToken,
        refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };
      done(null, sessionUser as any);
    } catch (error) {
      log(`Google OAuth error: ${error}`);
      done(error as Error);
    }
  }) as any);

  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    const returnTo = req.query.returnTo;
    if (returnTo && typeof returnTo === 'string') {
      (req as any).session.returnTo = returnTo;
    }
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account',
    })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    const returnTo = (req as any).session?.returnTo;
    const successRedirect = returnTo || "/dashboard";

    if ((req as any).session) {
      delete (req as any).session.returnTo;
    }

    passport.authenticate('google', {
      successRedirect: successRedirect,
      failureRedirect: "/auth",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        log(`Logout error: ${err}`);
      }
      req.session.destroy((err) => {
        if (err) {
          log(`Session destroy error: ${err}`);
        }
        res.redirect("/");
      });
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      log(`[AUTH DEBUG] Looking up user - ID: "${userId}", Email: "${userEmail}", Session: ${JSON.stringify(req.user)}`);

      let user = await storage.getUser(userId);
      log(`[AUTH DEBUG] User by ID: ${user ? `found (verified=${user.verified}, country=${user.country}, state=${user.state}, city=${user.city})` : 'not found'}`);

      if (!user && userEmail) {
        user = await storage.getUserByEmail(userEmail);
        log(`[AUTH DEBUG] User by email: ${user ? `found (verified=${user.verified})` : 'not found'}`);
      }

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      log(`[AUTH DEBUG] Returning user: id=${user.id}, verified=${user.verified}, country=${user.country}, state=${user.state}, city=${user.city}`);

      // Explicitly include all fields to ensure they're not stripped
      const userResponse = {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        walletAddress: user.walletAddress,
        verified: user.verified,
        verificationId: user.verificationId,
        verificationMethod: user.verificationMethod,
        verifiedAt: user.verifiedAt,
        country: user.country,
        state: user.state,
        city: user.city,
        documentType: user.documentType,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        isAdmin: user.isAdmin,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      log(`[AUTH DEBUG] Response object country=${userResponse.country}, state=${userResponse.state}, city=${userResponse.city}`);
      return res.json(userResponse);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/auth/user-legacy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not found" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const wallet = await storage.getUserWallet(userId);
      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        walletAddress: wallet?.address,
        verified: user.verified,
        isAdmin: user.isAdmin || false,
      });
    } catch (error) {
      log(`Error fetching user: ${error}`);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/mobile/google", async (req, res) => {
    try {
      if (!JWT_SECRET) {
        return res.status(503).json({ error: "Mobile auth not configured" });
      }

      const { idToken, email, name, profileImageUrl } = req.body;

      if (!idToken) {
        return res.status(400).json({ error: "Missing access token" });
      }

      const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (!googleResponse.ok) {
        log(`Google token verification failed: ${googleResponse.status}`);
        return res.status(401).json({ error: "Invalid Google token" });
      }

      const googleUser = await googleResponse.json();
      const userId = `google_${googleUser.sub}`;

      const user = await storage.upsertUser({
        id: userId,
        email: googleUser.email || email,
        name: googleUser.name || name,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
        profileImageUrl: googleUser.picture || profileImageUrl,
      });

      const wallet = await storage.getUserWallet(user.id);
      if (!wallet) {
        const { address, privateKey } = await baseNetwork.generateSmartWallet(user.id);
        await storage.createWallet(user.id, address, privateKey);
        log(`Auto-generated wallet for mobile Google user: ${user.id}`);
      }

      const token = jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const userWallet = await storage.getUserWallet(user.id);

      log(`Mobile Google login successful: ${user.id}`);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          walletAddress: userWallet?.address,
        },
      });
    } catch (error) {
      log(`Mobile Google login error: ${error}`);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.post("/api/auth/mobile/apple", async (req, res) => {
    try {
      if (!JWT_SECRET) {
        return res.status(503).json({ error: "Mobile auth not configured" });
      }

      const { identityToken, id, email, name } = req.body;

      if (!identityToken) {
        return res.status(400).json({ error: "Missing identity token" });
      }

      let userId: string | undefined;
      let userEmail = email;
      let userName = name;

      try {
        const tokenParts = identityToken.split('.');
        if (tokenParts.length !== 3) {
          return res.status(400).json({ error: "Invalid token format" });
        }

        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());

        if (!payload.sub || !payload.iss || !payload.aud) {
          return res.status(400).json({ error: "Invalid token claims" });
        }

        if (payload.iss !== 'https://appleid.apple.com') {
          return res.status(400).json({ error: "Invalid token issuer" });
        }

        if (payload.exp && payload.exp < Date.now() / 1000) {
          return res.status(400).json({ error: "Token expired" });
        }

        userId = `apple_${payload.sub}`;
        userEmail = userEmail || payload.email;
      } catch (decodeError) {
        log(`Apple token decode error: ${decodeError}`);
        return res.status(400).json({ error: "Failed to decode token" });
      }

      if (!userId) {
        return res.status(400).json({ error: "Could not identify user" });
      }

      if (!userId.startsWith('apple_')) {
        userId = `apple_${userId}`;
      }

      const user = await storage.upsertUser({
        id: userId,
        email: userEmail || `${userId}@privaterelay.appleid.com`,
        name: userName || 'Apple User',
        firstName: userName?.split(' ')[0],
        lastName: userName?.split(' ').slice(1).join(' '),
        profileImageUrl: null,
      });

      const wallet = await storage.getUserWallet(user.id);
      if (!wallet) {
        const { address, privateKey } = await baseNetwork.generateSmartWallet(user.id);
        await storage.createWallet(user.id, address, privateKey);
        log(`Auto-generated wallet for mobile Apple user: ${user.id}`);
      }

      const token = jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const userWallet = await storage.getUserWallet(user.id);

      log(`Mobile Apple login successful: ${user.id}`);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          walletAddress: userWallet?.address,
        },
      });
    } catch (error) {
      log(`Mobile Apple login error: ${error}`);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  const DEMO_PASSWORD_HASH = '$2b$10$6KQiPZPSrg5Dw1DNTn4VNeMraSGFqrc0yiqJf/bt3MnWH24lrMYDy';
  const DEMO_EMAIL = 'demo@represent.app';
  const DEMO_USER_ID = 'demo_appstore_reviewer';

  app.post("/api/auth/mobile/demo", async (req, res) => {
    try {
      if (!JWT_SECRET) {
        return res.status(503).json({ error: "Mobile auth not configured" });
      }

      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Missing email or password" });
      }

      if (email !== DEMO_EMAIL) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, DEMO_PASSWORD_HASH);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const user = await storage.upsertUser({
        id: DEMO_USER_ID,
        email: DEMO_EMAIL,
        name: 'App Store Reviewer',
        firstName: 'App Store',
        lastName: 'Reviewer',
        profileImageUrl: null,
      });

      await storage.updateUserStripeInfo(DEMO_USER_ID, {
        subscriptionStatus: 'active',
      });

      const wallet = await storage.getUserWallet(user.id);
      if (!wallet) {
        try {
          const { address, privateKey } = await baseNetwork.generateSmartWallet(user.id);
          await storage.createWallet(user.id, address, privateKey);
          log(`Auto-generated wallet for demo user: ${user.id}`);
        } catch (walletError) {
          log(`Demo user wallet generation skipped: ${walletError}`);
        }
      }

      const token = jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      const userWallet = await storage.getUserWallet(user.id);

      log(`Demo login successful: ${user.id}`);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          walletAddress: userWallet?.address || null,
          country: 'Canada',
          state: 'Ontario',
          city: 'Toronto',
          verified: true,
          isPremium: true,
          subscriptionStatus: 'active',
        },
      });
    } catch (error) {
      log(`Demo login error: ${error}`);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  app.get("/api/auth/verify", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No token provided" });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET!) as { sub: string; email: string };

      const user = await storage.getUser(decoded.sub);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      const wallet = await storage.getUserWallet(user.id);

      const isDemoUser = user.id === DEMO_USER_ID;

      res.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          walletAddress: wallet?.address,
          verified: isDemoUser ? true : (user.verified || false),
          country: isDemoUser ? 'Canada' : (user.country || ''),
          state: isDemoUser ? 'Ontario' : (user.state || ''),
          city: isDemoUser ? 'Toronto' : (user.city || ''),
          isPremium: isDemoUser ? true : undefined,
          subscriptionStatus: isDemoUser ? 'active' : undefined,
        },
      });
    } catch (error) {
      log(`Token verification error: ${error}`);
      res.status(401).json({ error: "Invalid token" });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ') && JWT_SECRET) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string };

      // Normalize mobile auth to match web session structure
      // This ensures req.user.claims?.sub works for both auth methods
      (req as any).user = {
        id: decoded.sub,
        email: decoded.email,
        isMobileAuth: true,
        claims: {
          sub: decoded.sub,
          email: decoded.email,
        },
      };
      return next();
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = req.user as any;
  const now = Math.floor(Date.now() / 1000);

  if (user.expires_at && now > user.expires_at) {
    return res.status(401).json({ error: "Session expired" });
  }

  // Normalize web session auth to have claims object like mobile auth
  // This ensures req.user.claims?.sub works for both auth methods
  if (!user.claims && user.id) {
    user.claims = {
      sub: user.id,
      email: user.email,
    };
  }

  return next();
};
