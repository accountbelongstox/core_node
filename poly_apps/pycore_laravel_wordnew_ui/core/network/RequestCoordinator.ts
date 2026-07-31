type PendingRequest = Promise<unknown>;

const pendingRequests = new Map<string, PendingRequest>();
const recentResponses = new Map<string, { value: unknown; expiresAt: number }>();

/** Coalesce identical reads across API modules and UI transports. */
export function coordinateRequest<T>(
  key: string,
  operation: () => Promise<T>,
  ttlMs = 5000,
): Promise<T> {
  const recent = recentResponses.get(key);
  if (recent && recent.expiresAt > Date.now()) return Promise.resolve(recent.value as T);
  if (recent) recentResponses.delete(key);

  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = operation().then((value) => {
    recentResponses.set(key, { value, expiresAt: Date.now() + Math.max(0, ttlMs) });
    return value;
  }).finally(() => {
    pendingRequests.delete(key);
  });
  pendingRequests.set(key, request);
  return request;
}

export function clearCoordinatedRequests(): void {
  recentResponses.clear();
}
