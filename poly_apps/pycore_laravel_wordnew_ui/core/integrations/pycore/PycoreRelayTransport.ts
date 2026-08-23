import { RELAY_V2_CONTRACT, type RelayV2Operation, type RelayV2Pairing } from '../../contracts/RelayV2Contract';
import { laravelApi } from '../laravel/LaravelAPI';
import { StorageManager } from '../../persistence';
import { isPycoreRelayMode } from './pycoreTarget';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';

export type PycoreRelayErrorKind = 'not-paired' | 'peer-offline' | 'request-timeout' | 'too-large' | 'http';

export class PycoreRelayError extends Error {
  readonly kind: PycoreRelayErrorKind;
  readonly status: number;

  constructor(kind: PycoreRelayErrorKind, message: string, status = 0) {
    super(message);
    this.name = 'PycoreRelayError';
    this.kind = kind;
    this.status = status;
  }
}

export function isPycoreRelayError(error: unknown): error is PycoreRelayError {
  return !!error && (error as PycoreRelayError).name === 'PycoreRelayError';
}

interface PersistedRelayState {
  client_instance_id: string;
  selected_device_id: string | null;
  pairings: Record<string, RelayV2Pairing>;
}

const TERMINAL_STATES = new Set(['responded', 'failed', 'execution_unknown', 'expired', 'canceled']);
const PAIR_RENEW_MARGIN_MS = Math.floor(RELAY_V2_CONTRACT.durations.pairing_lease_seconds * 200);
const OPERATION_POLL_MS = 400;
const pairFlights = new Map<string, Promise<RelayV2Pairing>>();
let relayState: PersistedRelayState | null = null;

function newUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function loadRelayState(): PersistedRelayState {
  if (relayState) return relayState;
  const stored = StorageManager.get<Partial<PersistedRelayState> | null>(StorageKeys.RELAY_V2_STATE, null);
  relayState = {
    client_instance_id: typeof stored?.client_instance_id === 'string' && stored.client_instance_id.length >= 16
      ? stored.client_instance_id
      : newUuid(),
    selected_device_id: typeof stored?.selected_device_id === 'string' ? stored.selected_device_id : null,
    pairings: stored?.pairings && typeof stored.pairings === 'object' ? stored.pairings : {},
  };
  persistRelayState();
  return relayState;
}

function persistRelayState(): void {
  if (relayState) StorageManager.set(StorageKeys.RELAY_V2_STATE, relayState);
}

function pairingFresh(pairing: RelayV2Pairing | undefined): boolean {
  if (!pairing || pairing.state !== 'active') return false;
  const expiresAt = Date.parse(pairing.expires_at);
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > PAIR_RENEW_MARGIN_MS;
}

export function relayPairedMachineId(): string | null {
  return loadRelayState().selected_device_id;
}

export function isRelayForwardingAvailable(): boolean {
  return isPycoreRelayMode() && relayPairedMachineId() !== null;
}

export async function relayDesignate(deviceId: string): Promise<RelayV2Pairing> {
  const state = loadRelayState();
  state.selected_device_id = deviceId;
  persistRelayState();
  const current = state.pairings[deviceId];
  if (pairingFresh(current)) return current!;
  const inFlight = pairFlights.get(deviceId);
  if (inFlight) return inFlight;
  const request = (current
    ? laravelApi.renewRelayV2Pairing(current.pairing_id).catch((error: any) => {
        if (error?.status === 404 || error?.status === 409) {
          return laravelApi.createRelayV2Pairing(deviceId, state.client_instance_id);
        }
        throw error;
      })
    : laravelApi.createRelayV2Pairing(deviceId, state.client_instance_id))
    .then((pairing) => {
      state.pairings[deviceId] = pairing;
      persistRelayState();
      return pairing;
    })
    .finally(() => pairFlights.delete(deviceId));
  pairFlights.set(deviceId, request);
  return request;
}

export async function relayUndesignate(): Promise<void> {
  const state = loadRelayState();
  const deviceId = state.selected_device_id;
  const pairing = deviceId ? state.pairings[deviceId] : undefined;
  if (pairing) {
    await laravelApi.revokeRelayV2Pairing(pairing.pairing_id);
    delete state.pairings[pairing.device_id];
  }
  state.selected_device_id = null;
  persistRelayState();
}

async function ensurePair(): Promise<RelayV2Pairing> {
  const state = loadRelayState();
  let deviceId = state.selected_device_id;
  if (!deviceId) {
    const devices = await laravelApi.getRelayV2Devices();
    const onlineDevices = devices.filter((device) => {
      const lastSeenAt = Date.parse(device.last_seen_at || '');
      const offlineAfterMs = (RELAY_V2_CONTRACT.durations.heartbeat_seconds * 2 + 5) * 1000;
      return Number.isFinite(lastSeenAt) && Date.now() - lastSeenAt <= offlineAfterMs;
    });
    if (onlineDevices.length === 1) deviceId = onlineDevices[0].device_id;
    else throw new PycoreRelayError('not-paired', 'RELAY_DEVICE_SELECTION_REQUIRED');
  }
  return relayDesignate(deviceId).catch((error: any) => {
    if (error?.status === 404 || error?.status === 409) {
      throw new PycoreRelayError('peer-offline', 'RELAY_DEVICE_UNAVAILABLE', error.status);
    }
    throw error;
  });
}

async function bodyBytes(body: BodyInit | null | undefined): Promise<Uint8Array | null> {
  if (body == null) return null;
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer());
  if (body instanceof URLSearchParams) return new TextEncoder().encode(body.toString());
  throw new PycoreRelayError('http', 'RELAY_BODY_TYPE_UNSUPPORTED');
}

function bytesBase64(bytes: Uint8Array): string {
  const blockSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += blockSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + blockSize));
  }
  return btoa(binary);
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const input = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function queryRecord(url: URL): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  url.searchParams.forEach((value, key) => {
    const current = result[key];
    if (current === undefined) result[key] = value;
    else result[key] = Array.isArray(current) ? [...current, value] : [current, value];
  });
  return result;
}

function allowedHeaders(init: HeadersInit | undefined): Record<string, string> {
  const allowed = new Set<string>(RELAY_V2_CONTRACT.headers.request_allow);
  const result: Record<string, string> = {};
  new Headers(init).forEach((value, name) => {
    if (allowed.has(name.toLowerCase())) result[name.toLowerCase()] = value;
  });
  return result;
}

async function uploadRequestBlob(pairingId: string, bytes: Uint8Array, digest: string): Promise<string> {
  if (bytes.byteLength > RELAY_V2_CONTRACT.limits.request_body_bytes) {
    throw new PycoreRelayError('too-large', 'RELAY_REQUEST_BODY_TOO_LARGE', 413);
  }
  const blobId = newUuid();
  await laravelApi.allocateRelayV2RequestBlob(blobId, pairingId, digest, bytes.byteLength);
  const chunkSize = RELAY_V2_CONTRACT.limits.blob_chunk_bytes;
  for (let offset = 0, index = 0; offset < bytes.byteLength; offset += chunkSize, index += 1) {
    await laravelApi.putRelayV2RequestBlobChunk(blobId, index, bytes.subarray(offset, offset + chunkSize));
  }
  await laravelApi.finalizeRelayV2RequestBlob(blobId, digest, bytes.byteLength);
  return blobId;
}

function abortGuard(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

async function waitForOperation(operation: RelayV2Operation, signal?: AbortSignal): Promise<RelayV2Operation> {
  const deadline = Date.now()
    + (RELAY_V2_CONTRACT.durations.claim_timeout_seconds + RELAY_V2_CONTRACT.durations.execution_timeout_seconds) * 1000;
  let current = operation;
  while (!TERMINAL_STATES.has(current.state)) {
    abortGuard(signal);
    if (Date.now() >= deadline) throw new PycoreRelayError('request-timeout', 'RELAY_OPERATION_TIMEOUT');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, OPERATION_POLL_MS);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    current = await laravelApi.getRelayV2Operation(current.operation_id);
  }
  return current;
}

async function responseBytes(operation: RelayV2Operation): Promise<Uint8Array | null> {
  if (!operation.response_body_present) return null;
  const bytes = operation.response_body_ref
    ? await laravelApi.getRelayV2ResponseBlob(operation.response_body_ref)
    : base64Bytes(operation.response_body_base64 || '');
  if (operation.response_body_length !== bytes.byteLength
      || operation.response_body_sha256 !== await sha256(bytes)) {
    throw new PycoreRelayError('http', 'RELAY_RESPONSE_DIGEST_CONFLICT', 409);
  }
  return bytes;
}

export async function relayDeliver(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  abortGuard(signal);
  const pairing = await ensurePair();
  const parsed = new URL(url);
  const method = String(init.method || 'GET').toUpperCase();
  const bytes = await bodyBytes(init.body);
  const exactBytes = bytes ?? new Uint8Array();
  const digest = await sha256(exactBytes);
  const operationId = newUuid();
  const headers = allowedHeaders(init.headers);
  const requestId = headers['x-request-id'];
  const frame = {
    operation_id: operationId,
    idempotency_key: requestId && requestId.length <= 128 ? requestId : operationId,
    pairing_id: pairing.pairing_id,
    method,
    path: parsed.pathname.replace(/^\/api(?=\/)/, ''),
    query: queryRecord(parsed),
    headers,
    body_present: bytes !== null,
    body_sha256: digest,
    body_length: exactBytes.byteLength,
  };
  if (bytes !== null && bytes.byteLength > RELAY_V2_CONTRACT.limits.inline_body_bytes) {
    Object.assign(frame, { body_ref: await uploadRequestBlob(pairing.pairing_id, bytes, digest) });
  } else if (bytes !== null) {
    Object.assign(frame, { body_base64: bytesBase64(bytes) });
  }
  const completed = await waitForOperation(await laravelApi.admitRelayV2Operation(frame), signal);
  if (completed.state !== 'responded' || completed.response_status === null) {
    throw new PycoreRelayError('http', completed.error_code || `RELAY_OPERATION_${completed.state.toUpperCase()}`);
  }
  const responseBody = await responseBytes(completed);
  return new Response(responseBody, {
    status: completed.response_status,
    headers: completed.response_headers || {},
  });
}
