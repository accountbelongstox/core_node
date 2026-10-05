import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrchVideoSettings } from '../../../../core/integrations/pycore';
import type { OrchComposeItem, OrchComposeSentence, OrchComposeTask, OrchWordState } from '../../../../shared/orchestration/orchTypes';
import { buildStageCards, orchEntryPlayable, type OrchStageCard, type OrchTimelineEntry } from '../../../../shared/orchestration/orchStageLayout';
import { useOrchSequencer, type OrchSequencer } from '../../../../shared/orchestration/useOrchSequencer';
import { wordNewOrchVirtualReads } from '../../services/orchestration/WordNewOrchVirtualReads';
import type { OrchPlaybackEdition } from '../../services/orchestration/WordNewOrchEditionStore';
import type { OrchPlaybackPosition } from '../../services/orchestration/WordNewOrchPlaybackStore';

export const ORCH_COMPOSE_RATES = [0.75, 1, 1.25, 1.5] as const;
const LABEL_MAX = 80;

/** What a player plays: the task's static edition (preview and player page). */
export interface OrchPlaybackSource {
  editionId: string;
  timelines: OrchTimelineEntry[][];
  sentences: OrchComposeSentence[];
  meaningOf: (word: string) => string;
  /** The meaning shown for a phrase (lower-case text) whose meaning clip is not spoken. */
  phraseMeaningOf: (phrase: string) => string;
  newWords: ReadonlySet<string>;
  wordStates: ReadonlyMap<string, OrchWordState>;
}

export interface WordNewOrchComposePlayback {
  segment: number;
  segmentCount: number;
  setSegment: (segment: number) => void;
  rate: number;
  setRate: (rate: number) => void;
  timeline: OrchTimelineEntry[];
  cards: OrchStageCard[];
  newWords: ReadonlySet<string>;
  sequencer: OrchSequencer;
  /** The current position (null with nothing to play). */
  position: () => OrchPlaybackPosition | null;
  /** Go to a saved position (its clip, else its time) and optionally play from there. */
  jumpTo: (position: OrchPlaybackPosition, play: boolean) => void;
}

function anchorOf(item: OrchComposeItem): string {
  return `${item.kind}:${item.language}:${item.seq}:${item.text}`;
}

function entryIndexAt(timeline: OrchTimelineEntry[], ms: number): number {
  let hit = -1;
  for (let index = 0; index < timeline.length; index += 1) {
    if (timeline[index].startMs <= ms) hit = index;
    else break;
  }
  return hit;
}

/** Seconds on the timeline of a saved position: its clip when this timeline has it, else its time. */
function timeOf(timeline: OrchTimelineEntry[], position: OrchPlaybackPosition): number {
  if (position.anchor) {
    const matches = timeline.filter((entry) => anchorOf(entry.item) === position.anchor);
    if (matches.length > 0) {
      const nearest = matches.reduce((best, entry) => (
        Math.abs(entry.startMs / 1000 - position.time) < Math.abs(best.startMs / 1000 - position.time) ? entry : best
      ));
      return nearest.startMs / 1000 + Math.min(position.offset, (nearest.endMs - nearest.startMs) / 1000);
    }
  }
  const end = (timeline[timeline.length - 1]?.endMs ?? 0) / 1000;
  return Math.max(0, Math.min(position.time, end));
}

/** An edition as a playback source (changes only when an edition is published). */
export function useEditionPlaybackSource(edition: OrchPlaybackEdition | null): OrchPlaybackSource | null {
  return useMemo(() => (edition ? {
    editionId: edition.id,
    timelines: edition.timelines,
    sentences: edition.sentences,
    meaningOf: (word: string) => edition.meanings[word] ?? '',
    phraseMeaningOf: (phrase: string) => edition.phraseMeanings?.[phrase] ?? '',
    newWords: new Set(edition.newWords),
    wordStates: new Map(Object.entries(edition.words)),
  } : null), [edition]);
}

/**
 * Playback of a source: the segment on the stage, its cards and the sequencer
 * clock. Played words go into the task's virtual read batch; the end of a
 * segment plays the next one.
 */
export function useWordNewOrchComposePlayback(
  task: OrchComposeTask | null | undefined,
  source: OrchPlaybackSource | null,
  settings: OrchVideoSettings | null,
): WordNewOrchComposePlayback {
  const [segment, setSegment] = useState(0);
  const [rate, setRate] = useState(1);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const pendingJumpRef = useRef<{ position: OrchPlaybackPosition; play: boolean } | null>(null);
  const [jumpTick, setJumpTick] = useState(0);

  const timelines = source?.timelines;
  const segmentCount = timelines?.length ?? 0;
  const timeline = useMemo(() => timelines?.[segment] ?? [], [timelines, segment]);
  const cards = useMemo(() => {
    if (!source || !settings) return [];
    return buildStageCards(timeline, source.sentences, settings.languages, source.meaningOf, source.phraseMeaningOf);
  }, [source, settings, timeline]);
  const newWords = useMemo(() => source?.newWords ?? new Set<string>(), [source]);

  useEffect(() => {
    if (segment > 0 && segment >= segmentCount) setSegment(0);
  }, [segment, segmentCount]);

  const sequencer = useOrchSequencer(timeline, rate, () => {
    if (segment + 1 < segmentCount) {
      setAutoPlayNext(true);
      setSegment(segment + 1);
    }
  });

  const recordedRef = useRef(new Set<string>());
  useEffect(() => { recordedRef.current = new Set(); }, [timeline]);
  useEffect(() => {
    if (!task || !source || !sequencer.playing) return;
    const now = sequencer.time * 1000;
    const words: string[] = [];
    timeline.forEach((entry, index) => {
      if (entry.item.kind !== 'word' || entry.endMs > now || !orchEntryPlayable(entry)) return;
      const key = `${segment}:${index}`;
      if (recordedRef.current.has(key)) return;
      recordedRef.current.add(key);
      words.push(entry.item.text.toLowerCase());
    });
    if (words.length > 0) wordNewOrchVirtualReads.played(task, words, source.wordStates);
  }, [sequencer.time, sequencer.playing, timeline, segment, task, source]);

  useEffect(() => {
    if (!autoPlayNext) return;
    // The flag is consumed by the segment it was set for, even an empty one.
    setAutoPlayNext(false);
    if (timeline.length > 0) sequencer.play();
  }, [autoPlayNext, timeline, sequencer]);

  // A jump lands once its segment's timeline is on the sequencer (after its reset to 0).
  useEffect(() => {
    const jump = pendingJumpRef.current;
    if (!jump || jump.position.segment !== segment || timeline.length === 0) return;
    pendingJumpRef.current = null;
    sequencer.seek(timeOf(timeline, jump.position));
    if (jump.play) sequencer.play();
  }, [jumpTick, segment, timeline, sequencer]);

  const jumpTo = useCallback((position: OrchPlaybackPosition, play: boolean): void => {
    const target = Math.max(0, Math.min(position.segment, Math.max(0, segmentCount - 1)));
    pendingJumpRef.current = { position: { ...position, segment: target }, play };
    setSegment(target);
    setJumpTick((tick) => tick + 1);
  }, [segmentCount]);

  const position = useCallback((): OrchPlaybackPosition | null => {
    if (!source || timeline.length === 0) return null;
    const time = sequencer.timeRef.current;
    const entry = timeline[entryIndexAt(timeline, time * 1000)];
    const label = entry ? (entry.item.meaningOf ?? entry.item.text) : '';
    return {
      segment,
      time,
      anchor: entry ? anchorOf(entry.item) : '',
      offset: entry ? Math.max(0, time - entry.startMs / 1000) : 0,
      label: label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX - 1)}…` : label,
      editionId: source.editionId,
      at: new Date().toISOString(),
    };
  }, [source, timeline, segment, sequencer.timeRef]);

  return { segment, segmentCount, setSegment, rate, setRate, timeline, cards, newWords, sequencer, position, jumpTo };
}
