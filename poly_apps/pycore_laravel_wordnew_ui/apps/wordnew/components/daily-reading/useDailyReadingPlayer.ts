import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyReadingRow } from './dailyReadingApi';
import { preloadAudio, resolveAudioSync } from '../../cache/WfNewAudioCache';
import {
  getSentenceWordTable,
  markSentenceWordsPlayed,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import { StorageKeys, StorageManager } from '../../../../core/persistence';

export type DailyReadingPlaybackMode = 'sequential' | 'repeat-all' | 'repeat-one' | 'shuffle';
export type DailyReadingWordMode = 'off' | 'new' | 'all';
/** When the article's words play relative to the sentence pattern. */
export type DailyReadingWordTiming = 'before' | 'during';
/** Word playback order within one article. */
export type DailyReadingWordOrder = 'sentence' | 'shuffle' | 'alpha';

/** One editable sentence-pattern step: play the article N times in one lang
 *  (en = the stored TTS audio, cn = reference_cn via speech synthesis). */
export interface DailyReadingPatternStep {
  lang: 'en' | 'cn';
  times: number;
}

export interface DailyReadingPlaybackSettings {
  playbackMode: DailyReadingPlaybackMode;
  wordMode: DailyReadingWordMode;
  wordRepeats: number;
  wordTiming: DailyReadingWordTiming;
  wordOrder: DailyReadingWordOrder;
  sentencePattern: DailyReadingPatternStep[];
  /** @deprecated migrated to wordTiming — kept only to read old stored settings. */
  sentenceFirst?: boolean;
}

export interface DailyReadingPlayer extends DailyReadingPlaybackSettings {
  open: boolean;
  playing: boolean;
  list: DailyReadingRow[];
  index: number;
  current: DailyReadingRow | null;
  currentTime: number;
  duration: number;
  start: (rows: DailyReadingRow[], startId?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  updateSettings: (patch: Partial<DailyReadingPlaybackSettings>) => void;
}

const DEFAULT_SETTINGS: DailyReadingPlaybackSettings = {
  playbackMode: 'sequential',
  wordMode: 'new',
  wordRepeats: 1,
  wordTiming: 'before',
  wordOrder: 'sentence',
  sentencePattern: [{ lang: 'en', times: 1 }],
};

/** Fresh pattern copy — the default array must never be shared into state
 *  (a mutation would corrupt every future default). */
function defaultPattern(): DailyReadingPatternStep[] {
  return DEFAULT_SETTINGS.sentencePattern.map((step) => ({ ...step }));
}

interface DailyReadingSequenceItem {
  url?: string;
  word?: string;
  /** Speak text (TTS) instead of playing a url; lang overrides the voice. */
  speakLang?: string;
}

function sanitizePattern(value: unknown): DailyReadingPatternStep[] {
  if (!Array.isArray(value)) return defaultPattern();
  const steps = value
    .map((step): DailyReadingPatternStep | null => {
      if (!step || typeof step !== 'object') return null;
      const lang = (step as any).lang === 'cn' ? 'cn' : 'en';
      const times = Math.max(1, Math.min(10, Number((step as any).times) || 1));
      return { lang, times };
    })
    .filter((step): step is DailyReadingPatternStep => step !== null);
  return steps.length > 0 ? steps.slice(0, 8) : defaultPattern();
}

function initialSettings(): DailyReadingPlaybackSettings {
  try {
    const stored = StorageManager.get<Record<string, any>>(StorageKeys.WORDNEW_DAILY_READING_PLAYER, {});
    const merged = { ...DEFAULT_SETTINGS, ...stored };
    // Migrate the old sentenceFirst checkbox: sentence-before-words == 'during'
    // (words inside the sentence sequence), words-first == 'before'.
    if (typeof stored.sentenceFirst === 'boolean' && typeof stored.wordTiming !== 'string') {
      merged.wordTiming = stored.sentenceFirst ? 'during' : 'before';
    }
    if (merged.wordTiming !== 'during') merged.wordTiming = 'before';
    if (!['sentence', 'shuffle', 'alpha'].includes(merged.wordOrder)) merged.wordOrder = 'sentence';
    merged.sentencePattern = sanitizePattern(stored.sentencePattern);
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS, sentencePattern: defaultPattern() };
  }
}

function sentenceAudioUrl(row: DailyReadingRow): string | null {
  return row.audio_url ? resolveAudioSync(row.audio_url) ?? row.audio_url : null;
}

export function useDailyReadingPlayer(): DailyReadingPlayer {
  const initial = useRef(initialSettings());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const listRef = useRef<DailyReadingRow[]>([]);
  const indexRef = useRef(0);
  const settingsRef = useRef(initial.current);
  const sequenceRef = useRef<DailyReadingSequenceItem[]>([]);
  const sequenceIndexRef = useRef(0);
  const playedWordsRef = useRef<string[]>([]);
  const requestIdRef = useRef(0);
  const nextRef = useRef<() => void>(() => undefined);
  const endedRef = useRef<() => void>(() => undefined);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [list, setList] = useState<DailyReadingRow[]>([]);
  const [index, setIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState(initial.current);

  const updateSettings = useCallback((patch: Partial<DailyReadingPlaybackSettings>) => {
    const nextSettings = {
      ...settingsRef.current,
      ...patch,
      wordRepeats: Math.max(1, Math.min(10, Number(patch.wordRepeats ?? settingsRef.current.wordRepeats))),
      sentencePattern: patch.sentencePattern
        ? sanitizePattern(patch.sentencePattern)
        : settingsRef.current.sentencePattern,
    };
    settingsRef.current = nextSettings;
    setSettings(nextSettings);
    StorageManager.set(StorageKeys.WORDNEW_DAILY_READING_PLAYER, nextSettings);
  }, []);

  const playSequenceItem = useCallback((position: number) => {
    const audio = audioRef.current;
    const item = sequenceRef.current[position];
    if (!audio || !item) return;
    sequenceIndexRef.current = position;
    setCurrentTime(0);
    setDuration(0);
    if (item.word && typeof speechSynthesis !== 'undefined') {
      audio.pause();
      audio.removeAttribute('src');
      const requestId = requestIdRef.current;
      const utterance = new SpeechSynthesisUtterance(item.word);
      utterance.lang = item.speakLang ?? 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => {
        if (requestId === requestIdRef.current && utteranceRef.current === utterance) {
          utteranceRef.current = null;
          endedRef.current();
        }
      };
      utterance.onerror = utterance.onend;
      utteranceRef.current = utterance;
      setPlaying(true);
      speechSynthesis.speak(utterance);
      return;
    }
    const url = item.url;
    if (!url) {
      endedRef.current();
      return;
    }
    utteranceRef.current = null;
    audio.src = resolveAudioSync(url) ?? url;
    audio.currentTime = 0;
    void audio.play().then(() => setPlaying(true)).catch((error: unknown) => {
      setPlaying(false);
      if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') endedRef.current();
    });
  }, []);

  const buildSequence = useCallback(async (row: DailyReadingRow): Promise<{
    items: DailyReadingSequenceItem[];
    words: string[];
  }> => {
    const sentenceUrl = sentenceAudioUrl(row);
    if (!sentenceUrl) return { items: [], words: [] };
    const currentSettings = settingsRef.current;

    // Sentence pattern: editable steps (en audio / cn reference via TTS), each
    // with its own repeat count — e.g. en×N → cn×N → en×N.
    const pattern = currentSettings.sentencePattern.length > 0
      ? currentSettings.sentencePattern
      : [{ lang: 'en' as const, times: 1 }];
    const sentenceItems: DailyReadingSequenceItem[] = [];
    for (const step of pattern) {
      for (let i = 0; i < step.times; i += 1) {
        if (step.lang === 'cn') {
          if (row.reference_cn) sentenceItems.push({ word: row.reference_cn, speakLang: 'zh-CN' });
        } else {
          sentenceItems.push({ url: sentenceUrl });
        }
      }
    }
    if (sentenceItems.length === 0) sentenceItems.push({ url: sentenceUrl });

    if (currentSettings.wordMode === 'off' || !row.article_en) {
      return { items: sentenceItems, words: [] };
    }

    let table: WordNewSentenceWordRow[] = [];
    try {
      table = await getSentenceWordTable(row.article_en, 'en', 'zh');
    } catch {
      return { items: sentenceItems, words: [] };
    }
    let selected = table.filter((word) => (
      currentSettings.wordMode === 'all' || !word.played
    ));
    // Dynamic word playback order: original sentence order, shuffled, or A→Z.
    if (currentSettings.wordOrder === 'shuffle') {
      selected = [...selected].sort(() => Math.random() - 0.5);
    } else if (currentSettings.wordOrder === 'alpha') {
      selected = [...selected].sort((a, b) => a.word.localeCompare(b.word));
    }
    const wordItems = selected.flatMap((word) => Array.from(
      { length: currentSettings.wordRepeats },
      () => word.audio_url ? { url: word.audio_url } : { word: word.word },
    ));
    // Word timing: 'before' plays all words ahead of the sentence pattern;
    // 'during' inserts them into the pattern after the first sentence pass.
    const items = currentSettings.wordTiming === 'during' && sentenceItems.length > 0
      ? [sentenceItems[0], ...wordItems, ...sentenceItems.slice(1)]
      : [...wordItems, ...sentenceItems];
    preloadAudio(items.flatMap((item) => item.url ? [item.url] : []));
    return { items, words: selected.map((word) => word.word) };
  }, []);

  const playAt = useCallback((position: number) => {
    const rows = listRef.current;
    if (rows.length === 0) return;
    const clamped = Math.max(0, Math.min(position, rows.length - 1));
    const row = rows[clamped];
    if (!row?.audio_url) return;
    const requestId = ++requestIdRef.current;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    utteranceRef.current = null;
    indexRef.current = clamped;
    setIndex(clamped);
    setPlaying(false);
    void buildSequence(row).then((sequence) => {
      if (requestId !== requestIdRef.current) return;
      sequenceRef.current = sequence.items;
      playedWordsRef.current = sequence.words;
      playSequenceItem(0);
    });
  }, [buildSequence, playSequenceItem]);

  const next = useCallback(() => {
    const mode = settingsRef.current.playbackMode;
    if (mode === 'repeat-one') return playAt(indexRef.current);
    if (mode === 'shuffle' && listRef.current.length > 1) {
      let target = indexRef.current;
      while (target === indexRef.current) target = Math.floor(Math.random() * listRef.current.length);
      return playAt(target);
    }
    if (indexRef.current < listRef.current.length - 1) return playAt(indexRef.current + 1);
    if (mode === 'repeat-all') return playAt(0);
    audioRef.current?.pause();
    setPlaying(false);
  }, [playAt]);
  nextRef.current = next;

  const onSequenceEnded = useCallback(() => {
    if (sequenceIndexRef.current < sequenceRef.current.length - 1) {
      playSequenceItem(sequenceIndexRef.current + 1);
      return;
    }
    const playedWords = playedWordsRef.current;
    playedWordsRef.current = [];
    if (playedWords.length > 0) void markSentenceWordsPlayed(playedWords, 'en').catch(() => undefined);
    nextRef.current();
  }, [playSequenceItem]);
  endedRef.current = onSequenceEnded;

  if (!audioRef.current && typeof Audio !== 'undefined') {
    const audio = new Audio();
    audio.onended = () => endedRef.current();
    audio.onerror = () => {
      if (audioRef.current?.src) endedRef.current();
    };
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
      setDuration(audio.duration || 0);
    };
    audioRef.current = audio;
  }

  const start = useCallback((rows: DailyReadingRow[], startId?: string) => {
    const playable = rows.filter((row) => !!row.audio_url);
    if (playable.length === 0) return;
    listRef.current = playable;
    setList(playable);
    setOpen(true);
    const at = startId ? playable.findIndex((row) => row.id === startId) : 0;
    playAt(at >= 0 ? at : 0);
  }, [playAt]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    const utterance = utteranceRef.current;
    if (utterance && typeof speechSynthesis !== 'undefined') {
      if (speechSynthesis.paused) {
        speechSynthesis.resume();
        setPlaying(true);
      } else {
        speechSynthesis.pause();
        setPlaying(false);
      }
      return;
    }
    if (!audio || !audio.src) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const prev = useCallback(() => {
    const previous = indexRef.current > 0
      ? indexRef.current - 1
      : settingsRef.current.playbackMode === 'repeat-all' ? listRef.current.length - 1 : 0;
    playAt(previous);
  }, [playAt]);

  const close = useCallback(() => {
    requestIdRef.current++;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    utteranceRef.current = null;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setPlaying(false);
    setOpen(false);
  }, []);

  useEffect(() => () => {
    requestIdRef.current++;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    utteranceRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  return {
    open,
    playing,
    list,
    index,
    current: list[index] ?? null,
    currentTime,
    duration,
    ...settings,
    start,
    toggle,
    next,
    prev,
    close,
    updateSettings,
  };
}
