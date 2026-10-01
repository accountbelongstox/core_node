/**
 * Pycore event client: the one subscription over pycore's single event
 * journal. A WebSocket (on the plain-HTTP direct port, outside the browser's
 * six-connections-per-host pool) carries every direct and proxy target, and the
 * Laravel relay tunnel replaces it in relay mode. One cursor resumes every transport, and
 * one tab per browser (the Web Locks leader) runs the transport while the
 * others replay its pushes over a BroadcastChannel.
 */

import { PycorePaths } from './pycoreEndpoints';
import { rewritePycoreEndpoint, isPycoreRelayMode } from './pycoreTarget';
import { getClientId, requestPycoreHttp } from './PycoreHttp';
import { pycoreMasterClient } from './PycoreClient';
import { StorageManager } from '../../persistence';
import { logError, logInfo, logWarn } from '../../logstore/logStore';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { pycoreEventBus, type PycoreEventHandler } from './PycoreEventBus';
import { relayEventType, type RelayEventName } from '../../contracts/RelayContract';
import { PYCORE_RELAY_DEDICATED_TOPICS } from './PycoreEventTopics';
import { laravelRelayStream } from '../laravel/LaravelRelayStream';
import { laravelRelayDeviceId } from './RelayPairing';
import {
  PYCORE_BROWSER_EVENTS,
  PYCORE_EVENT_LOCK_PREFIX,
  PYCORE_HTTP_DEFAULTS,
  PYCORE_PEER_DEFAULTS,
  PYCORE_PRESENCE_DEFAULTS,
  PYCORE_WS_DEFAULTS,
  PYCORE_WS_OPS,
  type PycorePresenceLease,
} from './PycoreNetwork';
import { PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';
import {
  ReconnectingWebSocket,
  type WsConnectionState,
  type WsFrame,
} from '../../network/ws/ReconnectingWebSocket';

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

interface PersistedEventCursor {
  instanceId: string;
  seq: number;
  updatedAt: number;
}

type PersistedEventCursors = Record<string, PersistedEventCursor>;

interface PycoreLeaseEntry {
  name: PycorePresenceLease;
  holders: number;
  timer: ReturnType<typeof setTimeout> | null;
  renewMs: number;
  usedHttp: boolean;
}

const statusHandlers = new Set<StatusHandler>();
const diagHandlers = new Set<DiagHandler>();
const processedEvents = new Set<string>();
const leases = new Map<PycorePresenceLease, PycoreLeaseEntry>();

let connected = false;
let httpReachable = false;
let eventStreamConnected = false;
let leader = false;
let started = false;
let suspended = false;
let eventCursorPersistTimer: ReturnType<typeof setTimeout> | null = null;
let eventInstanceId = '';
let eventSeq = 0;
let eventCursorClientId = '';
let httpLogEnabled = false;
let relayTunnelStop: (() => void) | null = null;
let eventSocket: ReconnectingWebSocket | null = null;
let offTopicsChanged: (() => void) | null = null;
let subscribeTimer: ReturnType<typeof setTimeout> | null = null;

interface PeerFrame {
  from: string;
  msg:
    | { kind: 'event'; topic: string; payload: unknown; eventId: string }
    | { kind: 'bus'; name: string; payload: unknown }
    | { kind: 'stream'; live: boolean }
    | { kind: 'wants'; topics: string[] }
    | { kind: 'join' }
    | { kind: 'leader' };
}

type PeerMessage = PeerFrame['msg'];

const tabId = `tab-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
const peerWants = new Map<string, { topics: string[]; at: number }>();
const wantsListeners = new Set<() => void>();
let lockAbort: AbortController | null = null;
let releaseLeadership: (() => void) | null = null;
let peerChannel: BroadcastChannel | null = null;
let peerScope = '';

function wantedTopics(): string[] {
  const topics = new Set(pycoreEventBus.topics());
  peerWants.forEach((entry) => entry.topics.forEach((topic) => topics.add(topic)));
  return [...topics];
}

function onWantedTopicsChanged(listener: () => void): () => void {
  wantsListeners.add(listener);
  return () => { wantsListeners.delete(listener); };
}

function notifyWantedTopics(): void {
  wantsListeners.forEach((listener) => listener());
}

function postWants(topics: string[] = pycoreEventBus.topics()): void {
  if (!leader) peers.post({ kind: 'wants', topics });
}

function prunePeerWants(): void {
  const cutoff = Date.now() - PYCORE_PEER_DEFAULTS.wantsExpireMs;
  let changed = false;
  peerWants.forEach((entry, from) => {
    if (entry.at >= cutoff) return;
    peerWants.delete(from);
    changed = true;
  });
  if (changed) notifyWantedTopics();
}

function handlePeerFrame(frame: PeerFrame): void {
  const msg = frame.msg;
  if (msg.kind === 'wants') {
    if (!leader) return;
    peerWants.set(frame.from, { topics: msg.topics, at: Date.now() });
    notifyWantedTopics();
    return;
  }
  if (msg.kind === 'join') {
    if (!leader) return;
    peers.post({ kind: 'leader' });
    peers.post({ kind: 'stream', live: eventStreamConnected });
    return;
  }
  if (leader) return;
  if (msg.kind === 'leader') postWants();
  else if (msg.kind === 'stream') {
    eventStreamConnected = msg.live;
    updateConnectionState();
  } else if (msg.kind === 'event') deliver(msg.topic, msg.payload, msg.eventId, true);
  else pycoreEventBus.dispatch(msg.name, msg.payload);
}

const peers = {
  get scope(): string {
    return peerScope;
  },
  open(): boolean {
    if (peerChannel) return true;
    if (typeof BroadcastChannel === 'undefined') return false;
    peerScope = `${rewritePycoreEndpoint('/')}${isPycoreRelayMode() ? '#relay' : ''}`;
    peerChannel = new BroadcastChannel(`${PYCORE_EVENT_LOCK_PREFIX}${peerScope}`);
    peerChannel.onmessage = (event: MessageEvent<PeerFrame>) => handlePeerFrame(event.data);
    pycoreEventBus.onTopicsChanged(() => (leader ? notifyWantedTopics() : postWants()));
    setInterval(() => (leader ? prunePeerWants() : postWants()), PYCORE_PEER_DEFAULTS.wantsRefreshMs);
    if (typeof window !== 'undefined') window.addEventListener('pagehide', () => postWants([]));
    return true;
  },
  post(msg: PeerMessage): void {
    peerChannel?.postMessage({ from: tabId, msg } satisfies PeerFrame);
  },
};

function diag(level: string, message: string): void {
  diagHandlers.forEach((handler) => handler({ level, message }));
  if (!httpLogEnabled && level === 'info') return;
  const log = level === 'error' ? logError : level === 'warn' ? logWarn : logInfo;
  log('pycore-http', message);
}

function setStreamConnected(live: boolean): void {
  eventStreamConnected = live;
  if (leader) peers.post({ kind: 'stream', live });
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

/** Apply replay state; `true` means the server restarted and the stream must reopen from zero. */
function applyEventState(state: HttpEventState): boolean {
  const nextInstanceId = String(state.instance_id || '');
  if (eventInstanceId && nextInstanceId && eventInstanceId !== nextInstanceId) {
    eventInstanceId = nextInstanceId;
    eventSeq = 0;
    processedEvents.clear();
    scheduleEventCursorPersist();
    publishBrowserEvent(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, { instance_id: nextInstanceId });
    return true;
  }
  if (nextInstanceId) eventInstanceId = nextInstanceId;
  if (!state.replay_lost) return false;
  const earliestSeq = Number(state.earliest_seq || 1);
  eventSeq = Math.max(0, earliestSeq - 1);
  scheduleEventCursorPersist();
  publishBrowserEvent(PYCORE_BROWSER_EVENTS.httpEventReplayLost, {
    instance_id: eventInstanceId,
    earliest_seq: earliestSeq,
  });
  return false;
}

function deliver(topic: string, payload: unknown, eventId: string, forwarded = false): void {
  if (!rememberEvent(eventId)) return;
  pycoreEventBus.dispatch(topic, payload);
  if (!forwarded && leader) peers.post({ kind: 'event', topic, payload, eventId });
}

function publishBrowserEvent(name: string, payload: unknown): void {
  pycoreEventBus.dispatch(name, payload);
  if (leader) peers.post({ kind: 'bus', name, payload });
}

function applyEventRecord(record: HttpEventRecord): void {
  const seq = Number(record.seq || 0);
  const topic = String(record.topic || '');
  const eventId = String(record.event_id || '');
  if (seq > eventSeq) eventSeq = seq;
  if (seq > 0) scheduleEventCursorPersist();
  if (topic) deliver(topic, record.payload, eventId);
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
    topics: wantedTopics(),
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
  setStreamConnected(state === 'open');
  updateConnectionState();
  syncLeaseFallbacks();
}

function scheduleTopicSync(): void {
  if (subscribeTimer !== null) return;
  subscribeTimer = setTimeout(() => {
    subscribeTimer = null;
    eventSocket?.send({ op: PYCORE_WS_OPS.subscribe, topics: wantedTopics() });
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
    offTopicsChanged = onWantedTopicsChanged(scheduleTopicSync);
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

function requestPresenceLease(name: PycorePresenceLease, held: boolean): Promise<any> {
  return requestPycoreHttp(PYCORE_HTTP_ROUTES.presenceLease, { name, held });
}

function runLeaseFallback(entry: PycoreLeaseEntry): void {
  if (entry.timer !== null) return;
  entry.usedHttp = true;
  const tick = () => {
    void requestPresenceLease(entry.name, true)
      .then((res) => {
        const renewAfterSeconds = Number(res?.data?.renew_after || 0);
        if (renewAfterSeconds > 0) entry.renewMs = renewAfterSeconds * 1000;
      })
      .catch(() => { /* next tick retries */ });
    entry.timer = setTimeout(tick, entry.renewMs);
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
 * the direct journal does, so stores refresh from pushes, not Relay polls.
 * Dedicated device events (PYCORE_RELAY_DEDICATED_TOPICS) replay here too, so
 * every consumer reads one bus topic in every transport.
 */
function startRelayEventTunnel(): void {
  if (relayTunnelStop) return;
  const eventType = relayEventType('pycore_events');
  const dedicatedTopics = new Map(
    Object.entries(PYCORE_RELAY_DEDICATED_TOPICS)
      .map(([name, topic]) => [relayEventType(name as RelayEventName), topic] as const),
  );
  laravelRelayStream.start();
  const offEvent = laravelRelayStream.onEvent((event, data) => {
    const frame = data as { device_id?: string; metadata?: { events?: unknown } } | null;
    const dedicatedTopic = dedicatedTopics.get(event);
    if (dedicatedTopic) {
      if (frame?.device_id && frame.device_id !== laravelRelayDeviceId()) return;
      deliver(dedicatedTopic, (frame && typeof frame === 'object' ? frame.metadata : data) ?? {}, '');
      return;
    }
    if (event !== eventType) return;
    if (!frame || frame.device_id !== laravelRelayDeviceId()) return;
    const entries = frame.metadata?.events;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      const topic = String(entry?.topic || '');
      if (topic) deliver(topic, entry.payload, String(entry?.event_id || ''));
    }
  });
  const offState = laravelRelayStream.onConnectionState((live) => {
    setStreamConnected(live);
    updateConnectionState();
  });
  relayTunnelStop = () => {
    offEvent();
    offState();
    laravelRelayStream.stop();
    relayTunnelStop = null;
    setStreamConnected(false);
  };
}

function prepareEventStream(): void {
  if (!started || suspended || !leader) return;
  // Relay scheme: the pycore-local per-client stream is a direct-transport
  // concept - realtime arrives through the Laravel Mercure link instead.
  if (isPycoreRelayMode()) {
    startRelayEventTunnel();
    syncLeaseFallbacks();
    return;
  }
  if (!ReconnectingWebSocket.isSupported()) {
    diag('error', 'WebSocket is unavailable; pycore events cannot be delivered');
    return;
  }
  startEventSocket();
  syncLeaseFallbacks();
}

export function onHttpDiag(handler: DiagHandler): () => void {
  diagHandlers.add(handler);
  return () => { diagHandlers.delete(handler); };
}

export function reportHttpDiag(level: string, message: string): void {
  diag(level, message);
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

function stopTransports(): void {
  stopEventSocket();
  setStreamConnected(false);
  relayTunnelStop?.();
  syncLeaseFallbacks();
  updateConnectionState();
}

function becomeLeader(): void {
  leader = true;
  eventCursorClientId = '';
  peerWants.clear();
  peers.post({ kind: 'leader' });
  prepareEventStream();
}

function relinquishLeadership(): void {
  lockAbort?.abort();
  lockAbort = null;
  if (!leader) return;
  stopTransports();
  leader = false;
  releaseLeadership?.();
  releaseLeadership = null;
}

/** One socket per browser: the tab holding the scope lock runs the transport, the others replay its pushes. */
function requestLeadership(): void {
  if (leader || lockAbort) return;
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || !peers.open()) {
    becomeLeader();
    return;
  }
  const abort = new AbortController();
  lockAbort = abort;
  locks.request(`${PYCORE_EVENT_LOCK_PREFIX}${peers.scope}`, { signal: abort.signal }, () => new Promise<void>((resolve) => {
    lockAbort = null;
    releaseLeadership = resolve;
    if (started && !suspended) becomeLeader();
    else resolve();
  })).catch(() => { /* aborted while queued */ });
  peers.post({ kind: 'join' });
}

export function connectPycoreHttp(): void {
  if (started) return;
  started = true;
  if (suspended) return;
  diag('info', 'starting HTTP controller and event transport');
  requestLeadership();
}

export function setPycoreActive(active: boolean): void {
  if (active === !suspended) return;
  suspended = !active;
  if (suspended) {
    if (leader) relinquishLeadership();
    else {
      lockAbort?.abort();
      lockAbort = null;
      syncLeaseFallbacks();
      updateConnectionState();
    }
    return;
  }
  if (started) requestLeadership();
}

/**
 * Hold a named pycore UI presence lease; returns the release. The open event
 * socket carries it (dropped the moment the socket closes); without one
 * (Relay, reconnecting) the generic ui/presence/lease route renews it.
 */
export function holdPycoreLease(name: PycorePresenceLease): () => void {
  const entry = leases.get(name)
    ?? { name, holders: 0, timer: null, renewMs: PYCORE_PRESENCE_DEFAULTS.renewMs, usedHttp: false };
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
    if (entry.usedHttp) void requestPresenceLease(name, false).catch(() => { /* lease lapses server-side */ });
  };
}
