/**
 * Word-Validity Web Processor
 *
 * ITaskProcessor wrapper around WordValidityWebWorkerService — the chrome
 * fulfiller of the batch invalid-word DETECTION lane. Drives a web LLM
 * (Gemini/DeepSeek/ChatGPT; settings-chosen, Gemini default) to classify a batch
 * of untranslated+unchecked words valid/invalid. Owns the dedicated
 * `remote_validity` lane, routed by task_type (capability=null). Single chat tab
 * => concurrency 1. Registered disabled-by-default (opt-in).
 */
import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { wordValidityWebWorkerService } from '../../word-validity-web-worker-service';
import { LANES } from '@/utils/task-center-lanes';

class WordValidityWebProcessor implements ITaskProcessor {
  readonly processorType = LANES.WORD_VALIDITY_WEB;
  readonly processorName = 'Word-Validity Web';

  readonly processorTypes: string[] = [LANES.REMOTE_VALIDITY];
  readonly capabilities: WorkerCapability[] = [];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[WordValidityWebProcessor] Starting Word-Validity Web Processor');
    await wordValidityWebWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Word-Validity Web Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
    console.log('[WordValidityWebProcessor] Word-Validity Web Processor started');
  }

  stop(): void {
    console.log('[WordValidityWebProcessor] Stopping Word-Validity Web Processor');
    wordValidityWebWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = wordValidityWebWorkerService.getStatus();
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
    return taskType === 'word_validity';
  }
}

export const wordValidityWebProcessor = new WordValidityWebProcessor();
