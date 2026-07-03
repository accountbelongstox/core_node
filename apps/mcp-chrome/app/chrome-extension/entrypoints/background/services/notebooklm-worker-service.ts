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
import { notebookLmTool } from '../tools/browser/notebooklm';
import { logger } from '@/utils/logger';

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
    return ['remote_notebooklm'];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === 'notebooklm';
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    const question =
      typeof payload.question === 'string' && payload.question.trim()
        ? payload.question
        : typeof payload.source_text === 'string'
          ? payload.source_text
          : '';
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

    if (toolResult?.isError) {
      const errText = toolResult?.content?.[0]?.text;
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: typeof errText === 'string' ? errText : 'notebooklm tool error',
      });
      return;
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(toolResult?.content?.[0]?.text || '{}');
    } catch {
      parsed = {};
    }
    if (!parsed.success || !parsed.answer) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: parsed?.error || 'notebooklm produced no answer',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      answer: parsed.answer,
      notebook_url: parsed.url || notebookUrl || null,
      provider: 'notebooklm',
    });
    logger.info(LOG, `Task ${task.task_id} completed`);
  }
}

export const notebookLmWorkerService = new NotebookLmWorkerService();
