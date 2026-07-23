import { computed, ref } from 'vue';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { clearModelCache, cleanupModelCache, getCacheStats } from '@/utils/semantic-similarity-engine';
import { getMessage } from '@/utils/i18n';

interface StorageStats {
  indexedPages: number;
  totalDocuments: number;
  totalTabs: number;
  indexSize: number;
  isInitialized: boolean;
}

type CacheStats = Awaited<ReturnType<typeof getCacheStats>>;

const EMPTY_STORAGE_STATS: StorageStats = {
  indexedPages: 0,
  totalDocuments: 0,
  totalTabs: 0,
  indexSize: 0,
  isInitialized: false,
};
const storageStats = ref<StorageStats>({ ...EMPTY_STORAGE_STATS });
const cacheStats = ref<CacheStats | null>(null);
const isRefreshingStats = ref(false);
const isManagingCache = ref(false);
const isClearingData = ref(false);
const showClearConfirmation = ref(false);
const clearDataProgress = ref('');
const formattedIndexSize = computed(() => {
  const sizeInMb = storageStats.value.indexSize / (1024 * 1024);
  return `${sizeInMb < 10 ? sizeInMb.toFixed(1) : Math.round(sizeInMb)} MB`;
});

export function useDataManagement() {
  const refreshStorageStats = async () => {
    if (isRefreshingStats.value) return;
    isRefreshingStats.value = true;
    try {
      const response = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.GET_STORAGE_STATS,
      });
      storageStats.value = response?.success
        ? { ...EMPTY_STORAGE_STATS, ...response.stats }
        : { ...EMPTY_STORAGE_STATS };
    } catch (error) {
      storageStats.value = { ...EMPTY_STORAGE_STATS };
      console.error('[DataManagement] Failed to load storage statistics:', error);
    } finally {
      isRefreshingStats.value = false;
    }
  };

  const loadCacheStats = async () => {
    try {
      cacheStats.value = await getCacheStats();
    } catch (error) {
      cacheStats.value = null;
      console.error('[DataManagement] Failed to load cache statistics:', error);
    }
  };

  const manageCache = async (operation: () => Promise<void>) => {
    if (isManagingCache.value) return;
    isManagingCache.value = true;
    try {
      await operation();
      await loadCacheStats();
    } finally {
      isManagingCache.value = false;
    }
  };

  const cleanupCache = () => manageCache(cleanupModelCache);
  const clearAllCache = () => manageCache(clearModelCache);
  const hideClearDataConfirmation = () => {
    showClearConfirmation.value = false;
  };

  const clearAllData = async () => {
    if (isClearingData.value) return;
    isClearingData.value = true;
    clearDataProgress.value = getMessage('clearingStatus');
    try {
      const response = await chrome.runtime.sendMessage({
        type: BACKGROUND_MESSAGE_TYPES.CLEAR_ALL_DATA,
      });
      if (!response?.success) throw new Error(response?.error || 'Failed to clear data');
      clearDataProgress.value = getMessage('dataClearedNotification');
      await refreshStorageStats();
      window.setTimeout(() => {
        clearDataProgress.value = '';
        hideClearDataConfirmation();
      }, 2000);
    } catch (error) {
      clearDataProgress.value = error instanceof Error ? error.message : String(error);
    } finally {
      isClearingData.value = false;
    }
  };

  const initialize = () => Promise.all([refreshStorageStats(), loadCacheStats()]);

  return {
    storageStats,
    cacheStats,
    isRefreshingStats,
    isManagingCache,
    isClearingData,
    showClearConfirmation,
    clearDataProgress,
    formattedIndexSize,
    initialize,
    refreshStorageStats,
    cleanupCache,
    clearAllCache,
    clearAllData,
    hideClearDataConfirmation,
  };
}
