// MUST stay the first import: aliases chrome -> browser on Firefox before any
// other module top-level code touches chrome.* (no-op, tree-shaken on Chrome).
import '@/utils/browser-shim';
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
import { initTabController } from './services/tab-controller';
import { initAiWebClientListener } from './ai-web-client-listener';
import { initNotebookLMListener } from './notebooklm-listener';
import { initGeminiImageListener } from './gemini-image-listener';
import { initGeminiTextListener } from './gemini-text-listener';
import { initChatGptTextListener } from './chatgpt-text-listener';
import { initGrokTextListener } from './grok-text-listener';
import { initCopilotTextListener } from './copilot-text-listener';
import { initApiHealthListener } from './api-health-listener';
import { taskCenter } from './services/task-center/TaskCenter';
import { initializeProcessors } from './services/task-center/init-processors';
import { initTaskCenterListener } from './task-center-listener';
import { initPuterTranslateListener } from './puter-translate-listener';
import { initDuoreaderImporterListener } from './duoreader-importer-listener';
import { initWebSearchListener } from './web-search-listener';
import { initQwenTtsListener } from './qwen-tts-listener';
import { initBackendTimeoutCache } from '@/utils/backend-timeout';
import { submitOutbox } from './services/outbox/submit-outbox';
import { logger } from '@/utils/logger';

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

    if (errorMessage.includes('Duplicate script ID')) {
      event.preventDefault();
      console.debug('[Background] Suppressed duplicate content-script registration on reload');
      return;
    }

    // Log other unhandled rejections (actual errors that need attention)
    console.error('[Background] ⚠️ Unhandled promise rejection:', event.reason);
  });

  // Initialize Unified Task Center (State Center)
  // INVARIANT (do not break): only REGISTER processors here — never call
  // taskCenter.startAll()/startProcessor() or any worker .start() at SW-load
  // time. The Bing / Gemini / ChatGPT / Prompt-Translate assist workers are
  // strictly user-initiated each browser session: a full Chrome close+reopen
  // must require a manual Start (Bing's run-intent is gated to chrome.storage
  // SESSION; the others have no resume/onStartup hook). Auto-starting anything
  // here would regress that.
  console.log('🎯 Initializing Unified Task Center...');
  taskCenter.initialize();
  initializeProcessors();
  initTaskCenterListener();
  console.log('✅ Task Center initialized with all processors hooked');

  // Seed the configurable backend-timeout cache and start the persistent retry
  // outbox drain loop. Both are seed/register-only (no worker is started), so the
  // "only register, never start workers" invariant above is preserved.
  initBackendTimeoutCache();
  submitOutbox.start();

  // Initialize core services
  initNativeHostListener();
  initSemanticSimilarityListener();
  initStorageManagerListener();
  setupAudioStatusListener();
  initBingDictionaryClientListener();
  // ChatGPT/Gemini web-assist: ad-hoc test + one-click prompt_translation worker.
  initAiWebClientListener();
  // Shared tab-activation + human-interference-pause + tab self-recovery
  // coordinator. Registered BEFORE the Bing worker resumes so its listeners +
  // heal-handler slot exist when a resumed worker reports its managed tabs. Only
  // registers listeners + an empty pause clock here — never starts a worker, so
  // the manual-re-enable-on-cold-open invariant is preserved.
  initTabController();
  // MV3-resilient assist: resurrect the Bing translation worker after the
  // service worker (or browser) restarts, via chrome.alarms + startup hooks.
  initBingWorkerLifecycle();
  // NotebookLM automation bridge for the popup test panel.
  initNotebookLMListener();
  // Gemini image-generation bridge for the popup "Generate image" button.
  initGeminiImageListener();
  // Article Study Guide test panel job bridges — one per web-chat provider,
  // all sharing the same start/status job contract (web-chat-job-base.ts).
  initGeminiTextListener();
  initChatGptTextListener();
  initGrokTextListener();
  initCopilotTextListener();
  // Real, CORS-bypassing API health checks on the popup's behalf.
  initApiHealthListener();
  // Puter AI translate worker bridge for the popup AI Translate Hub panel.
  initPuterTranslateListener();
  // Duoreader → Laravel Books import (scrape + upload with shared API endpoint).
  initDuoreaderImporterListener();
  // Google/Bing web+image search API (popup panel, MCP tool, Duoreader cover enrich).
  initWebSearchListener();
  // Qwen3-TTS HuggingFace Gradio automation (popup + MCP tool).
  initQwenTtsListener();
  void logger.init().catch(() => {});

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
