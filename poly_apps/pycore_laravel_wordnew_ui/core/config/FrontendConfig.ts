import { NEXUS_DASH_FRONTEND_PORT } from '../contracts/ServiceContract';

// Single source: config/service_contract.json (via core/contracts/ServiceContract).
export const DEFAULT_FRONTEND_PORT = NEXUS_DASH_FRONTEND_PORT;
export const FRONTEND_BUILD_TARGET = 'web';
export const FRONTEND_APP_FLAVOR = 'shell';

export function getOriginUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return `http://localhost:${DEFAULT_FRONTEND_PORT}`;
}
