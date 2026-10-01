/** Reads a response body with no total deadline: it fails only when no byte arrives for the stall window, or on abort. */
import { createIdleWatchdog, TRANSFER_IDLE_MS } from './IdleWatchdog';

export interface StallGuardedReadOptions {
  /** No byte for this long aborts the read (default http_transfer.idle_timeout_seconds). */
  stallMs?: number;
  /** Fraction 0..1 of the body read, when the length is known. */
  onProgress?: (fraction: number) => void;
  /** Aborts the read and cancels the body, so a cancelled run stops downloading. */
  signal?: AbortSignal;
}

/** Feeds every chunk of the body to `onChunk` under the idle watchdog; rejects with TimeoutError on a stall and AbortError on abort. */
export async function consumeBodyWithStallGuard(
  response: Response,
  onChunk: (chunk: Uint8Array) => void | Promise<void>,
  options: StallGuardedReadOptions = {},
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    await onChunk(new Uint8Array(await response.arrayBuffer()));
    return;
  }
  const total = Number(response.headers.get('content-length')) || 0;
  let received = 0;
  let failure: DOMException | null = null;
  let reject: (error: DOMException) => void = () => undefined;
  const interrupted = new Promise<never>((_, rejectInterrupted) => { reject = rejectInterrupted; });
  interrupted.catch(() => undefined);
  const interrupt = (error: DOMException): void => {
    if (failure) return;
    failure = error;
    // Reject first: cancelling settles the pending read as done and would win the race.
    reject(error);
    void reader.cancel().catch(() => undefined);
  };
  const watchdog = createIdleWatchdog(options.stallMs ?? TRANSFER_IDLE_MS, () => interrupt(new DOMException('Download stalled', 'TimeoutError')));
  const onAbort = (): void => interrupt(new DOMException('Download aborted', 'AbortError'));
  if (options.signal?.aborted) onAbort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      watchdog.arm();
      const step = await Promise.race([reader.read(), interrupted]);
      if (step.done) break;
      watchdog.arm();
      received += step.value.byteLength;
      await onChunk(step.value);
      if (total > 0) options.onProgress?.(Math.min(1, received / total));
    }
    if (failure) throw failure;
  } finally {
    watchdog.clear();
    options.signal?.removeEventListener('abort', onAbort);
  }
}

export async function readBytesWithStallGuard(response: Response, options: StallGuardedReadOptions = {}): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let received = 0;
  await consumeBodyWithStallGuard(response, (chunk) => {
    chunks.push(chunk);
    received += chunk.byteLength;
  }, options);
  const bytes = new Uint8Array(received);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return bytes;
}
