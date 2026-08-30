// The emotional pitch deck — ten slides, one line each. The deck is scenery
// for the spoken pitch: each slide holds the sentence that should hang in the
// air behind Lance while he talks. The full spoken beat lives in the speaker
// notes so the deck rehearses the pitch by itself.
const pptxgen = require('pptxgenjs');
const fs = require('fs');

// ── Brand (mirrors pitch/deck/build.js) ─────────────────────────────────────
const INK = '040707';
const GOLD = 'EABA58';
const WHITE = 'F4F5F6';
const GREY = 'B8BABB';
const GREY_DIM = '7A7D7E';

const SERIF = 'Cambria'; // stands in for Newsreader
const SANS = 'Calibri'; // stands in for Onest
const MONO = 'Courier New'; // stands in for JetBrains Mono

const W = 13.333, H = 7.5, M = 0.9;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = 'Lance Morrison';
pres.company = 'Represent';
pres.title = 'Represent — The Other 1,460 Days';

const ICON = 'image/png;base64,' +
  fs.readFileSync(__dirname + '/../deck/icon.png').toString('base64');

// ── Helpers ─────────────────────────────────────────────────────────────────
let slideNo = 0;
const slide = (notes) => {
  const s = pres.addSlide();
  s.background = { color: INK };
  slideNo += 1;
  // Footer: wordmark left, slide number right — the only recurring chrome.
  s.addText('REPRESENT', {
    x: M, y: H - 0.62, w: 3, h: 0.3,
    fontFace: MONO, fontSize: 10, charSpacing: 4, color: GREY_DIM,
    margin: 0, isTextBox: true,
  });
  s.addText(`${String(slideNo).padStart(2, '0')} / 10`, {
    x: W - M - 2, y: H - 0.62, w: 2, h: 0.3, align: 'right',
    fontFace: MONO, fontSize: 10, charSpacing: 2, color: GREY_DIM,
    margin: 0, isTextBox: true,
  });
  if (notes) s.addNotes(notes);
  return s;
};

/** The one big statement. */
const statement = (s, runs, opts = {}) =>
  s.addText(runs, {
    x: M, y: opts.y ?? 2.1, w: W - 2 * M, h: opts.h ?? 3.2,
    fontFace: SERIF, fontSize: opts.size ?? 44,
    color: WHITE, align: opts.align ?? 'left', valign: 'top',
    lineSpacingMultiple: 1.18, margin: 0, isTextBox: true,
  });

const eyebrow = (s, text, opts = {}) =>
  s.addText(text.toUpperCase(), {
    x: M, y: opts.y ?? 1.35, w: W - 2 * M, h: 0.34,
    fontFace: MONO, fontSize: 13, charSpacing: 5,
    color: opts.color ?? GOLD, align: opts.align ?? 'left',
    margin: 0, isTextBox: true,
  });

/** The threshold-dot motif: ten dots, n of them gold. */
const dots = (s, n, opts = {}) => {
  const cx = opts.x ?? M, cy = opts.y ?? 5.6, d = 0.17, gap = 0.31;
  for (let i = 0; i < 10; i++) {
    s.addShape('ellipse', {
      x: cx + i * gap, y: cy, w: d, h: d,
      fill: { color: i < n ? GOLD : '3A3F40' },
      line: { type: 'none' },
    });
  }
};

// ── 01 · Cover ──────────────────────────────────────────────────────────────
{
  const s = slide(
    'Do not read this slide aloud. Let it sit while you greet the room, then begin with the school gym.'
  );
  s.addImage({ data: ICON, x: M, y: 1.5, w: 0.85, h: 0.85 });
  statement(s, [
    { text: 'A bet on the goodness', options: { breakLine: true } },
    { text: 'of ordinary people.', options: {} },
  ], { y: 2.75, size: 52 });
  s.addText('REPRESENT · A PITCH BY LANCE MORRISON', {
    x: M, y: 5.55, w: 8, h: 0.32,
    fontFace: MONO, fontSize: 12, charSpacing: 4, color: GREY_DIM,
    margin: 0, isTextBox: true,
  });
  dots(s, 10, { y: 6.15 });
}

// ── 02 · The gym ────────────────────────────────────────────────────────────
{
  const s = slide(
    'The most hopeful thing I have ever seen happens in a school gym, every four years. People line up to vote — and everybody in that line knows it probably changes nothing. They show up anyway. Billions of them, around the world. Each carrying the same small, stubborn hope: maybe this time, my life gets a little better.'
  );
  eyebrow(s, 'Every four years');
  statement(s, [
    { text: 'Everybody in that line knows it changes nothing.', options: { breakLine: true } },
    { text: 'They show up anyway.', options: { color: GOLD } },
  ], { size: 42 });
  dots(s, 1);
}

// ── 03 · One day ────────────────────────────────────────────────────────────
{
  const s = slide(
    'Then the doors close. And the next morning, every single one of them goes back to being a spectator — for four years.'
  );
  s.addText('1', {
    x: M, y: 1.7, w: 3.4, h: 2.6,
    fontFace: SERIF, fontSize: 150, color: GOLD, align: 'left',
    margin: 0, isTextBox: true,
  });
  s.addText('DAY WITH A VOICE', {
    x: M + 0.06, y: 4.35, w: 4, h: 0.34,
    fontFace: MONO, fontSize: 13, charSpacing: 4, color: GREY,
    margin: 0, isTextBox: true,
  });
  s.addText('1,460', {
    x: 6.4, y: 1.7, w: 6, h: 2.6,
    fontFace: SERIF, fontSize: 150, color: GREY_DIM, align: 'left',
    margin: 0, isTextBox: true,
  });
  s.addText('DAYS AS A SPECTATOR', {
    x: 6.46, y: 4.35, w: 5, h: 0.34,
    fontFace: MONO, fontSize: 13, charSpacing: 4, color: GREY_DIM,
    margin: 0, isTextBox: true,
  });
}

// ── 04 · The ache ───────────────────────────────────────────────────────────
{
  const s = slide(
    'And we all know what those four years feel like, because we live them. Everything gets more expensive. Everything gets harder. Groceries, rent, a house your kids will never afford. Maybe it is incompetence, maybe it is malice — honestly, it does not matter which. The result is identical: decisions land on your life, and nobody asked you.'
  );
  eyebrow(s, 'The four years in between');
  statement(s, [
    { text: 'Everything gets more expensive.', options: { breakLine: true } },
    { text: 'Everything gets harder.', options: { breakLine: true } },
    { text: 'And nobody asked you.', options: { color: GOLD } },
  ], { size: 42 });
  dots(s, 0);
}

// ── 05 · The wall ───────────────────────────────────────────────────────────
{
  const s = slide(
    'And when you try to be heard, every door ends the same way. Write your representative — form letter. Sign a petition — could be bots. Go to a protest — a loud minority, waved off. Every channel a person has leads to the same wall.'
  );
  statement(s, [
    { text: 'You are the opinion of one.', options: { breakLine: true } },
    { text: 'And the opinion of one is nothing.', options: { color: GREY } },
  ], { y: 1.8, size: 42 });
  const rows = [
    ['WRITE YOUR REPRESENTATIVE', 'A FORM LETTER'],
    ['SIGN A PETITION', '“COULD BE BOTS”'],
    ['JOIN A PROTEST', '“A LOUD MINORITY”'],
  ];
  rows.forEach((r, i) => {
    const y = 4.35 + i * 0.62;
    s.addText(r[0], {
      x: M, y, w: 4.6, h: 0.36, fontFace: MONO, fontSize: 13,
      charSpacing: 2, color: GREY, margin: 0, isTextBox: true,
    });
    s.addText(r[1], {
      x: 5.9, y, w: 5.5, h: 0.36, fontFace: MONO, fontSize: 13,
      charSpacing: 2, color: GREY_DIM, margin: 0, isTextBox: true,
    });
  });
}

// ── 06 · The turn ───────────────────────────────────────────────────────────
{
  const s = slide(
    'Pause before this slide. Then: You get one day every four years. We built the other one thousand, four hundred and sixty.'
  );
  statement(s, [
    { text: 'We built the other', options: { breakLine: true } },
    { text: '1,460 days.', options: { color: GOLD } },
  ], { y: 2.4, size: 66, align: 'center' });
  dots(s, 10, { x: W / 2 - 1.55, y: 5.5 });
}

// ── 07 · The vision ─────────────────────────────────────────────────────────
{
  const s = slide(
    'Represent is live on the App Store right now. But forget the technology — we have had this technology for twenty-five years. Here is what it actually is: a mom in Calgary deciding whether her kid’s school gets built, from her kitchen table, on a Tuesday night. Verified as one real person, counted once, on a public record. And a feeling most people have never had: being asked. Being asked feels like being respected.'
  );
  eyebrow(s, 'What it actually is');
  statement(s, [
    { text: 'A mom in Calgary deciding whether her kid’s school gets built. From her kitchen table. ', options: {} },
    { text: 'Counted once.', options: { color: GOLD } },
  ], { size: 38, h: 2.6 });
  s.addText('ONE VERIFIED HUMAN   ·   ONE VOTE   ·   ON THE PUBLIC RECORD', {
    x: M, y: 5.0, w: W - 2 * M, h: 0.36,
    fontFace: MONO, fontSize: 13, charSpacing: 3, color: GREY,
    margin: 0, isTextBox: true,
  });
}

// ── 08 · Calgary asked once ─────────────────────────────────────────────────
{
  const s = slide(
    'The last time this city dared to ask its people one question — the 2018 Olympic plebiscite — the vote cost 2.2 million dollars, the process took the better part of three years, and the infrastructure was dismantled the next day. On Represent, that question is free, and it closes by Friday.'
  );
  eyebrow(s, 'The last time Calgary asked its people a question');
  const stats = [
    ['$2.2M', 'TO RUN ONE VOTE'],
    ['3 YEARS', 'COMMITTEE TO ANSWER'],
    ['1 DAY', 'THEN IT WAS TAKEN APART'],
  ];
  stats.forEach((st, i) => {
    const x = M + i * 3.95;
    s.addText(st[0], {
      x, y: 2.15, w: 3.6, h: 1.2, fontFace: SERIF, fontSize: 58,
      color: WHITE, margin: 0, isTextBox: true,
    });
    s.addText(st[1], {
      x: x + 0.02, y: 3.45, w: 3.6, h: 0.6, fontFace: MONO, fontSize: 12,
      charSpacing: 2, color: GREY_DIM, margin: 0, isTextBox: true,
    });
  });
  s.addText([
    { text: 'On Represent: ', options: { color: GREY } },
    { text: 'free, and answered by Friday.', options: { color: GOLD } },
  ], {
    x: M, y: 4.7, w: W - 2 * M, h: 0.9, fontFace: SERIF, fontSize: 32,
    margin: 0, isTextBox: true,
  });
}

// ── 09 · The creed ──────────────────────────────────────────────────────────
{
  const s = slide(
    'So why am I doing this? Because I believe something our entire system quietly does not: when people get the chance to decide for themselves, they choose good. Not every person, not every time. But the majority, over time, chooses good. Every civilization that collapsed, collapsed on decisions ordinary people would never have made — and in every one of them, the good people were the majority. They just never had an instrument. Everything about how we are governed assumes people cannot be trusted with decisions. Represent is the opposite bet.'
  );
  statement(s, [
    { text: 'The majority', options: { color: GOLD, breakLine: true } },
    { text: 'chooses good.', options: { color: GOLD } },
  ], { y: 2.3, size: 80, align: 'center' });
}

// ── 10 · The invitation ─────────────────────────────────────────────────────
{
  const s = slide(
    'We are not asking anyone to fund an app. We are asking them to help prove that the majority chooses good — because if that is true, everything about how we govern ourselves changes. Every generation before us wanted this. We are the first one that can actually build it. It exists. It is live. It is small. Help us make it inevitable.'
  );
  s.addImage({ data: ICON, x: W / 2 - 0.45, y: 1.35, w: 0.9, h: 0.9 });
  statement(s, [
    { text: 'Every generation wanted this.', options: { breakLine: true } },
    { text: 'We’re the first that can build it.', options: { color: GOLD } },
  ], { y: 2.6, size: 44, align: 'center', h: 2.2 });
  s.addText('LIVE ON THE APP STORE   ·   REPRESENTVOTE.COM', {
    x: M, y: 5.35, w: W - 2 * M, h: 0.36, align: 'center',
    fontFace: MONO, fontSize: 13, charSpacing: 3, color: GREY,
    margin: 0, isTextBox: true,
  });
}

pres.writeFile({ fileName: __dirname + '/Represent-The-Other-1460-Days.pptx' })
  .then(() => console.log('written'));
