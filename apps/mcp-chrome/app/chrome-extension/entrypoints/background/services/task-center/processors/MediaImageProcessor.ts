/**
 * Media Image Processor — poster + assist cover/poster via Google/Bing search.
 */

import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from '../ITaskProcessor';
import type { WorkerCapability } from '../../../api/WorkerApiClient';
import { mediaImageWorkerService } from '../../media-image-worker-service';
import { LANES } from '@/utils/task-center-lanes';

class MediaImageProcessor implements ITaskProcessor {
  readonly processorType = LANES.MEDIA_IMAGE;
  readonly processorName = 'Book, Library & Word Images (Google/Bing)';
  readonly processorTypes: string[] = [LANES.REMOTE_POSTER, LANES.REMOTE_FAST];
  readonly capabilities: WorkerCapability[] = ['poster', 'image'];
  readonly concurrency = 1;

  async start(config: ProcessorConfig): Promise<void> {
    await mediaImageWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Media Image Worker',
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? 2,
    });
  }

  stop(): void {
    mediaImageWorkerService.stop();
  }

  getStatus(): ProcessorStatus {
    const status = mediaImageWorkerService.getStatus();
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
        coversSubmitted: status.stats.coversSubmitted,
        postersSubmitted: status.stats.postersSubmitted,
        assistFailed: status.stats.assistFailed,
        lastAssistRun: status.stats.lastAssistRun,
      },
    };
  }

  canHandle(taskType: string): boolean {
    return taskType === 'poster' || taskType === 'word_media';
  }
}

export const mediaImageProcessor = new MediaImageProcessor();
