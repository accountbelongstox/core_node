/**
 * Gemini Image Processor
 *
 * ITaskProcessor wrapper around GeminiImageWorkerService, mirroring the
 * GeminiProcessor pattern. Owns the dedicated `remote_gemini` lane, routed by
 * task_type (no fast-lane capability). Single tab => concurrency 1.
 * Registered disabled-by-default (opt-in) in init-processors.
 */
import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { geminiImageWorkerService } from '../../gemini-image-worker-service';
import { LANES } from '@/utils/task-center-lanes';

class GeminiImageProcessor implements ITaskProcessor {
  readonly processorType = LANES.REMOTE_GEMINI;
  readonly processorName = 'Gemini Image';

  readonly processorTypes: string[] = [LANES.REMOTE_GEMINI];
  readonly capabilities: WorkerCapability[] = [];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[GeminiImageProcessor] Starting Gemini Image Processor');
    await geminiImageWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Gemini Image Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
    console.log('[GeminiImageProcessor] Gemini Image Processor started');
  }

  stop(): void {
    console.log('[GeminiImageProcessor] Stopping Gemini Image Processor');
    geminiImageWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = geminiImageWorkerService.getStatus();
    return {
      isRunning: status.isRunning,
      stats: {
        pending: status.stats.pending,
        translated: status.stats.translated,
        failed: status.stats.failed,
        lastRun: status.stats.lastRun,
        workerId: status.stats.workerId,
        isOnline: status.stats.isOnline,
        queueTotal: status.stats.pending,
        newTasks: 0,
        duplicateTasks: 0,
        pendingFast: status.stats.pendingFast,
        pendingUrgent: status.stats.pendingUrgent,
      },
    };
  }

  canHandle(taskType: string): boolean {
    return taskType === 'gemini_image';
  }
}

export const geminiImageProcessor = new GeminiImageProcessor();
