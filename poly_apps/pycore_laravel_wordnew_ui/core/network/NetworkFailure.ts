/**
 * NETWORK-level failure (vs. an HTTP answer): the device is offline, fetch
 * rejected with a TypeError (DNS/connection/CORS), or a ceiling aborted a
 * dead socket.
 */
export function isNetworkLevelFailure(error: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError || error?.name === 'TypeError') return true;
  if (error?.name === 'AbortError' || error?.name === 'TimeoutError') return true;
  return false;
}

/** The connection itself failed (no answer and no deadline involved): safe to send again. */
export function isConnectionFailure(error: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return error instanceof TypeError || error?.name === 'TypeError';
}
