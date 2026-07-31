/**
 * Duoreader importer popup composable.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { useApiEndpoint } from '@/composables/useApiEndpoint';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { logger } from '@/utils/logger';
import { getMessage } from '@/utils/i18n';
import {
  PROGRESS_STORAGE_KEY,
  DuoreaderBookMeta,
  DuoreaderImportProgress,
  emptyProgress,
  normalizeImportProgress,
} from '@/utils/duoreader-importer-core';
import {
  resolveCoverUrlsForDisplay,
  revokeCoverSearchBlobUrls,
} from '@/utils/web-search-cover-cache';
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
  const enrichCoversFromSearch = usePersistedRef('duoreaderEnrichCovers', false);
  const forceReplaceUpload = usePersistedRef('duoreaderForceReplace', false);

  const { apiBaseUrl, syncApiEndpoint } = useApiEndpoint();
  const books = ref<DuoreaderBookMeta[]>([]);
  const progress = ref<DuoreaderImportProgress>(emptyProgress());
  const loadingBooks = ref(false);
  const testingApi = ref(false);
  const apiTestResult = ref<DuoreaderApiTestResult | null>(null);
  const error = ref('');

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let displayBlobUrls: string[] = [];

  const revokeDisplayBlobs = () => {
    revokeCoverSearchBlobUrls(displayBlobUrls);
    displayBlobUrls = [];
  };

  const hydrateCoverDisplay = async (list: DuoreaderBookMeta[]): Promise<DuoreaderBookMeta[]> => {
    revokeDisplayBlobs();
    const out: DuoreaderBookMeta[] = [];
    for (const book of list) {
      const displayUrls = await resolveCoverUrlsForDisplay(
        book.titleEn,
        book.authorEn,
        book.coverUrl,
        book.coverUrls,
      );
      for (const url of displayUrls) {
        if (url.startsWith('blob:')) displayBlobUrls.push(url);
      }
      out.push({
        ...book,
        coverUrls: displayUrls,
        coverUrl: displayUrls[0] || book.coverUrl || '',
      });
    }
    return out;
  };

  const refreshProgress = async () => {
    const res = await sendDr<{ progress?: DuoreaderImportProgress }>({
      type: 'duoreader_importer',
      action: 'get_status',
    });
    if (res?.progress) {
      progress.value = normalizeImportProgress(res.progress);
    }
  };

  const loadBooks = async (opts: { enrichCovers?: boolean } = {}) => {
    loadingBooks.value = true;
    error.value = '';
    try {
      await syncApiEndpoint();
      const enrichCovers = opts.enrichCovers === true && enrichCoversFromSearch.value;
      const res = await sendDr<{ books?: DuoreaderBookMeta[] }>({
        type: 'duoreader_importer',
        action: 'list_books',
        enrichCovers,
        config: {
          myLang: myLang.value,
          learnLang: learnLang.value,
          maxBooks: maxBooks.value,
          enrichCoversFromSearch: enrichCoversFromSearch.value,
          forceReplaceUpload: forceReplaceUpload.value,
        },
      });
      if (!res?.success) {
        error.value = res?.error || getMessage('loadBooksFailed');
        books.value = [];
        return;
      }
      books.value = await hydrateCoverDisplay(res.books || []);
      logger.info(LOG, `Catalog loaded: ${books.value.length} book(s)`);
    } catch (e: any) {
      error.value = e?.message || getMessage('loadBooksFailed');
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
          enrichCoversFromSearch: enrichCoversFromSearch.value,
        },
        bookId: books.value[0]?.id,
      });
      apiTestResult.value = res?.result || null;
      if (!res?.success) {
        error.value = res?.error || apiTestResult.value?.error || getMessage('apiTestFailed');
        logger.warn(LOG, error.value);
        return;
      }
      logger.info(
        LOG,
        `API test OK: ${apiTestResult.value?.articleCount} articles, sample ${apiTestResult.value?.sampleParagraphs} paragraphs (${apiTestResult.value?.elapsedMs}ms)`,
      );
    } catch (e: any) {
      error.value = e?.message || getMessage('apiTestFailed');
      logger.error(LOG, error.value, e);
    } finally {
      testingApi.value = false;
    }
  };

  const startOrResumeImport = async () => {
    error.value = '';
    const isResume = progress.value.paused
      || (progress.value.phase === 'Stopped' && !!progress.value.bookId);
    try {
      await syncApiEndpoint();
      const action = isResume ? 'resume' : 'start';
      logger.info(LOG, `${isResume ? 'Resume' : 'Start'} Import → ${apiBaseUrl.value}`);
      const res = await sendDr<{ started?: boolean; resumed?: boolean; error?: string }>({
        type: 'duoreader_importer',
        action,
        config: {
          myLang: myLang.value,
          learnLang: learnLang.value,
          maxBooks: maxBooks.value,
          enableAudioFetch: enableAudio.value,
          useCdnApi: useCdnApi.value,
          enrichCoversFromSearch: enrichCoversFromSearch.value,
          forceReplaceUpload: forceReplaceUpload.value,
        },
        resume: isResume,
      });
      if (!res?.success) {
        error.value = res?.error || getMessage(isResume ? 'resumeFailed' : 'startFailed');
        logger.warn(LOG, error.value);
        return;
      }
      progress.value = {
        ...progress.value,
        running: true,
        paused: false,
        phase: isResume ? 'Resuming…' : 'Starting…',
        error: '',
      };
      logger.info(LOG, `Import ${isResume ? 'resume' : 'start'} dispatched`);
      startPolling();
      await refreshProgress();
    } catch (e: any) {
      error.value = e?.message || getMessage(isResume ? 'resumeFailed' : 'startFailed');
      logger.error(LOG, error.value, e);
    }
  };

  const pauseImport = async () => {
    await sendDr({ type: 'duoreader_importer', action: 'pause' });
    logger.info(LOG, 'Pause requested');
    await refreshProgress();
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
      if (!progress.value.running && !progress.value.paused && pollTimer) {
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
    await loadBooks({ enrichCovers: false });
    chrome.storage.onChanged.addListener(onStorageChanged);
    if (progress.value.running) startPolling();
    else if (progress.value.paused) startPolling();
  });

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
    revokeDisplayBlobs();
    chrome.storage.onChanged.removeListener(onStorageChanged);
  });

  return {
    myLang,
    learnLang,
    maxBooks,
    enableAudio,
    useCdnApi,
    enrichCoversFromSearch,
    forceReplaceUpload,
    apiBaseUrl,
    books,
    progress,
    loadingBooks,
    testingApi,
    apiTestResult,
    error,
    loadBooks,
    testApi,
    startOrResumeImport,
    pauseImport,
    stopImport,
    refreshApiBase: syncApiEndpoint,
  };
}
