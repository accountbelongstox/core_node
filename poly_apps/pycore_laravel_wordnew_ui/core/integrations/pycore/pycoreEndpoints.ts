/**
 * Central pycore HTTP endpoint definitions (no /pyapi).
 *
 * All UI transports resolve paths here, then `pycoreTarget` picks the host
 * (page origin, remote preset, etc.).
 */
import { PYCORE_BACKEND_PORT, PYCORE_HTTP_PATHS } from './PycoreNetwork';
import { isNativeAppShell } from '../../network/NativeShell';

export { PYCORE_BACKEND_PORT };

export function normalizePycorePath(raw: string): string {
  const p = (raw || '').trim();
  if (!p) return '/';
  if (/^https?:\/\//i.test(p)) return p;
  return p.startsWith('/') ? p : `/${p}`;
}

export function pycoreHttpProto(): 'http' | 'https' {
  if (isNativeAppShell()) return 'http';
  return (typeof location !== 'undefined' && location.protocol === 'https:') ? 'https' : 'http';
}

/** Direct HTTP URL: `http(s)://<host>:<PYCORE_BACKEND_PORT><path>`. */
export function buildPycoreHttpUrl(host: string, path: string): string {
  const p = normalizePycorePath(path);
  if (/^https?:\/\//i.test(p)) return p;
  return `${pycoreHttpProto()}://${host}:${PYCORE_BACKEND_PORT}${p}`;
}

/** Well-known pycore HTTP paths (relative to the pycore backend port). */
export const PycorePaths = {
  status: PYCORE_HTTP_PATHS.status,
  info: PYCORE_HTTP_PATHS.info,
  routes: PYCORE_HTTP_PATHS.routes,
  ws: PYCORE_HTTP_PATHS.ws,
  api: (route: string) => `${PYCORE_HTTP_PATHS.apiPrefix}/${route
    .replace(/^\/+/, '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`,
  voiceSubtitle: (subpath: string) => `/voice-subtitle${subpath.startsWith('/') ? subpath : `/${subpath}`}`,
  codeSync: (subpath: string) => `/code-sync${subpath.startsWith('/') ? subpath : `/${subpath}`}`,
  local: (subpath: string) => `/api/local${subpath.startsWith('/') ? subpath : `/${subpath}`}`,
} as const;
