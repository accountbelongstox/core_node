/**
 * Unwrap the Laravel `{ success, message, code, status, data }` envelope to its
 * `data` payload. Falsy payloads (null, 0, false, '') are preserved; raw
 * (non-enveloped) bodies pass through untouched.
 */
export function unwrapLaravelData<T = any>(body: any): T {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}
