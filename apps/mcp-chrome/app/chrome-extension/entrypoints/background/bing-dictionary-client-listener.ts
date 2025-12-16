/**
 * Bing Dictionary Service Listener
 * Handles messages from popup to control the auto-translation service
 * Supports both legacy client mode and new Worker mode
 */

import { bingDictionaryClientService, type BingClientConfig } from './services/bing-dictionary-client-service';
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
  message: { type: string; action: string; config?: BingClientConfig | WorkerConfig; mode?: 'legacy' | 'worker' },
  sendResponse: (response: any) => void,
) {
  try {
    const useWorkerMode = message.type === 'bing_dictionary_worker_service' || message.mode === 'worker';

    switch (message.action) {
      case 'start': {
        if (!message.config) {
          sendResponse({
            success: false,
            error: 'Config is required to start service',
          });
          return;
        }

        if (useWorkerMode) {
          // Use new Worker API service
          await bingDictionaryWorkerService.start(message.config as WorkerConfig);
          sendResponse({
            success: true,
            message: 'Worker service started',
            mode: 'worker',
          });
        } else {
          // Use legacy client service
          await bingDictionaryClientService.start(message.config as BingClientConfig);
          sendResponse({
            success: true,
            message: 'Client service started',
            mode: 'legacy',
          });
        }
        break;
      }

      case 'stop': {
        if (useWorkerMode) {
          bingDictionaryWorkerService.stop();
        } else {
          bingDictionaryClientService.stop();
        }

        sendResponse({
          success: true,
          message: 'Service stopped',
        });
        break;
      }

      case 'get_status': {
        const status = useWorkerMode
          ? bingDictionaryWorkerService.getStatus()
          : bingDictionaryClientService.getStatus();

        sendResponse({
          success: true,
          isRunning: status.isRunning,
          stats: status.stats,
          mode: useWorkerMode ? 'worker' : 'legacy',
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
