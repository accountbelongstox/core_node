import { LOOPBACK_HOST, NEXUS_DASH_FRONTEND_PORT } from '../contracts/ServiceContract';

// Single source: config/service_contract.json (via core/contracts/ServiceContract).
export const DEFAULT_FRONTEND_PORT = NEXUS_DASH_FRONTEND_PORT;
export type FrontendBuildTarget = 'web' | 'native' | 'desktop';
const FRONTEND_BUILD_TARGETS: readonly FrontendBuildTarget[] = ['web', 'native', 'desktop'];
// Build-time target: native Capacitor builds set VITE_BUILD_TARGET=native
// (build_app.ps1 -Native / build_apk.py) so the real @capacitor plugins are
// bundled instead of the browser shims. Desktop builds (build_desktop.py) keep
// the shims: the desktop bridge (native/desktop) backs them at run time.
const REQUESTED_BUILD_TARGET = (typeof process !== 'undefined' && process.env?.VITE_BUILD_TARGET) || '';
export const FRONTEND_BUILD_TARGET: FrontendBuildTarget =
  FRONTEND_BUILD_TARGETS.find((target) => target === REQUESTED_BUILD_TARGET) ?? 'web';
export const FRONTEND_APP_FLAVOR: string =
  (typeof process !== 'undefined' && process.env?.VITE_APP_FLAVOR) || 'shell';

export function getOriginUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return `http://${LOOPBACK_HOST}:${DEFAULT_FRONTEND_PORT}`;
}
