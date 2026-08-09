/**
 * Central WordNew audio-priority gateway for book-reader sentence cells,
 * sentence word cards, and visible library words. Laravel owns the audio queue
 * and notifies the pycore worker itself, so every prioritization call goes
 * through the wordnew data-model layer (wfNewApi), never to pycore directly.
 */
import { wfNewApi } from '../api';
import type { WfNewWordAccent, WfNewWordMedia } from '../api';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';
import { diffQueueContext } from '../../../core/tasks/DiffQueueContext';
import {
  sentenceAudioQueueKey,
  wordAudioQueueKey,
  wordNewQueueRuntime,
} from './WordNewQueueRuntime';

export interface WordNewSentenceAudioPriorityItem {
  text: string;
  language: string;
  content_id?: string;
}

const WORD_AUDIO_POLL_INTERVAL_MS = 1200;
const WORD_AUDIO_POLL_LIMIT = 40;

export interface WordNewWordAudioWaitOptions {
  accent?: WfNewWordAccent;
  shouldContinue?: () => boolean;
}

class WordNewAudioQueueCenterClass {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly wordAudioWaits = new Map<string, Promise<WfNewWordMedia | null>>();

  prioritizeSentences(items: WordNewSentenceAudioPriorityItem[]): Promise<unknown> {
    const normalized = this.normalizeSentences(items);
    if (normalized.length === 0) return Promise.resolve(null);
    normalized.forEach((item) => {
      wordNewQueueRuntime.markWaiting(sentenceAudioQueueKey(item.text, item.language), 'audio');
    });
    diffQueueContext.touch(
      'wordnew:sentence-audio:priority',
      normalized.map((item) => `${item.language}:${item.text}`),
    );
    const key = `sentences:${normalized.map((item) => `${item.language}:${item.text}`).join('|')}`;
    const requestItems = normalized.map(({ text, language }) => ({ text, language })).reverse();
    return this.runOnce(
      key,
      // Reversed: each bump takes the next move-to-front ticket, so the FIRST
      // visible sentence ends up highest in the queue (legacy relay parity).
      async () => {
        const response = await wfNewApi.bumpSentenceAudioBatch(requestItems);
        wordNewQueueRuntime.recordSentenceAudio(response, requestItems);
        return response;
      },
    );
  }

  prioritizeSentence(contentId: string, language: string): Promise<unknown> {
    const normalizedContentId = contentId.trim();
    const normalizedLanguage = language.trim();
    if (!normalizedContentId || !normalizedLanguage) return Promise.resolve(null);
    diffQueueContext.touch(
      'wordnew:sentence-audio:priority',
      [`${normalizedLanguage}:${normalizedContentId}`],
    );
    const key = `sentence:${normalizedLanguage}:${normalizedContentId}`;
    return this.runOnce(
      key,
      () => wfNewApi.bumpSentenceAudio(normalizedContentId, normalizedLanguage),
    );
  }

  prioritizeWords(words: string[], language: string): Promise<unknown> {
    const normalizedLanguage = language.trim();
    const normalizedWords = Array.from(new Set(words.map((word) => word.trim()).filter(Boolean)))
      .slice(0, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
    if (!normalizedLanguage || normalizedWords.length === 0) return Promise.resolve(null);
    normalizedWords.forEach((word) => {
      wordNewQueueRuntime.markWaiting(wordAudioQueueKey(word, normalizedLanguage), 'audio');
    });
    diffQueueContext.touch(
      'wordnew:word-audio:priority',
      normalizedWords.map((word) => `${normalizedLanguage}:${word}`),
    );
    const key = `words:${normalizedLanguage}:${normalizedWords.join('|')}`;
    const requestWords = normalizedWords.slice().reverse();
    return this.runOnce(
      key,
      // Reversed for the same move-to-front ticket reason as prioritizeSentences.
      async () => {
        const response = await wfNewApi.prioritizeWordAudio(requestWords, normalizedLanguage);
        wordNewQueueRuntime.recordWordAudio(response, requestWords, normalizedLanguage);
        return response;
      },
    );
  }

  notifyMissingWord(word: string, language: string): void {
    void this.prioritizeWords([word], language).catch((error) => {
      console.warn('[WordNewAudioQueueCenter] Missing word notification failed', error);
    });
  }

  waitForWordAudio(
    word: string,
    language: string,
    options: WordNewWordAudioWaitOptions = {},
  ): Promise<WfNewWordMedia | null> {
    const normalizedWord = word.trim();
    const normalizedLanguage = language.trim();
    if (!normalizedWord || !normalizedLanguage) return Promise.resolve(null);
    const key = `word-audio:${normalizedLanguage}:${options.accent ?? ''}:${normalizedWord}`;
    const current = this.wordAudioWaits.get(key);
    if (current) return current;
    if (this.wordAudioWaits.size >= QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit) {
      return Promise.resolve(null);
    }
    const pending = this.pollWordAudio(normalizedWord, normalizedLanguage, options)
      .catch(() => null)
      .finally(() => {
        if (this.wordAudioWaits.get(key) === pending) this.wordAudioWaits.delete(key);
      });
    this.wordAudioWaits.set(key, pending);
    return pending;
  }

  private async pollWordAudio(
    word: string,
    language: string,
    options: WordNewWordAudioWaitOptions,
  ): Promise<WfNewWordMedia | null> {
    await this.prioritizeWords([word], language);
    for (let attempt = 0; attempt < WORD_AUDIO_POLL_LIMIT; attempt += 1) {
      if (options.shouldContinue && !options.shouldContinue()) return null;
      const media = await wfNewApi.getWordMedia(language, word, {
        accent: options.accent,
        passive: true,
      });
      const readyVariant = media.audioVariants?.find((variant) => variant.status === 'ready' && variant.url);
      if (media.audioUrl || readyVariant) {
        wordNewQueueRuntime.markReady(wordAudioQueueKey(word, language), 'audio');
        return media;
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, WORD_AUDIO_POLL_INTERVAL_MS);
      });
    }
    return null;
  }

  private normalizeSentences(items: WordNewSentenceAudioPriorityItem[]): WordNewSentenceAudioPriorityItem[] {
    const normalized: WordNewSentenceAudioPriorityItem[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      const text = item.text.trim();
      const language = item.language.trim();
      const key = `${language}:${text}`;
      if (!text || !language || seen.has(key)) continue;
      seen.add(key);
      normalized.push({ text, language, content_id: item.content_id });
    }
    return normalized.slice(0, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
  }

  private runOnce<T>(key: string, request: () => Promise<T>): Promise<T> {
    const current = this.inFlight.get(key);
    if (current) return current as Promise<T>;
    const pending = request().finally(() => {
      if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
    });
    this.inFlight.set(key, pending);
    return pending;
  }
}

export const wordNewAudioQueueCenter = new WordNewAudioQueueCenterClass();
