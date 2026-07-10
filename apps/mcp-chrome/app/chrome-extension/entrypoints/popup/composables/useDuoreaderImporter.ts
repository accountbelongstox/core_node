/**
 * Duoreader importer popup composable.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { logger } from '@/utils/logger';
import {
  PROGRESS_STORAGE_KEY,
  DuoreaderBookMeta,
  DuoreaderImportProgress,
  emptyProgress,
  normalizeImportProgress,
} from '@/utils/duoreader-importer-core';
import type { DuoreaderApiTestResult } from '@/utils/duoreader-pz-decode';
import { sendWithWake } from '@/utils/sendWithWake';

const LOG = 'Duoreader Import';

type DrResponse<T> = T & { success?: boolean; error?: string };

const sendDr = <T>(payload: Record<string, unknown>): Promise<DrResponse<T>> =>
  sendWithWake(() => chrome.runtime.sendMessage(payload), LOG);

export function useDuoreaderImporter() {
  const myLang = usePersistedRef('duoreaderMyLang', 'zh');
  const learnLang = usePersistedRef('duoreaderLearnLang', 'en');
  const maxBooks = usePersistedRef('duoreaderMaxBooks', 0);
  const enableAudio = usePersistedRef('duoreaderEnableAudio', true);
  const useCdnApi = usePersistedRef('duoreaderUseCdnApi', false);

  const { apiBaseUrl, syncApiEndpoint } = useApiEndpoint();
  const books = ref<DuoreaderBookMeta[]>([]);
  const progress = ref<DuoreaderImportProgress>(emptyProgress());
  const loadingBooks = ref(false);
  const testingApi = ref(false);
  const apiTestResult = ref<DuoreaderApiTestResult | null>(null);
  const error = ref('');

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const refreshProgress = async () => {
    const res = await sendDr<{ progress?: DuoreaderImportProgress }>({
      type: 'duoreader_importer',
      action: 'get_status',
    });
    if (res?.progress) {
      progress.value = normalizeImportProgress(res.progress);
    }
  };

  const loadBooks = async () => {
    loadingBooks.value = true;
    error.value = '';
    try {
      await syncApiEndpoint();
      const res = await sendDr<{ books?: DuoreaderBookMeta[] }>({
        type: 'duoreader_importer',
        action: 'list_books',
        config: {
          myLang: myLang.value,
          learnLang: learnLang.value,
          maxBooks: maxBooks.value,
        },
      });
      if (!res?.success) {
        error.value = res?.error || 'Failed to load books';
        books.value = [];
        return;
      }
      books.value = res.books || [];
      logger.info(LOG, `Catalog loaded: ${books.value.length} book(s)`);
    } catch (e: any) {
      error.value = e?.message || 'Failed to load books';
      logger.error(LOG, error.value, e);
    } finally {
      loadingBooks.value = false;
    }
  };

  const testApi = async () => {
    testingApi.value = true;
    apiTestResult.value = null;
    error.value = '';
    try {
      await syncApiEndpoint();
      logger.info(LOG, 'Test API clicked — opening tab + CDN fetch');
      const res = await sendDr<{ result?: DuoreaderApiTestResult }>({
        type: 'duoreader_importer',
        action: 'test_api',
        config: {
          myLang: myLang.value,
          learnLang: learnLang.value,
          maxBooks: maxBooks.value,
        },
        bookId: books.value[0]?.id,
      });
      apiTestResult.value = res?.result || null;
      if (!res?.success) {
        error.value = res?.error || apiTestResult.value?.error || 'API test failed';
        logger.warn(LOG, error.value);
        return;
      }
      logger.info(
        LOG,
        `API test OK: ${apiTestResult.value?.articleCount} articles, sample ${apiTestResult.value?.sampleParagraphs} paragraphs (${apiTestResult.value?.elapsedMs}ms)`,
      );
    } catch (e: any) {
      error.value = e?.message || 'API test failed';
      logger.error(LOG, error.value, e);
    } finally {
      testingApi.value = false;
    }
  };

  const startImport = async () => {
    error.value = '';
    try {
      await syncApiEndpoint();
      logger.info(LOG, `Start Import clicked → ${apiBaseUrl.value}`);
      const res = await sendDr<{ started?: boolean }>({
        type: 'duoreader_importer',
        action: 'start',
        config: {
          myLang: myLang.value,
          learnLang: learnLang.value,
          maxBooks: maxBooks.value,
          enableAudioFetch: enableAudio.value,
          useCdnApi: useCdnApi.value,
        },
      });
      if (!res?.success) {
        error.value = res?.error || 'Start failed';
        logger.warn(LOG, error.value);
        return;
      }
      progress.value = {
        ...progress.value,
        running: true,
        phase: 'Starting…',
        error: '',
      };
      logger.info(LOG, 'Import job dispatched to background');
      startPolling();
      await refreshProgress();
    } catch (e: any) {
      error.value = e?.message || 'Start failed';
      logger.error(LOG, error.value, e);
    }
  };

  const stopImport = async () => {
    await sendDr({ type: 'duoreader_importer', action: 'stop' });
    logger.info(LOG, 'Stop requested');
    await refreshProgress();
  };

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      await refreshProgress();
      if (!progress.value.running && pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }, 1500);
  };

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !changes[PROGRESS_STORAGE_KEY]) return;
    progress.value = normalizeImportProgress(changes[PROGRESS_STORAGE_KEY].newValue);
  };

  onMounted(async () => {
    await logger.init().catch(() => {});
    await syncApiEndpoint();
    try {
      const legacy = await chrome.storage.local.get(['ui:duoreaderEnableAudio', 'ui:duoreaderEnableTts']);
      if (legacy['ui:duoreaderEnableAudio'] === undefined && legacy['ui:duoreaderEnableTts'] !== undefined) {
        enableAudio.value = legacy['ui:duoreaderEnableTts'];
      }
    } catch {
      // ignore
    }
    await refreshProgress();
    await loadBooks();
    chrome.storage.onChanged.addListener(onStorageChanged);
    if (progress.value.running) startPolling();
  });

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
    chrome.storage.onChanged.removeListener(onStorageChanged);
  });

  return {
    myLang,
    learnLang,
    maxBooks,
    enableAudio,
    useCdnApi,
    apiBaseUrl,
    books,
    progress,
    loadingBooks,
    testingApi,
    apiTestResult,
    error,
    loadBooks,
    testApi,
    startImport,
    stopImport,
    refreshApiBase: syncApiEndpoint,
  };
}
