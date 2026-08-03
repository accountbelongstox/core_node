/**
 * Priority-boost hooks for wordnew reader / shelf / library surfaces.
 * Audio priority goes through the shared queue center straight to Laravel,
 * which owns the queue and notifies the pycore worker itself. Translation
 * stacking remains a direct Laravel command. Failures never block the UI.
 */
import { useEffect, useRef } from 'react';
import { WfNewApiPaths } from '../api/WfNewApiPaths';
import { postJSON } from '../api/WfNewApiTransport';
import { wfNewSettings } from '../WfNewSettingsStore';
import { wordNewAudioQueueCenter } from '../services/WordNewAudioQueueCenter';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';

const READER_DEBOUNCE_MS = 150;
const DEFAULT_STACK_PRIORITY = 100;

export type PriorityBoostSentence = { text: string; language: string };

function normalizeSentences(
  sentences: PriorityBoostSentence[] | null | undefined,
): PriorityBoostSentence[] {
  if (!sentences?.length) return [];
  const seen = new Set<string>();
  const out: PriorityBoostSentence[] = [];
  for (const row of sentences) {
    const text = row?.text?.trim();
    const language = row?.language?.trim();
    if (!text || !language) continue;
    const key = `${language}:${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text, language });
  }
  return out.slice(0, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
}

/** Debounced (~150ms) POST of visible sentence texts to sentence bump-batch. */
export function useReaderPriorityBoost(
  sentences: PriorityBoostSentence[] | null,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSigRef = useRef('');

  useEffect(() => {
    const items = normalizeSentences(sentences);
    if (!items.length) return undefined;
    const sig = items.map((it) => `${it.language}:${it.text}`).join('|');
    if (sig === lastSigRef.current) return undefined;

    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      lastSigRef.current = sig;
      void wordNewAudioQueueCenter.prioritizeSentences(items).catch((e) => {
        console.warn('[wordnew] sentence bump-batch failed', e);
      });
    }, READER_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sentences]);
}

/**
 * When a shelf course opens, boost its untranslated words (translation stack)
 * and optionally bump sentence texts when provided (book-style shelf entries).
 */
export function useShelfPriorityBoost(
  courseId: string | null,
  opts?: {
    sentences?: PriorityBoostSentence[] | null;
    words?: string[] | null;
    language?: string | null;
    targetLanguage?: string | null;
  } | null,
): void {
  const bumpedKeyRef = useRef<string | null>(null);
  const sentences = opts?.sentences;
  const words = opts?.words;
  const language = opts?.language;
  const targetLanguage = opts?.targetLanguage;

  useEffect(() => {
    if (!courseId) {
      bumpedKeyRef.current = null;
      return;
    }
    const items = normalizeSentences(sentences);
    const lang = (language || '').trim() || (items[0]?.language ?? '');
    const list = Array.from(new Set((words || []).map((w) => w.trim()).filter(Boolean)))
      .slice(0, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
    const target = (
      targetLanguage
      || wfNewSettings.get('settingNativeLang')
      || 'zh'
    ).trim();
    const sig = `${courseId}:${lang}:${target}:${list.join('|')}:${items.map((it) => it.text).join('|')}`;
    if (bumpedKeyRef.current === sig) return;
    if (!items.length && !(lang && list.length && target)) return;
    bumpedKeyRef.current = sig;

    if (items.length) {
      void wordNewAudioQueueCenter.prioritizeSentences(items).catch((e) => {
        console.warn('[wordnew] shelf sentence bump-batch failed', e);
      });
    }
    if (lang && list.length && target) {
      void postJSON(WfNewApiPaths.translationQueueStack, {
        words: list,
        language: lang,
        target_language: target,
        priority: DEFAULT_STACK_PRIORITY,
      }).catch((e) => {
        console.warn('[wordnew] shelf translation stack failed', e);
      });
    }
  }, [courseId, sentences, words, language, targetLanguage]);
}

/**
 * When a vocabulary library opens, stack untranslated words into the
 * translation queue (target_language from settings native lang).
 */
export function useLibraryPriorityBoost(
  libraryId: string | null,
  words?: string[] | null,
  language?: string | null,
  targetLanguage?: string | null,
): void {
  const stackedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!libraryId) {
      stackedKeyRef.current = null;
      return;
    }
    const lang = (language || '').trim();
    const list = Array.from(new Set((words || []).map((w) => w.trim()).filter(Boolean)))
      .slice(0, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
    if (!lang || !list.length) return;

    const target = (
      targetLanguage
      || wfNewSettings.get('settingNativeLang')
      || 'zh'
    ).trim();
    if (!target) return;

    const sig = `${libraryId}:${lang}:${target}:${list.join('|')}`;
    if (stackedKeyRef.current === sig) return;
    stackedKeyRef.current = sig;

    void postJSON(WfNewApiPaths.translationQueueStack, {
      words: list,
      language: lang,
      target_language: target,
      priority: DEFAULT_STACK_PRIORITY,
    }).catch((e) => {
      console.warn('[wordnew] translation queue stack failed', e);
    });
  }, [libraryId, words, language, targetLanguage]);
}
