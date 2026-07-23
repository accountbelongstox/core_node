/**
 * Bing Dictionary Service Listener
 * Handles messages from the popup to control the auto-translation service.
 * Drives the Worker API task service (the only path aligned with laravel_main's
 * /api/worker/* endpoints). The old client mode hit /api/dictionary/* endpoints
 * that laravel_main does not serve, so it has been removed.
 */

import { bingDictionaryWorkerService, type WorkerConfig } from './services/bing-dictionary-worker-service';
import { logger } from '@/utils/logger';
import { BING_DICT_MSG, FEATURE_MESSAGE_TYPES } from '@/common/message-types';

const LOG = 'Bing Listener';

/**
 * Initialize message listener for Bing Dictionary Service
 */
export function initBingDictionaryClientListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === FEATURE_MESSAGE_TYPES.BING_DICTIONARY_CLIENT || message.type === BING_DICT_MSG) {
      handleBingDictionaryMessage(message, sendResponse);
      return true; // Keep message channel open for async response
    }
  });

  logger.info(LOG, 'Initialized');
}

/**
 * Handle Bing Dictionary Service messages
 */
async function handleBingDictionaryMessage(
  message: {
    type: string;
    action: string;
    config?: WorkerConfig;
    words?: string[];
  },
  sendResponse: (response: any) => void,
) {
  try {
    switch (message.action) {
      case 'start': {
        if (!message.config) {
          sendResponse({
            success: false,
            error: 'Config is required to start service',
          });
          return;
        }

        await bingDictionaryWorkerService.start(message.config as WorkerConfig);
        sendResponse({
          success: true,
          message: 'Worker service started',
          mode: 'worker',
        });
        break;
      }

      case 'stop': {
        bingDictionaryWorkerService.stop();
        sendResponse({
          success: true,
          message: 'Service stopped',
        });
        break;
      }

      case 'update_config': {
        // Real-time settings: apply a config change to the (possibly running)
        // worker without stopping it. Intervals re-arm, the tab pool resizes, and
        // batch size / languages take effect on the next cycle.
        if (!message.config) {
          sendResponse({ success: false, error: 'Config is required to update settings' });
          return;
        }
        await bingDictionaryWorkerService.updateConfig(message.config as WorkerConfig);
        const status = bingDictionaryWorkerService.getStatus();
        sendResponse({
          success: true,
          message: 'Config applied',
          isRunning: status.isRunning,
          stats: status.stats,
        });
        break;
      }

      case 'test_scrape': {
        const words = Array.isArray(message.words) ? message.words : [];
        const tabCount = (message.config as WorkerConfig | undefined)?.tabCount;
        const results = await bingDictionaryWorkerService.testScrape(words, tabCount);
        sendResponse({ success: true, results });
        break;
      }

      case 'queue_overview': {
        const cfg = message.config as WorkerConfig | undefined;
        const status = (message as any).status || 'pending';
        const limit = (message as any).limit || 10;
        const page = (message as any).page || 1;
        // Source/target languages come from the panel config (multi-source aware).
        const language = cfg?.sourceLanguage || 'en';
        const targetLanguage = cfg?.targetLanguage || 'zh';
        const overview = await bingDictionaryWorkerService.getQueueOverview(
          cfg?.apiUrl || '',
          status,
          limit,
          page,
          language,
          targetLanguage,
        );
        sendResponse({ success: overview.ok, ...overview });
        break;
      }

      case 'test_connection': {
        const apiUrl = (message.config as WorkerConfig | undefined)?.apiUrl || '';
        const result = await bingDictionaryWorkerService.testConnection(apiUrl);
        sendResponse({
          success: true,
          ok: result.ok,
          message: result.message,
        });
        break;
      }

      case 'get_status': {
        const status = bingDictionaryWorkerService.getStatus();
        sendResponse({
          success: true,
          isRunning: status.isRunning,
          stats: status.stats,
          mode: 'worker',
        });
        break;
      }

      default: {
        sendResponse({
          success: false,
          error: `Unknown action: ${message.action}`,
        });
      }
    }
  } catch (error: any) {
    logger.error(LOG, 'Message handler error', error);
    sendResponse({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
