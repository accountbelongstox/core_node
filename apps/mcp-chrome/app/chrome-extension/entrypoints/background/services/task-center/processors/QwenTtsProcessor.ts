import { qwenTtsWorkerService } from '../../qwen-tts-worker-service';
import { LANES } from '@/utils/task-center-lanes';
import { TASK_CAPABILITY_BY_ROLE } from '@/utils/queue-center-contract';
import { WorkerServiceProcessorBase } from '../WorkerServiceProcessorBase';

export const qwenTtsProcessor = new WorkerServiceProcessorBase({
  processorType: LANES.QWEN_TTS,
  processorName: 'Qwen3 TTS',
  workerName: 'MCP Chrome Qwen3 TTS Worker',
  service: qwenTtsWorkerService,
  processorTypes: [LANES.REMOTE_AUDIO],
  capabilities: [TASK_CAPABILITY_BY_ROLE.audio],
});
