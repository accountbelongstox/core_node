import { geminiImageWorkerService } from '../../gemini-image-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_CAPABILITY_BY_ROLE } from '@/utils/queue-center-contract';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const geminiImageProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.REMOTE_GEMINI,
  processorName: 'Gemini Image',
  workerName: 'MCP Chrome Gemini Image Worker',
  service: geminiImageWorkerService,
  processorTypes: [LANES.REMOTE_GEMINI, LANES.REMOTE_FAST],
  capabilities: [TASK_CAPABILITY_BY_ROLE.image],
});
