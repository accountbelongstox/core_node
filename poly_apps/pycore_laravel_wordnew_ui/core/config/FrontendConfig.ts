import { NEXUS_DASH_FRONTEND_PORT } from '../contracts/ServiceContract';

// Single source: config/service_contract.json (via core/contracts/ServiceContract).
export const DEFAULT_FRONTEND_PORT = NEXUS_DASH_FRONTEND_PORT;
export type FrontendBuildTarget = 'web' | 'native';
// Build-time target: native Capacitor builds set VITE_BUILD_TARGET=native
// (build_app.ps1 -Native / build_apk.py) so the real @capacitor plugins are
// bundled instead of the browser shims.
export const FRONTEND_BUILD_TARGET: FrontendBuildTarget =
  (typeof process !== 'undefined' && process.env?.VITE_BUILD_TARGET === 'native') ? 'native' : 'web';
export const FRONTEND_APP_FLAVOR = 'shell';

export function getOriginUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return `http://localhost:${DEFAULT_FRONTEND_PORT}`;
}
