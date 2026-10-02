import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';
import { laravelApi } from '../../../core/integrations/laravel';
import { diffQueueContext } from '../../../core/tasks/DiffQueueContext';
import { WordNewQueueCommandGateway } from './queue/WordNewQueueCommandGateway';
import { wfNewApi } from '../api';
import type { WfNewQueueCommandResult, WfNewWordAccent, WfNewWordMedia } from '../api';
import { logWarn } from '../../../core/logstore/logStore';
import { AUDIO_ORCH_TRANSFER } from '../../../core/contracts/AudioOrchestrationContract';
import { wordNewClipReady } from './WordNewClipReady';
import { orchContentId } from '../../../shared/orchestration/orchClipIdentity';
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
/** Sentences Laravel confirmed holding: asked again by content id alone (bounded; the oldest are forgotten). */
const KNOWN_SENTENCE_LIMIT = 20000;
const WORD_AUDIO_BATCH_LIMIT = QUEUE_CENTER_DIFF_DELIVERY.producer_batch_limits.word_audio;

interface WordAudioWait {
  word: string;
  language: string;
  options: WordNewWordAudioWaitOptions;
  attempts: number;
  startedAt: number;
  /** Resource id the `clip.ready` push announces. */
  readyId: string;
  /** Not yet moved to the queue head. */
  fresh: boolean;
  promise: Promise<WfNewWordMedia | null>;
  resolve: (media: WfNewWordMedia | null) => void;
}

class WordNewQueueCenterClass extends WordNewQueueCommandGateway {
  private readonly wordAudioWaits = new Map<string, WordAudioWait>();
  private wordAudioTimer: ReturnType<typeof setTimeout> | null = null;
  private wordAudioReadyOff: (() => void) | null = null;
  private readonly knownSentenceIds = new Set<string>();

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
          const response = await this.sendSentenceHeads(requestItems);
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
   * One head request: a sentence Laravel already confirmed is sent by content id alone, any other with
   * its text; ids Laravel does not know (`unknown_id`) are asked again with their text. The answer is
   * returned with every item carrying its text, as the receipts are keyed by it.
   */
  private async sendSentenceHeads(items: Array<{ text: string; language: string }>): Promise<WfNewQueueCommandResult> {
    const idOf = (item: { text: string; language: string }): string => `${item.language}:${orchContentId(item.text)}`;
    const textById = new Map(items.map((item) => [idOf(item), item]));
    const response = await wfNewApi.moveSentenceAudioToHead(items.map((item) => (
      this.knownSentenceIds.has(idOf(item))
        ? { language: item.language, content_id: orchContentId(item.text) }
        : { text: item.text, language: item.language }
    )));
    const answered = response.items ?? [];
    const unknown = answered.filter((item) => item.status === 'unknown_id');
    let merged = answered.filter((item) => item.status !== 'unknown_id');
    let success = response.success;
    if (unknown.length > 0) {
      const retry = unknown
        .map((item) => textById.get(`${item.language}:${item.content_id}`))
        .filter((item): item is { text: string; language: string } => Boolean(item));
      retry.forEach((item) => this.knownSentenceIds.delete(idOf(item)));
      const second = await wfNewApi.moveSentenceAudioToHead(retry);
      merged = [...merged, ...(second.items ?? [])];
      success = success && second.success;
    }
    const withText = merged.map((item) => ({ ...item, text: item.text ?? textById.get(`${item.language}:${item.content_id}`)?.text }));
    withText.forEach((item) => {
      if (item.success === false || item.status === 'failed' || !item.content_id) return;
      this.knownSentenceIds.add(`${item.language}:${item.content_id}`);
      if (this.knownSentenceIds.size > KNOWN_SENTENCE_LIMIT) {
        const oldest = this.knownSentenceIds.values().next().value;
        if (oldest !== undefined) this.knownSentenceIds.delete(oldest);
      }
    });
    return { ...response, success, items: withText };
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
      word: normalizedWord, language: normalizedLanguage, options, attempts: 0, startedAt: Date.now(),
      readyId: wordNewClipReady.idOf('word', normalizedLanguage, normalizedWord), fresh: true, promise, resolve,
    });
    this.wordAudioReadyOff ??= wordNewClipReady.subscribe((ids) => this.wakeWordAudio(ids));
    this.scheduleWordAudioTick(0);
    return promise;
  }

  private scheduleWordAudioTick(delayMs: number): void {
    this.wordAudioTimer ??= setTimeout(() => {
      this.wordAudioTimer = null;
      void this.wordAudioTick();
    }, delayMs);
  }

  /** A `clip.ready` push (or a reconnect: ids null) re-checks the waiting words at once. */
  private wakeWordAudio(ids: ReadonlySet<string> | null): void {
    if (ids && ![...this.wordAudioWaits.values()].some((wait) => ids.has(wait.readyId))) return;
    if (this.wordAudioTimer) clearTimeout(this.wordAudioTimer);
    this.wordAudioTimer = null;
    this.scheduleWordAudioTick(0);
  }

  private settleWordAudio(key: string, media: WfNewWordMedia | null): void {
    const wait = this.wordAudioWaits.get(key);
    if (!wait) return;
    this.wordAudioWaits.delete(key);
    wait.resolve(media);
    if (this.wordAudioWaits.size === 0) {
      this.wordAudioReadyOff?.();
      this.wordAudioReadyOff = null;
    }
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
        const live = wordNewClipReady.isPushLive();
        if (!live) wait.attempts += 1;
        if (found[index]?.ready) {
          const media = await wfNewApi.getWordAudio(wait.language, wait.word, { accent: wait.options.accent, passive: true }).catch(() => null);
          const readyVariant = media?.audioVariants?.find((variant) => variant.status === 'ready' && variant.url);
          if (media && (media.audioUrl || readyVariant)) {
            wordNewQueueRuntime.markReady(wordAudioQueueKey(wait.word, wait.language), 'audio');
            this.settleWordAudio(key, media);
            return;
          }
        }
        const expired = live
          ? Date.now() - wait.startedAt > AUDIO_ORCH_TRANSFER.generationWatchMs
          : wait.attempts >= WORD_AUDIO_POLL_LIMIT;
        if (expired) this.settleWordAudio(key, null);
      }));
    }
    if (this.wordAudioWaits.size > 0) this.scheduleWordAudioTick(wordNewClipReady.pollDelayMs(WORD_AUDIO_POLL_INTERVAL_MS));
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
