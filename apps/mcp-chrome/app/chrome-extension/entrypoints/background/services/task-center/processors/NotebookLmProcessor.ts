/**
 * NotebookLM Processor
 *
 * ITaskProcessor wrapper around NotebookLmWorkerService, mirroring the
 * GeminiProcessor pattern. Owns the dedicated `remote_notebooklm` lane, routed
 * by task_type (no fast-lane capability). Single chat tab => concurrency 1.
 * Registered disabled-by-default (opt-in) in init-processors.
 */
import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { notebookLmWorkerService } from '../../notebooklm-worker-service';
import { LANES } from '@/utils/task-center-lanes';

class NotebookLmProcessor implements ITaskProcessor {
  readonly processorType = LANES.REMOTE_NOTEBOOKLM;
  readonly processorName = 'NotebookLM';

  readonly processorTypes: string[] = [LANES.REMOTE_NOTEBOOKLM];
  readonly capabilities: WorkerCapability[] = [];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[NotebookLmProcessor] Starting NotebookLM Processor');
    await notebookLmWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome NotebookLM Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
    console.log('[NotebookLmProcessor] NotebookLM Processor started');
  }

  stop(): void {
    console.log('[NotebookLmProcessor] Stopping NotebookLM Processor');
    notebookLmWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = notebookLmWorkerService.getStatus();
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
    return taskType === 'notebooklm';
  }
}

export const notebookLmProcessor = new NotebookLmProcessor();
