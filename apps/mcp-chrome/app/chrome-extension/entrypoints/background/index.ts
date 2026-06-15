import { initNativeHostListener } from './native-host';
import {
  initSemanticSimilarityListener,
  initializeSemanticEngineIfCached,
} from './semantic-similarity';
import { initStorageManagerListener } from './storage-manager';
import { cleanupModelCache } from '@/utils/semantic-similarity-engine';
import { setupAudioStatusListener } from './tools/audio';
import { getDeepSeekPollingService } from './deepseek-polling-service';
import { initBingDictionaryClientListener } from './bing-dictionary-client-listener';
import { initBingWorkerLifecycle } from './services/bing-dictionary-worker-service';
import { initNotebookLMListener } from './notebooklm-listener';
import { taskCenter } from './services/task-center/TaskCenter';
import { initializeProcessors } from './services/task-center/init-processors';
import { initTaskCenterListener } from './task-center-listener';
import { getLocalTaskQueueService, setupQueueMessageListener } from './services/local-task-queue';

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  /**
   * Global unhandled promise rejection handler
   * Suppresses benign "Receiving end does not exist" errors that occur when
   * broadcasting messages to non-existent receivers (e.g., closed popup windows)
   *
   * This is a known Chrome Extension architecture limitation:
   * - Service workers wake up and send messages
   * - Popup windows may not be open (no listeners)
   * - chrome.runtime.sendMessage fails with "Receiving end does not exist"
   *
   * References:
   * - https://groups.google.com/a/chromium.org/g/chromium-extensions/c/BH5_4OKxM3s
   * - https://developer.chrome.com/docs/extensions/mv3/messaging/
   */
  self.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || '';

    // Check if it's the benign "no receiver" connection error
    if (
      errorMessage.includes('Could not establish connection') ||
      errorMessage.includes('Receiving end does not exist')
    ) {
      // Suppress the error - this is expected when no listeners are present
      event.preventDefault();
      console.debug('[Background] Suppressed benign connection error (no listeners present)');
      return;
    }

    // Log other unhandled rejections (actual errors that need attention)
    console.error('[Background] ⚠️ Unhandled promise rejection:', event.reason);
  });

  // Initialize Local Task Queue (Unified Queue System)
  console.log('🎯 Initializing Local Task Queue...');
  setupQueueMessageListener();
  getLocalTaskQueueService()
    .initialize()
    .then(() => {
      console.log('✅ Local Task Queue initialized');
    })
    .catch((error) => {
      console.error('❌ Failed to initialize Local Task Queue:', error);
    });

  // Initialize Unified Task Center (State Center)
  console.log('🎯 Initializing Unified Task Center...');
  taskCenter.initialize();
  initializeProcessors();
  initTaskCenterListener();
  console.log('✅ Task Center initialized with all processors hooked');

  // Initialize core services
  initNativeHostListener();
  initSemanticSimilarityListener();
  initStorageManagerListener();
  setupAudioStatusListener();
  initBingDictionaryClientListener();
  // MV3-resilient assist: resurrect the Bing translation worker after the
  // service worker (or browser) restarts, via chrome.alarms + startup hooks.
  initBingWorkerLifecycle();
  // NotebookLM automation bridge for the popup test panel.
  initNotebookLMListener();

  // Initialize DeepSeek polling service
  getDeepSeekPollingService()
    .initialize()
    .then(() => {
      console.log('Background: DeepSeek polling service initialized');
    })
    .catch((error) => {
      console.warn('Background: Failed to initialize DeepSeek polling service:', error);
    });

  // Conditionally initialize semantic similarity engine if model cache exists
  initializeSemanticEngineIfCached()
    .then((initialized) => {
      if (initialized) {
        console.log('Background: Semantic similarity engine initialized from cache');
      } else {
        console.log(
          'Background: Semantic similarity engine initialization skipped (no cache found)',
        );
      }
    })
    .catch((error) => {
      console.warn('Background: Failed to conditionally initialize semantic engine:', error);
    });

  // Initial cleanup on startup
  cleanupModelCache().catch((error) => {
    console.warn('Background: Initial cache cleanup failed:', error);
  });
});
