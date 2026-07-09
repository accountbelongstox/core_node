/**
 * Puter Translate Worker Service Listener
 *
 * Handles messages from the popup to control the Puter AI translate worker.
 * Mirrors bing-dictionary-client-listener pattern but for puter_translate.
 */

import { puterTranslateWorkerService } from './services/puter-translate-worker-service';
import { logger } from '@/utils/logger';

const LOG = 'Puter Listener';

export function initPuterTranslateListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'puter_translate_worker_service') {
      handleMessage(message, sendResponse);
      return true; // async
    }
  });

  logger.info(LOG, 'Initialized');
}

async function handleMessage(
  message: { type: string; action: string; config?: any },
  sendResponse: (response: any) => void,
) {
  try {
    switch (message.action) {
      case 'start': {
        if (!message.config?.apiUrl) {
          sendResponse({ success: false, error: 'apiUrl is required' });
          return;
        }
        await puterTranslateWorkerService.start({
          apiUrl: message.config.apiUrl,
          workerName: message.config.workerName || 'MCP Chrome Puter AI Worker',
          batchSize: message.config.batchSize ?? 3,
        });
        sendResponse({ success: true, message: 'Puter translate worker started' });
        break;
      }

      case 'stop': {
        puterTranslateWorkerService.stop();
        sendResponse({ success: true, message: 'Puter translate worker stopped' });
        break;
      }

      case 'get_status': {
        const status = puterTranslateWorkerService.getStatus();
        sendResponse({ success: true, status });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${message.action}` });
    }
  } catch (err: any) {
    logger.warn(LOG, `Action ${message.action} failed`, err);
    sendResponse({ success: false, error: err?.message || 'Unknown error' });
  }
}
