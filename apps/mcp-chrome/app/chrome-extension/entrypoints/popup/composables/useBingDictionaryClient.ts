/**
 * Bing Dictionary Client Mode Composable
 * Handles client service control and configuration (under 200 lines)
 */

import { ref, onUnmounted, watch } from 'vue';
import { apiManager } from '@/services/ApiManager';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { logger } from '@/utils/logger';
import { getMessage } from '@/utils/i18n';
import { formatTimestamp } from '@/utils/time-helpers';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { BING_DICT_MSG } from '@/common/message-types';
import { readJson, writeJson } from './useCacheStore';
import { localStorage } from '@/services/ExtensionStorage';
import { IntervalController, TimeoutController } from '@/utils/async';

const LOG = 'Bing Client';

export type ServiceMode = 'legacy' | 'worker';

// Where the last scrape-test results are cached (visible again on reopen).
const SCRAPE_CACHE_KEY = 'scrape_test_results';

export interface ClientConfig {
  apiUrl: string;
  fetchInterval: number;
  batchSize: number;
  mode?: ServiceMode;
  // Worker mode: number of Bing dictionary tabs driven in parallel.
  tabCount?: number;
  // Worker mode: source language of the words to translate (the dictionary the
  // pending words live in). Drives the pending-words query + enqueue.
  sourceLanguage?: string;
  // Worker mode: default target language when a task omits one.
  targetLanguage?: string;
}

export interface ClientServiceStats {
  pending: number;
  translated: number;
  failed: number;
  invalid?: number;         // Words Bing had no entry for (marked invalid)
  lastRun: number | null;
  workerId?: string | null;
  isOnline?: boolean;
  // Queue statistics
  queueTotal?: number;      // Total tasks in current queue
  newTasks?: number;        // New tasks received in last poll
  duplicateTasks?: number;  // Duplicate tasks skipped in last poll
  activeTabs?: number;      // Bing tabs currently in the pool
  currentWord?: string | null;   // Word currently being looked up
  currentTaskId?: string | null; // Task currently being processed
  // Per-tab live activity: which word each parallel Bing tab is translating now.
  tabActivity?: Array<{ tabId: number; word: string | null }>;
}

export interface ClientServiceState {
  isRunning: boolean;
  stats: ClientServiceStats | null;
}

export function useBingDictionaryClient() {
  const clientMode = ref(false);
  const clientConfig = ref<ClientConfig>({
    apiUrl: '',
    fetchInterval: 5,  // Default 5 seconds for real-time updates
    batchSize: 10,
    mode: 'worker', // Default to Worker API mode
    tabCount: 3,     // Parallel Bing dictionary tabs (worker mode)
    sourceLanguage: 'en', // Source language of the pending words
    targetLanguage: 'zh',
  });
  const clientService = ref<ClientServiceState>({
    isRunning: false,
    stats: null,
  });
  const error = ref('');
  const connectionStatus = ref<{ state: 'idle' | 'testing' | 'ok' | 'fail'; message: string }>({
    state: 'idle',
    message: '',
  });

  // The worker pulls the untranslated queue from laravel_main using the SINGLE
  // endpoint configured in the header EndpointDropdown (shared useApiEndpoint).
  const { apiBaseUrl: currentEndpoint } = useApiEndpoint();

  watch(
    currentEndpoint,
    (url) => {
      const normalized = (url || '').replace(/\/+$/, '');
      clientConfig.value.apiUrl = normalized;
    },
    { immediate: true },
  );

  // Ad-hoc Bing scrape test (default word "hello").
  const testWords = ref('hello');
  const testResults = ref<any[]>([]);
  const testing = ref(false);

  // Translation queue overview (the "untranslated data": how many entries + the
  // pending task list). SERVER-side paginated: each page is fetched from
  // laravel_main's controlList via `page`/`limit`; `total` drives the page count.
  const QUEUE_PAGE_SIZE = 10;
  const queueOverview = ref<{
    summary: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      total: number;
    } | null;
    items: any[];      // CURRENT page only (server-paginated)
    page: number;
    pageSize: number;
    total: number;     // total filtered rows (from pagination.total)
    hasMore: boolean;
    loading: boolean;
    error: string;
  }>({
    summary: null,
    items: [],
    page: 1,
    pageSize: QUEUE_PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: false,
    error: '',
  });

  // Two-step Start: the FIRST click loads + shows the queue (prepared=true) and
  // does NOT start crawling; the SECOND click (Confirm & Start) actually starts.
  const prepared = ref(false);

  // Fetch ONE page of the untranslated/pending queue from laravel_main (via the
  // worker service). Called on Start (page 1) and by the pager.
  const loadQueueOverview = async (page = 1) => {
    if (!clientConfig.value.apiUrl) {
      queueOverview.value.error = 'No endpoint configured in Settings';
      connectionStatus.value = { state: 'fail', message: 'No endpoint configured in Settings' };
      return;
    }
    const target = Math.max(1, Math.floor(page) || 1);
    queueOverview.value.loading = true;
    queueOverview.value.error = '';
    try {
      const resp = await chrome.runtime.sendMessage({
        type: BING_DICT_MSG,
        action: 'queue_overview',
        config: clientConfig.value,
        status: 'pending',
        limit: queueOverview.value.pageSize,
        page: target,
      });
      if (resp && resp.success) {
        const pg = resp.pagination || {};
        queueOverview.value.summary = resp.summary || null;
        queueOverview.value.items = Array.isArray(resp.items) ? resp.items : [];
        queueOverview.value.page = pg.page ?? target;
        queueOverview.value.total =
          typeof pg.total === 'number' ? pg.total : queueOverview.value.items.length;
        queueOverview.value.hasMore = !!pg.has_more;
        // Loading the queue IS the live connectivity check for the panel.
        const pending = queueOverview.value.summary?.pending ?? 0;
        connectionStatus.value = { state: 'ok', message: `Connected · ${pending} pending` };
      } else {
        queueOverview.value.error = (resp && resp.message) || getMessage('loadQueueFailed');
        connectionStatus.value = { state: 'fail', message: queueOverview.value.error };
      }
    } catch (err: any) {
      queueOverview.value.error = err?.message || getMessage('loadQueueFailed');
      connectionStatus.value = { state: 'fail', message: queueOverview.value.error };
    } finally {
      queueOverview.value.loading = false;
    }
  };

  // Pager → fetch that page from the server.
  const setQueuePage = (page: number) => loadQueueOverview(page);

  const statsPolling = new IntervalController();

  const toggleClientMode = async () => {
    clientMode.value = !clientMode.value;
    await chrome.storage.local.set({ [STORAGE_KEYS.BING_DICTIONARY_CLIENT_MODE]: clientMode.value });

    if (clientMode.value) {
      await loadClientConfig();
      await loadClientServiceState();
      startStatsPolling();
    } else {
      stopStatsPolling();
      if (clientService.value.isRunning) {
        await toggleClientService();
      }
    }
  };

  // Update a single config field from the panel and persist it, with light
  // sanitation so unreasonable values can't reach the worker.
  const updateConfig = async (field: string, value: any) => {
    let next = value;
    if (field === 'apiUrl' && typeof value === 'string') {
      next = value.trim().replace(/\/+$/, '');
    } else if (field === 'tabCount') {
      const n = Number(value);
      next = Number.isFinite(n) ? Math.max(1, Math.min(8, Math.round(n))) : 3;
    } else if (field === 'batchSize') {
      const n = Number(value);
      next = Number.isFinite(n) ? Math.max(1, Math.min(50, Math.round(n))) : 5;
    } else if (field === 'fetchInterval') {
      const n = Number(value);
      next = Number.isFinite(n) ? Math.max(1, Math.min(3600, Math.round(n))) : 5;
    } else if (field === 'targetLanguage' && typeof value === 'string') {
      next = value.trim().toLowerCase();
    } else if (field === 'sourceLanguage' && typeof value === 'string') {
      next = value.trim().toLowerCase();
    }
    (clientConfig.value as any)[field] = next;
    // Editing the endpoint invalidates a previous connection test.
    if (field === 'apiUrl') {
      connectionStatus.value = { state: 'idle', message: '' };
    }
    await saveClientConfig();
    // Real-time settings: when the worker is running, push the change so it takes
    // effect live (no stop/restart). Debounced so dragging a number input doesn't
    // spam the worker / thrash the poll interval + tab pool.
    pushLiveConfig();
  };

  // Debounced live-apply of the current config to a running worker.
  const liveApplyTimeout = new TimeoutController();
  let unsubscribeClientConfig: (() => void) | null = null;
  // Centralized clear so both the re-debounce path and unmount teardown release
  // the pending timer (mirrors stopStatsPolling for the stats interval).
  const cancelLiveApply = () => {
    liveApplyTimeout.cancel();
  };
  const pushLiveConfig = () => {
    liveApplyTimeout.restart(async () => {
      if (!clientService.value.isRunning) return;
      try {
        await chrome.runtime.sendMessage({
          type: BING_DICT_MSG,
          action: 'update_config',
          config: clientConfig.value,
        });
      } catch (err) {
        logger.warn(LOG, 'Live config apply failed', err);
      }
    }, 400);
  };

  const applyStoredConfig = (stored?: Partial<ClientConfig>) => {
    if (!stored) return;
    const next = {
      ...clientConfig.value,
      ...stored,
      apiUrl: currentEndpoint.value.replace(/\/+$/, ''),
    };
    if (JSON.stringify(next) === JSON.stringify(clientConfig.value)) return;
    clientConfig.value = next;
    pushLiveConfig();
  };

  const ensureClientConfigSync = () => {
    if (unsubscribeClientConfig) return;
    unsubscribeClientConfig = localStorage.subscribe<ClientConfig>(
      STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG,
      applyStoredConfig,
    );
  };

  // Ping the endpoint configured in Settings so the user gets reachability feedback.
  const testConnection = async () => {
    if (!clientConfig.value.apiUrl) {
      connectionStatus.value = { state: 'fail', message: 'No endpoint configured in Settings' };
      return;
    }
    connectionStatus.value = { state: 'testing', message: 'Testing…' };
    try {
      const response = await chrome.runtime.sendMessage({
        type: BING_DICT_MSG,
        action: 'test_connection',
        config: clientConfig.value,
        mode: 'worker',
      });
      if (response && response.ok) {
        connectionStatus.value = { state: 'ok', message: response.message || getMessage('connectedStatus') };
      } else {
        connectionStatus.value = {
          state: 'fail',
          message: (response && response.message) || getMessage('unreachableStatus'),
        };
      }
    } catch (err: any) {
      connectionStatus.value = { state: 'fail', message: err?.message || getMessage('unreachableStatus') };
    }
  };

  // ---- Ad-hoc Bing scrape test --------------------------------------------
  const runScrapeTest = async () => {
    const words = (testWords.value || '')
      .split(/[\s,，、]+/)
      .map((w) => w.trim())
      .filter(Boolean);
    if (words.length === 0) {
      testResults.value = [];
      return;
    }
    testing.value = true;
    testResults.value = [];
    try {
      const response = await chrome.runtime.sendMessage({
        type: BING_DICT_MSG,
        action: 'test_scrape',
        words,
        config: clientConfig.value,
        mode: 'worker',
      });
      if (response && response.success) {
        testResults.value = response.results || [];
        // Persist to the dictionary cache so results survive popup close/reopen.
        await writeJson('dictionary', SCRAPE_CACHE_KEY, testResults.value);
      } else {
        error.value = (response && response.error) || getMessage('scrapeTestFailed');
      }
    } catch (err: any) {
      error.value = err?.message || getMessage('scrapeTestFailed');
    } finally {
      testing.value = false;
    }
  };

  // Always-on activation for an embedded panel: load saved config, pull the
  // endpoint from Settings, load current service state, and begin polling.
  const initPanel = async () => {
    ensureClientConfigSync();
    await logger.init();
    await loadClientConfig();
    await apiManager.initialize({ autoDetect: false });
    // Restore the last scrape-test results from cache so they're visible again.
    const cached = await readJson<any[]>('dictionary', SCRAPE_CACHE_KEY);
    if (Array.isArray(cached) && cached.length) {
      testResults.value = cached;
    }
    await loadClientServiceState();
    startStatsPolling();
  };

  const saveClientConfig = async () => {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG]: clientConfig.value });
      logger.debug(LOG, 'Client config saved');
    } catch (err) {
      logger.error(LOG, 'Failed to save client config', err);
    }
  };

  const loadClientConfig = async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG);
      if (result[STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG]) {
        applyStoredConfig(result[STORAGE_KEYS.BING_DICTIONARY_CLIENT_CONFIG]);
      }
    } catch (err) {
      logger.error(LOG, 'Failed to load client config', err);
    }
  };

  // First click LOADS + shows the queue (no start); second click CONFIRMS + starts.
  const prepareQueue = async () => {
    error.value = '';
    await loadQueueOverview(1);
    // Ready to confirm only when the queue actually loaded (reachable backend).
    prepared.value = !queueOverview.value.error;
  };

  // Three-state primary action driving the single toggle button:
  //   running        -> stop
  //   stopped & !ready -> prepare (load + show the queue; DON'T start yet)
  //   stopped & ready  -> confirm: start crawling per settings
  const toggleClientService = async () => {
    try {
      // Worker service is the only path aligned with laravel_main's /api/worker/*.
      if (clientService.value.isRunning) {
        const resp = await chrome.runtime.sendMessage({
          type: BING_DICT_MSG,
          action: 'stop',
          config: clientConfig.value,
        });
        if (resp && resp.success) {
          clientService.value.isRunning = false;
          prepared.value = false;
          await loadClientServiceState();
        } else {
          error.value = resp?.error || getMessage('stopServiceFailed');
        }
        return;
      }

      // Step 1: not yet prepared — load + display the queue, do NOT start.
      if (!prepared.value) {
        await prepareQueue();
        return;
      }

      // Step 2: confirmed — start crawling per settings.
      const resp = await chrome.runtime.sendMessage({
        type: BING_DICT_MSG,
        action: 'start',
        config: clientConfig.value,
      });
      if (resp && resp.success) {
        clientService.value.isRunning = true;
        prepared.value = false;
        await loadClientServiceState();
      } else {
        error.value = resp?.error || getMessage('startServiceFailed');
      }
    } catch (err: any) {
      logger.error(LOG, 'Service toggle error', err);
      error.value = err.message || getMessage('toggleServiceFailed');
    }
  };

  const loadClientServiceState = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: BING_DICT_MSG,
        action: 'get_status',
      });

      if (response && response.success) {
        clientService.value.isRunning = response.isRunning;
        clientService.value.stats = response.stats;
      }
    } catch (err) {
      logger.error(LOG, 'Failed to load service state', err);
    }
  };

  const startStatsPolling = () => {
    statsPolling.start(() => void loadClientServiceState(), 3000);
  };

  const stopStatsPolling = () => {
    statsPolling.stop();
  };

  const initialize = async () => {
    ensureClientConfigSync();
    const result = await chrome.storage.local.get(STORAGE_KEYS.BING_DICTIONARY_CLIENT_MODE);
    if (result[STORAGE_KEYS.BING_DICTIONARY_CLIENT_MODE]) {
      clientMode.value = result[STORAGE_KEYS.BING_DICTIONARY_CLIENT_MODE];
      await loadClientConfig();
      await loadClientServiceState();
      if (clientMode.value) {
        startStatsPolling();
      }
    }
  };

  onUnmounted(() => {
    stopStatsPolling();
    // Cancel any pending debounced live-config push so it can't fire after the
    // panel is gone and message a background service from a dead component.
    cancelLiveApply();
    unsubscribeClientConfig?.();
    unsubscribeClientConfig = null;
  });

  return {
    clientMode,
    clientConfig,
    clientService,
    error,
    connectionStatus,
    currentEndpoint,
    testWords,
    testResults,
    testing,
    queueOverview,
    loadQueueOverview,
    setQueuePage,
    prepared,
    toggleClientMode,
    saveClientConfig,
    updateConfig,
    testConnection,
    runScrapeTest,
    toggleClientService,
    formatTimestamp,
    initialize,
    initPanel,
  };
}
