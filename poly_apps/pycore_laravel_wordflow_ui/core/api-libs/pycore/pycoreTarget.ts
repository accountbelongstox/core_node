/**
 * pycoreTarget - which pycore node the WHOLE pycore-manager talks to.
 *
 * DIRECT connection (no /pyapi reverse proxy) by default: every pycore
 * transport (HTTP / RPC WS / SSE / health) points at `<host>:59000`.
 *
 * Three modes:
 *   origin  (DEFAULT, "Current URL") - direct to `<page-host>:59000`.
 *   local   ("Local (this machine)") - same as origin: `<page-host>:59000` direct.
 *   remote  ("manage that client") - an explicit host/IP on :59000; use this to
 *            point at 127.0.0.1 (browser co-located with pycore), the machine's
 *            LAN/Tailscale IP, or a public IP. Every transport re-points at
 *            `http(s)://<host>:59000`. rpc_v2 sets CORS `allow_origins=["*"]` and
 *            the PNA middleware stamps `Access-Control-Allow-Private-Network`,
 *            so cross-origin / cross-address-space calls are allowed.
 *
 * PRIVATE NETWORK ACCESS (PNA) - the browser blocks public-origin pages from
 * reaching loopback/private addresses. The backend PNA header makes that work,
 * but ONLY when this page is a SECURE CONTEXT (HTTPS origin, or a localhost /
 * 127.0.0.1 origin). A plain-HTTP public-IP origin (http://43.163.112.77:13054)
 * is NOT a secure context: the browser blocks the request before any preflight,
 * so direct-to-127.0.0.1 fails with ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS.
 * For that path use one of: an HTTPS origin, a localhost origin (run the UI on
 * the pycore machine too), or the `block-insecure-private-network-requests`
 * Chrome flag. See isPycoreSecureContext() / pnaBlockedReason().
 *
 * The cloud-preview sandbox (Cloud Run / :3000) has NO reachable :59000, so
 * there the same-origin `/pyapi` proxy is forced regardless of mode.
 *
 * Switching PERSISTS the choice and RELOADS the page so every transport
 * re-points cleanly with zero half-torn-down socket state.
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
  { host: '127.0.0.1', label: 'Localhost', hint: 'loopback (browser must be on the pycore machine)' },
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
  return { mode: 'origin' };
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
 * pycore :59000 - there the same-origin `/pyapi` proxy is the only path.
 */
function isSandbox(): boolean {
  return typeof location !== 'undefined'
    && (location.hostname.includes('run.app') || location.port === '3000');
}

/**
 * Is this page a secure context (HTTPS or localhost origin)? PNA only honors
 * the backend `Access-Control-Allow-Private-Network` header when this is true;
 * a plain-HTTP public-IP origin is blocked before any preflight. False off-web.
 */
export function isPycoreSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (isSandbox()) return false;
  return !!window.isSecureContext;
}

/**
 * The host the LOCAL/origin target resolves to: the CURRENT PAGE's host (so
 * opening this UI from another machine manages THAT machine's pycore on
 * :59000 - not a literal 127.0.0.1). Falls back to 127.0.0.1 only off-web.
 */
export function localPycoreHost(): string {
  if (typeof location !== 'undefined' && location.hostname) return location.hostname;
  return '127.0.0.1';
}

/**
 * The page's own origin (host:port). Falls back to 127.0.0.1 off-web.
 */
export function localPycoreOrigin(): string {
  if (typeof location !== 'undefined' && location.host) return location.host;
  return '127.0.0.1';
}

/** The host pycore actually targets right now, or null when calls go via the
 *  same-origin `/pyapi` proxy (sandbox only). */
export function pycoreEffectiveHost(): string | null {
  const t = readTarget();
  if (t.mode === 'remote' && t.host) return t.host;
  if (isSandbox()) return null;              // sandbox only uses /pyapi proxy
  return localPycoreHost();                  // origin/local: direct <page-host>:59000
}

/**
 * Rewrite a local `/pyapi/...` endpoint for the current target (DIRECT, no proxy
 * outside the sandbox).
 *   remote  -> `http(s)://<host>:59000/...`
 *   origin  -> `http(s)://<page-host>:59000/...` (direct)
 *   local   -> `http(s)://<page-host>:59000/...` (direct)
 *   sandbox -> unchanged `/pyapi/...` (same-origin proxy; :59000 isn't reachable)
 * Absolute URLs are returned untouched.
 */
export function rewritePycoreEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const host = pycoreEffectiveHost();
  if (!host) return endpoint;                       // sandbox -> keep the /pyapi proxy
  const path = endpoint.replace(/^\/pyapi/, '');
  return `${httpProto()}://${host}:${PORT}${path.startsWith('/') ? path : `/${path}`}`;
}

/** RPC WebSocket URL for an explicit target, or null when the caller should use
 *  its own local direct default (`<page-host>:59000`) or the sandbox /pyapi proxy. */
export function pycoreWsUrlOverride(): string | null {
  const t = readTarget();
  if (t.mode === 'remote' && t.host) {
    return `${wsProto()}://${t.host}:${PORT}/rpc/ws`;
  }
  if (isSandbox()) {
    return `${wsProto()}://${localPycoreOrigin()}/pyapi/rpc/ws`;
  }
  return null;  // origin/local: caller uses <page-host>:59000 direct
}

/** SSE URL for an explicit target, or null when the caller should use its own
 *  local direct default (`<page-host>:59000`) or the sandbox /pyapi proxy. */
export function pycoreSseUrlOverride(clientId: string, lastSeq: number | null): string | null {
  const t = readTarget();
  const withSince = (base: string): string =>
    lastSeq !== null ? `${base}&since=${encodeURIComponent(String(lastSeq))}` : base;
  if (t.mode === 'remote' && t.host) {
    return withSince(`${httpProto()}://${t.host}:${PORT}/rpc/sse?client_id=${encodeURIComponent(clientId)}`);
  }
  if (isSandbox()) {
    return withSince(`${httpProto()}://${localPycoreOrigin()}/pyapi/rpc/sse?client_id=${encodeURIComponent(clientId)}`);
  }
  return null;
}

/**
 * Why a DIRECT connection to a loopback/private pycore host would be blocked by
 * Private Network Access right now, or null when it is allowed. Use this to show
 * a actionable hint in the UI / logs instead of a silent connection failure.
 *
 *  - secure context + any host        -> null (allowed; backend PNA header honored)
 *  - non-secure + public host         -> null (same address space, no PNA)
 *  - non-secure + loopback/private    -> reason string (browser blocks preflight)
 */
export function pnaBlockedReason(host: string | null): string | null {
  if (isPycoreSecureContext()) return null;
  if (!host) return null;
  const h = host.toLowerCase();
  const isLoopback = h === '127.0.0.1' || h === 'localhost' || h === '::1';
  // 100.64/10 (CGNAT, incl. Tailscale 100.x), 10/8, 172.16/12, 192.168/16, fc00::/7.
  const isPrivate = isLoopback
    || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) || h.startsWith('fd') || h.startsWith('fc');
  if (!isPrivate) return null;
  return `This page is not a secure context (HTTP on a public IP). The browser blocks direct access to ${host}:59000 via Private Network Access. Use an HTTPS origin, a localhost origin, or the Chrome flag chrome://flags/#block-insecure-private-network-requests.`;
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
 * `{ mode: 'origin' }` (default, direct <page-host>:59000) or `{ mode: 'local' }`
 * (same, direct) or `{ mode: 'remote', host }` to manage another node.
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
