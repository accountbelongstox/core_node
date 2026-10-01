/** Shared browser/WebView/Cronet HTTP transport and protocol observer. */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeAppShell } from './NativeShell';
import { RingStore } from '../events/RingStore';
import { TRANSFER_IDLE_MS } from './IdleWatchdog';


export const HTTP_TRANSPORT_POLICY = Object.freeze({
  secureScheme: 'https:',
  preferredProtocol: 'h3',
  fallbackProtocols: ['h2', 'http/1.1'] as const,
  earlyHintsStatus: 103,
  capacitorRuntime: 'cronet-or-chromium-webview',
});

export interface HttpProtocolObservation {
  url: string;
  method: string;
  status: number;
  secure: boolean;
  nextHopProtocol: string;
  transport: 'browser' | 'capacitor-webview' | 'capacitor-cronet';
  earlyHints: 'transport-managed';
  wasCached?: boolean;
  observedAt: number;
}

interface NativeProtocolHttpResponse {
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  bodyBase64: string;
  protocol: string;
  wasCached: boolean;
  redirects: number;
}

interface NativeProtocolHttpPlugin {
  request(options: {
    requestId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    bodyBase64: string;
    sendCookies: boolean;
    /** Cancels the request after this long without a byte (no total deadline); 0 disables. */
    idleTimeoutMs: number;
  }): Promise<NativeProtocolHttpResponse>;
  cancel(options: { requestId: string }): Promise<void>;
  download(options: { requestId: string; url: string; path: string; idleTimeoutMs: number }): Promise<{ status: number; protocol: string; bytes?: number }>;
  addListener(
    event: 'downloadProgress',
    handler: (progress: { requestId: string; bytes: number; total: number }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  bundle(options: {
    requestId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    bodyBase64: string;
    sendCookies: boolean;
    idleTimeoutMs: number;
    folder: string;
    names: string[];
  }): Promise<{ status: number; protocol: string; entries: NativeBundleEntry[] }>;
}

/** One frame header of a clip bundle written to disk by the native app. */
export interface NativeBundleEntry {
  index: number;
  key: string;
  hit: boolean;
  bytes: number;
  sent: boolean;
  meaning: string;
  /** The clip is now at `folder/names[index]`. */
  written: boolean;
}

export interface NativeBundleRequest {
  url: string;
  headers: Record<string, string>;
  /** JSON request body. */
  body: unknown;
  /** Absolute folder the clips are written to. */
  folder: string;
  /** File name per request item (index-aligned). */
  names: string[];
  signal?: AbortSignal;
}

const MAX_PROTOCOL_OBSERVATIONS = 200;
const observationListeners = new Set<(observation: HttpProtocolObservation) => void>();
const observationRing = new RingStore<HttpProtocolObservation>({
  capacity: MAX_PROTOCOL_OBSERVATIONS,
  onAppend: (observation) => observationListeners.forEach((listener) => listener(observation)),
});
const nativeProtocolHttp = registerPlugin<NativeProtocolHttpPlugin>('ProtocolHttp');

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function absoluteRequestUrl(input: RequestInfo | URL): string {
  const value = requestUrl(input);
  const base = typeof location === 'undefined' ? undefined : location.href;
  return new URL(value, base).toString();
}

function nativeCronetAvailable(): boolean {
  try {
    return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ProtocolHttp');
  } catch {
    return false;
  }
}

function observedNextHopProtocol(url: string): string {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return '';
  const entries = performance.getEntriesByName(url, 'resource') as PerformanceResourceTiming[];
  return entries.length > 0 ? String(entries[entries.length - 1].nextHopProtocol || '') : '';
}

function publishObservation(observation: HttpProtocolObservation): void {
  observationRing.append(observation);
}

function recordBrowserProtocol(input: RequestInfo | URL, init: RequestInit | undefined, response: Response): void {
  const originalUrl = requestUrl(input);
  const responseUrl = response.url || originalUrl;
  publishObservation({
    url: responseUrl,
    method: String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase(),
    status: response.status,
    secure: responseUrl.startsWith(HTTP_TRANSPORT_POLICY.secureScheme),
    nextHopProtocol: observedNextHopProtocol(responseUrl) || observedNextHopProtocol(originalUrl),
    transport: isNativeAppShell() ? 'capacitor-webview' : 'browser',
    earlyHints: 'transport-managed',
    observedAt: Date.now(),
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function sendsCookies(request: Request): boolean {
  if (request.credentials === 'include') return true;
  if (request.credentials === 'omit' || typeof location === 'undefined') return false;
  return new URL(request.url).origin === location.origin;
}

const PRIVATE_LAN_HTTP_RE = /^http:\/\/(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}(:\d+)?\//i;

/**
 * Plain http to a LAN machine (e.g. pycore :59000, which has no TLS): the
 * WebView would block it from the https app page (mixed content) - the native
 * stack carries it (cleartext is permitted by the app's network security config).
 */
function isPrivateLanHttp(url: string): boolean {
  return PRIVATE_LAN_HTTP_RE.test(url);
}

function isEventStream(request: Request): boolean {
  return String(request.headers.get('accept') || '').toLowerCase().includes('text/event-stream');
}

function requestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nativeErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  return String((error as { code?: unknown }).code || '');
}

async function nativeCronetFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = absoluteRequestUrl(input);
  const request = input instanceof Request
    ? new Request(input, init)
    : new Request(url, init);
  const id = requestId();
  const method = request.method.toUpperCase();
  const bodyBytes = method === 'GET' || method === 'HEAD'
    ? new Uint8Array(0)
    : new Uint8Array(await request.clone().arrayBuffer());
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });
  if (request.signal.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const abort = (): void => {
    void nativeProtocolHttp.cancel({ requestId: id });
  };
  request.signal.addEventListener('abort', abort, { once: true });
  try {
    const result = await nativeProtocolHttp.request({
      requestId: id,
      url: request.url,
      method,
      headers,
      bodyBase64: bytesToBase64(bodyBytes),
      sendCookies: sendsCookies(request),
      idleTimeoutMs: TRANSFER_IDLE_MS,
    }).catch((error: unknown) => {
      throw nativeErrorCode(error) === 'STALLED' ? new DOMException('The transfer stalled.', 'TimeoutError') : error;
    });
    const responseBody = method === 'HEAD' || [204, 205, 304].includes(result.status)
      ? null
      : new Uint8Array(base64ToBytes(result.bodyBase64));
    const response = new Response(responseBody, {
      status: result.status,
      statusText: result.statusText,
      headers: result.headers,
    });
    try {
      Object.defineProperty(response, 'url', { configurable: true, value: result.url || request.url });
      Object.defineProperty(response, 'redirected', { configurable: true, value: result.redirects > 0 });
    } catch {
      // Response metadata remains observable through the shared protocol log.
    }
    publishObservation({
      url: result.url || request.url,
      method,
      status: result.status,
      secure: request.url.startsWith(HTTP_TRANSPORT_POLICY.secureScheme),
      nextHopProtocol: String(result.protocol || ''),
      transport: 'capacitor-cronet',
      earlyHints: 'transport-managed',
      wasCached: Boolean(result.wasCached),
      observedAt: Date.now(),
    });
    return response;
  } finally {
    request.signal.removeEventListener('abort', abort);
  }
}

/**
 * Use native Cronet for Android HTTPS API calls (and plain http to LAN
 * machines) and the user-agent stack for browser traffic and streaming responses. Both transports process 103 Early
 * Hints internally; only the final response is exposed to application code.
 */
/** The native app can download clip bundles straight to disk (Android Cronet plugin). */
export function nativeBundleAvailable(): boolean {
  return nativeCronetAvailable();
}

/**
 * POST a clip bundle request and let the native stack write every sent clip
 * to `folder/names[index]` while the response streams in (no clip byte crosses
 * the WebView bridge). Resolves with the HTTP status and the frame headers.
 */
export async function nativeBundleToFolder(request: NativeBundleRequest): Promise<{ status: number; protocol: string; entries: NativeBundleEntry[] }> {
  if (request.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const id = requestId();
  const abort = (): void => { void nativeProtocolHttp.cancel({ requestId: id }); };
  request.signal?.addEventListener('abort', abort, { once: true });
  try {
    const result = await nativeProtocolHttp.bundle({
      requestId: id,
      url: request.url,
      method: 'POST',
      headers: { 'content-type': 'application/json', ...request.headers },
      bodyBase64: bytesToBase64(new TextEncoder().encode(JSON.stringify(request.body ?? {}))),
      sendCookies: false,
      idleTimeoutMs: TRANSFER_IDLE_MS,
      folder: request.folder,
      names: request.names,
    });
    return { status: result.status, protocol: result.protocol, entries: Array.isArray(result.entries) ? result.entries : [] };
  } catch (error) {
    if (nativeErrorCode(error) === 'ABORTED') throw new DOMException('The operation was aborted.', 'AbortError');
    if (nativeErrorCode(error) === 'STALLED') throw new DOMException('The transfer stalled.', 'TimeoutError');
    throw error;
  } finally {
    request.signal?.removeEventListener('abort', abort);
  }
}

export interface NativeDownloadRequest {
  url: string;
  /** Absolute file path; the native stack writes a temp file and renames it. */
  path: string;
  signal?: AbortSignal;
  /** Fraction 0..1 of the body written, when the length is known. */
  onProgress?: (fraction: number) => void;
}

/**
 * Download a URL straight to a file with the native stack: no total deadline, a stall (no byte for
 * http_transfer.idle_timeout_seconds) rejects with TimeoutError and an abort with AbortError, and the
 * partial file is removed either way. Resolves with the HTTP status (a non-200 answer writes nothing).
 */
export async function nativeDownloadToFile(request: NativeDownloadRequest): Promise<{ status: number; bytes: number }> {
  if (request.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const id = requestId();
  const abort = (): void => { void nativeProtocolHttp.cancel({ requestId: id }); };
  request.signal?.addEventListener('abort', abort, { once: true });
  const listener = request.onProgress
    ? await nativeProtocolHttp.addListener('downloadProgress', (progress) => {
      if (progress.requestId === id && progress.total > 0) request.onProgress?.(Math.min(1, progress.bytes / progress.total));
    })
    : null;
  try {
    const result = await nativeProtocolHttp.download({ requestId: id, url: request.url, path: request.path, idleTimeoutMs: TRANSFER_IDLE_MS });
    return { status: result.status, bytes: result.bytes ?? 0 };
  } catch (error) {
    if (nativeErrorCode(error) === 'ABORTED') throw new DOMException('The operation was aborted.', 'AbortError');
    if (nativeErrorCode(error) === 'STALLED') throw new DOMException('The transfer stalled.', 'TimeoutError');
    throw error;
  } finally {
    request.signal?.removeEventListener('abort', abort);
    await listener?.remove();
  }
}

export async function protocolFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = absoluteRequestUrl(input);
  if (nativeCronetAvailable() && (url.startsWith(HTTP_TRANSPORT_POLICY.secureScheme) || isPrivateLanHttp(url))) {
    const request = input instanceof Request ? new Request(input, init) : new Request(url, init);
    if (!isEventStream(request)) {
      try {
        return await nativeCronetFetch(request);
      } catch (error: unknown) {
        const code = nativeErrorCode(error);
        if (code !== 'CRONET_UNAVAILABLE' && code !== 'UNAVAILABLE' && code !== 'UNIMPLEMENTED') {
          throw error;
        }
      }
    }
  }
  const response = await fetch(input, init);
  queueMicrotask(() => recordBrowserProtocol(input, init, response));
  return response;
}

/** Asset fetch: data/blob/file-like schemes bypass native transports; http(s) rides protocolFetch. */
export function fetchAssetUrl(url: string, init?: RequestInit): Promise<Response> {
  if (/^(data|blob|file|content|capacitor):/i.test(url)) return fetch(url, init);
  return protocolFetch(url, init);
}

export function getHttpProtocolObservations(): readonly HttpProtocolObservation[] {
  return observationRing.getItems();
}

export function subscribeHttpProtocolObservations(
  listener: (observation: HttpProtocolObservation) => void,
): () => void {
  observationListeners.add(listener);
  return () => observationListeners.delete(listener);
}
