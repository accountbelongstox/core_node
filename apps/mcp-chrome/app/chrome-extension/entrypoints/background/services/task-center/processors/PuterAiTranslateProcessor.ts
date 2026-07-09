/**
 * Puter AI Translate Processor
 *
 * ITaskProcessor wrapper around PuterTranslateWorkerService. Owns no dedicated
 * processor lane (processorTypes: []) and advertises capability ['puter_translate']
 * — the base worker subscribes only to the shared remote_fast lane.
 *
 * Stateless API calls allow concurrency 3 (no browser tab needed).
 * Registered disabled-by-default (opt-in, like NotebookLM / Gemini processors).
 */

import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { puterTranslateWorkerService } from '../../puter-translate-worker-service';

class PuterAiTranslateProcessor implements ITaskProcessor {
  readonly processorType = 'puter_translate';
  readonly processorName = 'Puter AI Translate';

  /** No dedicated lane — fast lane only via the advertised capability. */
  readonly processorTypes: string[] = [];
  readonly capabilities: WorkerCapability[] = ['puter_translate'];
  /** Stateless API — up to 3 concurrent calls. */
  readonly concurrency = 3;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[PuterProcessor] Starting Puter AI Translate Processor');
    await puterTranslateWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Puter AI Translate Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 3,
    });
    console.log('[PuterProcessor] Puter AI Translate Processor started');
  }

  stop(): void {
    console.log('[PuterProcessor] Stopping Puter AI Translate Processor');
    puterTranslateWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = puterTranslateWorkerService.getStatus();
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
    return taskType === 'word_translation';
  }
}

// Singleton instance.
export const puterAiTranslateProcessor = new PuterAiTranslateProcessor();
