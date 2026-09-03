// Represent — the definitive investor deck. 16 slides, narrative order,
// every judge-ordered correction applied. All twelve fact violations fixed,
// the three cuts made, the two documents merged per the ten resolutions.
// Every number on every slide is real; placeholders exist only in speaker
// notes, clearly bracketed, for facts only the founder can supply.
const S = require('./system');
const path = require('path');

const GYM = path.join(__dirname, 'gym-scrim.jpg');
const KITCHEN = path.join(__dirname, 'kitchen-scrim.jpg');
const ICON = path.join(__dirname, '../deck/icon.png');

const pres = S.makePres();
pres.title = 'Represent — The Other 1,460 Days';
const state = { n: 0, total: 16 };
const { W, H, ML, DATUM } = S;

// ── 01 · Cold open ──────────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'I · The silence',
    notes: 'Cold open — no greeting slide, no agenda. "Not three a year. Three, ever. Three national referendums since Confederation. The last one was 1992 — Charlottetown. That is the entire record of my country turning to its citizens and saying: what do you think? Everything else — every war, every treaty, every budget — was decided about us, without asking us."',
  });
  s.addImage({ path: ICON, x: ML, y: S.MT, w: 0.42, h: 0.42 });
  S.statement(s, [
    { text: 'Since 1867, Canada has asked its people', breakLine: true },
    { text: 'three questions.', gold: true },
  ], { y: DATUM + 0.45, size: 46 });
  S.label(s, 'Three. In 159 years. The last · 1992 · Charlottetown', { y: DATUM + 2.55, size: 12 });
}

// ── 02 · The unasked (gym photo) ────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    ceremonial: true,
    notes: '"If you are under about fifty-two, you have never once been asked a question by Canada. Look at this line. Everybody in it knows one vote every four years changes almost nothing — and they show up anyway, carrying the same small, stubborn hope. That hope has had nowhere to go for an entire generation."',
  });
  S.photo(s, GYM, 611, 941);
  S.statement(s, [
    { text: 'If you’re under 52, your country', breakLine: true },
    { text: 'has never asked you anything.' },
  ], { y: H * 0.60, size: 36, w: 6.9 });
}

// ── 03 · 3 · 3 · 0 ─────────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'I · The silence',
    notes: '"This is not a Canadian quirk. The United Kingdom has managed three referendums in its entire history. And the United States has held zero national referendums — and here is the part people don’t believe: there is no legal mechanism to hold one. It’s not broken. It was never built."',
  });
  S.label(s, 'How often does a country ask its people?', { y: S.MT + 0.35 });
  const cols = [
    ['3', 'CANADA · SINCE 1867', false],
    ['3', 'UNITED KINGDOM · EVER', false],
    ['0', 'UNITED STATES · NO LEGAL MECHANISM', true],
  ];
  const colW = (W - 2 * ML) / 3;
  cols.forEach((c, i) => {
    s.addText(c[0], {
      x: ML + i * colW, y: 1.9, w: colW - 0.3, h: 3.1, align: 'center',
      fontFace: S.SERIF, fontSize: 170, color: c[2] ? S.GOLD : S.SECONDARY,
      margin: 0, isTextBox: true,
    });
    s.addText(c[1], {
      x: ML + i * colW, y: 5.25, w: colW - 0.3, h: 0.6, align: 'center',
      fontFace: S.MONO, fontSize: 10.5, charSpacing: 2, color: S.MUTED,
      margin: 0, isTextBox: true,
    });
  });
  S.statement(s, [{ text: 'It’s not broken. It was never built.', secondary: true }], {
    y: 6.05, size: 24, align: 'center',
  });
}

// ── 04 · Calgary, 2018 ─────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'I · The silence',
    notes: '"My city ran one plebiscite — should Calgary bid for the Olympics? Roughly three years from committee to answer. $2.2 million to run one vote. And 304,582 Calgarians showed up — 171,750 no, 132,832 yes. The demand is not hypothetical: when people are actually asked, they answer. Then the whole apparatus was torn down the next day. Being asked feels like being respected. We make it feel like a once-in-a-generation event."',
  });
  S.label(s, 'The last time a city asked · Calgary, 2018', { y: S.MT + 0.35 });
  S.statement(s, [{ text: 'One question.' }], { y: DATUM + 0.15, size: 40 });
  const stats = [
    ['$2.2M', 'TO RUN ONE VOTE', false],
    ['3 years', 'COMMITTEE TO ANSWER', false],
    ['304,582', 'PEOPLE ANSWERED', true],
  ];
  const colW = (W - 2 * ML) / 3;
  stats.forEach((c, i) => {
    s.addText(c[1], {
      x: ML + i * colW, y: 3.0, w: colW - 0.4, h: 0.32,
      fontFace: S.MONO, fontSize: 10.5, charSpacing: 2, color: S.MUTED, margin: 0, isTextBox: true,
    });
    s.addText(c[0], {
      x: ML + i * colW, y: 3.35, w: colW - 0.15, h: 1.25,
      fontFace: S.SERIF, fontSize: 56, color: c[2] ? S.GOLD : S.INK, margin: 0, isTextBox: true,
    });
  });
  S.hairline(s, ML, 4.78, W - 2 * ML, S.GOLD_FILL);
  S.statement(s, [
    { text: 'Dismantled the next day. ' },
    { text: 'On Represent: approximately nothing, and days — not years.', secondary: true },
  ], { y: 5.25, size: 26 });
}

// ── 05 · They can't ────────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'I · The silence',
    notes: '"Here is the uncomfortable truth: even an honest representative cannot hear 300,000 constituents. There is no instrument. Emails, petitions, town halls — all dismissible, because none of it is verified. You are the opinion of one, and the opinion of one is nothing. The failure isn’t moral. It’s infrastructure. In both directions, the channel simply does not exist."',
  });
  S.statement(s, [
    { text: 'It’s not that they won’t listen.', breakLine: true },
    { text: 'It’s that they can’t.', gold: true },
  ], { size: 44, w: 9.2 });
  s.addText(
    'Even an honest representative cannot hear 300,000 constituents. There is no instrument — in either direction.',
    {
      x: ML, y: DATUM + 2.5, w: 5.6, h: 1.2, fontFace: S.SANS, fontSize: 15,
      color: S.SECONDARY, lineSpacingMultiple: 1.35, margin: 0, isTextBox: true,
    }
  );
}

// ── 06 · The graveyard ─────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'I · The silence',
    notes: '"You’ve seen this pitch before, and it ended badly. Brigade — Sean Parker, roughly nine million dollars, dead. Countable. Votizen. Civic tech is a famous tar pit, and I’m naming it before you do. They all died of exactly two wounds: their product was unverifiable opinion — one bot accusation and it evaporates — and nobody had to pay for it. Hold those two wounds in mind. The rest of this deck closes both."',
  });
  S.statement(s, [
    { text: 'Civic apps die of the same ', breakLine: false },
    { text: 'two wounds.', gold: true },
  ], { size: 40, w: 5.2 });
  const entries = [
    ['BRIGADE', 'Roughly $9M raised. Unverifiable opinion.'],
    ['COUNTABLE', 'Dismissible as bots, at any scale.'],
    ['VOTIZEN', 'No one ever had to pay.'],
  ];
  let y = 2.05;
  entries.forEach((e) => {
    s.addText(e[0], {
      x: 7.1, y, w: 5.1, h: 0.4, fontFace: S.MONO, fontSize: 15, charSpacing: 4,
      color: S.INK, margin: 0, isTextBox: true,
    });
    s.addText(e[1], {
      x: 7.1, y: y + 0.42, w: 5.1, h: 0.4, fontFace: S.SANS, fontSize: 14,
      color: S.SECONDARY, margin: 0, isTextBox: true,
    });
    S.hairline(s, 7.1, y + 0.98, 5.1);
    y += 1.35;
  });
}

// ── 07 · Why now ───────────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'II · The instrument',
    notes: '"Phones, databases, cryptography — all of it existed for twenty-five years. What didn’t exist was cheap, remote proof that a voter is one real person in one real place. That collapsed from impossible to about three minutes and a few dollars only in the last couple of years. Brigade was early. This is the moment the product they wanted becomes buildable — and we’ve already built it."',
  });
  S.label(s, 'Why now', { y: S.MT + 0.35 });
  // THEN — dimmed
  s.addText('THEN', { x: ML, y: 2.1, w: 4, h: 0.35, fontFace: S.MONO, fontSize: 12, charSpacing: 4, color: S.MUTED, margin: 0, isTextBox: true });
  s.addText('Impossible.', { x: ML, y: 2.55, w: 4.8, h: 1.4, fontFace: S.SERIF, fontSize: 54, color: S.MUTED, margin: 0, isTextBox: true });
  s.addText('Remote proof that a voter is one real person, in one real place.', {
    x: ML, y: 4.05, w: 4.4, h: 1.0, fontFace: S.SANS, fontSize: 14, color: S.MUTED, lineSpacingMultiple: 1.35, margin: 0, isTextBox: true,
  });
  // NOW — bright
  s.addText('NOW', { x: 7.2, y: 2.1, w: 4, h: 0.35, fontFace: S.MONO, fontSize: 12, charSpacing: 4, color: S.SECONDARY, margin: 0, isTextBox: true });
  s.addText([
    { text: '~3 minutes', options: { color: S.GOLD } },
    { text: '.', options: { color: S.INK } },
  ], { x: 7.2, y: 2.55, w: 5.2, h: 1.4, fontFace: S.SERIF, fontSize: 54, margin: 0, isTextBox: true });
  s.addText('And a few dollars — only in the last couple of years. Government ID plus a liveness check, from a phone.', {
    x: 7.2, y: 4.05, w: 4.8, h: 1.0, fontFace: S.SANS, fontSize: 14, color: S.SECONDARY, lineSpacingMultiple: 1.35, margin: 0, isTextBox: true,
  });
  S.statement(s, [{ text: 'Brigade wasn’t wrong. It was early.', secondary: true }], { y: 5.7, size: 24 });
}

// ── 08 · THE TURN (ceremonial) ─────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    ceremonial: true,
    notes: 'PAUSE before advancing to this slide. Then: "This is Represent. Live on the App Store today. Every voter verifies once with government ID and a liveness check. Your region comes from your ID — so a Calgary question is answered only by verified Calgarians. One person, one vote. You cannot verify twice. Democracy gives you one day every four years. We built the other one thousand, four hundred and sixty."',
  });
  S.statement(s, [
    { text: 'You get one day every four years.', breakLine: true },
    { text: 'We built the other ' },
    { text: '1,460', gold: true },
    { text: '.' },
  ], { y: 2.85, size: 46, align: 'center' });
}

// ── 09 · Not opinion. Evidence. ────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'II · The instrument',
    notes: '"We designed for a hostile audience. Results stay sealed until ten verified ballots — no bandwagons, no fake landslides. Every count is written to a public ledger — currently a pilot on a test network — with per-voter receipts, so a skeptic can audit the tally without trusting Represent at all. Verification runs through Didit; we never store your documents. Yes/no, multiple-choice, ranked-choice, private organizational ballots. This isn’t opinion. It’s evidence. That’s wound number one, closed."',
  });
  S.statement(s, [
    { text: 'Not opinion.', breakLine: true },
    { text: 'Evidence.' },
  ], { size: 44, w: 3.9 });
  const rows = [
    ['VERIFIED HUMAN', 'gov ID + liveness · docs never stored'],
    ['REGION FROM ID', 'a Calgary ballot — Calgarians only'],
    ['ONE PERSON, ONE VOTE', 'you cannot verify twice'],
    ['PUBLIC LEDGER (PILOT)', 'receipts · auditable without trusting us'],
  ];
  let y = 1.85;
  rows.forEach((r) => {
    s.addText(r[0], { x: 6.0, y, w: 3.4, h: 0.4, fontFace: S.MONO, fontSize: 12.5, charSpacing: 2, color: S.INK, margin: 0, isTextBox: true, valign: 'middle' });
    s.addText(r[1], { x: 9.35, y, w: 3.0, h: 0.4, fontFace: S.SANS, fontSize: 12.5, color: S.MUTED, margin: 0, isTextBox: true, valign: 'middle' });
    S.hairline(s, 6.0, y + 0.52, 6.35);
    y += 0.82;
  });
  S.thresholdDots(s, 6.0, y + 0.15, 10);
  s.addText('SEALED UNTIL 10 VERIFIED BALLOTS', {
    x: 9.15, y: y + 0.03, w: 3.3, h: 0.4, fontFace: S.MONO, fontSize: 10.5, charSpacing: 2, color: S.MUTED, margin: 0, isTextBox: true, valign: 'middle',
  });
}

// ── 10 · Traction — the integrity slide ────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'II · The instrument',
    notes: '"Here is exactly where we are, with no inflation: about 157 public questions on the record, about 190 verified ballots cast, a few dozen verified users. Small — but every single one of those ballots is a government-ID-verified human being, which is a claim Brigade could never make at any scale. Everything in this deck holds itself to that standard. Verified numbers only." [FOUNDER: pull the exact live counts from the database on the morning of the pitch and update this slide — exact beats approximate, and it is on-brand to be exact.]',
  });
  S.statement(s, [
    { text: 'Small numbers. ', breakLine: false },
    { text: 'Real ones.' },
  ], { size: 44 });
  let y = 2.6;
  S.ledgerRow(s, y, 'Public questions', '~157', 'live'); y += 0.72;
  S.ledgerRow(s, y, 'Verified ballots', '~190', 'human, proven'); y += 0.72;
  S.ledgerRow(s, y, 'Verified voters', 'a few dozen', 'gov-ID'); y += 0.72;
  S.ledgerRow(s, y, 'Capital', 'CAD $1M', 'committed · staged', { noRule: true }); y += 0.9;
  s.addText('Every ballot above is a government-ID-verified human — a claim the graveyard could never make at any scale.', {
    x: ML, y, w: 8.6, h: 0.8, fontFace: S.SANS, fontSize: 14, color: S.SECONDARY, lineSpacingMultiple: 1.35, margin: 0, isTextBox: true,
  });
}

// ── 11 · Who pays ──────────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'III · The business',
    notes: '"Citizens never pay to vote — permanent principle. Organizations pay: unions, associations, co-ops, boards running ratifications, elections, bylaw votes. Fifty-nine to four ninety-nine a month by size, plus one-time verification unlocks from one ninety-nine to nine ninety-nine. And this buyer isn’t theoretical — ElectionBuddy and Simply Voting are profitable companies in exactly this market. Neither offers government-ID-verified voters or a public auditable ledger. That’s wound number two, closed." [Q&A ARMOR: if asked ‘they’re profitable without verification, why is it a premium?’ — answer: the expensive part of an internal vote is the argument afterwards; a disputed ratification costs an org far more than $499/month, and only a verified roll ends the dispute.]',
  });
  S.statement(s, [
    { text: 'Citizens never pay to vote.', breakLine: true },
    { text: 'Organizations do.' },
  ], { size: 40 });
  const tiers = [
    ['FREE', '$0', 'up to 25 members', false],
    ['PRO', '$59', 'up to 250 members', true],
    ['PLUS', '$179', 'up to 1,000 members', false],
    ['BUSINESS', '$499', 'up to 5,000 members', false],
  ];
  const colW = (W - 2 * ML) / 4;
  tiers.forEach((t, i) => {
    const x = ML + i * colW;
    if (i > 0) s.addShape('rect', { x: x - 0.02, y: 2.8, w: 0.012, h: 2.0, fill: { color: S.HAIR }, line: { type: 'none' } });
    s.addText(t[0], { x: x + 0.25, y: 2.9, w: colW - 0.5, h: 0.32, fontFace: S.MONO, fontSize: 11, charSpacing: 3, color: S.MUTED, margin: 0, isTextBox: true });
    s.addText(t[1], { x: x + 0.25, y: 3.3, w: colW - 0.5, h: 0.95, fontFace: S.SERIF, fontSize: 44, color: t[3] ? S.GOLD : S.INK, margin: 0, isTextBox: true });
    s.addText(t[2], { x: x + 0.25, y: 4.32, w: colW - 0.5, h: 0.35, fontFace: S.SANS, fontSize: 12.5, color: S.SECONDARY, margin: 0, isTextBox: true });
  });
  s.addText('RATIFICATIONS · ELECTIONS · BYLAW VOTES  ·  ONE-TIME VERIFICATION UNLOCKS $199–$999', {
    x: ML, y: 5.25, w: W - 2 * ML, h: 0.32, fontFace: S.MONO, fontSize: 10.5, charSpacing: 2, color: S.MUTED, margin: 0, isTextBox: true,
  });
  s.addText('ElectionBuddy and Simply Voting are profitable in exactly this market. Neither verifies identity. Neither has a public ledger.', {
    x: ML, y: 5.85, w: 10.5, h: 0.7, fontFace: S.SANS, fontSize: 14, color: S.SECONDARY, lineSpacingMultiple: 1.3, margin: 0, isTextBox: true,
  });
}

// ── 12 · The flywheel ──────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'III · The business',
    notes: '"Organizations fund the business. Density wins the mission. We concentrate on Alberta first: build verified density in one place, and a politician facing a verified majority of their own constituents has nothing left to dismiss — not bots, not a loud minority, not the opinion of one. That’s the flywheel: paid on one side, unignorable on the other."',
  });
  S.statement(s, [
    { text: 'You can ignore one voice.', breakLine: true },
    { text: 'You cannot ignore a verified majority.', gold: true },
  ], { size: 40 });
  const chain = [
    ['01', 'ORGANIZATIONS FUND THE BUSINESS'],
    ['02', 'EVERY MEMBER VERIFIED ADDS TO THE NETWORK'],
    ['03', 'VERIFIED DENSITY CONCENTRATES — ALBERTA FIRST'],
    ['04', 'NOTHING LEFT TO DISMISS'],
  ];
  let y = 2.95;
  chain.forEach((c) => {
    s.addText(c[0], { x: ML, y, w: 0.6, h: 0.4, fontFace: S.MONO, fontSize: 12, color: S.GOLD_FILL, margin: 0, isTextBox: true, valign: 'middle' });
    s.addText(c[1], { x: ML + 0.7, y, w: 9.6, h: 0.4, fontFace: S.MONO, fontSize: 12.5, charSpacing: 2, color: c[0] === '04' ? S.INK : S.SECONDARY, margin: 0, isTextBox: true, valign: 'middle' });
    S.hairline(s, ML, y + 0.52, 10.3);
    y += 0.78;
  });
}

// ── 13 · Founder & capital (kitchen photo) ─────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    ceremonial: true,
    notes: '"I’m Lance Morrison. I started this with my own money, in Calgary, and a cofounder recently joined me. An angel has committed one million Canadian dollars — and I want to be precise: committed, not raised, released in tranches tied to verified-user milestones. Someone has already looked at these small honest numbers and staked a million dollars on where they go. The terms hold me accountable, and I like it that way."',
  });
  S.photo(s, KITCHEN, 736, 941);
  S.statement(s, [
    { text: 'Started at a kitchen table', breakLine: true },
    { text: 'in Calgary.' },
  ], { y: 1.7, size: 38, w: W * 0.5 });
  const rows = [
    ['FOUNDER', 'Lance Morrison · self-funded start'],
    ['COFOUNDER', 'recently joined'],
    ['CAPITAL', 'CAD $1M committed · milestone tranches'],
  ];
  let y = 4.3;
  rows.forEach((r) => {
    s.addText(r[0], { x: ML, y, w: 1.9, h: 0.4, fontFace: S.MONO, fontSize: 11, charSpacing: 3, color: S.MUTED, margin: 0, isTextBox: true, valign: 'middle' });
    s.addText(r[1], { x: ML + 2.0, y, w: 5.2, h: 0.4, fontFace: S.SANS, fontSize: 14.5, color: S.INK, margin: 0, isTextBox: true, valign: 'middle' });
    y += 0.62;
  });
}

// ── 14 · The creed (ceremonial) ────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    ceremonial: true,
    notes: 'Two seconds of silence before speaking. Then: "Three referendums in 159 years — not because people didn’t want to answer, but because asking cost millions and took years. It doesn’t anymore. When people get the chance to decide for themselves, the majority chooses good. We’re building the instrument that finally lets them." Hold again after.',
  });
  S.statement(s, [
    { text: 'The majority chooses good.', gold: true },
  ], { y: 3.15, size: 54, align: 'center' });
}

// ── 15 · The ask ───────────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    section: 'III · The business',
    notes: '[FOUNDER — REQUIRED BEFORE PITCH DAY: state your one true ask out loud here. Pick the sentence that is actually true, e.g. “We’re raising a further $X alongside the committed $1M,” or “We’re looking for co-investors on the same milestone terms,” or “We want introductions to organizations and to your civic-minded LPs.” Never say ‘portions.’] Then: "The million is committed, in tranches tied to verified-user milestones. It buys two proofs: the first verified constituency — Alberta — and the first paying organizations. One proves the flywheel. The other proves the business. Canada asked three questions in 159 years. Help us ask the fourth — and every one after it."',
  });
  S.label(s, 'The capital, precisely', { y: S.MT + 0.35 });
  s.addText([
    { text: 'CAD $1M', options: { color: S.GOLD } },
  ], { x: ML, y: DATUM + 0.1, w: 8, h: 1.7, fontFace: S.SERIF, fontSize: 92, margin: 0, isTextBox: true });
  s.addText('COMMITTED · IN TRANCHES TIED TO VERIFIED-USER MILESTONES', {
    x: ML, y: DATUM + 1.85, w: 10, h: 0.35, fontFace: S.MONO, fontSize: 12, charSpacing: 3, color: S.SECONDARY, margin: 0, isTextBox: true,
  });
  let y = 4.35;
  S.ledgerRow(s, y, 'Job one', 'the first verified constituency', 'Alberta'); y += 0.72;
  S.ledgerRow(s, y, 'Job two', 'the first paying organizations', 'signed', { noRule: true }); y += 1.0;
  S.statement(s, [
    { text: 'Canada asked three questions in 159 years. ', secondary: true },
    { text: 'Help us ask the fourth.' },
  ], { y, size: 26 });
}

// ── 16 · Close ─────────────────────────────────────────────────────────────
{
  const s = S.baseSlide(pres, state, {
    ceremonial: true,
    notes: 'Say nothing. Let the room break the silence.',
  });
  s.addImage({ path: ICON, x: W / 2 - 0.4, y: 2.0, w: 0.8, h: 0.8 });
  S.statement(s, [
    { text: 'Stop being counted. ' },
    { text: 'Start counting.', gold: true },
  ], { y: 3.25, size: 42, align: 'center' });
  s.addText('LIVE ON THE APP STORE  ·  REPRESENTVOTE.COM', {
    x: ML, y: 4.6, w: W - 2 * ML, h: 0.35, align: 'center',
    fontFace: S.MONO, fontSize: 11.5, charSpacing: 3, color: S.MUTED, margin: 0, isTextBox: true,
  });
}

pres.writeFile({ fileName: __dirname + '/Represent-The-Other-1460-Days-Investor.pptx' })
  .then(() => console.log('written'));
