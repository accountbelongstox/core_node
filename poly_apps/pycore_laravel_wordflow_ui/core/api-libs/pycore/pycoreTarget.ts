/**
 * pycoreTarget — which pycore node the WHOLE pycore-manager talks to.
 *
 * All transports connect DIRECTLY to `<host>:59000` (see pycoreEndpoints.ts).
 *
 * Three modes:
 *   origin  (DEFAULT) — page hostname on :59000 (localhost stays localhost).
 *   local   — same as origin.
 *   remote  — explicit host/IP on :59000.
 */
import {
  PYCORE_PORT,
  buildPycoreHttpUrl,
  buildPycoreSseBaseUrl,
  buildPycoreWsUrl,
  normalizePycorePath,
} from './pycoreEndpoints';

const LS_TARGET = 'pycore_target';
const LS_RECENT = 'pycore_target_recent';

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
  } catch { /* fall through */ }
  return { mode: 'origin' };
}

export function getPycoreTarget(): PycoreTarget {
  return readTarget();
}

export function isPycoreRemote(): boolean {
  return readTarget().mode === 'remote';
}

export function pycoreTargetHost(): string | null {
  const t = readTarget();
  return t.mode === 'remote' && t.host ? t.host : null;
}

function isSandbox(): boolean {
  return typeof location !== 'undefined'
    && (location.hostname.includes('run.app') || location.port === '3000');
}

export function isLoopbackPage(): boolean {
  if (typeof location === 'undefined') return false;
  const h = location.hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

/** UI served from the Vite dev shell (:13054). */
export function isViteDevShell(): boolean {
  return typeof location !== 'undefined'
    && location.port === '13054';
}

/** Page hostname for origin/local target (localhost stays localhost, not 127.0.0.1). */
export function localPycoreHost(): string {
  if (typeof location !== 'undefined' && location.hostname) return location.hostname;
  return '127.0.0.1';
}

export function localPycoreOrigin(): string {
  if (typeof location !== 'undefined' && location.host) return location.host;
  return '127.0.0.1';
}

/**
 * Host for direct :59000 calls — remote preset wins; otherwise the page hostname.
 * Does NOT remap localhost → 127.0.0.1 (they are separate origins to the browser).
 */
export function directPycoreHost(): string {
  const t = readTarget();
  if (t.mode === 'remote' && t.host) return t.host;
  return localPycoreHost();
}

export function pycoreLocalConnectionHint(): string {
  return `${directPycoreHost()}:${PYCORE_PORT} (direct)`;
}

export function isPycoreSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (isSandbox()) return false;
  return !!window.isSecureContext;
}

export function pycoreEffectiveHost(): string {
  return directPycoreHost();
}

/** Resolve a relative pycore path to a direct full URL on the active target. */
export function rewritePycoreEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  if (typeof location !== 'undefined' && location.port === String(PYCORE_PORT)) {
    return normalizePycorePath(endpoint);
  }
  return buildPycoreHttpUrl(directPycoreHost(), endpoint);
}

export function pycoreWsUrlOverride(): string | null {
  return buildPycoreWsUrl(directPycoreHost());
}

export function pycoreSseUrlOverride(clientId: string, lastSeq: number | null): string | null {
  let url = `${buildPycoreSseBaseUrl(directPycoreHost())}?client_id=${encodeURIComponent(clientId)}`;
  if (lastSeq !== null) url += `&since=${encodeURIComponent(String(lastSeq))}`;
  return url;
}

export function pnaBlockedReason(host: string | null): string | null {
  if (isPycoreSecureContext()) return null;
  if (!host) return null;
  const h = host.toLowerCase();
  const isLoopback = h === '127.0.0.1' || h === 'localhost' || h === '::1';
  const isPrivate = isLoopback
    || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) || h.startsWith('fd') || h.startsWith('fc');
  if (!isPrivate) return null;
  return `This page is not a secure context (HTTP on a public IP). The browser blocks direct access to ${host}:${PYCORE_PORT} via Private Network Access. Use an HTTPS origin, a localhost origin, or the Chrome flag chrome://flags/#block-insecure-private-network-requests.`;
}

export function getPycoreTargetRecent(): string[] {
  try {
    const r = JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
    return Array.isArray(r) ? r.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function getPycoreTargetPresets(): PycorePresetHost[] {
  return PRESET_HOSTS;
}

export function normalizePycoreHost(input: string): string {
  return (input || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
}

export function setPycoreTarget(target: PycoreTarget): void {
  if (target.mode === 'remote' && target.host) {
    const host = normalizePycoreHost(target.host);
    if (!host) return;
    localStorage.setItem(LS_TARGET, JSON.stringify({ mode: 'remote', host }));
    const recent = [host, ...getPycoreTargetRecent().filter((h) => h !== host)].slice(0, 6);
    localStorage.setItem(LS_RECENT, JSON.stringify(recent));
  } else {
    localStorage.setItem(LS_TARGET, JSON.stringify({ mode: target.mode === 'local' ? 'local' : 'origin' }));
  }
  if (typeof location !== 'undefined') location.reload();
}
