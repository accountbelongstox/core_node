/**
 * Shared reactive Laravel API base URL for all popup panels.
 * ApiManager follows `api_settings` in every context; this ref mirrors it.
 */

import { ref } from 'vue';
import { apiManager, getApiBase } from '@/services/ApiManager';

/** Module-level ref — every useApiEndpoint() consumer shares the same value (no trailing slash). */
const apiBaseUrl = ref('');

let globalSyncReady = false;

export async function syncApiEndpoint(): Promise<string> {
  await apiManager.initialize({ autoDetect: false });
  apiBaseUrl.value = getApiBase();
  return apiBaseUrl.value;
}

function ensureGlobalSync(): void {
  if (globalSyncReady) return;
  globalSyncReady = true;

  apiManager.onEndpointChange(() => {
    apiBaseUrl.value = getApiBase();
  });

  void syncApiEndpoint();
}

export function useApiEndpoint() {
  ensureGlobalSync();

  return {
    apiBaseUrl,
    syncApiEndpoint,
  };
}
