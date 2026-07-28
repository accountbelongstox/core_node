/**
 * ChatGPT Web Worker Service
 *
 * A SimpleWorkerBase subclass that fulfils `chatgpt_chat` tasks by driving the
 * live chatgpt.com tab via the chrome_chatgpt tool: it sends the task's prompt,
 * returns the reply text, and (when requested) captures + uploads the reply
 * audio. Routed by task_type (capability=null), mirroring the verified
 * prompt_translation routing — so no cross-system capability addition is needed.
 *
 * Fail-soft: any failure submits a 'failed' result so the task is released and
 * re-routed; it never fakes a completed-empty. Single chat tab => concurrency 1
 * (enforced at the processor layer). Registered DISABLED by default (opt-in),
 * like the NotebookLM / DeepSeek / Web-AI-Translate processors.
 */
import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { chatgptWebTool } from '../tools/browser/chatgpt-web';
import { logger } from '@/utils/logger';
import { parseWebChatToolResult, extractAudioParams } from './web-chat-worker-common';
import { EXECUTION_TYPES_BY_ROLE, TASK_TYPE_KEYS } from '@/utils/queue-center-contract';

const LOG = 'ChatGPT Web';

class ChatGptWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'chatgpt_web';
  }

  protected get workerIdStorageKey(): string {
    return 'chatgpt_web_worker_id_base';
  }

  // No fast-lane capability — routed purely by task_type (capability=null).
  protected get capabilities(): WorkerCapability[] {
    return [];
  }

  // Dedicated processor type so a Laravel-dispatched chatgpt_chat task can be
  // routed here. Cast like the bing worker (open string lane).
  protected get baseProcessorTypes(): ProcessorType[] {
    return [EXECUTION_TYPES_BY_ROLE.remote_chatgpt];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.chatgpt_chat;
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
    if (!prompt.trim()) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'no prompt in payload' });
      return;
    }

    const { withAudio, language } = extractAudioParams(payload);

    let toolResult: any;
    try {
      toolResult = await chatgptWebTool.execute({ prompt, withAudio, language });
    } catch (error: any) {
      logger.warn(LOG, `ChatGPT tab drive failed for ${task.task_id}`, error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'chatgpt tab unavailable',
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
      provider: 'chatgpt-web',
    });
    logger.info(LOG, `Task ${task.task_id} completed`);
  }
}

export const chatgptWorkerService = new ChatGptWorkerService();
