import { mediaImageWorkerService } from '../../media-image-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_CAPABILITY_BY_ROLE } from '@/utils/queue-center-contract';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const mediaImageProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.MEDIA_IMAGE,
  processorName: 'Book, Poster & Library Cover Search (Google/Bing)',
  workerName: 'MCP Chrome Media Image Worker',
  service: mediaImageWorkerService,
  processorTypes: [LANES.REMOTE_POSTER],
  capabilities: [TASK_CAPABILITY_BY_ROLE.poster],
  batchSize: 2,
});
