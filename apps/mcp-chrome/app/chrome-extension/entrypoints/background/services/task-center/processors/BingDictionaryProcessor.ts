import { bingDictionaryWorkerService } from '../../bing-dictionary-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';
import { TASK_CENTER_DEFAULTS } from '@/utils/task-center-types';

export const bingDictionaryProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.BING_DICTIONARY,
  processorName: 'Bing Dictionary Translation',
  workerName: 'MCP Chrome Bing Translation Worker',
  service: bingDictionaryWorkerService,
  start: async (config) => {
    await bingDictionaryWorkerService.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || 'MCP Chrome Bing Translation Worker',
      pollInterval: config.pollInterval || TASK_CENTER_DEFAULTS.pollInterval,
      heartbeatInterval: config.heartbeatInterval || TASK_CENTER_DEFAULTS.heartbeatInterval,
      batchSize: config.batchSize || TASK_CENTER_DEFAULTS.batchSize,
      tabCount: config.tabCount || 3,
      targetLanguage: config.targetLanguage || 'zh',
    }, config.surface !== false);
  },
});
