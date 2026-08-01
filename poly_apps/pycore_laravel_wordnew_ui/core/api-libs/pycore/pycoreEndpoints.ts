/**
 * Central pycore (:59000) HTTP endpoint definitions (no /pyapi).
 *
 * All UI transports resolve paths here, then `pycoreTarget` picks the host
 * (page origin, remote preset, etc.).
 */
import { PYCORE_HTTP_PATHS, PYCORE_HTTP_PORT } from './PycoreNetwork';

export const PYCORE_PORT = PYCORE_HTTP_PORT;

/** Legacy `/pyapi` prefix is stripped; paths are always root-relative. */
export function normalizePycorePath(raw: string): string {
  let p = (raw || '').trim();
  if (!p) return '/';
  if (/^https?:\/\//i.test(p)) return p;
  p = p.replace(/^\/pyapi(?=\/|$)/, '');
  return p.startsWith('/') ? p : `/${p}`;
}

export function pycoreHttpProto(): 'http' | 'https' {
  return (typeof location !== 'undefined' && location.protocol === 'https:') ? 'https' : 'http';
}

/** Direct HTTP URL: `http(s)://<host>:59000<path>`. */
export function buildPycoreHttpUrl(host: string, path: string): string {
  const p = normalizePycorePath(path);
  if (/^https?:\/\//i.test(p)) return p;
  return `${pycoreHttpProto()}://${host}:${PYCORE_PORT}${p}`;
}

/** Well-known pycore HTTP paths (relative to :59000). */
export const PycorePaths = {
  status: PYCORE_HTTP_PATHS.status,
  info: PYCORE_HTTP_PATHS.info,
  routes: PYCORE_HTTP_PATHS.routes,
  events: PYCORE_HTTP_PATHS.events,
  api: (route: string) => `${PYCORE_HTTP_PATHS.apiPrefix}/${route
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`,
  voiceSubtitle: (subpath: string) => `/voice-subtitle${subpath.startsWith('/') ? subpath : `/${subpath}`}`,
  codeSync: (subpath: string) => `/code-sync${subpath.startsWith('/') ? subpath : `/${subpath}`}`,
  local: (subpath: string) => `/api/local${subpath.startsWith('/') ? subpath : `/${subpath}`}`,
} as const;
