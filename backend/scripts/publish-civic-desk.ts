// ─────────────────────────────────────────────────────────────────────────────
// Publish the Represent Civic Desk launch slate.
//
// One-time (but idempotent) data task:
//   1. Ensures the "Represent Civic Desk" publishing account exists
//   2. Publishes every ballot in ./civic-desk-slate.json as a real, open
//      proposal owned by that account (deadline = now + deadlineDays)
//   3. Skips any slate ballot that already exists (matched by title +
//      owner), so re-running never duplicates
//
// Run from the directory that contains server/ and scripts/:
//   npx tsx scripts/publish-civic-desk.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../server/db";
import { users, proposals } from "@shared/schema";

const CIVIC_DESK_EMAIL = "civicdesk@representvote.com";
const CIVIC_DESK_NAME = "Represent Civic Desk";

interface SlateBallot {
  title: string;
  description: string;
  category: string;
  geoRestrictions: string[];
  deadlineDays: number;
}

async function main() {
  const slate: SlateBallot[] = JSON.parse(
    readFileSync(new URL("./civic-desk-slate.json", import.meta.url), "utf-8"),
  );
  console.log(`Slate loaded: ${slate.length} ballots`);

  // ── 1. Publishing account ──────────────────────────────────────────────
  let desk = (
    await db.select().from(users).where(eq(users.email, CIVIC_DESK_EMAIL)).limit(1)
  )[0];

  if (!desk) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: CIVIC_DESK_EMAIL,
      name: CIVIC_DESK_NAME,
      // A publishing identity, not a person: verified so its proposals are
      // first-class, but it has no password and no login path.
      verified: true,
      verificationMethod: "manual",
      country: "Canada",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    desk = (
      await db.select().from(users).where(eq(users.id, id)).limit(1)
    )[0];
    console.log(`Created Civic Desk account: ${id}`);
  } else {
    console.log(`Civic Desk account exists: ${desk.id}`);
  }

  // ── 2. Publish each ballot (idempotent by title + owner) ───────────────
  const created: string[] = [];
  const skipped: string[] = [];

  for (const ballot of slate) {
    const existing = (
      await db
        .select({ id: proposals.id })
        .from(proposals)
        .where(and(eq(proposals.userId, desk.id), eq(proposals.title, ballot.title)))
        .limit(1)
    )[0];
    if (existing) {
      skipped.push(`${ballot.title} (already published: ${existing.id})`);
      continue;
    }

    const id = randomUUID();
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + ballot.deadlineDays);
    // Close at 21:00 local server time rather than the exact publish minute —
    // evening closings read better than 4:07 AM ones.
    deadline.setHours(21, 0, 0, 0);

    await db.insert(proposals).values({
      id,
      userId: desk.id,
      title: ballot.title,
      description: ballot.description,
      category: ballot.category,
      supportVotes: 0,
      opposeVotes: 0,
      createdAt: new Date(),
      deadline,
      geoRestrictions: ballot.geoRestrictions ?? [],
      demographicRestrictions: {},
      voteType: "yes-no",
      options: [],
    } as any);

    created.push(`${id}  ${ballot.deadlineDays}d  ${ballot.title}`);
    console.log(`Published: ${ballot.title} (closes ${deadline.toISOString()})`);
  }

  // ── 3. Report ──────────────────────────────────────────────────────────
  console.log("\n── Result ──");
  console.log(`Created: ${created.length}`);
  created.forEach((c) => console.log(`  ${c}`));
  console.log(`Skipped (already published): ${skipped.length}`);
  skipped.forEach((s) => console.log(`  ${s}`));
  console.log("\nVerify: GET /api/proposals should list them with future deadlines,");
  console.log("and /record should show them as LIVE.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Publish failed:", e);
  process.exit(1);
});
