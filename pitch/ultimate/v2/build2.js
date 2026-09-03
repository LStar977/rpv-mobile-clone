// "Proof of us" — the Represent investor deck, built exactly to the judge's
// authoritative 15-slide map. Every number is canon; the only illustrative
// geometry (seal fill width, tranche node count) is annotated as such.
const S = require('./system2');
const path = require('path');

const P = (f) => path.join(__dirname, f);
const pres = S.makePres();
pres.title = 'Represent — Proof of us';
const state = { n: 0 };
const { W, H, ML } = S;

// ── 01 · THRESHOLD — cover ──────────────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    folio: false,
    notes: '"I’m Lance Morrison. I started building this at my kitchen table in Calgary. Today it’s a live app where a real, verified human being can vote on a real civic question — and nobody can say the result was faked. I want to show you why that sentence is worth a company."',
  });
  S.firstMark(s, W / 2, 2.30, 2.80);
  S.wordmark(s, 3.02);
  s.addText('Proof of us', {
    x: 0, y: 3.62, w: W, h: 0.85, align: 'center', fontFace: S.SERIF,
    fontSize: 40, color: S.INK, margin: 0, isTextBox: true,
  });
  s.addText('One verified human. One vote. On the record.  ·  Live on the App Store  ·  representvote.com', {
    x: 0, y: 4.72, w: W, h: 0.3, align: 'center', fontFace: S.SANS,
    fontSize: 12, color: S.MUTED, margin: 0, isTextBox: true,
  });
}

// ── 02 · WITNESS — the city that answered (P02a) ───────────────────────────
{
  const s = S.slide(pres, state, {
    folio: false,
    notes: '"My city wanted to know one thing: do you want the Olympics? It took a committee roughly three years and $2.2 million to ask. Over three hundred thousand of my neighbours answered — every dot on this slide is one of them. Here’s something I believe: hand people a real decision and they’ll surprise you. Calgary answered honestly, even when the answer was no."',
  });
  S.plate(s, P('plate02a.jpg'), 0, 0, W, H);
  S.folio(s, 2);
  S.kicker(s, 'Calgary · 2018');
  S.headline(s, [{ text: 'One question. $2.2 million. Three years.' }]);
  S.ann(s, '171,750 NO', 5.15, 6.52, { w: 2.0, align: 'right' });
  S.ann(s, '132,832 YES', 7.55, 6.52, { w: 2.0 });
  S.ann(s, 'Every dot is a voter · Calgary 2018 · $2.2M · ≈3 years', 3.17, 6.84, { w: 7, align: 'center' });
  S.source(s, 'Source: City of Calgary · 2018 plebiscite');
}

// ── 03 · WITNESS — dismantled (P02b) ───────────────────────────────────────
{
  const s = S.slide(pres, state, {
    folio: false,
    notes: '"And the morning after democracy worked, we tore the machine down. Not mothballed — dismantled. If Calgary wants to ask us anything else, we start again from zero: another committee, more years, more millions. Hold that image. Three hundred thousand voices, struck through."',
  });
  S.plate(s, P('plate02b.jpg'), 0, 0, W, H);
  S.folio(s, 3);
  S.kicker(s, 'Calgary · 2018');
  S.headline(s, [{ text: 'The next day, the machine was dismantled.' }]);
}

// ── 04 · WITNESS — the silent centuries (P01) ──────────────────────────────
{
  const s = S.slide(pres, state, {
    folio: false,
    notes: '"That isn’t a Calgary quirk — it’s the whole architecture. Since Confederation, Canada has put exactly three questions to its citizens; the last one was 1992. The United Kingdom, in its entire history: three. And the United States has never asked its people anything, nationally — because it legally can’t. Not won’t. Can’t. There is no machine to run it on. Look at the bottom line: it isn’t broken. It was never built."',
  });
  S.plate(s, P('plate01.jpg'), 0, 0, W, H);
  S.folio(s, 4);
  S.kicker(s, '1867–2026');
  S.headline(s, [{ text: 'Canada has asked its people three questions in 159 years.' }]);
  // nation labels + row annotations (rows at y = 3.93 / 5.00 / 6.07)
  S.ann(s, 'Canada — three · since 1867', 1.333, 3.42, { w: 4.5 });
  S.ann(s, 'United Kingdom — three · ever', 1.333, 4.49, { w: 4.5 });
  S.ann(s, 'United States — zero · no legal mechanism', 1.333, 5.56, { w: 5.5 });
  // lit years, beneath their ticks
  S.ann(s, '1898', 3.16, 4.30, { w: 0.5 });
  S.ann(s, '1942', 6.11, 4.30, { w: 0.5 });
  S.ann(s, '1992', 9.35, 4.30, { w: 0.5 });
  S.ann(s, '1975', 8.33, 5.37, { w: 0.5 });
  S.ann(s, '2011 · 2016', 10.35, 5.37, { w: 1.2 });
  // bracket label: 1992 -> 2026, inline after the year
  S.ann(s, '34 years · no question asked', 9.95, 4.30, { w: 2.9, size: 8 });
  S.source(s, 'Source: Elections Canada');
}

// ── 05 · VERDICT — no verb ─────────────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"So what do citizens actually have between elections? Polls anyone can stuff. Petitions a script can sign. Town halls — whoever shows up. Comment sections — whoever shouts. And every one of them dies the same way: the second a decision-maker doesn’t like the answer, they say the magic words — ‘probably bots’ — and it’s over. The public speaks constantly. It just speaks in a format that’s built to be ignored."',
  });
  S.display(s, [{ text: 'Between elections, a citizen has no verb.' }], { w: 10.8 });
  S.body(s, [
    'Polls are unverified. Petitions sign twice, from anywhere. Town halls are whoever shows up; social media is whoever shouts.',
    'None of it survives one skeptical question: how do you know those are real people?',
    'Anything cheaper than an election gets thrown out as bots.',
  ], { y: 3.4, w: 6.4, h: 2.6 });
}

// ── 06 · WITNESS — the turn (P05) ──────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"Here’s the turn. Very recently, it became possible to prove — from a phone, in about three minutes, for a few dollars — that a person is real, is who their government ID says they are, and lives where it says they live. That capability did not exist at any sane price when anyone last tried this. The moment it existed, something new became possible: a public voice that cannot be dismissed as bots. We built it. The rings behind me: the outer one is Calgary’s three years, drawn day by day. The inner one is our three minutes, drawn second by second."',
  });
  S.plate(s, P('plate05.jpg'), 6.903, 0.535, 6.43, 6.43);
  S.display(s, [
    { text: 'Three minutes. A few dollars.', breakLine: true },
    { text: 'A verified human.', gold: true },
  ], { w: 6.2 });
  S.body(s, [
    'Remote government-ID verification — document plus liveness — recently became cheap and instant.',
    'What once required a courthouse now fits in a phone camera.',
    'This is the ingredient every previous attempt was missing.',
  ], { y: 3.5, w: 5.2, h: 2.4 });
  S.ann(s, '≈3 years · Calgary, once', 10.0, 0.72, { w: 3.1, align: 'right' });
  S.ann(s, '≈3 minutes · Represent, anyone', 8.42, 3.62, { w: 3.4, align: 'center' });
}

// ── 07 · MECHANISM — the product ───────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"Represent is dead simple. You verify once — ID plus a liveness check, about three minutes, and your documents are never stored. After that, every question is a real ballot: your city, your province, your country. You can’t vote twice, you can’t vote from somewhere you don’t live, and you can’t be a bot, because we already know you’re not. Calgary’s $2.2-million apparatus, permanently standing, in your pocket."',
  });
  S.kicker(s, 'Live on iOS today');
  S.headline(s, [{ text: 'Verify once. Then vote on anything real.' }]);
  S.step(s, 2.6, '01', 'Scan government ID', 'Documents verified, never stored.');
  S.step(s, 3.6, '02', 'Pass liveness check', 'About three minutes, once.');
  S.step(s, 4.6, '03', 'Vote · region locked to your ID', 'City, provincial, national — one person, one vote.');
  // right-half hairline schematic: ID -> LIVENESS -> BALLOT, gold = the cast ballot
  const bx = 8.4, bw = 3.4, bh = 0.92;
  const tops = [1.9, 3.35, 4.8];
  const names = ['GOVERNMENT ID', 'LIVENESS', 'BALLOT'];
  tops.forEach((ty, i) => {
    S.hairline(s, bx, ty, bw);
    S.hairline(s, bx, ty + bh, bw);
    S.hairline(s, bx, ty, 0.012, { h: bh });
    S.hairline(s, bx + bw, ty, 0.012, { h: bh + 0.012 });
    S.ann(s, names[i], bx, ty - 0.28, { w: bw });
  });
  s.addShape('rect', {
    x: bx + bw / 2 - 0.011, y: tops[2] + 0.21, w: 0.022, h: 0.5,
    fill: { color: S.GOLD }, line: { type: 'none' },
  });
}

// ── 08 · MECHANISM — the seal (P04) ────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    folio: false,
    notes: '"Every design decision answers one attack. Can’t be bots — every voter passed ID and liveness. Can’t be brigaded from out of town — the ID locks your region. Can’t be quietly edited — results are receipted on a public ledger, in pilot now. And no result even exists until ten verified ballots do — those bars of static stay sealed — so nobody can be singled out and nothing tiny masquerades as a movement. The product isn’t the voting. The product is the fact that the result survives scrutiny."',
  });
  S.plate(s, P('plate04.jpg'), 6.667, 0, 6.667, 7.5);
  S.folio(s, 8);
  S.kicker(s, 'Sealed until 10 verified ballots');
  S.headline(s, [{ text: 'Built so nobody can call it fake.' }], { w: 5.4, h: 1.5 });
  S.step(s, 2.85, '01', 'Documents never stored', null, { w: 5.0 });
  S.step(s, 3.5, '02', 'One human, one vote', null, { w: 5.0 });
  S.step(s, 4.15, '03', 'Region locked from the ID', null, { w: 5.0 });
  S.step(s, 4.8, '04', 'Public-ledger receipts · pilot', null, { w: 5.0 });
  S.step(s, 5.45, '05', 'No result until 10 verified ballots', null, { w: 5.0 });
  const tags = [
    'Sealed · below 10 verified ballots', 'Sealed · below 10 verified ballots',
    'Sealed · below 10 verified ballots', 'Sealed · below 10 verified ballots',
    'Open · 10 verified ballots reached',
  ];
  const tops = [1.4, 2.33, 3.27, 4.2, 5.13];
  tags.forEach((t, i) => S.ann(s, t, 7.4, tops[i] + 0.36, { w: 4.5, size: 8 }));
  S.ann(s, 'Fill width illustrative', 7.4, 5.86, { w: 4.5, size: 8 });
}

// ── 09 · VERDICT — the graveyard ───────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"When I started pitching this, a coach I respect looked at it and said: tar pit. Smart people, famous backers, all sank here. He’s right about the bodies. Brigade had Sean Parker and roughly nine million dollars, and it’s gone. Countable, Votizen — gone. And when you read the autopsies, it’s the same story every time: their input was unverifiable, so it carried no weight — and nobody’s job depended on buying it."',
  });
  S.kicker(s, 'Brigade · Countable · Votizen');
  S.display(s, [{ text: 'An investor coach told me this space is a tar pit.' }], { w: 10.8 });
  S.body(s, [
    'Brigade — Sean Parker behind it, roughly $9M raised. Dead. Countable. Dead. Votizen. Dead.',
    'Autopsy, every time: input anyone could dismiss as bots, and nobody who had to pay.',
  ], { y: 3.9, w: 6.4, h: 1.8 });
}

// ── 10 · VERDICT — the reversal ────────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"Here’s what the tar-pit framing misses: those companies weren’t wrong about the demand — three separate teams found it — they were early on the supply. The thing that would have made their input undismissible — cheap, instant ID verification — arrived after they were gone. We start where they couldn’t. And unlike them, we knew from day one exactly who writes the cheque."',
  });
  S.display(s, [
    { text: 'Brigade needed a technology that didn’t exist. ' },
    { text: 'It does now.', gold: true },
  ], { w: 10.6 });
  S.body(s, [
    'What they lacked: proof a voice was human. Cheap ID verification arrived after they died.',
    'Who they lacked: a paying customer. Ours already buy voting software.',
    'The graveyard isn’t a warning. It’s proof the demand kept coming back.',
  ], { y: 3.7, w: 6.4, h: 2.4 });
}

// ── 11 · WITNESS — true scale (P06) ────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    folio: false,
    notes: '"Our traction, without makeup: about 157 questions asked, about 190 ballots recorded, a few dozen verified users, live on the App Store today. We will not show you a vanity chart — these are the real numbers, at true scale, next to ten thousand of Calgary’s voters for reference. But notice what kind of small this is: every one of those gold dots handed us a government ID and looked into a camera to be counted. That’s the hardest signup in consumer software, and dozens of strangers already did it. Honest counting is literally the product — so the deck counts honestly too."',
  });
  S.plate(s, P('plate06.jpg'), 0, 0, W, H);
  S.folio(s, 11);
  S.kicker(s, 'Live · App Store');
  S.headline(s, [{ text: 'Our traction, at true scale.' }]);
  S.ann(s, '10,000 voters · for scale', 1.67, 5.32, { w: 3.2 });
  S.ann(s, '≈157 questions asked', 5.05, 5.32, { w: 2.2, align: 'center' });
  S.ann(s, '≈190 ballots recorded', 7.45, 5.32, { w: 2.3, align: 'center' });
  S.ann(s, 'A few dozen verified humans', 9.85, 5.32, { w: 2.9 });
  S.ann(s, 'Each passed government ID + liveness', 9.85, 5.56, { w: 3.2, size: 8 });
}

// ── 12 · COUNT — the business ──────────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"The customer is anyone whose job is to say ‘the public wants this’ and get believed: advocacy groups, unions, municipalities, media. They pay monthly tiers from $59 to $499, plus one-time unlocks from $199 to $999 for bigger ballots. This isn’t hoped-for behaviour — ElectionBuddy and Simply Voting already prove organizations pay real money to run votes; we’re the version whose voters are verified citizens. And one thing is non-negotiable: a citizen never pays to vote. The day voting costs money, the whole thing means nothing."',
  });
  S.kicker(s, 'Advocacy · unions · municipalities · media');
  S.headline(s, [{ text: 'Organizations pay to ask. Citizens never pay to answer.' }]);
  S.stanza(s, ML, 2.75, '$0', 'Citizens · forever', 'Voting is never paid.', { gold: true });
  S.stanza(s, ML + 2.95, 2.75, '$59', 'Org tier · monthly', null);
  S.stanza(s, ML + 5.9, 2.75, '$179', 'Org tier · monthly', null);
  S.stanza(s, ML + 8.85, 2.75, '$499', 'Org tier · monthly', null);
  S.hairline(s, ML, 5.55, 11.53);
  S.ann(s, 'One-time unlocks $199–$999  ·  orgs already pay: ElectionBuddy · Simply Voting', ML, 5.72, { w: 11.5 });
  s.addText('Voting is free for citizens forever. That’s a principle, not a gap.', {
    x: ML, y: 6.15, w: 8, h: 0.3, fontFace: S.SANS, fontSize: 13,
    color: S.SECONDARY, margin: 0, isTextBox: true,
  });
}

// ── 13 · VERDICT — team ────────────────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"I’m not a technical founder. I’m the guy who cared enough to self-fund this from a kitchen table and refuse to stop until it was on the App Store — which it is: working, with real verified ballots and receipts on a real ledger. A cofounder has now joined me. Judge me on that gap: no pedigree, product live anyway."',
  });
  S.display(s, [
    { text: 'A kitchen table in Calgary. A shipped app.', breakLine: true },
    { text: 'A cofounder.' },
  ], { w: 10.8 });
  S.body(s, [
    'Lance Morrison, founder — self-funded from day one, non-technical, shipped anyway.',
    'A cofounder recently joined.',
    'The verification, the ledger receipts, the sealed results: live, not slideware.',
  ], { y: 3.7, w: 6.4, h: 2.4 });
}

// ── 14 · COVENANT — the ask (P07) ──────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    folio: false,
    notes: '"Where the capital stands, stated carefully: one million Canadian dollars — not raised, committed — by an angel, released in tranches as we hit verified-user milestones. I structured it that way on purpose: this company’s one honest metric is verified humans, so the money answers to it too. The ask today is to come into the round alongside that commitment, under the same discipline. [FOUNDER — state your one true ask here in a single sentence: the amount or range you want from this room, and what it buys. Never say ‘portions.’] You’re not funding a story about users — you’re funding capital that only moves when real, ID-verified people do."',
  });
  S.plate(s, P('plate07.jpg'), 0, 0, W, H);
  S.folio(s, 14);
  S.kicker(s, 'The capital, precisely');
  S.headline(s, [{ text: 'One million dollars, released by proof.' }]);
  S.ann(s, 'CAD $1,000,000 · committed', 1.333, 4.28, { w: 3.2 });
  [4.0, 6.67, 9.33, 12.0].forEach((nx, i) => {
    S.ann(s, `Verified-user milestone · 0${i + 1}`, nx - 1.35, 5.12, { w: 2.7, align: 'center' });
  });
  S.body(s, [
    'Not raised. Committed — CAD $1,000,000 from an angel investor, released in tranches tied to verified-user milestones.',
    'The ask: join the round alongside it, on the same milestone discipline.',
    'Every dollar is accountable to the one number that can’t be faked: verified humans.',
  ], { y: 5.75, w: 7.6, h: 1.3 });
  S.ann(s, 'Tranche count and spacing illustrative', ML, 6.98, { w: 4, size: 8 });
}

// ── 15 · THRESHOLD — close ─────────────────────────────────────────────────
{
  const s = S.slide(pres, state, {
    notes: '"Remember where we started: my city spent $2.2 million and three years to ask one question, then tore the machine down before lunch the next day. That’s the whole pitch — we built the machine that doesn’t get torn down. It’s live, it’s verified, and every answer it produces can survive a hostile room, including this one. Three national questions in 159 years is not a ceiling. It’s a starting line. Come ask the next one with us."',
  });
  S.firstMark(s, W / 2, 2.30, 2.80);
  S.wordmark(s, 3.02);
  s.addText('This time, the ballot box stays.', {
    x: 0, y: 3.62, w: W, h: 0.85, align: 'center', fontFace: S.SERIF,
    fontSize: 40, color: S.INK, margin: 0, isTextBox: true,
  });
  s.addText('The next question is waiting. Ask it with us.  ·  representvote.com', {
    x: 0, y: 4.72, w: W, h: 0.3, align: 'center', fontFace: S.SANS,
    fontSize: 12, color: S.MUTED, margin: 0, isTextBox: true,
  });
}

pres.writeFile({ fileName: path.join(__dirname, 'Represent-Proof-of-Us-Investor.pptx') })
  .then(() => console.log('written'));
