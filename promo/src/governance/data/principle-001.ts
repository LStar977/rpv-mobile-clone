// PRINCIPLE 001 / 155 — reference film data.
//
// canonicalText and sentinelTest are EXACT source material from the approved
// build specification. Do not edit them here without the project owner's
// explicit approval — and never from rendering code.

import type { PrincipleFilm } from '../types';
import { FPS } from '../design';

const s = (sec: number) => Math.round(sec * FPS);

// Storyboard timing from the spec (sections in seconds):
// 0-3 open · 3-10 principle · 10-20 origin · 20-29 inversion ·
// 29-39 historical · 39-43 reflection · 43-54 sentinel · 54-59 close
const timeline = {
  open: s(3),
  principle: s(7),
  origin: s(10),
  inversion: s(9),
  historical: s(10),
  reflection: s(4),
  sentinel: s(11),
  close: s(5),
};

export const PRINCIPLE_001: PrincipleFilm = {
  id: '001',
  total: 155,
  sectionId: 'I',
  sectionTitle: 'The Nature of Rights',

  title: 'Rights Precede Government',

  canonicalText:
    'Rights exist prior to any institution or government and are inseparable from the individual human being.',

  sentinelTest:
    'If a right depends on permission, it is no longer a right - it is a privilege.',

  narration: [
    'Rights exist prior to any institution or government, and are inseparable from the individual human being.',
    'Freedom is older than politics.',
    'No legislature wrote the instinct to breathe free. No court decreed the will to live.',
    'When rights are treated as gifts of governance, they can be confiscated as easily as they are bestowed.',
    'Across centuries, the Magna Carta, the Declaration of Arbroath, and the American Declaration of Independence echo a recurring idea:',
    'Rights are remembered and rediscovered - not created.',
    'So when evaluating authority, apply the Sentinel Test:',
    'If a right depends on permission, it is no longer a right.',
    'It is a privilege.',
  ].join('\n\n'),

  targetDurationSeconds: 59,

  timeline,

  properOrder: {
    nodes: [
      { id: 'rights', label: 'RIGHTS' },
      { id: 'individual', label: 'INDIVIDUAL' },
      { id: 'governance', label: 'GOVERNANCE' },
    ],
    edges: [
      { from: 'rights', to: 'individual' },
      { from: 'individual', to: 'governance' },
    ],
  },
  invertedOrder: {
    nodes: [
      { id: 'governance', label: 'GOVERNANCE' },
      { id: 'permission', label: 'PERMISSION' },
      { id: 'individual', label: 'INDIVIDUAL' },
    ],
    edges: [
      { from: 'governance', to: 'permission' },
      { from: 'permission', to: 'individual' },
    ],
  },

  // Authentic public-domain scans, supplied by the project owner:
  // the 1215 Cotton MS Magna Carta, the Tyninghame copy of the Declaration
  // of Arbroath, and the 1823 Stone engraving of the Declaration of
  // Independence.
  historicalEvidence: [
    { title: 'MAGNA CARTA', year: '1215', asset: 'historical/magna-carta-1215.jpg' },
    { title: 'DECLARATION OF ARBROATH', year: '1320', asset: 'historical/arbroath-1320.jpg' },
    { title: 'DECLARATION OF INDEPENDENCE', year: '1776', asset: 'historical/independence-1776.jpg' },
  ],

  captions: [
    { startFrame: s(3), endFrame: s(10), text: 'Rights exist prior to any institution or government, and are inseparable from the individual human being.' },
    // 'Freedom is older than politics.' is on screen as teaching typography
    // at s(10)-s(20) — no caption duplicate (spec §11).
    { startFrame: s(14), endFrame: s(20), text: 'No legislature wrote the instinct to breathe free. No court decreed the will to live.' },
    { startFrame: s(20), endFrame: s(24.5), text: 'When rights are treated as gifts of governance,' },
    { startFrame: s(24.5), endFrame: s(29), text: 'they can be confiscated as easily as they are bestowed.' },
    { startFrame: s(29), endFrame: s(32.5), text: 'The Magna Carta, the Declaration of Arbroath, and the Declaration of Independence' },
    { startFrame: s(32.5), endFrame: s(35.5), text: 'echo a recurring idea:' },
    { startFrame: s(35.5), endFrame: s(39), text: 'Rights are remembered and rediscovered — not created.' },
    { startFrame: s(43), endFrame: s(46), text: 'So when evaluating authority, apply the Sentinel Test:' },
    { startFrame: s(46), endFrame: s(52), text: 'If a right depends on permission, it is no longer a right.' },
    { startFrame: s(52), endFrame: s(54), text: 'It is a privilege.' },
  ],
};
