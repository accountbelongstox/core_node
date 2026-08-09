import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyReadingRow } from './dailyReadingApi';
import { preloadAudio, resolveAudioSync } from '../../runtime-store/WfNewAudioCache';
import {
  getSentenceWordTable,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import { wordNewProgressCenter } from '../../services/WordNewProgressCenter';
import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import { wfNewApi } from '../../api';
import { requestAuthLogin, subscribeAuthLoginSuccess } from '../../../../core/auth/AuthRequestCenter';

export type DailyReadingPlaybackMode = 'sequential' | 'repeat-all' | 'repeat-one' | 'shuffle';
export type DailyReadingWordMode = 'off' | 'new' | 'all';
export type DailyReadingWordOrder = 'sentence' | 'shuffle' | 'alpha';

export interface DailyReadingSentencePlaybackStep {
  type: 'sentence';
  lang: 'en' | 'cn';
  times: number;
}

export interface DailyReadingWordPlaybackStep {
  type: 'words';
  times: number;
}

export type DailyReadingPlaybackStep = DailyReadingSentencePlaybackStep | DailyReadingWordPlaybackStep;

export interface DailyReadingPlaybackSettings {
  playbackMode: DailyReadingPlaybackMode;
  wordMode: DailyReadingWordMode;
  wordOrder: DailyReadingWordOrder;
  newOnlyMaxReadCount: number;
  underlineCurrentSentence: boolean;
  playbackPattern: DailyReadingPlaybackStep[];
}

export interface DailyReadingPlayer extends DailyReadingPlaybackSettings {
  open: boolean;
  playing: boolean;
  list: DailyReadingRow[];
  index: number;
  current: DailyReadingRow | null;
  currentTime: number;
  duration: number;
  activeStepType: DailyReadingPlaybackStep['type'] | null;
  activeSentenceLanguage: DailyReadingSentencePlaybackStep['lang'] | null;
  activeWord: string | null;
  activeWordIndex: number;
  activeWords: WordNewSentenceWordRow[];
  wordProgressVersion: number;
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
  wordOrder: 'sentence',
  newOnlyMaxReadCount: 0,
  underlineCurrentSentence: true,
  playbackPattern: [
    { type: 'words', times: 1 },
    { type: 'sentence', lang: 'en', times: 1 },
  ],
};
const CLOUD_PUSH_DEBOUNCE_MS = 700;

function defaultPattern(): DailyReadingPlaybackStep[] {
  return DEFAULT_SETTINGS.playbackPattern.map((step) => ({ ...step }));
}

interface DailyReadingSequenceItem {
  type: DailyReadingPlaybackStep['type'];
  url?: string;
  speechText?: string;
  speakLang?: string;
  wordRow?: WordNewSentenceWordRow;
  wordIndex?: number;
  sentenceLang?: DailyReadingSentencePlaybackStep['lang'];
}

interface DailyReadingBuiltSequence {
  items: DailyReadingSequenceItem[];
  words: WordNewSentenceWordRow[];
  settingsVersion: number;
}

function parsePattern(value: unknown): DailyReadingPlaybackStep[] {
  if (!Array.isArray(value)) return [];
  const steps = value
    .map((step): DailyReadingPlaybackStep | null => {
      if (!step || typeof step !== 'object') return null;
      const times = Math.max(1, Math.min(10, Number((step as any).times) || 1));
      if ((step as any).type === 'words') return { type: 'words', times };
      const lang = (step as any).lang === 'cn' ? 'cn' : 'en';
      return { type: 'sentence', lang, times };
    })
    .filter((step): step is DailyReadingPlaybackStep => step !== null);
  return steps.slice(0, 12);
}

function migratePattern(stored: Record<string, any>): DailyReadingPlaybackStep[] {
  const currentPattern = parsePattern(stored.playbackPattern);
  if (currentPattern.length > 0) return currentPattern;
  if (!Array.isArray(stored.sentencePattern)) return defaultPattern();
  const sentencePattern = parsePattern(stored.sentencePattern);
  if (sentencePattern.length === 0 || stored.wordMode === 'off') return sentencePattern.length > 0
    ? sentencePattern
    : defaultPattern();
  const wordStep: DailyReadingWordPlaybackStep = {
    type: 'words',
    times: Math.max(1, Math.min(10, Number(stored.wordRepeats) || 1)),
  };
  const wordsDuring = stored.wordTiming === 'during' || stored.sentenceFirst === true;
  return wordsDuring
    ? [sentencePattern[0], wordStep, ...sentencePattern.slice(1)]
    : [wordStep, ...sentencePattern];
}

function sanitizePattern(value: unknown): DailyReadingPlaybackStep[] {
  const pattern = parsePattern(value);
  return pattern.length > 0 ? pattern : defaultPattern();
}

function normalizeSettings(stored: Record<string, any>): DailyReadingPlaybackSettings {
  const playbackMode = ['sequential', 'repeat-all', 'repeat-one', 'shuffle'].includes(stored.playbackMode)
    ? stored.playbackMode as DailyReadingPlaybackMode
    : DEFAULT_SETTINGS.playbackMode;
  const wordMode = ['off', 'new', 'all'].includes(stored.wordMode)
    ? stored.wordMode as DailyReadingWordMode
    : DEFAULT_SETTINGS.wordMode;
  const wordOrder = ['sentence', 'shuffle', 'alpha'].includes(stored.wordOrder)
    ? stored.wordOrder as DailyReadingWordOrder
    : DEFAULT_SETTINGS.wordOrder;
  const newOnlyMaxReadCount = Math.max(0, Math.min(100, Number(stored.newOnlyMaxReadCount) || 0));
  return {
    playbackMode,
    wordMode,
    wordOrder,
    newOnlyMaxReadCount,
    underlineCurrentSentence: stored.underlineCurrentSentence !== false,
    playbackPattern: migratePattern(stored),
  };
}

function initialSettings(): DailyReadingPlaybackSettings {
  try {
    return normalizeSettings(StorageManager.get<Record<string, any>>(
      StorageKeys.WORDNEW_DAILY_READING_PLAYER,
      {},
    ));
  } catch {
    return { ...DEFAULT_SETTINGS, playbackPattern: defaultPattern() };
  }
}

function sentenceAudioUrl(row: DailyReadingRow): string | null {
  return row.audio_ready && row.audio_url ? resolveAudioSync(row.audio_url) ?? row.audio_url : null;
}

function wordKey(word: string): string {
  return word.trim().toLocaleLowerCase();
}

function uniqueWordRows(rows: WordNewSentenceWordRow[]): WordNewSentenceWordRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = wordKey(row.word);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useDailyReadingPlayer(): DailyReadingPlayer {
  const initial = useRef(initialSettings());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const listRef = useRef<DailyReadingRow[]>([]);
  const indexRef = useRef(0);
  const settingsRef = useRef(initial.current);
  const settingsVersionRef = useRef(0);
  const sequenceSettingsVersionRef = useRef(-1);
  const sequenceRef = useRef<DailyReadingSequenceItem[]>([]);
  const sequenceIndexRef = useRef(0);
  const sessionReadCountsRef = useRef<Map<string, number>>(new Map());
  const batchPlayedWordsRef = useRef<Set<string>>(new Set());
  const articleAddedWordsRef = useRef<Map<string, Set<string>>>(new Map());
  const speechProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechProgressTickRef = useRef(0);
  const speechProgressElapsedRef = useRef(0);
  const modelPausedRef = useRef(false);
  const pendingAdvanceRef = useRef(false);
  const cloudPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudDirtyRef = useRef(false);
  const cloudPullIdRef = useRef(0);
  const startRequestIdRef = useRef(0);
  const requestIdRef = useRef(0);
  const playAtRef = useRef<(position: number) => void>(() => undefined);
  const nextRef = useRef<() => void>(() => undefined);
  const endedRef = useRef<() => void>(() => undefined);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [list, setList] = useState<DailyReadingRow[]>([]);
  const [index, setIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeStepType, setActiveStepType] = useState<DailyReadingPlaybackStep['type'] | null>(null);
  const [activeSentenceLanguage, setActiveSentenceLanguage] = useState<DailyReadingSentencePlaybackStep['lang'] | null>(null);
  const [activeWord, setActiveWord] = useState<string | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [activeWords, setActiveWords] = useState<WordNewSentenceWordRow[]>([]);
  const [wordProgressVersion, setWordProgressVersion] = useState(0);
  const [settings, setSettings] = useState(initial.current);

  const applySettings = useCallback((nextSettings: DailyReadingPlaybackSettings) => {
    settingsRef.current = nextSettings;
    settingsVersionRef.current += 1;
    setSettings(nextSettings);
    StorageManager.set(StorageKeys.WORDNEW_DAILY_READING_PLAYER, nextSettings);
  }, []);

  const pushCloudSettings = useCallback((
    snapshot: DailyReadingPlaybackSettings,
    settingsVersion: number,
  ): Promise<void> => {
    if (!wfNewApi.isAuthenticated()) return Promise.resolve();
    const updatedAt = new Date().toISOString();
    return wfNewApi.updatePreferences({
      app_settings: {
        dailyReadingPlayer: { ...snapshot, updatedAt },
      },
    }).then(() => {
      if (settingsVersionRef.current === settingsVersion) cloudDirtyRef.current = false;
    });
  }, []);

  const pullCloudSettings = useCallback((): Promise<void> => {
    if (!wfNewApi.isAuthenticated() || cloudDirtyRef.current) return Promise.resolve();
    const pullId = ++cloudPullIdRef.current;
    return wfNewApi.getPreferences().then((preferences) => {
      if (pullId !== cloudPullIdRef.current || cloudDirtyRef.current) return;
      const remote = preferences?.app_settings?.dailyReadingPlayer;
      if (remote && typeof remote === 'object') {
        applySettings(normalizeSettings(remote as Record<string, any>));
        return;
      }
      const snapshot = settingsRef.current;
      cloudDirtyRef.current = true;
      return pushCloudSettings(snapshot, settingsVersionRef.current);
    }).catch((error: unknown) => {
      console.warn('[WordNewDailyReadingPlayer] Cloud settings pull skipped:', error);
    });
  }, [applySettings, pushCloudSettings]);

  const updateSettings = useCallback((patch: Partial<DailyReadingPlaybackSettings>) => {
    if (!wfNewApi.isAuthenticated()) {
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'playback-settings' });
      return;
    }
    const candidate = { ...settingsRef.current, ...patch };
    const nextSettings: DailyReadingPlaybackSettings = {
      playbackMode: ['sequential', 'repeat-all', 'repeat-one', 'shuffle'].includes(candidate.playbackMode)
        ? candidate.playbackMode
        : DEFAULT_SETTINGS.playbackMode,
      wordMode: ['off', 'new', 'all'].includes(candidate.wordMode)
        ? candidate.wordMode
        : DEFAULT_SETTINGS.wordMode,
      wordOrder: ['sentence', 'shuffle', 'alpha'].includes(candidate.wordOrder)
        ? candidate.wordOrder
        : DEFAULT_SETTINGS.wordOrder,
      newOnlyMaxReadCount: Math.max(0, Math.min(100, Number(candidate.newOnlyMaxReadCount) || 0)),
      underlineCurrentSentence: candidate.underlineCurrentSentence !== false,
      playbackPattern: patch.playbackPattern
        ? sanitizePattern(patch.playbackPattern)
        : settingsRef.current.playbackPattern,
    };
    applySettings(nextSettings);
    cloudDirtyRef.current = true;
    if (cloudPushTimerRef.current) clearTimeout(cloudPushTimerRef.current);
    cloudPushTimerRef.current = setTimeout(() => {
      cloudPushTimerRef.current = null;
      void pushCloudSettings(settingsRef.current, settingsVersionRef.current).catch((error: unknown) => {
        console.warn('[WordNewDailyReadingPlayer] Cloud settings push skipped:', error);
      });
    }, CLOUD_PUSH_DEBOUNCE_MS);
  }, [applySettings, pushCloudSettings]);

  const playSequenceItem = useCallback((position: number) => {
    const audio = audioRef.current;
    const item = sequenceRef.current[position];
    if (!audio || !item) return;
    sequenceIndexRef.current = position;
    setActiveStepType(item.type);
    setActiveSentenceLanguage(item.type === 'sentence' ? item.sentenceLang ?? 'en' : null);
    setActiveWord(item.wordRow?.word ?? null);
    setActiveWordIndex(item.wordIndex ?? -1);
    setCurrentTime(0);
    setDuration(0);
    if (speechProgressTimerRef.current) {
      clearInterval(speechProgressTimerRef.current);
      speechProgressTimerRef.current = null;
    }
    if (item.speechText && typeof speechSynthesis !== 'undefined') {
      audio.pause();
      audio.removeAttribute('src');
      const requestId = requestIdRef.current;
      const utterance = new SpeechSynthesisUtterance(item.speechText);
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
      const estimatedDuration = Math.max(
        1,
        item.speechText.trim().length / (item.sentenceLang === 'cn' ? 4 : 12) / utterance.rate,
      );
      speechProgressElapsedRef.current = 0;
      speechProgressTickRef.current = Date.now();
      setDuration(estimatedDuration);
      speechProgressTimerRef.current = setInterval(() => {
        const now = Date.now();
        if (!speechSynthesis.paused) {
          speechProgressElapsedRef.current += (now - speechProgressTickRef.current) / 1000;
          setCurrentTime(Math.min(estimatedDuration, speechProgressElapsedRef.current));
        }
        speechProgressTickRef.current = now;
      }, 200);
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
    void audio.play().then(() => {
      if (!modelPausedRef.current) setPlaying(true);
    }).catch((error: unknown) => {
      setPlaying(false);
      if (!(error instanceof DOMException) || error.name !== 'NotAllowedError') endedRef.current();
    });
  }, []);

  const buildSequence = useCallback(async (row: DailyReadingRow): Promise<DailyReadingBuiltSequence> => {
    const sentenceUrl = sentenceAudioUrl(row);
    const settingsVersion = settingsVersionRef.current;
    if (!sentenceUrl) return { items: [], words: [], settingsVersion };
    const currentSettings = settingsRef.current;
    const pattern = currentSettings.playbackPattern.length > 0
      ? currentSettings.playbackPattern
      : defaultPattern();
    const needsWords = currentSettings.wordMode !== 'off'
      && !!row.article_en
      && pattern.some((step) => step.type === 'words');
    let table: WordNewSentenceWordRow[] = [];
    if (needsWords) {
      try {
        table = await getSentenceWordTable(
          row.article_en as string,
          'en',
          'zh',
          currentSettings.newOnlyMaxReadCount,
        );
        const articleKey = String(row.id);
        const addedWords = articleAddedWordsRef.current.get(articleKey) ?? new Set<string>();
        table.forEach((word) => {
          if (word.added_to_default_group) addedWords.add(wordKey(word.word));
        });
        articleAddedWordsRef.current.set(articleKey, addedWords);
        table = table.map((word) => addedWords.has(wordKey(word.word))
          ? { ...word, added_to_default_group: true }
          : word);
      } catch {
        table = [];
      }
    }
    let selected = currentSettings.wordMode === 'new'
      ? uniqueWordRows(table.filter((word) => {
        const key = wordKey(word.word);
        const effectiveReadCount = Math.max(
          Number(word.play_count) || 0,
          sessionReadCountsRef.current.get(key) ?? 0,
        );
        return word.eligible_for_new_only
          && !batchPlayedWordsRef.current.has(key)
          && effectiveReadCount <= currentSettings.newOnlyMaxReadCount;
      }))
      : table;
    if (currentSettings.wordOrder === 'shuffle') {
      selected = [...selected].sort(() => Math.random() - 0.5);
    } else if (currentSettings.wordOrder === 'alpha') {
      selected = [...selected].sort((a, b) => a.word.localeCompare(b.word));
    }
    const items: DailyReadingSequenceItem[] = [];
    for (const step of pattern) {
      if (step.type === 'words') {
        for (let wordIndex = 0; wordIndex < selected.length; wordIndex += 1) {
          const word = selected[wordIndex];
          for (let count = 0; count < step.times; count += 1) {
            items.push(word.audio_url
              ? { type: 'words', url: word.audio_url, wordRow: word, wordIndex }
              : { type: 'words', speechText: word.word, speakLang: 'en-US', wordRow: word, wordIndex });
          }
        }
        continue;
      }
      for (let count = 0; count < step.times; count += 1) {
        if (step.lang === 'cn') {
          if (row.reference_cn) {
            items.push({ type: 'sentence', speechText: row.reference_cn, speakLang: 'zh-CN', sentenceLang: 'cn' });
          }
        } else {
          items.push({ type: 'sentence', url: sentenceUrl, sentenceLang: 'en' });
        }
      }
    }
    if (items.length === 0) items.push({ type: 'sentence', url: sentenceUrl, sentenceLang: 'en' });
    preloadAudio(items.flatMap((item) => item.url ? [item.url] : []));
    return { items, words: selected, settingsVersion };
  }, []);

  const playAt = useCallback((position: number) => {
    if (!wfNewApi.isAuthenticated()) {
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'playback' });
      return;
    }
    const rows = listRef.current;
    if (rows.length === 0) return;
    const clamped = Math.max(0, Math.min(position, rows.length - 1));
    const row = rows[clamped];
    if (!row?.audio_ready || !row.audio_url) return;
    void wfNewApi.saveDailyReadingProgress(row.id);
    const requestId = ++requestIdRef.current;
    modelPausedRef.current = false;
    pendingAdvanceRef.current = false;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    utteranceRef.current = null;
    indexRef.current = clamped;
    setIndex(clamped);
    setPlaying(false);
    setActiveStepType(null);
    setActiveSentenceLanguage(null);
    setActiveWord(null);
    setActiveWordIndex(-1);
    setActiveWords([]);
    void buildSequence(row).then((sequence) => {
      if (requestId !== requestIdRef.current) return;
      if (sequence.settingsVersion !== settingsVersionRef.current) {
        playAtRef.current(clamped);
        return;
      }
      sequenceRef.current = sequence.items;
      sequenceSettingsVersionRef.current = sequence.settingsVersion;
      setActiveWords(sequence.words);
      playSequenceItem(0);
    });
  }, [buildSequence, playSequenceItem]);
  playAtRef.current = playAt;

  useEffect(() => subscribeAuthLoginSuccess((detail) => {
    if (detail.request?.source !== 'wordnew-daily-reading' || detail.request.reason !== 'playback') return;
    playAtRef.current(indexRef.current);
  }), []);

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
    const completedItem = sequenceRef.current[sequenceIndexRef.current];
    if (speechProgressTimerRef.current) {
      clearInterval(speechProgressTimerRef.current);
      speechProgressTimerRef.current = null;
    }
    if (completedItem?.type === 'words' && completedItem.wordRow) {
      const completedWord = completedItem.wordRow.word;
      const completedWordKey = wordKey(completedWord);
      if (completedWordKey) {
        const nextReadCount = Math.max(
          Number(completedItem.wordRow.play_count) || 0,
          sessionReadCountsRef.current.get(completedWordKey) ?? 0,
        ) + 1;
        batchPlayedWordsRef.current.add(completedWordKey);
        sessionReadCountsRef.current.set(completedWordKey, nextReadCount);
        setActiveWords((rows) => rows.map((word) => wordKey(word.word) === completedWordKey
          ? { ...word, played: true, play_count: nextReadCount }
          : word));
        wordNewProgressCenter.reportSentenceReads([completedWord], 'en');
      }
    }
    if (modelPausedRef.current) {
      pendingAdvanceRef.current = true;
      setPlaying(false);
      return;
    }
    if (sequenceIndexRef.current < sequenceRef.current.length - 1) {
      playSequenceItem(sequenceIndexRef.current + 1);
      return;
    }
    setActiveStepType(null);
    setActiveSentenceLanguage(null);
    setActiveWord(null);
    setActiveWordIndex(-1);
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
    const playable = rows.filter((row) => row.audio_ready === true && !!row.audio_url);
    if (playable.length === 0) return;
    const startRequestId = ++startRequestIdRef.current;
    const at = startId ? playable.findIndex((row) => row.id === startId) : 0;
    const startIndex = at >= 0 ? at : 0;
    listRef.current = playable;
    batchPlayedWordsRef.current = new Set();
    articleAddedWordsRef.current = new Map();
    setList(playable);
    setOpen(true);
    indexRef.current = startIndex;
    setIndex(startIndex);
    if (!wfNewApi.isAuthenticated()) {
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'playback' });
      return;
    }
    const begin = (): void => {
      if (startRequestId !== startRequestIdRef.current) return;
      playAt(startIndex);
    };
    if (cloudDirtyRef.current) {
      begin();
      return;
    }
    void pullCloudSettings().then(begin).catch((error: unknown) => {
      console.warn('[WordNewDailyReadingPlayer] Cloud settings start fallback:', error);
      begin();
    });
  }, [playAt, pullCloudSettings]);

  const toggle = useCallback(() => {
    if (!wfNewApi.isAuthenticated()) {
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'playback' });
      return;
    }
    const audio = audioRef.current;
    const utterance = utteranceRef.current;
    if (pendingAdvanceRef.current) {
      pendingAdvanceRef.current = false;
      modelPausedRef.current = false;
      endedRef.current();
      return;
    }
    if (utterance && typeof speechSynthesis !== 'undefined') {
      if (speechSynthesis.paused) {
        if (sequenceSettingsVersionRef.current !== settingsVersionRef.current) {
          playAt(indexRef.current);
          return;
        }
        modelPausedRef.current = false;
        speechSynthesis.resume();
        setPlaying(true);
      } else {
        modelPausedRef.current = true;
        speechSynthesis.pause();
        setPlaying(false);
      }
      return;
    }
    if (!audio || !audio.src) {
      modelPausedRef.current = false;
      playAt(indexRef.current);
      return;
    }
    if (audio.paused) {
      if (audio.ended || sequenceSettingsVersionRef.current !== settingsVersionRef.current) {
        playAt(indexRef.current);
        return;
      }
      modelPausedRef.current = false;
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      modelPausedRef.current = true;
      audio.pause();
      setPlaying(false);
    }
  }, [playAt]);

  const prev = useCallback(() => {
    const previous = indexRef.current > 0
      ? indexRef.current - 1
      : settingsRef.current.playbackMode === 'repeat-all' ? listRef.current.length - 1 : 0;
    playAt(previous);
  }, [playAt]);

  const close = useCallback(() => {
    startRequestIdRef.current += 1;
    requestIdRef.current++;
    if (speechProgressTimerRef.current) {
      clearInterval(speechProgressTimerRef.current);
      speechProgressTimerRef.current = null;
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    utteranceRef.current = null;
    modelPausedRef.current = false;
    pendingAdvanceRef.current = false;
    sequenceRef.current = [];
    setActiveStepType(null);
    setActiveSentenceLanguage(null);
    setActiveWord(null);
    setActiveWordIndex(-1);
    setActiveWords([]);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setPlaying(false);
    setOpen(false);
    void wordNewProgressCenter.flushNow();
  }, []);

  useEffect(() => () => {
    startRequestIdRef.current += 1;
    cloudPullIdRef.current += 1;
    if (cloudPushTimerRef.current) {
      clearTimeout(cloudPushTimerRef.current);
      cloudPushTimerRef.current = null;
    }
    if (cloudDirtyRef.current) {
      void pushCloudSettings(settingsRef.current, settingsVersionRef.current).catch((error: unknown) => {
        console.warn('[WordNewDailyReadingPlayer] Cloud settings flush skipped:', error);
      });
    }
    requestIdRef.current++;
    if (speechProgressTimerRef.current) clearInterval(speechProgressTimerRef.current);
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    utteranceRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
  }, [pushCloudSettings]);

  useEffect(() => wordNewProgressCenter.subscribe(() => {
    setWordProgressVersion((version) => version + 1);
  }), []);

  return {
    open,
    playing,
    list,
    index,
    current: list[index] ?? null,
    currentTime,
    duration,
    activeStepType,
    activeSentenceLanguage,
    activeWord,
    activeWordIndex,
    activeWords,
    wordProgressVersion,
    ...settings,
    start,
    toggle,
    next,
    prev,
    close,
    updateSettings,
  };
}
