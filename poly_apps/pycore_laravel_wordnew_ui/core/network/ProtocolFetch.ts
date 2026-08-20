/** Shared browser/WebView HTTP transport and negotiated-protocol observer. */

export const HTTP_TRANSPORT_POLICY = Object.freeze({
  secureScheme: 'https:',
  preferredProtocol: 'h3',
  fallbackProtocols: ['h2', 'http/1.1'] as const,
  earlyHintsStatus: 103,
  capacitorRuntime: 'chromium-webview',
});

export interface HttpProtocolObservation {
  url: string;
  method: string;
  status: number;
  secure: boolean;
  nextHopProtocol: string;
  transport: 'browser' | 'capacitor-webview';
  observedAt: number;
}

const MAX_PROTOCOL_OBSERVATIONS = 200;
const observations: HttpProtocolObservation[] = [];
const listeners = new Set<(observation: HttpProtocolObservation) => void>();

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isCapacitorWebView(): boolean {
  const runtime = globalThis as typeof globalThis & {
    Capacitor?: { isNativePlatform?: () => boolean };
  };
  try {
    return runtime.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

function observedNextHopProtocol(url: string): string {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') return '';
  const entries = performance.getEntriesByName(url, 'resource') as PerformanceResourceTiming[];
  return entries.length > 0 ? String(entries[entries.length - 1].nextHopProtocol || '') : '';
}

function recordProtocol(input: RequestInfo | URL, init: RequestInit | undefined, response: Response): void {
  const originalUrl = requestUrl(input);
  const responseUrl = response.url || originalUrl;
  const observation: HttpProtocolObservation = {
    url: responseUrl,
    method: String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase(),
    status: response.status,
    secure: responseUrl.startsWith(HTTP_TRANSPORT_POLICY.secureScheme),
    nextHopProtocol: observedNextHopProtocol(responseUrl) || observedNextHopProtocol(originalUrl),
    transport: isCapacitorWebView() ? 'capacitor-webview' : 'browser',
    observedAt: Date.now(),
  };
  observations.push(observation);
  if (observations.length > MAX_PROTOCOL_OBSERVATIONS) {
    observations.splice(0, observations.length - MAX_PROTOCOL_OBSERVATIONS);
  }
  listeners.forEach((listener) => listener(observation));
}

/**
 * Deliver through the user agent's standards-based network stack.
 *
 * HTTPS protocol negotiation, including h3/h2 fallback and processing of 103
 * Early Hints, belongs to Chromium/WebView. Fetch does not expose interim 103
 * responses; Resource Timing exposes the negotiated final-hop protocol when
 * the runtime and the server's Timing-Allow-Origin policy permit it.
 */
export async function protocolFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  queueMicrotask(() => recordProtocol(input, init, response));
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
