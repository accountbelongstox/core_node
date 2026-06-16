/**
 * PycoreSse — dependency-free singleton EventSource client for the pycore
 * broadcast-event stream (RPC v2 bus events delivered over SSE).
 *
 * Companion to PycoreWs: RPC request/response stays on the WebSocket
 * (callRpc / nativeCall). This module takes over BROADCAST EVENTS only
 * (pycore_log / voice_subtitle_queue_update / system_settings_update / …),
 * feeding them into PycoreWs's EXISTING subscribe() handlers via the exported
 * dispatchEvent(). It shares PycoreWs's client id (getClientId) so the backend
 * keys both transports to the same client.
 *
 * Connects DIRECTLY to the pycore backend on the page host, port 59000:
 *   http://<host>:59000/rpc/sse?client_id=<id>[&since=<lastSeq>]
 *
 * Backend contract:
 *   - event: stream.open   data {"seq":N}            — envelope, advances cursor
 *   - event: ping          data {"seq":N}  (~15s)    — envelope, keep-alive
 *   - event: <name>        data {...,"_seq":int}      — a channel broadcast
 *   - event: stream.close  data {"seq":N}  (~50s)     — server closes; reconnect
 *                                                       with ?since=<lastSeq>
 * First connect (no since) starts at the tail (new events only). After that we
 * resume from lastSeq so the ~50s server-side close never drops events.
 *
 * Usage: connectPycoreSse();  (PycoreWs.connectPycoreWs() calls this for you.)
 */

import { getClientId, dispatchEvent, setSseEventsActive } from './PycoreWs';

// Envelope event names that carry only a cursor (never a channel payload).
const ENVELOPE_OPEN = 'stream.open';
const ENVELOPE_CLOSE = 'stream.close';
const ENVELOPE_PING = 'ping';

// Channel broadcasts arrive as the DEFAULT SSE message (no `event:` line) with the
// event name inside data.event, so onmessage bridges ANY broadcast name generically
// (matches the WS path; forward-compatible with new names without code changes). Only
// the stream.open/ping/stream.close ENVELOPE uses named events (addEventListener).

const RECONNECT_MS = 3000;

let source: EventSource | null = null;
let started = false;
let lastSeq: number | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let manualClose = false;

function diag(level: string, message: string) {
  (level === 'error' ? console.error : console.log)(`[pycore-sse] ${message}`);
}

function resolveSseUrl(): string {
  const proto = location.protocol === 'https:' ? 'https' : 'http';
  let url = `${proto}://${location.hostname}:59000/rpc/sse?client_id=${encodeURIComponent(getClientId())}`;
  if (lastSeq !== null) url += `&since=${encodeURIComponent(String(lastSeq))}`;
  return url;
}

/** Pull "_seq" (channel payload) or "seq" (envelope) out of a frame and advance
 *  the resume cursor monotonically. */
function trackSeq(obj: any): void {
  if (!obj || typeof obj !== 'object') return;
  const raw = (typeof obj._seq === 'number') ? obj._seq
    : (typeof obj.seq === 'number') ? obj.seq
      : null;
  if (raw === null) return;
  if (lastSeq === null || raw > lastSeq) lastSeq = raw;
}

function parseData(ev: MessageEvent): any {
  if (typeof ev.data !== 'string') return null;
  try { return JSON.parse(ev.data); } catch { return null; }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSource();
  }, RECONNECT_MS);
}

function closeSource() {
  if (source) {
    manualClose = true;
    try { source.close(); } catch { /* ignore */ }
    source = null;
  }
}

function openSource() {
  // Never stack streams.
  if (source && (source.readyState === EventSource.OPEN || source.readyState === EventSource.CONNECTING)) return;
  if (typeof EventSource === 'undefined') {
    diag('warn', 'EventSource unavailable — broadcast events stay on WS');
    return;
  }

  const url = resolveSseUrl();
  diag('info', `connecting ${url}`);
  manualClose = false;
  const es = new EventSource(url);
  source = es;

  es.onopen = () => {
    diag('info', `connected (since=${lastSeq ?? 'tail'})`);
    // Take over broadcast-event dispatch from the WS path (avoid duplicates).
    setSseEventsActive(true);
  };

  // Envelope frames — cursor only, no dispatch.
  es.addEventListener(ENVELOPE_OPEN, (ev) => { trackSeq(parseData(ev as MessageEvent)); });
  es.addEventListener(ENVELOPE_PING, (ev) => { trackSeq(parseData(ev as MessageEvent)); });
  es.addEventListener(ENVELOPE_CLOSE, (ev) => {
    // Server is about to close (~50s). Advance cursor, then reopen with ?since=.
    trackSeq(parseData(ev as MessageEvent));
    diag('info', `stream.close — reopening with since=${lastSeq ?? 'tail'}`);
    closeSource();
    scheduleReconnect();
  });

  // Channel frames arrive as the DEFAULT message event (name inside data.event):
  // advance cursor, then bridge ANY broadcast name into the existing subscribe()
  // handlers — generic, like the WS path, so new event names need no FE changes.
  es.onmessage = (ev) => {
    const data = parseData(ev as MessageEvent);
    if (!data || typeof data !== 'object') return;
    trackSeq(data);
    const name = typeof data.event === 'string' ? data.event : '';
    if (!name) return;
    // Hand consumers the SAME payload shape the WS path delivered (drop transport meta).
    const payload = { ...data };
    delete payload.event;
    delete payload._seq;
    dispatchEvent(name, payload);
  };

  es.onerror = () => {
    // EventSource auto-reconnects, but it would reuse the original URL (no
    // updated ?since=). Force a clean reopen with the current cursor instead.
    // Ignore the error that our own stream.close handler just triggered.
    if (manualClose) return;
    // SSE is no longer the live source → let WS resume event dispatch as a
    // graceful fallback until SSE reconnects.
    setSseEventsActive(false);
    diag('warn', `error — reopening with since=${lastSeq ?? 'tail'} in ${RECONNECT_MS / 1000}s`);
    closeSource();
    manualClose = false;
    scheduleReconnect();
  };
}

/** Connected status of the SSE broadcast stream. */
export function isSseConnected(): boolean {
  return !!source && source.readyState === EventSource.OPEN;
}

/** Open the singleton SSE stream (idempotent). Reconnects on close/error,
 *  resuming from the last seen sequence so the periodic server close is
 *  seamless. Broadcast events flow into PycoreWs's subscribe() handlers. */
export function connectPycoreSse(): void {
  if (started) return;
  started = true;
  openSource();
}
