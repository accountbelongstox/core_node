/**
 * Puter AI Translate Worker Service
 *
 * SimpleWorkerBase subclass that fulfils `word_translation` tasks tagged with
 * the `puter_translate` capability by calling Puter's OpenAI-compatible REST
 * API (no browser tab needed, no API key). The dispatcher routes tasks here
 * when their capability is `puter_translate`.
 *
 * Fail-soft: any failure (auth, network, parse, zero pairs) submits 'failed'
 * so the task is released and re-routed. Never fakes completed-empty.
 *
 * Stateless API => concurrency 3 (enforced at the processor layer).
 */

import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { puterAiTranslate } from './puter-ai-client';
import { logger } from '@/utils/logger';
import { DEFAULT_TARGET_LANG } from '@/utils/task-center-types';
import { TASK_CAPABILITY_BY_ROLE, TASK_TYPE_KEYS } from '@/utils/queue-center-contract';
import { normalizeWords } from '@/utils/task-words';

const LOG = 'Puter Translate';

class PuterTranslateWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'puter_translate';
  }

  protected get workerIdStorageKey(): string {
    return 'puter_translate_worker_id_base';
  }

  protected get capabilities(): WorkerCapability[] {
    return [TASK_CAPABILITY_BY_ROLE.puter_translate];
  }

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
    if (task.capability !== 'puter_translate') {
      logger.warn(LOG, `Releasing non-puter_translate task ${task.task_id}`, {
        capability: task.capability,
      });
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: `capability mismatch: expected puter_translate, got ${task.capability ?? 'none'}`,
      });
      return;
    }

    const words = normalizeWords((task.payload as any)?.words);
    if (words.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'no words in payload',
      });
      return;
    }

    const targetLanguage =
      (task.payload as any)?.target_language || (task.payload as any)?.language || DEFAULT_TARGET_LANG;

    let pairs: Array<{ word: string; translation: string }>;
    try {
      pairs = await puterAiTranslate(
        words.map((w) => w.word),
        targetLanguage,
      );
    } catch (error: any) {
      logger.warn(LOG, `Puter API call failed: ${error?.message}`);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'puter-ai call failed',
      });
      return;
    }

    if (pairs.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'puter-ai produced no parseable translations',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      translations: pairs,
      target_language: targetLanguage,
      provider: 'puter-ai',
    });
    logger.info(LOG, `Task ${task.task_id} completed (${pairs.length} translations)`);
  }

}

// Singleton instance.
export const puterTranslateWorkerService = new PuterTranslateWorkerService();
