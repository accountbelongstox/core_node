/**
 * Firefox-only response body capture for the webRequest-based network capture.
 *
 * Chrome captures response bodies through the debugger (CDP) API, which does
 * not exist on Firefox. Firefox instead exposes
 * browser.webRequest.filterResponseData(requestId) (StreamFilter), which lets
 * an extension observe response bytes while writing them through unmodified,
 * so pages are unaffected. A blocking onBeforeRequest listener (required to
 * create StreamFilters) is registered only while at least one capture session
 * is active and removed as soon as the last session ends.
 *
 * Size and content-type limits mirror the CDP implementation in
 * network-capture-debugger.ts (1MB body cap, API MIME types / API-like URL
 * heuristics, static MIME exclusion).
 *
 * This module is only reached behind import.meta.env.FIREFOX guards; on
 * Chrome builds those branches are compile-time dead code and are tree-shaken,
 * so Chrome behavior is unchanged.
 */
import { NETWORK_FILTERS } from '@/common/constants';

// Same body size cap as network-capture-debugger.ts (MAX_RESPONSE_BODY_SIZE_BYTES)
const MAX_RESPONSE_BODY_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
// Hard cap on simultaneously tracked request bodies per tab to bound memory
const MAX_TRACKED_REQUESTS_PER_TAB = 200;

// MIME lists kept in parity with network-capture-debugger.ts so that body
// capture decisions match the Chrome CDP behavior.
const API_MIME_TYPES = [
  'application/json',
  'application/xml',
  'text/xml',
  'text/plain',
  'application/x-www-form-urlencoded',
  'application/graphql',
];

const STATIC_MIME_TYPES_TO_FILTER = [
  'image/',
  'font/',
  'audio/',
  'video/',
  'text/css',
  'application/pdf',
  'application/zip',
  'application/octet-stream',
];

// Same API-like URL heuristic as network-capture-debugger.ts
const API_URL_PATTERN = /\/(api|service|rest|graphql|query|data|rpc|v[0-9]+)\//i;

// Static resource extensions skipped when includeStatic is false (parity with
// the URL pre-filter of network-capture-web-request.ts)
const STATIC_RESOURCE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.svg',
  '.webp',
  '.ico',
  '.bmp',
  '.css',
  '.scss',
  '.less',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.otf',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.wmv',
  '.flv',
  '.ogg',
  '.wav',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];

const AD_ANALYTICS_DOMAINS = NETWORK_FILTERS.EXCLUDED_DOMAINS;
const REQUEST_URL_FILTER = { urls: ['http://*/*', 'https://*/*'] };
const BASE64_CHUNK_SIZE = 0x8000;

/** Minimal typing for the Firefox StreamFilter object (not in chrome types). */
interface FirefoxStreamFilter {
  ondata: ((event: { data: ArrayBuffer }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  write(data: ArrayBuffer | Uint8Array): void;
  disconnect(): void;
  close(): void;
}

interface BodyRecord {
  filter: FirefoxStreamFilter;
  chunks: Uint8Array[];
  bufferedBytes: number;
  discarded: boolean; // dropped after content-type pre-check
  truncated: boolean; // hit MAX_RESPONSE_BODY_SIZE_BYTES
  complete: boolean; // stream finished (or intentionally disconnected)
}

/** Structural view of the capture tool's per-request record we write into. */
interface CaptureRequestLike {
  url: string;
  mimeType?: string;
  responseBody?: string;
  base64Encoded?: boolean;
}

// Module state (tabId -> session options / body records)
const activeSessions = new Map<number, { includeStatic: boolean }>();
const bodyRecords = new Map<number, Map<string, BodyRecord>>();
let listenersActive = false;

/** Parity with network-capture-web-request.ts URL pre-filtering. */
function shouldSkipUrl(url: string, includeStatic: boolean): boolean {
  try {
    const urlObj = new URL(url);
    if (AD_ANALYTICS_DOMAINS.some((domain) => urlObj.hostname.includes(domain))) {
      return true;
    }
    if (!includeStatic) {
      const path = urlObj.pathname.toLowerCase();
      if (STATIC_RESOURCE_EXTENSIONS.some((ext) => path.endsWith(ext))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Parity with shouldCaptureResponseBody() in network-capture-debugger.ts. */
function shouldCaptureBody(url: string, mimeType: string): boolean {
  if (API_MIME_TYPES.some((type) => mimeType.startsWith(type))) {
    return true;
  }
  const lowerUrl = url.toLowerCase();
  if (
    API_URL_PATTERN.test(lowerUrl) ||
    lowerUrl.includes('.json') ||
    lowerUrl.includes('json=') ||
    lowerUrl.includes('format=json')
  ) {
    if (mimeType && STATIC_MIME_TYPES_TO_FILTER.some((type) => mimeType.startsWith(type))) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Blocking onBeforeRequest listener: attaches a pass-through StreamFilter to
 * requests of tabs with an active capture session. Never modifies the request.
 */
function handleBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails): void {
  if (details.tabId < 0) return;
  const session = activeSessions.get(details.tabId);
  if (!session) return;
  if (shouldSkipUrl(details.url, session.includeStatic)) return;

  let records = bodyRecords.get(details.tabId);
  if (!records) {
    records = new Map();
    bodyRecords.set(details.tabId, records);
  }
  if (records.size >= MAX_TRACKED_REQUESTS_PER_TAB && !records.has(details.requestId)) {
    return;
  }

  let filter: FirefoxStreamFilter;
  try {
    filter = (chrome.webRequest as any).filterResponseData(details.requestId);
  } catch (error) {
    console.warn(`FirefoxBodyCapture: filterResponseData failed for ${details.url}:`, error);
    return;
  }

  const record: BodyRecord = {
    filter,
    chunks: [],
    bufferedBytes: 0,
    discarded: false,
    truncated: false,
    complete: false,
  };
  // A redirect reuses the requestId; the fresh record replaces the old one.
  records.set(details.requestId, record);

  filter.ondata = (event: { data: ArrayBuffer }) => {
    // Pass-through first so the page always receives its data unmodified.
    try {
      filter.write(event.data);
    } catch {
      // Stream already closed/disconnected; nothing else to do.
    }
    if (record.discarded || record.truncated) {
      record.complete = true;
      try {
        filter.disconnect();
      } catch {
        // Already disconnected.
      }
      return;
    }
    const view = new Uint8Array(event.data);
    const remaining = MAX_RESPONSE_BODY_SIZE_BYTES - record.bufferedBytes;
    if (view.byteLength <= remaining) {
      record.chunks.push(view);
      record.bufferedBytes += view.byteLength;
    } else {
      record.chunks.push(view.slice(0, remaining));
      record.bufferedBytes = MAX_RESPONSE_BODY_SIZE_BYTES;
      record.truncated = true;
      record.complete = true;
      // Body cap reached: let the rest of the response flow natively.
      try {
        filter.disconnect();
      } catch {
        // Already disconnected.
      }
    }
  };

  filter.onstop = () => {
    record.complete = true;
    try {
      filter.close();
    } catch {
      // Already closed/disconnected.
    }
  };

  filter.onerror = () => {
    // Request failed; drop any partial body.
    record.discarded = true;
    record.chunks = [];
    record.bufferedBytes = 0;
  };
}

/**
 * Non-blocking onHeadersReceived listener: stops buffering bodies whose
 * content-type will never be attached, to keep memory usage low.
 */
function handleHeadersReceived(details: chrome.webRequest.WebResponseHeadersDetails): void {
  const record = bodyRecords.get(details.tabId)?.get(details.requestId);
  if (!record || record.discarded) return;
  const contentType =
    details.responseHeaders?.find((h) => h.name.toLowerCase() === 'content-type')?.value || '';
  if (!shouldCaptureBody(details.url, contentType)) {
    record.discarded = true;
    record.chunks = [];
    record.bufferedBytes = 0;
  }
}

function ensureListeners(): void {
  if (listenersActive) return;
  chrome.webRequest.onBeforeRequest.addListener(handleBeforeRequest, REQUEST_URL_FILTER, [
    'blocking',
  ]);
  chrome.webRequest.onHeadersReceived.addListener(handleHeadersReceived, REQUEST_URL_FILTER, [
    'responseHeaders',
  ]);
  listenersActive = true;
  console.log('FirefoxBodyCapture: StreamFilter listeners registered.');
}

function removeListenersIfIdle(): void {
  if (!listenersActive || activeSessions.size > 0) return;
  chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequest);
  chrome.webRequest.onHeadersReceived.removeListener(handleHeadersReceived);
  listenersActive = false;
  console.log('FirefoxBodyCapture: StreamFilter listeners removed.');
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

function decodeBody(record: BodyRecord): { body: string; base64Encoded: boolean } {
  const merged = new Uint8Array(record.bufferedBytes);
  let offset = 0;
  for (const chunk of record.chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      body: new TextDecoder('utf-8', { fatal: true }).decode(merged),
      base64Encoded: false,
    };
  } catch {
    if (record.truncated) {
      // Truncation can split a multi-byte character; decode lossily.
      return { body: new TextDecoder('utf-8').decode(merged), base64Encoded: false };
    }
    return { body: uint8ArrayToBase64(merged), base64Encoded: true };
  }
}

/** Start buffering response bodies for a tab's capture session. */
function startSession(tabId: number, includeStatic: boolean): void {
  endSession(tabId); // Reset any leftover state for this tab.
  activeSessions.set(tabId, { includeStatic });
  bodyRecords.set(tabId, new Map());
  ensureListeners();
  console.log(`FirefoxBodyCapture: body capture session started for tab ${tabId}.`);
}

/** Release all body capture resources for a tab. */
function endSession(tabId: number): void {
  if (!activeSessions.has(tabId) && !bodyRecords.has(tabId)) return;
  activeSessions.delete(tabId);
  const records = bodyRecords.get(tabId);
  if (records) {
    records.forEach((record) => {
      if (!record.complete) {
        try {
          record.filter.disconnect();
        } catch {
          // Filter already finished or errored.
        }
      }
    });
    bodyRecords.delete(tabId);
  }
  removeListenersIfIdle();
}

/**
 * Merge buffered bodies into the capture tool's request map. Must be called
 * before the session is ended/cleaned up. Only complete bodies that pass the
 * CDP-parity content checks are attached.
 */
function attachBodies(tabId: number, requests: Record<string, CaptureRequestLike>): void {
  const records = bodyRecords.get(tabId);
  if (!records) return;
  let attachedCount = 0;
  Object.keys(requests).forEach((requestId) => {
    const record = records.get(requestId);
    const request = requests[requestId];
    if (!record || !record.complete || record.discarded || record.bufferedBytes === 0) return;
    if (!shouldCaptureBody(request.url, request.mimeType || '')) return;
    try {
      const decoded = decodeBody(record);
      request.responseBody = record.truncated
        ? decoded.body +
          `\n\n... [Response truncated, first ${MAX_RESPONSE_BODY_SIZE_BYTES} bytes captured] ...`
        : decoded.body;
      request.base64Encoded = decoded.base64Encoded;
      attachedCount++;
    } catch (error) {
      console.warn(`FirefoxBodyCapture: failed to decode body for ${request.url}:`, error);
    }
  });
  console.log(`FirefoxBodyCapture: attached ${attachedCount} response bodies for tab ${tabId}.`);
}

export const firefoxNetworkBodyCapture = { startSession, endSession, attachBodies };
