/**
 * Runtime UI domain configuration.
 *
 * The shell domain setup (scripts/shells/linux/common/domain_setup_common.sh)
 * writes this JSON into the shared data directory
 * (<core_node_data_dir>/global_var/<files.ui_domain_config>); the Vite
 * dev/preview middleware serves it same-origin at /<file name>, re-read from
 * disk on every request, so a shell-side change is visible to the frontend
 * immediately. A missing/unreadable file keeps the built-in defaults, so
 * plain dev machines and compiled bundles work without the file.
 */
import { UI_DOMAIN_CONFIG_FILE_NAME } from './ServiceContract';

export interface UiDomainConfig {
  apiRegionPrefix: string;
}

export const DEFAULT_UI_DOMAIN_CONFIG: UiDomainConfig = {
  apiRegionPrefix: 'si',
};

const API_REGION_PREFIX_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}$/;

let currentConfig: UiDomainConfig = DEFAULT_UI_DOMAIN_CONFIG;
let loadPromise: Promise<UiDomainConfig> | null = null;

/** Synchronous read of the last loaded config (defaults until the first load). */
export function getApiRegionPrefix(): string {
  return currentConfig.apiRegionPrefix;
}

/**
 * Fetch the shell-written domain config same-origin and update the cache.
 * Single-flight while a load is in progress; every settled call may re-fetch,
 * so detection passes always see the latest shell-side value. Any failure
 * (missing file, non-JSON, offline) keeps the current/default config.
 */
export function loadDomainConfig(): Promise<UiDomainConfig> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const response = await fetch(`/${UI_DOMAIN_CONFIG_FILE_NAME}`, { cache: 'no-store' });
      if (response.ok) {
        const parsed: unknown = await response.json();
        const prefix = (parsed as Partial<UiDomainConfig> | null)?.apiRegionPrefix;
        if (typeof prefix === 'string' && API_REGION_PREFIX_PATTERN.test(prefix.trim())) {
          currentConfig = { apiRegionPrefix: prefix.trim() };
        }
      }
    } catch {
      // Missing endpoint or file: keep the current/default config.
    }
    return currentConfig;
  })().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}
