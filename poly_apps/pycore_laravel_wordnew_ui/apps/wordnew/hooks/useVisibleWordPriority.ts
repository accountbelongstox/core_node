import { useEffect, useRef } from 'react';
import { pycoreApi } from '@/apps/wordnew/integrations/pycore';
import { wordNewAudioQueueCenter } from '../services/WordNewAudioQueueCenter';

const FLUSH_DELAY_MS = 250;
const VISIBLE_PRIORITY = 200;
const MAX_BATCH_SIZE = 100;

export interface VisiblePriorityWord {
  md5?: string;
  word: string;
  hasTranslation: boolean;
  hasAudio: boolean;
  hasImage: boolean;
}

interface PendingVisibleWord extends VisiblePriorityWord {
  language: string;
  queueKey: string;
}

export function useVisibleWordPriority(language: string, targetLanguage: string) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementWordsRef = useRef(new Map<Element, VisiblePriorityWord>());
  const callbacksRef = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const latestWordsRef = useRef(new Map<string, VisiblePriorityWord>());
  const pendingRef = useRef(new Map<string, PendingVisibleWord>());
  const notifiedRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const languageRef = useRef(language);
  const targetLanguageRef = useRef(targetLanguage);
  languageRef.current = language;
  targetLanguageRef.current = targetLanguage;

  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    timerRef.current = null;
    const rows = Array.from<PendingVisibleWord>(pendingRef.current.values()).slice(0, MAX_BATCH_SIZE);
    for (const row of rows) pendingRef.current.delete(row.queueKey);
    if (rows.length === 0) return;
    const translationWords = rows.filter((row) => !row.hasTranslation).map((row) => row.word);
    const audioWords = rows.filter((row) => !row.hasAudio).map((row) => row.word);
    const imageItems = rows
      .filter((row) => !row.hasImage && row.word)
      .map((row) => ({ word: row.word, language: row.language }));
    const requests: Promise<unknown>[] = [];
    if (translationWords.length > 0) {
      requests.push(pycoreApi.stackQueue(
        translationWords,
        languageRef.current,
        targetLanguageRef.current,
        VISIBLE_PRIORITY,
      ));
    }
    if (audioWords.length > 0) {
      requests.push(wordNewAudioQueueCenter.prioritizeWords(audioWords, languageRef.current));
    }
    if (imageItems.length > 0) requests.push(pycoreApi.prioritizeWordImages(imageItems));
    void Promise.allSettled(requests).finally(() => {
      if (pendingRef.current.size > 0 && timerRef.current === null) {
        timerRef.current = setTimeout(() => flushRef.current(), FLUSH_DELAY_MS);
      }
    });
  };

  useEffect(() => {
    notifiedRef.current.clear();
    pendingRef.current.clear();
  }, [language, targetLanguage]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const word = elementWordsRef.current.get(entry.target);
        if (!word || (word.hasTranslation && word.hasAudio && word.hasImage)) continue;
        const wordKey = word.md5 || word.word.toLocaleLowerCase();
        const key = `${languageRef.current}:${targetLanguageRef.current}:${wordKey}`;
        if (notifiedRef.current.has(key)) continue;
        notifiedRef.current.add(key);
        pendingRef.current.set(wordKey, {
          ...word,
          language: languageRef.current,
          queueKey: wordKey,
        });
      }
      if (pendingRef.current.size > 0 && timerRef.current === null) {
        timerRef.current = setTimeout(() => flushRef.current(), FLUSH_DELAY_MS);
      }
    }, { threshold: 0.01 });
    observerRef.current = observer;
    for (const element of elementsRef.current.values()) observer.observe(element);
    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [language, targetLanguage]);

  const bindRef = useRef((word: VisiblePriorityWord) => {
    const wordKey = word.md5 || word.word.toLocaleLowerCase();
    latestWordsRef.current.set(wordKey, word);
    const currentElement = elementsRef.current.get(wordKey);
    if (currentElement) elementWordsRef.current.set(currentElement, word);
    let callback = callbacksRef.current.get(wordKey);
    if (!callback) {
      callback = (element: HTMLElement | null) => {
        const previous = elementsRef.current.get(wordKey);
        if (previous) {
          observerRef.current?.unobserve(previous);
          elementWordsRef.current.delete(previous);
          elementsRef.current.delete(wordKey);
        }
        if (!element) return;
        elementsRef.current.set(wordKey, element);
        elementWordsRef.current.set(element, latestWordsRef.current.get(wordKey) || word);
        observerRef.current?.observe(element);
      };
      callbacksRef.current.set(wordKey, callback);
    }
    return callback;
  });
  return bindRef.current;
}
