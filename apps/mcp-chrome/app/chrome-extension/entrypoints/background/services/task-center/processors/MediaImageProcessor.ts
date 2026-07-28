import { mediaImageWorkerService } from '../../media-image-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_CAPABILITY_BY_ROLE } from '@/utils/queue-center-contract';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const mediaImageProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.MEDIA_IMAGE,
  processorName: 'Book, Library & Word Images (Google/Bing)',
  workerName: 'MCP Chrome Media Image Worker',
  service: mediaImageWorkerService,
  processorTypes: [LANES.REMOTE_POSTER, LANES.REMOTE_FAST],
  capabilities: [TASK_CAPABILITY_BY_ROLE.poster, TASK_CAPABILITY_BY_ROLE.image],
  batchSize: 2,
});
