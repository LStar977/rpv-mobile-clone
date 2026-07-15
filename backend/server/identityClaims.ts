// ─────────────────────────────────────────────────────────────────────────────
// ONE VERIFIED PERSON · ONE ACCOUNT
//
// Prevents the same real-world identity from verifying more than one
// Represent account. When a verification provider (Veriff / Didit) approves
// a session, we derive a stable, privacy-safe fingerprint of the person and
// record which account claimed it. A second account presenting the same
// identity is refused verification.
//
// Privacy: we never store document numbers, names, or birthdays. The
// fingerprint is an HMAC-SHA256 keyed with a server secret — irreversible
// without the key, and meaningless outside this database. This keeps the
// product promise: "checked, never kept."
//
// TWO fingerprints are claimed per verification (both must be free):
//   1. document fingerprint: number + issuing country — unique per document
//   2. person fingerprint: full name + date of birth — the same human
//      switching documents (driver's license on one account, passport on
//      another) or renewing a document still collides here
// If neither is derivable the claim is 'skipped' — we fail OPEN for the
// legitimate user and log loudly, rather than locking real people out on a
// provider payload quirk.
//
// Known trade-off: two different real people sharing an identical full name
// AND exact date of birth would collide on the person fingerprint. That's
// rare, and the product answer is the support path on the P2 screen —
// integrity of the count wins the tie.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { sql } from "drizzle-orm";
import { db } from "./db";

export interface IdentityParts {
  docNumber?: string | null;
  docCountry?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
}

const norm = (s: any) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function hmacKey(): string | null {
  // Dedicated key preferred; falls back to the Veriff master key so no new
  // secret needs provisioning. Changing the key orphans old claims — set
  // IDENTITY_HASH_KEY once and never rotate it casually.
  return process.env.IDENTITY_HASH_KEY || process.env.VERIFF_MASTER_SIGNATURE_KEY || null;
}

// All derivable fingerprints for this person — document AND person-level.
export function identityHashesFromParts(parts: IdentityParts): string[] {
  const key = hmacKey();
  if (!key) return [];
  const hashes: string[] = [];
  const hmac = (material: string) => crypto.createHmac("sha256", key).update(material).digest("hex");
  const doc = norm(parts.docNumber);
  if (doc) hashes.push(hmac(`doc|${norm(parts.docCountry)}|${doc}`));
  const first = norm(parts.firstName);
  const last = norm(parts.lastName);
  const dob = norm(parts.dateOfBirth);
  if (first && last && dob) hashes.push(hmac(`pii|${first}|${last}|${dob}`));
  return hashes;
}

// Veriff decision payloads: verification.person / verification.document.
export function identityPartsFromVeriff(verification: any): IdentityParts {
  const person = verification?.person || {};
  const document = verification?.document || {};
  return {
    docNumber: document.number,
    docCountry: document.country,
    firstName: person.firstName,
    lastName: person.lastName,
    dateOfBirth: person.dateOfBirth,
  };
}

// Didit decision payloads vary by workflow version — probe common key names
// recursively (same defensive posture as mapDiditDecisionToUserFields).
const DIDIT_DOC_KEYS = new Set([
  "document_number", "documentnumber", "id_number", "idnumber",
  "personal_number", "personalnumber", "document_no", "passport_number",
]);
export function identityPartsFromDidit(decision: any, mapped: { firstName?: string; lastName?: string; dateOfBirth?: string; country?: string }): IdentityParts {
  let docNumber: string | null = null;
  const visit = (node: any, depth: number) => {
    if (docNumber || !node || typeof node !== "object" || depth > 6) return;
    for (const [k, v] of Object.entries(node)) {
      if (docNumber) return;
      if (typeof v === "string" && v.trim() && DIDIT_DOC_KEYS.has(k.toLowerCase().replace(/[^a-z_]/g, ""))) {
        docNumber = v;
        return;
      }
      if (v && typeof v === "object") visit(v, depth + 1);
    }
  };
  try { visit(decision, 0); } catch { /* best-effort */ }
  return {
    docNumber,
    docCountry: mapped.country,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    dateOfBirth: mapped.dateOfBirth,
  };
}

// ── storage ──────────────────────────────────────────────────────────────────

let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS identity_claims (
          identity_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          method TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS identity_claims_user_id_idx ON identity_claims (user_id)
      `);
    })().catch((e) => {
      tableReady = null; // allow retry on next call
      throw e;
    });
  }
  return tableReady;
}

export type ClaimResult = "claimed" | "already-yours" | "taken" | "skipped";

// Atomically claim every derivable fingerprint of this identity for a user.
//   'claimed'       → all fingerprints free (or already this user's), proceed
//   'already-yours' → same user re-verifying (retries, doc renewal), proceed
//   'taken'         → ANOTHER account owns any fingerprint — refuse
//   'skipped'       → nothing derivable (or no key) — proceed, logged loudly
export async function claimIdentity(
  parts: IdentityParts,
  userId: string,
  method: string,
  log?: (msg: string) => void,
): Promise<ClaimResult> {
  const say = log || (() => {});
  if (!userId) return "skipped";
  const hashes = identityHashesFromParts(parts);
  if (hashes.length === 0) {
    say(`identity-claims: no fingerprint derivable for user=${userId} (${method}) — verification allowed, NOT deduped (is IDENTITY_HASH_KEY set?)`);
    return "skipped";
  }
  try {
    await ensureTable();

    // Check every fingerprint first — a single hit by another account
    // refuses the whole verification (this is what stops "driver's license
    // on account one, passport on account two": the person fingerprint
    // collides even when the document numbers differ).
    for (const hash of hashes) {
      const owner: any = await db.execute(sql`
        SELECT user_id FROM identity_claims WHERE identity_hash = ${hash}
      `);
      const ownerRows = owner?.rows ?? owner ?? [];
      const ownerId = ownerRows[0]?.user_id;
      if (ownerId && String(ownerId) !== String(userId)) {
        say(`identity-claims: DUPLICATE IDENTITY BLOCKED — user=${userId} presented an identity already claimed by another account (${method})`);
        return "taken";
      }
    }

    // All free (or ours) — claim them all. If an insert conflicts, re-check
    // the owner: a concurrent verification may have won the race, in which
    // case this account is refused too.
    let insertedAny = false;
    for (const hash of hashes) {
      const inserted: any = await db.execute(sql`
        INSERT INTO identity_claims (identity_hash, user_id, method)
        VALUES (${hash}, ${userId}, ${method})
        ON CONFLICT (identity_hash) DO NOTHING
        RETURNING user_id
      `);
      const insertedRows = inserted?.rows ?? inserted ?? [];
      if (Array.isArray(insertedRows) && insertedRows.length > 0) {
        insertedAny = true;
        continue;
      }
      const owner: any = await db.execute(sql`
        SELECT user_id FROM identity_claims WHERE identity_hash = ${hash}
      `);
      const ownerRows = owner?.rows ?? owner ?? [];
      const ownerId = ownerRows[0]?.user_id;
      if (ownerId && String(ownerId) !== String(userId)) {
        say(`identity-claims: DUPLICATE IDENTITY BLOCKED (race) — user=${userId} lost the claim to another account (${method})`);
        return "taken";
      }
    }
    return insertedAny ? "claimed" : "already-yours";
  } catch (e: any) {
    // Fail open: a database hiccup must not lock real people out of
    // verification. The gap is logged so it can be audited.
    say(`identity-claims: claim check errored (${e?.message || e}) — verification allowed, NOT deduped`);
    return "skipped";
  }
}

// The message shown to a user whose verification was refused because the
// identity already verified a different account.
export const DUPLICATE_IDENTITY_MESSAGE =
  "This ID has already been used to verify another Represent account. One person, one account — sign in to the account you verified first, or contact support if you believe this is an error.";
