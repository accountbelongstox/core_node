/**
 * Gemini Image Worker Service
 *
 * A SimpleWorkerBase subclass that fulfils `gemini_image` tasks (dedicated
 * `remote_gemini` lane) by driving the live gemini.google.com tab via the
 * gemini-image tool. Generation is async two-phase on the tool side
 * (start -> status poll) because it can take over a minute — this worker
 * hides that behind one blocking executeTask() call (poll internally, submit
 * once at the end), matching the synchronous contract every other worker
 * follows. Single tab => concurrency 1, registered DISABLED by default
 * (opt-in) — driving an authenticated Gemini session needs explicit user
 * consent, like the ChatGPT/NotebookLM/Gemini-chat web workers.
 */
import { Task, WorkerCapability, ProcessorType } from '../api/WorkerApiClient';
import { SimpleWorkerBase } from './task-center/SimpleWorkerBase';
import { geminiImageTool } from '../tools/browser/gemini-image';
import { logger } from '@/utils/logger';

const LOG = 'Gemini Image';
const GENERATION_TIMEOUT_MS = 110000;
const POLL_INTERVAL_MS = 3000;

class GeminiImageWorkerService extends SimpleWorkerBase {
  protected get processorKey(): string {
    return 'gemini_image';
  }

  protected get workerIdStorageKey(): string {
    return 'gemini_image_worker_id_base';
  }

  // No fast-lane capability — routed purely by task_type (capability=null).
  protected get capabilities(): WorkerCapability[] {
    return [];
  }

  protected get baseProcessorTypes(): ProcessorType[] {
    return ['remote_gemini'];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === 'gemini_image';
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
    if (!prompt.trim()) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'no prompt in payload' });
      return;
    }

    const started: Awaited<ReturnType<typeof geminiImageTool.start>> = await geminiImageTool
      .start(prompt, false, GENERATION_TIMEOUT_MS)
      .catch((error: any) => ({ ok: false, error: error?.message || 'gemini image tab unavailable' }));

    if (!started?.ok || !started.jobId) {
      logger.warn(LOG, `Failed to start generation for ${task.task_id}`, started);
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: started?.error || 'failed to start gemini image generation',
      });
      return;
    }

    const deadline = Date.now() + GENERATION_TIMEOUT_MS;
    let last: Awaited<ReturnType<typeof geminiImageTool.status>> | null = null;
    while (Date.now() < deadline) {
      await this.delay(POLL_INTERVAL_MS);
      last = await geminiImageTool
        .status(started.jobId!)
        .catch((error: any) => ({ ok: false, status: 'failed' as const, error: error?.message }));
      if (last.status === 'done' || last.status === 'failed' || last.status === 'unknown') break;
    }

    if (!last || last.status !== 'done' || !last.dataUrl) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: last?.error || 'timed out waiting for the generated image',
      });
      return;
    }

    const base64 = last.dataUrl.replace(/^data:[^;]+;base64,/, '');
    await this.submitResult(task.task_id, 'completed', {
      image_base64: base64,
      mime: last.mime || 'image/png',
      provider: 'gemini',
    });
    logger.info(LOG, `Task ${task.task_id} completed`);
  }
}

export const geminiImageWorkerService = new GeminiImageWorkerService();
