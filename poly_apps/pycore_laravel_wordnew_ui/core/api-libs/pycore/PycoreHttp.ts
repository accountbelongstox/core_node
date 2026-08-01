/**
 * Pycore HTTP controller and replayable event transport.
 */

import { PycorePaths } from './pycoreEndpoints';
import { rewritePycoreEndpoint } from './pycoreTarget';
import { appendHttpDebug, summarizeHttpParams } from './pycoreHttpLog';
import { PycoreHttpError, pycoreMasterClient } from './PycoreClient';
import { pycoreEventBus, type PycoreEventHandler } from './PycoreEventBus';
import {
  PYCORE_BROWSER_EVENTS,
  PYCORE_HTTP_DEFAULTS,
  PYCORE_SSE_EVENTS,
} from './PycoreNetwork';

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

const statusHandlers = new Set<StatusHandler>();
const diagHandlers = new Set<DiagHandler>();
const processedEvents = new Set<string>();

let connected = false;
let httpReachable = false;
let sseConnected = false;
let started = false;
let suspended = false;
let eventSource: EventSource | null = null;
let eventReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let eventInstanceId = '';
let eventSeq = 0;
let retryDelayMs: number = PYCORE_HTTP_DEFAULTS.reconnectMinMs;
let httpLogEnabled = false;

function diag(level: string, message: string): void {
  diagHandlers.forEach((handler) => handler({ level, message }));
  if (!httpLogEnabled && level === 'info') return;
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`[pycore-http] ${message}`);
}

function updateConnectionState(): void {
  const value = !suspended && (httpReachable || sseConnected);
  if (connected === value) return;
  connected = value;
  statusHandlers.forEach((handler) => handler(value));
}

pycoreMasterClient.onReachability((reachable) => {
  httpReachable = reachable;
  updateConnectionState();
});

function rememberEvent(eventId: string): boolean {
  if (!eventId) return true;
  if (processedEvents.has(eventId)) return false;
  processedEvents.add(eventId);
  if (processedEvents.size > PYCORE_HTTP_DEFAULTS.maxProcessedEvents) {
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
    pycoreEventBus.dispatch(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, { instance_id: nextInstanceId });
    eventSource?.close();
    eventSource = null;
    scheduleEventReconnect(0);
    return;
  }
  if (nextInstanceId) eventInstanceId = nextInstanceId;
  if (!state.replay_lost) return;
  const earliestSeq = Number(state.earliest_seq || 1);
  eventSeq = Math.max(0, earliestSeq - 1);
  pycoreEventBus.dispatch(PYCORE_BROWSER_EVENTS.httpEventReplayLost, {
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
  const duplicate = Boolean(topic) && !rememberEvent(eventId);
  if (topic && !duplicate) pycoreEventBus.dispatch(topic, record.payload);
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
    sseConnected = true;
    updateConnectionState();
    retryDelayMs = PYCORE_HTTP_DEFAULTS.reconnectMinMs;
  };
  source.onerror = () => {
    if (eventSource === source) eventSource = null;
    source.close();
    sseConnected = false;
    updateConnectionState();
    if (!started || suspended) return;
    const delayMs = retryDelayMs;
    retryDelayMs = Math.min(PYCORE_HTTP_DEFAULTS.reconnectMaxMs, retryDelayMs * 2);
    scheduleEventReconnect(delayMs);
  };
}

async function requestHttp(
  route: string,
  params: any,
  timeoutMs?: number,
  path: string = PycorePaths.api(route),
  method: 'GET' | 'POST' = 'POST',
): Promise<any> {
  return method === 'GET'
    ? pycoreMasterClient.getJson(path, timeoutMs, route)
    : pycoreMasterClient.postJson(path, params, timeoutMs, route);
}

export function onHttpDiag(handler: DiagHandler): () => void {
  diagHandlers.add(handler);
  return () => { diagHandlers.delete(handler); };
}

export function reportHttpDiag(level: string, message: string): void {
  diag(level, message);
}

export function getBrowserId(): string {
  return pycoreMasterClient.getBrowserId();
}

export function getClientId(): string {
  return pycoreMasterClient.getClientId();
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

export function subscribe(event: string, handler: PycoreEventHandler): () => void {
  return pycoreEventBus.subscribe(event, handler);
}

export function dispatchEvent(event: string, data: any): void {
  pycoreEventBus.dispatch(event, data);
}

export function subscribeHttpEvent(event: string, handler: PycoreEventHandler): () => void {
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

export function requestPycoreStatus(timeoutMs?: number): Promise<any> {
  return requestHttp('status', {}, timeoutMs, PycorePaths.status, 'GET');
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
    sseConnected = false;
    if (eventReconnectTimer) clearTimeout(eventReconnectTimer);
    eventReconnectTimer = null;
    updateConnectionState();
    return;
  }
  retryDelayMs = PYCORE_HTTP_DEFAULTS.reconnectMinMs;
  if (started) openEventStream();
}
