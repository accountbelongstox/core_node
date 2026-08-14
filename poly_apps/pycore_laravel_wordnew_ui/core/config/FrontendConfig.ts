export const DEFAULT_FRONTEND_PORT = 13054;
export const FRONTEND_BUILD_TARGET = 'web';
export const FRONTEND_APP_FLAVOR = 'shell';

export function getOriginUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return `http://localhost:${DEFAULT_FRONTEND_PORT}`;
}
