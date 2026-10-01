/**
 * The Laravel routes that need the client-key (K3) signature: Laravel's own route table
 * (`client_key_auth.routes_endpoint`, derived from the live routes incl. controller middleware), loaded once per
 * selected endpoint over the shared HTTP transport, revalidated with its ETag, and kept per endpoint in this
 * browser so a later start can sign at once. Paths are Laravel templates (`{param}` is one segment).
 *
 * Until a table exists (first load in flight, or failed with nothing cached) every request of a build that holds
 * a key is signed at once, without waiting for the fetch, so a route that needs the signature never goes out
 * without it and no request is delayed.
 */
import { CLIENT_KEY_AUTH } from '../../contracts/ServiceContract';
import { protocolFetch } from '../../network/ProtocolFetch';
import { StorageManager } from '../../persistence';
import { LaravelStorageKeys } from './LaravelStorageKeys';

const API_SEGMENT = '/api/';
const FETCH_TIMEOUT_MS = 3_000;
const RETRY_AFTER_FAILURE_MS = 60_000;
const REVALIDATE_AFTER_MS = 5 * 60_000;
const HTTP_NOT_MODIFIED = 304;

interface RouteEntry {
  method: string;
  path: string;
  auth: string;
}

interface StoredTable {
  etag: string;
  entries: RouteEntry[];
}

interface LoadedTable {
  etag: string;
  routes: Array<{ method: string; pattern: RegExp }>;
  nextCheckAt: number;
  loading: Promise<void> | null;
}

const tables = new Map<string, LoadedTable>();

function compile(entries: RouteEntry[]): LoadedTable['routes'] {
  return entries.map((entry) => ({
    method: entry.method.toUpperCase(),
    pattern: new RegExp(`^/?${entry.path.replace(/^\//, '').replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}/?$`),
  }));
}

function readStored(apiRoot: string): StoredTable | null {
  const all = StorageManager.get<Record<string, StoredTable> | null>(LaravelStorageKeys.CLIENT_KEY_ROUTES, null);
  const stored = all?.[apiRoot];
  return stored && Array.isArray(stored.entries) ? stored : null;
}

function writeStored(apiRoot: string, table: StoredTable): void {
  const all = StorageManager.get<Record<string, StoredTable> | null>(LaravelStorageKeys.CLIENT_KEY_ROUTES, null) ?? {};
  StorageManager.set(LaravelStorageKeys.CLIENT_KEY_ROUTES, { ...all, [apiRoot]: table });
}

/** One conditional GET of the route table; a failure keeps the table that is held (or none). */
async function revalidate(apiRoot: string, table: LoadedTable): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await protocolFetch(`${apiRoot}${CLIENT_KEY_AUTH.routes_endpoint}`, {
      headers: { Accept: 'application/json', ...(table.etag ? { 'If-None-Match': table.etag } : {}) },
      signal: controller.signal,
    });
    if (response.status === HTTP_NOT_MODIFIED) {
      table.nextCheckAt = Date.now() + REVALIDATE_AFTER_MS;
      return;
    }
    const body = response.ok ? await response.json() : null;
    const entries: unknown = body?.data?.client_key_routes;
    if (!Array.isArray(entries)) throw new Error('client_key_routes_invalid');
    table.etag = response.headers.get('ETag') ?? '';
    table.routes = compile(entries as RouteEntry[]);
    table.nextCheckAt = Date.now() + REVALIDATE_AFTER_MS;
    writeStored(apiRoot, { etag: table.etag, entries: entries as RouteEntry[] });
  } catch {
    table.nextCheckAt = Date.now() + RETRY_AFTER_FAILURE_MS;
  } finally {
    clearTimeout(timer);
  }
}

/** The table of one endpoint: the stored copy answers at once (and revalidates behind); with none there is no answer yet. */
function tableOf(apiRoot: string): LoadedTable | null {
  let table = tables.get(apiRoot);
  if (!table) {
    const stored = readStored(apiRoot);
    table = { etag: stored?.etag ?? '', routes: stored ? compile(stored.entries) : [], nextCheckAt: 0, loading: null };
    tables.set(apiRoot, table);
  }
  const held = table;
  if (Date.now() >= held.nextCheckAt && !held.loading) {
    held.loading = revalidate(apiRoot, held).finally(() => { held.loading = null; });
  }
  return held.routes.length > 0 ? held : null;
}

/** The API root (origin plus any mount prefix) of a request URL: everything before `/api/`. */
function apiRootOf(url: URL): string {
  const at = url.pathname.indexOf(API_SEGMENT);
  return `${url.origin}${at > 0 ? url.pathname.slice(0, at) : ''}`;
}

/** True when Laravel requires the signature (or a session) for this request, or when its table is unknown. */
export function requiresClientKey(method: string, url: URL): boolean {
  const at = url.pathname.indexOf(API_SEGMENT);
  const path = at >= 0 ? url.pathname.slice(at) : url.pathname;
  // The table itself is public; asking for it must not wait for itself.
  if (path === CLIENT_KEY_AUTH.routes_endpoint) return false;
  const table = tableOf(apiRootOf(url));
  if (!table) return true;
  // Laravel serves HEAD from its GET routes.
  const verb = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  return table.routes.some((route) => route.method === verb && route.pattern.test(path));
}
