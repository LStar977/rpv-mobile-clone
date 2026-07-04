# Represent — Full App Audit & Punch List

*Compiled from three parallel audits (mobile app, backend, release-readiness) plus issues already tracked in prior sessions. Date: 2026-07.*

> **Read this first — two scoping caveats:**
> 1. **The backend here is a partial snapshot** of the production Replit repo (imported as "22 of 25 files"; `routes.ts` may lag prod). Every backend finding must be **confirmed against the live Replit repo** before you act — some may already be fixed there. They are still listed because if they're live, they matter.
> 2. **Severity is about blast radius, not effort.** Many criticals are one-line fixes.

---

## TIER 0 — Security showstoppers (fix before ANY further production deploy)

These are account-takeover / fund-loss / vote-forgery class. Confirm in Replit first.

| # | Where | Problem | Fix |
|---|---|---|---|
| S1 | `backend replitAuth.ts:337` | **Apple login never verifies the token signature** — only decodes claims. Anyone can forge a token for any Apple user → full account takeover. (Mobile side C6 is the sibling: Google sign-in sends `accessToken` not `idToken`.) | Verify the JWS against Apple's JWKS before trusting any claim. Confirm Google verifies a real `idToken` server-side and derives identity only from it. |
| S2 | `backend routes.ts:2542` | **`GET /api/admin/toggle` has no auth** — `?userId=self` makes anyone a platform admin. | Delete the endpoint (it's a test backdoor) or gate behind `isAdmin`. |
| S3 | `backend routes.ts:1772` | **`POST /api/voting/geo-gated` is unauthenticated and trusts `userId` from the body** — cast votes as any user, bypassing every gate. | Add `isAuthenticated`, derive `userId` from the session, route through the `/api/voting/submit` gate stack, or remove it. |
| S4 | `backend base-network.ts:162` | **Custodial wallet private keys are derived from `userId` alone** (no server secret). `userId` is exposed in many API responses → anyone can recompute any user's private key offline. Moot today on testnet; **catastrophic the moment you flip to Base mainnet.** | Regenerate keys from a CSPRNG or HKDF(userId, server secret); rotate all existing keys. **Blocks mainnet.** |
| S5 | `mobile lib/auth.ts:181`, `backend`, `docs/HOW_IT_WORKS.md:622`, release #18 | **Demo password `RepresentDemo2024!` hardcoded in the shipped bundle** and published in docs. Anyone logs into `demo@represent.app`. | Make the demo login passwordless + server-gated + rate-limited; rotate the password; redact from shared docs. |

---

## TIER 1 — Blocks the next App Store update

Money-path correctness, silent vote corruption, and review-rejection risks in the mobile binary.

### Money paths (report success before money moves / wrong prices)
- **Org double-charge on retry** — `create-organization.tsx:201` creates the org *before* payment; a declined card + retry makes a second org. → Persist `organizationId`, skip re-create on retry.
- **"Downgrade to Free" is fake** — `organization-billing.tsx:274` + `payment.ts:93` return success with no backend call; Stripe keeps billing. → Route to real cancel endpoint or remove the option.
- **Org tier IAP SKU mismatch** — `payment.ts:105` + `iap.ts:16` map new tiers ($59/$179/$499) to legacy SKUs ($99/$299). StoreKit shows a price that contradicts the app → billing disputes + likely rejection. → Register/map real `org.pro/plus/business` SKUs.
- **Android premium "success" without payment** — `payment.ts:189` opens Stripe URL in browser, immediately returns `{success:true}`; receipt shows even if unpaid. → Return "pending", confirm via status poll (the unlock-checkout screen already does this correctly).
- **Fabricated receipts** — `receipt.tsx:109` invents `TXN-${Date.now()}`, defaults the amount, always claims "confirmation email sent"; price copy still shows retired $29/$99/$299 ladder in `stripe.ts:303` + `subscription.tsx:72`. → Require real params + real txn id; fix all price copy to the current ladder.

### Vote integrity (a voting app silently miscounting ballots)
- **Swipe submits binary vote on ranked/multi-choice proposals** — `proposals.tsx:1898` doesn't filter by `voteType`; swiping an RCV/MC card records a yes/no vote. → Exclude `voteType !== 'yes-no'` from the swipe deck (tap already routes correctly).
- **Swipe shows "confirmed" before the vote is validated/submitted** — `proposals.tsx:2229`; if the queued submit later fails, the vote is lost but the user saw success. → Validate `canVote()` before the animation; roll back on failure.
- **No re-entrancy guard on `handleVote`** — `proposals.tsx:2005`; double-tap spends two ballots. → `if (votingProposalId !== null) return;`.
- **Non-atomic tally counter (backend `storage-db.ts:289`)** — concurrent votes lose increments → public tally under-counts. → `set({ supportVotes: sql\`... + 1\` })`.

### Review-rejection risks
- **Sentinel (flagship AI feature) calls have no auth header** — `sentinel.tsx:1620`; either 401s for the reviewer's demo account or the paywall is client-only. → Attach bearer token / use the api wrapper.
- **Dead UI on flagship screens the reviewer will tap** — Sentinel "Archive ›", "Privacy notice" link, and an `UpgradeModal` that can never open (`sentinel.tsx:1825`). → Wire or remove.
- **UGC report flow broken on Android** — `ProposalModerationMenu.tsx:78` uses `keyboardWillShow/Hide` (iOS-only), hiding the Submit button behind the keyboard. Apple/Play require working moderation. → Use `keyboardDidShow/Hide` on Android.
- **App name shows "Represent Wallet"** — `Info.plist` `CFBundleDisplayName` + `app.json:3`; invites crypto-wallet review scrutiny the product avoids. → Set to "Represent Vote".
- **Verification WebView blank-screen / premature-close** — `veriff.tsx:204` renders with `sessionUrl` still undefined on the bootstrap path; completion detection uses loose substring match. → Show loader while retrying; match exact callback paths.
- **NSCameraUsageDescription says "Veriff"** (provider is Didit) — `app.json`. *(already tracked)* → Update the string.
- **Version/build drift** — `app.json buildNumber:"2"` vs native `Info.plist CFBundleVersion:"7"`; native wins in bare workflow. → Sync + bump for submission. *(bump already tracked)*

### Android store blockers (for the promised Android launch)
- **`eas.json:22` production `buildType:"apk"`** — Play requires AAB. → `"app-bundle"`.
- **Android manifest missing `CAMERA` permission** — Didit ID capture will fail. → Add it.

---

## TIER 2 — Blocks public launch (trust, legal, launch-day mechanics)

### The launch page's core mechanic doesn't work
- **Live tally endpoint doesn't exist** — `landing.js:198` fetches `/api/public/referendum-tallies`; no such route in the backend. Every tally on the launch page sits at "—" forever. → Implement it (contract is documented in `landing.js:119`) or point at a real results API. **This is the single biggest launch-day risk — the whole page is "here's the live count" and there is no count.**

### Legal / trust (a verified-voting app handing critics the "it's fake" attack)
- **Landing overstates privacy vs the policy** — landing says "we never see your documents / documents never stored"; `PRIVACY_POLICY.md:22` says Didit collects ID image, DOB, doc number, name, address. → Soften landing to match what's actually true.
- **"Verification is free" vs a live $4.99 paid path** — landing + `verification-payment.tsx` say free; `routes.ts:3528` still runs a Stripe verification checkout and advertises "$4.99" at `/api/stripe/pricing`. → Remove the paid path or stop claiming free. (Mobile receipt copy has the same drift.)
- **On-chain disclosure understated** — policy says only "yes/no global proposals" go on-chain; `routes.ts:939` puts *all non-org votes* on-chain incl. the Alberta-only multi-choice Q10. → Update PP §3.3 / TOS §9 / HOW_IT_WORKS to "all votes on public proposals."
- **Placeholder text in published legal docs** — `PRIVACY_POLICY.md:216` and `TERMS_OF_SERVICE.md:287` still have "[Insert street address]" / "[Insert DPO name]". → Fill in.
- **Privacy/Terms URLs may have no server behind them** — app + landing + share page link `representportal.com/privacy` and `/terms`; nothing in the backend snapshot serves them. Apple requires a working privacy URL. → Confirm the portal serves them; if not, add routes.
- **Landing claims not backed by code** — "comments come from verified voters" (comments only require auth, `routes.ts:5780`); "policy bans political advertising permanently" (no such clause exists). → Gate comments or soften; add the ad clause to TOS or cut it.
- **Retention contradiction** — PP §5 keeps ID records 7 years; HOW_IT_WORKS says 30-day Didit deletion + anonymize-on-delete. → Reconcile.

### Known launch-gating items (from prior sessions)
- **Document-number dedup** — one passport can currently verify unlimited accounts. One-person-one-vote is the entire pitch. → The dedup spec is already written; ship before launch.
- **Sepolia → Base mainnet** — votes currently anchor to testnet (throwaway). Backend `base-network.ts:396` hardcodes `chainId: 84532` so `BASE_NETWORK=mainnet` alone won't move them. → Flip after S4 (wallet keys) is fixed; fund deployer wallet; redeploy contract.
- **Remove temporary admin endpoints** — `cleanup-test-user`, `citizenshipVerified` bypass, and (newly found) `/api/admin/fix-mason-account` (no auth, hardcoded prod id). → Delete before launch.
- **Async-relay retry/backfill + Basescan audit URLs** — flagged during the browser-vote work.
- **Marketing kit domain/flow errors** — says "vote at representvote.com" (static landing, wrong domain) and treats `/p/:id` as a vote page. → Correct before the launch thread goes out.

---

## TIER 3 — Improvements (do soon; quality & correctness, not launch-gating)

### Systemic mobile pattern #1 — errors rendered as empty states
The `lib/api.ts` wrapper returns `{data, error}` and never throws, so every `catch` block is dead and every screen that ignores `.error` shows a backend outage as "nothing here." Affects: `proposals.tsx:1946` ("Be the first to create one!"), `groups.tsx:510`, `my-proposals.tsx:24`, `voting-history.tsx:103`, `badges.tsx:157`, `CommentsSection.tsx:55`. → Track `error`, render a retry state. **One pattern, ~6 screens.**

### Systemic mobile pattern #2 — premium detection is Stripe-only
`analytics.tsx:263` and `sentinel.tsx:1576` check only `/api/stripe/subscription`, which doesn't know about Apple IAP → paying iOS subscribers see "Sample Data — Upgrade" over real data. → Derive premium from `user.isPremium || subscriptionStatus==='active'` first (as `ballots.ts:144` correctly does).

### Backend reliability / correctness (confirm in Replit)
- **No global `unhandledRejection`/`uncaughtException` handlers** + fire-and-forget `notifyProposalVote` without `.catch` (`routes.ts:1045`) → a DB hiccup can crash the process. → Add `.catch` + global handlers.
- **On-chain vote double-submit race** (`routes.ts:940`) — two concurrent submits both relay on-chain before the unique constraint rejects. → Insert vote row first, then relay.
- **IAP verification receipt idempotency is per-user** (`routes.ts:5971`) — same Apple receipt replayable across accounts. → Global uniqueness on the Apple txn id.
- **Stripe refund/dispute doesn't downgrade subscriptions** (`webhookHandlers.ts:229`). → Downgrade on `charge.refunded`/`dispute.created`.
- **`JWT_SECRET = SESSION_SECRET`** (`replitAuth.ts:544`) — cookie key and API bearer key are the same secret. → Separate them.
- **Secrets/PII in logs** — OAuth tokens (`replitAuth.ts:149`), Veriff HMAC (`routes.ts:1881`), full Didit KYC decision incl. name/DOB (`routes.ts:199`). → Remove these debug logs.
- **`updateUser`/`upsertUser` write the whole row** (`storage-db.ts:155`) — a profile update racing a verification webhook clobbers fresh fields. → Column-scoped `set(updates)`.
- **Org proposal vote skips `requireMemberVerification`** (`routes.ts:5159`) — unverified members can vote where the org required verification. → Apply the gate.
- **Unauthed member-email leak** (`routes.ts:4743`) and **wallet IDOR** (`routes.ts:586`). → Require auth + ownership.
- **Non-atomic report-count** (`routes.ts:5686`) → auto-hide threshold under-counts. → Atomic increment.

### Mobile correctness / UX
- **Org invite-code "expires after / single use" controls are dead** (`organization-detail.tsx:1416`) — selection silently ignored; several org admin actions ignore `result.error`; Members tab is empty for non-admin members. → Pass options through, check errors, fetch members for all roles.
- **RCV/MC org votes routed through the global endpoint** (`org-proposal-detail.tsx:176`) — dashboard pending-ballot counter never decrements. → Route through `organizationsApi`.
- **Infinite spinner after RCV/MC vote if results fetch fails** (`proposal-detail.tsx:84`); reopening re-offers the ballot → duplicate-vote error. → Surface errors + persist voted state.
- **CSV roster import** (`import-roster.tsx`) — header-less CSV drops row 1; untrusted `role=admin` cell mints admins with no confirmation. → Header heuristic + confirm admin grants.
- **Social signup skips the Terms checkbox** (`index.tsx:1370`) email requires it, Google/Apple don't. → Gate social buttons on `acceptedTerms`.
- **Fabricated data shown to users** — hardcoded "Updated 2h ago", "Since Mar 2026", fabricated member-since/folio (`dashboard.tsx`, `profile.tsx`). → Derive from real timestamps or hide.
- **Admin gating is a hardcoded personal Gmail checked client-side** (`api.ts:38`, `admin.tsx:138`). → Server-returned role claim.

---

## TIER 4 — Nice-to-haves / hygiene
- Strip console logs of push token (`notifications.ts:49`), wallet balances (`rpv-token.ts:42`), tutorial spam.
- Sound system is a silent stub (`sounds.ts:83`) — wire assets or ship knowingly.
- `privacy.tsx:74` calls OAuth "Two-Factor Authentication" (false) — fix copy.
- `share.ts:10` hardcodes the `/ca/` App Store storefront.
- Hardcoded prod URLs bypass `EXPO_PUBLIC_API_URL` (`index.tsx:1156`, `sentinel.tsx:77`).
- Light-theme bugs where colors are hardcoded (`groups.tsx`, swipe container).
- Orphaned infinite `Animated.loop` burning battery (`badges.tsx:51`).
- `.env.example` documents 3 of ~45 env vars — add a backend section; move hardcoded Google OAuth IDs to env.
- **ASC App ID mismatch** — `eas.json:30` uses `6767985917`; every other file uses `6756912022`. Next `eas submit` could go to the wrong app record. → Confirm the real one and reconcile. *(Arguably Tier 1 — verify before the next submit.)*
- Delete legacy Stripe org-price env reads that coexist with new ones (`routes.ts`).
- Price copy drift across TOS / HOW_IT_WORKS / IAP list.

---

## What's genuinely in good shape

**Mobile:** tokens live only in SecureStore (nothing sensitive in AsyncStorage), no JWTs logged, careful auth hydration (optimistic render, abort timeout, don't-logout-on-5xx), mature IAP handling (double-init guard, superseded-purchase resolution, finish-transaction retry), and the Apple-compliance surface is largely done (IAP-only on iOS, 3.1.2 disclosures, Restore Purchases, Sign in with Apple, account deletion, seeded demo). All `router.push` targets resolve. The KYC WebView validates its URL against a host whitelist.

**Backend:** no SQL injection anywhere (Drizzle parameterization throughout), all webhook signatures properly verified (Stripe HMAC, Didit/Veriff timing-safe + replay window, Apple IAP JWS chain), strong money-path validation (re-fetch + assert price/amount/currency before crediting), a real DB unique-constraint backstop on votes plus atomic ballot consumption, AES-256-GCM key encryption at rest, keys never returned in responses, and the **primary `/api/voting/submit` path is well-built** — the gaps are in parallel/legacy endpoints, not the main flow.

The two dominant weaknesses are narrow and fixable: (1) `{data,error}` results whose `.error` is ignored, and (2) payment flows that report success before money moves. Fix those two patterns and the tracked launch items, and this is a defensible launch.
