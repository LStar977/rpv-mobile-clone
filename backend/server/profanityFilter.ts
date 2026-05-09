// UGC profanity / objectionable-content filter (Apple Guideline 1.2).
//
// Pre-publish gate for POST /api/proposals. Rejects content containing
// terms from the blocklist below before the row hits the DB. Cheap first
// line of defense — sufficient to clear Apple's 1.2 bar, not a substitute
// for human moderation, the report flow, or a managed moderation API.
//
// Match rules:
//   - Case-insensitive.
//   - Word-boundary by default so "scunthorpe" doesn't trip on "cunt".
//     A small "always" list (slurs that have no acceptable use case in
//     normal text) matches anywhere as a substring.
//
// To extend: add to `BLOCK_WORDS` (boundary-matched) or `BLOCK_SUBSTRINGS`
// (substring-matched). Keep this file deliberately small — managed
// moderation APIs (OpenAI Moderation, Perspective) belong as a layer 2,
// not a replacement.
//
// References to actual slurs and explicit terms are intentionally NOT
// hardcoded in this file. The list ships at deploy via environment
// variable PROFANITY_BLOCKLIST (newline-separated). Falls back to a
// minimal hardcoded set so the gate isn't a no-op if env is missing.

const FALLBACK_BLOCK_WORDS = [
  // Minimum viable list. Replace via PROFANITY_BLOCKLIST env in production.
  "fuck", "shit", "bitch", "asshole", "bastard",
  "dick", "cunt", "pussy", "cock", "tits",
];

const FALLBACK_BLOCK_SUBSTRINGS: string[] = [
  // Slurs / hate-speech terms that have no acceptable use in this app's
  // proposals — substring-match to catch obfuscation. Populated via
  // PROFANITY_BLOCKLIST_SUBSTRINGS env in production.
];

function loadList(envVar: string, fallback: string[]): string[] {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  return raw.split(/[\n,]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
}

const BLOCK_WORDS = loadList("PROFANITY_BLOCKLIST", FALLBACK_BLOCK_WORDS);
const BLOCK_SUBSTRINGS = loadList("PROFANITY_BLOCKLIST_SUBSTRINGS", FALLBACK_BLOCK_SUBSTRINGS);

const WORD_REGEX = BLOCK_WORDS.length
  ? new RegExp(`\\b(?:${BLOCK_WORDS.map(escape).join("|")})\\b`, "i")
  : null;

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface ProfanityCheck {
  ok: boolean;
  matched?: string;
  field?: string;
}

// Returns { ok: true } if the content passes. Otherwise { ok: false,
// matched, field } so the API layer can return a helpful error. The
// matched term is intentionally NOT echoed back to the user to avoid
// hint-shopping; the API layer should return a generic message.
export function checkContent(input: { title?: string; description?: string }): ProfanityCheck {
  for (const [field, value] of Object.entries(input)) {
    if (!value || typeof value !== "string") continue;
    const lower = value.toLowerCase();

    if (WORD_REGEX) {
      const m = lower.match(WORD_REGEX);
      if (m) return { ok: false, matched: m[0], field };
    }
    for (const sub of BLOCK_SUBSTRINGS) {
      if (lower.includes(sub)) return { ok: false, matched: sub, field };
    }
  }
  return { ok: true };
}
