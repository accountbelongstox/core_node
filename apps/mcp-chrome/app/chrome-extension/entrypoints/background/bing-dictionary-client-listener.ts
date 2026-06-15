/**
 * Bing Dictionary Service Listener
 * Handles messages from the popup to control the auto-translation service.
 * Drives the Worker API task service (the only path aligned with laravel_main's
 * /api/worker/* endpoints). The old client mode hit /api/dictionary/* endpoints
 * that laravel_main does not serve, so it has been removed.
 */

import { bingDictionaryWorkerService, type WorkerConfig } from './services/bing-dictionary-worker-service';

/**
 * Initialize message listener for Bing Dictionary Service
 */
export function initBingDictionaryClientListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'bing_dictionary_client_service' || message.type === 'bing_dictionary_worker_service') {
      handleBingDictionaryMessage(message, sendResponse);
      return true; // Keep message channel open for async response
    }
  });

  console.log('[Bing Service Listener] Initialized');
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

      case 'test_scrape': {
        const words = Array.isArray(message.words) ? message.words : [];
        const tabCount = (message.config as WorkerConfig | undefined)?.tabCount;
        const results = await bingDictionaryWorkerService.testScrape(words, tabCount);
        sendResponse({ success: true, results });
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
    console.error('[Bing Service Listener] Error:', error);
    sendResponse({
      success: false,
      error: error.message || 'Unknown error',
    });
  }
}
