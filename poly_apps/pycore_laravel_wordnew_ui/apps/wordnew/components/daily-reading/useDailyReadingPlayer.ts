import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyReadingRow } from './dailyReadingApi';
import {
  ensureAudio,
  preloadAudio,
  preloadAudioTracked,
  resolveAudioSync,
} from '../../runtime-store/WfNewAudioCache';
import {
  getSentenceWordTable,
  mergeSentenceWordRuntimeState,
  sentenceWordKey,
  sentenceWordTranslations,
  uniqueSentenceWordRows,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import { wordNewProgressCenter } from '../../services/WordNewProgressCenter';
import { wordNewRecitationCenter } from '../../services/WordNewRecitationCenter';
import { STORAGE_MANAGER_CHANGED_EVENT } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import { selectedDailyReadingWordGroupId } from './dailyReadingWordGroupStore';
import { wfNewApi } from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { requestAuthLogin, subscribeAuthLoginSuccess } from '../../../../core/auth/AuthRequestCenter';
import {
  defaultDailyReadingPattern,
  EMPTY_DAILY_READING_RESOURCE_STATUS,
  type DailyReadingPlaybackSettings,
  type DailyReadingPlaybackStep,
  type DailyReadingResourceStatus,
  type DailyReadingSentencePlaybackStep,
} from './DailyReadingPlaybackModel';
import {
  activeStateForSequenceItem,
  buildDailyReadingSequenceItems,
  dailyReadingExecutionSignature,
  dailyReadingWordSelectionSignature,
  DailyReadingPlaybackStateMachine,
  EMPTY_DAILY_READING_ACTIVE_ITEM,
  nextReconciledSequenceIndex,
  rateForSequenceItem,
  selectDailyReadingPlaybackWords,
  type DailyReadingSequenceItem,
  type DailyReadingSequencePlan,
  type DailyReadingTransportState,
} from './DailyReadingPlaybackEngine';
import { useDailyReadingPlaybackSettings } from './useDailyReadingPlaybackSettings';

export type {
  DailyReadingPlaybackMode,
  DailyReadingPlaybackSettings,
  DailyReadingPlaybackStep,
  DailyReadingResourceStatus,
  DailyReadingSentencePlaybackStep,
  DailyReadingWordMode,
  DailyReadingWordOrder,
  DailyReadingWordPlaybackStep,
} from './DailyReadingPlaybackModel';
export type { DailyReadingTransportState } from './DailyReadingPlaybackEngine';

export interface DailyReadingPlayer extends DailyReadingPlaybackSettings {
  open: boolean;
  playing: boolean;
  paused: boolean;
  transportState: DailyReadingTransportState;
  list: DailyReadingRow[];
  index: number;
  current: DailyReadingRow | null;
  currentTime: number;
  duration: number;
  activeStepType: DailyReadingPlaybackStep['type'] | null;
  activeStepId: string | null;
  activeStepItemIndex: number;
  activeSentenceLanguage: DailyReadingSentencePlaybackStep['lang'] | null;
  activeWord: string | null;
  activeWordIndex: number;
  activeWords: WordNewSentenceWordRow[];
  articleWords: WordNewSentenceWordRow[];
  resourceStatus: DailyReadingResourceStatus;
  wordProgressVersion: number;
  /** Words read aloud during this playback session (all articles). */
  sessionReadTotal: number;
  start: (rows: DailyReadingRow[], startId?: string) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  updateSettings: (patch: Partial<DailyReadingPlaybackSettings>) => void;
}

/** Absolute HTTP(S) URL; the asset cache only stores absolute URLs. */
function absoluteAudio(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : wfNewEndpoints.buildUrl(url);
}

function sentenceAudioUrl(row: DailyReadingRow): string | null {
  return row.audio_ready ? absoluteAudio(row.audio_url) : null;
}

function resetPlaybackAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

function normalizeSentenceWordAudio(
  rows: WordNewSentenceWordRow[],
): WordNewSentenceWordRow[] {
  return rows.map((word) => {
    const audioUrl = absoluteAudio(word.audio_url);
    return audioUrl && audioUrl !== word.audio_url ? { ...word, audio_url: audioUrl } : word;
  });
}

export function useDailyReadingPlayer(): DailyReadingPlayer {
  const {
    settings,
    settingsRef,
    cloudDirtyRef,
    pullCloudSettings,
    updateSettings,
  } = useDailyReadingPlaybackSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const listRef = useRef<DailyReadingRow[]>([]);
  const indexRef = useRef(0);
  const sequenceExecutionSignatureRef = useRef('');
  const sequenceWordSelectionSignatureRef = useRef('');
  const sequenceRef = useRef<DailyReadingSequenceItem[]>([]);
  const sequenceIndexRef = useRef(0);
  const sequenceGroupIdRef = useRef<string | null>(null);
  const completedExecutionKeysRef = useRef<Set<string>>(new Set());
  const articleWordsRef = useRef<WordNewSentenceWordRow[]>([]);
  const selectedWordsRef = useRef<WordNewSentenceWordRow[]>([]);
  const sessionReadCountsRef = useRef<Map<string, number>>(new Map());
  const batchPlayedWordsRef = useRef<Set<string>>(new Set());
  const resourceRequestIdRef = useRef(0);
  const speechProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechProgressTickRef = useRef(0);
  const speechProgressElapsedRef = useRef(0);
  const transportStateRef = useRef<DailyReadingTransportState>('idle');
  const pendingAdvanceRef = useRef(false);
  const completionTokenRef = useRef(0);
  const activeCompletionTokenRef = useRef<number | null>(null);
  const startRequestIdRef = useRef(0);
  const requestIdRef = useRef(0);
  const playAtRef = useRef<(position: number) => void>(() => undefined);
  const nextRef = useRef<() => void>(() => undefined);
  const endedRef = useRef<(played: boolean) => void>(() => undefined);
  const [open, setOpen] = useState(false);
  const [transportState, setTransportState] = useState<DailyReadingTransportState>('idle');
  const [list, setList] = useState<DailyReadingRow[]>([]);
  const [index, setIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeItem, setActiveItem] = useState(EMPTY_DAILY_READING_ACTIVE_ITEM);
  const [activeWords, setActiveWords] = useState<WordNewSentenceWordRow[]>([]);
  const [articleWords, setArticleWords] = useState<WordNewSentenceWordRow[]>([]);
  const [resourceStatus, setResourceStatus] = useState<DailyReadingResourceStatus>(EMPTY_DAILY_READING_RESOURCE_STATUS);
  const [wordProgressVersion, setWordProgressVersion] = useState(0);
  const [sessionReadTotal, setSessionReadTotal] = useState(0);
  const playing = transportState === 'playing';
  const paused = transportState === 'paused';

  const completePlaybackItem = useCallback((
    completionToken: number,
    played: boolean,
  ) => {
    if (activeCompletionTokenRef.current !== completionToken) return;
    activeCompletionTokenRef.current = null;
    endedRef.current(played);
  }, []);

  const cancelActivePlayback = useCallback((): number => {
    requestIdRef.current += 1;
    activeCompletionTokenRef.current = null;
    pendingAdvanceRef.current = false;
    if (speechProgressTimerRef.current) {
      clearInterval(speechProgressTimerRef.current);
      speechProgressTimerRef.current = null;
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    utteranceRef.current = null;
    resetPlaybackAudio(audioRef.current);
    return requestIdRef.current;
  }, []);

  const transitionTransport = useCallback((nextState: DailyReadingTransportState) => {
    const acceptedState = DailyReadingPlaybackStateMachine.transition(
      transportStateRef.current,
      nextState,
    );
    transportStateRef.current = acceptedState;
    setTransportState(acceptedState);
  }, []);

  const playSequenceItem = useCallback((position: number) => {
    const audio = audioRef.current;
    const item = sequenceRef.current[position];
    if (!audio || !item) return;
    const rate = rateForSequenceItem(item, settingsRef.current);
    const completionToken = ++completionTokenRef.current;
    activeCompletionTokenRef.current = completionToken;
    sequenceIndexRef.current = position;
    setActiveItem(activeStateForSequenceItem(item));
    setCurrentTime(0);
    setDuration(0);
    if (speechProgressTimerRef.current) {
      clearInterval(speechProgressTimerRef.current);
      speechProgressTimerRef.current = null;
    }
    if (
      item.speechText
      && typeof speechSynthesis !== 'undefined'
      && typeof SpeechSynthesisUtterance !== 'undefined'
    ) {
      resetPlaybackAudio(audio);
      const requestId = requestIdRef.current;
      const utterance = new SpeechSynthesisUtterance(item.speechText);
      utterance.lang = item.speakLang ?? 'en-US';
      utterance.rate = rate;
      utterance.onend = () => {
        if (requestId === requestIdRef.current && utteranceRef.current === utterance) {
          utteranceRef.current = null;
          completePlaybackItem(completionToken, true);
        }
      };
      utterance.onerror = () => {
        if (requestId === requestIdRef.current && utteranceRef.current === utterance) {
          utteranceRef.current = null;
          completePlaybackItem(completionToken, false);
        }
      };
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
        if (transportStateRef.current === 'playing') {
          speechProgressElapsedRef.current += (now - speechProgressTickRef.current) / 1000;
          setCurrentTime(Math.min(estimatedDuration, speechProgressElapsedRef.current));
        }
        speechProgressTickRef.current = now;
      }, 200);
      transitionTransport('playing');
      try {
        speechSynthesis.speak(utterance);
      } catch {
        utteranceRef.current = null;
        completePlaybackItem(completionToken, false);
      }
      return;
    }
    const url = item.url;
    if (!url) {
      completePlaybackItem(completionToken, false);
      return;
    }
    utteranceRef.current = null;
    const requestId = requestIdRef.current;
    audio.onended = () => completePlaybackItem(completionToken, true);
    audio.onerror = () => {
      if (transportStateRef.current !== 'stopped') {
        completePlaybackItem(completionToken, false);
      }
    };
    audio.src = resolveAudioSync(url) ?? url;
    audio.playbackRate = rate;
    audio.currentTime = 0;
    void audio.play().then(() => {
      if (
        requestId === requestIdRef.current
        && transportStateRef.current !== 'paused'
        && transportStateRef.current !== 'stopped'
      ) {
        transitionTransport('playing');
      }
    }).catch((error: unknown) => {
      if (requestId !== requestIdRef.current || transportStateRef.current === 'stopped') return;
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        transitionTransport('paused');
        return;
      }
      completePlaybackItem(completionToken, false);
    });
  }, [completePlaybackItem, transitionTransport]);

  const preloadArticleResources = useCallback((
    sentenceUrl: string,
    words: WordNewSentenceWordRow[],
  ): void => {
    const resourceRequestId = ++resourceRequestIdRef.current;
    const uniqueWords = uniqueSentenceWordRows(words);
    const wordsWithAudio = uniqueWords.filter((word) => !!word.audio_url);
    const wordCountByAudioUrl = new Map<string, number>();
    for (const word of wordsWithAudio) {
      const url = word.audio_url as string;
      wordCountByAudioUrl.set(url, (wordCountByAudioUrl.get(url) ?? 0) + 1);
    }
    const translationsReady = uniqueWords.filter(
      (word) => sentenceWordTranslations(word).length > 0,
    ).length;
    setResourceStatus({
      articleAudioReady: 0,
      articleAudioTotal: 1,
      wordAudioReady: 0,
      wordAudioTotal: uniqueWords.length,
      translationsReady,
      translationsTotal: uniqueWords.length,
    });
    void ensureAudio(sentenceUrl).then((localUrl) => {
      if (resourceRequestId !== resourceRequestIdRef.current || !localUrl) return;
      setResourceStatus((status) => ({ ...status, articleAudioReady: 1 }));
    }).catch(() => undefined);
    void preloadAudioTracked(
      wordCountByAudioUrl.keys(),
      (url, ready) => {
        if (resourceRequestId !== resourceRequestIdRef.current || !ready) return;
        const readyCount = wordCountByAudioUrl.get(url) ?? 1;
        setResourceStatus((status) => ({
          ...status,
          wordAudioReady: Math.min(status.wordAudioTotal, status.wordAudioReady + readyCount),
        }));
      },
    ).catch(() => undefined);
  }, []);

  const buildSequence = useCallback(async (row: DailyReadingRow): Promise<DailyReadingSequencePlan> => {
    const sentenceUrl = sentenceAudioUrl(row);
    const currentSettings = settingsRef.current;
    const executionSignature = dailyReadingExecutionSignature(currentSettings);
    const wordSelectionSignature = dailyReadingWordSelectionSignature(currentSettings);
    const groupId = selectedDailyReadingWordGroupId();
    if (!sentenceUrl) {
      return {
        items: [],
        words: [],
        articleWords: [],
        groupId,
        executionSignature,
        wordSelectionSignature,
      };
    }
    const pattern = currentSettings.playbackPattern.length > 0
      ? currentSettings.playbackPattern
      : defaultDailyReadingPattern();
    let table: WordNewSentenceWordRow[] = [];
    if (row.article_en) {
      try {
        table = await getSentenceWordTable(
          row.article_en,
          'en',
          'zh',
          currentSettings.newOnlyMaxReadCount,
          groupId,
        );
      } catch {
        table = [];
      }
    }
    const fullArticleWords = normalizeSentenceWordAudio(uniqueSentenceWordRows(table));
    const selected = selectDailyReadingPlaybackWords(
      fullArticleWords,
      currentSettings,
      sessionReadCountsRef.current,
      batchPlayedWordsRef.current,
    );
    const items = buildDailyReadingSequenceItems(row, sentenceUrl, selected, pattern);
    return {
      items,
      words: selected,
      articleWords: fullArticleWords,
      groupId,
      executionSignature,
      wordSelectionSignature,
    };
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
    void wfNewApi.saveDailyReadingProgress(row.id).catch((error: unknown) => {
      console.warn('[WordNewDailyReadingPlayer] Reading progress save skipped:', error);
    });
    const requestId = cancelActivePlayback();
    transitionTransport('loading');
    completedExecutionKeysRef.current = new Set();
    indexRef.current = clamped;
    setIndex(clamped);
    setActiveItem(EMPTY_DAILY_READING_ACTIVE_ITEM);
    selectedWordsRef.current = [];
    setActiveWords([]);
    articleWordsRef.current = [];
    setArticleWords([]);
    resourceRequestIdRef.current += 1;
    setResourceStatus({
      ...EMPTY_DAILY_READING_RESOURCE_STATUS,
      articleAudioTotal: 1,
    });
    void buildSequence(row).then((sequence) => {
      if (requestId !== requestIdRef.current) return;
      if (sequence.executionSignature !== dailyReadingExecutionSignature(settingsRef.current)) {
        playAtRef.current(clamped);
        return;
      }
      sequenceRef.current = sequence.items;
      sequenceExecutionSignatureRef.current = sequence.executionSignature;
      sequenceWordSelectionSignatureRef.current = sequence.wordSelectionSignature;
      sequenceGroupIdRef.current = sequence.groupId;
      selectedWordsRef.current = sequence.words;
      setActiveWords(sequence.words);
      articleWordsRef.current = sequence.articleWords;
      setArticleWords(sequence.articleWords);
      const sentenceUrl = sentenceAudioUrl(row);
      if (sentenceUrl) preloadArticleResources(sentenceUrl, sequence.articleWords);
      const firstAudioUrl = sequence.items[0]?.url;
      if (firstAudioUrl) {
        void ensureAudio(firstAudioUrl).catch(() => null).then(() => {
          if (requestId === requestIdRef.current) playSequenceItem(0);
        });
      } else {
        playSequenceItem(0);
      }
      // Preload the next article's audio so advancing never waits on fetch.
      const nextRow = rows[clamped + 1];
      const nextUrl = nextRow?.audio_ready ? absoluteAudio(nextRow.audio_url) : null;
      if (nextUrl) preloadAudio([nextUrl]);
    }).catch((error: unknown) => {
      if (requestId !== requestIdRef.current) return;
      transitionTransport('idle');
      console.warn('[WordNewDailyReadingPlayer] Playback sequence build skipped:', error);
    });
  }, [
    buildSequence,
    cancelActivePlayback,
    playSequenceItem,
    preloadArticleResources,
    transitionTransport,
  ]);
  playAtRef.current = playAt;

  useEffect(() => subscribeAuthLoginSuccess((detail) => {
    if (detail.request?.source !== 'wordnew-daily-reading' || detail.request.reason !== 'playback') return;
    if (listRef.current.length === 0) return;
    const begin = (): void => playAtRef.current(indexRef.current);
    if (cloudDirtyRef.current) {
      begin();
      return;
    }
    void pullCloudSettings().then(begin).catch((error: unknown) => {
      console.warn('[WordNewDailyReadingPlayer] Cloud settings login fallback:', error);
      begin();
    });
  }), [pullCloudSettings]);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const handleGroupChange = (event: Event): void => {
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key !== StorageKeys.WORDNEW_DAILY_READING_WORD_GROUP) return;
      batchPlayedWordsRef.current = new Set();
      sessionReadCountsRef.current = new Map();
      setSessionReadTotal(0);
      playAtRef.current(indexRef.current);
    };
    window.addEventListener(STORAGE_MANAGER_CHANGED_EVENT, handleGroupChange);
    return () => window.removeEventListener(STORAGE_MANAGER_CHANGED_EVENT, handleGroupChange);
  }, [open]);

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
    transitionTransport('idle');
  }, [playAt, transitionTransport]);
  nextRef.current = next;

  const rebuildRemainingSequence = useCallback((
    completedItem: DailyReadingSequenceItem,
  ): number => {
    const row = listRef.current[indexRef.current];
    const sentenceUrl = row ? sentenceAudioUrl(row) : null;
    if (!row || !sentenceUrl) return -1;
    const currentSettings = settingsRef.current;
    const pattern = currentSettings.playbackPattern.length > 0
      ? currentSettings.playbackPattern
      : defaultDailyReadingPattern();
    const wordSelectionSignature = dailyReadingWordSelectionSignature(currentSettings);
    const selectedWords = sequenceWordSelectionSignatureRef.current === wordSelectionSignature
      ? selectedWordsRef.current
      : selectDailyReadingPlaybackWords(
        articleWordsRef.current,
        currentSettings,
        sessionReadCountsRef.current,
        batchPlayedWordsRef.current,
      );
    const previousItems = sequenceRef.current;
    const nextItems = buildDailyReadingSequenceItems(row, sentenceUrl, selectedWords, pattern);
    const nextIndex = nextReconciledSequenceIndex(
      completedItem,
      nextItems,
      completedExecutionKeysRef.current,
      previousItems,
    );
    sequenceRef.current = nextItems;
    sequenceExecutionSignatureRef.current = dailyReadingExecutionSignature(currentSettings);
    sequenceWordSelectionSignatureRef.current = wordSelectionSignature;
    selectedWordsRef.current = selectedWords;
    setActiveWords(selectedWords);
    return nextIndex;
  }, []);

  const advanceFromSequenceBoundary = useCallback(() => {
    const completedItem = sequenceRef.current[sequenceIndexRef.current];
    if (!completedItem) {
      nextRef.current();
      return;
    }
    if (sequenceExecutionSignatureRef.current !== dailyReadingExecutionSignature(settingsRef.current)) {
      const nextIndex = rebuildRemainingSequence(completedItem);
      if (nextIndex >= 0) {
        playSequenceItem(nextIndex);
        return;
      }
      setActiveItem(EMPTY_DAILY_READING_ACTIVE_ITEM);
      nextRef.current();
      return;
    }
    if (sequenceIndexRef.current < sequenceRef.current.length - 1) {
      playSequenceItem(sequenceIndexRef.current + 1);
      return;
    }
    setActiveItem(EMPTY_DAILY_READING_ACTIVE_ITEM);
    nextRef.current();
  }, [playSequenceItem, rebuildRemainingSequence]);

  const onSequenceEnded = useCallback((played: boolean) => {
    const completedItem = sequenceRef.current[sequenceIndexRef.current];
    if (completedItem) completedExecutionKeysRef.current.add(completedItem.executionKey);
    if (speechProgressTimerRef.current) {
      clearInterval(speechProgressTimerRef.current);
      speechProgressTimerRef.current = null;
    }
    if (played && completedItem?.type === 'words' && completedItem.wordRow) {
      const completedWord = completedItem.wordRow.word;
      const completedWordKey = sentenceWordKey(completedWord);
      if (completedWordKey) {
        const nextReadCount = Math.max(
          Number(completedItem.wordRow.play_count) || 0,
          sessionReadCountsRef.current.get(completedWordKey) ?? 0,
        ) + 1;
        batchPlayedWordsRef.current.add(completedWordKey);
        sessionReadCountsRef.current.set(completedWordKey, nextReadCount);
        const markPlayed = (word: WordNewSentenceWordRow): WordNewSentenceWordRow => (
          sentenceWordKey(word.word) === completedWordKey
            ? {
              ...word,
              played: true,
              play_count: nextReadCount,
              in_target_group: true,
              added_to_target_group: word.added_to_target_group || !word.in_target_group,
              in_default_group: true,
              added_to_default_group: word.added_to_default_group || !word.in_target_group,
            }
            : word
        );
        selectedWordsRef.current = selectedWordsRef.current.map(markPlayed);
        setActiveWords(selectedWordsRef.current);
        setArticleWords((rows) => {
          const nextRows = rows.map(markPlayed);
          articleWordsRef.current = nextRows;
          return nextRows;
        });
        setSessionReadTotal((total) => total + 1);
        wordNewProgressCenter.reportSentenceReads([completedWord], 'en', sequenceGroupIdRef.current);
        // Best-effort recitation mirror (POST /recitation/log, batched by the
        // center) so the global daily recitation counters move with playback;
        // the same mirror the recite loop uses (WfNewStudyProgress.recordSeen).
        wordNewRecitationCenter.recordActionMirrored(completedWord, 'read', 'en');
      }
    }
    if (transportStateRef.current === 'paused') {
      pendingAdvanceRef.current = true;
      return;
    }
    advanceFromSequenceBoundary();
  }, [advanceFromSequenceBoundary]);
  endedRef.current = onSequenceEnded;

  useEffect(() => {
    if (typeof Audio === 'undefined') return;
    const audio = new Audio();
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime || 0);
      setDuration(audio.duration || 0);
    };
    audioRef.current = audio;
    return () => {
      audio.ontimeupdate = null;
      resetPlaybackAudio(audio);
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  const start = useCallback((rows: DailyReadingRow[], startId?: string) => {
    const playable = rows.filter((row) => row.audio_ready === true && !!row.audio_url);
    if (playable.length === 0) return;
    cancelActivePlayback();
    const startRequestId = ++startRequestIdRef.current;
    const at = startId ? playable.findIndex((row) => row.id === startId) : 0;
    const startIndex = at >= 0 ? at : 0;
    listRef.current = playable;
    batchPlayedWordsRef.current = new Set();
    sessionReadCountsRef.current = new Map();
    setSessionReadTotal(0);
    setList(playable);
    setActiveItem(EMPTY_DAILY_READING_ACTIVE_ITEM);
    setCurrentTime(0);
    setDuration(0);
    transitionTransport('loading');
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
  }, [cancelActivePlayback, playAt, pullCloudSettings, transitionTransport]);

  const pause = useCallback(() => {
    if (transportStateRef.current !== 'playing') return;
    audioRef.current?.pause();
    if (utteranceRef.current && typeof speechSynthesis !== 'undefined') {
      try {
        speechSynthesis.pause();
      } catch {
        return;
      }
    }
    transitionTransport('paused');
  }, [transitionTransport]);

  const resume = useCallback(() => {
    const transportState = transportStateRef.current;
    if (transportState === 'loading' || transportState === 'playing') return;
    if (!wfNewApi.isAuthenticated()) {
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'playback' });
      return;
    }
    if (pendingAdvanceRef.current) {
      pendingAdvanceRef.current = false;
      transitionTransport('loading');
      advanceFromSequenceBoundary();
      return;
    }
    const currentItem = sequenceRef.current[sequenceIndexRef.current];
    const utterance = utteranceRef.current;
    if (utterance && typeof speechSynthesis !== 'undefined') {
      speechProgressTickRef.current = Date.now();
      try {
        speechSynthesis.resume();
        transitionTransport('playing');
      } catch {
        transitionTransport('paused');
      }
      return;
    }
    const audio = audioRef.current;
    if (audio?.getAttribute('src') && !audio.ended && currentItem) {
      const requestId = requestIdRef.current;
      const completionToken = activeCompletionTokenRef.current;
      audio.playbackRate = rateForSequenceItem(currentItem, settingsRef.current);
      void audio.play()
        .then(() => {
          if (requestId === requestIdRef.current && transportStateRef.current !== 'stopped') {
            transitionTransport('playing');
          }
        })
        .catch((error: unknown) => {
          if (requestId !== requestIdRef.current || transportStateRef.current === 'stopped') return;
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            transitionTransport('paused');
            return;
          }
          if (completionToken !== null) completePlaybackItem(completionToken, false);
        });
      return;
    }
    playAt(indexRef.current);
  }, [advanceFromSequenceBoundary, completePlaybackItem, playAt, transitionTransport]);

  const toggle = useCallback(() => {
    const transportState = transportStateRef.current;
    if (transportState === 'loading') return;
    if (transportState === 'playing') {
      pause();
      return;
    }
    resume();
  }, [pause, resume]);

  const prev = useCallback(() => {
    const previous = indexRef.current > 0
      ? indexRef.current - 1
      : settingsRef.current.playbackMode === 'repeat-all' ? listRef.current.length - 1 : 0;
    playAt(previous);
  }, [playAt]);

  const stop = useCallback(() => {
    startRequestIdRef.current += 1;
    cancelActivePlayback();
    sequenceRef.current = [];
    sequenceIndexRef.current = 0;
    sequenceExecutionSignatureRef.current = '';
    sequenceWordSelectionSignatureRef.current = '';
    sequenceGroupIdRef.current = null;
    completedExecutionKeysRef.current = new Set();
    listRef.current = [];
    indexRef.current = 0;
    setList([]);
    setIndex(0);
    setActiveItem(EMPTY_DAILY_READING_ACTIVE_ITEM);
    setCurrentTime(0);
    setDuration(0);
    selectedWordsRef.current = [];
    setActiveWords([]);
    articleWordsRef.current = [];
    setArticleWords([]);
    resourceRequestIdRef.current += 1;
    setResourceStatus(EMPTY_DAILY_READING_RESOURCE_STATUS);
    transitionTransport('stopped');
    setOpen(false);
    void wordNewProgressCenter.flushNow();
  }, [cancelActivePlayback, transitionTransport]);

  useEffect(() => () => {
    startRequestIdRef.current += 1;
    resourceRequestIdRef.current += 1;
    cancelActivePlayback();
    audioRef.current = null;
  }, [cancelActivePlayback]);

  useEffect(() => wordNewProgressCenter.subscribe(() => {
    setWordProgressVersion((version) => version + 1);
  }), []);

  useEffect(() => {
    const row = list[index];
    const resourcesPending = articleWords.length === 0 || articleWords.some((word) => (
      !word.audio_url || sentenceWordTranslations(word).length === 0
    ));
    if (!open || !row?.article_en || !resourcesPending) return;
    const expectedIndex = index;
    const expectedRequestId = requestIdRef.current;
    const timer = setTimeout(() => {
      const groupId = selectedDailyReadingWordGroupId();
      void getSentenceWordTable(
        row.article_en as string,
        'en',
        'zh',
        settingsRef.current.newOnlyMaxReadCount,
        groupId,
      ).then((freshRows) => {
        if (
          indexRef.current !== expectedIndex
          || requestIdRef.current !== expectedRequestId
          || !row.audio_url
        ) return;
        const currentByWord = new Map(articleWords.map((word) => [sentenceWordKey(word.word), word]));
        const mergedRows = normalizeSentenceWordAudio(uniqueSentenceWordRows(freshRows)).map((fresh) => (
          mergeSentenceWordRuntimeState(fresh, currentByWord.get(sentenceWordKey(fresh.word)))
        ));
        const freshByWord = new Map(mergedRows.map((word) => [sentenceWordKey(word.word), word]));
        articleWordsRef.current = mergedRows;
        setArticleWords(mergedRows);
        selectedWordsRef.current = selectedWordsRef.current.map((currentWord) => {
          const fresh = freshByWord.get(sentenceWordKey(currentWord.word));
          return fresh ? mergeSentenceWordRuntimeState(fresh, currentWord) : currentWord;
        });
        setActiveWords(selectedWordsRef.current);
        sequenceRef.current = sequenceRef.current.map((item) => {
          if (!item.wordRow) return item;
          const fresh = freshByWord.get(sentenceWordKey(item.wordRow.word));
          if (!fresh) return item;
          const wordRow = mergeSentenceWordRuntimeState(fresh, item.wordRow);
          if (!wordRow.audio_url) return { ...item, wordRow };
          return {
            ...item,
            wordRow,
            url: wordRow.audio_url,
            speechText: undefined,
            speakLang: undefined,
          };
        });
        const sentenceUrl = sentenceAudioUrl(row);
        if (sentenceUrl) preloadArticleResources(sentenceUrl, mergedRows);
      }).catch(() => undefined);
    }, 5000);
    return () => clearTimeout(timer);
  }, [articleWords, index, list, open, preloadArticleResources]);

  // Live-apply playback rate changes to the currently playing audio item.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio?.getAttribute('src')) return;
    audio.playbackRate = activeItem.stepType === 'words'
      ? settings.wordRate
      : settings.sentenceRate;
  }, [settings.sentenceRate, settings.wordRate, activeItem.stepType]);

  return {
    open,
    playing,
    paused,
    transportState,
    list,
    index,
    current: list[index] ?? null,
    currentTime,
    duration,
    activeStepType: activeItem.stepType,
    activeStepId: activeItem.stepId,
    activeStepItemIndex: activeItem.stepItemIndex,
    activeSentenceLanguage: activeItem.sentenceLanguage,
    activeWord: activeItem.word,
    activeWordIndex: activeItem.wordIndex,
    activeWords,
    articleWords,
    resourceStatus,
    wordProgressVersion,
    sessionReadTotal,
    ...settings,
    start,
    toggle,
    pause,
    resume,
    stop,
    next,
    prev,
    updateSettings,
  };
}
