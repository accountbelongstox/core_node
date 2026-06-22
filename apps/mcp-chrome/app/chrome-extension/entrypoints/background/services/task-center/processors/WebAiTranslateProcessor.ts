/**
 * Web-AI Translate Processor
 *
 * ITaskProcessor wrapper around WebAiTranslateWorkerService, mirroring the
 * BingDictionaryProcessor pattern. It owns NO dedicated processor lane
 * (processorTypes: []) and advertises capability ['ai_translate'] — the base
 * worker therefore subscribes only to the shared `remote_fast` lane. Single
 * chat tab => concurrency 1.
 *
 * Registered disabled-by-default (like the NotebookLM / Gemini processors):
 * the web-AI translate path is opt-in.
 */

import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { webAiTranslateWorkerService } from '../../web-ai-translate-worker-service';

class WebAiTranslateProcessor implements ITaskProcessor {
  readonly processorType = 'web_ai_translate';
  readonly processorName = 'Web-AI Translate';

  /** Own no dedicated lane — fast lane only via the advertised capability. */
  readonly processorTypes: string[] = [];
  readonly capabilities: WorkerCapability[] = ['ai_translate'];
  /** Single chat tab. */
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[WebAiTranslateProcessor] Starting Web-AI Translate Processor');
    await webAiTranslateWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Web-AI Translate Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
    console.log('[WebAiTranslateProcessor] Web-AI Translate Processor started');
  }

  stop(): void {
    console.log('[WebAiTranslateProcessor] Stopping Web-AI Translate Processor');
    webAiTranslateWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = webAiTranslateWorkerService.getStatus();
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
export const webAiTranslateProcessor = new WebAiTranslateProcessor();
