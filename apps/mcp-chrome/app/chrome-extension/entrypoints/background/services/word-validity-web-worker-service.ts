/**
 * Word-Validity Web Worker Service
 *
 * A SimpleWorkerBase subclass that fulfils the batch invalid-word DETECTION lane
 * (`word_validity` tasks on the dedicated `remote_validity` execution lane). It
 * pulls a batch of untranslated + not-yet-checked words (200 per task), drives a
 * web LLM to classify each as a real dictionary word vs nonsense, and posts:
 *   { valid_words: [{word, md5}], invalid_words: [{word, md5}], provider }
 * The Laravel WordValidityTaskProcessor then marks is_valid in bulk so the
 * translation enqueue permanently skips the junk.
 *
 * Provider selection, prompt execution, parsing, and serialization are delegated
 * to the shared runtime also used by the Extension single-feature test panel.
 *
 * The md5 is CARRIED from the payload through to the result so the backend keys
 * markValidity on the STORED md5, never md5($returnedWord): an LLM that re-cases
 * a word would otherwise hash-miss and trip the empty_store gate.
 *
 * Fail-soft: any failure (no tab, unparseable answer, zero verdicts) submits a
 * 'failed' result so the task is released and re-routed; never a fake completed.
 * Single chat tab => concurrency 1 (enforced at the processor layer).
 */

import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_TYPE_KEYS } from '@/utils/queue-center-contract';
import type { ClassifierWord } from './word-validity/word-validity-classifier';
import { runWordValidityClassification } from './word-validity/word-validity-web-runtime';
import { logger } from '@/utils/logger';

const LOG = 'Word-Validity Web';

type NormalizedWord = ClassifierWord;

class WordValidityWebWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'word_validity_web';
  }

  protected get workerIdStorageKey(): string {
    return 'word_validity_web_worker_id_base';
  }

  // capability=null — routed purely by execution_type/task_type.
  protected get capabilities(): WorkerCapability[] {
    return [];
  }

  // word_validity tasks ride the dedicated remote_validity lane.
  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_VALIDITY];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected get pullTaskTypes(): string[] {
    return [TASK_TYPE_KEYS.word_validity];
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.word_validity;
  }

  protected async executeTask(task: Task): Promise<void> {
    const words = this.normalizeWords((task.payload as any)?.words);
    if (words.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'no words in payload' });
      return;
    }

    let classification;
    try {
      // Validity + translation in ONE DeepSeek pass (2.4): the batch returns a
      // verdict and, for every valid word, its target-language translation.
      const targetLanguage = typeof (task.payload as any)?.target_language === 'string'
        && (task.payload as any).target_language.trim()
        ? (task.payload as any).target_language.trim()
        : 'zh';
      classification = await runWordValidityClassification(words, undefined, targetLanguage);
    } catch (error: any) {
      logger.warn(LOG, `Web provider failed for ${task.task_id}`, error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'web tab unavailable',
      });
      return;
    }

    const { provider, valid: valid_words, invalid: invalid_words } = classification;
    if (valid_words.length === 0 && invalid_words.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'web-ai produced no parseable verdicts',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      valid_words,
      invalid_words,
      provider,
    });
    logger.info(
      LOG,
      `Task ${task.task_id} classified via ${provider} (${valid_words.length} valid, ${invalid_words.length} invalid)`,
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
export const wordValidityWebWorkerService = new WordValidityWebWorkerService();
