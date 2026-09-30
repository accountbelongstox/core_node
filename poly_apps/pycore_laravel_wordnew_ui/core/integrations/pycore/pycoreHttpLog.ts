/**
 * pycoreHttpLog - global in-memory ring of HTTP request records for shared
 * HTTP diagnostics consumers (both directions: FE -> pycore and pycore ->
 * Laravel relayed from the backend 'laravel_http' event).
 */
import { RingStore } from '../../events/RingStore';

export type HttpDirection = 'pycore' | 'laravel';

export interface HttpDebugRecord {
  id: number;
  /** Epoch ms. */
  ts: number;
  direction: HttpDirection;
  /** HTTP verb used by the request. */
  method: string;
  /** Named HTTP controller route. */
  route?: string;
  /** Optional legacy router path carried as HTTP params. */
  path: string;
  /** Full URL when available (HTTP path / laravel url). */
  fullUrl?: string;
  /** Compact params/body summary (long strings + base64 truncated). */
  paramsSummary: string;
  /** HTTP status (0 = transport error / HTTP rejection). */
  status: number;
  /** Round-trip duration (ms). */
  ms: number;
  error?: string | null;
  transport?: string;
  httpVersion?: string;
  progress?: number;
  transferredBytes?: number;
  totalBytes?: number;
  transferId?: string;
  phase?: string;
}

export const MAX_HTTP_ENTRIES = 500;

let nextId = 1;
const ring = new RingStore<HttpDebugRecord>({ capacity: MAX_HTTP_ENTRIES });

/** Snapshot for useSyncExternalStore - stable reference between appends. */
export function getHttpDebugEntries(): HttpDebugRecord[] {
  return ring.getSnapshot();
}

export function subscribeHttpDebug(listener: () => void): () => void {
  return ring.subscribe(listener);
}

export function appendHttpDebug(rec: Omit<HttpDebugRecord, 'id' | 'ts'>): void {
  ring.append({ id: nextId++, ts: Date.now(), ...rec });
}

export function clearHttpDebug(): void {
  ring.clear();
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
    const s = JSON.stringify(value, (key, item) => {
      if (/password|token|authorization|credential|secret/i.test(key)) return '<redacted>';
      return typeof item === 'string' && item.length > 120 ? item.slice(0, 120) + '…' : item;
    });
    return s.length > 240 ? s.slice(0, 240) + '…' : s;
  } catch {
    return String(value).slice(0, 240);
  }
}
