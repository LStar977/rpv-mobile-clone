// ─────────────────────────────────────────────────────────────────────────────
// Publish the Alberta Shadow Referendum slate (10 questions).
//
// Same shape as publish-civic-desk.ts with two differences:
//   1. Proposal IDs are FIXED — the representvote.com/alberta campaign page
//      hard-codes these UUIDs, so the rows must be created with them.
//   2. Deadline is fixed: October 18, 2026, 9 PM Mountain (the night before
//      Alberta's official referendum on October 19).
//
// Idempotent: a slate entry whose ID already exists is skipped.
//
// Run from the directory that contains server/ and scripts/:
//   npx tsx scripts/publish-alberta-referendum.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { users, proposals } from "@shared/schema";

const CIVIC_DESK_EMAIL = "civicdesk@representvote.com";
const CIVIC_DESK_NAME = "Represent Civic Desk";
const CLOSES_AT = new Date("2026-10-18T21:00:00-06:00"); // 9 PM Mountain, Oct 18

interface ReferendumBallot {
  id: string;
  num: number;
  title: string;
  description: string;
  category: string;
  voteType: "yes-no" | "multiple-choice";
  options?: string[];
  requiresCitizenship?: boolean;
}

async function main() {
  const slate: ReferendumBallot[] = JSON.parse(
    readFileSync(new URL("./alberta-referendum-slate.json", import.meta.url), "utf-8"),
  );
  console.log(`Alberta referendum slate loaded: ${slate.length} questions`);

  // ── Publishing account (same identity as the Civic Desk slate) ─────────
  let desk = (
    await db.select().from(users).where(eq(users.email, CIVIC_DESK_EMAIL)).limit(1)
  )[0];
  if (!desk) {
    const id = randomUUID();
    await db.insert(users).values({
      id,
      email: CIVIC_DESK_EMAIL,
      name: CIVIC_DESK_NAME,
      verified: true,
      verificationMethod: "manual",
      country: "Canada",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    desk = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
    console.log(`Created Civic Desk account: ${id}`);
  } else {
    console.log(`Civic Desk account exists: ${desk.id}`);
  }

  // ── Publish with FIXED ids ─────────────────────────────────────────────
  const created: string[] = [];
  const skipped: string[] = [];

  for (const q of slate) {
    const existing = (
      await db.select({ id: proposals.id }).from(proposals).where(eq(proposals.id, q.id)).limit(1)
    )[0];
    if (existing) {
      skipped.push(`Q${q.num} ${q.title}`);
      continue;
    }

    await db.insert(proposals).values({
      id: q.id,
      userId: desk.id,
      title: q.title,
      description: q.description,
      category: q.category,
      supportVotes: 0,
      opposeVotes: 0,
      createdAt: new Date(),
      deadline: CLOSES_AT,
      geoRestrictions: ["Canada", "Alberta"],
      demographicRestrictions: {},
      voteType: q.voteType,
      options: q.options ?? [],
      requiresCitizenship: !!q.requiresCitizenship,
    } as any);

    created.push(`Q${q.num}  ${q.id}  ${q.title}`);
    console.log(`Published Q${q.num}: ${q.title}`);
  }

  console.log("\n── Result ──");
  console.log(`Created: ${created.length}`);
  created.forEach((c) => console.log(`  ${c}`));
  console.log(`Skipped (already exist): ${skipped.length}`);
  skipped.forEach((s) => console.log(`  ${s}`));
  console.log(`\nAll close ${CLOSES_AT.toISOString()} — the night before Alberta votes.`);
  console.log("Verify: GET /api/public/referendum-tallies returns all 10 ids.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Publish failed:", e);
  process.exit(1);
});
