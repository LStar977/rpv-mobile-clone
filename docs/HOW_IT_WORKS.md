# Represent Vote — How It Works

A complete description of what Represent Vote does, how every feature works under the hood, and how the whole system fits together.

**Last updated:** June 2026
**Status:** Live on the App Store (v1.0)
**Bundle ID:** `com.representwallet.app`
**App Store ID:** `6756912022`
**Operator:** 2747902 Alberta Ltd. (DBA Represent Labs / Represent Vote)
**Domains:** representvote.com (marketing), representportal.com (backend + legal pages)

---

## Table of Contents

1. [What Represent Vote Is](#1-what-represent-vote-is)
2. [Who It's For](#2-who-its-for)
3. [The Core User Journey](#3-the-core-user-journey)
4. [Identity Verification](#4-identity-verification)
5. [Proposals and Voting](#5-proposals-and-voting)
6. [Geographic Eligibility](#6-geographic-eligibility)
7. [Citizens-Only Proposals](#7-citizens-only-proposals)
8. [Vote Types: Yes/No, Multiple-Choice, Ranked-Choice](#8-vote-types-yesno-multiple-choice-ranked-choice)
9. [Organizations](#9-organizations)
10. [Sentinel AI](#10-sentinel-ai)
11. [Subscriptions, Pricing, and Payments](#11-subscriptions-pricing-and-payments)
12. [Content Moderation](#12-content-moderation)
13. [The Blockchain Layer](#13-the-blockchain-layer)
14. [Audit Log and Tamper Evidence](#14-audit-log-and-tamper-evidence)
15. [Privacy, Data, and Retention](#15-privacy-data-and-retention)
16. [Account Management](#16-account-management)
17. [Notifications](#17-notifications)
18. [Tech Stack](#18-tech-stack)
19. [System Architecture](#19-system-architecture)
20. [Operational Reference](#20-operational-reference)
21. [Glossary](#21-glossary)

---

## 1. What Represent Vote Is

Represent Vote is an **identity-verified civic voting platform** that lets verified citizens vote on the issues that shape their community — federal, provincial, and municipal — between elections.

### The product in one sentence

It's an iOS app where verified Canadians can swipe through proposals (yes/no, multiple-choice, or ranked-choice ballots), cast tamper-evident votes attached to their real identity, and watch live results emerge — all without anyone seeing their name attached to their position.

### The wedge

Petitions can be faked. Polls can be brigaded. Comment sections are bots. There has never been a way for ordinary people to register a **verified position** on a public issue that:

- Is provably one-person-one-vote
- Is anonymous from other voters but tied to a real identity behind the scenes
- Geographically scopes who can vote on what
- Lives on a tamper-evident record
- Can serve as input to governments, organizations, and policy makers

Represent Vote does this. Identity is verified via KYC at sign-up; votes are cast under a pseudonymous wallet identity; results are independently verifiable on the Base blockchain.

### The Alberta launch hook

The product is launching in Alberta during the political moment around the separation referendum debate. The wedge is: *Albertans who want their voice on Alberta's future heard NOW — verified, before the formal vote.* Citizens-only proposals (passport-required) give the platform a way to host the referendum question itself with verified residency + citizenship attestation.

---

## 2. Who It's For

**Primary (consumer):**
- Verified Canadian adults aged 17+ who want a meaningful voice in civic decisions between elections
- Concentrated initial focus: Albertans during the separation referendum moment
- Secondary: any Canadian curious about civic engagement, ranked-choice voting, or political accountability

**Secondary (B2B / organizations):**
- Unions running ratification or leadership votes
- HOAs and condo boards
- School districts, faculty senates, student governments
- Nonprofits and community organizations
- Municipal governments piloting verified citizen engagement
- Enterprises wanting verified internal decision-making

**Tertiary:**
- Political parties wanting to gauge member sentiment
- Journalists and researchers using the open audit log
- Government agencies considering procurement of civic-engagement infrastructure

---

## 3. The Core User Journey

### Step-by-step from install to first vote

1. **Install** the app from the App Store (search "Represent Vote")
2. **Sign up** with email + password, Sign in with Apple, or Sign in with Google
3. **Onboarding** — three quick slides explaining the product
4. **Optional: Verify** identity (driver's license or passport) via Didit
   - Without verification: vote on global proposals only
   - With Standard verification: vote on geo-restricted proposals in your country, province, and city
   - With Citizen verification: also vote on citizens-only proposals
5. **Home screen** shows pending civic proposals in your region + featured proposal
6. **Vote tab** — swipe through proposals (left = oppose, right = support, up = skip)
   - Or tap a proposal to see full details, ranked-choice ballot, or multiple-choice ballot
7. **See results** in real time as the vote tally updates
8. **Profile** tracks your civic record — votes cast, badges, analytics

### What unverified users can do

- Vote on global proposals (no geographic restrictions)
- Create up to 1 proposal per month
- Browse the full feed (read-only on geo-restricted proposals)

### What verified users can do

- Vote on every proposal they're geographically eligible for
- Create up to 3 proposals per month
- See "Your Communities" — the federal/provincial/municipal feeds tied to their region
- Verified badge on their profile

### What Premium users can do

- Unlimited proposal creation
- Sentinel AI document analyzer
- Advanced analytics on their proposals (demographic + geographic breakdowns)
- Custom proposal alerts
- Voting history export
- Patron badge

### What Citizen-verified users can do

- Everything above
- Vote on citizens-only proposals (passport + proof of address required)
- The Alberta separation referendum is a citizens-only proposal

---

## 4. Identity Verification

### Why we verify

Every vote on Represent comes from a real, unique adult. This is the entire foundation of the platform's credibility. Without verification, the platform is a petition site. With it, it's audit-grade civic infrastructure.

### Who provides verification

**Didit** (didit.me) — a privacy-focused KYC provider. Two workflows are configured:

**Standard workflow** (workflow ID `7f8fd8cf-…`):
- Accepts driver's license, government ID, or passport
- Extracts: name, document type, date of birth, country, state/province, city (when present)
- Approximate cost: **~$0.15 per check**
- Decision time: 30 seconds to 2 minutes
- Sets `users.verified = true`

**Citizen workflow** (workflow ID `465472da-…`):
- Requires passport + proof of address document (utility bill, bank statement, lease)
- Stronger pass than Standard — proves citizenship via passport AND residence via proof of address
- Approximate cost: **~$0.20-$0.35 per check**
- Sets `users.verified = true` AND `users.citizenship_verified = true`

### How the flow works on the device

1. User taps **Verify** anywhere in the app
2. App routes to a picker screen showing both verification options with their tradeoffs
3. User picks Standard or Citizen
4. App requests a session URL from the backend (`POST /api/didit/create-session` with the chosen workflow)
5. Backend calls Didit's API to create a session, gets back a hosted URL
6. App opens that URL in a WebView (full-screen modal)
7. Didit walks the user through: ID photo capture → liveness selfie → (Citizen flow only: proof of address upload)
8. On completion, Didit redirects the WebView to `representportal.com/verification-complete` — a friendly success page
9. The app's WebView nav handler intercepts that URL and closes the modal back to the app
10. App calls `kycApi.checkDecision(sessionId)` to force-pull the result, then calls `checkAuth()` to refresh the user state
11. By the time the user lands back on Profile, the verified badge is showing

### Server-side webhook

In parallel with the user flow, Didit POSTs a server-to-server webhook to `representportal.com/api/didit/webhook` containing the decision. The webhook handler:

- Verifies Didit's signature
- Parses the decision payload (probing many field paths because Didit's structure varies by document type)
- Normalizes country codes (CAN → Canada, etc.)
- Sets `users.verified = true`, populates country/state/city
- If the workflow was the Citizen workflow (matched by `workflow_id`), also sets `users.citizenship_verified = true`

### Data retention

Didit retains verification documents (passport photos, selfies, proof of address) for **30 days** by default, then permanently deletes them. The verification *decision* (verified yes/no, country/state/city) is retained by Represent for the lifetime of the account, then anonymized on account deletion.

### Re-verification

A user who needs to update their region (moved provinces, etc.) can re-run verification. The webhook overwrites the geographic fields each time. Standard verification has an "already verified" guard, but Citizen verification can be initiated even by a standard-verified user — they're independent flags.

---

## 5. Proposals and Voting

### What a proposal looks like

A proposal has:
- **Title** (≤100 chars)
- **Description** (≤1000 chars)
- **Category** (Economy, Housing, Transportation, Environment, Healthcare, Other, etc.)
- **Vote type**: yes/no, multiple-choice, or ranked-choice
- **Geographic restrictions** (zero or more levels: country, province, city)
- **Citizen requirement** (boolean flag)
- **Optional image** (uploaded to object storage)
- **Optional deadline** (after which voting closes)
- **Creator** (user who posted it)
- **Organization** (if posted inside an org, otherwise null = public)

### How a vote is cast

1. User taps a proposal
2. App displays the appropriate ballot (yes/no swipe, multi-choice picker, or ranked-choice list)
3. User makes their selection
4. App calls `POST /api/voting/submit` with `{ proposalId, position, selectedOption?, rankings? }`
5. Backend validates: user is authenticated, hasn't already voted, deadline hasn't passed, geo eligibility, citizenship if required, org membership if org-scoped
6. Backend records the vote in the `votes` table with a unique constraint on `(userId, proposalId)`
7. For yes/no votes, backend triggers an on-chain token transfer (Base network) — the user's smart wallet sends 1 vote-token to a deterministic per-position address
8. The vote-token's transaction hash is stored on the vote row
9. Live results update for everyone viewing the proposal

### Vote enforcement (what can block a vote)

The vote-submit endpoint checks, in order:
- Authentication
- Proposal exists
- Deadline not passed
- For citizen-required proposals: `users.citizenship_verified = true` (else `CITIZENSHIP_REQUIRED` 403)
- For org-scoped proposals: membership in the organization
- For org proposals where the org requires member verification: `users.verified = true`
- For non-org geo-restricted proposals: user's region matches the proposal's geo restrictions

Each block returns a specific error code that the mobile app maps to a friendly alert and a route to fix it (e.g., "Verify citizenship" button routes to the Citizen verification flow).

### Results

Stored as denormalized counters on the proposal row (`support_votes`, `oppose_votes`) for yes/no, and computed on read from the `votes` table for multiple-choice (per-option counts) and ranked-choice (full IRV tally via `backend/server/rcvTally.ts`). The `/api/proposals/:id/results` endpoint returns a typed result based on the proposal's vote type.

---

## 6. Geographic Eligibility

### How geo restrictions work

Every proposal has a `geo_restrictions` array stored as JSONB. The convention:

| `geo_restrictions` | Tier | Example | Who can vote |
|---|---|---|---|
| `[]` | Global | "Should the UN reform veto powers?" | Any verified or unverified user |
| `['Canada']` | Federal | "Adopt baseline national digital ID standard" | Anyone verified with country=Canada |
| `['Canada', 'Alberta']` | Provincial | "Mandate carbon-pricing rebate" | Anyone verified with state=Alberta |
| `['Canada', 'Alberta', 'Calgary']` | Municipal | "Approve new arena spending" | Anyone verified with city=Calgary |

### How eligibility is determined

User's region is set at verification (from their ID document). The voting endpoint checks that `[userCountry, userState, userCity]` matches the `geo_restrictions` array level-by-level.

A passport-only verification populates **country only** — that user can vote on global + federal proposals but not provincial/municipal (no address on a passport). To unlock provincial/municipal voting, the user re-verifies with a driver's license (which has an address) or runs the Citizen workflow (passport + proof of address).

### "Your Communities" on the home screen

The dashboard shows the federal / provincial / municipal feeds for the user's region. Rows for tiers the user can't access (e.g., province/city for a passport-only verified user) are hidden, so the card renders cleanly with just the tiers the user is eligible for.

---

## 7. Citizens-Only Proposals

### Why this exists

Some questions are appropriate only for citizens (referenda, constitutional questions, decisions tied to citizenship). Represent has a separate, stronger verification flag — `citizenship_verified` — driven by the Didit Citizen workflow (passport + proof of address).

### How citizens-only works

- A proposal creator can flag their proposal as `requires_citizenship = true` at creation
- The proposal displays a "CITIZENS ONLY" badge on the card
- Voting on it requires `users.citizenship_verified = true`
- Non-citizen-verified users tapping vote get an alert: "This proposal is open to verified citizens" → routes to Citizen verification

### The Alberta separation referendum

The first canonical use case. A citizens-only proposal with `geo_restrictions = ['Canada', 'Alberta']` lets verified-citizen Albertans vote on the separation question. Their vote is identity-verified, citizenship-verified, address-verified, and recorded with cryptographic proof — closer to a "real" referendum vote than any petition or poll.

---

## 8. Vote Types: Yes/No, Multiple-Choice, Ranked-Choice

### Yes/No

Default vote type. Voter swipes left (oppose) or right (support) on the swipe card, or taps support/oppose on the list view. Result is two counters. Yes/no votes trigger on-chain token transfers.

### Multiple-Choice

Creator defines 2+ option strings at proposal creation. Voter picks one. Result is a count per option. No on-chain transfer (off-chain only, since multi-option semantics don't map cleanly to vote-token addresses).

### Ranked-Choice (IRV)

Creator defines 2+ option strings. Voter ranks them in order of preference (can rank fewer than all options for a partial ballot). Backend runs **Instant-Runoff Voting** on read: the option with the fewest first-choice votes is eliminated, those ballots transfer to their second choice, repeat until one option has a majority. Tie-breaking is alphabetical-last (deterministic and disclosed in the proposal info).

The `/api/proposals/:id/results` endpoint returns the full round-by-round walkthrough — voters and analysts can see exactly how the winner emerged. Reference implementation in `backend/server/rcvTally.ts`.

### Why offer all three

Yes/No is for binary referenda. Multi-choice is for picking among options (which budget priority, which name for the park). Ranked-choice is for elections (union leadership, party leadership) and contested decisions where the Condorcet winner matters. Most civic platforms only offer yes/no; offering all three is a meaningful market differentiator.

---

## 9. Organizations

### What an organization is

A scoped group of verified members who can vote on internal proposals (ratifications, board elections, bylaw changes, leadership choices, policy positions). Examples:

- **Unions** voting on contract ratification or executive elections
- **HOAs** voting on bylaw changes or board members
- **Schools** running student council elections or PTA decisions
- **Nonprofits** voting on strategic direction or board composition
- **Municipalities** running internal advisory polls
- **Enterprises** taking the pulse of teams on culture or process changes

### How organizations work

1. **Create** — any user can create an organization (free tier, 25-member cap)
2. **Branding** — set logo, primary color, custom domain (Business tier+)
3. **Membership** — invite via:
   - Invite codes (free, shareable string)
   - Email domain (auto-membership for anyone with `@yourdomain.com`)
   - CSV import (Pro tier+, batch invite via Resend email)
   - OAuth/SSO (Plus tier+, configurable via MyAUPE, OPSEU, Google Workspace, etc.)
4. **Proposals** — admins create proposals scoped to the org. Members vote.
5. **Sub-organizations** — Plus tier+, hierarchical orgs (district → school → class)
6. **Audit log** — Plus tier+, HMAC-signed CSV/JSON export of all votes with optional voter identity

### Tier ladder

| Tier | Price/mo | Member cap | Notable features |
|---|---|---|---|
| Free | $0 | 25 | Basic proposals, invite codes |
| Pro | $59 | 250 | CSV import, advanced analytics, API access |
| Plus | $179 | 1,000 | Sub-orgs, OAuth/SSO, audit log export |
| Business | $499 | 5,000 | White-label, custom domain, dedicated onboarding |
| Government | Custom annual | Unlimited | SOC 2, custom DPA, integrations |

Existing customers from the pre-Stage-3 pricing are grandfathered to a `legacy` tier (uncapped).

### Mandatory member verification

Organizations can require all members to be identity-verified before voting. The org pays a **one-time unlock fee** to enable this feature for their org:

- Pro: $199.99 (one-time)
- Plus: $499.99 (one-time)
- Business: $999.99 (one-time)

After the unlock, members verify via Didit at no cost to the member (the platform absorbs Didit's per-check cost). The unlock is server-validated against the organization ID — it persists across tier changes and re-enables, but invalidates on refund.

### Organization billing

Same payment rails as personal subscriptions:
- **iOS**: Apple In-App Purchase
- **Web/Android**: Stripe

Admins manage the org subscription on the org-detail screen (existing) or the dedicated billing screen (Plan upgrades, downgrades, cancellations).

---

## 10. Sentinel AI

### What it is

Sentinel is an AI-powered policy/governance document analyzer accessible to Premium users. It takes a piece of policy or governance text (a bylaw, a contract clause, a city ordinance, a proposed law) and analyzes it against a configurable library of governance principles — flagging concerns, summarizing implications, and highlighting clauses that warrant attention.

### How it works

1. User opens the Sentinel tab
2. User sees a consent screen explaining that the document will be sent to OpenAI for analysis (required by Apple Guideline 5.1.1(i) for third-party AI services)
3. User pastes or types policy text into the input
4. App calls `POST /api/sentinel/analyze` with the text and the user's selected principle set
5. Backend constructs a prompt with the principle library, calls OpenAI's API
6. OpenAI returns structured analysis (concerns, summaries, severity ratings)
7. App renders the results as cards, color-coded by severity
8. User can save the analysis or share it

### Why it's a real differentiator

Most civic apps don't have AI features. The ones that do treat AI as a chatbot. Sentinel is purpose-built: a curated principle library + a specific prompt scaffolding designed for governance text. It's the most defensible single component of the product.

### Cost control

Sentinel calls are rate-limited per user per day to prevent abuse and cost runaway. The limit is high enough that legitimate Premium users never hit it but low enough that an abusive script can't drain OpenAI credit.

### Future direction

Sentinel has B2B potential as a standalone product for governance/compliance teams (UPDATE 28 in the strategy doc). For now it's a Premium feature inside the consumer app.

---

## 11. Subscriptions, Pricing, and Payments

### Consumer pricing

| Plan | Price | Includes |
|---|---|---|
| Free | $0 | Unlimited voting on global proposals, 1 proposal/month |
| Verified | $0 (free + KYC) | Geo-restricted voting, 3 proposals/month, verified badge |
| Premium | $7.99/month | Unlimited proposals, Sentinel AI, advanced analytics, custom alerts, voting history export, patron badge |

### Organization pricing

See [Organizations](#9-organizations) section above.

### Payment rails

| Platform | Subscription billing | One-time consumables |
|---|---|---|
| iOS | Apple In-App Purchase (StoreKit) | Apple IAP |
| Android | Stripe (planned: Google Play Billing) | Stripe |
| Web | Stripe | Stripe |

All iOS payments go through Apple per Guideline 3.1.1. The app contains zero links to off-app payment methods on iOS.

### IAP product IDs

**Auto-renewable subscriptions:**
- `com.representwallet.app.premium` ($7.99/mo)
- `com.representwallet.app.org.professional` ($59/mo Pro)
- `com.representwallet.app.org.premium` ($179/mo Plus)
- `com.representwallet.app.org.enterprise` ($500/mo Business)

**Consumables (verification unlock fees, one-time per organization):**
- `verification_unlock_pro` ($199.99)
- `verification_unlock_plus` ($499.99)
- `verification_unlock_business` ($999.99)

### Receipt validation

After the device completes an IAP, the receipt is posted to `POST /api/iap/validate-receipt`. The backend:

1. Sends the receipt to Apple's `verifyReceipt` endpoint with the App-Specific Shared Secret
2. Handles the 21007 sandbox fallback (sandbox receipts hit prod URL → backend retries against sandbox URL)
3. Parses the validated receipt to extract product ID, transaction ID, and expiration
4. Marks the user (or organization) as having the appropriate entitlement
5. Stores `iap_original_transaction_id` for future webhook correlation

### Server-to-server notifications

Apple sends App Store Server Notifications V2 to `POST /api/iap/notifications` for renewals, cancellations, refunds, and revocations. The backend handler (`iapWebhookHandlers.ts`):

- Verifies the JWS signature
- Decodes the notification type and signed transaction info
- Updates the user/organization's subscription state accordingly
- For REFUND/REVOKE on consumable unlock SKUs: clears the org's verification unlock

---

## 12. Content Moderation

### What's moderated

Every proposal title, description, and image is user-generated content. To comply with Apple Guideline 1.2 (UGC moderation), the platform has:

1. **Pre-publication profanity filter** — blocks proposal creation if title or description contains words from a configurable blocklist (returns `CONTENT_REJECTED` 400)
2. **Report flow** — every proposal card has a 3-dot menu with "Report this proposal" → reason picker → confirmation
3. **Mute creator** — every proposal card has "Mute this user" → hides all their proposals from the muting user's feed
4. **Auto-hide threshold** — when a proposal accumulates N reports, it auto-hides from the public feed pending admin review
5. **24-hour response commitment** — disclosed in the ToS

### How a report flows

1. User taps Report on a proposal card
2. Reason picker (Spam / Hate speech / Threat / Sexual content / Illegal / Other) + optional note (≤500 chars)
3. App calls `POST /api/proposals/:id/report`
4. Backend creates a row in `proposal_reports`, increments `proposals.report_count`, sends admin email
5. If `report_count >= threshold` (default 3), backend sets `proposals.hidden_at = now()` and the proposal disappears from the feed query
6. User gets a confirmation toast: "Report submitted"

### Mute mechanics

Mutes are stored server-side (`user_mutes` table) and synced to the device. The feed query filters out proposals from muted creators. Mutes survive reinstall and follow the user across devices.

### Contact support

Every screen has a path to support: Profile → Legal → Contact Support, which opens the mail composer addressed to `support@representvote.com`.

---

## 13. The Blockchain Layer

### What's on-chain

For yes/no votes, the user's smart wallet sends a vote-token transfer to a deterministic per-position address (one address per proposal per support/oppose). The transaction is recorded on the **Base** blockchain (a low-cost Ethereum L2).

### Why on-chain

The blockchain is the audit infrastructure, not a financial instrument. Three benefits:

1. **Tamper-evident** — once a vote transfer is on-chain, it can't be deleted or altered
2. **Independently verifiable** — anyone can check the on-chain tally against the proposal page's displayed tally
3. **Public proof of participation** — verified citizens can prove they voted without revealing which way

### What's NOT on-chain

- User identity / KYC data
- Personal information of any kind
- Multi-choice and ranked-choice votes (these are off-chain)
- Org-scoped votes (off-chain, with HMAC audit log instead)
- Payments (handled through Apple/Stripe, not crypto)

### Smart wallets

Every user gets a Base smart wallet at sign-up (non-custodial in design; private key derivation managed by the platform for usability). The wallet address is the user's pseudonymous on-chain identity — no name, no email, no document data tied to it.

### Vote tokens (RPV)

A custom token used solely for vote attribution. Tokens are granted in bulk to verified users (1,000 tokens on verification). One token = one vote on a yes/no proposal. The token has no monetary value, no exchange listing, no speculative dimension — it's a counting mechanism.

### Why this isn't "Web3 hype"

The blockchain is invisible to the user. They never see "crypto," "tokens," "wallets," or any Web3 jargon in the app UI. The blockchain runs underneath as cryptographic infrastructure. The closest analogy is HTTPS — users don't see "TLS handshake" but they benefit from it.

---

## 14. Audit Log and Tamper Evidence

### What it is

A cryptographically-signed export of all votes in an organization. Available to organization admins on Plus tier and above. Generated as CSV or JSON. Each row is HMAC-signed; the whole bundle is signed too.

### What's in it

- Voter ID (hashed by default; full identity available with `include_voter_identity=true` for legal compliance)
- Voter email + name (only if `include_voter_identity=true`)
- Proposal ID, title, created-at, deadline
- Vote position (support / oppose / option chosen / ranking JSON)
- Vote-token ID
- On-chain transaction hash (for yes/no votes)
- Cast timestamp
- Per-row HMAC signature

### How to verify a bundle

Recompute the HMAC of each row using the canonical string and Represent's signing secret. If all rows verify and the bundle signature matches, the export is genuine and unmodified. This is the auditable trail unions, election commissions, and legal teams need.

### Defensibility

This is the single most defensible feature of the platform. Competitors don't have it. It's the reason a union running a $2M contract ratification vote should pick Represent over a $0.99-per-voter alternative.

---

## 15. Privacy, Data, and Retention

### What we collect

- Account info: email, name, password hash, OAuth tokens
- Identity verification: name, government ID image, selfie, proof of address (for Citizen), document type, country, state, city, date of birth, gender
- User-generated content: proposals, votes, comments
- Payment info: Apple IAP receipts, Stripe payment tokens
- Diagnostic data: crash logs, performance metrics, error traces
- Device info: model, OS version, language, time zone

### What we do NOT collect

- Cross-app tracking identifiers (no IDFA, no third-party analytics SDKs)
- Behavioral profiles for advertising
- Browsing history outside the app

### Retention

| Data | How long |
|---|---|
| Active account | While the account exists |
| Verification documents at Didit | **30 days**, then permanently deleted |
| Verification decision (verified yes/no, country/state/city) | Lifetime of account |
| Voting records | 7 years (for audit and dispute resolution) |
| Payment records | 7 years (for tax compliance) |
| Crash logs | 90 days |
| Soft-deleted accounts | PII anonymized immediately; verification artifacts per Didit's 30-day policy |

### Where data is stored

- Account + voting + organization data: **Neon** (Postgres, US-East)
- Verification artifacts (temporarily): **Didit** (EU)
- Payment processing: **Apple** (US) / **Stripe** (US)
- File uploads (proposal images): object storage on **Replit**
- Diagnostic data: **Sentry** (US)
- Email delivery: **Resend** (US)
- Blockchain transactions: **Base** (public L2, global)

### User rights (PIPEDA / GDPR / CCPA)

- **Access**: request a copy of all personal data via `privacy@representvote.com`
- **Correction**: edit profile fields in the app or email privacy@
- **Deletion**: Profile → Settings & Privacy → Delete Account (PII anonymized immediately)
- **Portability**: export voting history via the Premium feature
- **Withdraw consent**: disable push notifications in device settings; toggle off Sentinel consent to stop AI analysis

---

## 16. Account Management

### Sign-up methods

- Email + password
- Sign in with Apple (required because Google login exists, per Apple Guideline 4.8)
- Sign in with Google

### One person, one account

Identity verification enforces this server-side. Multiple accounts under the same verified identity are blocked.

### Account deletion

Profile → Settings & Privacy → Delete Account. Two-step confirmation; deletion is immediate and permanent. On deletion:

- PII fields (name, email, profile image) are anonymized in Neon
- Verification artifacts at Didit follow the 30-day retention (or sooner if Didit's deletion API is wired)
- Voting records are retained but no longer linked to the deleted user's identifier
- The user's smart wallet remains on Base (immutable) but is no longer associated with any name

### Logout

Profile → Sign Out. Clears the auth token from SecureStore + clears device-local caches (org votes, demo data) so the next account on the same device doesn't inherit stale state.

### Demo account

`demo@represent.app` / `RepresentDemo2024!` — accessed by tapping the app logo 5 times on the sign-in screen. Auto-verified, auto-citizenship-verified, auto-Premium, with pre-seeded data. Used exclusively for App Store reviewers and demos. All purchases on the demo account are bypassed (no real charges).

---

## 17. Notifications

### Push notifications

Opt-in at first launch (iOS prompt). Granular categories:

- New proposals in your region
- Voting deadlines (24-hour and 1-hour warnings)
- Organization activity (proposals from your orgs, role changes)
- Results announcements (when proposals you voted on close)
- Sentinel alerts (Premium-only, configured topic alerts)

### Transactional email

Sent via **Resend** to `support@representvote.com`-style addresses. Includes:

- Verification confirmations
- Receipt emails
- Organization invite emails
- Account deletion confirmations
- Password reset (for email-auth users)

---

## 18. Tech Stack

### Mobile

- **React Native** 0.74.5 with **Expo SDK 51** (bare workflow — `ios/` and `android/` directories committed)
- **Expo Router** for file-based routing
- **Reanimated v3** for animations
- **react-native-svg** for vector graphics
- **react-native-iap** v12 for Apple/Google billing
- **@stripe/stripe-react-native** v0.38 for non-iOS payments
- **expo-apple-authentication** for Sign in with Apple
- **@react-native-google-signin** for Sign in with Google
- **expo-secure-store** for auth tokens
- **AsyncStorage** for device-local caches
- **WebView** for the Didit verification flow
- **Zustand** for state management

### Backend

- **Node.js** + **Express** on **Replit** (production deployment)
- **Drizzle ORM** with **PostgreSQL** on **Neon**
- **OpenAI** API for Sentinel
- **Stripe** API + webhooks for non-iOS payments
- **Apple StoreKit** + **App Store Server API** for iOS billing
- **Didit** API + webhooks for KYC
- **Resend** API for transactional email
- **Base** + Ethers.js for on-chain operations
- **Sentry** for error tracking

### Marketing site

- Single-page static HTML/CSS/JS at `representvote.com`
- Hosted on Cloudflare Pages (or equivalent)

---

## 19. System Architecture

### High-level flow

```
                    ┌─────────────────────┐
                    │  iOS App (Expo)     │
                    │  - Voting UI        │
                    │  - WebView (Didit)  │
                    │  - StoreKit (IAP)   │
                    └──────────┬──────────┘
                               │ HTTPS
                               ▼
         ┌──────────────────────────────────────┐
         │  Backend (Express on Replit)         │
         │  representportal.com                 │
         │  - /api/voting/submit                │
         │  - /api/didit/*                      │
         │  - /api/iap/validate-receipt         │
         │  - /api/iap/notifications            │
         │  - /api/proposals/*                  │
         │  - /api/organizations/*              │
         │  - /api/sentinel/*                   │
         │  - /api/auth/verify                  │
         │  - /api/stripe/*                     │
         │  - /verification-complete (HTML)     │
         └────┬───────┬──────┬───────┬──────────┘
              │       │      │       │
              ▼       ▼      ▼       ▼
        ┌────────┐ ┌──────┐ ┌──────┐ ┌────────┐
        │ Neon   │ │Didit │ │Apple │ │ Stripe │
        │ (DB)   │ │(KYC) │ │(IAP) │ │ (web)  │
        └────────┘ └──────┘ └──────┘ └────────┘
              │
              ▼
        ┌──────────┐    ┌────────┐
        │  Base    │    │OpenAI  │
        │(votes)   │    │(Sentinel)│
        └──────────┘    └────────┘
```

### Auth flow

1. User signs up → backend creates user row, issues a JWT
2. JWT stored in SecureStore on device
3. Every API request includes `Authorization: Bearer <jwt>`
4. Backend validates JWT, looks up user, processes request
5. On app launch, `checkAuth()` calls `/api/auth/verify` to refresh user state
6. Logout clears the token and local caches

### Voting flow

1. User taps Support/Oppose (or picks option / submits ranking)
2. App posts to `/api/voting/submit`
3. Backend validates eligibility (auth, deadline, geo, citizenship, org membership)
4. Backend writes vote row, increments counters (yes/no)
5. For yes/no: backend signs and broadcasts on-chain token transfer via Ethers.js
6. Response returns success → app updates local state
7. UI shows the vote-confirmation overlay
8. Backend also computes / refreshes the proposal's running tally for live results

### Subscription flow (iOS)

1. User taps Subscribe → app calls `purchaseProduct(sku)`
2. `lib/iap.ts` prefetches the product (StoreKit cache requirement) then calls `requestSubscription`
3. Apple's StoreKit sheet appears → user confirms with Face ID
4. Apple charges the user, returns the receipt
5. App posts the receipt to `/api/iap/validate-receipt`
6. Backend validates with Apple (with sandbox fallback), writes `subscription_status='active'` to the user row
7. Backend returns `{ valid: true }` → app refreshes user state
8. Profile screen shows "Premium" instead of "Free tier"

### Verification flow

1. User taps Verify → routes to verification-picker
2. User picks Standard or Citizen
3. App creates Didit session via `/api/didit/create-session`
4. App opens session URL in WebView
5. User completes Didit flow
6. Didit redirects to `/verification-complete` (or sends webhook to `/api/didit/webhook`)
7. WebView nav handler catches the redirect URL → closes modal
8. App calls `/api/didit/check-decision` to force-pull the result
9. App calls `checkAuth()` to refresh user state
10. Profile shows verified badge

---

## 20. Operational Reference

### Environment variables (backend)

Critical secrets that must be set on Replit:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `JWT_SECRET` / `SESSION_SECRET` | Token signing |
| `DIDIT_API_KEY` | KYC provider API key |
| `DIDIT_WORKFLOW_ID` | Standard workflow ID |
| `DIDIT_WORKFLOW_ID_CITIZEN` | Citizen workflow ID |
| `APPLE_SHARED_SECRET` | App-Specific Shared Secret for IAP receipt validation |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `STRIPE_PRICE_*` | Individual price IDs for each tier |
| `OPENAI_API_KEY` | Sentinel AI |
| `RESEND_API_KEY` | Email delivery |
| `RPV_TOKEN_ADDRESS` | Base smart contract for vote tokens |
| `AUDIT_SIGNING_SECRET` | HMAC for audit log signatures |
| `AUDIT_VOTER_SALT` | Voter ID hashing for audit logs |

### Database schema highlights

| Table | Purpose |
|---|---|
| `users` | Accounts, verification state, subscription status |
| `wallets` | Smart wallet addresses per user |
| `votes` | One row per vote, with unique constraint on (userId, proposalId) |
| `proposals` | Proposal metadata, vote type, options, geo, citizen flag |
| `proposal_reports` | UGC moderation reports |
| `user_mutes` | Per-user mute list |
| `organizations` | Org metadata, tier, subscription, unlock state |
| `organization_members` | Membership rows with roles |
| `organization_invites` | Pending invites from CSV import |
| `organization_invite_codes` | Shareable invite codes |
| `organization_announcements` | Org admin announcements |
| `sessions` | Express session storage |

### Key API endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/verify` | GET | Returns the current user object |
| `/api/auth/mobile/email`, `/mobile/oauth`, `/mobile/demo` | POST | Sign-in flows |
| `/api/proposals` | GET, POST | List + create proposals |
| `/api/proposals/:id/results` | GET | Get computed results for any vote type |
| `/api/voting/submit` | POST | Cast a vote |
| `/api/proposals/:id/report` | POST | Report UGC |
| `/api/users/:id/mute`, `/unmute` | POST | Mute/unmute a creator |
| `/api/didit/create-session` | POST | Start Didit verification |
| `/api/didit/webhook` | POST | Receive Didit decision |
| `/api/didit/check-decision` | GET | Force-pull Didit decision |
| `/api/iap/validate-receipt` | POST | Validate Apple IAP receipt |
| `/api/iap/notifications` | POST | Apple Server Notifications V2 |
| `/api/stripe/webhook` | POST | Stripe webhooks |
| `/api/sentinel/analyze` | POST | Sentinel AI analysis |
| `/api/organizations/*` | various | Org CRUD, members, invites, billing |
| `/verification-complete` | GET | User-facing post-Didit success page |

### Monitoring

- **Real-time:** Replit logs for errors
- **Database queries:** Run via Replit's database integration or Neon's SQL editor
- **App Store metrics:** App Store Connect → Sales and Trends (24-48h lag)
- **Crash reports:** Sentry dashboard
- **Email delivery:** Resend dashboard
- **KYC usage:** Didit dashboard

---

## 21. Glossary

- **KYC**: Know Your Customer — identity verification
- **IAP**: In-App Purchase (Apple's billing system)
- **IRV**: Instant-Runoff Voting (the ranked-choice tally method)
- **HMAC**: Hash-based Message Authentication Code (used for audit log signing)
- **JWS**: JSON Web Signature (Apple uses for Server Notifications V2)
- **PIPEDA**: Canada's federal privacy law
- **PIPA**: Alberta's provincial privacy law
- **GDPR**: EU privacy regulation
- **CCPA / CPRA**: California privacy law
- **L2**: Layer-2 blockchain (Base is an L2 on Ethereum)
- **Smart wallet**: A non-custodial wallet with a recoverable private key
- **Receipt validation**: Asking Apple to confirm an IAP receipt is genuine
- **Sandbox**: Apple's test environment for IAP (no real money)
- **Production**: Real App Store environment (real money)
- **Sub-organization**: A nested org (school under district, class under school)
- **Unlock fee**: One-time payment that activates mandatory member verification for an org
- **Citizens-only proposal**: Proposal that requires the Citizen Didit workflow (passport + proof of address)

---

## Appendix: For New Contributors

If you're new to the codebase, start here:

- **Mobile entrypoint**: `app/_layout.tsx` (root layout, IAP init, auth provider)
- **Tab structure**: `app/(tabs)/_layout.tsx`
- **Voting screen**: `app/(tabs)/proposals.tsx`
- **Home dashboard**: `app/(tabs)/dashboard.tsx`
- **Profile**: `app/(tabs)/profile.tsx`
- **Verification picker**: `app/modals/verification-payment.tsx`
- **WebView host**: `app/modals/veriff.tsx`
- **IAP wrapper**: `lib/iap.ts`
- **Payment routing**: `lib/payment.ts`
- **Auth**: `lib/auth.ts`
- **API client**: `lib/api.ts`
- **Geo gate**: `lib/proposalGeo.ts`
- **Backend entrypoint**: `backend/server/routes.ts`
- **Storage**: `backend/server/storage-db.ts`
- **Schema**: `shared/schema.ts`
- **Tier limits**: `shared/tier-limits.ts`
- **Org tiers**: `lib/org-tiers.ts`
- **IRV algorithm**: `backend/server/rcvTally.ts`
- **Verification billing helpers**: `backend/server/verificationUnlock.ts`
- **Apple webhooks**: `backend/server/iapWebhookHandlers.ts`
- **Stripe webhooks**: `backend/server/webhookHandlers.ts`

---

*End of document. Maintained by the Represent Labs team. For questions: founders@representvote.com.*
