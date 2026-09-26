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
import { registerRuntimeMessageHandler } from '@/utils/runtime-message';
import { toErrorMessage } from '@/utils/errors';
import { resolveApiBase } from '@/services/ApiManager';

const LOG = 'Bing Listener';

/**
 * Initialize message listener for Bing Dictionary Service
 */
export function initBingDictionaryClientListener() {
  registerRuntimeMessageHandler([
    FEATURE_MESSAGE_TYPES.BING_DICTIONARY_CLIENT,
    BING_DICT_MSG,
  ], handleBingDictionaryMessage, {
    createErrorResponse: (error) => {
      logger.error(LOG, 'Message handler error', error);
      return { success: false, error: toErrorMessage(error) || 'Unknown error' };
    },
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
    config?: Omit<WorkerConfig, 'apiUrl'>;
    words?: string[];
  },
) {
  // The popup never sends an API base: the worker always uses the global endpoint.
  const workerConfig = async (): Promise<WorkerConfig> => ({
    ...(message.config || {}),
    apiUrl: await resolveApiBase(),
  });

  switch (message.action) {
    case 'start': {
      if (!message.config) {
        return {
          success: false,
          error: 'Config is required to start service',
        };
      }

      await bingDictionaryWorkerService.start(await workerConfig());
      return {
        success: true,
        message: 'Worker service started',
        mode: 'worker',
      };
    }

    case 'stop':
      bingDictionaryWorkerService.stop();
      return { success: true, message: 'Service stopped' };

    case 'update_config': {
      if (!message.config) {
        return { success: false, error: 'Config is required to update settings' };
      }
      await bingDictionaryWorkerService.updateConfig(await workerConfig());
      const status = bingDictionaryWorkerService.getStatus();
      return {
        success: true,
        message: 'Config applied',
        isRunning: status.isRunning,
        stats: status.stats,
      };
    }

    case 'test_scrape': {
      const words = Array.isArray(message.words) ? message.words : [];
      const tabCount = message.config?.tabCount;
      const results = await bingDictionaryWorkerService.testScrape(words, tabCount);
      return { success: true, results };
    }

    case 'queue_overview': {
      const config = message.config;
      const status = (message as any).status || 'pending';
      const limit = (message as any).limit || 10;
      const page = (message as any).page || 1;
      const language = config?.sourceLanguage || 'en';
      const targetLanguage = config?.targetLanguage || 'zh';
      const overview = await bingDictionaryWorkerService.getQueueOverview(
        await resolveApiBase(),
        status,
        limit,
        page,
        language,
        targetLanguage,
      );
      return { success: overview.ok, ...overview };
    }

    case 'test_connection': {
      const result = await bingDictionaryWorkerService.testConnection(await resolveApiBase());
      return { success: true, ok: result.ok, message: result.message };
    }

    case 'get_status': {
      const status = bingDictionaryWorkerService.getStatus();
      return {
        success: true,
        isRunning: status.isRunning,
        stats: status.stats,
        mode: 'worker',
      };
    }

    default:
      return { success: false, error: `Unknown action: ${message.action}` };
  }
}
