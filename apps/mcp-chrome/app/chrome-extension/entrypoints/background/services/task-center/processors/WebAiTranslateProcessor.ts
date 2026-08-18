import { webAiTranslateWorkerService } from '../../web-ai-translate-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_CAPABILITY_BY_ROLE } from '@/utils/queue-center-contract';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const webAiTranslateProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.WEB_AI_TRANSLATE,
  processorName: 'Web-AI Translate',
  workerName: 'MCP Chrome Web-AI Translate Worker',
  service: webAiTranslateWorkerService,
  capabilities: [TASK_CAPABILITY_BY_ROLE.ai_translate],
});
