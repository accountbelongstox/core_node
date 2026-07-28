/**
 * PycoreWs — minimal, dependency-free singleton WebSocket client for the pycore
 * RPC v2 bus, ported for the dashboard's pycore-manager end.
 *
 * The page is served by the shell (Vite dev :5173 etc.) but the pycore RPC bus
 * runs on the backend (:59000). This connects DIRECTLY to
 * `ws://<host>:59000/rpc/ws` with auto-reconnect on close/error. It only works
 * when the backend is reachable at that host (degrades silently otherwise — the
 * reconnect loop simply keeps retrying and onWsStatus reports disconnected).
 *
 * Broadcast events arrive as:
 *   { type:'event', event:'<name>', data:{...}, timestamp }
 *
 * Usage:
 *   connectPycoreWs();
 *   const off = subscribe('pycore_log', (data) => { ... });
 *   const off2 = onWsStatus((connected) => { ... });
 */

import { PYCORE_PORT, buildPycoreWsUrl } from './pycoreEndpoints';
import { pycoreWsUrlOverride, isPycoreSecureContext, pnaBlockedReason, directPycoreHost } from './pycoreTarget';
import { appendHttpDebug, summarizeHttpParams, rpcRouteToHttpMethod } from './pycoreHttpLog';

type EventHandler = (data: any) => void;
type StatusHandler = (connected: boolean) => void;
type DiagHandler = (line: { level: string; message: string }) => void;

const eventHandlers = new Map<string, Set<EventHandler>>();
const statusHandlers = new Set<StatusHandler>();
const diagHandlers = new Set<DiagHandler>();

/** One-time explicit unreachable warning (global log panel), so the
 *  same-host-only design doesn't degrade SILENTLY (see logRemoteHintOnce). */
let unreachableHintLogged = false;

/** Subscribe to connection diagnostics (URL tried, open/close/error). */
export function onWsDiag(handler: DiagHandler): () => void {
  diagHandlers.add(handler);
  return () => { diagHandlers.delete(handler); };
}

function diag(level: string, message: string) {
  diagHandlers.forEach((h) => h({ level, message }));
  (level === 'error' ? console.error : console.log)(`[pycore-ws] ${message}`);
}

// Stable browser profile id (localStorage) + per-tab connection id (sessionStorage).
// The server allows ONE live WS per client_id; sharing one id across tabs makes the
// newest connection supersede the older one (close 4000). Durable owner tasks can
// still key off getBrowserId() separately from getClientId().
const BROWSER_ID_KEY = 'pycore_ws_browser_id';
const TAB_ID_KEY = 'pycore_ws_tab_id';
/** Legacy single-id key — migrated into browser id, then cleared. */
const LEGACY_CLIENT_ID_KEY = 'pycore_ws_client_id';

let browserId: string | null = null;
let tabId: string | null = null;
let clientId: string | null = null;

function mintId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getBrowserId(): string {
  if (browserId) return browserId;
  try {
    const stored = localStorage.getItem(BROWSER_ID_KEY)
      || localStorage.getItem(LEGACY_CLIENT_ID_KEY)
      || sessionStorage.getItem(LEGACY_CLIENT_ID_KEY);
    if (stored) {
      browserId = stored;
      try { localStorage.setItem(BROWSER_ID_KEY, stored); } catch { /* ignore */ }
      try { localStorage.removeItem(LEGACY_CLIENT_ID_KEY); } catch { /* ignore */ }
      return browserId;
    }
  } catch { /* ignore */ }
  browserId = mintId('browser');
  try { localStorage.setItem(BROWSER_ID_KEY, browserId); } catch { /* ignore */ }
  return browserId;
}

function getTabId(): string {
  if (tabId) return tabId;
  try {
    const stored = sessionStorage.getItem(TAB_ID_KEY);
    if (stored) {
      tabId = stored;
      return tabId;
    }
  } catch { /* ignore */ }
  tabId = mintId('tab');
  try { sessionStorage.setItem(TAB_ID_KEY, tabId); } catch { /* ignore */ }
  return tabId;
}

/** Per-tab WS identity: browserId:tabId. Never shared across tabs. */
export function getClientId(): string {
  if (clientId) return clientId;
  clientId = `${getBrowserId()}:${getTabId()}`;
  return clientId;
}

/** Mint a fresh tab segment after server supersede so this page can reconnect. */
function rotateTabClientId(): string {
  tabId = mintId('tab');
  try { sessionStorage.setItem(TAB_ID_KEY, tabId); } catch { /* ignore */ }
  clientId = `${getBrowserId()}:${tabId}`;
  return clientId;
}

function withClientId(base: string): string {
  return base + (base.includes('?') ? '&' : '?') + 'client_id=' + encodeURIComponent(getClientId());
}

const RESUME_TOKEN_KEY = 'pycore_ws_resume_token';

function getResumeToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(RESUME_TOKEN_KEY);
    }
  } catch { /* blocked */ }
  return null;
}

function setResumeToken(token: string | null | undefined): void {
  if (!token) return;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(RESUME_TOKEN_KEY, String(token));
    }
  } catch { /* blocked */ }
}

let socket: WebSocket | null = null;
let connected = false;
let connectionId: string | null = null;
let lastAckedSeq = 0;
const processedServerEvents = new Set<string>();
const MAX_PROCESSED_SERVER_EVENTS = 512;
let started = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let reconnectDelayMs = 1_000;
// Route-scoped gate: when the active shell end does NOT use pycore (e.g. /wordnew),
// the bus is SUSPENDED — the socket is closed and all (re)connect attempts become
// no-ops, so an inactive end never reconnect-spams :59000. Resumed when a pycore
// end (pycore-manager / vortex) becomes active again. Driven by ShellContext via
// setPycoreActive(). See shellTypes.END_USES_PYCORE.
let suspended = false;

/** Synchronous check for PycoreSse to avoid async-import race on route switch. */
export function isPycoreSuspended(): boolean { return suspended; }

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_JITTER_MS = 250;
const DEFAULT_RPC_TIMEOUT_MS = 30_000;

// ---- native request/response support (rpc_v2 wire protocol) ---------------
// Frames: send {type:'request', id, route, params}; the server replies with
// {type:'response', id, result, error, requires_ack} (async routes deliver the
// response after a {type:'event', event:'request_accepted'} frame and expect
// an {type:'ack', id} back) or {type:'error', id, error, message}.
type PendingCall = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  frame: { type: 'request'; id: string; event_id: string; client_id: string; route: string; params: any };
  sent: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  timeoutMs: number;
  createdAt: number;
  deadlineAt: number;
};
const pendingCalls = new Map<string, PendingCall>();

function newRequestId(): string {
  try { return crypto.randomUUID(); } catch { /* older webviews */ }
  return `req-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function clearPendingTimer(entry: PendingCall): void {
  if (entry.timer != null) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

function armPendingTimer(entry: PendingCall): void {
  clearPendingTimer(entry);
  const id = entry.frame.id;
  const method = entry.frame.route;
  const remaining = entry.deadlineAt - Date.now();
  if (remaining <= 0) {
    if (!pendingCalls.has(id)) return;
    pendingCalls.delete(id);
    entry.reject(new Error(`RPC timeout after ${entry.timeoutMs}ms: ${method}`));
    return;
  }
  entry.timer = setTimeout(() => {
    if (!pendingCalls.has(id)) return;
    pendingCalls.delete(id);
    entry.timer = null;
    entry.reject(new Error(`RPC timeout after ${entry.timeoutMs}ms: ${method}`));
  }, remaining);
}

function rejectPendingCall(id: string, error: Error): void {
  const entry = pendingCalls.get(id);
  if (!entry) return;
  pendingCalls.delete(id);
  clearPendingTimer(entry);
  entry.reject(error);
}

/** Reject every in-flight RPC (close without reconnect, suspend, or supersede). */
function rejectAllPending(reason: string): void {
  const err = new Error(reason);
  const ids = Array.from(pendingCalls.keys());
  for (const id of ids) {
    rejectPendingCall(id, err);
  }
}

function settlePendingCall(msg: any): boolean {
  // Returns true when the frame belonged to a pending native call.
  const eventId = msg.request_id || msg.event_id || msg.id;
  if (!eventId || (msg.type !== 'response' && msg.type !== 'error')) return false;
  const entry = pendingCalls.get(eventId);
  if (!entry) return false;
  pendingCalls.delete(eventId);
  clearPendingTimer(entry);
  if (msg.type === 'error' || msg.error) {
    entry.reject(new Error(String(msg.message || msg.error || 'RPC error')));
  } else {
    entry.resolve(msg.result);
  }
  if (msg.requires_ack && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'ack', id: eventId, event_id: eventId, client_id: getClientId() }));
  }
  return true;
}

// ---- WS traffic logging ----------------------------------------------------
let _wsLogEnabled = false;

/** Enable/disable console logging of every WS frame sent and received. */
export function setWsLogEnabled(on: boolean): void { _wsLogEnabled = on; }
export function isWsLogEnabled(): boolean { return _wsLogEnabled; }

function wsLog(dir: '>>>' | '<<<', routeOrType: string, payload: any, id?: string): void {
  if (!_wsLogEnabled) return;
  const tag = id ? `#${id.slice(0, 8)}` : '';
  const body = typeof payload === 'string' && payload.length > 2000
    ? payload.slice(0, 2000) + `… (${payload.length} chars)`
    : payload;
  console.log(`%c[WS ${dir}] %c${routeOrType}%c ${tag}`,
    'color:#888', 'color:#4fc3f7;font-weight:bold', 'color:#888',
    typeof body === 'object' ? body : body);
}

function sendPendingCall(entry: PendingCall): void {
  // Only send when the RPC v2 welcome handshake completed (protocol-ready).
  if (!connected || !socket || socket.readyState !== WebSocket.OPEN || entry.sent) return;
  // Refresh client_id on the wire in case we rotated after supersede.
  entry.frame.client_id = getClientId();
  socket.send(JSON.stringify(entry.frame));
  entry.sent = true;
  // Re-send after reconnect only re-arms the remaining budget; deadline is fixed at enqueue.
  armPendingTimer(entry);
}

function nativeCall(method: string, params: any, timeoutMs?: number): Promise<any> {
  const id = newRequestId();
  const waitMs = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : DEFAULT_RPC_TIMEOUT_MS;
  const now = Date.now();
  const frame = {
    type: 'request' as const,
    request_id: id,
    id,
    event_id: id,
    client_id: getClientId(),
    route: method,
    params: params ?? {},
  };
  wsLog('>>>', method, params, id);
  return new Promise((resolve, reject) => {
    const entry: PendingCall = {
      resolve,
      reject,
      frame,
      sent: false,
      timer: null,
      timeoutMs: waitMs,
      createdAt: now,
      deadlineAt: now + waitMs,
    };
    pendingCalls.set(id, entry);
    // Arm timer immediately so requests don't hang forever if WS is disconnected.
    armPendingTimer(entry);
    sendPendingCall(entry);
  });
}

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  statusHandlers.forEach((h) => { h(connected); });
}

export function isWsConnected(): boolean {
  return connected;
}

/** Subscribe to connection-status changes. Returns an unsubscribe function. */
export function onWsStatus(handler: StatusHandler): () => void {
  statusHandlers.add(handler);
  // Push current state immediately so late subscribers are in sync.
  handler(connected);
  return () => { statusHandlers.delete(handler); };
}

/** Register an event handler. Returns an unsubscribe function. */
export function subscribe(event: string, handler: EventHandler): () => void {
  let set = eventHandlers.get(event);
  if (!set) { set = new Set(); eventHandlers.set(event, set); }
  set.add(handler);
  return () => {
    const s = eventHandlers.get(event);
    if (s) { s.delete(handler); if (!s.size) eventHandlers.delete(event); }
  };
}

function dispatch(event: string, data: any) {
  const set = eventHandlers.get(event);
  if (!set) return;
  // Isolate each handler so a single subscriber error never blocks others.
  // Also prevents unhandled exceptions from breaking the live bus.
  set.forEach((h) => {
    try { h(data); } catch (err) {
      // Best-effort diagnostics only.
      // eslint-disable-next-line no-console
      console.error(`[pycore-ws] handler for "${event}" failed`, err);
    }
  });
}

// Durable topics use WebSocket server_event + ACK; SSE remains compatibility-only
// for legacy THREAD_BUS broadcast frames (pycore_log, etc.).
const DURABLE_WS_TOPICS = new Set(['operation.changed', 'queue.overview.changed', 'queue.priority.changed']);

function sendServerEventAck(msg: any): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const eventId = String(msg.event_id || '');
  const seq = Number(msg.seq || 0);
  if (!eventId || !seq) return;
  socket.send(JSON.stringify({
    type: 'ack',
    client_id: getClientId(),
    connection_id: connectionId,
    event_id: eventId,
    seq,
  }));
}

function handleServerEvent(msg: any): void {
  const eventId = String(msg.event_id || '');
  if (eventId) {
    if (processedServerEvents.has(eventId)) {
      if (msg.requires_ack) sendServerEventAck(msg);
      return;
    }
    processedServerEvents.add(eventId);
    if (processedServerEvents.size > MAX_PROCESSED_SERVER_EVENTS) {
      const drop = processedServerEvents.values().next().value;
      if (drop) processedServerEvents.delete(drop);
    }
  }
  const topic = String(msg.topic || '');
  const payload = msg.payload ?? {};
  if (topic) {
    dispatch(topic, payload);
  }
  if (msg.requires_ack) sendServerEventAck(msg);
}

let sseEventsActive = false;

/** Called by PycoreSse to take over (true) / release (false) legacy broadcast-event
 *  dispatch from the WS path. Durable server_event topics always use WS. */
export function setSseEventsActive(active: boolean): void {
  sseEventsActive = active;
}

/** Feed a broadcast event into the existing subscribe() handlers from an
 *  external transport (PycoreSse). RPC stays on WS. */
export function dispatchEvent(event: string, data: any): void {
  dispatch(event, data);
}

function resolveWsUrl(): string {
  const override = pycoreWsUrlOverride();
  if (override) return override;
  if (typeof location !== 'undefined' && location.port === String(PYCORE_PORT)) {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/rpc/ws`;
  }
  return buildPycoreWsUrl(directPycoreHost());
}

/**
 * After repeated failed connect attempts, surface ONE explicit warning in the
 * global operation log (lazy-imported to keep this module dependency-free at
 * load time) instead of degrading silently. Mentions the same-host design and,
 * when the laravel API base points at a different host, that pycore does NOT
 * follow the endpoint switcher.
 */
function logUnreachableHintOnce() {
  if (unreachableHintLogged) return;
  unreachableHintLogged = true;
  // Private Network Access: a non-secure-context page is blocked from reaching a
  // loopback/private WS - the most common reason for a silent connect failure
  // when the browser is NOT on the pycore machine, or the page is plain HTTP.
  const pnaReason = pnaBlockedReason(location.hostname);
  const secureNote = (!isPycoreSecureContext() && !pnaReason)
    ? ' Page is not a secure context (HTTP public IP); if the target is 127.0.0.1 or a private IP, Private Network Access blocks it - use HTTPS, localhost, or the Chrome flag chrome://flags/#block-insecure-private-network-requests.'
    : (pnaReason ? ` ${pnaReason}` : '');
  import('../../logstore/logStore')
    .then(({ logWarn }) => {
      let apiHostNote = '';
      try {
        // Lazy too: avoids a static cycle (BaseAPI imports logStore as well).
        return import('../../api/base/BaseAPI').then(({ getSharedBaseURL }) => {
          const base = getSharedBaseURL();
          if (base) {
            try {
              const apiHost = new URL(base).hostname;
              if (apiHost !== location.hostname) {
                apiHostNote = ` Note: the API endpoint points at ${apiHost}, but pycore does NOT follow the endpoint switcher — it always connects to this page's host.`;
              }
            } catch { /* unparsable base — skip the note */ }
          }
          logWarn(
            'pycore',
            `pycore WS (ws://${location.hostname}:59000/rpc/ws) unreachable after repeated retries — pycore features need the pycore service running on this machine.${apiHostNote}${secureNote}`
          );
        });
      } catch {
        logWarn('pycore', `pycore WS (ws://${location.hostname}:59000/rpc/ws) unreachable after repeated retries.${secureNote}`);
        return undefined;
      }
    })
    .catch(() => { /* logging is best-effort */ });
}

function scheduleReconnect() {
  if (suspended) return;            // route inactive — do not reconnect
  if (reconnectTimer) return;
  // Don't reconnect if a socket is already live — avoids stacking/churn.
  if (socket && socket.readyState === WebSocket.OPEN) return;
  reconnectAttempts += 1;
  const jitter = Math.max(0, Math.floor(Math.random() * RECONNECT_JITTER_MS));
  const delayMs = Math.min(RECONNECT_MAX_MS, reconnectDelayMs + jitter);
  reconnectDelayMs = Math.min(RECONNECT_MAX_MS, reconnectDelayMs * 2);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, delayMs);
}

/** Subscribe to durable RPC completions delivered after reconnect or reload. */
export function subscribeRpcCompletion(handler: EventHandler): () => void {
  return subscribe('rpc_completion', handler);
}

function openSocket() {
  if (suspended) return;            // route inactive — do not open
  // Never stack connections: if a socket is already open or still connecting, keep
  // it. Opening a 2nd socket with the same client_id makes the server SUPERSEDE the
  // first (closes it), whose close handler then reconnects — the connect/disconnect
  // churn seen in the backend log. One socket per client.
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (socket) { socket.onclose = null; socket.close(); socket = null; }

  // New socket: protocol not ready until welcome. isWsConnected() tracks RPC ready.
  setConnected(false);
  pendingCalls.forEach((entry) => {
    clearPendingTimer(entry);
    entry.sent = false;
  });

  const url = withClientId(resolveWsUrl());
  diag('info', `connecting ${url} (attempt ${reconnectAttempts + 1})`);
  const ws = new WebSocket(url);
  socket = ws;

  ws.onopen = () => {
    reconnectAttempts = 0;
    reconnectDelayMs = RECONNECT_MIN_MS;
    unreachableHintLogged = false;
    diag('info', `socket open as client_id=${getClientId()} — sending hello`);
    ws.send(JSON.stringify({
      type: 'hello',
      protocol_version: 2,
      client_id: getClientId(),
      resume_token: getResumeToken(),
      last_acked_seq: lastAckedSeq,
      capabilities: { ack: true, replay: true },
    }));
    if (_wsLogEnabled) console.log(`%c[WS] %cOPEN %cclient_id=${getClientId()} (hello sent)`,
      'color:#66bb6a', 'color:#4fc3f7;font-weight:bold', 'color:#888');
  };

  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return;
    let msg: any;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'welcome') {
      connectionId = msg.connection_id ? String(msg.connection_id) : null;
      setResumeToken(msg.resume_token);
      if (msg.highest_contiguous_acked_seq != null) {
        lastAckedSeq = Math.max(lastAckedSeq, Number(msg.highest_contiguous_acked_seq) || 0);
      }
      diag('info', `welcome received for client_id=${msg.client_id || getClientId()}`);
      setConnected(true);
      pendingCalls.forEach((entry) => {
        clearPendingTimer(entry);
        entry.sent = false;
        sendPendingCall(entry);
      });
      return;
    }
    if (msg.type === 'ack_confirmation' && msg.success) {
      if (msg.highest_contiguous_acked_seq != null) {
        lastAckedSeq = Math.max(lastAckedSeq, Number(msg.highest_contiguous_acked_seq) || 0);
      }
      return;
    }
    if (msg.type === 'server_event') {
      wsLog('<<<', `server_event:${msg.topic || '?'}`, msg.payload ?? {}, msg.event_id);
      handleServerEvent(msg);
      return;
    }
    // Request/response frames for native callRpc (response/error with our id).
    if (settlePendingCall(msg)) {
      const dir = msg.type === 'error' ? '<<< ERR' : '<<<';
      wsLog(dir as '<<<', msg.type === 'error' ? (msg.error || 'error') : 'response',
        msg.type === 'error' ? msg : (msg.result ?? msg), msg.id);
      return;
    }
    if (msg.type === 'response' || msg.type === 'error') {
      // A completion can arrive after the original promise timed out, or after
      // a page reload. Durable async completions need an ACK; late sync replies
      // (e.g. timed-out ui.ping) must not surface as unknown rpc_completion.
      const eventId = msg.event_id || msg.id;
      if (msg.requires_ack && eventId && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'ack',
          id: eventId,
          event_id: eventId,
          client_id: getClientId(),
        }));
      }
      if (msg.sync_response || msg.requires_ack !== true) {
        wsLog('<<<', 'late_sync', msg, eventId);
        return;
      }
      wsLog('<<<', 'rpc_completion', msg, eventId);
      dispatch('rpc_completion', msg);
      return;
    }
    // Broadcast events from server.
    if (msg.type === 'event' && typeof msg.event === 'string') {
      wsLog('<<<', `event:${msg.event}`, msg.data ?? {});
      if (!sseEventsActive || DURABLE_WS_TOPICS.has(msg.event)) {
        dispatch(msg.event, msg.data ?? {});
      }
      return;
    }
    // Unrecognised frame.
    if (_wsLogEnabled) {
      console.log(`[WS] %c<?> %cunhandled frame`, 'color:#ffb74d', 'color:#888', msg.type || '?');
    }
  };

  ws.onclose = (ev) => {
    setConnected(false);
    if (socket === ws) socket = null;
    // 4000 = server "superseded": another connection claimed this client_id.
    // Rotate the tab id, fail pending RPCs, and reconnect — never leave
    // started=true with socket=null and no reconnect path.
    if (ev.code === 4000) {
      const oldId = getClientId();
      const newId = rotateTabClientId();
      rejectAllPending(`WS superseded (client_id ${oldId} → ${newId})`);
      diag('warn', `superseded (client_id rotated ${oldId} → ${newId}) — reconnecting`);
      reconnectAttempts = 0;
      reconnectDelayMs = RECONNECT_MIN_MS;
      if (!suspended && started) scheduleReconnect();
      return;
    }
    // Transient close: keep pending for resend after welcome; clear old timers
    // so a single call never has overlapping timers across reconnects.
    pendingCalls.forEach((entry) => {
      clearPendingTimer(entry);
      entry.sent = false;
    });
    const nextDelay = Math.min(RECONNECT_MAX_MS, reconnectDelayMs + Math.max(0, Math.floor(Math.random() * RECONNECT_JITTER_MS)));
    diag(
      'warn',
      `closed code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ''} — retrying in ${Math.round(nextDelay / 1000)}s`,
    );
    // 3rd consecutive failure → one explicit global-log warning (not silent).
    if (reconnectAttempts >= 3) {
      logUnreachableHintOnce();
    }
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onerror is followed by onclose in browsers, which triggers the reconnect.
    diag('error', `error on ${url}`);
  };
}

/** Alias for subscribe(), per the WS bus naming used by callers. */
export function subscribeWs(event: string, handler: EventHandler): () => void {
  return subscribe(event, handler);
}

/**
 * Request/response RPC over the native rpc_v2 WebSocket bus.
 */
export function callRpc(method: string, params: any = {}, timeoutMs?: number): Promise<any> {
  // Instrument every FE->pycore native RPC for the PcHttpDebugger.
  const nowFn = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const startedAt = nowFn();
  const wsPath = (params && typeof params.path === 'string') ? params.path : method;
  const paramsSummary = summarizeHttpParams(params);
  const record = (status: number, error?: string | null) => {
    appendHttpDebug({
      direction: 'pycore',
      method: rpcRouteToHttpMethod(method),
      route: method,
      path: wsPath,
      paramsSummary,
      status,
      ms: nowFn() - startedAt,
      error: error || null,
    });
  };
  return nativeCall(method, params, timeoutMs)
    .then((r: any) => { record(200); return r; })
    .catch((e: any) => { record(0, e?.message || String(e)); throw e; });
}

function ensureSseConnected(): void {
  // RPC v2 standard: WebSocket is the canonical broadcast transport; SSE is
  // compatibility-only (legacy clients). The UI no longer auto-starts the SSE
  // stream — broadcast events arrive on the WS 'event' frames, so the connect/
  // disconnect churn that produced idle "[SSE] disconnected" backend noise is
  // gone. PycoreSse remains importable for manual/legacy use.
}

/** Open the singleton connection (idempotent). Auto-reconnects on close/error.
 *  When the route gate is suspended (a non-pycore end is active) this records the
 *  intent (started=true) but defers the actual open until setPycoreActive(true). */
export function connectPycoreWs(): void {
  if (started) return;
  started = true;
  // Enable WS traffic logging in dev (toggle via `window.__pycoreWsLog = false`).
  try {
    if (typeof window !== 'undefined' && (window as any).__pycoreWsLog !== false) {
      setWsLogEnabled(true);
    }
    // Expose toggles on window for devtools.
    if (typeof window !== 'undefined') {
      (window as any).__pycoreWsLog = _wsLogEnabled;
      Object.defineProperty(window, '__pycoreWsLog', {
        get: () => _wsLogEnabled,
        set: (v: boolean) => setWsLogEnabled(v),
        configurable: true,
      });
    }
  } catch { /* sandboxed */ }
  if (suspended) {
    diag('info', 'connect requested while route inactive — deferring until a pycore end is active');
    reconnectAttempts = 0;
    reconnectDelayMs = RECONNECT_MIN_MS;
    return;
  }
  ensureSseConnected();
  diag('info', 'using native WebSocket RPC v2 client');
  openSocket();
}

/**
 * Route-scoped gate for the whole pycore live bus (WS + SSE). The shell calls
 * this on every end change: active=true for ends that use pycore (pycore-manager,
 * vortex), active=false for every other end (wordnew / wordflow / laravel-manager
 * / home). Suspending CLOSES the socket and stops all reconnect attempts so an
 * inactive route never reconnect-spams :59000; resuming reopens it when a consumer
 * had asked for it (started). Idempotent — repeated same-state calls are no-ops.
 */
export function setPycoreActive(active: boolean): void {
  if (active === !suspended) return;      // already in the requested state
  suspended = !active;
  // Keep SSE on the same route gate as WS (SSE is compat-only; not auto-started).
  try {
    void import('./PycoreSse')
      .then((m) => { if (typeof m.setPycoreSseActive === 'function') m.setPycoreSseActive(active); })
      .catch(() => { /* ignore */ });
  } catch {
    /* sandboxed */
  }
  if (active) {
    diag('info', 'route active — resuming pycore bus');
    reconnectAttempts = 0;
    reconnectDelayMs = RECONNECT_MIN_MS;
    if (started) {
      ensureSseConnected();
      openSocket();
    }
  } else {
    diag('info', 'route inactive — suspending native pycore WS');
    reconnectAttempts = 0;
    reconnectDelayMs = RECONNECT_MIN_MS;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (socket) {
      const s = socket;
      socket = null;
      // Detach handlers so the close we trigger does not schedule a reconnect.
      s.onopen = null; s.onmessage = null; s.onerror = null; s.onclose = null;
      try { s.close(); } catch { /* ignore */ }
    }
    rejectAllPending('pycore WS suspended (route inactive)');
    setConnected(false);
  }
}
