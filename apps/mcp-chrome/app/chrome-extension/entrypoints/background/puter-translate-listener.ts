/**
 * Puter Translate Worker Service Listener
 *
 * Handles messages from the popup to control the Puter AI translate worker.
 * Mirrors bing-dictionary-client-listener pattern but for puter_translate.
 */

import { puterTranslateWorkerService } from './services/puter-translate-worker-service';
import { logger } from '@/utils/logger';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';
import { registerRuntimeMessageHandler } from '@/utils/runtime-message';
import { toErrorMessage } from '@/utils/errors';

const LOG = 'Puter Listener';

export function initPuterTranslateListener() {
  registerRuntimeMessageHandler(FEATURE_MESSAGE_TYPES.PUTER_TRANSLATE_WORKER, handleMessage, {
    createErrorResponse: (error, message) => {
      logger.warn(LOG, `Action ${message.action} failed`, error);
      return { success: false, error: toErrorMessage(error) || 'Unknown error' };
    },
  });

  logger.info(LOG, 'Initialized');
}

async function handleMessage(
  message: { type: string; action: string; config?: any },
) {
  switch (message.action) {
    case 'start': {
      if (!message.config?.apiUrl) {
        return { success: false, error: 'apiUrl is required' };
      }
      await puterTranslateWorkerService.start({
        apiUrl: message.config.apiUrl,
        workerName: message.config.workerName || 'MCP Chrome Puter AI Worker',
        batchSize: message.config.batchSize ?? 3,
      });
      return { success: true, message: 'Puter translate worker started' };
    }
    case 'stop':
      puterTranslateWorkerService.stop();
      return { success: true, message: 'Puter translate worker stopped' };
    case 'get_status':
      return { success: true, status: puterTranslateWorkerService.getStatus() };
    default:
      return { success: false, error: `Unknown action: ${message.action}` };
  }
}
