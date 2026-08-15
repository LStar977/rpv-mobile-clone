// The master vertical composition: assembles any PrincipleFilm from its
// timeline data. Adding Principle 002 means adding a data file — not code.

import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { G } from './design';
import type { PrincipleFilm } from './types';
import { Captions } from './components/primitives';
import {
  ConceptDiagram,
  HistoricalEvidence,
  HumanOrigin,
  InstitutionalOpen,
  PrincipleStatement,
  Reflection,
  SentinelTest,
  SeriesClose,
} from './components/scenes';

export const filmDuration = (film: PrincipleFilm) =>
  Object.values(film.timeline).reduce((a, b) => a + b, 0);

export const PrincipleVertical: React.FC<{ film: PrincipleFilm }> = ({ film }) => {
  const t = film.timeline;
  let cursor = 0;
  const seq = (len: number) => {
    const from = cursor;
    cursor += len;
    return { from, durationInFrames: len };
  };

  const open = seq(t.open);
  const principle = seq(t.principle);
  const origin = seq(t.origin);
  const inversion = seq(t.inversion);
  const historical = seq(t.historical);
  const reflection = seq(t.reflection);
  const sentinel = seq(t.sentinel);
  const close = seq(t.close);

  return (
    <AbsoluteFill style={{ background: G.obsidian }}>
      <Sequence {...open}>
        <InstitutionalOpen film={film} total={open.durationInFrames} />
      </Sequence>
      <Sequence {...principle}>
        <PrincipleStatement film={film} total={principle.durationInFrames} />
      </Sequence>
      <Sequence {...origin}>
        <HumanOrigin total={origin.durationInFrames} />
      </Sequence>
      <Sequence {...inversion}>
        <ConceptDiagram film={film} total={inversion.durationInFrames} />
      </Sequence>
      <Sequence {...historical}>
        <HistoricalEvidence film={film} total={historical.durationInFrames} />
      </Sequence>
      <Sequence {...reflection}>
        <Reflection total={reflection.durationInFrames} />
      </Sequence>
      <Sequence {...sentinel}>
        <SentinelTest film={film} total={sentinel.durationInFrames} />
      </Sequence>
      <Sequence {...close}>
        <SeriesClose film={film} total={close.durationInFrames} />
      </Sequence>

      {/* Captions suppress themselves over the principle statement and the
          Sentinel Test, where the canonical words are already the screen. */}
      <Captions
        captions={film.captions}
        hideRanges={[
          { from: principle.from, to: principle.from + principle.durationInFrames },
          { from: sentinel.from, to: sentinel.from + sentinel.durationInFrames },
        ]}
      />

      {film.audio?.narration ? <Audio src={staticFile(film.audio.narration)} /> : null}
      {film.audio?.music ? <Audio src={staticFile(film.audio.music)} volume={0.14} /> : null}
    </AbsoluteFill>
  );
};
