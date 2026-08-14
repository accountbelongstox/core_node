import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';
import { laravelApi } from '../../../core/integrations/laravel';
import { diffQueueContext } from '../../../core/tasks/DiffQueueContext';
import { WordNewQueueCommandGateway } from './queue/WordNewQueueCommandGateway';
import { wfNewApi } from '../api';
import type { WfNewQueueCommandResult, WfNewWordAccent, WfNewWordMedia } from '../api';
import { WfNewApiPaths } from '../api/WfNewApiPaths';
import { authedPostJSON } from '../api/WfNewApiTransport';
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

export interface WordNewWordImagePriorityItem {
  word: string;
  language: string;
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

class WordNewQueueCenterClass extends WordNewQueueCommandGateway {
  private readonly wordAudioWaits = new Map<string, Promise<WfNewWordMedia | null>>();

  constructor() {
    super(QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
  }

  moveSentencesToHead(items: WordNewSentenceAudioHeadItem[]): Promise<unknown> {
    const normalized = this.normalizeSentences(items);
    if (normalized.length === 0) return Promise.resolve(null);
    return this.executeBatchOnce(
      'sentence-audio',
      normalized,
      (item) => sentenceAudioQueueKey(item.text, item.language),
      async (commandItems) => {
        const requestItems = commandItems.map(({ text, language }) => ({ text, language }));
        commandItems.forEach((item) => {
          wordNewQueueRuntime.markWaiting(sentenceAudioQueueKey(item.text, item.language), 'audio');
        });
        diffQueueContext.touch(
          'wordnew:sentence-audio:head',
          commandItems.map((item) => `${item.language}:${item.text}`),
        );
        try {
          const response = await wfNewApi.moveSentenceAudioToHead(requestItems);
          wordNewQueueRuntime.recordSentenceAudio(response, requestItems);
          return response;
        } catch (error) {
          commandItems.forEach((item) => {
            wordNewQueueRuntime.markFailed(sentenceAudioQueueKey(item.text, item.language), 'audio');
          });
          throw error;
        }
      },
    );
  }

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
        commandWords.forEach((word) => {
          wordNewQueueRuntime.markWaiting(wordAudioQueueKey(word, normalizedLanguage), 'audio');
        });
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
          remainingWords.forEach((word) => {
            wordNewQueueRuntime.markFailed(wordAudioQueueKey(word, normalizedLanguage), 'audio');
          });
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
        commandWords.forEach((word) => {
          wordNewQueueRuntime.markWaiting(
            wordTranslationQueueKey(word, normalizedLanguage, normalizedTargetLanguage),
            'translation',
          );
        });
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
          commandWords.forEach((word) => {
            wordNewQueueRuntime.markFailed(
              wordTranslationQueueKey(word, normalizedLanguage, normalizedTargetLanguage),
              'translation',
            );
          });
          throw error;
        }
      },
    );
  }

  prioritizeWordImages(items: WordNewWordImagePriorityItem[]): Promise<unknown> {
    const normalized = this.boundedByKey(
      items
        .map((item) => ({ word: item.word.trim(), language: item.language.trim() }))
        .filter((item) => item.word && item.language),
      (item) => `${item.language}:${item.word}`,
    );
    if (normalized.length === 0) return Promise.resolve(null);
    return this.executeBatchOnce(
      'word-image',
      normalized,
      (item) => `${item.language.toLowerCase()}:${item.word.toLowerCase()}`,
      (commandItems) => {
        diffQueueContext.touch(
          'wordnew:word-media:priority',
          commandItems.map((item) => `${item.language}:${item.word}`),
        );
        return authedPostJSON(WfNewApiPaths.wordImageQueueAdd, {
          words: commandItems,
          priority: 'front',
          interactive: true,
        });
      },
    );
  }

  notifyMissingWord(word: string, language: string): void {
    void this.moveWordsToHead([word], language).catch((error) => {
      console.warn('[WordNewQueueCenter] Missing word notification failed', error);
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
    for (let attempt = 0; attempt < WORD_AUDIO_POLL_LIMIT; attempt += 1) {
      if (options.shouldContinue && !options.shouldContinue()) return null;
      const media = await wfNewApi.getWordAudio(language, word, {
        accent: options.accent,
        passive: attempt > 0,
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
