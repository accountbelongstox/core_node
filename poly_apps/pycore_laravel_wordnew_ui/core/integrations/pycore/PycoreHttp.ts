/**
 * Pycore HTTP controller and replayable event transport: a WebSocket on the
 * plain-HTTP direct port (outside the browser's six-connections-per-host
 * pool), SSE on multiplexed h2/h3 proxy targets or when sockets are blocked,
 * and the Laravel relay tunnel in relay mode.
 */

import { PycorePaths } from './pycoreEndpoints';
import { rewritePycoreEndpoint, isPycoreProxyMode, isPycoreRelayMode } from './pycoreTarget';
import { appendHttpDebug, summarizeHttpParams } from './pycoreHttpLog';
import { PycoreHttpError, pycoreMasterClient } from './PycoreClient';
import { StorageManager } from '../../persistence';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { pycoreEventBus, type PycoreEventHandler } from './PycoreEventBus';
import { relayEventType } from '../../contracts/RelayContract';
import { laravelRelayOperationEvents } from '../laravel/LaravelRelayOperationEvents';
import { laravelRelayDeviceId } from './PycoreLaravelRelayTransport';
import {
  PYCORE_BROWSER_EVENTS,
  PYCORE_HTTP_DEFAULTS,
  PYCORE_SSE_EVENTS,
  PYCORE_WS_DEFAULTS,
  PYCORE_WS_OPS,
  type PycoreWsLease,
} from './PycoreNetwork';
import {
  ReconnectingWebSocket,
  type WsConnectionState,
  type WsFrame,
} from '../../network/ws/ReconnectingWebSocket';

type StatusHandler = (connected: boolean) => void;
type DiagHandler = (line: { level: string; message: string }) => void;
type HttpQueryParams = Record<string, string | number | boolean | null | undefined>;

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

interface PersistedEventCursor {
  instanceId: string;
  seq: number;
  updatedAt: number;
}

type PersistedEventCursors = Record<string, PersistedEventCursor>;

type EventTransport = 'ws' | 'sse';

/** HTTP renewal used while no event socket carries a presence lease. */
export interface PycoreLeaseFallback {
  renew: () => Promise<unknown>;
  intervalMs: number;
  release?: () => Promise<unknown>;
}

interface PycoreLeaseEntry {
  holders: number;
  fallback: PycoreLeaseFallback;
  timer: ReturnType<typeof setTimeout> | null;
  usedFallback: boolean;
}

const statusHandlers = new Set<StatusHandler>();
const diagHandlers = new Set<DiagHandler>();
const processedEvents = new Set<string>();
const leases = new Map<PycoreWsLease, PycoreLeaseEntry>();

let connected = false;
let httpReachable = false;
let eventStreamConnected = false;
let started = false;
let suspended = false;
let eventSource: EventSource | null = null;
let eventReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let eventCursorPersistTimer: ReturnType<typeof setTimeout> | null = null;
let eventInstanceId = '';
let eventSeq = 0;
let eventCursorClientId = '';
let retryDelayMs: number = PYCORE_HTTP_DEFAULTS.reconnectMinMs;
let httpLogEnabled = false;
let relayTunnelStop: (() => void) | null = null;
let eventTransport: EventTransport = ReconnectingWebSocket.isSupported() ? 'ws' : 'sse';
let eventSocket: ReconnectingWebSocket | null = null;
let offTopicsChanged: (() => void) | null = null;
let subscribeTimer: ReturnType<typeof setTimeout> | null = null;

function diag(level: string, message: string): void {
  diagHandlers.forEach((handler) => handler({ level, message }));
  if (!httpLogEnabled && level === 'info') return;
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`[pycore-http] ${message}`);
}

function updateConnectionState(): void {
  const value = !suspended && (httpReachable || eventStreamConnected);
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

function restoreEventCursor(): void {
  const clientId = getClientId();
  if (!clientId || clientId.startsWith('pending:') || eventCursorClientId === clientId) return;
  const cursors = StorageManager.get<PersistedEventCursors>(StorageKeys.HTTP_EVENT_CURSORS, {});
  const cursor = cursors[clientId];
  eventCursorClientId = clientId;
  eventInstanceId = String(cursor?.instanceId || '');
  eventSeq = Math.max(0, Number(cursor?.seq || 0));
}

function persistEventCursor(): void {
  const clientId = getClientId();
  if (!clientId || clientId.startsWith('pending:')) return;
  const cursors = StorageManager.get<PersistedEventCursors>(StorageKeys.HTTP_EVENT_CURSORS, {});
  cursors[clientId] = {
    instanceId: eventInstanceId,
    seq: eventSeq,
    updatedAt: Date.now(),
  };
  const bounded = Object.fromEntries(
    Object.entries(cursors)
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, 2),
  );
  StorageManager.set(StorageKeys.HTTP_EVENT_CURSORS, bounded);
}

function scheduleEventCursorPersist(): void {
  if (eventCursorPersistTimer !== null) clearTimeout(eventCursorPersistTimer);
  eventCursorPersistTimer = setTimeout(() => {
    eventCursorPersistTimer = null;
    persistEventCursor();
  }, 250);
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

/** Apply replay state; `true` means the server restarted and the stream must reopen from zero. */
function applyEventState(state: HttpEventState): boolean {
  const nextInstanceId = String(state.instance_id || '');
  if (eventInstanceId && nextInstanceId && eventInstanceId !== nextInstanceId) {
    eventInstanceId = nextInstanceId;
    eventSeq = 0;
    processedEvents.clear();
    scheduleEventCursorPersist();
    pycoreEventBus.dispatch(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, { instance_id: nextInstanceId });
    return true;
  }
  if (nextInstanceId) eventInstanceId = nextInstanceId;
  if (!state.replay_lost) return false;
  const earliestSeq = Number(state.earliest_seq || 1);
  eventSeq = Math.max(0, earliestSeq - 1);
  scheduleEventCursorPersist();
  pycoreEventBus.dispatch(PYCORE_BROWSER_EVENTS.httpEventReplayLost, {
    instance_id: eventInstanceId,
    earliest_seq: earliestSeq,
  });
  return false;
}

function applyEventRecord(record: HttpEventRecord): void {
  const seq = Number(record.seq || 0);
  const topic = String(record.topic || '');
  const eventId = String(record.event_id || '');
  if (seq > eventSeq) eventSeq = seq;
  if (seq > 0) scheduleEventCursorPersist();
  const duplicate = Boolean(topic) && !rememberEvent(eventId);
  if (topic && !duplicate) pycoreEventBus.dispatch(topic, record.payload);
}

function handleSseState(event: MessageEvent): void {
  const state = parseSseData<HttpEventState>(event);
  if (!state || !applyEventState(state)) return;
  eventSource?.close();
  eventSource = null;
  scheduleEventReconnect(0);
}

function handleSseRecord(event: MessageEvent): void {
  const record = parseSseData<HttpEventRecord>(event);
  if (record) applyEventRecord(record);
}

function toWebSocketUrl(endpoint: string): string {
  const absolute = /^https?:\/\//i.test(endpoint) ? endpoint : `${location.origin}${endpoint}`;
  return absolute.replace(/^http/i, 'ws');
}

async function eventSocketUrl(): Promise<string> {
  await pycoreMasterClient.ensureClientId();
  restoreEventCursor();
  return toWebSocketUrl(rewritePycoreEndpoint(PycorePaths.ws));
}

function sendSocketHello(socket: ReconnectingWebSocket): void {
  socket.send({
    op: PYCORE_WS_OPS.hello,
    client_id: getClientId(),
    since_seq: eventSeq,
    topics: pycoreEventBus.topics(),
    leases: [...leases.keys()],
  });
}

function handleSocketFrame(frame: WsFrame): void {
  if (frame.op === PYCORE_WS_OPS.state) {
    if (applyEventState(frame as HttpEventState)) eventSocket?.reconnectNow();
    return;
  }
  if (frame.op === PYCORE_WS_OPS.events) {
    const records = frame.records;
    if (Array.isArray(records)) records.forEach((record) => applyEventRecord(record as HttpEventRecord));
    return;
  }
  if (frame.op === PYCORE_WS_OPS.error) diag('warn', `event socket error: ${String(frame.code || '')}`);
}

function handleSocketState(state: WsConnectionState): void {
  eventStreamConnected = state === 'open';
  updateConnectionState();
  syncLeaseFallbacks();
  if (state !== 'closed' || !eventSocket || !httpReachable) return;
  if (eventSocket.consecutiveFailures < PYCORE_WS_DEFAULTS.sseFallbackAfterFailures) return;
  // HTTP answers but sockets never open (a proxy without upgrade support).
  diag('warn', 'event socket unavailable while HTTP is reachable; falling back to SSE');
  eventTransport = 'sse';
  stopEventSocket();
  prepareEventStream();
}

function scheduleTopicSync(): void {
  if (subscribeTimer !== null) return;
  subscribeTimer = setTimeout(() => {
    subscribeTimer = null;
    eventSocket?.send({ op: PYCORE_WS_OPS.subscribe, topics: pycoreEventBus.topics() });
  }, PYCORE_WS_DEFAULTS.subscribeDebounceMs);
}

function startEventSocket(): void {
  if (!eventSocket) {
    eventSocket = new ReconnectingWebSocket({
      resolveUrl: eventSocketUrl,
      onOpen: sendSocketHello,
      onFrame: handleSocketFrame,
      pingFrame: () => ({ op: PYCORE_WS_OPS.ping, t: Date.now() }),
      reconnectMinMs: PYCORE_HTTP_DEFAULTS.reconnectMinMs,
      reconnectMaxMs: PYCORE_HTTP_DEFAULTS.reconnectMaxMs,
    });
    eventSocket.onState(handleSocketState);
    offTopicsChanged = pycoreEventBus.onTopicsChanged(scheduleTopicSync);
  }
  eventSocket.start();
}

function stopEventSocket(): void {
  const socket = eventSocket;
  eventSocket = null;
  offTopicsChanged?.();
  offTopicsChanged = null;
  if (subscribeTimer !== null) clearTimeout(subscribeTimer);
  subscribeTimer = null;
  socket?.stop();
}

function usesEventSocket(): boolean {
  return eventTransport === 'ws' && !isPycoreProxyMode() && ReconnectingWebSocket.isSupported();
}

function runLeaseFallback(entry: PycoreLeaseEntry): void {
  if (entry.timer !== null) return;
  entry.usedFallback = true;
  const tick = () => {
    void entry.fallback.renew().catch(() => { /* next tick retries */ });
    entry.timer = setTimeout(tick, entry.fallback.intervalMs);
  };
  tick();
}

function stopLeaseFallback(entry: PycoreLeaseEntry): void {
  if (entry.timer !== null) clearTimeout(entry.timer);
  entry.timer = null;
}

function syncLeaseFallbacks(): void {
  const socketState = eventSocket?.connectionState;
  // A handshake in flight keeps the current carrier; the hello re-sends leases.
  if (socketState === 'connecting') return;
  const fallbackNeeded = started && !suspended && socketState !== 'open';
  leases.forEach((entry) => (fallbackNeeded ? runLeaseFallback(entry) : stopLeaseFallback(entry)));
}

/**
 * Relay mode: the pycore device batches every broadcast event into one
 * `pycore.events` device event; replay each entry on the topic bus exactly as
 * the direct SSE journal does, so stores refresh from pushes, not Relay polls.
 */
function startRelayEventTunnel(): void {
  if (relayTunnelStop) return;
  const eventType = relayEventType('pycore_events');
  laravelRelayOperationEvents.start();
  const offEvent = laravelRelayOperationEvents.onEvent((event, data) => {
    if (event !== eventType) return;
    const frame = data as { device_id?: string; metadata?: { events?: unknown } } | null;
    if (!frame || frame.device_id !== laravelRelayDeviceId()) return;
    const entries = frame.metadata?.events;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      const topic = String(entry?.topic || '');
      if (topic && rememberEvent(String(entry?.event_id || ''))) pycoreEventBus.dispatch(topic, entry.payload);
    }
  });
  const offState = laravelRelayOperationEvents.onConnectionState((live) => {
    eventStreamConnected = live;
    updateConnectionState();
  });
  relayTunnelStop = () => {
    offEvent();
    offState();
    laravelRelayOperationEvents.stop();
    relayTunnelStop = null;
    eventStreamConnected = false;
  };
}

function scheduleEventReconnect(delayMs: number = retryDelayMs): void {
  if (!started || suspended || eventReconnectTimer) return;
  eventReconnectTimer = setTimeout(() => {
    eventReconnectTimer = null;
    prepareEventStream();
  }, delayMs);
}

function prepareEventStream(): void {
  if (!started || suspended) return;
  // Relay scheme: the pycore-local per-client stream is a direct-transport
  // concept - realtime arrives through the Laravel Mercure link instead.
  if (isPycoreRelayMode()) {
    startRelayEventTunnel();
    syncLeaseFallbacks();
    return;
  }
  if (usesEventSocket()) {
    startEventSocket();
    syncLeaseFallbacks();
    return;
  }
  syncLeaseFallbacks();
  if (eventSource || typeof EventSource === 'undefined') return;
  void pycoreMasterClient.ensureClientId()
    .then(() => {
      restoreEventCursor();
      openEventStream();
    })
    .catch(() => scheduleEventReconnect(PYCORE_HTTP_DEFAULTS.reconnectMinMs));
}

function openEventStream(): void {
  if (!started || suspended || eventSource || typeof EventSource === 'undefined') return;
  const source = new EventSource(eventStreamUrl());
  eventSource = source;
  source.addEventListener(PYCORE_SSE_EVENTS.state, handleSseState as EventListener);
  source.addEventListener(PYCORE_SSE_EVENTS.event, handleSseRecord as EventListener);
  source.onopen = () => {
    eventStreamConnected = true;
    updateConnectionState();
    retryDelayMs = PYCORE_HTTP_DEFAULTS.reconnectMinMs;
  };
  source.onerror = () => {
    if (eventSource === source) eventSource = null;
    source.close();
    eventStreamConnected = false;
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

function appendHttpQuery(path: string, params: HttpQueryParams): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
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

export function requestPycoreHttpText(
  route: string,
  text: string,
  queryParams: HttpQueryParams = {},
  timeoutMs?: number,
): Promise<any> {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startedAt = now();
  const routePath = appendHttpQuery(PycorePaths.api(route), queryParams);
  const fullUrl = rewritePycoreEndpoint(routePath);
  const paramsSummary = summarizeHttpParams({ ...queryParams, text_length: text.length });
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
  return pycoreMasterClient.postText(routePath, text, timeoutMs, route)
    .then((result) => {
      record(200);
      return result;
    })
    .catch((error: any) => {
      record(error instanceof PycoreHttpError ? error.status : 0, error?.message || String(error));
      throw error;
    });
}

export function requestPycoreHttpGet(
  route: string,
  queryParams: HttpQueryParams = {},
  timeoutMs?: number,
): Promise<any> {
  const routePath = appendHttpQuery(PycorePaths.api(route), queryParams);
  return requestHttp(route, {}, timeoutMs, routePath, 'GET');
}

export interface PycoreHttpBinaryResult {
  status: number;
  bytes: Uint8Array | null;
}

export function requestPycoreHttpBinary(
  route: string,
  queryParams: HttpQueryParams = {},
  timeoutMs?: number,
): Promise<PycoreHttpBinaryResult> {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startedAt = now();
  const routePath = appendHttpQuery(PycorePaths.api(route), queryParams);
  const fullUrl = rewritePycoreEndpoint(routePath);
  const record = (status: number, error?: string | null) => {
    appendHttpDebug({
      direction: 'pycore',
      method: 'GET',
      route,
      path: routePath,
      fullUrl,
      paramsSummary: summarizeHttpParams(queryParams),
      status,
      ms: now() - startedAt,
      error: error || null,
    });
  };
  return pycoreMasterClient.getBinary(routePath, timeoutMs, route)
    .then(async (response) => {
      record(response.status);
      return {
        status: response.status,
        bytes: response.status === 200
          ? new Uint8Array(await response.arrayBuffer())
          : null,
      };
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
  diag('info', 'starting HTTP controller and event transport');
  prepareEventStream();
}

export function setPycoreActive(active: boolean): void {
  if (active === !suspended) return;
  suspended = !active;
  if (suspended) {
    eventSource?.close();
    eventSource = null;
    stopEventSocket();
    eventStreamConnected = false;
    syncLeaseFallbacks();
    relayTunnelStop?.();
    if (eventReconnectTimer) clearTimeout(eventReconnectTimer);
    eventReconnectTimer = null;
    updateConnectionState();
    return;
  }
  retryDelayMs = PYCORE_HTTP_DEFAULTS.reconnectMinMs;
  if (started) prepareEventStream();
}

/**
 * Hold a pycore presence lease while mounted. The open event socket carries it
 * (released the moment the socket closes); without one, `fallback.renew` runs
 * over HTTP at `fallback.intervalMs`.
 */
export function holdPycoreLease(name: PycoreWsLease, fallback: PycoreLeaseFallback): () => void {
  const entry = leases.get(name) ?? { holders: 0, fallback, timer: null, usedFallback: false };
  entry.holders += 1;
  leases.set(name, entry);
  if (entry.holders === 1) eventSocket?.send({ op: PYCORE_WS_OPS.lease, name, held: true });
  syncLeaseFallbacks();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    entry.holders -= 1;
    if (entry.holders > 0) return;
    leases.delete(name);
    stopLeaseFallback(entry);
    eventSocket?.send({ op: PYCORE_WS_OPS.lease, name, held: false });
    if (entry.usedFallback) void entry.fallback.release?.().catch(() => { /* lease expires server-side */ });
  };
}
