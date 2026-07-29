/**
 * NotebookLM Worker Service
 *
 * A SimpleWorkerBase subclass that fulfils `notebooklm` tasks (dedicated
 * `remote_notebooklm` lane) by driving the live notebooklm.google.com tab via
 * the chrome_notebooklm tool: it asks the task's question and returns the
 * source-grounded answer. Routed by task_type (capability=null). Fail-soft,
 * single tab (concurrency 1), registered DISABLED by default (opt-in) —
 * driving an authenticated NotebookLM session needs explicit user consent,
 * like the ChatGPT/Gemini web-chat workers.
 */
import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_TYPE_KEYS, taskPromptText } from '@/utils/queue-center-contract';
import { notebookLmTool } from '../tools/browser/notebooklm';
import { logger } from '@/utils/logger';
import { parseWebChatToolResult } from './web-chat-worker-common';

const LOG = 'NotebookLM';

class NotebookLmWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'notebooklm';
  }

  protected get workerIdStorageKey(): string {
    return 'notebooklm_worker_id_base';
  }

  // No fast-lane capability — routed purely by task_type (capability=null).
  protected get capabilities(): WorkerCapability[] {
    return [];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return [LANES.REMOTE_NOTEBOOKLM];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.notebooklm;
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    const question = taskPromptText(task.task_type, payload);
    if (!question.trim()) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'no question/source_text in payload',
      });
      return;
    }

    const notebookUrl = typeof payload.notebook_url === 'string' ? payload.notebook_url : undefined;

    let toolResult: any;
    try {
      toolResult = await notebookLmTool.execute({ question, notebookUrl });
    } catch (error: any) {
      logger.warn(LOG, `NotebookLM tab drive failed for ${task.task_id}`, error);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: error?.message || 'notebooklm tab unavailable',
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
      notebook_url: result.raw?.url || notebookUrl || null,
      provider: 'notebooklm',
    });
    logger.info(LOG, `Task ${task.task_id} completed`);
  }
}

export const notebookLmWorkerService = new NotebookLmWorkerService();
