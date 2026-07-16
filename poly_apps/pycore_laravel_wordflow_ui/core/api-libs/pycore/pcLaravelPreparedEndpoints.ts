/**
 * UI-side prepared Laravel API endpoints for pycore-manager.
 *
 * Mirrors pycore `laravel_endpoint_manager._BASE_DEFAULTS` +
 * `_NAMED_DEFAULTS` (all on :9000). Used read-only when pycore (:59000) is
 * offline so the switcher still lists known backends; probe/select/add still
 * require the live `laravel_api.*` RPCs.
 *
 * Keep in sync with:
 *   pycore/callmodule/services/sync/laravel_endpoint_manager.py
 */
import type { LaravelApiEndpoint } from './PycoreLaravelApi';

/** Laravel Octane port — independent of the FE shell port (:13054). */
export const LARAVEL_API_PORT = 9000;

/**
 * Loopback + named cross-machine hosts, same seed order as pycore.
 * `localhost` is omitted — pycore normalizes it to 127.0.0.1.
 */
export const PC_LARAVEL_PREPARED_HOSTS: readonly string[] = [
  '127.0.0.1',
  '100.101.149.39',
  '43.163.112.77',
  '100.106.85.16',
];

/** Normalize a Laravel base URL (scheme, no trailing slash, localhost → 127.0.0.1). */
export function normalizeLaravelApiUrl(url: string): string {
  let u = (url || '').trim();
  if (!u) return '';
  if (!u.startsWith('http://') && !u.startsWith('https://')) u = `http://${u}`;
  u = u.replace(/\/+$/, '');
  u = u.replace(/^https?:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
  return u;
}

/**
 * Read-only prepared endpoint rows for the pycore-manager switcher when RPC is
 * down. Order: current page host (:9000), then the shared seed hosts above.
 */
export function buildPcPreparedLaravelEndpoints(): LaravelApiEndpoint[] {
  const urls: string[] = [];
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const proto = window.location.protocol === 'https:' ? 'https' : 'http';
    urls.push(`${proto}://${window.location.hostname}:${LARAVEL_API_PORT}`);
  }
  for (const host of PC_LARAVEL_PREPARED_HOSTS) {
    urls.push(`http://${host}:${LARAVEL_API_PORT}`);
  }
  const seen = new Set<string>();
  const out: LaravelApiEndpoint[] = [];
  for (const u of urls) {
    const n = normalizeLaravelApiUrl(u);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push({ url: n, healthy: null, custom: false });
  }
  return out;
}
