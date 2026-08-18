export const DEFAULT_API_PORT = 9000;
export const DEFAULT_API_TIMEOUT = 30000;

export function getDefaultBaseURL(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_API_PORT}`;
  }
  return `http://localhost:${DEFAULT_API_PORT}`;
}
