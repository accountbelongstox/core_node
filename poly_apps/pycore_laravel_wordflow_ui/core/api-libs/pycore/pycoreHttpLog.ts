/**
 * pycoreHttpLog - global in-memory ring buffer of HTTP/RPC request records for
 * the pycore-manager HTTP debugger (PcHttpDebugger). Holds BOTH directions:
 *
 *   - direction 'pycore': FE -> pycore requests. Instrumented at the two FE
 *     choke points: PycoreWs.callRpc (WS RPC, incl. the local_http.* bridge +
 *     direct live-test routes) and PycoreApi.PycoreMasterClient.request (HTTP
 *     fallback + multipart uploads). WS-connected calls go through callRpc only;
 *     HTTP-only through MasterClient only - no double-count on a single path.
 *   - direction 'laravel': pycore -> Laravel requests. Relayed from the backend
 *     'laravel_http' WS event (LaravelHttpRecorder -> rpc_v2 broadcast) by
 *     PcLiveContext, which calls appendHttpDebug on each event.
 *
 * Framework-free pub/sub ring (mirrors logstore/logStore.ts), capped at the last
 * MAX entries. Not persisted. useSyncExternalStore-friendly.
 */
export type HttpDirection = 'pycore' | 'laravel';

export interface HttpDebugRecord {
  id: number;
  /** Epoch ms. */
  ts: number;
  direction: HttpDirection;
  /** HTTP verb (GET/POST/...) or 'RPC' for direct WS routes. */
  method: string;
  /** RPC route (e.g. 'local_http.get', 'local.tts.test') when via WS. */
  route?: string;
  /** URL path (no host). For WS local_http.* this is params.path. */
  path: string;
  /** Full URL when available (HTTP path / laravel url). */
  fullUrl?: string;
  /** Compact params/body summary (long strings + base64 truncated). */
  paramsSummary: string;
  /** HTTP status (0 = transport error / RPC rejection). */
  status: number;
  /** Round-trip duration (ms). */
  ms: number;
  error?: string | null;
}

export const MAX_HTTP_ENTRIES = 500;

let nextId = 1;
let entries: HttpDebugRecord[] = [];
const listeners = new Set<() => void>();

/** Snapshot for useSyncExternalStore - stable reference between appends. */
export function getHttpDebugEntries(): HttpDebugRecord[] {
  return entries;
}

export function subscribeHttpDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function appendHttpDebug(rec: Omit<HttpDebugRecord, 'id' | 'ts'>): void {
  // Replace (not mutate) so React snapshot comparison sees a change.
  const next = entries.length >= MAX_HTTP_ENTRIES
    ? entries.slice(entries.length - MAX_HTTP_ENTRIES + 1)
    : entries.slice();
  next.push({ id: nextId++, ts: Date.now(), ...rec });
  entries = next;
  listeners.forEach((l) => l());
}

export function clearHttpDebug(): void {
  entries = [];
  listeners.forEach((l) => l());
}

/**
 * Compact a params/body value into a short string for the debugger. Long strings
 * (base64 payloads, big bodies) are truncated BEFORE stringify so a megabyte
 * upload never becomes a megabyte string first.
 */
export function summarizeHttpParams(value: unknown): string {
  if (value == null) return '';
  if (typeof FormData !== 'undefined' && value instanceof FormData) return '[FormData]';
  try {
    const s = JSON.stringify(value, (_k, v) =>
      typeof v === 'string' && v.length > 120 ? v.slice(0, 120) + '…' : v,
    );
    return s.length > 240 ? s.slice(0, 240) + '…' : s;
  } catch {
    return String(value).slice(0, 240);
  }
}

/** Map an rpc_v2 route to an HTTP verb label for the debugger (local_http.* bridge). */
export function rpcRouteToHttpMethod(route: string): string {
  if (route === 'local_http.get' || route === 'local_http.blob') return 'GET';
  if (route === 'local_http.post') return 'POST';
  if (route === 'local_http.delete') return 'DELETE';
  return 'RPC';
}
