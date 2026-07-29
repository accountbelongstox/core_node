/**
 * Gemini Web Worker Service
 *
 * A SimpleWorkerBase subclass that fulfils `gemini_chat` tasks (dedicated
 * `remote_gemini_text` lane — the text-only sibling of `gemini_image`'s
 * `remote_gemini`) by driving the live gemini.google.com tab via the
 * chrome_gemini tool: it sends the task's prompt, returns the reply text, and
 * (when requested) captures + uploads the reply audio. Routed by task_type
 * (capability=null). Fail-soft, single tab (concurrency 1), registered
 * DISABLED by default (opt-in) — driving an authenticated Gemini session
 * needs explicit user consent, like the ChatGPT/NotebookLM web-chat workers.
 */
import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_TYPE_KEYS, taskPromptText } from '@/utils/queue-center-contract';
import { geminiWebTool } from '../tools/browser/gemini-web';
import { logger } from '@/utils/logger';
import { parseWebChatToolResult, extractAudioParams } from './web-chat-worker-common';

const LOG = 'Gemini Web';

class GeminiWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'gemini_web';
  }

  protected get workerIdStorageKey(): string {
    return 'gemini_web_worker_id_base';
  }

  protected get capabilities(): WorkerCapability[] {
    return [];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_GEMINI_TEXT];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.gemini_chat;
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    // The primary field is declared beside gemini_chat in the shared JSON;
    // source_text/question/prompt remain compatibility fallbacks in one helper.
    const prompt = taskPromptText(task.task_type, payload);
    if (!prompt.trim()) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'no question/source_text/prompt in payload',
      });
      return;
    }

    const { withAudio, language } = extractAudioParams(payload);

    let toolResult: any;
    try {
      toolResult = await geminiWebTool.execute({ prompt, withAudio, language });
    } catch (error: any) {
      logger.warn(LOG, `Gemini tab drive failed for ${task.task_id}`, error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'gemini tab unavailable',
      });
      return;
    }

    const result = parseWebChatToolResult(toolResult, LOG);
    if (!result.success) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: result.error });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      answer: result.answer,
      audio: result.audio,
      provider: 'gemini-web',
    });
    logger.info(LOG, `Task ${task.task_id} completed`);
  }
}

export const geminiWorkerService = new GeminiWorkerService();
