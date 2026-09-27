/**
 * The single transport for extension -> Laravel HTTP. Every request is signed
 * with the shared client key (K3) by the native host (K6): only the method,
 * path, raw query and body digest go out, and only the signed headers come
 * back. The key never enters the extension.
 */

import serviceContract from '../../../../../config/service_contract.json';
import type { ClientKeySignRequest, ClientKeySignResult } from 'chrome-mcp-shared';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import { fetchWithTimeout } from '@/utils/async';
import { sha256Hex } from '@/utils/binary';
import { logger } from '@/utils/logger';

export type ClientKeySignTransport = (request: ClientKeySignRequest) => Promise<ClientKeySignResult>;

interface BodyDigest {
  contentType: string;
  contentSha256: string;
}

const LOG = 'LaravelTransport';
const CLIENT_KEY_AUTH = serviceContract.client_key_auth;
const MULTIPART_CONTENT_TYPE = CLIENT_KEY_AUTH.unsigned_payload_content_types[0];
const TEXT_CONTENT_TYPE = 'text/plain;charset=UTF-8';
const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded;charset=UTF-8';
const CONTENT_TYPE_HEADER = 'Content-Type';
const SIGNING_PAUSE_MS = 30000;
const UNSIGNED_WARN_INTERVAL_MS = 60000;
const textEncoder = new TextEncoder();

let localSignTransport: ClientKeySignTransport | null = null;
let signingPausedUntil = 0;
let lastUnsignedWarnAt = 0;

/** The background registers its native-host transport; other contexts relay to it. */
export function registerClientKeySignTransport(transport: ClientKeySignTransport): void {
  localSignTransport = transport;
}

export function requestClientKeySignature(request: ClientKeySignRequest): Promise<ClientKeySignResult> {
  if (localSignTransport) return localSignTransport(request);
  return chrome.runtime.sendMessage({ type: BACKGROUND_MESSAGE_TYPES.CLIENT_KEY_SIGN, payload: request });
}

/** The body digest exactly as fetch will transmit it; multipart is the contract unsigned payload. */
async function describeBody(body: BodyInit | null | undefined, headers: Headers): Promise<BodyDigest> {
  const declared = headers.get(CONTENT_TYPE_HEADER) ?? '';
  if (body instanceof FormData) {
    return { contentType: MULTIPART_CONTENT_TYPE, contentSha256: CLIENT_KEY_AUTH.unsigned_payload };
  }
  if (body === null || body === undefined) {
    return { contentType: declared, contentSha256: await sha256Hex(new Uint8Array()) };
  }
  if (typeof body === 'string') {
    return { contentType: declared || TEXT_CONTENT_TYPE, contentSha256: await sha256Hex(textEncoder.encode(body)) };
  }
  if (body instanceof URLSearchParams) {
    return {
      contentType: declared || FORM_CONTENT_TYPE,
      contentSha256: await sha256Hex(textEncoder.encode(body.toString())),
    };
  }
  if (body instanceof Blob) {
    return {
      contentType: declared || body.type,
      contentSha256: await sha256Hex(new Uint8Array(await body.arrayBuffer())),
    };
  }
  if (body instanceof ArrayBuffer) {
    return { contentType: declared, contentSha256: await sha256Hex(new Uint8Array(body)) };
  }
  if (ArrayBuffer.isView(body)) {
    return {
      contentType: declared,
      contentSha256: await sha256Hex(new Uint8Array(body.buffer, body.byteOffset, body.byteLength)),
    };
  }
  throw new Error('Unsupported request body for client-key signing');
}

function warnUnsigned(target: string, reason: unknown): void {
  const now = Date.now();
  if (now - lastUnsignedWarnAt < UNSIGNED_WARN_INTERVAL_MS) return;
  lastUnsignedWarnAt = now;
  logger.warn(LOG, `Client-key signature refused or unavailable; sending ${target} unsigned (client.key routes fail closed)`, reason);
}

/**
 * Signed headers for one Laravel request, or none when the native host cannot
 * sign (not connected, key missing): the request then goes out unsigned and
 * Laravel fails `client.key` routes closed. A host that does not answer pauses
 * signing briefly so each call does not wait for the sign timeout.
 */
async function clientKeyHeaders(url: string, init: RequestInit, headers: Headers): Promise<Record<string, string>> {
  if (Date.now() < signingPausedUntil) return {};
  const method = (init.method || 'GET').toUpperCase();
  let request: ClientKeySignRequest;
  try {
    const target = new URL(url);
    request = {
      method,
      url: `${target.pathname}${target.search}`,
      ...(await describeBody(init.body, headers)),
    };
  } catch (error) {
    warnUnsigned(`${method} ${url}`, error);
    return {};
  }
  try {
    const result = await requestClientKeySignature(request);
    if (result?.ok && result.headers) return result.headers;
    warnUnsigned(`${method} ${request.url}`, result?.code);
  } catch (error) {
    signingPausedUntil = Date.now() + SIGNING_PAUSE_MS;
    warnUnsigned(`${method} ${request.url}`, error);
  }
  return {};
}

/** fetch() for a Laravel URL, signed with the client key; `timeoutMs` bounds the request. */
export async function laravelFetch(url: string, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(await clientKeyHeaders(url, init, headers))) {
    headers.set(name, value);
  }
  const signedInit: RequestInit = { ...init, headers };
  return timeoutMs === undefined ? fetch(url, signedInit) : fetchWithTimeout(url, timeoutMs, signedInit);
}
