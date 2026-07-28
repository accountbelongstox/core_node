import { geminiImageWorkerService } from '../../gemini-image-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const geminiImageProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.REMOTE_GEMINI,
  processorName: 'Gemini Image',
  workerName: 'MCP Chrome Gemini Image Worker',
  service: geminiImageWorkerService,
  processorTypes: [LANES.REMOTE_GEMINI],
});
