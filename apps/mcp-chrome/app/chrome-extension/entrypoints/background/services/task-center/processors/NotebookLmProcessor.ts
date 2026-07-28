import { notebookLmWorkerService } from '../../notebooklm-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const notebookLmProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.REMOTE_NOTEBOOKLM,
  processorName: 'NotebookLM',
  workerName: 'MCP Chrome NotebookLM Worker',
  service: notebookLmWorkerService,
  processorTypes: [LANES.REMOTE_NOTEBOOKLM],
});
