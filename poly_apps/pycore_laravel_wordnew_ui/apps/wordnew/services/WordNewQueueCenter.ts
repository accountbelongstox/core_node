import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';
import { laravelApi } from '../../../core/integrations/laravel';
import { diffQueueContext } from '../../../core/tasks/DiffQueueContext';
import { WordNewQueueCommandGateway } from './queue/WordNewQueueCommandGateway';
import { wfNewApi } from '../api';
import type { WfNewQueueCommandResult, WfNewWordAccent, WfNewWordMedia } from '../api';
import { logWarn } from '../../../core/logstore/logStore';
import {
  sentenceAudioQueueKey,
  wordAudioQueueKey,
  wordNewQueueRuntime,
  wordTranslationQueueKey,
} from './WordNewQueueRuntime';

export interface WordNewSentenceAudioHeadItem {
  text: string;
  language: string;
  content_id?: string;
}

export interface WordNewWordAudioWaitOptions {
  accent?: WfNewWordAccent;
  shouldContinue?: () => boolean;
}

const WORD_AUDIO_POLL_INTERVAL_MS = Math.max(
  250,
  Number(QUEUE_CENTER_DIFF_DELIVERY.poll_interval_ms || 1000),
);
const WORD_AUDIO_POLL_LIMIT = 40;
const WORD_AUDIO_BATCH_LIMIT = QUEUE_CENTER_DIFF_DELIVERY.producer_batch_limits.word_audio;

interface WordAudioWait {
  word: string;
  language: string;
  options: WordNewWordAudioWaitOptions;
  attempts: number;
  /** Not yet moved to the queue head. */
  fresh: boolean;
  promise: Promise<WfNewWordMedia | null>;
  resolve: (media: WfNewWordMedia | null) => void;
}

class WordNewQueueCenterClass extends WordNewQueueCommandGateway {
  private readonly wordAudioWaits = new Map<string, WordAudioWait>();
  private wordAudioTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super(QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
  }

  /**
   * Part2 fill path (wordnew -> Laravel -> Mercure/diff -> pycore): wordnew
   * is the SOLE actor that notifies Laravel of queue-head moves. Because
   * wordnew notifies Laravel first, Laravel's head notification defaults to
   * landing in Part2 on the pycore side, deduped against the whole Queue.
   * pycore itself never pushes head state to Laravel (its orchestration /
   * pycore-manager promotes fill Part1 locally).
   */
  moveSentencesToHead(items: WordNewSentenceAudioHeadItem[]): Promise<unknown> {
    const normalized = this.normalizeSentences(items);
    if (normalized.length === 0) return Promise.resolve(null);
    return this.executeBatchOnce(
      'sentence-audio',
      normalized,
      (item) => sentenceAudioQueueKey(item.text, item.language),
      async (commandItems) => {
        const requestItems = commandItems.map(({ text, language }) => ({ text, language }));
        const keys = commandItems.map((item) => sentenceAudioQueueKey(item.text, item.language));
        wordNewQueueRuntime.markAll(keys, 'audio', 'waiting');
        diffQueueContext.touch(
          'wordnew:sentence-audio:head',
          commandItems.map((item) => `${item.language}:${item.text}`),
        );
        try {
          const response = await wfNewApi.moveSentenceAudioToHead(requestItems);
          wordNewQueueRuntime.recordSentenceAudio(response, requestItems);
          return response;
        } catch (error) {
          wordNewQueueRuntime.markAll(keys, 'audio', 'failed');
          throw error;
        }
      },
    );
  }

  /**
   * Part2 fill path: wordnew is the SOLE notifier of Laravel head moves
   * (see moveSentencesToHead). Word moves default to landing in Part2 on
   * the pycore side; pycore never pushes head state back to Laravel.
   */
  moveWordsToHead(words: string[], language: string): Promise<unknown> {
    const normalizedLanguage = language.trim();
    const normalizedWords = this.boundedUnique(words);
    if (!normalizedLanguage || normalizedWords.length === 0) return Promise.resolve(null);
    return this.executeBatchOnce(
      'word-audio',
      normalizedWords,
      (word) => wordAudioQueueKey(word, normalizedLanguage),
      async (commandWords) => {
        const remainingWords = new Set(commandWords);
        const responses: WfNewQueueCommandResult[] = [];
        const requestBatches: string[][] = [];
        for (let offset = 0; offset < commandWords.length; offset += WORD_AUDIO_BATCH_LIMIT) {
          requestBatches.push(commandWords.slice(offset, offset + WORD_AUDIO_BATCH_LIMIT));
        }
        wordNewQueueRuntime.markAll(commandWords.map((word) => wordAudioQueueKey(word, normalizedLanguage)), 'audio', 'waiting');
        diffQueueContext.touch(
          'wordnew:word-audio:head',
          commandWords.map((word) => `${normalizedLanguage}:${word}`),
        );
        try {
          for (const requestBatch of requestBatches.reverse()) {
            const response = await wfNewApi.moveWordAudioToHead(requestBatch, normalizedLanguage);
            wordNewQueueRuntime.recordWordAudio(response, requestBatch, normalizedLanguage);
            requestBatch.forEach((word) => remainingWords.delete(word));
            responses.push(response);
          }
          return responses;
        } catch (error) {
          wordNewQueueRuntime.markAll([...remainingWords].map((word) => wordAudioQueueKey(word, normalizedLanguage)), 'audio', 'failed');
          throw error;
        }
      },
    );
  }

  prioritizeTranslations(words: string[], language: string, targetLanguage: string): Promise<unknown> {
    const normalizedLanguage = language.trim();
    const normalizedTargetLanguage = targetLanguage.trim();
    const normalizedWords = this.boundedUnique(words);
    if (!normalizedLanguage || !normalizedTargetLanguage || normalizedWords.length === 0) {
      return Promise.resolve(null);
    }
    return this.executeBatchOnce(
      'word-translation',
      normalizedWords,
      (word) => wordTranslationQueueKey(word, normalizedLanguage, normalizedTargetLanguage),
      async (commandWords) => {
        const keys = commandWords.map((word) => wordTranslationQueueKey(word, normalizedLanguage, normalizedTargetLanguage));
        wordNewQueueRuntime.markAll(keys, 'translation', 'waiting');
        diffQueueContext.touch(
          'wordnew:word-translation:priority',
          commandWords.map((word) => `${normalizedLanguage}:${normalizedTargetLanguage}:${word}`),
        );
        try {
          const response = await laravelApi.stackQueue(
            commandWords,
            normalizedLanguage,
            normalizedTargetLanguage,
          );
          wordNewQueueRuntime.recordTranslations(
            response,
            commandWords,
            normalizedLanguage,
            normalizedTargetLanguage,
          );
          return response;
        } catch (error) {
          wordNewQueueRuntime.markAll(keys, 'translation', 'failed');
          throw error;
        }
      },
    );
  }

  notifyMissingWord(word: string, language: string): void {
    void this.moveWordsToHead([word], language).catch((error) => {
      logWarn('wordnew-queue', `missing word notification failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  /**
   * Wait until a word's audio exists. All waiting words are polled together:
   * one read-only lookup per tick for every pending word (not one request per
   * word); a word found ready is read once for its full media (accent variants).
   * New words are moved to the queue head in one batch per language first.
   */
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
    if (current) return current.promise;
    if (this.wordAudioWaits.size >= QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit) {
      return Promise.resolve(null);
    }
    let resolve: (media: WfNewWordMedia | null) => void = () => undefined;
    const promise = new Promise<WfNewWordMedia | null>((done) => { resolve = done; });
    this.wordAudioWaits.set(key, {
      word: normalizedWord, language: normalizedLanguage, options, attempts: 0, fresh: true, promise, resolve,
    });
    this.scheduleWordAudioTick(0);
    return promise;
  }

  private scheduleWordAudioTick(delayMs: number): void {
    this.wordAudioTimer ??= setTimeout(() => {
      this.wordAudioTimer = null;
      void this.wordAudioTick();
    }, delayMs);
  }

  private settleWordAudio(key: string, media: WfNewWordMedia | null): void {
    const wait = this.wordAudioWaits.get(key);
    if (!wait) return;
    this.wordAudioWaits.delete(key);
    wait.resolve(media);
  }

  private async wordAudioTick(): Promise<void> {
    const waits = [...this.wordAudioWaits.entries()].filter(([key, wait]) => {
      if (wait.options.shouldContinue && !wait.options.shouldContinue()) {
        this.settleWordAudio(key, null);
        return false;
      }
      return true;
    });
    const fresh = waits.filter(([, wait]) => wait.fresh);
    fresh.forEach(([, wait]) => { wait.fresh = false; });
    const languages = [...new Set(fresh.map(([, wait]) => wait.language))];
    await Promise.all(languages.map((language) => this.moveWordsToHead(
      fresh.filter(([, wait]) => wait.language === language).map(([, wait]) => wait.word),
      language,
    ).catch(() => null)));
    if (waits.length > 0) {
      const found = await wfNewApi.lookupAudio(waits.map(([, wait]) => ({ kind: 'word', language: wait.language, text: wait.word })))
        .catch(() => [] as Array<{ ready: boolean }>);
      await Promise.all(waits.map(async ([key, wait], index) => {
        wait.attempts += 1;
        if (found[index]?.ready) {
          const media = await wfNewApi.getWordAudio(wait.language, wait.word, { accent: wait.options.accent, passive: true }).catch(() => null);
          const readyVariant = media?.audioVariants?.find((variant) => variant.status === 'ready' && variant.url);
          if (media && (media.audioUrl || readyVariant)) {
            wordNewQueueRuntime.markReady(wordAudioQueueKey(wait.word, wait.language), 'audio');
            this.settleWordAudio(key, media);
            return;
          }
        }
        if (wait.attempts >= WORD_AUDIO_POLL_LIMIT) this.settleWordAudio(key, null);
      }));
    }
    if (this.wordAudioWaits.size > 0) this.scheduleWordAudioTick(WORD_AUDIO_POLL_INTERVAL_MS);
  }

  private normalizeSentences(items: WordNewSentenceAudioHeadItem[]): WordNewSentenceAudioHeadItem[] {
    return this.boundedByKey(
      items
        .map((item) => ({
          text: item.text.trim(),
          language: item.language.trim(),
          content_id: item.content_id,
        }))
        .filter((item) => item.text && item.language),
      (item) => `${item.language}:${item.text}`,
    );
  }
}

export const wordNewQueueCenter = new WordNewQueueCenterClass();
