import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WfNewBookVerse, WfNewOrchAudioDetail } from '../../api';
import { WordNewBookReaderPlayback } from '../../services/WordNewBookReaderPlayback';
import { moveSentenceAudioToHeadImmediate } from '../../services/WordNewBookReaderSentenceAudio';
import { readWordCardsForSentence } from '../../services/WordNewBookReaderWordCards';
import {
  useWordNewSentenceAudioCells,
  type WordNewSentenceAudioCells,
} from '../../hooks/useWordNewSentenceAudioCells';
import {
  activeSegmentSentencePosition,
  loadOrchAudioSettings,
  mergeOrchAudioSettings,
  ORCH_SEGMENT_GRAIN,
  ORCH_SENTENCE_GRAIN,
  orchAudioLanguages,
  orchAudioPlaySequence,
  saveOrchAudioSettings,
  segmentToVerse,
  sentenceToVerse,
  type OrchAudioPlaybackSettings,
} from './orchAudioModel';
import { useOrchAudioSentencePages, type OrchAudioSentencePages } from './useOrchAudioSentencePages';

const NO_VARIANTS: Record<string, string> = {};
/** Prefetch the next sentence page when playback is this close to its end. */
const PREFETCH_SENTENCES = 20;

export interface OrchAudioPlayback {
  settings: OrchAudioPlaybackSettings;
  langs: string[];
  displayLangs: string[];
  sentences: OrchAudioSentencePages;
  /** Verses of every loaded sentence page, in position order. */
  sentenceVerses: WfNewBookVerse[];
  cells: WordNewSentenceAudioCells;
  playing: boolean;
  paused: boolean;
  playingKey: string | null;
  activeSegmentIndex: number | null;
  activeSentencePosition: number | null;
  currentTime: number;
  duration: number;
  playPause: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  playSegment: (index: number) => void;
  playSentence: (verse: WfNewBookVerse, lang?: string) => void;
  updateSettings: (patch: Partial<OrchAudioPlaybackSettings>) => void;
}

/** Orchestrated audio playback on the shared sequence engine. Segment mp3s are
 * one verse list; sentences are verse pages that the engine walks with its
 * own page advance (loadVerses), so sentence pages load on demand. */
export function useOrchAudioPlayback(detail: WfNewOrchAudioDetail): OrchAudioPlayback {
  const [settings, setSettings] = useState<OrchAudioPlaybackSettings>(loadOrchAudioSettings);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [activeVerse, setActiveVerse] = useState<WfNewBookVerse | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const settingsRef = useRef(settings);
  const playbackRef = useRef<WordNewBookReaderPlayback | null>(null);
  /** The sentence page the engine is walking (sentence mode). */
  const enginePageRef = useRef(1);

  const sentences = useOrchAudioSentencePages(detail);
  const langs = useMemo(() => orchAudioLanguages(detail, sentences.loaded), [detail, sentences.loaded]);
  const primaryLang = langs[0] || 'en';
  const displayLangs = useMemo(
    () => (settings.bilingual ? langs : [primaryLang]),
    [settings.bilingual, langs, primaryLang],
  );
  const sentenceVerses = useMemo(() => sentences.loaded.map(sentenceToVerse), [sentences.loaded]);
  const segmentVerses = useMemo(
    () => detail.segments.map((segment) => segmentToVerse(
      segment,
      sentences.sentenceAt,
      primaryLang,
      detail.item.previewText || detail.item.title,
    )),
    // sentences.loaded changes whenever a page lands, which refreshes segment text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail, primaryLang, sentences.loaded, sentences.sentenceAt],
  );
  const cells = useWordNewSentenceAudioCells({
    verses: sentenceVerses,
    langs: displayLangs,
    variantByLang: NO_VARIANTS,
    scopeKey: detail.item.id,
  });

  const langsRef = useRef(langs);
  const sentencesRef = useRef(sentences);
  const segmentVersesRef = useRef(segmentVerses);
  const resolveAudioUrlRef = useRef(cells.resolveAudioUrl);
  useEffect(() => { langsRef.current = langs; }, [langs]);
  useEffect(() => { sentencesRef.current = sentences; }, [sentences]);
  useEffect(() => { segmentVersesRef.current = segmentVerses; }, [segmentVerses]);
  useEffect(() => { resolveAudioUrlRef.current = cells.resolveAudioUrl; }, [cells.resolveAudioUrl]);

  useEffect(() => {
    const segmentMode = (): boolean => settingsRef.current.mode === 'segments';
    const pageVerses = (page: number): WfNewBookVerse[] => (
      sentencesRef.current.pageSentences(page).map(sentenceToVerse)
    );
    const playback = new WordNewBookReaderPlayback({
      getVerses: () => (segmentMode() ? segmentVersesRef.current : pageVerses(enginePageRef.current)),
      getSettings: () => {
        const current = settingsRef.current;
        const speedByLang = Object.fromEntries(langsRef.current.map((lang) => [lang, current.rate]));
        return {
          sequence: current.mode === 'segments'
            ? [{ lang: langsRef.current[0] || 'en', repeat: 1 }]
            : orchAudioPlaySequence(langsRef.current, current),
          speedByLang,
          autoAdvance: true,
          repeatOne: current.repeat === 'one',
        };
      },
      useBrowserTts: () => true,
      onPlayingKey: setPlayingKey,
      onPlaying: setPlaying,
      onPaused: setPaused,
      onVerseActive: (verse) => {
        setActiveVerse(verse);
        setCurrentTime(0);
        setDuration(0);
      },
      onProgress: () => undefined,
      onTimeUpdate: (time, total) => {
        setCurrentTime(time);
        setDuration(total);
      },
      loadVerses: async (_chapterIndex, page, opts) => {
        if (segmentMode()) return null;
        if (opts?.requirePlaying && !playback.isPlaying()) return null;
        await sentencesRef.current.ensurePage(page);
        const verses = pageVerses(page);
        if (!verses.length) return null;
        enginePageRef.current = page;
        return verses;
      },
      getChapterIndex: () => null,
      getPage: () => (segmentMode() ? 1 : enginePageRef.current),
      getLastPage: () => (segmentMode() ? 1 : sentencesRef.current.pageCount),
      goNextChapter: async () => {
        if (settingsRef.current.repeat !== 'all') return false;
        if (!segmentMode()) {
          await sentencesRef.current.ensurePage(1);
          enginePageRef.current = 1;
        }
        const first = segmentMode() ? segmentVersesRef.current[0] : pageVerses(1)[0];
        if (!first) return false;
        void playback.playFrom(first);
        return true;
      },
      resolveAudioUrl: (verse, lang, shouldContinue) => resolveAudioUrlRef.current(verse, lang, shouldContinue),
      moveMissingAudioToHead: (verse, lang, text) => {
        if (verse.grain === ORCH_SENTENCE_GRAIN) void moveSentenceAudioToHeadImmediate(text, lang);
      },
      wordCards: {
        isEnabled: () => settingsRef.current.mode === 'sentences' && settingsRef.current.wordsBefore,
        getPosition: () => 'before',
        readForVerse: async (verse, shouldContinue) => {
          const sentence = verse.text?.trim() || '';
          if (sentence) await readWordCardsForSentence(sentence, shouldContinue, 1, 'all');
        },
      },
    });
    playbackRef.current = playback;
    return () => playback.stop();
  }, [detail.item.id]);

  const updateSettings = useCallback((patch: Partial<OrchAudioPlaybackSettings>) => {
    const next = mergeOrchAudioSettings(settingsRef.current, patch);
    if (next.mode !== settingsRef.current.mode) playbackRef.current?.stop();
    settingsRef.current = next;
    setSettings(next);
    saveOrchAudioSettings(next);
  }, []);

  const playSegment = useCallback((index: number) => {
    const segment = detail.segments.find((item) => item.index === index);
    if (!segment) return;
    if (settingsRef.current.mode !== 'segments') updateSettings({ mode: 'segments' });
    // Jump: load the segment's sentence pages first so the highlight has text.
    void sentencesRef.current.ensureRange(segment.start, segment.end).then(() => {
      const verse = segmentVersesRef.current.find((item) => item.seq === index);
      if (verse) void playbackRef.current?.playFrom(verse);
    });
  }, [detail.segments, updateSettings]);

  const playSentence = useCallback((verse: WfNewBookVerse, lang?: string) => {
    if (settingsRef.current.mode !== 'sentences') updateSettings({ mode: 'sentences' });
    enginePageRef.current = sentencesRef.current.pageOf(verse.seq);
    void playbackRef.current?.playFrom(verse, lang);
  }, [updateSettings]);

  const playPause = useCallback(() => {
    const playback = playbackRef.current;
    if (!playback) return;
    if (playback.isPlaying()) {
      playback.togglePause();
      return;
    }
    if (settingsRef.current.mode === 'segments') {
      const verses = segmentVersesRef.current;
      const resume = activeVerse?.grain === ORCH_SEGMENT_GRAIN
        ? verses.find((verse) => verse.seq === activeVerse.seq)
        : undefined;
      const start = resume ?? verses[0];
      if (start) playSegment(start.seq);
      return;
    }
    const resume = activeVerse?.grain === ORCH_SENTENCE_GRAIN ? activeVerse : null;
    const start = resume ?? sentencesRef.current.pageSentences(1).map(sentenceToVerse)[0];
    if (start) playSentence(start);
  }, [activeVerse, playSegment, playSentence]);

  const stop = useCallback(() => playbackRef.current?.stop(), []);
  const next = useCallback(() => { void playbackRef.current?.stepSentence(1); }, []);
  const prev = useCallback(() => { void playbackRef.current?.stepSentence(-1); }, []);

  const activeSegment = activeVerse?.grain === ORCH_SEGMENT_GRAIN
    ? detail.segments.find((segment) => segment.index === activeVerse.seq) ?? null
    : null;
  const activeSentencePosition = activeVerse?.grain === ORCH_SENTENCE_GRAIN
    ? activeVerse.seq
    : activeSegment
      ? activeSegmentSentencePosition(activeSegment, sentences.sentenceAt, currentTime, duration)
      : null;

  // On-demand pages: the active segment's range plus the next segment's, and
  // the next sentence page once playback nears the end of the current one.
  const { ensurePage, ensureRange, pageOf, perPage } = sentences;
  useEffect(() => {
    if (!activeSegment) return;
    void ensureRange(activeSegment.start, activeSegment.end);
    const following = detail.segments.find((segment) => segment.index > activeSegment.index);
    if (following) void ensureRange(following.start, following.end);
  }, [activeSegment, detail.segments, ensureRange]);

  useEffect(() => {
    if (activeSentencePosition == null) return;
    const page = pageOf(activeSentencePosition);
    if (page * perPage - 1 - activeSentencePosition < PREFETCH_SENTENCES) void ensurePage(page + 1);
  }, [activeSentencePosition, ensurePage, pageOf, perPage]);

  return {
    settings,
    langs,
    displayLangs,
    sentences,
    sentenceVerses,
    cells,
    playing,
    paused,
    playingKey: activeVerse?.grain === ORCH_SENTENCE_GRAIN ? playingKey : null,
    activeSegmentIndex: activeSegment?.index ?? null,
    activeSentencePosition,
    currentTime,
    duration,
    playPause,
    stop,
    next,
    prev,
    playSegment,
    playSentence,
    updateSettings,
  };
}
