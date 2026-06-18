/**
 * pycoreTarget — which pycore node the WHOLE pycore-manager talks to.
 *
 * Default = LOCAL (this machine's pycore on :59000, reached via the `/pyapi`
 * proxy + `ws(s)://<page-host>:59000`). A REMOTE target re-points every pycore
 * transport — HTTP (PycoreApi), RPC WebSocket (PycoreWs), SSE (PycoreSse) and
 * the health ping (PycoreHealth) — at `http(s)://<host>:59000`, so EVERY
 * pycore-manager page then manages that remote client. rpc_v2 already sets CORS
 * `allow_origins=["*"]`, so cross-origin calls to a remote :59000 are allowed.
 *
 * Switching PERSISTS the choice and RELOADS the page: that is the documented way
 * the WS/SSE URLs re-point (see PycoreWs.resolveWsUrl — "a page reload alone
 * applies it"), and it re-inits every transport cleanly against the new target
 * with zero half-torn-down socket state.
 */
const PORT = 59000;
const LS_TARGET = 'pycore_target';         // { mode:'local'|'remote', host?:string }
const LS_RECENT = 'pycore_target_recent';  // string[] of recent remote hosts

export interface PycoreTarget {
  mode: 'local' | 'remote';
  /** Remote host/IP (no scheme/port) when mode === 'remote'. */
  host?: string;
}

function readTarget(): PycoreTarget {
  try {
    const raw = localStorage.getItem(LS_TARGET);
    if (raw) {
      const t = JSON.parse(raw);
      if (t && t.mode === 'remote' && typeof t.host === 'string' && t.host.trim()) {
        return { mode: 'remote', host: t.host.trim() };
      }
    }
  } catch { /* fall through to local */ }
  return { mode: 'local' };
}

const httpProto = (): string =>
  (typeof location !== 'undefined' && location.protocol === 'https:') ? 'https' : 'http';
const wsProto = (): string =>
  (typeof location !== 'undefined' && location.protocol === 'https:') ? 'wss' : 'ws';

export function getPycoreTarget(): PycoreTarget {
  return readTarget();
}

export function isPycoreRemote(): boolean {
  return readTarget().mode === 'remote';
}

/** Remote host (IP/hostname) when targeting a remote node, else null (local). */
export function pycoreTargetHost(): string | null {
  const t = readTarget();
  return t.mode === 'remote' && t.host ? t.host : null;
}

/**
 * Rewrite a local `/pyapi/...` endpoint for the current target.
 *   local  → unchanged (`/pyapi/...`, handled by the dev proxy / webview)
 *   remote → `http(s)://<host>:59000/...` (the `/pyapi` proxy prefix stripped)
 * Absolute URLs are returned untouched.
 */
export function rewritePycoreEndpoint(endpoint: string): string {
  const host = pycoreTargetHost();
  if (!host) return endpoint;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const path = endpoint.replace(/^\/pyapi/, '');
  return `${httpProto()}://${host}:${PORT}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Remote RPC WebSocket URL, or null when local (caller keeps its default). */
export function pycoreWsUrlOverride(): string | null {
  const host = pycoreTargetHost();
  return host ? `${wsProto()}://${host}:${PORT}/rpc/ws` : null;
}

/** Remote SSE URL, or null when local (caller keeps its default). */
export function pycoreSseUrlOverride(clientId: string, lastSeq: number | null): string | null {
  const host = pycoreTargetHost();
  if (!host) return null;
  let url = `${httpProto()}://${host}:${PORT}/rpc/sse?client_id=${encodeURIComponent(clientId)}`;
  if (lastSeq !== null) url += `&since=${encodeURIComponent(String(lastSeq))}`;
  return url;
}

/** Recent remote hosts (most-recent-first), for quick re-selection in the UI. */
export function getPycoreTargetRecent(): string[] {
  try {
    const r = JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
    return Array.isArray(r) ? r.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Normalize a user-entered host: strip scheme, port, trailing slash. */
export function normalizePycoreHost(input: string): string {
  return (input || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

/**
 * Persist the target and RELOAD so every transport re-points cleanly. Pass
 * `{ mode: 'local' }` to return to this machine.
 */
export function setPycoreTarget(target: PycoreTarget): void {
  if (target.mode === 'remote' && target.host) {
    const host = normalizePycoreHost(target.host);
    if (!host) return;
    localStorage.setItem(LS_TARGET, JSON.stringify({ mode: 'remote', host }));
    const recent = [host, ...getPycoreTargetRecent().filter((h) => h !== host)].slice(0, 6);
    localStorage.setItem(LS_RECENT, JSON.stringify(recent));
  } else {
    localStorage.setItem(LS_TARGET, JSON.stringify({ mode: 'local' }));
  }
  if (typeof location !== 'undefined') location.reload();
}
