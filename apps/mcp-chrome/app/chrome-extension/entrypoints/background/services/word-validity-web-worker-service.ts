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
 * Provider-pluggable (per the feature spec): Gemini (default) / DeepSeek / ChatGPT
 * are driven via the existing page-driver tools (WebOps + tab activation come for
 * free through them). Z.AI is a recognized option but has no page-driver tool yet,
 * so it is guarded and falls back to Gemini — the extension point is `sendPrompt`.
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
import { chatgptWebTool } from '../tools/browser/chatgpt-web';
import { geminiWebTool } from '../tools/browser/gemini-web';
import { deepseekSendPromptTool } from '../tools/browser/deepseek';
import { getValidityProvider, AiWebProvider } from '../tools/browser/ai-web-common';
import { logger } from '@/utils/logger';

const LOG = 'Word-Validity Web';

interface NormalizedWord {
  word: string;
  md5?: string;
}

interface Verdict {
  word: string;
  md5?: string;
}

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
    return ['remote_validity'];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === 'word_validity';
  }

  protected async executeTask(task: Task): Promise<void> {
    const words = this.normalizeWords((task.payload as any)?.words);
    if (words.length === 0) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'no words in payload' });
      return;
    }

    const provider = await getValidityProvider();
    const prompt = this.buildPrompt(words.map((w) => w.word));

    let answer: string;
    try {
      answer = await this.sendPrompt(provider, prompt);
    } catch (error: any) {
      logger.warn(LOG, `${provider} tab drive failed for ${task.task_id}`, error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'web tab unavailable',
      });
      return;
    }

    const { valid_words, invalid_words } = this.parseClassification(answer, words);
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

  /**
   * Drive the chosen provider's chat tab and return the assistant text.
   * chatgpt/gemini reply at outer.answer; deepseek at outer.result.content. Z.AI
   * has no tool yet -> log and fall back to Gemini so a stored 'zai' never throws.
   */
  private async sendPrompt(provider: AiWebProvider, prompt: string): Promise<string> {
    if (provider === 'deepseek') {
      const toolResult = await deepseekSendPromptTool.execute({ prompt, waitForCompletion: true });
      return this.extractDeepSeekText(toolResult);
    }
    let effective = provider;
    if (effective === 'zai') {
      logger.warn(LOG, 'Z.AI has no page-driver tool yet; falling back to Gemini');
      effective = 'gemini';
    }
    const tool = effective === 'gemini' ? geminiWebTool : chatgptWebTool;
    const toolResult = await tool.execute({ prompt, language: 'en' });
    return this.extractAnswer(toolResult);
  }

  /** chatgpt-web / gemini-web return content[0].text = JSON{...,answer}. */
  private extractAnswer(toolResult: any): string {
    if (toolResult?.isError) {
      const errText = toolResult?.content?.[0]?.text;
      throw new Error(typeof errText === 'string' ? errText : 'web tool error');
    }
    let outer: any = {};
    try {
      outer = JSON.parse(toolResult?.content?.[0]?.text || '{}');
    } catch {
      outer = {};
    }
    const answer = typeof outer.answer === 'string' ? outer.answer : '';
    if (!answer) {
      throw new Error('web tool returned no answer');
    }
    return answer;
  }

  /** deepseek tool returns content[0].text = JSON{result:{content}}. */
  private extractDeepSeekText(toolResult: any): string {
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
      return text;
    }
    const content = outer?.result?.content;
    if (typeof content === 'string' && content) return content;
    if (typeof outer?.result === 'string') return outer.result;
    throw new Error('web-ai tool result carried no assistant content');
  }

  /** Build a strict-JSON classification prompt the model can answer mechanically. */
  private buildPrompt(words: string[]): string {
    const list = words.map((w) => `- ${w}`).join('\n');
    return [
      'You are a strict English dictionary validator.',
      'For each item below, decide whether it is a REAL word or phrase that exists in a standard dictionary (or a valid proper noun / common term), versus INVALID (nonsense, random characters, a clear typo, or a non-word).',
      'Only put a word in "invalid" when you are confident it is not a real word — when unsure, treat it as valid.',
      'Classify EVERY item. Use the EXACT original text for each word.',
      'Respond with ONLY a JSON object, no prose, no code fence, of the exact form:',
      '{"valid":["<word>"],"invalid":["<word>"]}',
      'Words:',
      list,
    ].join('\n');
  }

  /**
   * Parse a {valid:[...],invalid:[...]} object out of the answer, tolerating a
   * surrounding code fence / prose. Only words actually requested are kept
   * (case-insensitive whitelist) so a chatty model cannot inject spurious
   * entries; each kept verdict carries the REQUESTED word + its md5 so the
   * backend keys on the stored md5. A word omitted from both lists is left
   * unmarked (row stays validity_checked_at IS NULL -> re-pulled next cycle):
   * a parse miss is NEVER force-marked invalid.
   */
  private parseClassification(
    answer: string,
    requested: NormalizedWord[],
  ): { valid_words: Verdict[]; invalid_words: Verdict[] } {
    const empty = { valid_words: [] as Verdict[], invalid_words: [] as Verdict[] };
    const start = answer.indexOf('{');
    const end = answer.lastIndexOf('}');
    if (start === -1 || end <= start) return empty;
    let obj: any;
    try {
      obj = JSON.parse(answer.slice(start, end + 1));
    } catch {
      return empty;
    }
    if (!obj || typeof obj !== 'object') return empty;

    const byKey = new Map<string, NormalizedWord>();
    for (const w of requested) {
      byKey.set(w.word.toLowerCase(), w);
    }
    const seen = new Set<string>();
    const pick = (arr: any): Verdict[] => {
      if (!Array.isArray(arr)) return [];
      const out: Verdict[] = [];
      for (const it of arr) {
        const raw =
          typeof it === 'string'
            ? it
            : it && typeof it === 'object' && typeof it.word === 'string'
              ? it.word
              : '';
        const key = raw.trim().toLowerCase();
        if (!key) continue;
        const match = byKey.get(key);
        // Whitelist: only words we asked about; de-dupe across BOTH lists.
        if (!match || seen.has(key)) continue;
        seen.add(key);
        out.push({ word: match.word, md5: match.md5 });
      }
      return out;
    };
    return { valid_words: pick(obj.valid), invalid_words: pick(obj.invalid) };
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
