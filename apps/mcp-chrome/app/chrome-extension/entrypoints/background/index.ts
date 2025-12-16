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
import { taskCenter } from './services/task-center/TaskCenter';
import { initializeProcessors } from './services/task-center/init-processors';
import { initTaskCenterListener } from './task-center-listener';

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
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
