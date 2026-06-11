# Represent Vote — Technical Briefing
*Investor prep document. Everything in here describes what is actually built and running, except where explicitly marked as roadmap.*

---

## 1. The 30-Second Architecture Answer

> "We're a React Native iOS app backed by a Node/Express API and Postgres. Every user gets a custodial smart wallet on Base — Coinbase's Ethereum Layer-2. Identity is verified through Didit, a KYC provider that checks government ID documents and extracts the user's verified location. Votes are written twice: once to Postgres for instant UX, and once to the Base blockchain as a token transfer, creating an immutable, publicly auditable record. The server relays blockchain transactions so users never touch gas fees or seed phrases — they get web3 auditability with web2 UX."

That's the elevator answer. Everything below is depth for follow-up questions.

---

## 2. System Map

```
┌─────────────────┐     HTTPS/JWT      ┌──────────────────────┐
│  iOS App         │ ◄════════════════► │  Node/Express API     │
│  (React Native / │                    │  (representportal.com)│
│   Expo SDK 51)   │                    └──────┬───────┬───────┘
└─────────────────┘                           │       │
        │                                      │       │
        │ WebView (whitelisted                 │       │ ethers.js
        │ didit.me domains only)               │       ▼
        ▼                              ┌───────┴──┐  ┌─────────────────┐
┌─────────────────┐    HMAC-signed     │ Postgres │  │ Base Network     │
│  Didit KYC       │ ═══webhooks═══►   │ (Neon)   │  │ (Ethereum L2)    │
│  (ID + liveness) │                   └──────────┘  │ - RPV token      │
└─────────────────┘                                  │ - Passport SBT   │
                                                     └─────────────────┘
┌─────────────────┐
│ Apple App Store  │ ──► Server-side receipt validation (shared secret)
│ Stripe (web/org) │ ──► Webhooks for org billing
└─────────────────┘
```

**Stack:** React Native 0.74 + Expo SDK 51 (iOS shipped; Android codebase ready), Node/Express + Drizzle ORM, Postgres (Neon), ethers.js v6 on Base, Didit for KYC, Apple IAP + Stripe for payments.

---

## 3. Identity Verification (Didit KYC)

### How it works
1. User taps "Verify" → server creates a Didit verification session → app opens it in a **whitelisted WebView** (only `didit.me` / `veriff.com` HTTPS domains can load — hardcoded allowlist, so a tampered URL can't phish the document upload).
2. Didit walks the user through: government ID capture, **liveness check** (selfie video — defeats photos of photos and most deepfake replays), document authenticity analysis.
3. Didit calls our webhook with the decision. **Every webhook is HMAC-SHA256 signed** — we verify the signature against the raw body with a constant-time comparison (`timingSafeEqual`), plus a timestamp header to prevent replay attacks. An attacker who discovers the webhook URL cannot forge a "verified" status.
4. On approval, the server extracts the user's **verified country / region / city** from the ID document data and stamps the account. This is what powers geo-gating — location comes from a government document, not from GPS or a user-typed field (both trivially fakeable).

### Two verification tiers
| Tier | Documents | Unlocks | Our cost |
|---|---|---|---|
| **Standard** | Driver's license / any gov ID | Geo-gated voting, proposal creation, verified badge | ~$0.15/check |
| **Citizen** | Passport + proof of address | Citizens-only proposals (e.g. referendum-grade votes) | ~$0.20–0.35/check |

Verification is **free for users** — we treat the KYC fee as acquisition cost. At under $0.35 per verified, geo-located, civically engaged user, it's the cheapest acquisition in the funnel. Orgs that mandate verification for members pay a one-time unlock fee that covers their members' checks (B2B subsidizes B2C).

### What we store vs. don't store
We store the **verification result** (verified: yes/no, country/region/city, citizenship flag) — not the document images. Document handling and biometrics stay inside Didit's certified infrastructure. This is a deliberate data-minimization choice: a breach of our database cannot leak passport scans, because we never have them.

---

## 4. Wallets & Blockchain (Base)

### Why Base
Base is Coinbase's Ethereum Layer-2. We chose it for: sub-cent transaction costs (we pay the gas, so this matters), Ethereum-grade security inherited through rollup architecture, and institutional credibility (Coinbase-incubated, massive ecosystem).

### Custodial wallet design — and why
- Every user gets an Ethereum wallet **generated deterministically from their user ID** (HD wallet derivation) at signup. Same user → same address, always.
- Private keys are stored server-side, **encrypted at rest with AES-256-GCM** (authenticated encryption — tampering with ciphertext is detectable). The encryption key lives in environment secrets, never in the database or codebase. We have key-rotation and migration tooling already built.
- **Why custodial:** our users are ordinary citizens, not crypto natives. Seed phrases, gas fees, and wallet apps would kill adoption at the door. Custodial wallets give every user a real on-chain identity with zero crypto knowledge required. (Roadmap: optional self-custody export for power users.)

### How a vote gets on-chain — the relay pattern
This is the part technical investors usually find interesting:

1. User taps vote → server validates everything (auth, verification, geo, dedup — see §5).
2. The vote transaction is **signed with the user's own private key** — so on-chain, the vote provably comes from *that user's address*, not from a server pool address.
3. The **server pays the gas**: it computes the exact gas cost, tops up the user's wallet with precisely that much ETH, then broadcasts the user-signed transaction. The user never sees any of this.
4. The vote itself is a transfer of 1 **RPV token** (our ERC-20) from the user's address to a **deterministic position address** — an address derived by hashing `proposalId + position` (e.g. `keccak256("abc123-support")`). Every yes/no/option for every proposal has its own derived address.
5. The transaction hash is stored with the vote record. Anyone can look it up on a public Base block explorer.

**The elegant property:** because position addresses are deterministic and public, *anyone* can independently tally a proposal by counting token transfers into its position addresses on a public block explorer — without trusting our API or our database. That's the auditability story in one sentence.

Additionally, verified users receive a **soulbound passport NFT** (non-transferable, EIP-712 signed mint) — an on-chain credential that this address belongs to a verified human. Soulbound = can't be sold or transferred, so verified status can't be bought on a secondary market.

---

## 5. Vote Integrity — "Why should I trust the results?"

Layered defenses, in order:

1. **One identity per human.** KYC with liveness detection at the gate. You can create burner emails; you cannot create burner passports.
2. **One vote per proposal per user.** Enforced in the database (checked before accepting) *and* on-chain (the token mechanics — each user gets 1 RPV per proposal-vote; the `hasVoted` check exists at the contract interface).
3. **Geo-gating from documents, not GPS.** A proposal scoped to Alberta only accepts votes from users whose *government ID* says Alberta. Spoofing GPS does nothing.
4. **Citizens-only gating** for referendum-grade proposals — requires the passport-tier verification.
5. **Rate limiting** — free accounts are capped at 20 votes/day (spam control, not monetization).
6. **Immutable audit trail.** Every vote's tx hash is recorded; the on-chain record cannot be retroactively edited by anyone, including us.
7. **Webhook signature verification everywhere** (Didit, Veriff, Stripe, Apple receipt validation server-side) — no trust path can be forged from outside.

### The honest answer to "could YOU fake votes?" — know this cold
A technical investor may push to this question, and the honest answer wins the room:

> "Today, with custodial keys, the operator could theoretically sign votes on behalf of users — the same trust assumption as any web2 platform, including every petition site and poll that exists. The difference is that **we leave a permanent, public, tamper-evident trail**. Fake votes would have to be written to a public blockchain where vote velocity, wallet funding patterns, and token flows are visible to any auditor forever. Web2 fraud is invisible; fraud on our system is recorded in public. Our roadmap takes trust out of the operator's hands step by step: third-party attestation of the verification pipeline, open-source vote auditing tools, and optional self-custody so users sign votes on-device."

This framing — *"we're not trustless yet, we're auditable now, and here's the path"* — is more credible than overclaiming, and technical investors will respect it.

---

## 6. Platform Security Inventory

| Layer | What's implemented |
|---|---|
| **Authentication** | JWT (7-day expiry) signed with server secret; bcrypt password hashing; Postgres-backed sessions for web |
| **Password reset** | Crypto-secure 32-byte tokens, stored as SHA-256 hashes (a DB leak leaks nothing usable), 1-hour expiry, single-use, no email enumeration (identical response whether the account exists or not) |
| **Wallet keys** | AES-256-GCM at rest, key in env secrets, rotation tooling built |
| **Webhooks** | HMAC-SHA256 verification with constant-time comparison on Didit and Veriff; timestamp anti-replay |
| **Payments** | Apple receipts validated server-side against Apple with shared secret (client claims are never trusted); Stripe for org billing |
| **KYC WebView** | Domain whitelist — only HTTPS didit.me/veriff.com can load in the verification flow |
| **Content/UGC** | Moderation pipeline on all user content (proposals, comments): blocklist filter at creation, user reporting, auto-hide at 3 reports, admin email alerts, user muting/blocking — Apple-compliance grade |
| **Demo/test data** | Demo account is fully sandboxed — App Review and testers can never write to production tallies |
| **Transport** | HTTPS everywhere; no plaintext secrets in the repo (env-based config) |

---

## 7. Business-Model Mechanics (in case the conversation drifts there)

- **Voting: free.** 20/day cap is spam control. Participation is never paywalled — that's a legitimacy position, not a generosity one.
- **Verification: free to users.** We eat ~$0.15–0.35/check as acquisition cost.
- **Premium subscription** (Apple IAP + Stripe): unlimited voting, Sentinel (AI civic-monitoring feature), creation power.
- **Organizations (B2B)**: orgs pay for member verification unlocking + org-scoped proposal/voting tools. Best-margin lane; effectively subsidizes consumer verification.
- **Referral system** (built in backend, UI shipping next): rewards only trigger on *verified* referees — fraud-resistant by design since each referral requires a unique government ID.

---

## 8. Likely Tough Questions — Prep Sheet

**"What happens if your database is breached?"**
Document images aren't in it (they stay with Didit). Passwords are bcrypt-hashed. Reset tokens are SHA-256-hashed. Wallet keys are AES-256-GCM encrypted with a key that lives outside the DB. The on-chain vote record is unaffected by anything that happens to our database — that's the point of it.

**"Why custodial wallets? Isn't that against the point of crypto?"**
Our user is a citizen, not a crypto user. Custody removes seed phrases and gas — the two things that kill mainstream adoption. We keep the auditability benefits (public, immutable, per-user-address vote trail) and discard the UX costs. Self-custody export is on the roadmap for users who want it.

**"What stops one person from verifying twice?"**
Didit performs document deduplication and liveness checks. One passport = one identity. The economics also work for us: each fraud attempt costs the attacker a real government document and us at most 35 cents.

**"Are you on mainnet?"**
Honest answer: the contract infrastructure runs on Base Sepolia (testnet) today; mainnet is an environment configuration change, not a re-architecture. Flipping it is gated on volume justifying mainnet gas spend, which is the right sequencing for a pre-scale product. *(Note to self: the relay transaction currently pins Sepolia's chain ID in code — a one-line change for mainnet, but know that it exists.)*

**"Could a state actor or motivated group manipulate a referendum on your platform?"**
They'd need real identity documents at scale (KYC + liveness per account), the votes would be geo-bound to document-verified residents, and the on-chain trail would expose anomalous patterns (timing, funding, velocity) to forensic analysis permanently. We'd never claim impossibility — we claim a radically higher cost of attack than any petition, poll, or social-media signal that currently stands in for public opinion, plus permanent evidence.

**"What's defensible here? Anyone can build an app with KYC."**
The moat is the verified-citizen graph. Every verified user is ~35 cents and a passport check that competitors must also pay per-user — but network effects mean the *N+1th* civic vote happens where the other N voters already are. Plus: App Store approval for a voting+IAP+UGC+KYC app is itself a months-long moat (we have it), and the B2B org layer creates revenue and lock-in independent of consumer scale.

**"Why blockchain at all? This could be a Postgres app."**
Because our entire product *is* trust. A Postgres tally is "trust me." An on-chain tally is "check yourself." For petition-grade opinions that distinction is cosmetic; for referendum-grade decisions it's existential. We're building for the day a government or major institution asks "prove these results" — and the answer is a block explorer link, not a deposition.

---

## 9. Glossary (study these terms)

- **Base / L2:** An Ethereum "Layer-2" — a faster, cheaper blockchain that inherits security from Ethereum by posting its data back to it. Base is Coinbase's L2.
- **Custodial wallet:** We generate and hold the user's keys (like a bank holding your account) vs. self-custody (user holds keys).
- **ERC-20:** The standard for fungible tokens on Ethereum. RPV is our ERC-20 vote token.
- **Soulbound token (SBT):** An NFT that cannot be transferred — used as a credential (our verified-identity passport).
- **Relay pattern / gas sponsorship:** User signs the transaction, server pays the fee and broadcasts it. User gets on-chain agency without owning ETH.
- **Deterministic address:** An address computed from known inputs (e.g. hash of proposal+position), so anyone can recompute it and audit transfers into it.
- **HMAC:** A cryptographic signature on webhook payloads proving they came from the real sender and weren't altered.
- **AES-256-GCM:** Industry-standard authenticated encryption — used for wallet keys at rest.
- **EIP-712:** Typed, human-readable structured signing standard — used in our passport NFT minting.
- **Liveness check:** KYC step proving a live human is present (not a photo of a photo).

---

*Prepared from the live codebase: `base-network.ts` (chain layer), `crypto.ts` (key encryption), `routes.ts` (vote pipeline + webhook verification), `replitAuth.ts` (auth), `schema.ts` (data model). Every claim in sections 2–6 is implemented and deployed unless marked roadmap.*
