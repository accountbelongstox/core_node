/**
 * Pycore HTTP controller and replayable event transport.
 */

import { PycorePaths } from './pycoreEndpoints';
import { rewritePycoreEndpoint } from './pycoreTarget';
import { appendHttpDebug, summarizeHttpParams } from './pycoreHttpLog';
import { StorageKeys, StorageManager } from '../../persistence';
import { PYCORE_BROWSER_EVENTS, PYCORE_SSE_EVENTS } from './PycoreEventTopics';

type EventHandler = (data: any) => void;
type StatusHandler = (connected: boolean) => void;
type DiagHandler = (line: { level: string; message: string }) => void;

interface HttpEventRecord {
  instance_id?: string;
  event_id?: string;
  seq?: number;
  topic?: string;
  payload?: any;
}

interface HttpEventState {
  instance_id?: string;
  seq?: number;
  earliest_seq?: number;
  replay_lost?: boolean;
  cursor_ahead?: boolean;
}

const DEFAULT_HTTP_TIMEOUT_MS = 30_000;
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const MAX_PROCESSED_EVENTS = 512;

const eventHandlers = new Map<string, Set<EventHandler>>();
const statusHandlers = new Set<StatusHandler>();
const diagHandlers = new Set<DiagHandler>();
const processedEvents = new Set<string>();

let browserId: string | null = null;
let tabId: string | null = null;
let clientId: string | null = null;
let connected = false;
let started = false;
let suspended = false;
let eventSource: EventSource | null = null;
let eventReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let eventInstanceId = '';
let eventSeq = 0;
let retryDelayMs = RETRY_MIN_MS;
let httpLogEnabled = false;

class PycoreHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PycoreHttpError';
    this.status = status;
  }
}

function mintId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function newRequestId(): string {
  try { return crypto.randomUUID(); } catch { /* older webviews */ }
  return mintId('req');
}

function diag(level: string, message: string): void {
  diagHandlers.forEach((handler) => handler({ level, message }));
  if (!httpLogEnabled && level === 'info') return;
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`[pycore-http] ${message}`);
}

function setConnected(value: boolean): void {
  if (connected === value) return;
  connected = value;
  statusHandlers.forEach((handler) => handler(value));
}

function dispatch(event: string, data: any): void {
  const handlers = eventHandlers.get(event);
  if (!handlers) return;
  handlers.forEach((handler) => {
    try {
      handler(data);
    } catch (error) {
      console.error(`[pycore-http] handler for "${event}" failed`, error);
    }
  });
}

function rememberEvent(eventId: string): boolean {
  if (!eventId) return true;
  if (processedEvents.has(eventId)) return false;
  processedEvents.add(eventId);
  if (processedEvents.size > MAX_PROCESSED_EVENTS) {
    const oldest = processedEvents.values().next().value;
    if (oldest) processedEvents.delete(oldest);
  }
  return true;
}

function eventStreamUrl(): string {
  const query = new URLSearchParams({
    client_id: getClientId(),
    since_seq: String(eventSeq),
  });
  return `${rewritePycoreEndpoint(PycorePaths.events)}?${query.toString()}`;
}

async function acknowledgeEvents(seq: number): Promise<void> {
  const response = await fetch(rewritePycoreEndpoint(PycorePaths.eventsAck), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: getClientId(), seq }),
  });
  if (!response.ok) {
    throw new Error(`HTTP event ACK failed: ${response.status}`);
  }
}

function parseSseData<T>(event: MessageEvent): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch (error: any) {
    diag('warn', `invalid SSE payload: ${error?.message || String(error)}`);
    return null;
  }
}

function handleSseState(event: MessageEvent): void {
  const state = parseSseData<HttpEventState>(event);
  if (!state) return;
  const nextInstanceId = String(state.instance_id || '');
  if (eventInstanceId && nextInstanceId && eventInstanceId !== nextInstanceId) {
    eventInstanceId = nextInstanceId;
    eventSeq = 0;
    processedEvents.clear();
    dispatch(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, { instance_id: nextInstanceId });
    eventSource?.close();
    eventSource = null;
    scheduleEventReconnect(0);
    return;
  }
  if (nextInstanceId) eventInstanceId = nextInstanceId;
  if (!state.replay_lost) return;
  const earliestSeq = Number(state.earliest_seq || 1);
  eventSeq = Math.max(0, earliestSeq - 1);
  dispatch(PYCORE_BROWSER_EVENTS.httpEventReplayLost, {
    instance_id: eventInstanceId,
    earliest_seq: earliestSeq,
  });
}

function handleSseRecord(event: MessageEvent): void {
  const record = parseSseData<HttpEventRecord>(event);
  if (!record) return;
  const seq = Number(record.seq || 0);
  const topic = String(record.topic || '');
  const eventId = String(record.event_id || '');
  if (seq > eventSeq) eventSeq = seq;
  if (topic && rememberEvent(eventId)) dispatch(topic, record.payload);
  void acknowledgeEvents(eventSeq).catch((error: any) => {
    diag('warn', error?.message || String(error));
  });
}

function scheduleEventReconnect(delayMs: number = retryDelayMs): void {
  if (!started || suspended || eventReconnectTimer) return;
  eventReconnectTimer = setTimeout(() => {
    eventReconnectTimer = null;
    openEventStream();
  }, delayMs);
}

function openEventStream(): void {
  if (!started || suspended || eventSource || typeof EventSource === 'undefined') return;
  const source = new EventSource(eventStreamUrl());
  eventSource = source;
  source.addEventListener(PYCORE_SSE_EVENTS.state, handleSseState as EventListener);
  source.addEventListener(PYCORE_SSE_EVENTS.event, handleSseRecord as EventListener);
  source.onopen = () => {
    setConnected(true);
    retryDelayMs = RETRY_MIN_MS;
  };
  source.onerror = () => {
    if (eventSource === source) eventSource = null;
    source.close();
    setConnected(false);
    if (!started || suspended) return;
    const delayMs = retryDelayMs;
    retryDelayMs = Math.min(RETRY_MAX_MS, retryDelayMs * 2);
    scheduleEventReconnect(delayMs);
  };
}

async function requestHttp(route: string, params: any, timeoutMs?: number): Promise<any> {
  const requestId = newRequestId();
  const waitMs = typeof timeoutMs === 'number' && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_HTTP_TIMEOUT_MS;
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), waitMs);
  try {
    const response = await fetch(rewritePycoreEndpoint(PycorePaths.api(route)), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Pycore-Client-ID': getClientId(),
        'X-Pycore-Browser-ID': getBrowserId(),
      },
      body: JSON.stringify(params ?? {}),
      signal: abortController.signal,
    });
    const responseText = await response.text();
    let payload: any = null;
    if (responseText) {
      try { payload = JSON.parse(responseText); } catch { payload = responseText; }
    }
    setConnected(true);
    if (!response.ok) {
      const message = payload?.error?.message
        || payload?.message
        || (typeof payload?.error === 'string' ? payload.error : '')
        || `HTTP ${response.status}`;
      throw new PycoreHttpError(response.status, String(message));
    }
    return payload;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new PycoreHttpError(0, `HTTP request timeout after ${waitMs}ms: ${route}`);
    }
    if (!(error instanceof PycoreHttpError)) setConnected(false);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function onHttpDiag(handler: DiagHandler): () => void {
  diagHandlers.add(handler);
  return () => { diagHandlers.delete(handler); };
}

export function getBrowserId(): string {
  if (browserId) return browserId;
  const stored = StorageManager.getRaw(StorageKeys.PYCORE_HTTP_BROWSER_ID);
  if (stored) {
    browserId = stored;
    return browserId;
  }
  browserId = mintId('browser');
  StorageManager.setRaw(StorageKeys.PYCORE_HTTP_BROWSER_ID, browserId);
  return browserId;
}

function getTabId(): string {
  if (tabId) return tabId;
  const stored = StorageManager.getSessionRaw(StorageKeys.PYCORE_HTTP_TAB_ID);
  if (stored) {
    tabId = stored;
    return tabId;
  }
  tabId = mintId('tab');
  StorageManager.setSessionRaw(StorageKeys.PYCORE_HTTP_TAB_ID, tabId);
  return tabId;
}

export function getClientId(): string {
  if (!clientId) clientId = `${getBrowserId()}:${getTabId()}`;
  return clientId;
}

export function isPycoreSuspended(): boolean {
  return suspended;
}

export function setHttpLogEnabled(on: boolean): void {
  httpLogEnabled = on;
}

export function isHttpLogEnabled(): boolean {
  return httpLogEnabled;
}

export function isHttpConnected(): boolean {
  return connected;
}

export function onHttpStatus(handler: StatusHandler): () => void {
  statusHandlers.add(handler);
  handler(connected);
  return () => { statusHandlers.delete(handler); };
}

export function subscribe(event: string, handler: EventHandler): () => void {
  let handlers = eventHandlers.get(event);
  if (!handlers) {
    handlers = new Set<EventHandler>();
    eventHandlers.set(event, handlers);
  }
  handlers.add(handler);
  return () => {
    const current = eventHandlers.get(event);
    current?.delete(handler);
    if (current && current.size === 0) eventHandlers.delete(event);
  };
}

export function dispatchEvent(event: string, data: any): void {
  dispatch(event, data);
}

export function subscribeHttpEvent(event: string, handler: EventHandler): () => void {
  return subscribe(event, handler);
}

export function requestPycoreHttp(route: string, params: any = {}, timeoutMs?: number): Promise<any> {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startedAt = now();
  const routePath = PycorePaths.api(route);
  const fullUrl = rewritePycoreEndpoint(routePath);
  const paramsSummary = summarizeHttpParams(params);
  const record = (status: number, error?: string | null) => {
    appendHttpDebug({
      direction: 'pycore',
      method: 'POST',
      route,
      path: routePath,
      fullUrl,
      paramsSummary,
      status,
      ms: now() - startedAt,
      error: error || null,
    });
  };
  return requestHttp(route, params, timeoutMs)
    .then((result) => {
      record(200);
      return result;
    })
    .catch((error: any) => {
      record(error instanceof PycoreHttpError ? error.status : 0, error?.message || String(error));
      throw error;
    });
}

export function connectPycoreHttp(): void {
  if (started) return;
  started = true;
  if (suspended) return;
  diag('info', 'starting HTTP controller and SSE event transport');
  openEventStream();
}

export function setPycoreActive(active: boolean): void {
  if (active === !suspended) return;
  suspended = !active;
  if (suspended) {
    eventSource?.close();
    eventSource = null;
    if (eventReconnectTimer) clearTimeout(eventReconnectTimer);
    eventReconnectTimer = null;
    setConnected(false);
    return;
  }
  retryDelayMs = RETRY_MIN_MS;
  if (started) openEventStream();
}
