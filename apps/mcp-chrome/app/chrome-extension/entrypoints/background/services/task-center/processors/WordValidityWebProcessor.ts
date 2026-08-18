import { wordValidityWebWorkerService } from '../../word-validity-web-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const wordValidityWebProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.WORD_VALIDITY_WEB,
  processorName: 'Word-Validity Web',
  workerName: 'MCP Chrome Word-Validity Web Worker',
  service: wordValidityWebWorkerService,
  processorTypes: [LANES.REMOTE_VALIDITY],
});
