/**
 * Web search popup composable.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { usePersistedRef } from '@/composables/usePersistedRef';
import { logger } from '@/utils/logger';
import { sendWithWake } from '@/utils/sendWithWake';
import { getMessage } from '@/utils/i18n';
import { IntervalController } from '@/utils/async';
import { toErrorMessage } from '@/utils/errors';
import {
  WEB_SEARCH_LAST_VERIFIED,
  type WebSearchEngine,
  type WebSearchMode,
  type WebSearchProgress,
  type WebSearchResult,
  emptyWebSearchProgress,
} from '@/utils/web-search-core';

const LOG = 'Web Search UI';

type WebSearchResponse<T> = T & { success?: boolean; error?: string };

const sendSearch = <T>(payload: Record<string, unknown>): Promise<WebSearchResponse<T>> =>
  sendWithWake(() => chrome.runtime.sendMessage(payload), LOG);

export function useWebSearch() {
  const query = usePersistedRef('webSearchQuery', 'Pride and Prejudice book cover');
  const engine = usePersistedRef<WebSearchEngine>('webSearchEngine', 'bing');
  const mode = usePersistedRef<WebSearchMode>('webSearchMode', 'images');
  const waitForVerification = usePersistedRef('webSearchWaitVerify', true);
  const maxResults = usePersistedRef('webSearchMaxResults', 10);

  const loading = ref(false);
  const error = ref('');
  const result = ref<WebSearchResult | null>(null);
  const progress = ref<WebSearchProgress>(emptyWebSearchProgress());

  const progressPolling = new IntervalController();

  const refreshProgress = async () => {
    const res = await sendSearch<{ progress?: WebSearchProgress }>({
      type: 'web_search',
      action: 'get_status',
    });
    if (res?.progress) {
      progress.value = { ...emptyWebSearchProgress(), ...res.progress };
    }
  };

  const runSearch = async () => {
    loading.value = true;
    error.value = '';
    result.value = null;
    try {
      const res = await sendSearch<{ result?: WebSearchResult }>({
        type: 'web_search',
        action: 'search',
        request: {
          query: query.value.trim(),
          engine: engine.value,
          mode: mode.value,
          maxResults: maxResults.value,
          waitForVerification: waitForVerification.value,
          verificationTimeoutMs: 120_000,
          openInNewTab: false,
        },
      });
      result.value = res?.result || null;
      if (!res?.success && result.value?.status !== 'verification_required') {
        error.value = res?.error || result.value?.message || getMessage('searchFailed');
      }
      logger.info(LOG, `Search ${result.value?.status} · ${result.value?.imageResults?.length || 0} images`);
    } catch (e: unknown) {
      error.value = toErrorMessage(e) || getMessage('searchFailed');
      logger.error(LOG, error.value, e);
    } finally {
      loading.value = false;
      await refreshProgress();
    }
  };

  onMounted(() => {
    void refreshProgress();
    progressPolling.start(() => {
      if (loading.value || progress.value.running) void refreshProgress();
    }, 1500);
  });

  onUnmounted(() => {
    progressPolling.stop();
  });

  return {
    query,
    engine,
    mode,
    waitForVerification,
    maxResults,
    loading,
    error,
    result,
    progress,
    lastVerified: WEB_SEARCH_LAST_VERIFIED,
    runSearch,
    refreshProgress,
  };
}
