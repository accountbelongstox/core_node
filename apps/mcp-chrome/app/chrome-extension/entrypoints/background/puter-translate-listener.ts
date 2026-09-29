/**
 * Puter Translate Worker Service Listener
 *
 * Handles messages from the popup to control the Puter AI translate worker.
 * Mirrors bing-dictionary-client-listener pattern but for puter_translate.
 */

import { puterTranslateWorkerService } from './services/puter-translate-worker-service';
import { logger } from '@/utils/logger';
import { FEATURE_MESSAGE_TYPES } from '@/common/message-types';
import { registerRuntimeMessageHandler, unknownActionResponse } from '@/utils/runtime-message';
import { getMessage } from '@/utils/i18n';
import { toErrorMessage } from '@/utils/errors';
import { resolveApiBase } from '@/services/ApiManager';

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
      await puterTranslateWorkerService.start({
        apiUrl: await resolveApiBase(),
        workerName: message.config?.workerName || 'MCP Chrome Puter AI Worker',
        batchSize: message.config?.batchSize ?? 3,
      });
      return { success: true, message: getMessage('workerStartedStatus') };
    }
    case 'stop':
      puterTranslateWorkerService.stop();
      return { success: true, message: getMessage('workerStoppedStatus') };
    case 'get_status':
      return { success: true, status: puterTranslateWorkerService.getStatus() };
    default:
      return unknownActionResponse(message.action);
  }
}
