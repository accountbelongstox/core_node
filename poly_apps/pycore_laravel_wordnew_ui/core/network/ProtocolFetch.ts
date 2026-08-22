/** Shared browser/WebView/Cronet HTTP transport and protocol observer. */

import { Capacitor, registerPlugin } from '@capacitor/core';


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
  }): Promise<NativeProtocolHttpResponse>;
  cancel(options: { requestId: string }): Promise<void>;
}

const MAX_PROTOCOL_OBSERVATIONS = 200;
const observations: HttpProtocolObservation[] = [];
const listeners = new Set<(observation: HttpProtocolObservation) => void>();
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

function isCapacitorWebView(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
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
  observations.push(observation);
  if (observations.length > MAX_PROTOCOL_OBSERVATIONS) {
    observations.splice(0, observations.length - MAX_PROTOCOL_OBSERVATIONS);
  }
  listeners.forEach((listener) => listener(observation));
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
    transport: isCapacitorWebView() ? 'capacitor-webview' : 'browser',
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
    });
    const responseBody = method === 'HEAD' || [204, 205, 304].includes(result.status)
      ? null
      : base64ToBytes(result.bodyBase64);
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
 * Use native Cronet for Android HTTPS API calls and the user-agent stack for
 * browser traffic and streaming responses. Both transports process 103 Early
 * Hints internally; only the final response is exposed to application code.
 */
export async function protocolFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = absoluteRequestUrl(input);
  if (nativeCronetAvailable() && url.startsWith(HTTP_TRANSPORT_POLICY.secureScheme)) {
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

export function getHttpProtocolObservations(): readonly HttpProtocolObservation[] {
  return observations.slice();
}

export function subscribeHttpProtocolObservations(
  listener: (observation: HttpProtocolObservation) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
