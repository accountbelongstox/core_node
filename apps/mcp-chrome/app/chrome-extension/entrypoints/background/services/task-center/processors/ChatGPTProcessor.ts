import { chatgptWorkerService } from '../../chatgpt-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const chatGptProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.CHATGPT_WEB,
  processorName: 'ChatGPT Web',
  workerName: 'MCP Chrome ChatGPT Web Worker',
  service: chatgptWorkerService,
  processorTypes: [LANES.REMOTE_CHATGPT],
});
