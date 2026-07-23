import type { WorkerCapability } from '../../../api/WorkerApiClient';
import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import { qwenTtsWorkerService } from '../../qwen-tts-worker-service';
import { LANES } from '@/utils/task-center-lanes';

class QwenTtsProcessor implements ITaskProcessor {
  readonly processorType = LANES.QWEN_TTS;
  readonly processorName = 'Qwen3 TTS';
  readonly processorTypes: string[] = [LANES.REMOTE_AUDIO];
  readonly capabilities: WorkerCapability[] = ['audio'];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    console.log('[QwenTtsProcessor] Starting Qwen3 TTS Processor');
    await qwenTtsWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Qwen3 TTS Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 1,
    });
  }

  stop(): void {
    console.log('[QwenTtsProcessor] Stopping Qwen3 TTS Processor');
    qwenTtsWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = qwenTtsWorkerService.getStatus();
    return {
      isRunning: status.isRunning,
      stats: {
        ...status.stats,
        queueTotal: status.stats.pending,
        newTasks: 0,
        duplicateTasks: 0,
      },
    };
  }

  canHandle(taskType: string): boolean {
    return taskType === 'word_audio' || taskType === 'article_audio';
  }
}

export const qwenTtsProcessor = new QwenTtsProcessor();
