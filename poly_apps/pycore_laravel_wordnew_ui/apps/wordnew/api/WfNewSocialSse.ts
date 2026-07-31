/**
 * WfNewSocialSse — dependency-free EventSource client for the wordnew SOCIAL
 * realtime stream (SOCIAL_FEATURE_SPECIFICATION.md §3 "SSE").
 *
 * Uses WordNew's own single auto-reconnecting SSE transport:
 * EventSource, `?cursor=` resume from the last seen `_id`, ping keep-alive, and a
 * tiny `subscribe(event, handler)` bus. It is SEPARATE from the request/response
 * impls (WfNewApiHttp / WfNewApiMock) — it only delivers push events; all reads
 * and writes still go through `wfNewApi`.
 *
 * Endpoint: `{base}/api/app_qy_v1/social/stream?cursor=<lastId>` where `base` is
 * the current wordnew endpoint (:9000) from `wfNewEndpoints`. EventSource cannot
 * set an Authorization header, so the Sanctum bearer token (same localStorage key
 * the http impl uses, `wfnew_auth_token`) is passed as `?token=` for the backend's
 * custom.authenticate to read (cookies, when present, also authenticate it).
 *
 * Events (each payload carries `_id` = the resume cursor):
 *   message.new · friend.request · friend.accept · friend.online · friend.offline
 *   · notification.new · presence.update
 * Envelopes: stream.open / ping / stream.close (cursor only, never dispatched).
 *
 * Degrades gracefully: offline (no reachable backend) → EventSource errors and the
 * client just keeps retrying; mock mode never starts it. No third-party deps.
 */
import { wfNewEndpoints } from './WfNewEndpoints';
import { WfNewApiPaths } from './WfNewApiPaths';
import { loadToken } from './WfNewApiTransport';

/** The social push-event names (also accepts any future name generically). */
export type WfNewSocialEvent =
  | 'message.new' | 'friend.request' | 'friend.accept'
  | 'friend.online' | 'friend.offline' | 'notification.new' | 'presence.update'
  // Social Center push events (plaza posts + live rooms).
  | 'post.created' | 'post.liked' | 'post.comment'
  | 'live.started' | 'live.chat.new';

type Handler = (payload: any) => void;

const ENVELOPE_OPEN = 'stream.open';
const ENVELOPE_PING = 'ping';
const ENVELOPE_CLOSE = 'stream.close';

const RECONNECT_MS = 3000;

let source: EventSource | null = null;
let started = false;
let lastId: number | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

/** event name → handler set. '*' receives every dispatched event ({ event, payload }). */
const handlers = new Map<string, Set<Handler>>();

function diag(level: 'info' | 'warn' | 'error', message: string): void {
  (level === 'error' ? console.error : console.log)(`[wfnew-social-sse] ${message}`);
}

function readToken(): string | null {
  return loadToken();
}

/** Resolve the SSE URL against the current endpoint base, with cursor + token. */
function resolveUrl(): string {
  const base = wfNewEndpoints.getCurrentBaseUrl(); // e.g. http://host:9000
  let url = `${base}${WfNewApiPaths.socialStream(lastId)}`;
  const token = readToken();
  if (token) url += `${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  return url;
}

function parseData(ev: MessageEvent): any {
  if (typeof ev.data !== 'string') return null;
  try { return JSON.parse(ev.data); } catch { return null; }
}

/** Advance the resume cursor from a frame's `_id` (channel) or `seq`/`id` (envelope). */
function trackCursor(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  const raw = (typeof obj._id === 'number') ? obj._id
    : (typeof obj.id === 'number') ? obj.id
      : (typeof obj.seq === 'number') ? obj.seq
        : null;
  if (raw === null) return;
  if (lastId === null || raw > lastId) lastId = raw;
}

function emit(event: string, payload: any): void {
  const set = handlers.get(event);
  if (set) for (const h of set) { try { h(payload); } catch { /* ignore */ } }
  const all = handlers.get('*');
  if (all) for (const h of all) { try { h({ event, payload }); } catch { /* ignore */ } }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; openSource(); }, RECONNECT_MS);
}

function closeSource(): void {
  if (source) {
    manualClose = true;
    try { source.close(); } catch { /* ignore */ }
    source = null;
  }
}

function openSource(): void {
  if (source && (source.readyState === EventSource.OPEN || source.readyState === EventSource.CONNECTING)) return;
  if (typeof EventSource === 'undefined') {
    diag('warn', 'EventSource unavailable — social realtime disabled');
    return;
  }
  // No credential → the stream can only 401. Disarm so startSocialSse() can
  // re-arm on the next login instead of reconnect-looping forever.
  if (!readToken()) {
    started = false;
    diag('warn', 'no auth token — social realtime disabled until login');
    return;
  }
  const url = resolveUrl();
  manualClose = false;
  diag('info', `connecting (cursor=${lastId ?? 'tail'})`);
  const es = new EventSource(url, { withCredentials: true });
  source = es;

  es.onopen = () => diag('info', `connected (cursor=${lastId ?? 'tail'})`);

  // Envelope frames — cursor only.
  es.addEventListener(ENVELOPE_OPEN, (ev) => { trackCursor(parseData(ev as MessageEvent)); });
  es.addEventListener(ENVELOPE_PING, (ev) => { trackCursor(parseData(ev as MessageEvent)); });
  es.addEventListener(ENVELOPE_CLOSE, (ev) => {
    trackCursor(parseData(ev as MessageEvent));
    diag('info', `stream.close — reopening with cursor=${lastId ?? 'tail'}`);
    closeSource();
    scheduleReconnect();
  });

  // Named social events (the backend emits each as event:<name>).
  const NAMED: WfNewSocialEvent[] = [
    'message.new', 'friend.request', 'friend.accept',
    'friend.online', 'friend.offline', 'notification.new', 'presence.update',
    'post.created', 'post.liked', 'post.comment', 'live.started', 'live.chat.new',
  ];
  for (const name of NAMED) {
    es.addEventListener(name, (ev) => {
      const data = parseData(ev as MessageEvent);
      if (!data) return;
      trackCursor(data);
      const payload = { ...data };
      delete payload._id;
      emit(name, payload);
    });
  }

  // Default message frame — backend may instead deliver the name inside data.event.
  es.onmessage = (ev) => {
    const data = parseData(ev as MessageEvent);
    if (!data || typeof data !== 'object') return;
    trackCursor(data);
    const name = typeof data.event === 'string' ? data.event : '';
    if (!name) return;
    const payload = { ...data };
    delete payload.event;
    delete payload._id;
    emit(name, payload);
  };

  es.onerror = () => {
    if (manualClose) return;
    closeSource();
    // Token gone (logged out, or cleared after a 401 elsewhere) → stop the
    // reconnect loop; startSocialSse() re-arms on the next login.
    if (!readToken()) {
      started = false;
      diag('warn', 'stopped — no auth token');
      return;
    }
    manualClose = false;
    diag('warn', `error — reopening with cursor=${lastId ?? 'tail'} in ${RECONNECT_MS / 1000}s`);
    scheduleReconnect();
  };
}

// --- public API ------------------------------------------------------------- #

/** Subscribe to one social event (or '*' for all). Returns an unsubscribe fn. */
export function subscribeSocial(event: WfNewSocialEvent | '*', handler: Handler): () => void {
  let set = handlers.get(event);
  if (!set) { set = new Set(); handlers.set(event, set); }
  set.add(handler);
  return () => { set!.delete(handler); };
}

/** Open the singleton social SSE stream (idempotent). Call when logged in. */
export function startSocialSse(): void {
  if (started) return;
  started = true;
  // Wait for endpoint detection so the base URL is resolved before connecting.
  wfNewEndpoints.whenReady().then(() => { if (started) openSource(); }).catch(() => { /* offline — retry loop covers it */ });
}

/** Close the stream and reset the cursor (call on logout). Handlers are kept. */
export function stopSocialSse(): void {
  started = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  closeSource();
  lastId = null;
}

/** Connected status of the social stream. */
export function isSocialSseConnected(): boolean {
  return !!source && source.readyState === EventSource.OPEN;
}
