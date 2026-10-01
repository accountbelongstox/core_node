import { RELAY_CONTRACT } from '../../contracts/RelayContract';
import { PycoreRelayError } from './PycoreRelayError';

/** Byte/header/frame helpers shared by the relay transport. */

const BASE64_BLOCK_BYTES = 0x8000;

export function newUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function abortGuard(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

export function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(new DOMException('Aborted', 'AbortError'));
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

export async function bodyBytes(body: BodyInit | null | undefined): Promise<Uint8Array | null> {
  if (body == null) return null;
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString());
  throw new PycoreRelayError('http', 'RELAY_BODY_TYPE_UNSUPPORTED');
}

export function bytesBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_BLOCK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_BLOCK_BYTES));
  }
  return btoa(binary);
}

export function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export function queryRecord(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const current = result[key];
    if (current === undefined) result[key] = value;
    else result[key] = Array.isArray(current) ? [...current, value] : [current, value];
  });
  return result;
}

export function allowedHeaders(init: HeadersInit | undefined, body?: BodyInit | null): Record<string, string> {
  const allowed = new Set<string>(RELAY_CONTRACT.headers.request_allow);
  const result: Record<string, string> = {};
  const headers = new Headers(init);
  if (!headers.has('content-type') && body instanceof Blob && body.type) headers.set('content-type', body.type);
  headers.forEach((value, name) => {
    if (allowed.has(name.toLowerCase())) result[name.toLowerCase()] = value;
  });
  return result;
}

/** Relay routes are addressed without the Laravel `/api` prefix. */
export function relayRoutePath(url: URL): string {
  return url.pathname.replace(/^\/api(?=\/)/, '');
}
