/**
 * The one client-key (K3) signer of the UI: HMAC-SHA256 over the canonical request fields, byte for byte the
 * Laravel verifier (ClientKeyAuthService) and the pycore signer (client_key_auth.py), all values from
 * config/service_contract.json#client_key_auth.
 *
 * The key is compiled in at build or debug time (`__CORE_NODE_CLIENT_KEY__`, set by vite only for an opted-in
 * build); without it, or without WebCrypto, requests go out unsigned and the session decides.
 */
import { CLIENT_KEY_AUTH } from '../../contracts/ServiceContract';
import { requiresClientKey } from './ClientKeyRouteTable';
import { StorageManager } from '../../persistence';
import { LaravelStorageKeys } from './LaravelStorageKeys';

declare const __CORE_NODE_CLIENT_KEY__: string | undefined;

const UI_CLIENT = 'ncore';
const MACHINE_ID_PREFIX = 'ui-';
const MACHINE_ID_RANDOM_BYTES = 6;
const NONCE_BYTES = 24;
const KEY_ID_LENGTH = 16;
const HEX = '0123456789abcdef';
const encoder = new TextEncoder();

let keyPromise: Promise<{ bytes: Uint8Array; id: string; hmac: CryptoKey } | null> | null = null;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array | null {
  const text = value.trim();
  if (!text || !/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.length >= CLIENT_KEY_AUTH.key_min_bytes ? bytes : null;
}

function hex(bytes: Uint8Array): string {
  let out = '';
  bytes.forEach((byte) => { out += HEX[byte >> 4] + HEX[byte & 15]; });
  return out;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** PHP rawurlencode: every byte but A-Za-z0-9-_.~ is percent-encoded. */
function rawUrlEncode(text: string): string {
  let out = '';
  encoder.encode(text).forEach((byte) => {
    const char = String.fromCharCode(byte);
    out += /[A-Za-z0-9\-_.~]/.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  });
  return out;
}

/** Same bytes as RelayContract::canonicalPath: percent-decode, then re-encode with `/-._~` kept. */
export function canonicalPath(path: string): string {
  if (path.includes('?') || path.includes('#') || path.startsWith('//') || path.includes('\\')) {
    throw new Error('signature_path_invalid');
  }
  const triplets = path.match(/%[0-9A-Za-z]{0,2}/g) ?? [];
  triplets.forEach((triplet) => {
    if (!/^%[0-9A-Fa-f]{2}$/.test(triplet) || /^%(2f|5c)$/i.test(triplet)) throw new Error('signature_path_invalid');
  });
  const decoded = decodeURIComponent(`/${path.replace(/^\/+/, '')}`);
  let out = '';
  encoder.encode(decoded).forEach((byte) => {
    if (byte < 32 || byte === 127) throw new Error('signature_path_invalid');
    const char = String.fromCharCode(byte);
    out += /[A-Za-z0-9/\-._~]/.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  });
  return out;
}

function decodeFormComponent(value: string): string {
  if (/%(?![0-9A-Fa-f]{2})/.test(value)) throw new Error('signature_query_invalid');
  return decodeURIComponent(value.replace(/\+/g, ' '));
}

function compareBytes(left: string, right: string): number {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

/** Same bytes as RelayContract::canonicalRawQuery: pairs form-decoded, sorted by key then value, form-encoded. */
export function canonicalRawQuery(rawQuery: string): string {
  const pairs = (rawQuery ? rawQuery.split('&') : []).map((segment): [string, string] => {
    const at = segment.indexOf('=');
    const key = at < 0 ? segment : segment.slice(0, at);
    const value = at < 0 ? '' : segment.slice(at + 1);
    return [decodeFormComponent(key), decodeFormComponent(value)];
  });
  pairs.sort((left, right) => compareBytes(left[0], right[0]) || compareBytes(left[1], right[1]));
  return pairs.map(([key, value]) => `${rawUrlEncode(key).replace(/%20/g, '+')}=${rawUrlEncode(value).replace(/%20/g, '+')}`).join('&');
}

function isUnsignedPayload(contentType: string): boolean {
  const media = contentType.split(';')[0].trim().toLowerCase();
  return CLIENT_KEY_AUTH.unsigned_payload_content_types.includes(media);
}

async function bodyBytes(body: BodyInit | null | undefined): Promise<Uint8Array> {
  if (body == null) return new Uint8Array();
  if (typeof body === 'string') return encoder.encode(body);
  if (body instanceof URLSearchParams) return encoder.encode(body.toString());
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (ArrayBuffer.isView(body)) return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  throw new Error('client_key_body_unsupported');
}

function loadKey(): Promise<{ bytes: Uint8Array; id: string; hmac: CryptoKey } | null> {
  keyPromise ??= (async () => {
    const compiled = typeof __CORE_NODE_CLIENT_KEY__ === 'string' ? __CORE_NODE_CLIENT_KEY__ : '';
    const bytes = compiled && typeof crypto !== 'undefined' && crypto.subtle ? decodeBase64Url(compiled) : null;
    if (!bytes) return null;
    const hmac = await crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return { bytes, id: hex(digest).slice(0, KEY_ID_LENGTH), hmac };
  })();
  return keyPromise;
}

/** Stable per-browser id that attributes the calls in the Laravel logs (not a trust boundary). */
function machineId(): string {
  const stored = StorageManager.getRaw(LaravelStorageKeys.CLIENT_KEY_MACHINE_ID);
  if (stored && new RegExp(CLIENT_KEY_AUTH.machine_id_pattern).test(stored)) return stored;
  const id = `${MACHINE_ID_PREFIX}${hex(randomBytes(MACHINE_ID_RANDOM_BYTES))}`;
  StorageManager.setRaw(LaravelStorageKeys.CLIENT_KEY_MACHINE_ID, id);
  return id;
}

export function clientKeyAvailable(): Promise<boolean> {
  return loadKey().then((key) => key !== null);
}

/** K3 headers of one request, or `{}` when this build holds no key (the session authenticates then). */
export async function clientKeyHeaders(
  method: string,
  url: string,
  body: BodyInit | null | undefined,
  contentType: string,
): Promise<Record<string, string>> {
  const key = await loadKey();
  if (!key) return {};
  const parsed = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
  const unsigned = isUnsignedPayload(contentType) || (typeof FormData !== 'undefined' && body instanceof FormData);
  const contentSha256 = unsigned
    ? CLIENT_KEY_AUTH.unsigned_payload
    : hex(new Uint8Array(await crypto.subtle.digest('SHA-256', await bodyBytes(body))));
  const fields: Record<string, string> = {
    canonical_version: CLIENT_KEY_AUTH.canonical_version,
    protocol: CLIENT_KEY_AUTH.protocol_version,
    method: method.toUpperCase(),
    path: canonicalPath(parsed.pathname),
    query: canonicalRawQuery(parsed.search.replace(/^\?/, '')),
    client: UI_CLIENT,
    machine_id: machineId(),
    key_id: key.id,
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: base64Url(randomBytes(NONCE_BYTES)),
    content_sha256: contentSha256,
  };
  const canonical = CLIENT_KEY_AUTH.canonical_fields.map((field) => fields[field]).join(CLIENT_KEY_AUTH.canonical_joiner);
  const signature = base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key.hmac, encoder.encode(canonical))));
  const headers = CLIENT_KEY_AUTH.headers;
  return {
    [headers.client]: fields.client,
    [headers.protocol]: fields.protocol,
    [headers.machine_id]: fields.machine_id,
    [headers.key_id]: fields.key_id,
    [headers.timestamp]: fields.timestamp,
    [headers.nonce]: fields.nonce,
    [headers.content_sha256]: fields.content_sha256,
    [headers.signature]: signature,
  };
}

/**
 * The request init with the K3 headers merged in when the route needs them and this build can sign;
 * every Laravel call path goes through this one function.
 */
export async function withClientKey(url: string, init: RequestInit): Promise<RequestInit> {
  let target: URL;
  try {
    target = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
  } catch {
    return init;
  }
  // Without a key there is nothing to add: the route table is not even consulted.
  if (!(await clientKeyAvailable())) return init;
  if (!requiresClientKey(String(init.method || 'GET'), target)) return init;
  const headers = new Headers(init.headers);
  const signed = await clientKeyHeaders(String(init.method || 'GET'), url, init.body, headers.get('Content-Type') || '');
  Object.entries(signed).forEach(([name, value]) => headers.set(name, value));
  return { ...init, headers };
}
