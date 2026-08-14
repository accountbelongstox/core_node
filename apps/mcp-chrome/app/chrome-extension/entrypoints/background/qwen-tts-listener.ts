import { getQwenTtsProgress, runQwenTts } from './services/qwen-tts-service';
import { logger } from '@/utils/logger';
import { registerRuntimeMessageHandler, toErrorMessage } from '@/utils/runtime-message';

const LOG = 'Qwen TTS Listener';

export function initQwenTtsListener(): void {
  registerRuntimeMessageHandler('qwen_tts', async (message: any) => {
    switch (message.action) {
      case 'generate': {
        const result = await runQwenTts(message.request || {});
        return { success: result.ok, result };
      }
      case 'get_status':
        return { success: true, progress: await getQwenTtsProgress() };
      default:
        return { success: false, error: `Unknown action: ${message.action}` };
    }
  }, {
    createErrorResponse: (error) => {
      const message = toErrorMessage(error);
      logger.error(LOG, message, error);
      return { success: false, error: message };
    },
  });

  logger.info(LOG, 'Initialized');
}
