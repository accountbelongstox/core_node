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
import { geminiWebTool } from '../tools/browser/gemini-web';
import { logger } from '@/utils/logger';

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
    return ['remote_gemini_text'];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === 'gemini_chat';
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    // Laravel sends {question, title} (AppQyV1AiPromptFanoutTask.php's fan-out
    // payload / AppQyV1TaskEnqueueController's manual-enqueue validation both
    // key on question|source_text) -- NOT `prompt`. Also accept `prompt` for
    // any older/manual caller that used this worker's original field name.
    const prompt =
      typeof payload.question === 'string' && payload.question.trim()
        ? payload.question
        : typeof payload.source_text === 'string' && payload.source_text.trim()
          ? payload.source_text
          : typeof payload.prompt === 'string'
            ? payload.prompt
            : '';
    if (!prompt.trim()) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'no question/source_text/prompt in payload',
      });
      return;
    }

    const withAudio = payload.with_audio === true || payload.withAudio === true;
    const language = typeof payload.language === 'string' ? payload.language : 'en';

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

    if (toolResult?.isError) {
      const errText = toolResult?.content?.[0]?.text;
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: typeof errText === 'string' ? errText : 'gemini tool error',
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
        error: parsed?.error || 'gemini produced no answer',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      answer: parsed.answer,
      audio: parsed.audio || null,
      provider: 'gemini-web',
    });
    logger.info(LOG, `Task ${task.task_id} completed`);
  }
}

export const geminiWorkerService = new GeminiWorkerService();
