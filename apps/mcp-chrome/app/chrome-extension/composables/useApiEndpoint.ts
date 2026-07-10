/**
 * Shared reactive Laravel API base URL for all popup panels.
 * Stays in sync with the header EndpointDropdown via ApiManager + storage.
 */

import { ref } from 'vue';
import { apiManager } from '@/services/ApiManager';

const API_SETTINGS_KEY = 'api_settings';
const APP_SETTINGS_KEY = 'appSettings';

/** Module-level ref — every useApiEndpoint() consumer shares the same value. */
const apiBaseUrl = ref('');

let globalSyncReady = false;

export async function syncApiEndpoint(): Promise<string> {
  await apiManager.initialize({ autoDetect: false });
  const url = apiManager.getCurrentBaseUrl();
  apiBaseUrl.value = url;
  return url;
}

function ensureGlobalSync(): void {
  if (globalSyncReady) return;
  globalSyncReady = true;

  apiManager.onEndpointChange(() => {
    apiBaseUrl.value = apiManager.getCurrentBaseUrl();
  });

  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[API_SETTINGS_KEY] || changes[APP_SETTINGS_KEY]) {
        void syncApiEndpoint();
      }
    });
  }

  void syncApiEndpoint();
}

export function useApiEndpoint() {
  ensureGlobalSync();

  const apiBaseNormalized = (): string => apiBaseUrl.value.replace(/\/+$/, '');

  return {
    apiBaseUrl,
    syncApiEndpoint,
    apiBaseNormalized,
  };
}
