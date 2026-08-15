// The Law Above Power — principle film data contract.
//
// Canonical content (canonicalText, sentinelTest) is SOURCE MATERIAL: the
// rendering system may never rewrite, truncate, or "fix" it. If text does not
// fit a layout, the layout changes — never the words. Narration is stored
// separately because spoken punctuation may legitimately differ from the
// canonical written form.

export type EmphasisStyle = 'gold' | 'large' | 'serif' | 'mono';

export type Caption = {
  /** Frame the caption appears, relative to film start. */
  startFrame: number;
  endFrame: number;
  text: string;
};

export type HistoricalItem = {
  title: string;
  year: string;
  /** Path under public/ to an AUTHENTIC scan. Absent = typographic card.
      Never point this at an invented or AI-generated document. */
  asset?: string;
  sourceNote?: string;
};

export type DiagramNode = { id: string; label: string };
export type DiagramEdge = { from: string; to: string };

export type PrincipleFilm = {
  id: string; // '001'
  total: number; // 155
  sectionId: string; // 'I'
  sectionTitle: string;

  title: string;

  canonicalText: string; // EXACT — never altered by presentation logic
  sentinelTest: string; // EXACT — never altered by presentation logic
  narration: string; // approved spoken script (reference only until audio exists)

  targetDurationSeconds: number;

  /** Scene timing in frames at 30fps. Centralized so pacing is data, not
      component-local magic numbers. */
  timeline: {
    open: number;
    principle: number;
    origin: number;
    inversion: number;
    historical: number;
    reflection: number;
    sentinel: number;
    close: number;
  };

  properOrder: { nodes: DiagramNode[]; edges: DiagramEdge[] };
  invertedOrder: { nodes: DiagramNode[]; edges: DiagramEdge[] };

  historicalEvidence: HistoricalItem[];

  audio?: {
    /** Path under public/ to the narration WAV once recorded. */
    narration?: string;
    music?: string;
  };

  captions: Caption[];
};
