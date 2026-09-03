// "The First Mark" design system, as corrected by the judge.
// Three voices: Cambria argues, Calibri explains, Courier keeps the record.
const pptxgen = require('pptxgenjs');

const INK = 'F4F5F6';
const SECONDARY = 'B8BABB';
const MUTED = '7A7D7E';
const GOLD = 'EABA58';
const OBSIDIAN = '040707';
const HAIR = '23282A'; // ~ink 8% flattened on obsidian

const SERIF = 'Cambria';
const SANS = 'Calibri';
const MONO = 'Courier New';

const W = 13.333, H = 7.5;
const ML = 0.9;             // left rail
const KICKER_Y = 0.66;
const HEAD_Y = 1.02;

function makePres() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'Lance Morrison';
  pres.company = 'Represent';
  return pres;
}

/** Every slide: obsidian ground + bare two-digit folio (no wordmark, no total). */
function slide(pres, state, opts = {}) {
  const s = pres.addSlide();
  s.background = { color: OBSIDIAN };
  state.n += 1;
  if (opts.folio !== false) folio(s, state.n);
  if (opts.notes) s.addNotes(opts.notes);
  return s;
}

/** Data-flavored mono kicker at the fixed datum. Never a named act. */
function folio(s, n) {
  s.addText(String(n).padStart(2, '0'), {
    x: 12.45, y: 6.94, w: 0.5, h: 0.24, align: 'right',
    fontFace: MONO, fontSize: 8, color: MUTED, margin: 0, isTextBox: true,
  });
}

function kicker(s, text, opts = {}) {
  s.addText(text.toUpperCase(), {
    x: opts.x ?? ML, y: opts.y ?? KICKER_Y, w: opts.w ?? 11.5, h: 0.26,
    fontFace: MONO, fontSize: 9, charSpacing: 3, color: MUTED,
    align: opts.align ?? 'left', margin: 0, isTextBox: true,
  });
}

/** runs: [{text, gold?}] — gold only where the judge's map allows. */
function runs2(runs) {
  return runs.map((r) => ({
    text: r.text,
    options: { color: r.gold ? GOLD : INK, breakLine: !!r.breakLine },
  }));
}

/** Slide headline: Cambria 28/32, sentence case, at the datum. */
function headline(s, runs, opts = {}) {
  s.addText(runs2(runs), {
    x: opts.x ?? ML, y: opts.y ?? HEAD_Y, w: opts.w ?? 11.5, h: opts.h ?? 1.1,
    fontFace: SERIF, fontSize: opts.size ?? 28, lineSpacing: opts.lineSpacing ?? 32,
    color: INK, align: opts.align ?? 'left', valign: 'top', margin: 0, isTextBox: true,
  });
}

/** Display statement: Cambria 40/46, max 3 lines. */
function display(s, runs, opts = {}) {
  s.addText(runs2(runs), {
    x: opts.x ?? ML, y: opts.y ?? HEAD_Y, w: opts.w ?? 10.4, h: opts.h ?? 2.6,
    fontFace: SERIF, fontSize: 40, lineSpacing: 46,
    color: INK, align: opts.align ?? 'left', valign: 'top', margin: 0, isTextBox: true,
  });
}

/** Calibri body block: 13/19, secondary, measure <= 4.8in. */
function body(s, lines, opts = {}) {
  const rr = lines.map((t, i) => ({
    text: t, options: { breakLine: true, ...(i > 0 ? { paraSpaceBefore: 8 } : {}) },
  }));
  s.addText(rr, {
    x: opts.x ?? ML, y: opts.y, w: opts.w ?? 4.8, h: opts.h ?? 2.2,
    fontFace: SANS, fontSize: 13, lineSpacing: 19, color: opts.color ?? SECONDARY,
    align: 'left', valign: 'top', margin: 0, isTextBox: true,
  });
}

/** Courier data annotation, tied to plate geometry. */
function ann(s, text, x, y, opts = {}) {
  s.addText(text.toUpperCase(), {
    x, y, w: opts.w ?? 3.4, h: opts.h ?? 0.22,
    fontFace: MONO, fontSize: opts.size ?? 8.5, charSpacing: 2,
    color: opts.gold ? GOLD : MUTED, align: opts.align ?? 'left',
    margin: 0, isTextBox: true,
  });
}

/** Source line, bottom-left. */
function source(s, text) {
  ann(s, text, ML, 6.98, { w: 7, size: 8 });
}

function hairline(s, x, y, w2, opts = {}) {
  s.addShape('rect', {
    x, y, w: w2, h: opts.h ?? 0.012,
    fill: { color: opts.color ?? HAIR }, line: { type: 'none' },
  });
}

/** Numbered mechanism step: hanging mono numeral + Calibri line. */
function step(s, y, num, mono, sans, opts = {}) {
  s.addText(num, {
    x: opts.x ?? ML, y, w: 0.4, h: 0.26, fontFace: MONO, fontSize: 9,
    color: MUTED, margin: 0, isTextBox: true,
  });
  s.addText(mono.toUpperCase(), {
    x: (opts.x ?? ML) + 0.5, y, w: opts.w ?? 4.4, h: 0.26,
    fontFace: MONO, fontSize: 10, charSpacing: 2, color: INK, margin: 0, isTextBox: true,
  });
  if (sans) {
    s.addText(sans, {
      x: (opts.x ?? ML) + 0.5, y: y + 0.28, w: opts.w ?? 4.4, h: 0.3,
      fontFace: SANS, fontSize: 11.5, color: SECONDARY, margin: 0, isTextBox: true,
    });
  }
}

/** COUNT stanza: figure, short hairline, mono label, optional note. */
function stanza(s, x, y, figure, label, note, opts = {}) {
  s.addText(figure, {
    x, y, w: opts.w ?? 2.6, h: 0.8, fontFace: SERIF, fontSize: 40,
    color: opts.gold ? GOLD : INK, margin: 0, isTextBox: true,
  });
  hairline(s, x, y + 0.92, 0.6);
  s.addText(label.toUpperCase(), {
    x, y: y + 1.02, w: opts.w ?? 2.6, h: 0.24, fontFace: MONO, fontSize: 8.5,
    charSpacing: 2, color: MUTED, margin: 0, isTextBox: true,
  });
  if (note) {
    s.addText(note, {
      x, y: y + 1.3, w: opts.w ?? 2.6, h: 0.55, fontFace: SANS, fontSize: 10.5,
      lineSpacing: 15, color: MUTED, margin: 0, isTextBox: true,
    });
  }
}

/** The First Mark: a single gold tally stroke. Cover and close only. */
function firstMark(s, cx, y0, y1) {
  s.addShape('rect', {
    x: cx - 0.01, y: y0, w: 0.02, h: y1 - y0,
    fill: { color: GOLD }, line: { type: 'none' },
  });
}

function wordmark(s, y) {
  s.addText('REPRESENT', {
    x: 0, y, w: W, h: 0.42, align: 'center', fontFace: SERIF, fontSize: 21,
    charSpacing: 6, color: INK, margin: 0, isTextBox: true,
  });
}

function plate(s, file, x, y, w2, h2) {
  s.addImage({ path: file, x, y, w: w2, h: h2 });
}

module.exports = {
  pptxgen, INK, SECONDARY, MUTED, GOLD, OBSIDIAN, HAIR, SERIF, SANS, MONO,
  W, H, ML, KICKER_Y, HEAD_Y,
  makePres, slide, folio, kicker, headline, display, body, ann, source, hairline,
  step, stanza, firstMark, wordmark, plate,
};
