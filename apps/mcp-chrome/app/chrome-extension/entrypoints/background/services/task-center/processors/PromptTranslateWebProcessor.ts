import { promptTranslateWebWorkerService } from '../../prompt-translate-web-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const promptTranslateWebProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.PROMPT_TRANSLATE_WEB,
  processorName: 'Prompt-Translate Web',
  workerName: 'MCP Chrome Prompt-Translate Web Worker',
  service: promptTranslateWebWorkerService,
  processorTypes: [LANES.REMOTE_TRANSLATION],
});
