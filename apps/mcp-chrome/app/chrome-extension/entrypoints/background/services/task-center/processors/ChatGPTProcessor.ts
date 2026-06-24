/**
 * ChatGPT Web Processor
 *
 * ITaskProcessor wrapper around ChatGptWorkerService, mirroring the
 * WebAiTranslateProcessor pattern. Owns the dedicated `chatgpt_web` lane and no
 * fast-lane capability (routed by task_type). Single chat tab => concurrency 1.
 * Registered disabled-by-default (opt-in) in init-processors.
 */
import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { chatgptWorkerService } from '../../chatgpt-worker-service';

class ChatGPTProcessor implements ITaskProcessor {
  readonly processorType = 'chatgpt_web';
  readonly processorName = 'ChatGPT Web';

  readonly processorTypes: string[] = ['chatgpt_web'];
  readonly capabilities: WorkerCapability[] = [];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[ChatGPTProcessor] Starting ChatGPT Web Processor');
    await chatgptWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome ChatGPT Web Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
    console.log('[ChatGPTProcessor] ChatGPT Web Processor started');
  }

  stop(): void {
    console.log('[ChatGPTProcessor] Stopping ChatGPT Web Processor');
    chatgptWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = chatgptWorkerService.getStatus();
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
    return taskType === 'chatgpt_chat';
  }
}

export const chatGptProcessor = new ChatGPTProcessor();
