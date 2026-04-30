import { type Server } from "node:http";

import express, { type Express, type Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { registerRoutes } from "./routes";

// Sentry init runs at module load. No-op when SENTRY_DSN isn't set, so it's
// safe to leave wired up even if you haven't created a Sentry project yet.
const SENTRY_PII_FIELDS = new Set([
  "email", "phone", "dateOfBirth", "verificationId",
  "walletAddress", "privateKey", "token", "refreshToken",
  "firstName", "lastName", "name",
]);
function scrubPii(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(scrubPii);
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENTRY_PII_FIELDS.has(k)) {
      out[k] = "[redacted]";
    } else if (typeof v === "object") {
      out[k] = scrubPii(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Strip request bodies / extra context that may carry PII before
    // anything leaves the server.
    if (event.request) {
      event.request.data = scrubPii(event.request.data);
      event.request.headers = scrubPii(event.request.headers);
    }
    if (event.extra) event.extra = scrubPii(event.extra);
    if (event.user) event.user = { id: event.user.id }; // keep id only
    return event;
  },
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

// Sentry request handler must be the FIRST middleware to capture all events.
app.use(Sentry.Handlers.requestHandler());

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '5mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '5mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  const server = await registerRoutes(app);

  // Sentry error handler runs BEFORE our own error middleware so it can
  // capture the error before we send the response.
  app.use(Sentry.Handlers.errorHandler());

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
}
