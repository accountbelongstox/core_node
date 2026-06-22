/**
 * Web-AI Translate Worker Service
 *
 * A SimpleWorkerBase subclass that fulfils `word_translation` tasks tagged with
 * the `ai_translate` capability by driving a real web-AI chat tab (DeepSeek)
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
import { deepseekSendPromptTool } from '../tools/browser/deepseek';
import { logger } from '@/utils/logger';

const LOG = 'Web-AI Translate';

interface NormalizedWord {
  word: string;
  md5?: string;
}

interface TranslationPair {
  word: string;
  translation: string;
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
    return ['ai_translate'];
  }

  // No dedicated lane — fast lane only (added by the base when caps non-empty).
  protected get baseProcessorTypes(): ProcessorType[] {
    return [];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === 'word_translation';
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
      (task.payload as any)?.target_language || (task.payload as any)?.language || 'zh';

    const prompt = this.buildPrompt(
      words.map((w) => w.word),
      targetLanguage,
    );

    // Drive the reused DeepSeek chat tool, waiting for the answer. Any
    // failure (no tab, timeout, cancellation) throws and is caught below.
    let assistantText: string;
    try {
      const toolResult = await deepseekSendPromptTool.execute({
        prompt,
        waitForCompletion: true,
      });
      assistantText = this.extractAssistantText(toolResult);
    } catch (error: any) {
      logger.warn(LOG, 'Web-AI tab drive failed; re-routing', error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'web-ai tab unavailable',
      });
      return;
    }

    const pairs = this.parsePairs(assistantText, words);
    if (pairs.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'web-ai produced no parseable translations',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      translations: pairs,
      target_language: targetLanguage,
      provider: 'web-ai',
    });
    logger.info(LOG, `Task ${task.task_id} completed (${pairs.length} translations)`);
  }

  /** Build a strict-JSON translation prompt the model can answer mechanically. */
  private buildPrompt(words: string[], targetLanguage: string): string {
    const list = words.map((w) => `- ${w}`).join('\n');
    return [
      `Translate each of the following words/phrases into ${targetLanguage}.`,
      'Respond with ONLY a JSON array, no prose, no code fence, of the form:',
      '[{"word":"<original>","translation":"<translated>"}]',
      'Use the exact original text for each "word". Words:',
      list,
    ].join('\n');
  }

  /**
   * The DeepSeek tool returns a ToolResult whose content[0].text is a JSON
   * string {taskId,status,conversationUrl,result}; the assistant text lives at
   * result.content. Reach it defensively.
   */
  private extractAssistantText(toolResult: any): string {
    if (toolResult?.isError) {
      const errText = toolResult?.content?.[0]?.text;
      throw new Error(typeof errText === 'string' ? errText : 'web-ai tool error');
    }
    const text = toolResult?.content?.[0]?.text;
    if (typeof text !== 'string' || !text) {
      throw new Error('web-ai tool returned no content');
    }
    let outer: any;
    try {
      outer = JSON.parse(text);
    } catch {
      // Some tool variants may put the answer directly in text.
      return text;
    }
    const content = outer?.result?.content;
    if (typeof content === 'string' && content) return content;
    // Fall back to the raw outer text if the result bundle had no content.
    if (typeof outer?.result === 'string') return outer.result;
    throw new Error('web-ai tool result carried no assistant content');
  }

  /**
   * Parse a [{word,translation}] array out of the assistant answer, tolerating
   * a surrounding code fence or leading prose. Keeps only pairs whose word
   * matches a requested word (case-insensitive) so a chatty model can't inject
   * spurious entries.
   */
  private parsePairs(answer: string, requested: NormalizedWord[]): TranslationPair[] {
    const json = this.sliceJsonArray(answer);
    if (!json) return [];
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    const wanted = new Set(requested.map((w) => w.word.toLowerCase()));
    const out: TranslationPair[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const word = typeof item.word === 'string' ? item.word.trim() : '';
      const translation =
        typeof item.translation === 'string' ? item.translation.trim() : '';
      if (!word || !translation) continue;
      const key = word.toLowerCase();
      if (!wanted.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ word, translation });
    }
    return out;
  }

  /** Extract the first [...] JSON array substring from a (possibly fenced) answer. */
  private sliceJsonArray(text: string): string | null {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;
    return text.slice(start, end + 1);
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
