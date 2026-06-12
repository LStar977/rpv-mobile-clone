# Represent — Comprehensive Product & Technical Overview

> Audience: an incoming cofounder who needs to understand the entire product, technical stack, business model, and current state of the codebase. This document spares no detail. Read top-to-bottom on a first pass; come back to specific sections as needed.
>
> Last full revision: written after UPDATE 27 ships (App Store submission punch list). Reflects the codebase as of the `claude/continue-previous-session-ZdwLL` branch.

---

## Table of contents

1. [TL;DR — what Represent is in one paragraph](#tldr)
2. [Product positioning and target users](#positioning)
3. [Tech stack at a glance](#tech-stack)
4. [Repo layout](#repo-layout)
5. [End-to-end user flows](#user-flows)
6. [Mobile app surface — every tab and modal](#app-surface)
7. [Identity verification (Veriff + Didit)](#identity)
8. [Voting mechanics](#voting)
9. [Sentinel AI](#sentinel)
10. [Organization features (B2B)](#orgs)
11. [Pricing model](#pricing)
12. [Billing rails (Stripe + Apple IAP)](#billing)
13. [On-chain layer](#on-chain)
14. [Audit log + compliance](#audit)
15. [Moderation, reporting, safety](#moderation)
16. [Push notifications](#push)
17. [Geo restrictions and proposal scoping](#geo)
18. [Database schema reference](#schema)
19. [Backend integrations](#integrations)
20. [Mobile app architecture details](#mobile-arch)
21. [Demo account + reviewer Easter egg](#demo)
22. [Deployment, operations, environments](#ops)
23. [App Store / Play Store status](#stores)
24. [Roadmap and pivot options](#roadmap)
25. [Important files — where things live](#filemap)
26. [Glossary of terms](#glossary)
27. [Known TODOs, gotchas, footguns](#todos)

---

<a name="tldr"></a>
## 1. TL;DR

Represent is an **identity-verified civic and organizational voting platform**. End users sign up on a mobile app, complete a one-time identity check (driver's licence + selfie via Veriff or Didit), and can then vote on (a) public civic proposals scoped to their geographic location and (b) private proposals run by organizations they belong to (unions, HOAs, school boards, nonprofits, political parties, etc.). Each vote is cryptographically receipted, on-chain transactions provide a tamper-evident audit trail, and an AI feature called **Sentinel** analyzes governance documents for compliance with stated principles. The mobile app ships on iOS first via the App Store; web-side admin dashboards run on `representportal.com`. Backend is Node/Express on Replit, Postgres on Neon, Stripe + Apple IAP for billing, Veriff + Didit for KYC, OpenAI for Sentinel, Resend for transactional email, Base network for on-chain pieces.

Two revenue layers:
1. **Personal Premium** ($7.99/month) — unlocks Sentinel AI + advanced personal analytics for individual voters.
2. **Organization tiers** — Free / Pro $59 / Plus $179 / Business $499 / Government (custom annual contract). Member caps scale across the ladder; feature unlocks (CSV import, sub-orgs, white-label, audit export) gate at higher tiers. Pro-and-above can pay a one-time **verification unlock fee** ($199 / $499 / $999) to require all members to verify identity before voting.

Core differentiator: **identity-verified members + tamper-evident audit log + ranked-choice voting out of the box**. Most competitors charge per-election or lack identity verification entirely.

---

<a name="positioning"></a>
## 2. Product positioning and target users

### The two personas (today)

**Persona A — the civically-engaged voter.** Wants to weigh in on local, provincial, federal, or global policy issues without signing up for ten different government websites. Verifies once, sees a feed of proposals scoped to where they live, votes yes/no/rank, sees other people's votes aggregated.

**Persona B — the organization admin.** Runs a union local, HOA board, nonprofit, school council, professional association, or co-op. Needs to hold real votes (board elections, bylaws changes, dues changes, policy decisions). Today usually does this with paper ballots, SurveyMonkey, or a $2/election platform like ElectionBuddy. Wants member-roster management, reliable identity verification of voters, ranked-choice tally, an audit trail their lawyer will accept, and a way to communicate results.

### What Represent does for both

For Persona A, the consumer civic-voting flow: sign up, verify, vote on global + geographically-eligible proposals.

For Persona B, the org-management flow: create an org, invite members (CSV roster, magic-link emails, invite codes), optionally enable identity verification (one-time unlock fee), create proposals scoped to the org, run yes/no or multi-choice or ranked-choice votes, see analytics, export an audit log when needed.

### Adjacent personas (not yet primary, real opportunity)

- **City/county procurement officers** — Represent's "Government" tier is positioned for B2G civic engagement (Granicus / Polco competitor).
- **Corporate boards / partner committees** — the audit log + RCV stack is exactly what corporate counsel buys.
- See [§24 Roadmap and pivot options](#roadmap).

---

<a name="tech-stack"></a>
## 3. Tech stack at a glance

**Mobile**
- React Native 0.74.5 + Expo SDK 51 (bare workflow — committed `ios/` and `android/` directories, custom dev client)
- Expo Router for navigation (file-based)
- React Native Reanimated for animations
- React Native SVG for custom illustrations
- `react-native-iap` v12 for Apple StoreKit (and eventually Google Play Billing)
- `@stripe/stripe-react-native` v0.38 for Android payments (and iOS legacy paths, now disabled)
- `expo-apple-authentication` for Sign in with Apple
- `@react-native-google-signin` for Google sign-in
- `expo-secure-store` for token storage
- `expo-notifications` for push (FCM on Android, APNs on iOS)

**Backend**
- Node.js + Express on Replit (production) — files in `backend/server/`
- Drizzle ORM + PostgreSQL on Neon (serverless Postgres)
- `@apple/app-store-server-library` for IAP webhook verification
- Stripe SDK
- `ethers` for Base network on-chain calls
- OpenAI SDK for Sentinel
- Resend for transactional email
- Custom Replit auth (passport-google-oauth20, bcryptjs, express-session)

**Third-party services**
- **Veriff** — primary KYC vendor (driver's licence + selfie + liveness)
- **Didit** — secondary KYC vendor (cheaper alternative; both are wired and the verification-payment screen routes to whichever the org or user picked)
- **Stripe** — web/Android billing, primary subscription rail for orgs that signed up via web
- **Apple IAP** — iOS billing, mandatory for all digital-goods transactions on iOS
- **Resend** — transactional email (magic-link invites, moderation reports, billing receipts)
- **OpenAI** — Sentinel AI document analysis
- **Sentry** — backend error tracking with PII scrubbing
- **Base network** (Coinbase L2) — vote-token claims, smart wallet per user

**Web admin / marketing**
- `representportal.com` — admin dashboards, web subscription flow for orgs not on iOS, marketing pages, privacy policy, ToS
- Lives separately from the mobile repo (not in this codebase)

---

<a name="repo-layout"></a>
## 4. Repo layout

```
rpv-mobile-clone/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx               # Root stack
│   ├── index.tsx                 # Sign-in / Sign-up / demo unlock
│   ├── (tabs)/                   # 5 main tabs
│   │   ├── _layout.tsx           # Tab bar config (5 tabs)
│   │   ├── dashboard.tsx         # Home — Hero, Featured, ImpactRing, SentinelDigest
│   │   ├── proposals.tsx         # "Vote" tab — swipe + list of proposals
│   │   ├── sentinel.tsx          # AI governance analyzer
│   │   ├── groups.tsx            # User's organizations list
│   │   └── profile.tsx           # Profile, settings, KYC entry, sign out
│   └── modals/                   # All modals (presentation: 'modal')
│       ├── proposal-detail.tsx               # Public proposal detail + vote
│       ├── org-proposal-detail.tsx           # Org proposal detail + vote
│       ├── organization-detail.tsx           # Org settings (admin or member view)
│       ├── organization-billing.tsx          # Org billing dashboard
│       ├── create-organization.tsx           # New org wizard
│       ├── verification-payment.tsx          # User-side: start KYC
│       ├── verification-unlock-checkout.tsx  # Admin-side: pay unlock fee
│       ├── veriff.tsx                        # KYC WebView host
│       ├── subscription.tsx                  # Premium + org tier picker
│       ├── audit-export.tsx                  # Admin: HMAC audit log export
│       ├── analytics.tsx                     # Admin: org analytics
│       ├── import-roster.tsx                 # Admin: CSV member import
│       ├── voting-history.tsx                # User: their votes
│       ├── community-proposals.tsx           # Marketing surface
│       ├── my-proposals.tsx                  # User: proposals they created
│       ├── badges.tsx                        # User: civic badges
│       ├── receipt.tsx                       # Vote receipt (cryptographic)
│       ├── privacy.tsx                       # Account deletion + settings
│       ├── legal.tsx                         # ToS + Privacy + Contact Support
│       └── admin.tsx                         # Platform-admin panel (5-tap unlock)
│
├── components/                    # Shared UI components
│   ├── Onboarding.tsx            # Tutorial overlay for first-time users
│   ├── identity/PassportCard.tsx # User's identity card (passport-style)
│   ├── ui/                       # Generic UI primitives (Button, Card, etc.)
│   ├── moderation/               # ProposalModerationMenu (report/mute)
│   └── tutorial/                 # Tutorial spotlight + tooltips
│
├── lib/                          # Mobile-side modules
│   ├── api.ts                    # Backend API client (the largest single file)
│   ├── auth.ts                   # Auth store (Zustand) + token mgmt
│   ├── iap.ts                    # Apple IAP wrapper
│   ├── payment.ts                # Routes premium/org payments to IAP or Stripe
│   ├── stripe.ts                 # Stripe Payment Sheet on Android
│   ├── moderation.ts             # Mute store + sync
│   ├── proposalGeo.ts            # Geo helpers (federal/provincial/municipal/global)
│   ├── notifications.ts          # Push permission + channels
│   ├── theme.ts                  # Design tokens (colors, spacing, fonts)
│   ├── ballots.ts, rpv-token.ts  # On-chain ballot + vote-token helpers
│   └── ... (~20 modules total)
│
├── backend/server/                # Express backend (deployed to Replit)
│   ├── routes.ts                 # All HTTP endpoints (5500+ lines, the heart)
│   ├── storage-db.ts             # Drizzle DB query helpers
│   ├── webhookHandlers.ts        # Stripe webhook router
│   ├── iapWebhookHandlers.ts     # App Store Server Notifications V2
│   ├── verificationUnlock.ts     # Org unlock fee helpers (UPDATE 26)
│   ├── profanityFilter.ts        # UGC content gate (UPDATE 27)
│   ├── rcvTally.ts               # Instant-runoff tally for ranked-choice
│   ├── base-network.ts           # Base L2 chain helpers
│   ├── email.ts                  # Resend wrapper
│   ├── notifications.ts          # Server-side push fan-out
│   └── ... etc.
│
├── shared/
│   ├── schema.ts                 # Drizzle table definitions (single source of truth)
│   └── tier-limits.ts            # Authoritative tier limits + feature gates
│
├── ios/, android/                # Native projects (bare workflow)
├── app.json                      # Expo config
├── eas.json                      # EAS Build / Submit config
└── package.json
```

`docs/` exists for occasional product/business writeups; this file lives there.

---

<a name="user-flows"></a>
## 5. End-to-end user flows

This section is a step-by-step trace of what happens when a user does each major thing.

### 5.1 First-time install → home screen (consumer flow)

1. User opens app. `app/_layout.tsx` initializes IAP (`initIAP()`), sets up the Reanimated/SafeArea/Stripe providers, and routes to `app/index.tsx` (sign-in screen) if no session is cached.
2. **Sign-in screen** (`app/index.tsx`):
   - Three options: Sign in with Apple, Continue with Google, Email + Password.
   - Tapping the logo 5 times reveals the demo-account login (Easter egg for App Store reviewers — see [§21](#demo)).
   - On sign-up specifically, a ToS + Privacy checkbox is required before "Sign Up" enables. Inline links open the URLs.
3. **Backend auth** (`backend/server/replitAuth.ts`):
   - Email/password uses bcrypt for hashing.
   - Apple/Google use OAuth flows; on success, a session is established and a JWT-style token is returned.
4. **Onboarding** (`components/Onboarding.tsx`):
   - First time only (key: `@represent_onboarding_complete` in AsyncStorage).
   - Walks through home, vote tab, identity verification benefits.
   - User can choose to verify now (routes to `/modals/verification-payment` → Veriff/Didit) or later.
5. **Home tab** (`app/(tabs)/dashboard.tsx`):
   - Top bar shows display name, city, state, verification status, avatar.
   - **Hero** widget (verified user): "N proposals awaiting your voice — X global · Y federal · Z provincial · W municipal" with breakdown bar.
   - **UnverifiedHero** (unverified user): "Unlock your civic voice" CTA → tap to start KYC.
   - **Featured** card: the upcoming-deadline proposal with closest deadline, image, vote tally bar.
   - **ImpactRing** (verified): pending / voted / passed proposal counts in a radial chart.
   - **SentinelDigest** (verified): a small list of policy hot-takes from the AI.
   - "Your Organizations" section: the orgs the user belongs to, with a count of pending org proposals.

### 5.2 Identity verification (KYC) flow

1. User taps "Get Verified" or hits the unverified-user gate when trying to vote on a geo-restricted proposal.
2. Routes to `app/modals/verification-payment.tsx`. This screen has TWO modes:
   - **Self-pay (legacy)**: shown for solo users. Verification is currently free for everyone (the legacy $4.99 paywall is dead code). User taps "Start verification" → routes to `/modals/veriff`.
   - **Org-paid**: shown when navigated with an `originatingOrgId` route param (the user is verifying because their org requires it). Banner reads "Covered by [Org Name]". No payment prompt, just a Start button. The org has paid the one-time unlock fee, so member verifications are platform-absorbed — see [§7](#identity).
3. `app/modals/veriff.tsx` is a WebView shell. The mobile client calls `veriffApi.createSession()` (or `diditApi.createSession()` based on which provider the org/user was assigned), receives a `sessionUrl`, and loads it in a WebView.
4. User completes the flow on Veriff/Didit's hosted page: scans driver's licence, takes a selfie, optional liveness check.
5. Veriff/Didit sends a webhook to `representportal.com/api/veriff/webhook` (or `/api/didit/webhook`) when the decision is ready. Backend (`routes.ts`) verifies the signature and calls `storage.updateUserVerification(...)` to flip `users.verified=true` and store demographic info (DOB, gender, country, state, city, postal).
6. Mobile polls `verificationApi.checkStatus(verificationId)` until it returns approved/declined.
7. On approved: user gets the verified badge, can now vote on geo-eligible proposals, can claim their `passport NFT` on Base network (a soulbound identity NFT).

### 5.3 Voting on a public/civic proposal

1. User taps the **Vote** tab (`app/(tabs)/proposals.tsx`).
2. Tab loads from `proposalsApi.getAll()` → `GET /api/proposals`.
3. Server returns all proposals, mobile filters client-side based on user's verified geography:
   - **Global proposals** (`geoRestrictions: []`) — anyone can vote, including unverified users.
   - **Federal/Provincial/Municipal** — must be verified AND match `geoRestrictions[0/1/2]` against `users.country/state/city`.
4. Sort options: closing soonest, most votes, newest. Filter chips: All / Federal / Provincial / Municipal / Closing.
5. Two display modes: **swipe cards** (Tinder-style, gesture to vote) or **list** (compact rows).
6. User taps a proposal → opens `app/modals/proposal-detail.tsx`. Detail view shows:
   - Title, description, image, deadline, tier label (Global/Federal/Provincial/Municipal), location pill.
   - Current support/oppose tally with animated bars (or for multi-choice, the option counts; for RCV, an instant-runoff result viz).
   - Vote button (Yes/No, multi-choice picker, or RCV ranking input depending on `voteType`).
   - "Report this proposal" / "Mute this user" tap targets in the three-dot menu (UPDATE 27 moderation menu).
7. Tapping Yes/No (or submitting an RCV ballot) calls `votingApi.submit(proposalId, choice/rankings)` → `POST /api/voting/submit`.
8. Backend validates: user is verified (or proposal is global), deadline hasn't passed, geo-eligible, hasn't already voted. Records vote in `votes` table. For org proposals, also checks org membership + `requireMemberVerification`.
9. Backend calls `notifyProposalVote(...)` to send a server-side push notification confirming.
10. Mobile shows a vote-confirmation animation + receipt. The vote is also written to Base network as an on-chain record (best-effort, doesn't block).

### 5.4 Creating a proposal (consumer)

1. User taps the create button on the Vote tab.
2. Routes to a creation form (currently inside `app/(tabs)/proposals.tsx` — not its own screen).
3. Inputs: title, description, category, image (uploaded to object storage), vote type (yes/no, multi-choice, RCV), options (for MC/RCV), deadline, geo restriction (defaults to user's verified geo).
4. **Profanity filter** runs server-side on submit (`POST /api/proposals` → `checkContent({title, description})` from `backend/server/profanityFilter.ts`). Rejected with `code: CONTENT_REJECTED` if matched.
5. Verification gate: if `platform_settings.requireVerificationForProposals = true` (default), unverified users get a 403.
6. Backend creates the row, deploys vote-token contracts on Base if needed (for support/oppose tallies), returns the new proposal.
7. Server fires `notifyNewProposal(...)` to push to all eligible voters in the geo.

### 5.5 Org admin: create an organization

1. User taps "Create Organization" from the Groups tab or somewhere in the marketing surface.
2. Routes to `app/modals/create-organization.tsx`.
3. Wizard collects: org name, description, logo, category, billing address.
4. Free tier is created immediately (25-member cap, no IAP needed). Paid tiers route through `subscription.tsx` purchase flow.
5. On creation, `organizations` row is created with `creatorId = userId` and `tier = 'free'`. The creator is also inserted into `organization_members` with `role = 'admin'`. `organizationInviteCodes` row is created with a fresh 8-character code.

### 5.6 Org admin: invite + roster management

1. From `app/modals/organization-detail.tsx`, admin sees the org's invite code (auto-generated), member roster, settings.
2. **Three invite mechanisms**:
   - **Invite code** — admin shares the 8-char alphanumeric code; user enters it in the Groups tab to join. Admin can revoke/regenerate.
   - **Email invites** — admin enters individual email addresses; backend creates `organization_invites` rows with magic-link tokens, sends emails via Resend (`buildOrgInviteEmail`).
   - **CSV roster import** — admin uploads a CSV of emails (`app/modals/import-roster.tsx`); backend bulk-creates invites and emails everyone. Per-tier member-cap enforcement.
3. Invitee receives email with magic link → app opens to `/api/invites/:token/accept` → membership is created.

### 5.7 Org admin: enable identity verification (UPDATE 26 unlock fee)

1. In `organization-detail.tsx`, admin toggles "Require member verification" ON.
2. Mobile calls `organizationsApi.setRequireVerification(orgId, true)` → `PUT /api/organizations/:orgId/require-verification`.
3. **Three possible 402 responses**:
   - `FEATURE_NOT_AVAILABLE_ON_TIER` (Free tier) → mobile shows UpgradeModal pushing to Pro+.
   - `VERIFICATION_UNLOCK_REQUIRED` (Pro+ tier, hasn't paid the unlock yet) → mobile routes to `app/modals/verification-unlock-checkout.tsx`.
   - 200 (already unlocked) → toggle flips ON.
4. The unlock-checkout modal:
   - **iOS**: always uses Apple IAP (Guideline 3.1.1) — calls `purchaseProduct('verification_unlock_pro/plus/business')`, validates receipt server-side via `POST /api/organizations/:orgId/verification-unlock/iap-receipt`.
   - **Android (Stripe-billed orgs)**: opens Stripe Checkout in browser, server fires `checkout.session.completed` webhook → `markOrgUnlocked(orgId, tier, paymentId, 'stripe')`.
5. Once unlocked, `organizations.verificationUnlockedAt` is non-null and the toggle works freely. Subsequent verifications are platform-absorbed (no per-vote billing).
6. Refunds (Stripe `charge.refunded` or Apple REFUND notification) flip the unlock back off via `markOrgUnlockRefunded`.

### 5.8 Org member: voting in a verify-required org

1. Member opens an org proposal from the Groups tab → `app/modals/org-proposal-detail.tsx`.
2. If the org has `requireMemberVerification = true` and the user isn't verified, vote attempt returns 403 with `code: VERIFICATION_REQUIRED_BY_ORG`.
3. Mobile shows alert: "[Org] requires identity verification before voting. Verification is covered by your organization."
4. Tap "Verify now" → routes to `verification-payment.tsx` with `originatingOrgId` set → org-paid flow ([§5.2](#user-flows) above).
5. After verification completes, member can vote.

### 5.9 Audit log export (org admin)

1. From `organization-detail.tsx` settings, admin taps "Export audit log" → `app/modals/audit-export.tsx`.
2. Plus+ tier feature (gated server-side).
3. Choose format (CSV or JSON) and whether to include voter identity (PII).
4. Mobile calls `organizationsApi.exportAuditLog(...)` which uses `FileSystem.downloadAsync` (not `apiRequest`) so the raw file lands on disk.
5. Server (`GET /api/organizations/:orgId/audit-log`) generates the export. Each row carries an HMAC signature over canonical serialization. The bundle as a whole carries a bundle-level signature.
6. External auditors can verify any row by recomputing `HMAC-SHA256(AUDIT_SIGNING_SECRET, canonicalRow)` and comparing.
7. Mobile invokes the share sheet so admin can email/save the file.

### 5.10 Account deletion

1. Profile → Privacy & Settings → Delete Account.
2. `app/modals/privacy.tsx:118-172` — two-step confirmation dialogs.
3. Calls `DELETE /api/auth/account`.
4. Backend (`storage.deleteUser` in `storage-db.ts:1111-1130`) **anonymizes** rather than hard-deletes:
   - PII nullified (name, location, DOB, gender, etc.).
   - Email replaced with `deleted_${userId}@represent.invalid`.
   - `deleted: true` flag set.
   - Votes and proposals preserved to maintain referential integrity.
5. SecureStore session token cleared.
6. App routes back to sign-in screen.

---

<a name="app-surface"></a>
## 6. Mobile app surface — every tab and modal

### Tabs (5)

| Tab | File | Purpose |
|---|---|---|
| **Home** | `app/(tabs)/dashboard.tsx` | Hero + Featured + ImpactRing + SentinelDigest + Your Orgs. Personalized to user's verified geo. |
| **Vote** | `app/(tabs)/proposals.tsx` | Browse + vote on global and geo-eligible proposals. Swipe or list. |
| **Sentinel** | `app/(tabs)/sentinel.tsx` | AI governance compliance analyzer. Premium+ feature. |
| **Groups** | `app/(tabs)/groups.tsx` | List of orgs the user belongs to + invite-code entry. |
| **Profile** | `app/(tabs)/profile.tsx` | User identity card, settings, KYC entry, theme, sign out. |

### Modals (21)

| Modal | Purpose |
|---|---|
| `proposal-detail` | Full view of a public proposal + vote action. |
| `org-proposal-detail` | Full view of an org proposal + vote action. |
| `organization-detail` | Org settings (admin) or member view. Invite code, roster, verification toggle. |
| `organization-billing` | Org tier picker, current usage, billing history, cancel subscription. |
| `create-organization` | New org wizard. |
| `verification-payment` | Member-side: start KYC. Two modes (self-pay / org-paid). |
| `verification-unlock-checkout` | **Admin-side: pay the one-time unlock fee** (UPDATE 26). |
| `veriff` | WebView host for KYC sessions (Veriff or Didit). |
| `subscription` | Premium + org tier picker. Restore Purchases button. Legal footer. |
| `audit-export` | HMAC-signed audit log download. |
| `analytics` | Org analytics (votes-per-day, geographic spread, demographic breakdown). |
| `import-roster` | CSV roster bulk-import for orgs. |
| `voting-history` | User's past votes with stats card. |
| `community-proposals` | Marketing surface listing community proposals. |
| `my-proposals` | User's own created proposals. |
| `badges` | Civic badges earned by the user. |
| `receipt` | Cryptographic vote receipt (post-vote). |
| `privacy` | Privacy settings + account deletion. |
| `legal` | ToS + Privacy + Contact Support links. |
| `admin` | Platform-admin panel (5-tap unlock from logo). |

### Components (~30)

- `Onboarding.tsx` — first-launch tutorial overlay
- `identity/PassportCard.tsx` — passport-style ID card on Profile
- `ui/` — Button, Card, Input, Skeleton, Header, Badge, EmptyState, MilestoneCelebration, ConfettiParticles, AnimatedRadarChart, etc.
- `ui/RCVBallotInput.tsx`, `RCVResults.tsx` — ranked-choice voting UI
- `ui/MultipleChoiceBallot.tsx`, `MultipleChoiceResults.tsx` — multi-choice voting UI
- `ui/UpgradeModal.tsx` — appears on tier-gated 402 responses
- `ui/TierBadge.tsx`, `TierCard.tsx` — tier-system visualization
- `moderation/ProposalModerationMenu.tsx` — three-dot menu on proposal cards (Report / Mute)
- `tutorial/Tooltip.tsx`, `Spotlight.tsx`, `GestureIndicator.tsx`, `TutorialOverlay.tsx` — onboarding tutorial primitives
- `icons/BallotIcon.tsx` — custom SVG ballot icon

---

<a name="identity"></a>
## 7. Identity verification (Veriff + Didit)

**Why two providers**: Veriff is the original integration (more expensive but mature). Didit is a cheaper alternative (500 free verifications/month then $0.15/check). Both are wired so the platform can A/B between them or switch wholesale without a code change.

**Verification = lifetime, not per-session.** Once a user is verified, `users.verified = true` forever (until account deletion). No re-verification flow exists today. If country changes (user moves), they keep their verified status but `users.country/state/city` only updates on next verification — flagged as a future concern.

### What's collected

- Government ID image (passport, driver's licence) — Veriff/Didit hosted; Represent never sees the raw photo
- Selfie + liveness check — same
- Demographic data sent back: full name, date of birth, gender, country, state, city, postal code

### Storage

- Demographic fields stored on `users` row (encrypted at rest by Neon via Postgres column-level — Neon does this transparently)
- The original ID document images are NOT stored by Represent — only the decision + extracted fields. Veriff/Didit retain images per their own policies (each has separate ToS).

### Cost economics

Roughly $1.50–$3 per verification with Veriff, $0.15+ with Didit (after free tier). UPDATE 26's verification-unlock fee model is sized to absorb these:
- Pro org: $199 unlock → covers ~67–130 verifications
- Plus org: $499 unlock → covers ~167–330
- Business org: $999 unlock → covers ~333–660

Worst-case Business orgs (5,000 members all verifying) cost ~$10K — net loss vs the $999 unlock. The tier subscription ($499/month recurring) makes up the rest. See UPDATE 26 in the plan file for full economic analysis.

### Code locations

- `backend/server/routes.ts` `/api/veriff/create-session`, `/api/veriff/webhook`
- `backend/server/routes.ts` `/api/didit/create-session`, `/api/didit/webhook`
- `app/modals/verification-payment.tsx` — member-facing screen
- `app/modals/veriff.tsx` — WebView host
- `app/modals/verification-unlock-checkout.tsx` — admin-facing unlock fee
- `backend/server/verificationUnlock.ts` — unlock-fee helpers (markOrgUnlocked, etc.)

---

<a name="voting"></a>
## 8. Voting mechanics

Three vote types, all in production:

### Yes/No (default)

- `proposals.voteType = 'yes-no'`
- `votes.voteType = 'yes' | 'no'` per ballot
- Tally is just `count(votes WHERE proposalId AND voteType)`
- UI: pure swipe-card (right=yes, left=no) or button taps in detail view

### Multiple choice

- `proposals.voteType = 'multiple-choice'`
- `proposals.options = ['Option A', 'Option B', 'Option C']` (JSONB)
- `votes.selectedOption = 'Option A'` per ballot
- Tally is `count(votes) GROUP BY selectedOption`, normalized so every option appears (even 0)
- UI: `MultipleChoiceBallot` (radio buttons), `MultipleChoiceResults` (horizontal bars)

### Ranked-choice voting (RCV / instant-runoff)

- `proposals.voteType = 'ranked-choice'`
- Voter submits an ordered list of preferred options
- `votes.selectedOption` stores `JSON.stringify(['1st choice', '2nd choice', ...])` (preserves order)
- **Tally is compute-on-read** at `GET /api/proposals/:id/results` via `computeIRV(...)` from `backend/server/rcvTally.ts`. Standard instant-runoff:
  1. Count first-choice votes per option
  2. If any option has > 50%, it wins
  3. Otherwise eliminate the option with fewest first-choice votes; redistribute those ballots to their next-preferred option
  4. Repeat until majority
- UI: `RCVBallotInput` (drag-to-reorder list), `RCVResults` (round-by-round visualization)
- Geo coverage: works on global, geo-restricted, AND org proposals (UPDATE 22 extended this to all paths).

### Vote enforcement (`POST /api/voting/submit`)

The endpoint runs through this gate sequence (in order):
1. **Auth** — must have valid session
2. **Ballot shape** — yes/no choice, valid MC option, RCV array of strings with no duplicates
3. **Deadline** — `proposal.deadline > now()`
4. **Org membership** (if `proposal.organizationId`) — must be in `organization_members`
5. **Org-mandated verification** (if `proposalOrg.requireMemberVerification && !user.verified`) — 403 with `code: VERIFICATION_REQUIRED_BY_ORG`
6. **Identity gate** (public proposals): unverified user can vote on global only
7. **Geo eligibility** — verified user's country/state/city must match `proposal.geoRestrictions`
8. **Demographic restrictions** (rare) — `proposal.demographicRestrictions = {gender, ageMin, ageMax}` allows targeting (e.g., "vote on women's health policy is restricted to women 25-65")
9. **Hasn't already voted** — `votes` UNIQUE constraint on (userId, proposalId)

If all checks pass, ballot is recorded and an on-chain transaction is best-effort fired against the proposal's vote-token contracts on Base.

---

<a name="sentinel"></a>
## 9. Sentinel AI

**What it is**: an AI feature that analyzes a governance document (a bylaw, policy, regulation) against a configurable principle library and flags compliance issues.

**Where it lives**: `app/(tabs)/sentinel.tsx` (mobile UI), `backend/server/lib/openai.ts` (OpenAI prompt scaffolding), `backend/server/routes.ts` `/api/sentinel/analyze` (server endpoint).

**Tier gating**: Premium feature ($7.99/mo). Free users see a teaser. Premium users get unlimited analyses.

### Flow

1. User opens Sentinel tab. First launch: AI consent gate (modal explains what data is sent — title, body text, category — and that OpenAI processes it).
2. User pastes / uploads a document, picks an issue type (Constitutional, Civil, Criminal, etc.), taps Analyze.
3. Mobile POSTs to `/api/sentinel/analyze` → backend builds a prompt with the principle library + document body, calls OpenAI (GPT-4-class model).
4. Response is structured JSON: `summary`, `reasoning`, `categoryScores`, `overallVerdict` (Aligned / At Risk / Violating), `flaggedPrinciples` (array of named violations with explanations), `sentinelCorrections` (suggested fixes), `mainProposal`.
5. Mobile renders this as a "Governance Report Card" with score badge, finding cards, fix items, summary.
6. **Bottom of every report card**: "Flag this analysis" mailto link (UPDATE 27 added this for Apple's generative-AI guideline compliance) — opens email composer to support@representvote.com.

### Defensibility

The most differentiated single piece of the stack. Three things make it defensible:
1. The **principle library** (currently embedded in `openai.ts` prompt scaffolding) — opinionated about what good governance looks like. Quality of the library matters more than the LLM.
2. The **structured output format** — mobile expects strict JSON shape; the prompt enforces this with examples.
3. **Civic-specific framing** — competitors (LogicGate, OneTrust, Diligent) are corporate-compliance focused; Sentinel sits in a quieter niche.

See the pivot analysis in [§24](#roadmap) for how Sentinel could be spun out as its own product.

---

<a name="orgs"></a>
## 10. Organization features (B2B side)

This is the most commercially-relevant part of the product. The whole tier ladder, billing rail, and admin tooling exists to serve organization customers.

### Org admin capabilities (gated by tier)

| Feature | Free | Pro | Plus | Business | Government |
|---|---|---|---|---|---|
| Member cap | 25 | 250 | 1,000 | 5,000 | unlimited |
| CSV roster import | ❌ | ✅ | ✅ | ✅ | ✅ |
| Advanced analytics | ❌ | ✅ | ✅ | ✅ | ✅ |
| API access | ❌ | ✅ | ✅ | ✅ | ✅ |
| Sub-organizations | ❌ | ❌ | ✅ | ✅ | ✅ |
| OAuth / SSO | ❌ | ❌ | ✅ | ✅ | ✅ |
| Audit log export | ❌ | ❌ | ✅ | ✅ | ✅ |
| White-label + custom domain | ❌ | ❌ | ❌ | ✅ | ✅ |
| Identity verification toggle | ❌ | ✅ ($199) | ✅ ($499) | ✅ ($999) | ✅ (custom) |

(Authoritative source: `shared/tier-limits.ts`. Don't memorize this — read the file.)

### Sub-organizations (UPDATE 23)

Plus+ orgs can create child orgs underneath. Use case: a federation (parent) with locals (children); a school district (parent) with schools (children); a university (parent) with departments (children). Each sub-org has its own member roster, proposals, admin set. Parent admins have read-only visibility into child orgs unless explicitly added as admin.

### White-label (UPDATE 23)

Business+ orgs can:
- Set a `customDomain` (e.g., `vote.localmunion123.org`) — DNS CNAME points at representportal.com, server routes by Host header.
- Upload a custom logo (replaces Represent branding inside the org's surfaces).
- Set theme colors.

The mobile app does NOT white-label per-org — Apple's policies apply to the binary, not per-org. White-label only affects the web surface.

### Org communications

- **Email invites** — magic links via Resend.
- **In-app announcements** (`organization_announcements` table) — admin posts a message visible to all members.
- **Push notifications** — when an admin creates a proposal, all members get a push (`notifyNewProposal`).

---

<a name="pricing"></a>
## 11. Pricing model

**Personal Premium**: $7.99/month. One product across iOS (IAP) + web (Stripe).

**Organization tiers** (recurring monthly):

| Tier | Price | Member cap |
|---|---|---|
| Free | $0 | 25 |
| Pro | $59/mo | 250 |
| Plus | $179/mo | 1,000 |
| Business | $499/mo | 5,000 |
| Government | custom annual contract | unlimited |

**Verification unlock** (one-time per org, UPDATE 26):

| Tier | Unlock fee | What it unlocks |
|---|---|---|
| Pro | $199 | Unlimited member verifications |
| Plus | $499 | Same |
| Business | $999 | Same |
| Government | custom | Same |

The unlock survives tier changes and subscription cancellation. Refunds invalidate it. Verifies the org's identity-verified-voting feature once and forever.

### Pricing decision history (in `/root/.claude/plans/ok-so-im-going-zany-melody.md`)

- UPDATE 14 / 15 — competitive analysis vs ElectionBuddy ($29/$99/$299), Polco, Granicus, Slido. Concluded current pricing is well-positioned for self-serve and underpriced for enterprise.
- UPDATE 23 — Stage 3 tier rollout (the current names + caps).
- UPDATE 24 → 25 → 26 — verification billing model evolution. Started as Stripe metered overage → moved to first-vote-in-org → settled on flat one-time unlock fee. The unlock-fee model closed the iOS gap (Stripe metered usage doesn't work on Apple IAP).

---

<a name="billing"></a>
## 12. Billing rails (Stripe + Apple IAP)

Two completely separate systems, with policy-driven routing.

### iOS (Apple App Store)

**All digital goods must use Apple IAP** (Guideline 3.1.1). The codebase enforces this everywhere:
- `lib/payment.ts` `processPremiumPayment()` and `processOrganizationPayment()` early-return to IAP-only on `Platform.OS === 'ios'`.
- `app/modals/verification-unlock-checkout.tsx` always routes to IAP on iOS, regardless of the org's existing subscription rail (UPDATE 27 fix).
- No `Linking.openURL` to Stripe Checkout fires anywhere on iOS — `processStripePremium` and `processStripeOrganization` have defensive `Platform.OS === 'ios'` early returns.

### Android (and web)

Currently routes through **Stripe**. Note: this is technically a Google Play policy violation if/when we ship to the Play Store — Google has the same rule as Apple. For now Android side-loads or runs in dev only. See UPDATE 27 (Play Store section) for the eventual migration plan.

### IAP product set (App Store Connect)

Five auto-renewable subscriptions:
- `com.representwallet.app.premium` — $7.99/mo
- `com.representwallet.app.org.community` (legacy starter) — kept for grandfathered subscribers
- `com.representwallet.app.org.professional` — Pro $59/mo
- `com.representwallet.app.org.premium` — Plus $179/mo
- `com.representwallet.app.org.enterprise` — Business $499/mo

Three consumable IAPs (UPDATE 26):
- `verification_unlock_pro` — $199 one-time
- `verification_unlock_plus` — $499 one-time
- `verification_unlock_business` — $999 one-time

Consumable, not non-consumable, because server is the source of truth (an admin can't carry the unlock to a different org via Apple's automatic restore-purchases path).

### Receipt validation

- **Existing endpoint**: `POST /api/iap/validate-receipt` validates the 5 subscription SKUs. Sends to Apple's `verifyReceipt` (production), falls back to sandbox URL on status 21007. Idempotent on `transaction_id`.
- **New endpoint** (UPDATE 26): `POST /api/organizations/:orgId/verification-unlock/iap-receipt` validates consumable unlocks. Same Apple call, different SKU mapping, calls `markOrgUnlocked(orgId, tier, transactionId, 'apple_iap')` on success.

### App Store Server Notifications V2

`backend/server/iapWebhookHandlers.ts` handles Apple's webhook for subscription lifecycle:
- `SUBSCRIBED`, `DID_RENEW` — refresh subscription end date
- `DID_FAIL_TO_RENEW`, `EXPIRED`, `GRACE_PERIOD_EXPIRED` — mark canceled
- `REFUND`, `REVOKE` — for subscriptions, mark canceled. For consumable unlock SKUs (UPDATE 27 fix), instead route to `markOrgUnlockRefunded(orgId)` to clear the unlock.
- `REFUND_REVERSED` — restore on dispute-won

### Stripe webhooks

`backend/server/webhookHandlers.ts` handles:
- `checkout.session.completed` — three branches:
  - Subscription mode + premium → flip user.subscriptionStatus
  - Payment mode + `type=verification` → user.verificationPaid (legacy)
  - Payment mode + `type=verification_unlock` → `markOrgUnlocked('stripe')`
- `customer.subscription.updated`, `.deleted` — sync subscription state
- `invoice.payment_failed`, `.paid` — past_due / activate
- `charge.refunded`, `charge.dispute.created` (UPDATE 26) — if `payment_intent` matches an org's `verificationUnlockPaymentId`, call `markOrgUnlockRefunded`

---

<a name="on-chain"></a>
## 13. On-chain layer

**Why on-chain**: tamper-evident vote records, reputation-bearing identity NFTs, future composability with DAOs.

**What chain**: Base (Coinbase L2 Ethereum, low gas, mature). Wallet implementation: smart wallets (account abstraction), one per user, key encrypted at rest in `wallets` table.

### What lives on-chain

1. **Vote tokens** — each proposal has support and oppose ERC-20 tokens. When a user votes, a transaction transfers a token from a treasury to their wallet. The token balance is the on-chain record of the vote. Multi-choice and RCV proposals have arrays of option tokens (`proposalOptionAddresses`).
2. **Vote-token claims** — `voteTokenClaims` table tracks which user-proposal pairs have already claimed (off-chain idempotency).
3. **Passport NFT** — soulbound (non-transferable) ERC-721 minted on first verification. `passportNFTs` table maps userId → tokenId. Used as on-chain proof of verified identity.
4. **Activated ridings** — Canadian electoral ridings (federal + provincial + municipal) track on-chain activation status. `activatedRidings` table stores when each one was provisioned.

### Gotchas

- On-chain calls are **best-effort** during voting. If Base RPC times out, the off-chain DB record is still authoritative. Mobile shows the off-chain tally. The on-chain trail is for after-the-fact audit.
- `wallets.privateKey` is encrypted at rest with a per-row key derived from `WALLET_ENCRYPTION_SECRET`. Rotation utility lives at `backend/server/rotate-wallet-keys.ts`.
- Gas is paid by the platform (the treasury wallet covers user transactions). Costs ~$0.001 per vote at current Base fees.

### Code locations

- `backend/server/base-network.ts` — Base RPC wrapper, contract calls
- `backend/server/crypto.ts` — wallet encryption helpers
- `lib/rpv-token.ts`, `lib/ballots.ts` — mobile-side helpers
- `backend/server/migrate-encrypt-wallets.ts` — one-time migration script

---

<a name="audit"></a>
## 14. Audit log + compliance

The single most defensible feature for B2B / B2G sales.

### What it does

Every vote on every proposal in an org can be exported as a tamper-evident bundle:
- CSV or JSON format
- One row per ballot
- Each row includes: timestamp, proposal title, proposal ID, voter ID (or anonymized), vote choice (yes/no/option/rankings), HMAC-SHA256 signature over canonical row serialization
- Bundle-level metadata: org name, export timestamp, exporter user, total rows, bundle signature

### Why it matters

Corporate counsel accepts HMAC-receipted vote bundles as legal evidence. Civic auditors can re-run the HMAC against any row to confirm it hasn't been altered post-export. This is what `vote.direct`, `Simply Voting`, and `OpaVote` charge a premium for; Represent includes it at the Plus tier.

### Verification flow (external auditor)

1. Auditor receives the CSV or JSON
2. For any row, recomputes `HMAC-SHA256(AUDIT_SIGNING_SECRET, canonicalRow)`
3. Compares to the row's `rowSignature` field
4. If match → row is authentic and unaltered

`AUDIT_SIGNING_SECRET` is a single platform secret. If we ever want **per-org keys** (so leaking one org's signing secret doesn't compromise all of them), that's a future enhancement.

### Tier gating

- Plus, Business, Government: full access including PII (`include_voter_identity=true` query param).
- Pro: blocked (402 → upgrade prompt).
- Free: blocked.

### Code

- `backend/server/routes.ts` `GET /api/organizations/:orgId/audit-log`
- `app/modals/audit-export.tsx`
- `lib/api.ts` `organizationsApi.exportAuditLog`

---

<a name="moderation"></a>
## 15. Moderation, reporting, safety

Apple Guideline 1.2 (UGC moderation) requirements were the focus of UPDATE 27. Four pieces:

### 1. Pre-publish profanity filter

`backend/server/profanityFilter.ts` runs on `POST /api/proposals`. Two configurable lists (`PROFANITY_BLOCKLIST` env, word-boundary match; `PROFANITY_BLOCKLIST_SUBSTRINGS` env, substring match for slurs). Returns `{ ok: false, matched, field }` on hit, server replies 400 with `code: CONTENT_REJECTED`.

### 2. Report flow

- **Mobile UI**: three-dot menu on proposal cards (`components/moderation/ProposalModerationMenu.tsx`) → reason picker (spam, hate_speech, threat, sexual, illegal, misinformation, other) + optional 500-char note → submit.
- **Backend**: `POST /api/proposals/:id/report` → inserts `proposal_reports` row, increments `proposals.reportCount`. **Auto-hide threshold = 3 reports** — at 3, the proposal's `hiddenAt` is stamped, and `GET /api/proposals` filters it out for everyone.
- **Admin notification**: best-effort email via `MODERATION_ADMIN_EMAIL` env (Resend).

### 3. Block/mute users

- **Mobile UI**: same three-dot menu has "Mute creator" option.
- **Backend**: `POST /api/users/:userId/mute` (idempotent on UNIQUE) → `user_mutes` row. `DELETE` to unmute. `GET /api/user/mutes` returns the user's mute list.
- **Listing filter**: `GET /api/proposals` removes proposals from muted creators when authenticated. The mute is server-stored (survives reinstall, syncs across devices).

### 4. Published contact info

Profile → Legal → Contact Support → mailto link to `support@representvote.com`. Required by Apple.

### What's not yet built

- Admin moderation dashboard (today admins read the email and remove proposals manually via psql)
- Layered AI moderation (OpenAI Moderation API, Perspective API) — UPDATE 27 mentions this as future work
- Appeal flow when a user's proposal is auto-hidden
- Reporter rate-limiting (today a single user can submit unlimited reports)

---

<a name="push"></a>
## 16. Push notifications

### Channels (Android)

Defined in `lib/notifications.ts:51-68`:
- `default` — generic notifications
- `deadlines` — proposal closing soon
- `votes` — your proposal got a vote / your vote was recorded

### iOS

APNs via Expo Notifications. Channels are an Android concept; iOS uses categories defined per-message.

### Server-side fan-out

`backend/server/notifications.ts`:
- `notifyNewProposal(proposal)` — push to all eligible voters in the proposal's geo
- `notifyTokenClaimed(userId, ...)` — push to a user when their on-chain vote token claim succeeds
- `notifyProposalVote(proposal)` — push to the proposal author when someone votes

### Push tokens

`pushTokens` table maps userId → ExpoPushToken. Updated on app launch via `savePushToken`. The fan-out functions filter by token presence.

### Permissions

- iOS: standard `expo-notifications` permission prompt, requested at first relevant action (not on launch — Apple-friendly).
- Android: same prompt for Android 13+.

---

<a name="geo"></a>
## 17. Geo restrictions and proposal scoping

Proposals are scoped to a geographic level by `proposals.geoRestrictions: string[]`:
- `[]` (empty) → **Global**, anyone verified or unverified can vote
- `['Canada']` → **Federal** (length 1)
- `['Canada', 'Ontario']` → **Provincial** (length 2)
- `['Canada', 'Ontario', 'Toronto']` → **Municipal** (length 3)

Plus an array of countries can do "supranational" (e.g., `['Canada', 'United States', 'United Kingdom']` for an English-speaking-democracies poll).

A user's verified geography (`users.country/state/city`) is what their voting eligibility is matched against. An unverified user can vote on global proposals only.

### "Riding" (Canadian-specific)

`proposals.riding` is an optional electoral riding (federal or provincial district). Used for hyperlocal proposals — "should our MP vote for X". The user's `users.riding` is set during verification (Veriff/Didit return postal code → riding lookup).

### Demographic restrictions

`proposals.demographicRestrictions = {gender, ageMin, ageMax}` — niche feature. Allows a proposal to be restricted to e.g., women 25–65. Used for healthcare or representation-specific issues. Most proposals leave this empty.

### Helper module

`lib/proposalGeo.ts` exposes `canUserVoteOnProposal(proposal, userCountry, userState, userCity, isVerified)` — the canonical client-side check. Mirrors server enforcement.

---

<a name="schema"></a>
## 18. Database schema reference

27 tables in `shared/schema.ts`. Highlights:

### Core user + auth
- `sessions` — Express session storage (PostgreSQL session store)
- `users` — user accounts. Columns include `email`, `name`, `verified`, KYC fields (firstName, lastName, dob, gender, country, state, city, postalCode, riding), `subscriptionStatus`, `verificationPaid` (legacy), `deleted`.
- `wallets` — encrypted private keys for Base smart wallets. One per user.
- `pushTokens` — Expo push tokens.

### Proposals + voting
- `proposals` — title, description, category, voteType, geoRestrictions, demographicRestrictions, options, deadline, organizationId (nullable), reportCount, hiddenAt
- `votes` — userId, proposalId, voteType (yes/no/multiple-choice/ranked-choice), selectedOption, createdAt. UNIQUE(userId, proposalId).
- `proposalOptionAddresses` — on-chain addresses for multi-choice option tokens
- `proposalReports` (UPDATE 27) — UGC reports
- `userMutes` (UPDATE 27) — server-side mute edges

### Organizations
- `organizations` — name, tier, subscriptionStatus, stripe* IDs, custom domain, requireMemberVerification, **verification unlock columns** (`verificationUnlockedAt`, `verificationUnlockedTier`, `verificationUnlockPaymentId`, `verificationUnlockSource`)
- `organizationMembers` — userId, organizationId, role (admin/member), `verificationBilledAt` (deprecated, UPDATE 26 superseded)
- `organizationInviteCodes` — 8-char codes
- `organizationInvites` — magic-link email invites
- `organizationAnnouncements` — in-app announcements

### Billing + transactions
- `transactions` — generic on-chain transaction log
- `voteTokenClaims` — on-chain vote-token attribution
- `pricingPlans` — DEPRECATED, kept for historical rows

### Identity / civic
- `passportNFTs` — soulbound identity NFTs
- `ridingVerifications` — Canadian electoral riding membership proofs
- `electoralRidingQRCodes` — printable QR codes for offline riding activation
- `activatedRidings` — riding-level on-chain activation log

### Referrals + badges
- `referralCodes`, `referrals`, `referralConfig` — referral system (rarely used today)
- `badges`, `userBadges` — civic engagement badges

### Platform settings
- `platformSettings` — key-value config (e.g., `requireVerificationForProposals = true`)

### Source of truth

`shared/schema.ts` IS the schema. Drizzle generates types from it. Migrations apply via `drizzle-kit push`. Don't write raw SQL migrations — let Drizzle handle it.

---

<a name="integrations"></a>
## 19. Backend integrations

### Stripe

`backend/server/stripeClient.ts` — singleton Stripe SDK client (`getUncachableStripeClient()` because Stripe SDK caches some things across instantiations). `stripeService.ts` has higher-level helpers.

Webhook URL: `https://representportal.com/api/webhooks/stripe`. Events handled in `webhookHandlers.ts`:
- `checkout.session.completed` (subscription / verification / verification_unlock)
- `customer.subscription.updated`, `.deleted`
- `invoice.paid`, `invoice.payment_failed`
- `charge.refunded`, `charge.dispute.created`

### Apple

Webhook URL configured in App Store Connect → App Information → App Store Server Notifications V2. Events handled in `iapWebhookHandlers.ts`. JWS payload verification via `@apple/app-store-server-library`.

### Veriff

API base: `stationapi.veriff.com`. Webhook URL: `https://representportal.com/api/veriff/webhook`. Signature verified with `VERIFF_API_SECRET`.

### Didit

API base: `verification.didit.me`. Webhook URL: `https://representportal.com/api/didit/webhook`. HMAC-SHA256 signature verification.

### OpenAI

`backend/server/lib/openai.ts` — Chat Completions API. Uses `gpt-4-class` model (configurable via env). Sentinel queries are cached for ~1 hour to dedupe.

### Resend

`backend/server/email.ts` — wrapper around Resend's REST API. From address: `noreply@representvote.com` (configurable via env). Used for: org invites, account verification reminders, moderation reports, billing receipts.

### Base network

`backend/server/base-network.ts` — `ethers` v6 client connected to Base RPC (Alchemy). All on-chain calls funneled through here. Treasury wallet pays gas.

---

<a name="mobile-arch"></a>
## 20. Mobile app architecture details

### Routing

Expo Router (file-based). Two layout layers:
- `app/_layout.tsx` — root stack: handles theme, auth check, providers (Stripe, SafeArea, Reanimated)
- `app/(tabs)/_layout.tsx` — bottom tab bar: 5 tabs

Modals live under `app/modals/` and are presented via `presentation: 'modal'` from `app/modals/_layout.tsx`. Routing examples:
- `router.push('/modals/proposal-detail', { params: { proposalId: '...' } })`
- `router.replace('/(tabs)/dashboard')`
- `router.back()`

### State management

- **Auth**: Zustand store at `lib/auth.ts` (`useAuthStore`). Hydrates from SecureStore on launch.
- **Server data**: Mostly fetched on-demand via `lib/api.ts`. No global cache layer like react-query — each screen fetches what it needs. Some data (mute list, user's orgs) cached in module-scoped state for the session.
- **Theme**: `lib/theme.ts` — `useTheme()` hook. User preference persisted to AsyncStorage.

### Tutorial system

`components/tutorial/` provides Spotlight + Tooltip + GestureIndicator for guided onboarding. Triggered by `lib/tutorial.ts` state. Currently lightly used; Onboarding component is the main first-launch experience.

### Animations

Reanimated v3 throughout. Common patterns:
- `FadeInUp.delay(i * 60).duration(300)` for staggered list entries
- `withSpring` / `withTiming` for interactive gestures
- `useAnimatedStyle` + `useSharedValue` for proposal-card swipe animations

### Native modules

- `react-native-iap` — Apple StoreKit (iOS only currently; Google Play Billing eventually)
- `expo-secure-store` — token storage
- `expo-apple-authentication` — Sign in with Apple
- `expo-document-picker` — CSV upload (note: requires native rebuild after package install — see UPDATE 1 in plan file)
- `expo-image-picker` — proposal images
- `expo-file-system` — audit log download

### Platform branching

Look for `Platform.OS === 'ios'` / `'android'` checks. Notable:
- `lib/payment.ts` — every payment function gates on Platform
- `app/modals/verification-unlock-checkout.tsx` — iOS forces IAP
- `lib/notifications.ts` — Android channel setup
- `lib/stripe.ts` — Apple Pay + Google Pay availability checks

---

<a name="demo"></a>
## 21. Demo account + reviewer Easter egg

For App Store / Play Store reviewers and internal demos:

- **Trigger**: tap the Represent logo on the sign-in screen 5 times.
- **Reveals**: a hidden "Use demo account" button.
- **Credentials**: `demo@represent.app` / `RepresentDemo2024!`
- **Auto-state**: account is auto-verified (`users.verified = true`), premium-active (`subscriptionStatus = 'active'`), bypasses regional/demographic restrictions.
- **Demo orgs**: "Community Voices Coalition" (Plus tier, 847 members, demo admin) and "Westbrook University" (Business tier, 3,209 members, demo admin) — let reviewers see the org-admin features.
- **Code**: `app/index.tsx:1134-1170` (5-tap counter), `lib/auth.ts:demoLogin()`.

The demo account exists to satisfy Apple's submission requirement for premium-feature testing access. Don't change credentials without updating App Review notes in App Store Connect.

---

<a name="ops"></a>
## 22. Deployment, operations, environments

### Backend (Replit)

The production backend lives on Replit. Workflow:
1. Mobile repo (this one) is the source of truth for backend code (`backend/server/`).
2. Changes here are committed to git, pushed to GitHub.
3. **Replit doesn't auto-pull from GitHub.** A "Replit prompt" workflow is used: I generate a self-contained instruction prompt, you paste it into Replit's AI to mirror the changes, then publish.
4. Database migrations: `drizzle-kit push` (run on Replit, applies schema diffs).
5. Environment variables in Replit Secrets — see [§22.4](#env-vars) below.

### Mobile (EAS Build)

- `eas build --profile production --platform ios` → builds an `.ipa` on Expo's servers (~10–15 min)
- `eas submit --platform ios --profile production` → uploads to App Store Connect for TestFlight + review
- Needs `eas.json` `submit.production.ios` populated with `appleId`, `ascAppId`, `appleTeamId`

### Web (representportal.com)

Lives outside this repo. Marketing pages, ToS, Privacy Policy, web admin dashboards. Assumed deployed via the same Replit instance or a separate hosting setup (verify with the team).

### Environments

- **Production**: `representportal.com` (backend), App Store production (mobile)
- **Sandbox**: App Store sandbox testers, Stripe test keys, Veriff sandbox endpoint
- **Local dev**: `npx expo start` with a local backend on Replit's dev URL, or against production with caution

### Env vars (current authoritative list)

Backend (Replit Secrets):
- `DATABASE_URL` — Neon Postgres connection string
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ORG_PRO` / `_PLUS` / `_BUSINESS` — recurring subscription prices
- `STRIPE_PRICE_VERIFICATION_UNLOCK_PRO` / `_PLUS` / `_BUSINESS` — UPDATE 26 one-time prices
- `STRIPE_VERIFICATION_PRICE_ID` — legacy $4.99 self-pay verification (dead code path)
- `APPLE_SHARED_SECRET` — IAP receipt validation (UPDATE 27 standardized this name)
- `VERIFF_API_KEY`, `VERIFF_API_SECRET`
- `DIDIT_API_KEY`, `DIDIT_WEBHOOK_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `BASE_RPC_URL`, `WALLET_ENCRYPTION_SECRET`, `TREASURY_PRIVATE_KEY`
- `AUDIT_SIGNING_SECRET` — HMAC for audit log
- `MODERATION_ADMIN_EMAIL` — UPDATE 27, where reports go
- `PROFANITY_BLOCKLIST`, `PROFANITY_BLOCKLIST_SUBSTRINGS` — UPDATE 27, optional
- `SENTRY_DSN` (backend error tracking, with PII scrubbing in `app.ts`)
- `SESSION_SECRET`
- `PUBLIC_BASE_URL` (e.g., `https://representportal.com`)
- `VERIFF_MASTER_SIGNATURE_KEY` (admin-endpoint gate)

Mobile (`EXPO_PUBLIC_*` prefix to expose to client):
- `EXPO_PUBLIC_API_URL` — backend URL
- Stripe publishable key (set via `app.json`)
- Google Sign-In client ID

---

<a name="stores"></a>
## 23. App Store / Play Store status

### iOS App Store — submission imminent (this week)

Current branch (`claude/continue-previous-session-ZdwLL`) has all UPDATE 27 fixes shipped. Pre-existing rejection ("iOS 1.0 Rejected") was for the developer account being individual, not org. Org account is now active.

Remaining steps before resubmission:
1. Replit deploy (UPDATE 26 backend + UPDATE 27 backend)
2. Create 4 subscriptions + 3 consumables in App Store Connect
3. `eas.json` Apple credentials populated
4. Sandbox tester smoke test
5. Submit for review

See UPDATE 27 in `/root/.claude/plans/ok-so-im-going-zany-melody.md` for the full punch list and rejection-risk audit.

### Google Play Store — deferred

Per recent decision (post-pivot-options conversation), Android is later. Significant work needed:
- Migrate Stripe → Google Play Billing (~1 week)
- Backend Google Play receipt validator + RTDN webhook (~2–3 days)
- AAB output (not APK), production keystore, Play App Signing
- Closed testing 14-day requirement before production
- Data Safety form, Content Rating, store listing

---

<a name="roadmap"></a>
## 24. Roadmap and pivot options

See **UPDATE 28** in the plan file for the full pivot analysis. Summary:

### If consumer civic-voting traction is weak

**Tier A — repositioning, code largely intact:**
1. **Membership-decision SaaS** for unions, HOAs, co-ops, nonprofits, faculty senates. The codebase already IS this; drop the civic shell. **Recommended first pivot.** ~4–6 weeks of UX cleanup.
2. **B2G civic engagement** (Granicus / Polco competitor). Long sales cycles, run as parallel channel.
3. **Boardroom / corporate governance.** Same product, narrower ICP, $5K–$25K annual contracts.

**Tier B — repackage one component:**
4. **Sentinel as standalone B2B compliance tool.** Most defensible single piece. 2–3 months refocused build.
5. **DAO / on-chain governance infrastructure.** Smaller TAM, requires crypto-native GTM.

**Tier C — bigger rebuilds:**
6. Identity-verified survey/research platform.
7. KYC-as-a-service.

### Trigger thresholds for pivoting

Any 2 of 4 at the 6–9 month mark:
- < 5,000 monthly verified users
- < 2% week-over-week new-org signup growth
- < $5K MRR by month 9
- Veriff/Didit cost per verified-active-user > $5

Hit any two, start the membership-SaaS pivot within the same quarter.

### Defensibility ranking of existing assets

For triage if forced to cut features:
1. HMAC audit log (most defensible)
2. Sentinel principle library
3. Identity-verified org-paid billing model
4. Ranked-choice voting + IRV tally
5. On-chain wallet + vote tokens (cut first unless pivoting to DAO lane)

---

<a name="filemap"></a>
## 25. Important files — where things live

When you need to find / change X, look here:

| What | Where |
|---|---|
| Add a new tab | `app/(tabs)/_layout.tsx` (add `<Tabs.Screen>`) + new file in `app/(tabs)/` |
| Add a new modal | `app/modals/_layout.tsx` (register `<Stack.Screen>`) + new file in `app/modals/` |
| Add a new API endpoint | `backend/server/routes.ts` (one giant file by design) |
| Add a new schema table | `shared/schema.ts`, then `drizzle-kit push` |
| Change tier limits | `shared/tier-limits.ts` (single source of truth) |
| Tier copy in subscription picker | `lib/org-tiers.ts` |
| Mobile API client | `lib/api.ts` (organized by domain: `userApi`, `proposalsApi`, `organizationsApi`, etc.) |
| Stripe webhook logic | `backend/server/webhookHandlers.ts` |
| Apple IAP webhook logic | `backend/server/iapWebhookHandlers.ts` |
| Verification flow | `backend/server/routes.ts` (search `/api/veriff` / `/api/didit`) + `app/modals/verification-payment.tsx` + `verification-unlock-checkout.tsx` |
| RCV tally | `backend/server/rcvTally.ts` |
| Profanity filter | `backend/server/profanityFilter.ts` |
| Org unlock fee logic | `backend/server/verificationUnlock.ts` |
| Audit log export | `backend/server/routes.ts` `GET /api/organizations/:orgId/audit-log` |
| Push notification fan-out | `backend/server/notifications.ts` |
| Theme colors | `lib/theme.ts` |
| Onboarding | `components/Onboarding.tsx` |
| Plan history (every architectural decision) | `/root/.claude/plans/ok-so-im-going-zany-melody.md` (NOT in the repo — it's in a Claude-only path) |

---

<a name="glossary"></a>
## 26. Glossary of terms

- **AAB** — Android App Bundle. Required upload format for Google Play.
- **ASC** — App Store Connect. Apple's developer dashboard.
- **Auto-renewable subscription** — Apple IAP type for recurring subscriptions.
- **Consumable** — Apple IAP type for one-time purchases that can be re-purchased (used for verification unlock fees).
- **Drizzle** — TypeScript ORM. Schema-first, generates types.
- **EAS** — Expo Application Services. Builds and submits the app.
- **HMAC** — keyed-hash message authentication code. Used for audit log row signatures.
- **IAP** — In-App Purchase. Apple's billing system.
- **IRV** — Instant-runoff voting. Tally algorithm for RCV.
- **KYC** — Know Your Customer. Identity verification.
- **Magic link** — one-time URL used for org invites (auth-less acceptance).
- **MRR** — monthly recurring revenue.
- **Neon** — serverless Postgres provider hosting our database.
- **Non-exempt encryption** — Apple's export-compliance question. We use HTTPS only, so set `ITSAppUsesNonExemptEncryption = false` to avoid annual review.
- **Onboarding** — first-launch tutorial in the app.
- **Passport NFT** — soulbound on-chain identity token minted on user verification.
- **RCV** — ranked-choice voting.
- **Replit** — where the backend is hosted. Web IDE + auto-deploy.
- **Resend** — transactional email provider.
- **Riding** — Canadian electoral district.
- **Riding QR code** — printable poster generating an on-chain riding-activation event when scanned.
- **Sentinel** — the AI governance-compliance feature.
- **TestFlight** — Apple's beta distribution for iOS.
- **Tier** — one of free/pro/plus/business/government/legacy. Drives all org features and limits.
- **UPDATE N** — incrementing chunks of the plan file documenting each architectural decision in order.
- **Veriff / Didit** — KYC vendors.
- **Verification unlock fee** — UPDATE 26's one-time tier-priced fee that lets an org require members to verify identity before voting.
- **Voter token** — ERC-20 token minted to a user's smart wallet when they vote.
- **Vendor data** — Veriff/Didit field used for log correlation (`userId|orgId`).
- **Watch-only proposal** — a proposal a user can see but can't vote on (e.g., another riding's proposal). Currently shows a lock badge in the bottom sheet.

---

<a name="todos"></a>
## 27. Known TODOs, gotchas, footguns

### Active (must address before App Store production submission)

- **Replit deploy of UPDATE 26 + UPDATE 27 backend** — pending. See `/root/.claude/plans/ok-so-im-going-zany-melody.md` UPDATE 27 for the consolidated Replit prompt.
- **`eas.json` Apple credentials** — empty strings, must populate.
- **App Store Connect IAP products** — 4 subscriptions + 3 consumables (UPDATE 26) need to be created. Display names + descriptions documented in the recent chat.
- **Stripe one-time price IDs** — three new products in Stripe Dashboard, IDs in Replit env.

### Soft gotchas

- **`expo-document-picker` requires native rebuild** after `npm install`. Easy to forget. Symptom: red `Cannot find native module 'ExpoDocumentPicker'` overlay on the import-roster screen. Fix: `npx expo run:ios --device`. (Plan file UPDATE 1.)
- **Sandbox Apple IDs are separate from real ones.** Don't sign into iOS Settings with a sandbox tester — only use it inside the in-app purchase prompt.
- **Stripe metered subscription_items** from UPDATE 24 may still exist on existing subscriptions even though UPDATE 26 stopped using them. Usage records stop posting; the line items zero out. Optional cleanup script if Stripe dashboard noise is annoying.
- **`organization_members.verificationBilledAt` and `organizations.verificationCount*`** columns are deprecated (UPDATE 26 superseded the metered model). Kept in DB for safety. Drop at next schema breakdown.
- **Veriff/Didit `vendor_data` parsing** still in code for log correlation, but no longer drives billing. If you want to clean it up, it's safe to remove.
- **No re-verification flow** — once `users.verified = true`, it stays true forever (until account deletion). If a user moves countries or a verification expires, no path to re-verify.
- **Push notification permission** is requested on first need, not on launch. Some users miss the prompt and never opt in. Consider adding a profile-screen "Enable notifications" prompt as a soft-pitch.

### Footguns

- **Don't `git push --force` on `main`.** Branch is `claude/continue-previous-session-ZdwLL` for the current submission cycle.
- **`drizzle-kit push` in production** can drop columns silently if you're not careful. Always preview with `drizzle-kit generate` first when adding migrations.
- **Bundle ID is locked** to `com.representwallet.app` on the App Store record. Don't change it anywhere — `app.json`, `Info.plist`, IAP product IDs.
- **App Store buildNumber must be unique per upload.** If you reject a build on TestFlight and rebuild, bump `buildNumber` in `app.json`.
- **Apple sandbox receipt validation** returns status 21007. If you don't fall back to the sandbox URL, all sandbox tests fail in production. Already handled in `routes.ts:5379-5450`.
- **Drizzle `.where(and(eq(...), eq(...)))` requires importing `and`** from `drizzle-orm`. Easy to forget; type error is misleading.
- **Stripe webhook signing** uses `STRIPE_WEBHOOK_SECRET`. Different from the secret key. Don't confuse them.

### Future enhancements worth tracking

- Per-org HMAC keys for audit log (today: single platform secret)
- Layered AI moderation (OpenAI Moderation, Perspective API)
- Admin moderation dashboard (today: email-driven)
- Re-verification flow for users who moved countries
- Reporter rate-limiting
- Refresh-on-focus for org-detail (today: pull-to-refresh only)
- Background mode for proposal-deadline alerts
- Discover tab return (UPDATE 9 / UPDATE 10 — pulled, would come back when activity floor justifies it)
- Granular org-admin permissions (today: binary admin/member; would be nice to have "moderator" role between)

---

## End of overview

If anything is unclear or out of date, the most authoritative live context is in the plan file at `/root/.claude/plans/ok-so-im-going-zany-melody.md` (28 UPDATEs in numerical order, each documenting a discrete architectural decision). When in doubt, search the plan file for the relevant feature name.

Welcome aboard.
