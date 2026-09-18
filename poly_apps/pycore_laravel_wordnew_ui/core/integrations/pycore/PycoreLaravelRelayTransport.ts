import { RELAY_CONTRACT, type RelayOperation, type RelayOperationAdmission, type RelayPairing } from '../../contracts/RelayContract';
import { laravelRelayApi as laravelApi } from '../laravel/LaravelRelayAPI';
import { laravelRelayRoster } from '../laravel/LaravelRelayRoster';
import { laravelRelayOperationEvents } from '../laravel/LaravelRelayOperationEvents';
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
  pairings: Record<string, RelayPairing>;
}

const TERMINAL_STATES = new Set(['responded', 'failed', 'execution_unknown', 'expired', 'canceled']);
const PAIR_RENEW_MARGIN_MS = Math.floor(RELAY_CONTRACT.durations.pairing_lease_seconds * 200);
// Long-connection-first waiting: the Mercure stream is the notification
// plane, HTTP polling is only a bounded reconciliation fallback. While the
// stream is live, waiters reconcile at a slow cadence (the wake resolves
// them the instant a status push arrives); while it is down, the fallback
// backs off exponentially so the owner rate limiter can never be exhausted
// by polling (429s also back the poll off). 
const OPERATION_CONNECT_WAIT_MS = 3_000;
const OPERATION_POLL_FLOOR_MS = 1_000;
const OPERATION_POLL_MAX_MS = 15_000;
const OPERATION_RECONCILIATION_MS = 10_000;
const pairFlights = new Map<string, Promise<RelayPairing>>();
const operationWakeWaiters = new Map<string, Set<() => void>>();
const selectionHandlers = new Set<(deviceId: string | null) => void>();
let relayState: PersistedRelayState | null = null;
let wakeWired = false;

function notifySelection(deviceId: string | null): void {
  selectionHandlers.forEach((handler) => handler(deviceId));
}

function assignSelectedDevice(state: PersistedRelayState, deviceId: string | null): void {
  if (state.selected_device_id === deviceId) return;
  state.selected_device_id = deviceId;
  persistRelayState();
  notifySelection(deviceId);
}

function recoverablePairingError(error: unknown): boolean {
  const failure = error as { status?: number; payload?: { error_code?: string } };
  return (failure?.status === 404 || failure?.status === 409)
    && ['pairing_not_found', 'pairing_expired', 'pairing_credential_stale'].includes(failure.payload?.error_code || '');
}

function invalidatePairing(pairing: RelayPairing): void {
  const state = loadRelayState();
  if (state.pairings[pairing.device_id]?.pairing_id !== pairing.pairing_id
    || state.pairings[pairing.device_id].revision > pairing.revision) return;
  delete state.pairings[pairing.device_id];
  persistRelayState();
}

function notifyOperationWake(operationId: string): void {
  const waiters = operationWakeWaiters.get(operationId);
  if (!waiters) return;
  for (const resolve of [...waiters]) resolve();
}

// The hub keeps no event history, so frames published while the stream is
// down are lost. Every (re)connection must trigger an immediate bounded
// reconciliation for ALL in-flight operations.
function notifyAllOperationWakes(): void {
  for (const operationId of [...operationWakeWaiters.keys()]) {
    notifyOperationWake(operationId);
  }
}

function ensureOperationWake(): void {
  if (!wakeWired) {
    wakeWired = true;
    laravelRelayOperationEvents.onOperationEvent((operationId, state) => {
      if (TERMINAL_STATES.has(state)) notifyOperationWake(operationId);
    });
    laravelRelayOperationEvents.onConnectionState((connected) => {
      if (connected) notifyAllOperationWakes();
    });
    laravelRelayOperationEvents.onEvent((event, data) => {
      const frame = data as { pairing_id?: string; revision?: number; state?: string } | null;
      if (event !== RELAY_CONTRACT.events.pairing_changed || !frame?.pairing_id) return;
      for (const pairing of Object.values(loadRelayState().pairings)) {
        if (pairing.pairing_id === frame.pairing_id && Number(frame.revision) > pairing.revision) {
          invalidatePairing(pairing);
        }
      }
    });
  }
}

function createOperationWake(operationId: string, signal?: AbortSignal): {
  wait: (maxMs: number) => Promise<void>;
  dispose: () => void;
} {
  let wakeResolve: (() => void) | null = null;
  let pendingWake = false;
  const waiter = (): void => {
    pendingWake = true;
    if (wakeResolve) {
      wakeResolve();
      wakeResolve = null;
    }
  };
  const waiters = operationWakeWaiters.get(operationId) ?? new Set<() => void>();
  waiters.add(waiter);
  operationWakeWaiters.set(operationId, waiters);
  return {
    wait(maxMs: number): Promise<void> {
      if (pendingWake) {
        pendingWake = false;
        return Promise.resolve();
      }
      return new Promise<void>((resolve, reject) => {
        const settle = (outcome: () => void): void => {
          pendingWake = false;
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
          wakeResolve = null;
          outcome();
        };
        const onAbort = (): void => {
          settle(() => reject(new DOMException('Aborted', 'AbortError')));
        };
        const timer = setTimeout(() => settle(resolve), maxMs);
        wakeResolve = () => settle(resolve);
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener('abort', onAbort, { once: true });
      });
    },
    dispose(): void {
      waiters.delete(waiter);
      if (waiters.size === 0) operationWakeWaiters.delete(operationId);
    },
  };
}

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
  let stored = StorageManager.get<Partial<PersistedRelayState> | null>(StorageKeys.RELAY_STATE, null);
  const legacy = stored === null
    ? StorageManager.get<Partial<PersistedRelayState> | null>(StorageKeys.RELAY_STATE_LEGACY, null)
    : null;
  if (stored === null && legacy !== null) {
    stored = legacy;
    StorageManager.set(StorageKeys.RELAY_STATE, legacy);
    StorageManager.remove(StorageKeys.RELAY_STATE_LEGACY);
  }
  relayState = {
    client_instance_id: typeof stored?.client_instance_id === 'string' && stored.client_instance_id.length >= 16
      ? stored.client_instance_id
      : newUuid(),
    selected_device_id: typeof stored?.selected_device_id === 'string' ? stored.selected_device_id : null,
    pairings: {},
  };
  persistRelayState();
  return relayState;
}

function persistRelayState(): void {
  if (relayState) StorageManager.set(StorageKeys.RELAY_STATE, relayState);
}

function pairingFresh(pairing: RelayPairing | undefined): boolean {
  if (!pairing || pairing.state !== 'active') return false;
  const expiresAt = Date.parse(pairing.expires_at);
  return Number.isFinite(expiresAt) && expiresAt - Date.now() > PAIR_RENEW_MARGIN_MS;
}

export function laravelRelayDeviceId(): string | null {
  return loadRelayState().selected_device_id;
}

export function subscribeLaravelRelayDevice(
  handler: (deviceId: string | null) => void,
): () => void {
  selectionHandlers.add(handler);
  handler(laravelRelayDeviceId());
  return () => selectionHandlers.delete(handler);
}

export function isLaravelRelayReady(): boolean {
  return isPycoreRelayMode() && laravelRelayDeviceId() !== null;
}

export async function designateLaravelRelayDevice(deviceId: string): Promise<RelayPairing> {
  const state = loadRelayState();
  assignSelectedDevice(state, deviceId);
  const current = state.pairings[deviceId];
  if (pairingFresh(current)) return current!;
  const inFlight = pairFlights.get(deviceId);
  if (inFlight) return inFlight;
  const request = (current
    ? laravelApi.renewRelayPairing(current.pairing_id).catch((error: any) => {
        if (recoverablePairingError(error)) {
          return laravelApi.createRelayPairing(deviceId, state.client_instance_id);
        }
        throw error;
      })
    : laravelApi.createRelayPairing(deviceId, state.client_instance_id))
    .then((pairing) => {
      state.pairings[deviceId] = pairing;
      persistRelayState();
      return pairing;
    })
    .finally(() => {
      if (pairFlights.get(deviceId) === request) pairFlights.delete(deviceId);
    });
  pairFlights.set(deviceId, request);
  return request;
}

export async function clearLaravelRelayDevice(): Promise<void> {
  const state = loadRelayState();
  const deviceId = state.selected_device_id;
  const pairing = deviceId ? state.pairings[deviceId] : undefined;
  if (pairing) {
    await laravelApi.revokeRelayPairing(pairing.pairing_id);
    delete state.pairings[pairing.device_id];
  }
  assignSelectedDevice(state, null);
}

async function ensurePair(): Promise<RelayPairing> {
  const state = loadRelayState();
  let deviceId = state.selected_device_id;
  const devices = await laravelRelayRoster.requireDevices();
  const selected = devices.find((device) => device.device_id === deviceId);
  if (deviceId && !selected) {
    delete state.pairings[deviceId];
    assignSelectedDevice(state, null);
    deviceId = null;
  }
  if (!deviceId) {
    deviceId = laravelRelayRoster.preferredDeviceId();
    if (!deviceId) {
      const unavailable = laravelRelayRoster.unavailableError();
      throw Object.assign(new PycoreRelayError('not-paired', unavailable.message, 503), unavailable);
    }
  }
  return designateLaravelRelayDevice(deviceId).catch((error: any) => {
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
  const allowed = new Set<string>(RELAY_CONTRACT.headers.request_allow);
  const result: Record<string, string> = {};
  new Headers(init).forEach((value, name) => {
    if (allowed.has(name.toLowerCase())) result[name.toLowerCase()] = value;
  });
  return result;
}

async function uploadRequestBlob(pairingId: string, bytes: Uint8Array, digest: string, signal?: AbortSignal): Promise<string> {
  if (bytes.byteLength > RELAY_CONTRACT.limits.request_body_bytes) {
    throw new PycoreRelayError('too-large', 'RELAY_REQUEST_BODY_TOO_LARGE', 413);
  }
  const blobId = newUuid();
  abortGuard(signal);
  await laravelApi.allocateRelayRequestBlob(blobId, pairingId, digest, bytes.byteLength);
  const chunkSize = RELAY_CONTRACT.limits.blob_chunk_bytes;
  for (let offset = 0, index = 0; offset < bytes.byteLength; offset += chunkSize, index += 1) {
    abortGuard(signal);
    await laravelApi.putRelayRequestBlobChunk(blobId, index, bytes.subarray(offset, offset + chunkSize));
  }
  abortGuard(signal);
  await laravelApi.finalizeRelayRequestBlob(blobId, digest, bytes.byteLength);
  return blobId;
}

function abortGuard(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

async function waitForOperation(operation: RelayOperation, signal?: AbortSignal): Promise<RelayOperation> {
  const deadline = performance.now()
    + (RELAY_CONTRACT.durations.claim_timeout_seconds + RELAY_CONTRACT.durations.execution_timeout_seconds) * 1000;
  let current = laravelRelayOperationEvents.takeOperation(operation.operation_id) || operation;
  const wake = createOperationWake(current.operation_id, signal);
  let fallbackMs = OPERATION_POLL_FLOOR_MS;
  try {
    // Long connection first: give the Mercure stream a short window to
    // establish before any HTTP reconciliation runs.
    await laravelRelayOperationEvents.whenConnected(OPERATION_CONNECT_WAIT_MS);
    while (!TERMINAL_STATES.has(current.state)) {
      abortGuard(signal);
      if (performance.now() >= deadline) throw new PycoreRelayError('request-timeout', 'RELAY_OPERATION_TIMEOUT');
      let connected = laravelRelayOperationEvents.isConnected();
      await wake.wait(connected ? OPERATION_RECONCILIATION_MS : fallbackMs);
      abortGuard(signal);
      if (performance.now() >= deadline) throw new PycoreRelayError('request-timeout', 'RELAY_OPERATION_TIMEOUT');
      try {
        const observed = laravelRelayOperationEvents.takeOperation(current.operation_id)
          || await laravelApi.getRelayOperation(current.operation_id);
        if (observed.revision >= current.revision) current = observed;
      } catch (error) {
        // Yield the owner rate limiter: treat 429 as backpressure and back
        // the reconciliation poll off instead of hammering the API.
        if ((error as { status?: number })?.status !== 429) throw error;
        connected = false;
      }
      if (connected) fallbackMs = OPERATION_POLL_FLOOR_MS;
      else fallbackMs = Math.min(OPERATION_POLL_MAX_MS, fallbackMs * 2);
    }
  } finally {
    wake.dispose();
  }
  return current;
}

async function responseBytes(operation: RelayOperation): Promise<Uint8Array | null> {
  if (!operation.response_body_present) return null;
  const bytes = operation.response_body_ref
    ? await laravelApi.getRelayResponseBlob(operation.response_body_ref)
    : base64Bytes(operation.response_body_base64 || '');
  if (operation.response_body_length !== bytes.byteLength
      || operation.response_body_sha256 !== await sha256(bytes)) {
    throw new PycoreRelayError('http', 'RELAY_RESPONSE_DIGEST_CONFLICT', 409);
  }
  return bytes;
}

export async function deliverThroughLaravelRelay(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  ensureOperationWake();
  laravelRelayRoster.start();
  try {
    return await deliverOperation(url, init, signal);
  } finally {
    laravelRelayRoster.stop();
  }
}

async function deliverOperation(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  abortGuard(signal);
  let pairing = await ensurePair();
  const parsed = new URL(url);
  const method = String(init.method || 'GET').toUpperCase();
  const bytes = await bodyBytes(init.body);
  const exactBytes = bytes ?? new Uint8Array();
  const digest = await sha256(exactBytes);
  const operationId = newUuid();
  const headers = allowedHeaders(init.headers);
  const requestId = headers['x-request-id'];
  const frame: RelayOperationAdmission = {
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
  const admit = async (): Promise<RelayOperation> => {
    abortGuard(signal);
    if (bytes !== null && bytes.byteLength > RELAY_CONTRACT.limits.inline_body_bytes) {
      frame.body_ref = await uploadRequestBlob(pairing.pairing_id, bytes, digest, signal);
    } else if (bytes !== null) {
      frame.body_base64 = bytesBase64(bytes);
    }
    abortGuard(signal);
    return laravelApi.admitRelayOperation(frame);
  };
  let admitted: RelayOperation;
  abortGuard(signal);
  try {
    admitted = await admit();
  } catch (error) {
    if (!recoverablePairingError(error)) throw error;
    invalidatePairing(pairing);
    pairing = await designateLaravelRelayDevice(pairing.device_id);
    frame.pairing_id = pairing.pairing_id;
    abortGuard(signal);
    admitted = await admit();
  }
  const completed = await waitForOperation(admitted, signal);
  if (completed.state !== 'responded' || completed.response_status === null) {
    throw new PycoreRelayError('http', completed.error_code || `RELAY_OPERATION_${completed.state.toUpperCase()}`);
  }
  const responseBody = await responseBytes(completed);
  return new Response(responseBody === null ? null : new Uint8Array(responseBody), {
    status: completed.response_status,
    headers: completed.response_headers || {},
  });
}
