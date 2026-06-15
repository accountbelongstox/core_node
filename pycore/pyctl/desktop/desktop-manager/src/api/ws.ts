/**
 * Minimal, dependency-free singleton WebSocket client for the pycore RPC v2 bus.
 *
 * The UI page is served from the Node server (:15654) but the pycore RPC bus runs
 * on the backend (:59000). We fetch /api/runtime to learn the backend WS URL, open
 * a plain browser WebSocket, and auto-reconnect on close/error.
 *
 * The server auto-registers the client and sends a {type:'welcome'} message which
 * we ignore. Broadcast events arrive as:
 *   { type:'event', event:'<name>', data:{...}, timestamp }
 *
 * Usage:
 *   connectPycoreWs();
 *   const off = subscribe('pycore_log', (data) => { ... });
 *   const off2 = onWsStatus((connected) => { ... });
 */

type EventHandler = (data: any) => void;
type StatusHandler = (connected: boolean) => void;
type DiagHandler = (line: { level: string; message: string }) => void;

const eventHandlers = new Map<string, Set<EventHandler>>();
const statusHandlers = new Set<StatusHandler>();
const diagHandlers = new Set<DiagHandler>();

/** Subscribe to connection diagnostics (URL tried, open/close/error). */
export function onWsDiag(handler: DiagHandler): () => void {
  diagHandlers.add(handler);
  return () => { diagHandlers.delete(handler); };
}

function diag(level: string, message: string) {
  // Visible in the UI's live-log panel (dev-tools are usually off in the webview).
  diagHandlers.forEach((h) => h({ level, message }));
  (level === 'error' ? console.error : console.log)(`[ws] ${message}`);
}

// Stable per-window client id, so the server keys this client consistently across
// reconnects/reloads (no accumulation of dead sessions) while distinct windows stay
// distinct clients. sessionStorage = per-tab + survives reload. Storage access can
// genuinely throw in a sandboxed webview, so it's guarded.
const CLIENT_ID_KEY = 'pycore_ws_client_id';
let clientId: string | null = null;

export function getClientId(): string {
  if (clientId) return clientId;
  const stored = sessionStorage.getItem(CLIENT_ID_KEY);
  if (stored) { clientId = stored; return clientId; }
  clientId = `ui-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  sessionStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}

function withClientId(base: string): string {
  return base + (base.includes('?') ? '&' : '?') + 'client_id=' + encodeURIComponent(getClientId());
}

let socket: WebSocket | null = null;
// The shared FastAPIWsRpcClient instance, when that path is in use. It is the
// preferred transport for request/response RPC (.call). The native-socket
// fallback speaks the SAME rpc_v2 wire protocol for requests (see nativeCall),
// so callRpc works on either path.
let sharedClient: any = null;
let connected = false;
let started = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;

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

function resolveWsUrl(): string {
  // Connect DIRECTLY to the pycore backend (same host as the page, backend port
  // 59000). A raw handshake test proved the backend accepts this WebSocket (returns
  // 101) from the page's origin. This avoids BOTH the broken same-origin Node proxy
  // (the real cause of code=1006) and any /api/runtime dependency — so a page reload
  // alone applies it, no UI-server restart needed. (pycore RPC port is 59000.)
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname}:59000/rpc/ws`;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSocket();
  }, RECONNECT_MS);
}

async function openSocket() {
  // Single socket: drop any prior one before opening a new one, so reconnects never
  // leave a second live connection (the server would otherwise see two of us).
  if (socket) { socket.onclose = null; socket.close(); socket = null; }

  // A valid ws:// URL never throws in the WebSocket constructor — failures surface
  // via onerror/onclose, which drive the reconnect. So no try/catch is needed here.
  const url = withClientId(resolveWsUrl());
  diag('info', `connecting ${url} (attempt ${reconnectAttempts + 1})`);
  const ws = new WebSocket(url);
  socket = ws;

  ws.onopen = () => { reconnectAttempts = 0; diag('info', `connected as client_id=${getClientId()}`); setConnected(true); };

  ws.onmessage = (ev) => {
    // The backend only ever sends valid JSON event frames, so parse directly.
    if (typeof ev.data !== 'string') return;
    const msg: any = JSON.parse(ev.data);
    if (!msg || typeof msg !== 'object') return;
    // Request/response frames for native callRpc (response/error with our id).
    if (settlePendingCall(msg)) return;
    // Tolerate welcome / non-event messages.
    if (msg.type === 'event' && typeof msg.event === 'string') {
      dispatch(msg.event, msg.data ?? {});
    }
  };

  ws.onclose = (ev) => {
    diag('warn', `closed code=${ev.code}${ev.reason ? ` reason=${ev.reason}` : ''} — retrying in ${RECONNECT_MS / 1000}s`);
    setConnected(false);
    if (socket === ws) socket = null;
    rejectAllPendingCalls('Connection lost');
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onerror is followed by onclose in browsers, which triggers the reconnect.
    diag('error', `error on ${url}`);
  };
}

/**
 * Drive connection through the shared rpc_v2 client (FastAPIWsRpcClient, loaded
 * from the backend via /pyapi/js/rpc/ws_rpc_client.js) when it's available — it
 * brings request/response, ACKs and a battle-tested reconnect loop, and already
 * sends our stable client_id. Falls back to the native socket below if the script
 * didn't load. Either path feeds the same subscribe/onWsStatus/onWsDiag interface.
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
  client.on('event', (msg: any) => { if (msg && typeof msg.event === 'string') dispatch(msg.event, msg.data ?? {}); });
  // The client reconnects on its own via onclose; the close code above is the signal.
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
 * itself (see nativeCall) — so RPC works even when the shared script never
 * loaded (e.g. backend was down at page load, or no /pyapi proxy exists).
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

/** Open the singleton connection (idempotent). Auto-reconnects on close/error. */
export function connectPycoreWs(): void {
  if (started) return;
  started = true;
  const Shared = (typeof window !== 'undefined') ? (window as any).FastAPIWsRpcClient : undefined;
  if (Shared) {
    startSharedClient(Shared);
  } else {
    diag('info', 'shared rpc client not loaded — using native socket');
    openSocket();
  }
}
