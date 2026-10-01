/** Progress-driven upload: no total deadline, aborted only when no byte moves for http_transfer.idle_timeout_seconds. */
import { createIdleWatchdog, TRANSFER_IDLE_MS } from './IdleWatchdog';
import { QUEUE_CENTER_HTTP_TRANSFER } from '../contracts/QueueCenterContract';

/** A request init that reports upload progress as a 0..1 fraction. */
export interface UploadRequestInit extends RequestInit {
  onUploadProgress?: (fraction: number) => void;
}

/** A request init that reports the progress of the operation itself (relay progress frames) as a 0..1 fraction. */
export interface OperationProgressInit {
  onProgress?: (fraction: number) => void;
}

export interface ProgressUploadOptions {
  /** No upload progress for this long aborts the request (default http_transfer.idle_timeout_seconds). */
  stallMs?: number;
  /** Fraction 0..1 of the request body sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const NULL_BODY_STATUSES: ReadonlySet<number> = new Set([101, 204, 205, 304]);

/** Bodies that carry file bytes (or a JSON string as large as one transfer chunk) go through the progress-driven path instead of a deadline-bound fetch. */
export function isUploadBody(body: BodyInit | null | undefined): boolean {
  if (body == null || body instanceof URLSearchParams) return false;
  if (typeof body === 'string') return body.length >= QUEUE_CENTER_HTTP_TRANSFER.maximum_chunk_bytes;
  return body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer || ArrayBuffer.isView(body);
}

function parseHeaders(raw: string): Headers {
  const headers = new Headers();
  raw.trim().split(/[\r\n]+/).forEach((line) => {
    const index = line.indexOf(':');
    if (index > 0) headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
  });
  return headers;
}

export function progressUpload(url: string, init: UploadRequestInit, options: ProgressUploadOptions = {}): Promise<Response> {
  const stallMs = options.stallMs ?? TRANSFER_IDLE_MS;
  const signal = options.signal ?? init.signal ?? undefined;
  const onProgress = options.onProgress ?? init.onUploadProgress;
  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const watchdog = createIdleWatchdog(stallMs, () => {
      xhr.abort();
      reject(new DOMException('Upload stalled', 'TimeoutError'));
    });
    const clearStall = watchdog.clear;
    const armStall = watchdog.arm;
    const onAbort = (): void => {
      xhr.abort();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    const settle = (): void => {
      clearStall();
      signal?.removeEventListener('abort', onAbort);
    };

    xhr.open(String(init.method || 'POST').toUpperCase(), url);
    xhr.responseType = 'arraybuffer';
    xhr.withCredentials = init.credentials === 'include';
    new Headers(init.headers).forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (event) => {
      armStall();
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.upload.onload = clearStall;
    xhr.onload = () => {
      settle();
      const body = NULL_BODY_STATUSES.has(xhr.status) ? null : xhr.response as ArrayBuffer;
      const response = new Response(body, {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders()),
      });
      Object.defineProperty(response, 'url', { value: url });
      resolve(response);
    };
    xhr.onerror = () => {
      settle();
      reject(new TypeError('Network request failed'));
    };
    armStall();
    xhr.send((init.body ?? null) as XMLHttpRequestBodyInit | null);
  });
}
