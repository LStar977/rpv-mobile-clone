const pptxgen = require('pptxgenjs');
const fs = require('fs');

// ── Brand ────────────────────────────────────────────────────────────────────
// Obsidian + Sovereign Gold (the app) alternating with the National Ledger
// ivory palette (representvote.com). Both are Represent's real palettes.
const INK      = '040707';  // obsidian
const INK_CARD = '141818';
const INK_EDGE = '23292A';
const GOLD     = 'EABA58';
const GOLD_DK  = 'C99A38';
const WHITE    = 'F4F5F6';
const GREY     = 'B8BABB';
const GREY_DIM = '7A7D7E';

const IVORY    = 'FAF8F5';
const IVORY_CD = 'F2EEE7';
const IVORY_ED = 'DED7CB';
const DARKINK  = '181510';
const MUTED    = '6B655C';

const SERIF = 'Cambria';   // stands in for Newsreader
const SANS  = 'Calibri';   // stands in for Onest
const MONO  = 'Courier New';

const W = 13.333, H = 7.5, M = 0.75;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Lance Morrison';
pres.company = 'Represent';
pres.title = 'Represent — Investment Proposal';

const ICON = 'image/png;base64,' +
  fs.readFileSync(__dirname + '/icon.png').toString('base64');

// ── Helpers ──────────────────────────────────────────────────────────────────

const darkSlide = () => {
  const s = pres.addSlide();
  s.background = { color: INK };
  return s;
};

const lightSlide = () => {
  const s = pres.addSlide();
  s.background = { color: IVORY };
  return s;
};

/** Small-caps eyebrow label. */
const eyebrow = (s, text, y, color) =>
  s.addText(text.toUpperCase(), {
    x: M, y, w: 8, h: 0.28,
    fontFace: SANS, fontSize: 11, bold: true, charSpacing: 3,
    color: color || GOLD, margin: 0,
  });

/** Slide title. No underline rules — whitespace does the work. */
const title = (s, text, opts = {}) =>
  s.addText(text, {
    x: M, y: opts.y ?? 1.0, w: opts.w ?? 11.5, h: opts.h ?? 1.0,
    fontFace: SERIF, fontSize: opts.size ?? 38, color: opts.color ?? WHITE,
    margin: 0, valign: 'top', lineSpacing: opts.lineSpacing,
  });

/** The threshold-dot motif: n filled of total. */
const dots = (s, x, y, total, filled, size, gap, onDark) => {
  for (let i = 0; i < total; i++) {
    s.addShape(pres.ShapeType.ellipse, {
      x: x + i * (size + gap), y, w: size, h: size,
      fill: { color: i < filled ? GOLD : (onDark ? '2A2F2F' : IVORY_ED) },
      line: { type: 'none' },
    });
  }
};

/** Numbered gold disc used for process steps. */
const stepDisc = (s, x, y, n, onDark) => {
  s.addShape(pres.ShapeType.ellipse, {
    x, y, w: 0.52, h: 0.52,
    fill: { color: onDark ? '1F1B12' : IVORY_CD },
    line: { color: GOLD, width: 1 },
  });
  s.addText(String(n), {
    x, y, w: 0.52, h: 0.52,
    fontFace: SANS, fontSize: 15, bold: true,
    color: onDark ? GOLD : GOLD_DK,
    align: 'center', valign: 'middle', margin: 0,
  });
};

const card = (s, x, y, w, h, onDark) =>
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: onDark ? INK_CARD : IVORY_CD },
    line: { color: onDark ? INK_EDGE : IVORY_ED, width: 1 },
  });

const footer = (s, n, onDark) => {
  s.addText('REPRESENT', {
    x: M, y: H - 0.52, w: 3, h: 0.25,
    fontFace: SANS, fontSize: 8.5, bold: true, charSpacing: 2.5,
    color: onDark ? GREY_DIM : MUTED, margin: 0,
  });
  s.addText(String(n), {
    x: W - M - 1, y: H - 0.52, w: 1, h: 0.25,
    fontFace: SANS, fontSize: 8.5, color: onDark ? GREY_DIM : MUTED,
    align: 'right', margin: 0,
  });
};

// ═════════════════════════════════════════════════════════════════════════════
// 1 — Title
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide();
  s.addImage({ data: ICON, x: M, y: 1.45, w: 1.15, h: 1.15 });

  s.addText('REPRESENT', {
    x: M, y: 2.95, w: 11, h: 0.95,
    fontFace: SERIF, fontSize: 54, bold: true, charSpacing: 11,
    color: WHITE, margin: 0,
  });

  s.addText('The infrastructure layer for verified public consensus.', {
    x: M, y: 3.95, w: 10, h: 0.5,
    fontFace: SERIF, fontSize: 22, italic: true, color: GOLD, margin: 0,
  });

  dots(s, M, 4.75, 25, 7, 0.13, 0.075, true);

  s.addText('One verified human · one vote · sealed on a public ledger', {
    x: M, y: 5.15, w: 10, h: 0.3,
    fontFace: SANS, fontSize: 11.5, charSpacing: 1.6, color: GREY_DIM, margin: 0,
  });

  s.addText(
    [
      { text: 'Investment proposal', options: { bold: true, color: WHITE } },
      { text: '   ·   Prepared for Phil   ·   Confidential', options: { color: GREY_DIM } },
    ],
    { x: M, y: 6.35, w: 8, h: 0.3, fontFace: SANS, fontSize: 12, margin: 0 }
  );
  s.addText('Lance Morrison, Founder', {
    x: W - M - 4, y: 6.35, w: 4, h: 0.3,
    fontFace: SANS, fontSize: 12, color: GREY, align: 'right', margin: 0,
  });

  s.addNotes(
    'Open with the one line: today there is no way to prove that an online expression of ' +
    'public opinion came from real, distinct people. Represent is the infrastructure that fixes that. ' +
    'The product is already built and live — this raise funds getting users onto it.'
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 — The problem
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide();
  eyebrow(s, 'The problem', 0.62);
  title(s, 'Nobody can prove who\nactually voted.', { y: 1.0, h: 1.7, lineSpacing: 44 });

  s.addText('386,698', {
    x: M, y: 2.95, w: 5.2, h: 1.0,
    fontFace: SERIF, fontSize: 66, bold: true, color: GOLD, margin: 0,
  });
  s.addText('signatures on the largest petition in Canadian history — dismissed in a single news cycle.', {
    x: M, y: 3.95, w: 5.2, h: 0.9,
    fontFace: SANS, fontSize: 13.5, color: GREY, margin: 0,
  });
  s.addText('Not because the cause was wrong. Because no one could prove the signers were real people.', {
    x: M, y: 4.9, w: 5.2, h: 0.9,
    fontFace: SERIF, fontSize: 15, italic: true, color: WHITE, margin: 0,
  });

  const items = [
    ['Bots', 'Ten thousand plausible accounts now cost almost nothing to generate.'],
    ['Duplicates', 'One motivated person can vote fifty times and no system catches it.'],
    ['Outsiders', 'Nothing ties an opinion about a place to someone who lives there.'],
  ];
  items.forEach(([h, b], i) => {
    const y = 2.95 + i * 1.18;
    card(s, 6.75, y, 5.8, 1.0, true);
    s.addText(h, {
      x: 7.05, y: y + 0.13, w: 5.2, h: 0.3,
      fontFace: SANS, fontSize: 14, bold: true, color: GOLD, margin: 0,
    });
    s.addText(b, {
      x: 7.05, y: y + 0.44, w: 5.3, h: 0.5,
      fontFace: SANS, fontSize: 11.5, color: GREY, margin: 0,
    });
  });

  footer(s, 2, true);
  s.addNotes('The petition is the clearest proof the problem is real and expensive. ' +
    'Every online consultation, poll and petition has the same flaw.');
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 — Why now
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide();
  eyebrow(s, 'Why now', 0.62);
  title(s, 'Three things changed at once.', { y: 1.0 });

  const rows = [
    ['AI made fake consensus free.',
     'Generating thousands of convincing accounts, comments and signatures went from expensive to trivial. Every unverified number online is now suspect by default.'],
    ['Institutions stopped listening to digital input.',
     'Petitions, consultations and online polls are routinely discarded — not out of malice, but because no official can defend a number they cannot verify.'],
    ['Identity verification finally got cheap.',
     'A government-ID check with liveness detection now costs under $0.35 and takes about three minutes. Five years ago this product was not economically possible.'],
  ];

  rows.forEach(([h, b], i) => {
    const y = 2.15 + i * 1.45;
    stepDisc(s, M, y, i + 1, true);
    s.addText(h, {
      x: M + 0.85, y: y - 0.02, w: 11, h: 0.35,
      fontFace: SERIF, fontSize: 20, color: WHITE, margin: 0,
    });
    s.addText(b, {
      x: M + 0.85, y: y + 0.38, w: 11.2, h: 0.7,
      fontFace: SANS, fontSize: 12.5, color: GREY, margin: 0,
    });
  });

  footer(s, 3, true);
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 — What Represent is
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'The product', 0.62, GOLD_DK);
  title(s, 'One verified human. One vote.', { y: 1.0, color: DARKINK });

  s.addText('Represent is a civic voting platform where every participant has passed a government-ID check, and every ballot is written to a public ledger anyone can audit.', {
    x: M, y: 1.95, w: 11.5, h: 0.6,
    fontFace: SANS, fontSize: 14, color: MUTED, margin: 0,
  });

  const pillars = [
    ['Verified identity',
     'Government ID plus a liveness check, through a certified provider. Location comes from the document itself — not a dropdown, not GPS.',
     'We never store the documents.'],
    ['Sealed until 25',
     'No result is visible until 25 verified ballots are cast. Early voters cannot be influenced by a running tally, and nobody can spin a result from the first three votes.',
     'A rule competitors will not copy.'],
    ['Public ledger',
     'Every ballot is written to a public blockchain as well as our database. Anyone can audit the count independently. We cannot quietly change a result.',
     'Auditable by anyone, editable by no one.'],
  ];

  pillars.forEach(([h, b, k], i) => {
    const x = M + i * 4.03;
    card(s, x, 2.75, 3.75, 3.05, false);
    dots(s, x + 0.3, 3.05, 5, i + 1, 0.13, 0.08, false);
    s.addText(h, {
      x: x + 0.3, y: 3.35, w: 3.2, h: 0.35,
      fontFace: SERIF, fontSize: 19, bold: true, color: DARKINK, margin: 0,
    });
    s.addText(b, {
      x: x + 0.3, y: 3.78, w: 3.2, h: 1.7,
      fontFace: SANS, fontSize: 12, color: MUTED, margin: 0,
    });
    s.addText(k, {
      x: x + 0.3, y: 5.15, w: 3.2, h: 0.45,
      fontFace: SERIF, fontSize: 12, italic: true, color: GOLD_DK, margin: 0,
    });
  });

  footer(s, 4, false);
}

// ═════════════════════════════════════════════════════════════════════════════
// 5 — Already built
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'Status', 0.62, GOLD_DK);
  title(s, 'This is not a plan to build a product.', { y: 1.0, color: DARKINK });

  const built = [
    ['iOS app — live on the App Store', 'Verification, location-gated voting, discussion, subscriptions.'],
    ['Identity verification — operational', 'Government ID plus liveness, via a certified KYC provider.'],
    ['Public ledger — running', 'Ballots written on-chain and independently auditable.'],
    ['Organization tools — built', 'Private verified voting, member rosters, invite codes, analytics.'],
    ['Public record website — live', 'Every published result, with its methodology, at representvote.com.'],
  ];

  built.forEach(([h, b], i) => {
    const y = 2.05 + i * 0.85;
    s.addShape(pres.ShapeType.ellipse, {
      x: M, y: y + 0.05, w: 0.28, h: 0.28,
      fill: { color: GOLD }, line: { type: 'none' },
    });
    s.addText(h, {
      x: M + 0.5, y, w: 7.2, h: 0.32,
      fontFace: SANS, fontSize: 14.5, bold: true, color: DARKINK, margin: 0,
    });
    s.addText(b, {
      x: M + 0.5, y: y + 0.32, w: 7.4, h: 0.32,
      fontFace: SANS, fontSize: 11.5, color: MUTED, margin: 0,
    });
  });

  card(s, 9.1, 2.05, 3.45, 3.35, false);
  s.addText('$125', {
    x: 9.35, y: 2.4, w: 3, h: 0.85,
    fontFace: SERIF, fontSize: 52, bold: true, color: GOLD_DK, margin: 0,
  });
  s.addText('per month', {
    x: 9.35, y: 3.25, w: 3, h: 0.3,
    fontFace: SANS, fontSize: 13, bold: true, color: DARKINK, margin: 0,
  });
  s.addText('Total cost to run everything above. Two founders build and operate all of it — no staff, no office, no agencies.', {
    x: 9.35, y: 3.65, w: 2.95, h: 1.4,
    fontFace: SANS, fontSize: 12, color: MUTED, margin: 0,
  });

  footer(s, 5, false);
  s.addNotes('The point of this slide: the technical risk is already retired. ' +
    'The money is not being asked for to find out whether this can be built.');
}

// ═════════════════════════════════════════════════════════════════════════════
// 6 — How it works
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'How it works', 0.62, GOLD_DK);
  title(s, 'Four steps, one rule.', { y: 1.0, color: DARKINK });

  const steps = [
    ['Verify once', 'A government ID and a liveness check, about three minutes. Free to the user — we absorb the cost.'],
    ['Vote', 'One ballot per verified person per question. Duplicate accounts are impossible by construction.'],
    ['Sealed until 25', 'The tally stays hidden until 25 verified ballots exist. No bandwagon, no early spin.'],
    ['Published', 'The result and its ledger entry go public — auditable by anyone, editable by no one.'],
  ];

  steps.forEach(([h, b], i) => {
    const x = M + i * 3.05;
    stepDisc(s, x, 2.15, i + 1, false);
    s.addText(h, {
      x, y: 2.85, w: 2.7, h: 0.35,
      fontFace: SERIF, fontSize: 19, bold: true, color: DARKINK, margin: 0,
    });
    s.addText(b, {
      x, y: 3.28, w: 2.75, h: 1.4,
      fontFace: SANS, fontSize: 12, color: MUTED, margin: 0,
    });
  });

  card(s, M, 4.95, 11.83, 1.45, false);
  dots(s, 1.05, 5.32, 25, 7, 0.19, 0.115, false);
  s.addText('7 of 25 ballots — tally stays sealed', {
    x: 1.05, y: 5.7, w: 6, h: 0.35,
    fontFace: SANS, fontSize: 12.5, bold: true, color: GOLD_DK, margin: 0,
  });
  s.addText('The threshold is the product. It is why a Represent number can be quoted and a poll number cannot.', {
    x: 7.4, y: 5.42, w: 5.1, h: 0.7,
    fontFace: SERIF, fontSize: 13, italic: true, color: DARKINK, margin: 0,
  });

  footer(s, 6, false);
}

// ═════════════════════════════════════════════════════════════════════════════
// 7 — The moat
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide();
  eyebrow(s, 'Defensibility', 0.62);
  title(s, 'Why this is hard to copy.', { y: 1.0 });

  const moat = [
    ['Identity costs real money', 'Every verified user costs us a KYC fee. An ad-funded platform cannot absorb that per head — their economics depend on accounts being free and unlimited.'],
    ['The ledger has to be there from day one', 'Auditability cannot be bolted on. A platform that has already published unverifiable numbers cannot retroactively make them provable.'],
    ['The threshold hurts engagement on purpose', 'Hiding results until 25 ballots is bad for short-term metrics. A company optimising for engagement will not ship it.'],
    ['Two-sided by design', 'Consumer trust makes the B2B product credible; B2B revenue pays for consumer verification. Neither side works alone.'],
  ];

  moat.forEach(([h, b], i) => {
    const x = M + (i % 2) * 6.05;
    const y = 2.1 + Math.floor(i / 2) * 2.15;
    card(s, x, y, 5.8, 1.9, true);
    s.addText(h, {
      x: x + 0.32, y: y + 0.22, w: 5.2, h: 0.55,
      fontFace: SERIF, fontSize: 17, bold: true, color: GOLD, margin: 0,
    });
    s.addText(b, {
      x: x + 0.32, y: y + 0.7, w: 5.25, h: 1.05,
      fontFace: SANS, fontSize: 11.5, color: GREY, margin: 0,
    });
  });

  footer(s, 7, true);
}

// ═════════════════════════════════════════════════════════════════════════════
// 8 — Business model
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'Business model', 0.62, GOLD_DK);
  title(s, 'Organizations pay. Citizens never do.', { y: 1.0, color: DARKINK });

  s.addText('Unions, associations, boards and municipalities run verified internal votes — ratifications, elections, member consultations — on the same rails.', {
    x: M, y: 1.92, w: 11.5, h: 0.55,
    fontFace: SANS, fontSize: 13.5, color: MUTED, margin: 0,
  });

  const tiers = [
    ['Free', '$0', 'Up to 25 members'],
    ['Pro', '$59', 'Up to 250 members'],
    ['Plus', '$179', 'Up to 1,000 members'],
    ['Business', '$499', 'Up to 5,000 members'],
    ['Government', 'Contact', 'Unlimited members'],
  ];

  tiers.forEach(([name, price, cap], i) => {
    const x = M + i * 2.42;
    const feature = i >= 1 && i <= 3;
    card(s, x, 2.7, 2.2, 2.35, false);
    s.addText(name.toUpperCase(), {
      x: x + 0.22, y: 2.92, w: 1.8, h: 0.28,
      fontFace: SANS, fontSize: 10.5, bold: true, charSpacing: 2,
      color: feature ? GOLD_DK : MUTED, margin: 0,
    });
    s.addText(price, {
      x: x + 0.22, y: 3.25, w: 1.85, h: 0.7,
      fontFace: SERIF, fontSize: price === 'Contact' ? 24 : 38, bold: true,
      color: DARKINK, margin: 0,
    });
    s.addText(price === 'Contact' ? 'sales' : 'per month', {
      x: x + 0.22, y: 3.98, w: 1.8, h: 0.25,
      fontFace: SANS, fontSize: 10, color: MUTED, margin: 0,
    });
    s.addText(cap, {
      x: x + 0.22, y: 4.35, w: 1.8, h: 0.5,
      fontFace: SANS, fontSize: 11.5, bold: true, color: DARKINK, margin: 0,
    });
  });

  card(s, M, 5.3, 11.83, 1.05, false);
  s.addText(
    [
      { text: 'Verification unlock — ', options: { bold: true, color: DARKINK } },
      { text: 'an org that requires verified members pays a one-time fee ($199 / $499 / $999 by tier) that covers its members\' ID checks. ', options: { color: MUTED } },
      { text: 'B2B revenue subsidises B2C verification.', options: { bold: true, color: GOLD_DK } },
    ],
    { x: 1.05, y: 5.52, w: 11.2, h: 0.65, fontFace: SANS, fontSize: 12.5, margin: 0 }
  );

  footer(s, 8, false);
}

// ═════════════════════════════════════════════════════════════════════════════
// 9 — Unit economics
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'Unit economics', 0.62, GOLD_DK);
  title(s, 'The cost of a verified human.', { y: 1.0, color: DARKINK });

  const stats = [
    ['$0.35', 'maximum KYC cost', 'What a government-ID and liveness check costs us, per verified user. We treat it as acquisition cost and never charge the user.'],
    ['~$14', 'target blended CAC', 'Paid social runs $20–25 per verified user; organic, referral and the share loop pull the blend down. Reported weekly by channel.'],
    ['$125', 'monthly run rate', 'Everything currently costs $125/month to operate. There is no burn to unwind and no legacy cost structure.'],
  ];

  stats.forEach(([n, label, body], i) => {
    const x = M + i * 4.03;
    card(s, x, 2.15, 3.75, 3.4, false);
    s.addText(n, {
      x: x + 0.3, y: 2.45, w: 3.2, h: 0.95,
      fontFace: SERIF, fontSize: 48, bold: true, color: GOLD_DK, margin: 0,
    });
    s.addText(label, {
      x: x + 0.3, y: 3.42, w: 3.2, h: 0.3,
      fontFace: SANS, fontSize: 13, bold: true, color: DARKINK, margin: 0,
    });
    s.addText(body, {
      x: x + 0.3, y: 3.7, w: 3.2, h: 1.6,
      fontFace: SANS, fontSize: 11.5, color: MUTED, margin: 0,
    });
  });

  s.addText('A verified, geo-located, civically engaged user for under $15 is the cheapest acquisition in the funnel — and it is a user no competitor can claim to have.', {
    x: M, y: 5.85, w: 11.6, h: 0.6,
    fontFace: SERIF, fontSize: 14, italic: true, color: DARKINK, margin: 0,
  });

  footer(s, 9, false);
}

// ═════════════════════════════════════════════════════════════════════════════
// 10 — Where we are today (the honest slide)
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide();
  eyebrow(s, 'Traction', 0.62);
  title(s, 'Where we are today.', { y: 1.0 });

  s.addText('Built and shipped', {
    x: M, y: 2.0, w: 5.5, h: 0.3,
    fontFace: SANS, fontSize: 12, bold: true, charSpacing: 2, color: GOLD, margin: 0,
  });
  s.addText(
    [
      { text: 'iOS app live on the App Store (v2.1 live, v2.2 in review)', options: { bullet: true, breakLine: true } },
      { text: 'Identity verification operational end to end', options: { bullet: true, breakLine: true } },
      { text: '100+ ballots cast and written to the public ledger', options: { bullet: true, breakLine: true } },
      { text: 'Organization tools in use — invites, rosters, private ballots', options: { bullet: true, breakLine: true } },
      { text: 'Operating at $125/month, no outside capital to date', options: { bullet: true } },
    ],
    {
      x: M, y: 2.42, w: 5.6, h: 2.3,
      fontFace: SANS, fontSize: 13, color: GREY, margin: 0, paraSpaceAfter: 8,
    }
  );

  card(s, 6.75, 1.95, 5.8, 2.85, true);
  s.addText('Not yet done', {
    x: 7.05, y: 2.2, w: 5, h: 0.3,
    fontFace: SANS, fontSize: 12, bold: true, charSpacing: 2, color: GOLD, margin: 0,
  });
  s.addText('User acquisition has not started.', {
    x: 7.05, y: 2.6, w: 5.2, h: 0.45,
    fontFace: SERIF, fontSize: 22, bold: true, color: WHITE, margin: 0,
  });
  s.addText('No advertising has run. No campaign has launched. The user base today is the founders, friends and early testers — and we are not going to dress that up as traction.', {
    x: 7.05, y: 3.15, w: 5.2, h: 1.1,
    fontFace: SANS, fontSize: 12, color: GREY, margin: 0,
  });
  s.addText('That is precisely what this raise is for.', {
    x: 7.05, y: 4.28, w: 5.2, h: 0.35,
    fontFace: SERIF, fontSize: 13.5, italic: true, color: GOLD, margin: 0,
  });

  card(s, M, 5.05, 11.83, 1.35, true);
  s.addText(
    [
      { text: 'The structure protects you: ', options: { bold: true, color: WHITE } },
      { text: 'only $50,000 is released before 200 real verified users are proven. Every stage after that is gated on the previous stage\'s targets being met and independently verified.', options: { color: GREY } },
    ],
    { x: 1.05, y: 5.35, w: 11.2, h: 0.85, fontFace: SANS, fontSize: 13, margin: 0 }
  );

  footer(s, 10, true);
  s.addNotes('Do not oversell this slide. Its credibility is the point — it is what makes ' +
    'every other number in the deck believable. Confirm the ballot count before sending.');
}

// ═════════════════════════════════════════════════════════════════════════════
// 11 — The plan
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'The plan', 0.62, GOLD_DK);
  title(s, 'Six stages. Every one gated on verified users.', { y: 1.0, color: DARKINK });

  const rows = [
    ['At signing', 'Activate — incorporation, compliance, first campaigns', '$50,000', '200'],
    ['Stage 1', 'Prove — scale the channels that worked', '$50,000', '1,000'],
    ['Stage 2', 'Sprint — paid acquisition at full weight', '$150,000', '3,500'],
    ['Stage 3', 'Retention — the public record becomes the draw', '$200,000', '10,000'],
    ['Stage 4', 'Government & institutional expansion', '$250,000', '20,000'],
    ['Stage 5', 'Revenue & scale — first hire, Series Seed prep', '$300,000', '35,000'],
  ];

  const head = ['', '', 'Released', 'Verified users'];
  const cols = [M, 2.65, 8.75, 10.75];
  const widths = [1.8, 6.0, 1.9, 1.9];

  head.forEach((h, i) => {
    if (!h) return;
    s.addText(h.toUpperCase(), {
      x: cols[i], y: 1.95, w: widths[i], h: 0.28,
      fontFace: SANS, fontSize: 10, bold: true, charSpacing: 1.8, color: MUTED, margin: 0,
    });
  });

  rows.forEach((r, i) => {
    const y = 2.32 + i * 0.63;
    if (i % 2 === 0) {
      s.addShape(pres.ShapeType.rect, {
        x: M - 0.15, y: y - 0.08, w: 11.95, h: 0.58,
        fill: { color: IVORY_CD }, line: { type: 'none' },
      });
    }
    s.addText(r[0], {
      x: cols[0], y, w: widths[0], h: 0.4,
      fontFace: SANS, fontSize: 12.5, bold: true, color: DARKINK, margin: 0, valign: 'middle',
    });
    s.addText(r[1], {
      x: cols[1], y, w: widths[1], h: 0.4,
      fontFace: SANS, fontSize: 12.5, color: MUTED, margin: 0, valign: 'middle',
    });
    s.addText(r[2], {
      x: cols[2], y, w: widths[2], h: 0.4,
      fontFace: SANS, fontSize: 12.5, bold: true, color: DARKINK, margin: 0, valign: 'middle',
    });
    s.addText(r[3], {
      x: cols[3], y, w: widths[3], h: 0.4,
      fontFace: SERIF, fontSize: 15, bold: true, color: GOLD_DK, margin: 0, valign: 'middle',
    });
  });

  s.addText('Verified users — not downloads, not sign-ups. A verified user has passed a government-ID check and cannot be inflated. It is the only number that proves the thesis.', {
    x: M, y: 6.15, w: 11.6, h: 0.55,
    fontFace: SERIF, fontSize: 13, italic: true, color: DARKINK, margin: 0,
  });

  footer(s, 11, false);
}

// ═════════════════════════════════════════════════════════════════════════════
// 12 — Use of funds
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'Use of funds', 0.62, GOLD_DK);
  title(s, 'Two-thirds is growth and the people doing the work.', { y: 1.0, color: DARKINK });

  s.addChart(
    pres.ChartType.bar,
    [{
      name: 'Allocation',
      labels: ['Paid advertising', 'Founder salaries', 'Content & brand', 'Creators', 'First hire', 'Everything else'],
      values: [442000, 270000, 65000, 43000, 40000, 140000],
    }],
    {
      x: M, y: 2.0, w: 7.6, h: 4.1,
      barDir: 'bar',
      chartColors: [GOLD_DK],
      showValue: true,
      dataLabelPosition: 'outEnd',
      dataLabelFormatCode: '$#,##0,"k"',
      dataLabelColor: DARKINK,
      dataLabelFontFace: SANS,
      dataLabelFontSize: 10,
      catAxisLabelColor: DARKINK,
      catAxisLabelFontFace: SANS,
      catAxisLabelFontSize: 11,
      valAxisHidden: true,
      valGridLine: { style: 'none' },
      catGridLine: { style: 'none' },
      showLegend: false,
      barGapWidthPct: 45,
    }
  );

  const notes = [
    ['44%', 'paid advertising — the direct engine that turns attention into verified users'],
    ['27%', 'two founders at $7,500/month each, below market, no other staff until Stage 5'],
    ['<1%', 'infrastructure — the product is already built and cheap to run'],
  ];
  notes.forEach(([n, b], i) => {
    const y = 2.35 + i * 1.25;
    s.addText(n, {
      x: 8.75, y, w: 1.2, h: 0.5,
      fontFace: SERIF, fontSize: 30, bold: true, color: GOLD_DK, margin: 0,
    });
    s.addText(b, {
      x: 8.75, y: y + 0.52, w: 3.8, h: 0.7,
      fontFace: SANS, fontSize: 11.5, color: MUTED, margin: 0,
    });
  });

  footer(s, 12, false);
}

// ═════════════════════════════════════════════════════════════════════════════
// 13 — The ask
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide();
  eyebrow(s, 'The ask', 0.62);

  s.addText('$1,000,000 for 20%', {
    x: M, y: 1.05, w: 11.5, h: 1.0,
    fontFace: SERIF, fontSize: 52, bold: true, color: WHITE, margin: 0,
  });
  s.addText('at a $5,000,000 pre-money valuation, released in six stages.', {
    x: M, y: 2.05, w: 11.5, h: 0.5,
    fontFace: SERIF, fontSize: 20, italic: true, color: GOLD, margin: 0,
  });

  const facts = [
    ['$50,000', 'released at signing', 'Enough to incorporate, clear compliance and run the first campaigns.'],
    ['Equity in step', '1 + 1 + 3 + 4 + 5 + 6 = 20%', 'You never hold more equity than the capital actually deployed.'],
    ['200 users', 'the first gate', 'No further capital releases until 200 real verified users are proven.'],
  ];

  facts.forEach(([a, b, c], i) => {
    const x = M + i * 4.03;
    card(s, x, 2.95, 3.75, 2.35, true);
    s.addText(a, {
      x: x + 0.3, y: 3.2, w: 3.2, h: 0.5,
      fontFace: SERIF, fontSize: 26, bold: true, color: GOLD, margin: 0,
    });
    s.addText(b, {
      x: x + 0.3, y: 3.72, w: 3.2, h: 0.32,
      fontFace: SANS, fontSize: 12, bold: true, color: WHITE, margin: 0,
    });
    s.addText(c, {
      x: x + 0.3, y: 4.12, w: 3.2, h: 1.0,
      fontFace: SANS, fontSize: 11.5, color: GREY, margin: 0,
    });
  });

  s.addText('Verification costs are covered separately, up to $20,000 — so growth in verified users never competes with the campaign budget.', {
    x: M, y: 5.55, w: 11.6, h: 0.5,
    fontFace: SANS, fontSize: 12.5, color: GREY, margin: 0,
  });
  s.addText('If you would prefer the full 20% at signing, we will structure the tranches as firm commitments tied only to hitting targets, with a clawback on any stage left unfunded after its targets are met.', {
    x: M, y: 6.0, w: 11.6, h: 0.5,
    fontFace: SERIF, fontSize: 12.5, italic: true, color: GREY_DIM, margin: 0,
  });

  footer(s, 13, true);
}

// ═════════════════════════════════════════════════════════════════════════════
// 14 — Team
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide();
  eyebrow(s, 'Team', 0.62, GOLD_DK);
  title(s, 'Two founders. No agencies.', { y: 1.0, color: DARKINK });

  const team = [
    ['Lance Morrison', 'Founder & CEO',
     'Built and ships the entire product — the iOS app, the backend, the identity integration and the on-chain ledger. Runs the App Store releases and the public record.'],
    ['Daniel Morrison', 'Co-Founder',
     'Operations and go-to-market.'],
  ];

  team.forEach(([n, role, b], i) => {
    const x = M + i * 6.05;
    card(s, x, 2.1, 5.8, 2.6, false);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.35, y: 2.45, w: 0.62, h: 0.62,
      fill: { color: IVORY }, line: { color: GOLD_DK, width: 1 },
    });
    s.addText(n.split(' ').map((p) => p[0]).join(''), {
      x: x + 0.35, y: 2.45, w: 0.62, h: 0.62,
      fontFace: SERIF, fontSize: 17, bold: true, color: GOLD_DK,
      align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(n, {
      x: x + 1.15, y: 2.45, w: 4.4, h: 0.35,
      fontFace: SERIF, fontSize: 21, bold: true, color: DARKINK, margin: 0,
    });
    s.addText(role.toUpperCase(), {
      x: x + 1.15, y: 2.82, w: 4.4, h: 0.28,
      fontFace: SANS, fontSize: 10, bold: true, charSpacing: 2, color: GOLD_DK, margin: 0,
    });
    s.addText(b, {
      x: x + 0.35, y: 3.35, w: 5.15, h: 1.2,
      fontFace: SANS, fontSize: 12, color: MUTED, margin: 0,
    });
  });

  card(s, M, 5.0, 11.83, 1.35, false);
  s.addText(
    [
      { text: 'Both founders take $7,500/month — below market for either role. ', options: { bold: true, color: DARKINK } },
      { text: 'No other staff until Stage 5, by which point the company has 20,000 verified users and paying organizations.', options: { color: MUTED } },
    ],
    { x: 1.05, y: 5.3, w: 11.2, h: 0.85, fontFace: SANS, fontSize: 13, margin: 0 }
  );

  footer(s, 14, false);
}

// ═════════════════════════════════════════════════════════════════════════════
// 15 — Close
// ═════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide();
  s.addImage({ data: ICON, x: (W - 1.3) / 2, y: 1.75, w: 1.3, h: 1.3 });

  s.addText('One verified human. One vote.', {
    x: 0, y: 3.35, w: W, h: 0.75,
    fontFace: SERIF, fontSize: 40, color: WHITE, align: 'center', margin: 0,
  });

  dots(s, (W - (25 * 0.13 + 24 * 0.075)) / 2, 4.35, 25, 25, 0.13, 0.075, true);

  s.addText('Everything in this deck that is described as built, is built. Everything that is a target, is labelled as one.', {
    x: 1.9, y: 4.85, w: 9.5, h: 0.5,
    fontFace: SERIF, fontSize: 14, italic: true, color: GOLD, align: 'center', margin: 0,
  });

  s.addText('representvote.com   ·   lance403morrison@gmail.com', {
    x: 0, y: 5.85, w: W, h: 0.35,
    fontFace: SANS, fontSize: 13.5, color: GREY, align: 'center', margin: 0,
  });

  s.addText('Confidential', {
    x: 0, y: 6.55, w: W, h: 0.3,
    fontFace: SANS, fontSize: 9.5, charSpacing: 2, color: GREY_DIM,
    align: 'center', margin: 0,
  });
}

pres.writeFile({ fileName: __dirname + '/Represent-Investment-Proposal.pptx' })
  .then((f) => console.log('wrote', f));
