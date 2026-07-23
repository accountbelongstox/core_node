import { initAiWebClientListener } from './ai-web-client-listener';
import { initApiHealthListener } from './api-health-listener';
import { initBingDictionaryClientListener } from './bing-dictionary-client-listener';
import { initChatGptTextListener } from './chatgpt-text-listener';
import { initCopilotTextListener } from './copilot-text-listener';
import { getDeepSeekPollingService } from './deepseek-polling-service';
import { initDuoreaderImporterListener } from './duoreader-importer-listener';
import { initGeminiImageListener } from './gemini-image-listener';
import { initGeminiTextListener } from './gemini-text-listener';
import { initGrokTextListener } from './grok-text-listener';
import { initNativeHostListener } from './native-host';
import { initNotebookLMListener } from './notebooklm-listener';
import { initPuterTranslateListener } from './puter-translate-listener';
import { initQwenTtsListener } from './qwen-tts-listener';
import { initSemanticSimilarityListener, initializeSemanticEngineIfCached } from './semantic-similarity';
import { initBingWorkerLifecycle } from './services/bing-dictionary-worker-service';
import { submitOutbox } from './services/outbox/submit-outbox';
import { initTabController } from './services/tab-controller';
import { taskCenter } from './services/task-center/TaskCenter';
import { initializeProcessors } from './services/task-center/init-processors';
import { initStorageManagerListener } from './storage-manager';
import { initTaskCenterListener } from './task-center-listener';
import { setupAudioStatusListener } from './tools/audio';
import { initWebSearchListener } from './web-search-listener';
import { initBackendTimeoutCache } from '@/utils/backend-timeout';
import { cleanupModelCache } from '@/utils/semantic-similarity-engine';
import { logger } from '@/utils/logger';

interface BackgroundService {
  name: string;
  initialize: () => void;
}

const CORE_SERVICES: BackgroundService[] = [
  { name: 'native-host', initialize: initNativeHostListener },
  { name: 'semantic-similarity', initialize: initSemanticSimilarityListener },
  { name: 'storage-manager', initialize: initStorageManagerListener },
  { name: 'audio-status', initialize: setupAudioStatusListener },
  { name: 'tab-controller', initialize: initTabController },
  { name: 'bing-lifecycle', initialize: initBingWorkerLifecycle },
];

const FEATURE_SERVICES: BackgroundService[] = [
  { name: 'bing-dictionary', initialize: initBingDictionaryClientListener },
  { name: 'ai-web', initialize: initAiWebClientListener },
  { name: 'notebooklm', initialize: initNotebookLMListener },
  { name: 'gemini-image', initialize: initGeminiImageListener },
  { name: 'gemini-text', initialize: initGeminiTextListener },
  { name: 'chatgpt-text', initialize: initChatGptTextListener },
  { name: 'grok-text', initialize: initGrokTextListener },
  { name: 'copilot-text', initialize: initCopilotTextListener },
  { name: 'api-health', initialize: initApiHealthListener },
  { name: 'puter-translate', initialize: initPuterTranslateListener },
  { name: 'duoreader-importer', initialize: initDuoreaderImporterListener },
  { name: 'web-search', initialize: initWebSearchListener },
  { name: 'qwen-tts', initialize: initQwenTtsListener },
];

function initializeServiceGroup(services: BackgroundService[]): void {
  services.forEach((service) => {
    try {
      service.initialize();
    } catch (error) {
      logger.error('Background', `Failed to initialize ${service.name}`, error);
    }
  });
}

export function initializeBackground(): void {
  // Registration only: no task processor may auto-start during service-worker boot.
  taskCenter.initialize();
  initializeProcessors();
  initTaskCenterListener();

  initBackendTimeoutCache();
  submitOutbox.start();
  initializeServiceGroup(CORE_SERVICES);
  initializeServiceGroup(FEATURE_SERVICES);

  void logger.init();
  void getDeepSeekPollingService().initialize().catch((error) => {
    logger.warn('Background', 'DeepSeek polling initialization failed', error);
  });
  void initializeSemanticEngineIfCached().catch((error) => {
    logger.warn('Background', 'Cached semantic engine initialization failed', error);
  });
  void cleanupModelCache().catch((error) => {
    logger.warn('Background', 'Initial model cache cleanup failed', error);
  });
}
