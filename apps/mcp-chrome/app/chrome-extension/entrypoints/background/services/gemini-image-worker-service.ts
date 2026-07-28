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
import { LANES } from '@/utils/task-center-lanes';
import { TASK_TYPE_KEYS } from '@/utils/queue-center-contract';
import { generateViaGemini } from './gemini-image-generate';
import { logger } from '@/utils/logger';

const LOG = 'Gemini Image';

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
    return [LANES.REMOTE_GEMINI];
  }

  protected get workerLabel(): string {
    return LOG;
  }

  protected handlesTaskType(taskType: string): boolean {
    return taskType === TASK_TYPE_KEYS.gemini_image;
  }

  protected async executeTask(task: Task): Promise<void> {
    const payload = (task.payload as any) || {};
    const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
    if (!prompt.trim()) {
      await this.submitResult(task.task_id, 'failed', undefined, { error: 'no prompt in payload' });
      return;
    }

    // Start -> poll lives in the shared helper (also used by the media-image
    // cover lane); null collapses start-refused / generation-failed / timeout.
    const image = await generateViaGemini(prompt);
    if (!image) {
      await this.submitResult(task.task_id, 'failed', undefined, {
        error: 'gemini image generation failed or timed out',
      });
      return;
    }

    await this.submitResult(task.task_id, 'completed', {
      image_base64: image.imageBase64,
      mime: image.mime,
      provider: 'gemini',
    });
    logger.info(LOG, `Task ${task.task_id} completed`);
  }
}

export const geminiImageWorkerService = new GeminiImageWorkerService();
