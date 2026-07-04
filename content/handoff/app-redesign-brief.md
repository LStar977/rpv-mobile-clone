# Represent — Mobile App Redesign Brief (for Claude Design)

**Objective:** Design a brand-new UI/UX for the Represent mobile app. Keep the existing
color scheme exactly (locked below). Reinvent everything else — layout, information
architecture, components, typography, motion, and the emotional feel. I want a fresh,
cohesive, best-in-class civic product — not a reskin of the current screens.

Design for **iOS first** (iPhone, portrait, safe areas, notch/Dynamic Island), with layouts
that degrade cleanly to Android. Produce high-fidelity screen designs.

---

## 1. What Represent is (so the design has a soul)

Represent is a **verified-citizen civic voting platform**. Real people verify their
identity with government ID, then vote on public issues — from a national referendum
question down to a neighbourhood zoning decision. Every vote is one-person-one-vote,
enforced by identity, and recorded on a public, tamper-evident ledger. Organizations
(unions, associations, municipalities) run verified governance for their members on top
of the same rails.

The launch moment is **Alberta's October 19, 2026 referendum** — a "Shadow Referendum"
where verified Albertans answer all 10 official ballot questions and the count is
checkable against the real result.

**The emotional promise:** *"Your verified voice counts — and you can see the real count."*

### Who uses it
Ordinary citizens across the full spectrum: farmers, tradespeople, students, retirees,
urban professionals. Not tech-native, not crypto-native. The design must feel
**trustworthy, neutral, and effortless** — never partisan, never intimidating, never
"crypto."

### The three feelings every screen must earn
1. **Gravitas** — this is real civic infrastructure, not a poll app. Editorial,
   institutional, permanent. Think "digital ballot" and "public record," not "social feed."
2. **Trust** — verification, one-person-one-vote, and public auditability are the product.
   Surface trust signals constantly but calmly (a verified mark, "recorded on the public
   ledger," "1,247 verified ballots"). Numbers should feel *counted*, not *estimated*.
3. **Neutrality** — Represent is the referee, never a side. **Never use red-vs-blue or any
   partisan visual coding.** Support/oppose should read as neutral (gold/cream vs muted, or
   gold-fill vs outline) — never "red = bad." Audit every color choice against: *would this
   read identically well to a separatist and a federalist?*

### Anti-goals (do NOT make it feel like)
- A crypto wallet (no coin imagery, no "wallet" language in the UI, no gradients-on-black
  hype aesthetic, no token-price vibes) — even though there's an on-chain layer underneath.
- A social network (no like-counts-as-dopamine, no infinite doomscroll framing, no vanity
  metrics).
- A generic SaaS dashboard (no chart-junk, no purple-gradient startup look).

---

## 2. Color system — LOCKED (use these exact tokens)

Keep this palette. This is the one hard constraint. It is a **dark-first** system
("Obsidian Black + Sovereign Gold") with a warm light theme. **Design both themes** for
every screen — the app has a working light/dark toggle.

### Dark theme (primary)
```
Backgrounds
  background            #040707   (Obsidian Black — primary)
  backgroundElevated    #0A0D0D
  backgroundSecondary   #0F1212
Surfaces (cards, sheets, modals)
  surface               #141818
  surfaceElevated       #1A1F1F
  surfaceHighlight      #202626
Borders (hairlines)
  border                rgba(244,245,246,0.08)
  borderSubtle          rgba(244,245,246,0.05)
  borderStrong          rgba(244,245,246,0.12)
Text
  text / primary        #F4F5F6   (Civic White)
  textSecondary         #B8BABB
  textTertiary / muted  #7A7D7E
  textInverse           #040707   (text on gold)
Brand — Sovereign Gold
  gold                  #EABA58   (primary CTA / highlights)
  goldLight             #F0CB7A
  goldDark              #C99A38
  goldSurface           rgba(234,186,88,0.08)   (subtle tint fills)
  goldSurfaceStrong     rgba(234,186,88,0.15)
  gold gradient         #F0CB7A → #EABA58 → #C99A38
Semantic (use sparingly, never for partisan sides)
  success               #34D399   error #F87171   warning #FBBF24   info #60A5FA
Effects
  glass                 rgba(244,245,246,0.03–0.10)   overlay rgba(4,7,7,0.75)
  gradientHero          #141818 → #0A0D0D → #040707
```

### Light theme (secondary)
```
  background   #FAF8F5 (warm ivory)   backgroundElevated #FFFDF9   backgroundSecondary #F5F2ED
  gold stays the same family; on light use goldDark #C99A38 for text-on-light contrast
  text on light: near-black ink; keep the warm, institutional feel (NOT clinical white)
```

**Gold discipline:** gold is precious — it marks the single most important action or the
verified/counted state on a screen. Don't flood it. A screen with one gold moment reads as
premium; a screen with five reads as cheap.

---

## 3. Typography direction (ties the app to the brand's print materials)

The investor/brand materials use an **editorial serif + humanist sans + mono** trio. Carry
that into the app for brand cohesion — but you choose the exact families/weights:

- **Display / big civic moments** — a warm editorial **serif** (Fraunces / Tiempos /
  Georgia-class). Use for hero numbers, proposal titles, results, the "counted" moments.
  This is what gives gravitas and separates it from every other app.
- **UI / body / labels** — a clean **humanist geometric sans** (Onest / Inter-class). All
  functional text, buttons, nav.
- **Numbers / tallies / IDs / receipts** — a **monospace** (JetBrains Mono-class) with
  tabular figures. Every vote count, ballot ID, ledger hash, and timestamp uses mono — it's
  a recurring "this is a precise, recorded fact" signal.

Set a real type scale (e.g. display / h1 / h2 / body / caption / mono-data) and use it
consistently.

---

## 4. Design principles (the how)

- **The ballot is the hero.** Voting is the core loop — make casting a verified ballot feel
  deliberate, satisfying, and momentous (it's a civic act, not a swipe). The confirmation
  moment should feel like something *happened* and was *recorded*.
- **Show the count, always.** Live tallies are the payoff. Design a signature tally
  visualization (a horizontal proportion bar, gold-fill, mono numbers, "X verified ballots")
  and reuse it everywhere as a brand motif. It should read as authoritative — checkable,
  not vibes.
- **Trust is UI, not copy.** A verified checkmark, "recorded on the public ledger →" (tap to
  view proof), "one person · one ballot", geo/citizenship chips — these are components, used
  consistently. Make auditability *visible* (a "View on public record" affordance).
- **Calm density.** Civic content is text-heavy (ballot questions are long, verbatim). Design
  for readable long-form: generous line length, clear hierarchy, room to breathe. Not a
  cramped feed.
- **One clear action per screen.** Each screen has an obvious primary move. No ambiguity
  about what to do next, especially in onboarding and voting.
- **Progressive trust in onboarding.** Verification (government ID + selfie) is a big ask.
  The flow must explain *why*, reassure on privacy ("your documents aren't stored"), show
  progress, and never feel like a dead-end.
- **Motion with meaning.** Subtle, purposeful transitions (a ballot "sealing", a tally
  ticking up, a card committing). No gratuitous animation. Motion should reinforce
  "recorded / counted / verified."
- **Accessibility is civic.** High contrast, large tap targets, legible at Dynamic Type
  sizes, works for older users. This is a public utility — it must work for everyone.

---

## 5. Information architecture (propose the best structure)

The current app has 5 bottom tabs + ~21 modal screens — it's sprawling. **Rethink the IA.**
Consolidate into a clean primary navigation (aim for 4–5 tabs max) and organize the rest
into logical flows. A suggested structure to react to (improve it if you have a better idea):

- **Vote** (home) — the active proposals to act on + your civic snapshot
- **Results** — live tallies, the Shadow Referendum board, things you've voted on
- **Organizations** — groups you belong to / govern
- **Identity** (profile) — your verified civic identity card, badges, history, settings

Premium AI ("Sentinel"), creating proposals, and subscription live as flows off these tabs,
not as their own permanent tabs.

---

## 6. Screens to design

Design the **Core Set (1–13) first** — these are the product. Then the **Secondary Set** as
time allows. For each, I've given the *intent* — you design the actual UI.

### Core set
1. **Welcome / onboarding intro** — first launch. Sell the promise ("verified voice, real
   count"), set the neutral civic tone, lead into sign-in. 2–3 elegant intro panels max.
2. **Sign in / sign up** — email + Continue with Google + Continue with Apple. (Social
   buttons above an "or" divider; we already spec'd this — match that pattern.) Include the
   Terms consent moment.
3. **Identity verification flow** — the multi-step KYC journey: explain why → what you'll
   need → privacy reassurance → the government-ID + selfie capture handoff → success. This
   is the highest-stakes flow; make it feel safe and quick. Design the "verifying…" and
   "you're verified" states.
4. **Home / Vote** — the civic dashboard. Your verified status, the proposals open to *you*
   (gated by your real location/citizenship), a countdown to Oct 19, and a clear "start
   voting" entry. The first thing a verified citizen sees.
5. **Proposal feed / discovery** — browse proposals scoped to the user (their riding, city,
   country + the referendum slate). Filter/scope controls. Each card: title, scope chip,
   live tally, citizens-only badge where relevant, deadline. Must handle long titles.
6. **Proposal detail + yes/no vote** — the full ballot question (long, verbatim text),
   context, the current tally, and the act of voting Support / Oppose. Neutral framing.
   Design the pre-vote and post-vote states.
7. **Ranked-choice / multiple-choice ballot** — some proposals rank options or pick one of
   many. Design a distinct, clear ballot interaction for this (drag-to-rank and/or select).
   Must be unmistakably different from the yes/no flow so no one miscasts.
8. **Vote confirmation & receipt** — the momentous "your ballot is recorded" screen. Show it
   was counted, give a ballot receipt (mono ID + timestamp), and a "View on public ledger →"
   proof affordance. Then the handoff: "keep voting" / see results. This is the emotional peak.
9. **Results / live tally** — the payoff screen. A single proposal's full results with the
   signature tally viz, total verified ballots, breakdowns (e.g. by region/age where
   available), open/closed status, and — for the referendum — the checkable-against-official
   angle. Also design a **Shadow Referendum board**: all 10 questions at a glance.
10. **Identity / profile** — the user's **verified civic identity card** (the centerpiece: a
    tasteful, passport/press-pass-like credential showing verified status, region,
    citizenship, member-since — NOT a crypto wallet). Plus civic stats, **badges** (civic
    achievements), voting history, and settings entry.
11. **Organizations hub + organization detail** — groups the user belongs to or governs.
    Org detail: members, the org's proposals, announcements, admin controls, invite flow.
    Design the member view and the admin view.
12. **Create a proposal** — compose a proposal: question, description, scope (geography),
    vote type (yes-no / ranked / multi), citizens-only toggle, deadline. Make a
    potentially-daunting form feel guided and confident.
13. **Premium (Sentinel AI) + subscription/paywall** — the premium AI civic-analysis feature
    and the upgrade screen. Design the paywall to feel like unlocking civic superpowers
    (deeper analysis, monitoring), respecting Apple IAP conventions (clear price, terms,
    restore). Individuals-first framing (personal subscription is the core; orgs are clients).

### Secondary set
14. **Settings** — theme toggle, notifications, account, privacy, legal links, sign out,
    delete account.
15. **Notifications** — proposal closing soon, results in, org announcements. Civic, not spammy.
16. **Voting history** — the record of everything the user has voted on, with outcomes.
17. **Community / all proposals** — the broader discovery surface beyond the user's scope.
18. **Organization billing & plans** — org admin subscription management.
19. **Roster import (org admin)** — CSV member import flow.
20. **Analytics dashboard (premium)** — a citizen's civic analytics; keep it clean and
    non-junky.
21. **Legal / privacy content** — readable long-form policy screens.
22. **Empty, loading, and error states** — design the *system*: skeleton loaders (using the
    shimmer tokens), empty states with a clear next action (never a dead end), and honest
    error/retry states (a network failure must look like a failure, not "nothing here").

---

## 7. Global components to define (a real design system)

Design these as reusable components with consistent behavior, in both themes:

- **Buttons** — primary (gold), secondary (surface + hairline), ghost/text, destructive.
  States: default / pressed / disabled / loading.
- **The tally bar** — the signature results viz (proportion fill + mono counts + label).
- **Verified badge / trust chips** — verified mark, citizens-only, scope (region), "on the
  public ledger", one-person-one-vote.
- **Proposal card** — the workhorse; one design that handles yes-no, ranked, and multi.
- **The civic identity card** — the credential centerpiece (used on profile + share).
- **Inputs & forms** — text fields, toggles, selectors, the scope/geography picker, drag-to-rank.
- **Segmented control / tabs** (e.g. Log in / Sign up, filters).
- **Bottom sheets & modals** — the app is modal-heavy; design a consistent sheet system.
- **Bottom tab bar** — the primary nav, glassy over obsidian.
- **Countdown** — days-to-Oct-19 element (used on home + referendum board).
- **Receipt / ledger-proof** — the mono ID + timestamp + "view on record" pattern.
- **Badges** — the civic-achievement visual language.
- **Toasts / inline alerts** — success/error, calm and civic.

---

## 8. Deliverables

- High-fidelity designs for the **Core Set (screens 1–13)** at minimum, then the Secondary
  Set. Both **dark (primary) and light** themes.
- The **global component system** (section 7) shown as a components/style page.
- A short **type + color spec** page confirming the locked palette and your chosen type scale.
- Design at iPhone dimensions (e.g. 393×852 / iPhone 15-class), portrait, respecting safe
  areas and the tab bar.
- Keep it self-contained and brand-cohesive — every screen should look like it belongs to
  the same confident, institutional, gold-on-obsidian civic product.

**The bar:** when a verified Albertan opens this on October 19 to cast their ballot and
watch the real count come in, it should feel like they're using the most trustworthy,
beautifully-made civic tool they've ever touched — and nothing about it should feel like a
startup, a crypto app, or a social feed.
