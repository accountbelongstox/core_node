/**
 * Web-AI Translate Worker Service
 *
 * A SimpleWorkerBase subclass that fulfils `word_translation` tasks tagged with
 * the `ai_translate` capability by driving the configured web-AI chat tab
 * rather than scraping a dictionary. It is the browser counterpart of the
 * pycore ai_translate path: the dispatcher routes a fast-tier word_translation
 * task here only when its capability is `ai_translate`.
 *
 * First-idle-wins / fail-soft: any failure — capability mismatch, missing chat
 * tab, unparseable answer, or zero translation pairs — submits a 'failed'
 * result so the task is released and re-routed back to pycore. It never fakes a
 * completed-empty.
 *
 * Single chat tab => concurrency 1 (enforced at the processor layer).
 */

import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { logger } from '@/utils/logger';
import { DEFAULT_TARGET_LANG } from '@/utils/task-center-types';
import { TASK_CAPABILITY_BY_ROLE, TASK_TYPE_KEYS } from '@/utils/queue-center-contract';
import {
  runWordValidityClassification,
  type WordValidityRuntimeResult,
} from './word-validity/word-validity-web-runtime';

const LOG = 'Web-AI Translate';

interface NormalizedWord {
  word: string;
  md5?: string;
}

class WebAiTranslateWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'web_ai_translate';
  }

  protected get workerIdStorageKey(): string {
    return 'web_ai_translate_worker_id_base';
  }

  // Advertise ONLY ai_translate; the base adds remote_fast via withFastLane.
  protected get capabilities(): WorkerCapability[] {
    return [TASK_CAPABILITY_BY_ROLE.ai_translate];
  }

  // No dedicated lane — fast lane only (added by the base when caps non-empty).
  protected get baseProcessorTypes(): ProcessorType[] {
    return [];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected get pullTaskTypes(): string[] {
    return [TASK_TYPE_KEYS.word_translation];
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.word_translation;
  }

  protected async executeTask(task: Task): Promise<void> {
    // Re-check the capability: this worker must only serve ai_translate work.
    // Anything else is released as 'failed' so it re-routes (CHROME-CAP-1).
    if (task.capability !== 'ai_translate') {
      logger.warn(LOG, `Releasing non-ai_translate task ${task.task_id}`, {
        capability: task.capability,
      });
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: `capability mismatch: expected ai_translate, got ${task.capability ?? 'none'}`,
      });
      return;
    }

    const words = this.normalizeWords((task.payload as any)?.words);
    if (words.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'no words in payload',
      });
      return;
    }

    const targetLanguage =
      (task.payload as any)?.target_language || (task.payload as any)?.language || DEFAULT_TARGET_LANG;

    let classification: WordValidityRuntimeResult;
    try {
      classification = await runWordValidityClassification(words, undefined, targetLanguage);
    } catch (error: any) {
      logger.warn(LOG, 'Web-AI tab drive failed; re-routing', error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'web-ai tab unavailable',
      });
      return;
    }

    const pairs = classification.valid
      .filter((item) => typeof item.translation === 'string' && item.translation !== '')
      .map((item) => ({ word: item.word, translation: item.translation as string }));
    const invalidWords = classification.invalid.map((item) => ({
      word: item.word,
      md5: item.md5,
    }));
    if (pairs.length === 0 && invalidWords.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'web-ai produced no parseable validity or translation results',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      translations: pairs,
      invalid_words: invalidWords,
      target_language: targetLanguage,
      provider: `${classification.provider}-web`,
    });
    logger.info(
      LOG,
      `Task ${task.task_id} completed (${pairs.length} translated, ${invalidWords.length} invalid)`,
    );
  }

  /** Payload words may be plain strings or {word, md5, ...} objects. */
  private normalizeWords(raw: unknown): NormalizedWord[] {
    if (!Array.isArray(raw)) return [];
    const out: NormalizedWord[] = [];
    for (const item of raw as any[]) {
      if (typeof item === 'string') {
        const word = item.trim();
        if (word) out.push({ word });
      } else if (item && typeof item.word === 'string') {
        const word = item.word.trim();
        if (word) out.push({ word, md5: item.md5 });
      }
    }
    return out;
  }
}

// Singleton instance.
export const webAiTranslateWorkerService = new WebAiTranslateWorkerService();
