import { puterTranslateWorkerService } from '../../puter-translate-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_CAPABILITY_BY_ROLE } from '@/utils/queue-center-contract';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const puterAiTranslateProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.PUTER_TRANSLATE,
  processorName: 'Puter AI Translate',
  workerName: 'MCP Chrome Puter AI Translate Worker',
  service: puterTranslateWorkerService,
  capabilities: [TASK_CAPABILITY_BY_ROLE.puter_translate],
  concurrency: 3,
  batchSize: 3,
});
