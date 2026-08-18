import { geminiWorkerService } from '../../gemini-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const geminiProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.REMOTE_GEMINI_TEXT,
  processorName: 'Gemini Web',
  workerName: 'MCP Chrome Gemini Web Worker',
  service: geminiWorkerService,
  processorTypes: [LANES.REMOTE_GEMINI_TEXT],
});
