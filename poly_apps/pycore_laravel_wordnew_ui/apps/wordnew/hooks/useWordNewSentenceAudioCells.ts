import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WfNewBookVerse, WfNewBookVerseLang } from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { useReaderQueueHead } from './usePriorityBoost';
import {
  requestSentenceAudio,
  resetSentenceAudioScheduler,
} from '../services/WordNewBookReaderSentenceAudio';
import { cellKeyOf, ttsStatusToCellState, type WordNewAudioCellState } from '../utils/WordNewAudioCellState';
import { pickSentenceAudioUrl, readerPreferredAccent } from '../utils/WordNewSentenceAudioPick';
import { ensureAudio } from '../runtime-store/WfNewAudioCache';

interface Options {
  verses: WfNewBookVerse[];
  langs: string[];
  variantByLang: Record<string, string>;
  /** Changing the scope (book page, orchestrated item) drops pending pollers. */
  scopeKey: string;
}

export interface WordNewSentenceAudioCells {
  cellStatuses: Record<string, WordNewAudioCellState>;
  requestCellMedia: (verse: WfNewBookVerse, lang: string, text: string | null, hasAudio: boolean) => void;
  retryCellAudio: (verse: WfNewBookVerse, lang: string, text: string) => void;
  resolveAudioUrl: (verse: WfNewBookVerse, lang: string, shouldContinue?: () => boolean) => Promise<string | null>;
}

const hasReadyClip = (cell: WfNewBookVerseLang | undefined): boolean => (
  !!(cell?.hasAudio || cell?.audioFiles?.some((f) => f.hasFile && f.url))
);

/** Sentence-audio cell state for verse lists: seeded from the verses, polled
 * through the shared sentence-audio scheduler, moved to Laravel's queue head
 * while visible, and resolved to a playable (cached) URL for the playback engine. */
export function useWordNewSentenceAudioCells({
  verses, langs, variantByLang, scopeKey,
}: Options): WordNewSentenceAudioCells {
  const [cellStatuses, setCellStatuses] = useState<Record<string, WordNewAudioCellState>>({});
  const requestedCellKeys = useRef<Set<string>>(new Set());
  const resolvedAudioUrlsRef = useRef<Record<string, string>>({});
  const variantByLangRef = useRef(variantByLang);
  useEffect(() => { variantByLangRef.current = variantByLang; }, [variantByLang]);

  const setCellStatus = useCallback((verse: WfNewBookVerse, lang: string, state: WordNewAudioCellState) => {
    const k = cellKeyOf(verse.grain, verse.seq, lang);
    setCellStatuses((prev) => (prev[k] === state ? prev : { ...prev, [k]: state }));
  }, []);

  const pollCell = useCallback((verse: WfNewBookVerse, lang: string, text: string, cellKey: string, urgent: boolean) => {
    setCellStatus(verse, lang, 'queued');
    requestSentenceAudio(text, lang, {
      urgent,
      onStatus: ({ exists, queued, tts_status }) => {
        setCellStatus(verse, lang, ttsStatusToCellState(exists, tts_status, queued));
      },
      onReady: (url) => {
        setCellStatus(verse, lang, 'ready');
        if (url) resolvedAudioUrlsRef.current[cellKeyOf(verse.grain, verse.seq, lang)] = url;
      },
      onSettled: (url) => {
        if (!url) requestedCellKeys.current.delete(cellKey);
      },
    });
  }, [setCellStatus]);

  const requestCellMedia = useCallback((verse: WfNewBookVerse, lang: string, text: string | null, _hasAudio: boolean) => {
    const cellKey = `${verse.grain}-${verse.seq}-${lang}:${(text || '').slice(0, 64)}`;
    if (requestedCellKeys.current.has(cellKey) || !text?.trim()) return;
    requestedCellKeys.current.add(cellKey);
    pollCell(verse, lang, text, cellKey, false);
  }, [pollCell]);

  const retryCellAudio = useCallback((verse: WfNewBookVerse, lang: string, text: string) => {
    const cellKey = `${verse.grain}-${verse.seq}-${lang}:${text.slice(0, 64)}`;
    requestedCellKeys.current.delete(cellKey);
    pollCell(verse, lang, text, cellKey, true);
  }, [pollCell]);

  const resolveAudioUrl = useCallback(async (
    verse: WfNewBookVerse,
    lang: string,
  ): Promise<string | null> => {
    const cell = verse.languages?.[lang];
    const variantKey = variantByLangRef.current[lang] ?? '';
    const preferredAccent = readerPreferredAccent(wfNewSettings.get('voiceAccent'));
    const picked = pickSentenceAudioUrl(cell, { variantKey, preferredAccent });
    if (picked.url) return (await ensureAudio(picked.url)) ?? picked.url;

    const remoteUrl = resolvedAudioUrlsRef.current[cellKeyOf(verse.grain, verse.seq, lang)];
    if (remoteUrl) return (await ensureAudio(remoteUrl)) ?? remoteUrl;
    return null;
  }, []);

  useEffect(() => {
    const next: Record<string, WordNewAudioCellState> = {};
    for (const v of verses) {
      for (const lang of langs) {
        const cell = v.languages?.[lang];
        if (!cell?.text?.trim()) continue;
        const k = cellKeyOf(v.grain, v.seq, lang);
        if (hasReadyClip(cell)) next[k] = 'ready';
        else if (cell.ttsStatus === 'processing') next[k] = 'processing';
        else if (cell.ttsStatus === 'pending') next[k] = 'queued';
      }
    }
    if (Object.keys(next).length) {
      setCellStatuses((prev) => ({ ...prev, ...next }));
    }
  }, [verses, langs]);

  useEffect(() => {
    requestedCellKeys.current = new Set();
    resetSentenceAudioScheduler();
  }, [scopeKey]);

  // Visible verse texts lacking audio are moved to Laravel's sentence queue head.
  const queueHeadSentences = useMemo(() => {
    const seen = new Set<string>();
    const items: { text: string; language: string }[] = [];
    for (const v of verses) {
      for (const lang of langs) {
        const cell = v.languages?.[lang];
        const text = cell?.text?.trim();
        if (!text || hasReadyClip(cell)) continue;
        const key = `${lang}:${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ text, language: lang });
      }
    }
    return items.length ? items : null;
  }, [verses, langs]);
  useReaderQueueHead(queueHeadSentences);

  return { cellStatuses, requestCellMedia, retryCellAudio, resolveAudioUrl };
}
