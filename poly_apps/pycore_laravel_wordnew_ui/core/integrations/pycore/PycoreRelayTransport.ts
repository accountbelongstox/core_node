/**
 * PycoreRelayTransport - the relay-scheme leg of the pycore HTTP transport
 * (DESIGN_20260817_2115 PART_3 §3.2/§3.3).
 *
 * When the selected pycore backend is an https entry (the server-side
 * reverse proxy of the relay), pycore requests do NOT go to the machine
 * directly: each request is framed into the relay data plane
 *   POST /api/relay/{machineId}/requests            (control frame)
 *   GET  /api/relay/{machineId}/responses/{id}?wait=1 (long-poll answer)
 *   POST/GET .../blobs/...                            (chunked large bodies)
 * and the paired machine executes it against its local :59000 server.
 *
 * The transport implements the SAME surface the direct path provides (one
 * fetch-shaped deliver()) and hooks the shared master client - domain
 * layers stay untouched. Caps and cadences come from the shared
 * QueueCenterContract (relay.caps / relay.response_poll_interval_ms /
 * relay.request_ttl_seconds); the pair state persists through
 * PycoreStorageKeys (the existing designation pattern).
 */
import { laravelApi } from '../laravel/LaravelAPI';
import type { RelayStoredResponse } from '../laravel/LaravelTypes';
import { QUEUE_CENTER_RELAY } from '../../contracts/QueueCenterContract';
import { isPycoreRelayMode } from './pycoreTarget';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { StorageManager } from '../../persistence';

/** Relay failure kinds the UI can branch on (badge / retry affordances). */
export type PycoreRelayErrorKind =
  | 'not-paired'
  | 'peer-offline'
  | 'request-timeout'
  | 'too-large'
  | 'http';

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

interface PersistedPairState {
  machine_id: string;
  session_id: string;
  expires_at: string;
}

/** Refresh the pair once this fraction of its TTL window has elapsed. */
const PAIR_REFRESH_FRACTION = 0.8;

let pairState: PersistedPairState | null = null;
let pairFlight: Promise<PersistedPairState> | null = null;

function loadPairState(): PersistedPairState | null {
  if (pairState) return pairState;
  const stored = StorageManager.get<PersistedPairState | null>(StorageKeys.RELAY_PAIR, null);
  if (stored && typeof stored.machine_id === 'string' && stored.machine_id) {
    pairState = stored;
  }
  return pairState;
}

function persistPairState(state: PersistedPairState | null): void {
  pairState = state;
  if (state) StorageManager.set(StorageKeys.RELAY_PAIR, state);
  else StorageManager.remove(StorageKeys.RELAY_PAIR);
}

function pairFresh(state: PersistedPairState | null): boolean {
  if (!state) return false;
  const expiresAt = Date.parse(state.expires_at);
  if (!Number.isFinite(expiresAt)) return false;
  const ttl = expiresAt - Date.now();
  return ttl > (QUEUE_CENTER_RELAY.pair_session_ttl_seconds * 1000) * (1 - PAIR_REFRESH_FRACTION);
}

/** The designated machine of the active pair (null while unpaired). */
export function relayPairedMachineId(): string | null {
  const state = loadPairState();
  return pairFresh(state) ? state!.machine_id : state?.machine_id ?? null;
}

/**
 * Forwarding gate: relay scheme + a pair whose machine matches the caller's
 * designation. The registry pair is the authority (R3) - the server REFUSES
 * requests while the peer is offline, surfaced here as peer-offline.
 */
export function isRelayForwardingAvailable(): boolean {
  return isPycoreRelayMode() && relayPairedMachineId() !== null;
}

/**
 * Designate a machine (pair register). Persists the pair and returns it;
 * re-registering an existing designation is a refresh.
 */
export async function relayDesignate(machineId: string): Promise<PersistedPairState> {
  if (pairFlight) return pairFlight;
  pairFlight = laravelApi.relayPair(machineId)
    .then(({ pair }) => {
      const state: PersistedPairState = {
        machine_id: pair.machine_id,
        session_id: pair.session_id,
        expires_at: pair.expires_at,
      };
      persistPairState(state);
      return state;
    })
    .finally(() => {
      pairFlight = null;
    });
  return pairFlight;
}

/** Drop the designation (unpair). */
export function relayUndesignate(): void {
  persistPairState(null);
}

async function ensurePair(): Promise<PersistedPairState> {
  const current = loadPairState();
  if (pairFresh(current)) return current!;
  if (!current) {
    throw new PycoreRelayError(
      'not-paired',
      'Relay scheme selected but no machine is designated; designate one from the roster.',
    );
  }
  // Stale pair: refresh against the designated machine (409 propagates as
  // peer-offline - the machine stopped heartbeating).
  return relayDesignate(current.machine_id).catch((error: any) => {
    if (error && (error.status === 409 || String(error.message || '').includes('409'))) {
      throw new PycoreRelayError('peer-offline', `Machine ${current.machine_id} is offline.`, 409);
    }
    throw error;
  });
}

async function encodeBody(
  body: BodyInit | null | undefined,
): Promise<{ bytes: Uint8Array | null; text: string | null }> {
  if (body == null) return { bytes: null, text: null };
  if (typeof body === 'string') return { bytes: null, text: body };
  if (body instanceof Uint8Array) return { bytes: body, text: null };
  if (body instanceof ArrayBuffer) return { bytes: new Uint8Array(body), text: null };
  if (body instanceof Blob) return { bytes: new Uint8Array(await body.arrayBuffer()), text: null };
  return { bytes: null, text: String(body) };
}

/** Upload one body as chunked blobs; returns the final blob ref. */
async function uploadBodyBlob(
  machineId: string,
  bytes: Uint8Array,
): Promise<string> {
  const chunkCap = QUEUE_CENTER_RELAY.caps.blob_chunk_bytes;
  const totalCap = QUEUE_CENTER_RELAY.caps.request_total_bytes;
  if (bytes.byteLength > totalCap) {
    throw new PycoreRelayError(
      'too-large',
      `Relay body ${bytes.byteLength}B exceeds the per-request cap ${totalCap}B.`,
    );
  }
  let blobId: string | null = null;
  let offset = 0;
  let index = 0;
  for (;;) {
    const chunk = bytes.subarray(offset, offset + chunkCap);
    const last = offset + chunkCap >= bytes.byteLength;
    const meta = await laravelApi.relayBlobCreate(machineId, blobId, index, last, chunk);
    blobId = meta.blob_id;
    if (last) break;
    offset += chunkCap;
    index += 1;
  }
  return blobId!;
}

interface FrameHeaders {
  [name: string]: string;
}

/**
 * One relay round trip: frame -> request -> long-poll answer -> (optional)
 * blob body. Returns a fetch-shaped Response so the master client's
 * semantics (status/headers/body parsing) are preserved unchanged.
 */
export async function relayDeliver(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  const parsed = new URL(url);
  const path = `${parsed.pathname}${parsed.search}`;
  const method = String(init.method || 'GET').toUpperCase();
  const headers: FrameHeaders = {};
  new Headers(init.headers).forEach((value, name) => {
    headers[name] = value;
  });

  const pair = await ensurePair();
  const machineId = pair.machine_id;
  const { bytes, text } = await encodeBody(init.body);
  const inlineCap = QUEUE_CENTER_RELAY.caps.inline_body_bytes;

  let body: string | null = null;
  let bodyRef: string | null = null;
  if (bytes && bytes.byteLength > inlineCap) {
    bodyRef = await uploadBodyBlob(machineId, bytes);
  } else if (bytes) {
    body = new TextDecoder().decode(bytes);
  } else if (text != null && text.length > inlineCap) {
    bodyRef = await uploadBodyBlob(machineId, new TextEncoder().encode(text));
  } else {
    body = text;
  }

  const frameJson = JSON.stringify({ method, path, headers, body, body_ref: bodyRef });
  if (frameJson.length > QUEUE_CENTER_RELAY.caps.control_frame_bytes) {
    throw new PycoreRelayError(
      'too-large',
      `Relay control frame ${frameJson.length}B exceeds the cap ${QUEUE_CENTER_RELAY.caps.control_frame_bytes}B (long path/headers).`,
    );
  }

  const created = await laravelApi.relayRequest(machineId, {
    method,
    path,
    headers,
    body,
    body_ref: bodyRef,
  }).catch(mapRequestError(machineId));

  const requestId = created.request.request_id;
  const stored = await awaitResponse(machineId, requestId, signal);
  return materializeResponse(machineId, stored);
}

function mapRequestError(machineId: string): (error: any) => never {
  return (error: any) => {
    if (error && (error.status === 409 || String(error.message || '').includes('_409'))) {
      throw new PycoreRelayError('peer-offline', `Machine ${machineId} is offline.`, 409);
    }
    throw error;
  };
}

async function awaitResponse(
  machineId: string,
  requestId: string,
  signal?: AbortSignal,
): Promise<RelayStoredResponse> {
  const deadline = Date.now() + QUEUE_CENTER_RELAY.request_ttl_seconds * 1000;
  const pollIntervalMs = QUEUE_CENTER_RELAY.response_poll_interval_ms;

  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // Long-poll first (bounded ~25 s server-side); the caller-owned signal
    // (master client ceiling) is the only deadline - the shared transport's
    // default 15 s abort is bypassed by passing our own.
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    let stored: RelayStoredResponse | null = null;
    try {
      stored = await laravelApi.relayResponse(machineId, requestId, true, controller.signal)
        .catch((error: any) => {
          if (error?.name === 'AbortError' && !signal?.aborted) return null;
          throw error;
        });
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }
    if (stored) return stored;
    if (Date.now() >= deadline) {
      throw new PycoreRelayError(
        'request-timeout',
        `Relay request ${requestId} got no answer within ${QUEUE_CENTER_RELAY.request_ttl_seconds}s.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

async function materializeResponse(
  machineId: string,
  stored: RelayStoredResponse,
): Promise<Response> {
  let bodyBytes: ArrayBuffer | null = null;
  if (stored.body_ref) {
    const bytes = await laravelApi.relayBlobFetch(machineId, stored.body_ref);
    bodyBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  const headers = new Headers(stored.headers || {});
  const init: ResponseInit = { status: stored.status, headers };
  return bodyBytes
    ? new Response(bodyBytes, init)
    : new Response(stored.body ?? null, init);
}
