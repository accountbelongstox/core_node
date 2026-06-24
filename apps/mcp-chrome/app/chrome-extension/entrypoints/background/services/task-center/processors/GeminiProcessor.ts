/**
 * Gemini Web Processor
 *
 * ITaskProcessor wrapper around GeminiWorkerService, mirroring the
 * WebAiTranslateProcessor pattern. Owns the dedicated `gemini_web` lane, routed
 * by task_type (no fast-lane capability). Single chat tab => concurrency 1.
 * Registered disabled-by-default (opt-in) in init-processors.
 */
import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { geminiWorkerService } from '../../gemini-worker-service';

class GeminiProcessor implements ITaskProcessor {
  readonly processorType = 'gemini_web';
  readonly processorName = 'Gemini Web';

  readonly processorTypes: string[] = ['gemini_web'];
  readonly capabilities: WorkerCapability[] = [];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[GeminiProcessor] Starting Gemini Web Processor');
    await geminiWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Gemini Web Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
    console.log('[GeminiProcessor] Gemini Web Processor started');
  }

  stop(): void {
    console.log('[GeminiProcessor] Stopping Gemini Web Processor');
    geminiWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = geminiWorkerService.getStatus();
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
    return taskType === 'gemini_chat';
  }
}

export const geminiProcessor = new GeminiProcessor();
