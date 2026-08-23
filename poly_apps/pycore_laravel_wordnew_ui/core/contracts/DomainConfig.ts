/**
 * Runtime web access configuration.
 *
 * The shell domain setup (scripts/shells/linux/common/domain_setup_common.sh)
 * writes this JSON into the shared data directory
 * (<core_node_data_dir>/global_var/<files.web_access_config>); the Vite
 * dev/preview middleware serves it same-origin at /<file name>, re-read from
 * disk on every request, so a shell-side change is visible to the frontend
 * immediately. A missing/unreadable file keeps the built-in defaults, so
 * plain dev machines and compiled bundles work without the file.
 */
import {
  DEFAULT_API_REGION_PREFIX,
  SERVICE_CONTRACT_HOSTS,
  SERVICE_CONTRACT_ROOT_DOMAINS,
  SERVICE_CONTRACT_SERVICE_HOST_KEYS,
  WEB_ACCESS_CONFIG_FILE_NAME,
} from './ServiceContract';

export interface WebAccessConfig {
  apiRegionPrefix: string;
  domains: string[];
  hosts: Record<string, string>;
  serviceHostKeys: {
    browserAccess: string[];
    laravelApi: string[];
    pycore: string[];
  };
  allowedHosts: string[];
  corsOrigins: string[];
}

export const DEFAULT_WEB_ACCESS_CONFIG: WebAccessConfig = {
  apiRegionPrefix: DEFAULT_API_REGION_PREFIX,
  domains: [...SERVICE_CONTRACT_ROOT_DOMAINS],
  hosts: { ...SERVICE_CONTRACT_HOSTS },
  serviceHostKeys: {
    browserAccess: [...SERVICE_CONTRACT_SERVICE_HOST_KEYS.browserAccess],
    laravelApi: [...SERVICE_CONTRACT_SERVICE_HOST_KEYS.laravelApi],
    pycore: [...SERVICE_CONTRACT_SERVICE_HOST_KEYS.pycore],
  },
  allowedHosts: [],
  corsOrigins: [],
};

const API_REGION_PREFIX_PATTERN = /^[a-z0-9][a-z0-9-]{0,30}$/;

let currentConfig: WebAccessConfig = DEFAULT_WEB_ACCESS_CONFIG;
let loadPromise: Promise<WebAccessConfig> | null = null;

/** Synchronous read of the last loaded config (defaults until the first load). */
export function getApiRegionPrefix(): string {
  return currentConfig.apiRegionPrefix;
}

export function getWebAccessConfig(): Readonly<WebAccessConfig> {
  return currentConfig;
}

export function resolveApiHostname(hostname: string): string {
  const prefix = getApiRegionPrefix().toLowerCase();
  const normalizedHost = hostname.trim().toLowerCase().replace(/\.$/, '');
  const withoutWww = normalizedHost.replace(/^www\./, '');
  const hasApiPrefix = withoutWww.startsWith('api.');
  const apiRemainder = hasApiPrefix ? withoutWww.slice(4) : withoutWww;
  const duplicateRegionPrefix = `${prefix}.${prefix}.`;
  const canonicalRemainder = apiRemainder.startsWith(duplicateRegionPrefix)
    ? apiRemainder.slice(prefix.length + 1)
    : apiRemainder;

  if (hasApiPrefix) {
    return `api.${canonicalRemainder}`;
  }

  const apex = canonicalRemainder.startsWith(`${prefix}.`)
    ? canonicalRemainder.slice(prefix.length + 1)
    : canonicalRemainder;

  return `api.${prefix}.${apex}`;
}

/**
 * Fetch the shell-written domain config same-origin and update the cache.
 * Single-flight while a load is in progress; every settled call may re-fetch,
 * so detection passes always see the latest shell-side value. Any failure
 * (missing file, non-JSON, offline) keeps the current/default config.
 */
export function loadWebAccessConfig(): Promise<WebAccessConfig> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const response = await fetch(`/${WEB_ACCESS_CONFIG_FILE_NAME}`, { cache: 'no-store' });
      if (response.ok) {
        const parsed: unknown = await response.json();
        const document = parsed as Partial<WebAccessConfig> | null;
        const prefix = document?.apiRegionPrefix;
        const hosts = document?.hosts;
        const lists = [
          document?.domains,
          document?.allowedHosts,
          document?.corsOrigins,
          document?.serviceHostKeys?.browserAccess,
          document?.serviceHostKeys?.laravelApi,
          document?.serviceHostKeys?.pycore,
        ];
        if (typeof prefix === 'string'
          && API_REGION_PREFIX_PATTERN.test(prefix.trim())
          && hosts !== null
          && typeof hosts === 'object'
          && Object.values(hosts).every((value) => typeof value === 'string' && value.length > 0)
          && lists.every((list) => Array.isArray(list)
            && list.every((value) => typeof value === 'string' && value.length > 0))
          && [
            document?.serviceHostKeys?.browserAccess,
            document?.serviceHostKeys?.laravelApi,
            document?.serviceHostKeys?.pycore,
          ].every((keys) => keys!.every((key) => typeof hosts![key] === 'string'))) {
          currentConfig = {
            apiRegionPrefix: prefix.trim(),
            domains: document!.domains!,
            hosts: document!.hosts!,
            serviceHostKeys: document!.serviceHostKeys!,
            allowedHosts: document!.allowedHosts!,
            corsOrigins: document!.corsOrigins!,
          };
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
