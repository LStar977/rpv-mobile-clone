# Design Brief: Represent Vote Landing Page (representvote.com)

You are designing the single most important conversion surface for Represent Vote,
an iOS app for identity-verified civic voting. Read this entire brief before
designing. Every section below includes final copy — use it verbatim unless a
layout constraint forces trimming.

## What the product is

Represent Vote verifies users' identities with government ID (passport/driver's
license via KYC), locates them from their documents (not GPS), and lets them vote
on civic proposals. Votes are recorded both in a database and on a public
blockchain, so tallies are independently auditable by anyone. Voting and
verification are free. The flagship campaign: a "Shadow Referendum" mirroring all
10 official questions on Alberta's real October 19, 2026 referendum — only
verified Albertans can vote, and the separation question requires verified
citizenship.

## Who lands on this page

1. An Albertan who tapped a shared proposal link or social post about the
   referendum (70% — mobile, politically engaged, skeptical of "another app")
2. Curious Canadians outside Alberta (20%)
3. Journalists, org decision-makers, investors (10% — desktop)

The page has ONE job: App Store install. Secondary: org contact.

## Brand system

- Background: pure black `#000000`
- Primary accent: warm gold `#D4A949` (hover/bright variant `#E0B25A`)
- Secondary: cream `#F2E6CC` — body text, the "warmth" that keeps black/gold
  from feeling like a casino or crypto site
- Muted text: `#8A8275`
- Success/live indicators: a restrained green only for "live" dots
- Typography: editorial serif for headlines (Fraunces or similar — civic,
  newspaper-masthead feel), clean sans for UI/body (Inter or similar)
- Logo: black circle with gold ring; gold adult hand raised with a smaller
  cream hand in front of it (two generations voting). Use sparingly — header
  and footer only.
- Overall feel: "The Economist meets election night" — editorial, serious,
  alive. NOT: crypto-glow, gradients-everywhere, SaaS-template, web3 vibes.
  No blockchain imagery (no cubes, chains, hexagons). The chain is mentioned
  in copy only.

## Page structure and final copy

### 1. Announcement bar (thin, top, gold background, black text)
> Alberta votes October 19. The Shadow Referendum is live now. ↓

### 2. Hero (full viewport)
- Eyebrow (small caps, gold): `LIVE · THE ALBERTA SHADOW REFERENDUM`
- H1 (serif, huge):
  > Alberta votes in {N} days.
  > Where do verified Albertans actually stand?
- Subhead (cream, max ~60ch):
  > All 10 official referendum questions are live on Represent — open only to
  > identity-verified Albertans. No bots. No brigading. No out-of-province
  > noise. One person, one vote, provable.
- Primary CTA (gold pill, black text): `Download on the App Store`
- Secondary CTA (ghost): `See the live results ↓`
- Visual: an iPhone mock showing the Q10 separation ballot with a live tally,
  OR a large live tally card for Q10 ("Remain: __% · Begin separation process:
  __%  ·  N verified ballots"). If live data isn't feasible, design the
  component to accept numbers via API later — do not fake specific numbers in
  shipped copy; use placeholder states.
- A countdown to October 19 is welcome if it stays elegant (small, mono digits).

### 3. Credibility strip (one line, muted, centered)
> Identity verified by government ID · Geo-located from documents, not GPS ·
> Every vote on a public ledger · Verification is free

### 4. The problem (editorial section, two columns on desktop)
- Eyebrow: `WHY THIS EXISTS`
- H2 (serif):
  > The biggest petition in Canadian history was dismissed in one news cycle.
- Body:
  > In December 2023, 386,698 people signed a parliamentary e-petition — the
  > largest in Canadian history. It changed nothing. Signatures only required
  > an email address, so critics could wave it away as bots, duplicates, and
  > foreign interference. Nobody could prove them wrong.
  >
  > That's the flaw in every petition, every online poll, every hashtag: the
  > moment a result matters, "it's all fake" ends the conversation.
  >
  > Represent makes that attack impossible. Every voter is verified against a
  > government document. Every vote is geo-located to a real riding. Every
  > tally can be audited by anyone — including the people who don't like the
  > result.
- Pull-quote styling encouraged on "the moment a result matters, 'it's all
  fake' ends the conversation."

### 5. How it works (3 steps, horizontal cards)
- H2: > Three minutes to a vote that counts.
1. **Verify once.** Scan your ID and take a selfie. Free, takes about two
   minutes, and your documents are never stored on our servers.
2. **Vote on what matters.** Proposals are gated to your verified location —
   your province's questions are decided by your province's people.
3. **Point to the proof.** Your vote becomes part of a public, tamper-proof
   tally that anyone can verify. Share it. Cite it. Defend it.

### 6. The Shadow Referendum (the centerpiece section)
- Eyebrow: `LIVE NOW · CLOSES OCTOBER 18`
- H2: > All ten questions. Verified voters only.
- Body intro (short):
  > The same questions Albertans will see on the official ballot — answered
  > early, in public, by verified citizens. When the official results come in
  > on October 19, compare them to ours.
- Layout: grid of 10 cards (2×5 desktop, stacked mobile). Each card: question
  number, short title, live support/oppose bar, verified-ballot count, and
  gold "CITIZENS ONLY" chip on Q5 and Q10. Q10 (separation) gets a full-width
  feature card at the top of the grid — it is the emotional core of the page.
- Each card links to its public page (representportal.com/p/{id}) — design
  cards as tappable.
- CTA under grid: `Cast your ballot — download Represent`

### 7. Trust & privacy (address the objection head-on)
- H2: > "Why would I give a voting app my ID?"
- Three short answers, can be accordion or cards:
  1. **We never see your documents the way you fear.** Verification is handled
     by a certified identity provider. We receive a yes/no and your verified
     region — not copies of your passport. A breach of our servers cannot leak
     documents we never hold.
  2. **Your vote is pseudonymous in public.** The public ledger shows that a
     verified Albertan voted — not your name. Identity and ballot are linked
     only enough to prevent fraud, never for display.
  3. **We will never sell your data or run political ads. Ever.** Our policy
     bans political advertising permanently. We make money from optional
     premium features and organization tools — not from you being the product.

### 8. For organizations (B2B, compact)
- Eyebrow: `UNIONS · ASSOCIATIONS · MUNICIPALITIES · PARTIES`
- H2: > Your members have opinions. Get proof.
- Body:
  > Run verified votes inside your organization — strike mandates, board
  > elections, member consultations, budget priorities. Identity-verified
  > membership, turnout you can defend, results no one can dispute.
- CTA (ghost): `Talk to us → hello@representvote.com`

### 9. Final CTA (full-width, centered, generous whitespace)
- H2 (serif, large): > Be counted. Provably.
- Sub: > Free to download. Free to verify. Free to vote.
- Gold App Store button. Under it, small: `iPhone today. Android soon.`

### 10. Footer
- Logo + one-liner: "Verified civic voice, built in Canada."
- Links: App Store · Privacy · Terms · Contact · For Organizations
- Fine print: "Represent is an independent civic platform. We are not
  affiliated with Elections Alberta or any government, party, or campaign.
  The Shadow Referendum is an unofficial, non-binding public opinion measure."
  (THIS DISCLAIMER IS LEGALLY IMPORTANT — must be present and legible.)

## Design directives

- Mobile-first. The 70% case is a phone tap from social. Hero must land its
  full message + CTA within the first viewport on a 390pt-wide screen.
- Fast. No heavy hero video, no WebGL requirement. Target instant first paint
  on cellular. Subtle motion only: tally bars animating on scroll-into-view,
  the live dot pulsing, gentle fade-ups. One page, no scroll-jacking.
- Numbers feel alive: tabular figures, counters that tick up on first view.
- The App Store CTA appears at minimum: hero, after the referendum grid, final
  section, and as a small sticky button on mobile after the user scrolls past
  the hero.
- Tone check for any copy you adjust: confident, plain, a little defiant.
  Never partisan — the page must read identically well to a separatist and a
  federalist. We are the referee, not a side. Audit every adjective for this.
- Accessibility: AA contrast minimum (gold-on-black passes for large text,
  check small text — lean on cream for body), focus states, reduced-motion
  respect.
- Deliver as a single responsive page. If you produce code, use semantic HTML
  with og: meta tags (title: "The Alberta Shadow Referendum — live verified
  results", description: "All 10 official referendum questions, answered by
  identity-verified Albertans. See where the province actually stands.").

## What to avoid (hard rules)

- No stock photos of crowds/flags/parliament. Abstract or product visuals only.
- No fabricated statistics or fake testimonials anywhere.
- No crypto/web3 visual language or jargon ("on-chain", "wallet", "token"
  must not appear; say "public ledger" once in §3 and §7 only).
- No partisan color-coding (no orange/blue/red political signaling).
- Don't bury the disclaimer in §10.
