import { bingDictionaryWorkerService } from '../../bing-dictionary-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';
import { TASK_LIMITS } from '@/utils/queue-center-contract';

export const bingDictionaryProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.BING_DICTIONARY,
  processorName: 'Bing Dictionary Translation',
  workerName: 'MCP Chrome Bing Translation Worker',
  service: bingDictionaryWorkerService,
  start: async (config) => {
    await bingDictionaryWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Bing Translation Worker',
      pollInterval: config.pollInterval || 5,
      heartbeatInterval: config.heartbeatInterval || 60,
      batchSize: config.batchSize || TASK_LIMITS.worker_pull_default,
      tabCount: config.tabCount || 3,
      targetLanguage: config.targetLanguage || 'zh',
    }, config.surface !== false);
  },
});
