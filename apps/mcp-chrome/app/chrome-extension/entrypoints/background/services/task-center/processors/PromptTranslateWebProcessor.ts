/**
 * Prompt-Translate Web Processor
 *
 * ITaskProcessor wrapper around PromptTranslateWebWorkerService — the chrome
 * fulfiller of the cross-stack `prompt_translation` pipeline by driving the
 * Gemini/ChatGPT web page (provider chosen via settings). Owns the
 * `remote_translation` lane, routed by task_type (capability=null). Single chat
 * tab => concurrency 1. Registered disabled-by-default (opt-in).
 */
import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { promptTranslateWebWorkerService } from '../../prompt-translate-web-worker-service';

class PromptTranslateWebProcessor implements ITaskProcessor {
  readonly processorType = 'prompt_translate_web';
  readonly processorName = 'Prompt-Translate Web';

  readonly processorTypes: string[] = ['remote_translation'];
  readonly capabilities: WorkerCapability[] = [];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[PromptTranslateWebProcessor] Starting Prompt-Translate Web Processor');
    await promptTranslateWebWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Prompt-Translate Web Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
    console.log('[PromptTranslateWebProcessor] Prompt-Translate Web Processor started');
  }

  stop(): void {
    console.log('[PromptTranslateWebProcessor] Stopping Prompt-Translate Web Processor');
    promptTranslateWebWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = promptTranslateWebWorkerService.getStatus();
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
    return taskType === 'prompt_translation';
  }
}

export const promptTranslateWebProcessor = new PromptTranslateWebProcessor();
