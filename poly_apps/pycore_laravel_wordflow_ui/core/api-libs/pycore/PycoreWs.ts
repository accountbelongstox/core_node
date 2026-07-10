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

import { pycoreWsUrlOverride, isPycoreSecureContext, pnaBlockedReason } from './pycoreTarget';

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

// Stable per-BROWSER client id so the server keys this client consistently across
// reconnects, reloads AND tabs. Uses localStorage, NOT sessionStorage: a webview
// clears sessionStorage on each page load, which minted a brand-new id every time
// ("a new id on every action"). localStorage persists until the browser profile /
// storage is cleared — i.e. a new id only when you switch browser. Storage access
// can throw in a sandboxed webview, so it stays guarded.
const CLIENT_ID_KEY = 'pycore_ws_client_id';
let clientId: string | null = null;

export function getClientId(): string {
  if (clientId) return clientId;
  try {
    // Prefer localStorage; migrate a legacy sessionStorage id forward if present.
    const stored = localStorage.getItem(CLIENT_ID_KEY) || sessionStorage.getItem(CLIENT_ID_KEY);
    if (stored) {
      clientId = stored;
      try { localStorage.setItem(CLIENT_ID_KEY, stored); } catch { /* ignore */ }
      return clientId;
    }
  } catch { /* ignore */ }
  clientId = `ui-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  try { localStorage.setItem(CLIENT_ID_KEY, clientId); } catch { /* ignore */ }
  return clientId;
}

function withClientId(base: string): string {
  return base + (base.includes('?') ? '&' : '?') + 'client_id=' + encodeURIComponent(getClientId());
}

let socket: WebSocket | null = null;
// The shared FastAPIWsRpcClient instance, when that path is in use. It is the
// preferred transport for request/response RPC (.call). The dashboard shell
// never loads the backend's ws_rpc_client.js script (cross-origin :59000), so
// in practice the NATIVE socket is always the active path here — it speaks the
// same rpc_v2 wire protocol for requests (see nativeCall), making callRpc work
// without the shared script.
let sharedClient: any = null;
let connected = false;
let started = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
// Route-scoped gate: when the active shell end does NOT use pycore (e.g. /wordnew),
// the bus is SUSPENDED — the socket is closed and all (re)connect attempts become
// no-ops, so an inactive end never reconnect-spams :59000. Resumed when a pycore
// end (pycore-manager / vortex) becomes active again. Driven by ShellContext via
// setPycoreActive(). See shellTypes.END_USES_PYCORE.
let suspended = false;

/** Synchronous check for PycoreSse to avoid async-import race on route switch. */
export function isPycoreSuspended(): boolean { return suspended; }

const RECONNECT_MS = 3000;
const CALL_TIMEOUT_MS = 30000;

// ---- native request/response support (rpc_v2 wire protocol) ---------------
// Frames: send {type:'request', id, route, params}; the server replies with
// {type:'response', id, result, error, requires_ack} (async routes deliver the
// response after a {type:'event', event:'request_accepted'} frame and expect
// an {type:'ack', id} back) or {type:'error', id, error, message}.
type PendingCall = { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };
const pendingCalls = new Map<string, PendingCall>();

function newRequestId(): string {
  try { return crypto.randomUUID(); } catch { /* older webviews */ }
  return `req-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function settlePendingCall(msg: any): boolean {
  // Returns true when the frame belonged to a pending native call.
  if (!msg.id || (msg.type !== 'response' && msg.type !== 'error')) return false;
  const entry = pendingCalls.get(msg.id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pendingCalls.delete(msg.id);
  if (msg.requires_ack && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'ack', id: msg.id }));
  }
  if (msg.type === 'error' || msg.error) {
    entry.reject(new Error(String(msg.message || msg.error || 'RPC error')));
  } else {
    entry.resolve(msg.result);
  }
  return true;
}

function rejectAllPendingCalls(reason: string) {
  pendingCalls.forEach((entry) => { clearTimeout(entry.timer); entry.reject(new Error(reason)); });
  pendingCalls.clear();
}

function nativeCall(method: string, params: any, timeoutMs: number): Promise<any> {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('RPC unavailable: WebSocket not connected.'));
  }
  const id = newRequestId();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCalls.delete(id);
      reject(new Error(`RPC timeout after ${timeoutMs}ms: ${method}`));
    }, timeoutMs);
    pendingCalls.set(id, { resolve, reject, timer });
    socket!.send(JSON.stringify({ type: 'request', id, route: method, params: params ?? {} }));
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
  set.forEach((h) => { h(data); });
}

// When SSE is the broadcast-event source, the WS onmessage path stops
// dispatching {type:'event'} frames to avoid DUPLICATE delivery. Defaults to
// false so events still flow over WS as a graceful fallback if SSE never
// connects. PycoreSse flips this via setSseEventsActive() once its stream opens.
let sseEventsActive = false;

/** Called by PycoreSse to take over (true) / release (false) broadcast-event
 *  dispatch from the WS path. RPC request/response on WS is unaffected. */
export function setSseEventsActive(active: boolean): void {
  sseEventsActive = active;
}

/** Feed a broadcast event into the existing subscribe() handlers from an
 *  external transport (PycoreSse). RPC stays on WS. */
export function dispatchEvent(event: string, data: any): void {
  dispatch(event, data);
}

function resolveWsUrl(): string {
  // Whole-UI remote target (pycoreTarget): when the user points the
  // pycore-manager at another node's :59000, the RPC WS follows it too. Applied
  // on (re)connect — switching the target reloads the page (see pycoreTarget).
  const remote = pycoreWsUrlOverride();
  if (remote) return remote;
  // Connect DIRECTLY to the pycore backend (same host as the page, backend port
  // 59000). This avoids a same-origin proxy dependency; a page reload alone
  // applies it. (pycore RPC port is 59000.)
  // BY DESIGN this does NOT follow the laravel API endpoint switcher: pycore is
  // a local (same-machine) service. When the API endpoint points at a remote
  // server, pycore features still require the local pycore service.
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const isSandbox = location.hostname.includes('asia-southeast1.run.app') || location.hostname.includes('run.app') || location.port === '3000';
  if (isSandbox) {
    return `${proto}://${location.host}/pyapi/rpc/ws`;
  }
  return `${proto}://${location.hostname}:59000/rpc/ws`;
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
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, RECONNECT_MS);
}

function openSocket() {
  if (suspended) return;            // route inactive — do not open
  // Never stack connections: if a socket is already open or still connecting, keep
  // it. Opening a 2nd socket with the same client_id makes the server SUPERSEDE the
  // first (closes it), whose close handler then reconnects — the connect/disconnect
  // churn seen in the backend log. One socket per client.
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  if (socket) { socket.onclose = null; socket.close(); socket = null; }

  const url = withClientId(resolveWsUrl());
  diag('info', `connecting ${url} (attempt ${reconnectAttempts + 1})`);
  const ws = new WebSocket(url);
  socket = ws;

  ws.onopen = () => {
    reconnectAttempts = 0;
    // Re-arm the one-time unreachable warning for any FUTURE outage.
    unreachableHintLogged = false;
    diag('info', `connected as client_id=${getClientId()}`);
    setConnected(true);
  };

  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return;
    let msg: any;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    // Request/response frames for native callRpc (response/error with our id).
    if (settlePendingCall(msg)) return;
    // SSE owns broadcast-event delivery when connected; skip here to avoid
    // duplicates. Falls back to WS dispatch when SSE is not active.
    if (!sseEventsActive && msg.type === 'event' && typeof msg.event === 'string') {
      dispatch(msg.event, msg.data ?? {});
    }
  };

  ws.onclose = (ev) => {
    setConnected(false);
    if (socket === ws) socket = null;
    rejectAllPendingCalls('Connection lost');
    // 4000 = server "superseded": a newer connection for our client_id took over
    // (e.g. another tab/instance of this origin). Do NOT reconnect, or the two
    // sockets would supersede each other forever (connect/disconnect churn).
    if (ev.code === 4000) {
      diag('warn', 'superseded by a newer connection (same client_id) — not reconnecting');
      return;
    }
    diag('warn', `closed code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ''} — retrying in ${RECONNECT_MS / 1000}s`);
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

/**
 * Drive connection through the shared rpc_v2 client (FastAPIWsRpcClient) when it
 * is available on window — it brings request/response, ACKs and a battle-tested
 * reconnect loop. Falls back to the native socket below otherwise. Either path
 * feeds the same subscribe/onWsStatus/onWsDiag interface.
 */
function startSharedClient(Ctor: any): void {
  const base = resolveWsUrl(); // the shared client appends ?client_id= itself
  diag('info', `using shared FastAPIWsRpcClient -> ${base}`);
  const client = new Ctor(base, {
    reconnect: true,
    reconnectInterval: RECONNECT_MS,
    maxReconnectAttempts: Number.MAX_SAFE_INTEGER,
  });
  client.on('connection', () => { diag('info', `connected as client_id=${client.clientId}`); setConnected(true); });
  client.on('disconnect', (d: any) => { diag('warn', `disconnected code=${d?.code ?? '?'}${d?.reason ? ` reason=${d.reason}` : ''} — retrying`); setConnected(false); });
  client.on('reconnect', (d: any) => diag('info', `reconnecting (attempt ${d?.attempt ?? '?'})`));
  client.on('event', (msg: any) => { if (!sseEventsActive && msg && typeof msg.event === 'string') dispatch(msg.event, msg.data ?? {}); });
  // Keep a module ref so callRpc() can issue request/response RPCs through it.
  sharedClient = client;
  client.connect();
}

/** Alias for subscribe(), per the WS bus naming used by callers. */
export function subscribeWs(event: string, handler: EventHandler): () => void {
  return subscribe(event, handler);
}

/**
 * Request/response RPC over the rpc_v2 bus. Prefers the shared
 * FastAPIWsRpcClient (which implements .call) when its script was loaded;
 * otherwise the native-socket path issues the SAME rpc_v2 request frame
 * itself (see nativeCall) — so RPC works in the dashboard shell, which never
 * loads the backend's shared client script.
 */
export function callRpc(method: string, params: any = {}, timeoutMs: number = CALL_TIMEOUT_MS): Promise<any> {
  if (sharedClient && typeof sharedClient.call === 'function') {
    if (!connected) {
      return Promise.reject(new Error('RPC unavailable: WebSocket not connected.'));
    }
    return sharedClient.call(method, params, timeoutMs);
  }
  return nativeCall(method, params, timeoutMs);
}

/** Open the singleton connection (idempotent). Auto-reconnects on close/error.
 *  When the route gate is suspended (a non-pycore end is active) this records the
 *  intent (started=true) but defers the actual open until setPycoreActive(true). */
export function connectPycoreWs(): void {
  if (started) return;
  started = true;
  if (suspended) {
    diag('info', 'connect requested while route inactive — deferring until a pycore end is active');
    return;
  }
  // Broadcast events migrate to SSE (RPC stays on WS). Started lazily here so
  // every existing consumer that calls connectPycoreWs() also gets SSE, with no
  // change to their subscribe()/onWsStatus() calls. Lazy import keeps this
  // module's load dependency-free and avoids a static import cycle.
  import('./PycoreSse').then(({ connectPycoreSse }) => { connectPycoreSse(); }).catch(() => { /* SSE best-effort; WS fallback dispatches events */ });
  const Shared = (typeof window !== 'undefined') ? (window as any).FastAPIWsRpcClient : undefined;
  if (Shared) {
    startSharedClient(Shared);
  } else {
    diag('info', 'shared rpc client not loaded — using native socket');
    openSocket();
  }
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
  if (active) {
    diag('info', 'route active — resuming pycore bus');
    reconnectAttempts = 0;
    import('./PycoreSse').then(({ setPycoreSseActive }) => { setPycoreSseActive(true); }).catch(() => { /* best-effort */ });
    if (started) {
      if (sharedClient && typeof sharedClient.connect === 'function') {
        try { sharedClient.connect(); } catch { /* ignore */ }
      } else {
        openSocket();
      }
    }
  } else {
    diag('info', 'route inactive — suspending pycore bus (closing WS/SSE)');
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (sharedClient && typeof sharedClient.disconnect === 'function') {
      try { sharedClient.disconnect(); } catch { /* ignore */ }
    }
    if (socket) {
      const s = socket;
      socket = null;
      // Detach handlers so the close we trigger does not schedule a reconnect.
      s.onopen = null; s.onmessage = null; s.onerror = null; s.onclose = null;
      try { s.close(); } catch { /* ignore */ }
    }
    rejectAllPendingCalls('pycore bus suspended (route inactive)');
    setConnected(false);
    import('./PycoreSse').then(({ setPycoreSseActive }) => { setPycoreSseActive(false); }).catch(() => { /* best-effort */ });
  }
}
