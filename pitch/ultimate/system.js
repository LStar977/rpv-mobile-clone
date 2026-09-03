// The deck's design system, codified from the approved visual spec.
// Content lives in build.js; nothing in here knows what any slide says.
const pptxgen = require('pptxgenjs');
const fs = require('fs');

const INK = 'F4F5F6';
const SECONDARY = 'B8BABB';
const MUTED = '7A7D7E';
const GOLD = 'EABA58';
const GOLD_FILL = 'C99A38';
const OBSIDIAN = '040707';
const HAIR = '2A2F30'; // hairline on obsidian ~ rgba(244,245,246,0.08) flattened

const SERIF = 'Cambria';
const SANS = 'Calibri';
const MONO = 'Courier New';

const W = 13.333, H = 7.5;
const ML = W * 0.083;          // left/right margin 8.3%
const MT = H * 0.093;          // top margin
const DATUM = H * 0.22;        // headline datum: statements hang here
const CHROME_Y = H - 0.52;

function makePres() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = 'Lance Morrison';
  pres.company = 'Represent';
  pres.title = 'Represent';
  return pres;
}

/** Percent-of-slide-height to points (slide height 7.5in = 540pt). */
const pct = (p) => Math.round(540 * p);

function baseSlide(pres, state, opts = {}) {
  const s = pres.addSlide();
  s.background = { color: OBSIDIAN };
  state.n += 1;
  if (!opts.ceremonial) {
    s.addText('REPRESENT', {
      x: ML, y: CHROME_Y, w: 3, h: 0.3, fontFace: MONO, fontSize: 9,
      charSpacing: 4, color: MUTED, margin: 0, isTextBox: true,
    });
    s.addText(`${String(state.n).padStart(2, '0')} / ${state.total}`, {
      x: W - ML - 2, y: CHROME_Y, w: 2, h: 0.3, align: 'right',
      fontFace: MONO, fontSize: 9, charSpacing: 2, color: MUTED, margin: 0, isTextBox: true,
    });
    if (opts.section) {
      s.addText(opts.section.toUpperCase(), {
        x: W - ML - 4.5, y: MT - 0.1, w: 4.5, h: 0.3, align: 'right',
        fontFace: MONO, fontSize: 9.5, charSpacing: 3, color: MUTED, margin: 0, isTextBox: true,
      });
    }
  }
  if (opts.notes) s.addNotes(opts.notes);
  return s;
}

/** The one statement per slide. runs: [{text, gold?, secondary?}] */
function statement(s, runs, opts = {}) {
  const rr = runs.map((r, i) => ({
    text: r.text,
    options: {
      color: r.gold ? GOLD : r.secondary ? SECONDARY : INK,
      breakLine: !!r.breakLine,
    },
  }));
  s.addText(rr, {
    x: opts.x ?? ML, y: opts.y ?? DATUM, w: opts.w ?? W - 2 * ML, h: opts.h ?? 2.4,
    fontFace: SERIF, fontSize: opts.size ?? 40,
    color: INK, align: opts.align ?? 'left', valign: 'top',
    lineSpacingMultiple: 1.08, margin: 0, isTextBox: true,
  });
}

/** Mono label (caps, letterspaced). */
function label(s, text, opts = {}) {
  s.addText(text.toUpperCase(), {
    x: opts.x ?? ML, y: opts.y ?? DATUM - 0.55, w: opts.w ?? W - 2 * ML, h: 0.32,
    fontFace: MONO, fontSize: opts.size ?? 11, charSpacing: opts.charSpacing ?? 4,
    color: opts.gold ? GOLD : MUTED, align: opts.align ?? 'left', margin: 0, isTextBox: true,
  });
}

/** Hairline rule. */
function hairline(s, x, y, w2, color) {
  s.addShape('rect', { x, y, w: w2, h: 0.012, fill: { color: color || HAIR }, line: { type: 'none' } });
}

/** Ledger row: NAME · value · qualifier, hairline below. */
function ledgerRow(s, y, name, value, qualifier, opts = {}) {
  s.addText(name.toUpperCase(), {
    x: opts.x ?? ML, y, w: opts.nameW ?? 4.4, h: 0.42, fontFace: MONO, fontSize: opts.size ?? 12,
    charSpacing: 3, color: opts.nameColor ?? MUTED, margin: 0, isTextBox: true, valign: 'middle',
  });
  s.addText(value, {
    x: (opts.x ?? ML) + (opts.nameW ?? 4.4), y, w: opts.valueW ?? 2.6, h: 0.42, align: 'right',
    fontFace: MONO, fontSize: opts.size ?? 12, charSpacing: 1,
    color: opts.valueGold ? GOLD : INK, margin: 0, isTextBox: true, valign: 'middle', bold: false,
  });
  if (qualifier) {
    s.addText(qualifier.toUpperCase(), {
      x: (opts.x ?? ML) + (opts.nameW ?? 4.4) + (opts.valueW ?? 2.6) + 0.35, y,
      w: opts.qualW ?? 3.2, h: 0.42, fontFace: MONO, fontSize: (opts.size ?? 12) - 2,
      charSpacing: 2, color: MUTED, margin: 0, isTextBox: true, valign: 'middle',
    });
  }
  if (!opts.noRule) hairline(s, opts.x ?? ML, y + 0.5, (opts.ruleW ?? ((opts.nameW ?? 4.4) + (opts.valueW ?? 2.6) + 3.55)));
}

/** The 10-dot threshold row, n lit. */
function thresholdDots(s, x, y, n, opts = {}) {
  const d = opts.d ?? 0.16, gap = opts.gap ?? 0.30;
  for (let i = 0; i < 10; i++) {
    s.addShape('ellipse', {
      x: x + i * gap, y, w: d, h: d,
      fill: { color: i < n ? GOLD : '2E3435' }, line: { type: 'none' },
    });
  }
}

/** Full-height right photo panel; its fade to obsidian is baked into the file. */
function photo(s, file, iw, ih) {
  const w2 = H * (iw / ih);
  s.addImage({ path: file, x: W - w2, y: 0, w: w2, h: H });
}

module.exports = {
  pptxgen, fs, INK, SECONDARY, MUTED, GOLD, GOLD_FILL, OBSIDIAN, HAIR,
  SERIF, SANS, MONO, W, H, ML, MT, DATUM, pct,
  makePres, baseSlide, statement, label, hairline, ledgerRow, thresholdDots, photo,
};
