/**
 * Prompt-Translate Web Worker Service
 *
 * Fulfils Laravel's shared `prompt_translation` global task by DRIVING the
 * Gemini or ChatGPT WEB page — never
 * an AI API. Pulls a prompt_translation task (execution_type remote_translation,
 * capability=null), translates the prompt to English via the user's preferred
 * web provider, and submits the contract result shape:
 *   { prompt_id, detected_language, english, cleaned, variants:[N], provider }
 * (`english` is required by the Laravel validateResultShape.)
 *
 * Fail-soft: any failure submits 'failed' so Laravel can retry it with any
 * eligible Pycore or mcp-chrome claimant. Single chat tab => concurrency 1.
 * Registered disabled-by-default.
 */
import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { LANES } from '@/utils/task-center-lanes';
import { chatgptWebTool } from '../tools/browser/chatgpt-web';
import { geminiWebTool } from '../tools/browser/gemini-web';
import { getPreferredProvider } from '../tools/browser/ai-web-common';
import { logger } from '@/utils/logger';
import { TASK_TYPE_KEYS, taskPromptText } from '@/utils/queue-center-contract';

const LOG = 'Prompt-Translate Web';

interface ParsedTranslation {
  detected_language: string;
  english: string;
  cleaned: string;
  variants: string[];
}

class PromptTranslateWebWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'prompt_translate_web';
  }

  protected get workerIdStorageKey(): string {
    return 'prompt_translate_web_worker_id_base';
  }

  // capability=null — routed purely by execution_type/task_type.
  protected get capabilities(): WorkerCapability[] {
    return [];
  }

  // prompt_translation tasks are dispatched as execution_type remote_translation.
  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_TRANSLATION] as unknown as ProcessorType[];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.prompt_translation;
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    const text = taskPromptText(task.task_type, payload);
    const promptId = payload.prompt_id;
    if (!text.trim()) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'no text in payload' });
      return;
    }

    const sourceLang = typeof payload.source_lang === 'string' ? payload.source_lang : 'auto';
    const wantAudio = payload.want_audio === true;
    const variantCount = typeof payload.variants === 'number' && payload.variants > 0 ? payload.variants : 3;

    const provider = await getPreferredProvider();
    const tool = provider === 'gemini' ? geminiWebTool : chatgptWebTool;
    const prompt = this.buildPrompt(text, variantCount);

    let toolResult: any;
    try {
      toolResult = await tool.execute({ prompt, withAudio: wantAudio, language: 'en' });
    } catch (error: any) {
      logger.warn(LOG, `${provider} tab drive failed for ${task.task_id}`, error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'web tab unavailable',
      });
      return;
    }

    if (toolResult?.isError) {
      const errText = toolResult?.content?.[0]?.text;
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: typeof errText === 'string' ? errText : 'web tool error',
      });
      return;
    }

    let outer: any = {};
    try {
      outer = JSON.parse(toolResult?.content?.[0]?.text || '{}');
    } catch {
      outer = {};
    }
    const answer = typeof outer.answer === 'string' ? outer.answer : '';
    const parsed = this.parseTranslation(answer, variantCount);
    if (!parsed) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'web-ai produced no parseable english translation',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      prompt_id: promptId,
      detected_language: parsed.detected_language || sourceLang,
      english: parsed.english,
      cleaned: parsed.cleaned || parsed.english,
      variants: parsed.variants,
      provider: provider === 'gemini' ? 'gemini-web' : 'chatgpt-web',
    });
    logger.info(LOG, `Task ${task.task_id} translated via ${provider}`);
  }

  /** Strict-JSON translate prompt; never translate code/identifiers/URLs. */
  private buildPrompt(text: string, variantCount: number): string {
    const slots = new Array(variantCount).fill('"<alternative English phrasing>"').join(', ');
    return [
      'You are a translation engine. Translate the user TEXT into natural English.',
      'Do NOT translate code, identifiers, file paths, URLs, or {{placeholders}} — keep them verbatim.',
      'Respond with ONLY a JSON object (no prose, no code fence) of the exact form:',
      `{"detected_language":"<language>","english":"<faithful English translation>","cleaned":"<cleaned concise English>","variants":[${slots}]}`,
      'TEXT:',
      text,
    ].join('\n');
  }

  /** Parse the first {...} object out of the answer into the contract shape. */
  private parseTranslation(answer: string, variantCount: number): ParsedTranslation | null {
    const start = answer.indexOf('{');
    const end = answer.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    let obj: any;
    try {
      obj = JSON.parse(answer.slice(start, end + 1));
    } catch {
      return null;
    }
    if (!obj || typeof obj !== 'object') return null;

    const english = typeof obj.english === 'string' ? obj.english.trim() : '';
    if (!english) return null;

    let variants: string[] = Array.isArray(obj.variants)
      ? obj.variants.filter((v: any) => typeof v === 'string' && v.trim()).map((v: string) => v.trim())
      : [];
    while (variants.length < variantCount) variants.push(english);
    variants = variants.slice(0, variantCount);

    return {
      detected_language: typeof obj.detected_language === 'string' ? obj.detected_language.trim() : '',
      english,
      cleaned: typeof obj.cleaned === 'string' ? obj.cleaned.trim() : '',
      variants,
    };
  }
}

export const promptTranslateWebWorkerService = new PromptTranslateWebWorkerService();
