/**
 * pycoreTarget - which pycore node the WHOLE pycore-manager talks to.
 *
 * Three modes:
 *   origin  (DEFAULT, "Current URL") - uses /pyapi proxy when accessed via
 *            public IP, or direct to pycore :59000 when accessed via localhost.
 *   local   ("Local (this machine)") - the current page HOST on :59000
 *            (`http(s)://<page-host>:59000`), a direct cross-port call (NOT /pyapi).
 *            Uses /pyapi proxy when page host is a public IP to avoid PNA issues.
 *   remote  ("manage that client") - an explicit host/IP on :59000; re-points every
 *            pycore transport (HTTP / RPC WS / SSE / health) at `http(s)://<host>:59000`,
 *            so EVERY pycore-manager page then manages that remote node. rpc_v2 sets
 *            CORS `allow_origins=["*"]`, so the cross-origin call from the UI port to
 *            :59000 is allowed. (pycore's :59000 backend is separate from Laravel's
 *            :9000 - different host:port, different endpoint set.)
 *
 * The cloud-preview sandbox (Cloud Run / :3000) has NO reachable :59000, so there the
 * same-origin `/pyapi` proxy is forced regardless of the saved mode (mirrors the
 * identical guard in PycoreWs.resolveWsUrl / PycoreSse / PycoreApi.getRuntime).
 *
 * Switching PERSISTS the choice and RELOADS the page: that is the documented way the
 * WS/SSE URLs re-point (see PycoreWs.resolveWsUrl - "a page reload alone applies it"),
 * and it re-inits every transport cleanly against the new target with zero
 * half-torn-down socket state.
 */
const PORT = 59000;
const LS_TARGET = 'pycore_target';         // { mode:'origin'|'local'|'remote', host?:string }
const LS_RECENT = 'pycore_target_recent';  // string[] of recent remote hosts

/** Well-known pycore nodes always offered as quick-connect presets (independent
 *  of Recent history). Host only - :59000 is implied. */
export interface PycorePresetHost {
  host: string;
  label: string;
  hint?: string;
}

const PRESET_HOSTS: PycorePresetHost[] = [
  { host: '127.0.0.1', label: 'Localhost', hint: 'fixed 127.0.0.1' },
  { host: '43.163.112.77', label: 'Public IP', hint: 'cloud server' },
  { host: '100.126.119.99', label: 'Tailscale LAN', hint: 'private mesh' },
];

export interface PycoreTarget {
  mode: 'origin' | 'local' | 'remote';
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
      if (t && t.mode === 'local') return { mode: 'local' };
      if (t && t.mode === 'origin') return { mode: 'origin' };
    }
  } catch { /* fall through to default */ }
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

/** Remote host (IP/hostname) when targeting a remote node, else null. */
export function pycoreTargetHost(): string | null {
  const t = readTarget();
  return t.mode === 'remote' && t.host ? t.host : null;
}

/**
 * The cloud-preview sandbox (Cloud Run / the :3000 preview) has NO reachable
 * pycore :59000 - there the same-origin `/pyapi` proxy is the only path. Mirrors
 * the identical guard in PycoreWs.resolveWsUrl / PycoreSse.
 */
function isSandbox(): boolean {
  return typeof location !== 'undefined'
    && (location.hostname.includes('run.app') || location.port === '3000');
}

/**
 * Check if we're accessing via localhost/127.0.0.1 (safe for direct :59000 access).
 * Public IPs need /pyapi proxy to avoid Private Network Access (PNA) issues.
 */
function isLocalhostAccess(): boolean {
  if (typeof location === 'undefined') return true;
  const host = location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
}

/**
 * Check if we need to use /pyapi proxy instead of direct :59000 access.
 */
function needsProxy(): boolean {
  return isSandbox() || !isLocalhostAccess();
}

/**
 * The host the LOCAL target resolves to: the CURRENT PAGE's host (so opening this
 * UI from another machine manages THAT machine's pycore on :59000 - not a literal
 * 127.0.0.1). Falls back to 127.0.0.1 only off-web.
 */
export function localPycoreHost(): string {
  if (typeof location !== 'undefined' && location.hostname) return location.hostname;
  return '127.0.0.1';
}

/**
 * The page's own origin (host:port) - what the ORIGIN ("Current URL") target
 * resolves to. Falls back to 127.0.0.1 off-web.
 */
export function localPycoreOrigin(): string {
  if (typeof location !== 'undefined' && location.host) return location.host;
  return '127.0.0.1';
}

/** The host pycore actually targets right now, or null when calls go via the
 *  same-origin `/pyapi` proxy (sandbox or public IP access). */
export function pycoreEffectiveHost(): string | null {
  const t = readTarget();
  if (t.mode === 'remote' && t.host) return t.host;
  if (needsProxy()) return null;           // use /pyapi proxy for sandbox/public IP
  return localPycoreHost();                  // origin/local use direct :59000 for localhost
}

/**
 * Rewrite a local `/pyapi/...` endpoint for the current target.
 *   remote  -> `http(s)://<host>:59000/...`
 *   local   -> `http(s)://<current-page-host>:59000/...` (direct cross-port call)
 *   origin  -> `http(s)://<current-page-host>:59000/...` (direct, no proxy)
 *   sandbox/public IP -> unchanged `/pyapi/...` (same-origin proxy; avoids PNA issues)
 * Absolute URLs are returned untouched.
 */
export function rewritePycoreEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const host = pycoreEffectiveHost();
  if (!host) return endpoint;                       // use /pyapi proxy
  const path = endpoint.replace(/^\/pyapi/, '');
  return `${httpProto()}://${host}:${PORT}${path.startsWith('/') ? path : `/${path}`}`;
}

/** RPC WebSocket URL for an explicit target, or null when the caller should use
 *  its own local default (local mode on page host :59000) or /pyapi proxy. */
export function pycoreWsUrlOverride(): string | null {
  const t = readTarget();
  if (t.mode === 'remote' && t.host) {
    return `${wsProto()}://${t.host}:${PORT}/rpc/ws`;
  }
  if (needsProxy()) {
    return `${wsProto()}://${localPycoreOrigin()}/pyapi/rpc/ws`;
  }
  return null;  // origin/local on localhost: caller uses location.hostname:59000
}

/** SSE URL for an explicit target, or null when the caller should use its own
 *  local default (local mode on page host :59000) or /pyapi proxy. */
export function pycoreSseUrlOverride(clientId: string, lastSeq: number | null): string | null {
  const t = readTarget();
  const withSince = (base: string): string =>
    lastSeq !== null ? `${base}&since=${encodeURIComponent(String(lastSeq))}` : base;
  if (t.mode === 'remote' && t.host) {
    return withSince(`${httpProto()}://${t.host}:${PORT}/rpc/sse?client_id=${encodeURIComponent(clientId)}`);
  }
  if (needsProxy()) {
    return withSince(`${httpProto()}://${localPycoreOrigin()}/pyapi/rpc/sse?client_id=${encodeURIComponent(clientId)}`);
  }
  return null;
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

/** Fixed quick-connect presets (always available, not history). */
export function getPycoreTargetPresets(): PycorePresetHost[] {
  return PRESET_HOSTS;
}

/** Normalize a user-entered host: strip scheme, port, trailing slash. */
export function normalizePycoreHost(input: string): string {
  return (input || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

/**
 * Persist the target and RELOAD so every transport re-points cleanly. Pass
 * `{ mode: 'origin' }` (default, current URL via direct :59000) or `{ mode: 'local' }`
 * (page host on :59000) or `{ mode: 'remote', host }` to manage another node.
 */
export function setPycoreTarget(target: PycoreTarget): void {
  if (target.mode === 'remote' && target.host) {
    const host = normalizePycoreHost(target.host);
    if (!host) return;
    localStorage.setItem(LS_TARGET, JSON.stringify({ mode: 'remote', host }));
    const recent = [host, ...getPycoreTargetRecent().filter((h) => h !== host)].slice(0, 6);
    localStorage.setItem(LS_RECENT, JSON.stringify(recent));
  } else {
    // 'origin' (default) or 'local' - persist the chosen mode verbatim.
    localStorage.setItem(LS_TARGET, JSON.stringify({ mode: target.mode === 'local' ? 'local' : 'origin' }));
  }
  if (typeof location !== 'undefined') location.reload();
}
