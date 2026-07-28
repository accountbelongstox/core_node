import { chatgptWorkerService } from '../../chatgpt-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { EXECUTION_TYPES_BY_ROLE } from '@/utils/queue-center-contract';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const chatGptProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.CHATGPT_WEB,
  processorName: 'ChatGPT Web',
  workerName: 'MCP Chrome ChatGPT Web Worker',
  service: chatgptWorkerService,
  processorTypes: [EXECUTION_TYPES_BY_ROLE.remote_chatgpt],
});
