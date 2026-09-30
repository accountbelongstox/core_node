import { RELAY_CONTRACT, type RelayPairing } from '../../contracts/RelayContract';
import {
  RELAY_FABRIC_CONTRACT,
  type RelayFabricErrorName,
  type RelayFabricFrameAnswer,
  type RelayFabricFrameRequest,
  type RelayFabricGrant,
  type RelayFabricGrantDevice,
  type RelayFabricResponseFrame,
} from '../../contracts/RelayFabricContract';
import { laravelRelayApi as laravelApi } from '../laravel/LaravelRelayAPI';
import { LaravelMercureConnection } from '../laravel/LaravelMercureConnection';
import { laravelFabricTelemetry } from '../laravel/LaravelFabricTelemetry';
import { appendLog } from '../../logstore/logStore';
import { PycoreRelayError } from './PycoreRelayError';
import type { PycoreTransport, PycoreTransportHealth, PycoreTransportHealthHandler } from './PycoreTransportTypes';
import {
  abortGuard, allowedHeaders, base64Bytes, bodyBytes, bytesBase64, newUuid,
  queryRecord, relayRoutePath, sha256,
} from './PycoreRelayWire';

const LIMITS = RELAY_FABRIC_CONTRACT.limits;
const DURATIONS = RELAY_FABRIC_CONTRACT.durations;
const MAX_DEADLINE_MS = DURATIONS.max_deadline_seconds * 1000;
const GRANT_REFRESH_MARGIN_MS = DURATIONS.grant_refresh_margin_seconds * 1000;
const RECONNECT_MIN_MS = RELAY_CONTRACT.durations.subscriber_reconnect_min_seconds * 1000;
const RECONNECT_MAX_MS = RELAY_CONTRACT.durations.subscriber_reconnect_max_seconds * 1000;
const STREAM_STABLE_MS = 30_000;
const STREAM_CONNECT_WAIT_MS = 3_000;
const STREAM_IDLE_STOP_MS = 600_000;
const ROTATE_MIN_MS = 5_000;
const REGRANT_MIN_INTERVAL_MS = 5_000;
const FAST_RECHECK_MS = 10_000;
const GRANT_BLOCK_MIN_MS = 30_000;
const GRANT_BLOCK_MAX_MS = 300_000;
const PENDING_GRACE_MS = 1_000;
const ABSOLUTE_EPOCH_FLOOR_MS = 1e12;
const DURABLE_ROUTE_LIMIT = 512;
const ROUTE_ID_SEGMENT = /^(?:\d+|[0-9a-f]{8}-[0-9a-f-]{27}|[0-9a-f]{16,})$/i;
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);
const RESPONSE_TOO_LARGE = 'response_too_large';
const RESPONSE_ERROR_HEADER = 'x-relay-error';
const TELEMETRY_ROUTE_UNKNOWN = 'unknown';
const TELEMETRY_LANE = 'fast';
const FALLBACK_ERROR_NAMES: RelayFabricErrorName[] = [
  'lane_durable_required', 'device_fabric_unavailable', 'fabric_unavailable', 'frame_too_large',
];
const FALLBACK_CODES = new Set<string>([...FALLBACK_ERROR_NAMES, 'device_offline']);
const DIGEST_CONFLICT_CODE = 'fabric_digest_conflict';
const LANE_DURABLE_CODE: RelayFabricErrorName = 'lane_durable_required';
const PAIRING_RECOVERABLE_CODES = new Set([
  'pairing_not_active', 'pairing_not_found', 'pairing_expired', 'pairing_credential_stale',
]);

/** Thrown before anything was published (or after an explicit device refusal): the caller must use the durable lane. */
export class PycoreFabricFallback extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`RELAY_FABRIC_FALLBACK_${reason.toUpperCase()}`);
    this.name = 'PycoreFabricFallback';
    this.reason = reason;
  }
}

export function isPycoreFabricFallback(error: unknown): error is PycoreFabricFallback {
  return !!error && (error as PycoreFabricFallback).name === 'PycoreFabricFallback';
}

export interface FabricPairingPort {
  ensurePair(): Promise<RelayPairing>;
  recoverPairing(pairing: RelayPairing): Promise<RelayPairing>;
}

interface StreamEntry {
  conn: LaravelMercureConnection;
  key: string;
  topics: Set<string>;
  ttlMs: number;
  subscribedAt: number;
}

interface FabricResult {
  status: number;
  headers: Headers;
  bytes: Uint8Array | null;
}

interface CallHandle {
  promise: Promise<FabricResult>;
  arm: (ms: number) => void;
  cancel: () => void;
  answered: () => void;
}

interface PendingCall {
  tSend: number;
  bytesOut: number;
  answered: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  parts: Map<number, string>;
  head: RelayFabricResponseFrame | null;
  completing: boolean;
  recvAt: number;
  finish: (outcome: string, result: FabricResult | null, error: unknown, frame: RelayFabricResponseFrame | null, bytesIn: number) => void;
}

function errorCode(error: unknown): string {
  const failure = error as { code?: unknown; payload?: { error_code?: unknown } } | null;
  if (typeof failure?.payload?.error_code === 'string') return failure.payload.error_code;
  return typeof failure?.code === 'string' ? failure.code : '';
}

function errorStatus(error: unknown): number {
  return Number((error as { status?: unknown } | null)?.status) || 0;
}

/** Route identity for lane learning: method + path with id-like segments folded. */
function routeLaneKey(method: string, path: string): string {
  const folded = path.split('/').map((segment) => (ROUTE_ID_SEGMENT.test(segment) ? ':id' : segment)).join('/');
  return `${method} ${folded}`;
}

function remainingDeadlineMs(answer: RelayFabricFrameAnswer): number {
  const deadline = Number(answer.deadline_ms);
  if (!Number.isFinite(deadline) || deadline <= 0) return MAX_DEADLINE_MS;
  const serverNow = Number(answer.server_time_ms);
  const remaining = deadline > ABSOLUTE_EPOCH_FLOOR_MS
    ? deadline - (Number.isFinite(serverNow) && serverNow > 0 ? serverNow : Date.now())
    : deadline;
  return Math.max(1, Math.min(MAX_DEADLINE_MS, remaining));
}

function topicsOf(grant: RelayFabricGrant): string[] {
  const listed = (grant.topics || []).filter((topic) => typeof topic === 'string' && topic !== '');
  const source = listed.length > 0 ? listed : grant.devices.map((device) => device.response_topic);
  return [...new Set(source.filter((topic) => typeof topic === 'string' && topic !== ''))].sort();
}

function responseHeaders(record: Record<string, string> | null | undefined): Headers {
  const headers = new Headers();
  Object.entries(record || {}).forEach(([name, value]) => {
    try {
      headers.set(name, String(value));
    } catch {
      // Invalid header names or values are dropped, never fatal.
    }
  });
  return headers;
}

class LaravelFabricTransport implements PycoreTransport {
  private pairing: FabricPairingPort | null = null;
  private grant: RelayFabricGrant | null = null;
  private grantExpiresAt = 0;
  private grantFetchedAt = 0;
  private grantFlight: Promise<RelayFabricGrant> | null = null;
  private blockedUntil = 0;
  private blockBackoffMs = GRANT_BLOCK_MIN_MS;
  private durableRoutes = new Set<string>();
  private pending = new Map<string, PendingCall>();
  private active: StreamEntry | null = null;
  private candidate: StreamEntry | null = null;
  private streamWanted = false;
  private lastUseAt = 0;
  private reconnectDelayMs = RECONNECT_MIN_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private streamWaiters = new Set<() => void>();
  private healthHandlers = new Set<PycoreTransportHealthHandler>();
  private lastHealthKey = '';

  bindPairing(port: FabricPairingPort): void {
    this.pairing = port;
  }

  health(): PycoreTransportHealth {
    return {
      connected: this.active !== null,
      fastAvailable: this.active !== null
        && (this.grant?.devices.some((device) => device.fast_available) ?? false),
    };
  }

  subscribe(handler: PycoreTransportHealthHandler): () => void {
    this.healthHandlers.add(handler);
    handler(this.health());
    return () => this.healthHandlers.delete(handler);
  }

  async deliver(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    abortGuard(signal);
    if (!this.pairing) throw new PycoreFabricFallback('unbound');
    const method = String(init.method || 'GET').toUpperCase();
    const parsed = new URL(url);
    const path = relayRoutePath(parsed);
    const laneKey = routeLaneKey(method, path);
    if (this.durableRoutes.has(laneKey)) throw new PycoreFabricFallback('lane_durable_cached');
    const bytes = await bodyBytes(init.body);
    if (bytes !== null && Math.ceil(bytes.byteLength / 3) * 4 > LIMITS.inline_body_bytes) {
      throw new PycoreFabricFallback('frame_too_large');
    }
    const exactBytes = bytes ?? new Uint8Array();
    const digest = await sha256(exactBytes);
    this.streamWanted = true;
    this.lastUseAt = Date.now();
    let pairing = await this.pairing.ensurePair();
    for (let attempt = 0; ; attempt += 1) {
      abortGuard(signal);
      const device = await this.resolveDevice(pairing);
      await this.requireStream(device.response_topic);
      abortGuard(signal);
      const operationId = newUuid();
      const frame: RelayFabricFrameRequest = {
        operation_id: operationId,
        pairing_id: pairing.pairing_id,
        method,
        path,
        query: queryRecord(parsed),
        headers: allowedHeaders(init.headers),
        body: {
          present: bytes !== null,
          length: exactBytes.byteLength,
          sha256: digest,
          base64: exactBytes.byteLength > 0 ? bytesBase64(exactBytes) : null,
        },
      };
      const call = this.openCall(operationId, exactBytes.byteLength, signal);
      let answer: RelayFabricFrameAnswer;
      try {
        answer = await laravelApi.postFabricFrame(frame);
      } catch (error) {
        call.cancel();
        if (attempt === 0 && PAIRING_RECOVERABLE_CODES.has(errorCode(error))) {
          pairing = await this.pairing.recoverPairing(pairing);
          continue;
        }
        throw this.classifyAdmissionError(error, laneKey, device);
      }
      call.answered();
      call.arm(remainingDeadlineMs(answer));
      return this.toResponse(await call.promise);
    }
  }

  private classifyAdmissionError(error: unknown, laneKey: string, device: RelayFabricGrantDevice): unknown {
    const code = errorCode(error);
    const status = errorStatus(error);
    if (code === LANE_DURABLE_CODE) {
      if (this.durableRoutes.size >= DURABLE_ROUTE_LIMIT) this.durableRoutes.clear();
      this.durableRoutes.add(laneKey);
      return new PycoreFabricFallback(code);
    }
    if (PAIRING_RECOVERABLE_CODES.has(code)) return new PycoreFabricFallback(code);
    if (code === DIGEST_CONFLICT_CODE) {
      this.noteGrantFailure();
      return new PycoreFabricFallback(code);
    }
    if (FALLBACK_CODES.has(code) || status === 503) {
      device.fast_available = false;
      return new PycoreFabricFallback(code || 'unavailable');
    }
    if ((status === 404 || status === 405) && !PAIRING_RECOVERABLE_CODES.has(code)) {
      this.noteGrantFailure();
      return new PycoreFabricFallback('fabric_route_missing');
    }
    return error;
  }

  private async resolveDevice(pairing: RelayPairing): Promise<RelayFabricGrantDevice> {
    const find = (grant: RelayFabricGrant): RelayFabricGrantDevice | undefined => grant.devices.find(
      (device) => device.device_id === pairing.device_id && device.pairing_id === pairing.pairing_id,
    );
    let grant = await this.ensureGrant(false);
    let device = find(grant);
    const stale = device !== undefined && !device.fast_available
      && performance.now() - this.grantFetchedAt > FAST_RECHECK_MS;
    if (!device || stale) {
      grant = await this.ensureGrant(true);
      device = find(grant);
    }
    if (!device) throw new PycoreFabricFallback('device_not_granted');
    if (!device.fast_available) throw new PycoreFabricFallback('device_not_fast');
    return device;
  }

  private async ensureGrant(force: boolean): Promise<RelayFabricGrant> {
    const now = performance.now();
    const current = this.grant;
    if (current && !force && now < this.grantExpiresAt - GRANT_REFRESH_MARGIN_MS) return current;
    if (current && force && now - this.grantFetchedAt < REGRANT_MIN_INTERVAL_MS) return current;
    if (this.grantFlight) return this.grantFlight;
    if (now < this.blockedUntil) {
      if (current && now < this.grantExpiresAt) return current;
      throw new PycoreFabricFallback('grant_backoff');
    }
    try {
      return await this.fetchGrant();
    } catch (error) {
      if (current && performance.now() < this.grantExpiresAt) return current;
      throw error;
    }
  }

  private fetchGrant(): Promise<RelayFabricGrant> {
    if (this.grantFlight) return this.grantFlight;
    const flight = laravelApi.getFabricGrant()
      .then((raw) => this.applyGrant(raw))
      .catch((error) => {
        if (isPycoreFabricFallback(error)) throw error;
        this.noteGrantFailure();
        appendLog('warn', 'api', `RELAY_FABRIC_GRANT_FAILED: ${String(error)}`);
        throw new PycoreFabricFallback('grant_unavailable');
      })
      .finally(() => {
        if (this.grantFlight === flight) this.grantFlight = null;
      });
    this.grantFlight = flight;
    return flight;
  }

  private applyGrant(raw: RelayFabricGrant): RelayFabricGrant {
    if (!raw || typeof raw.hub_url !== 'string' || typeof raw.subscriber_token !== 'string'
      || !Array.isArray(raw.devices) || !(Number(raw.expires_in_seconds) > 0)) {
      throw new Error('RELAY_FABRIC_GRANT_INVALID');
    }
    const previousVersion = this.grant?.grant_version;
    this.grant = raw;
    this.grantFetchedAt = performance.now();
    this.grantExpiresAt = this.grantFetchedAt + Number(raw.expires_in_seconds) * 1000;
    this.blockedUntil = 0;
    this.blockBackoffMs = GRANT_BLOCK_MIN_MS;
    if (previousVersion !== undefined && previousVersion !== raw.grant_version) this.durableRoutes.clear();
    if (this.streamWanted) this.reconcileStream(raw);
    this.notifyHealth();
    return raw;
  }

  private noteGrantFailure(): void {
    this.blockedUntil = performance.now() + this.blockBackoffMs;
    this.blockBackoffMs = Math.min(GRANT_BLOCK_MAX_MS, this.blockBackoffMs * 2);
  }

  private reconcileStream(grant: RelayFabricGrant): void {
    const key = topicsOf(grant).join('\n');
    if (this.active?.key === key || this.candidate?.key === key) return;
    this.openCandidate(grant);
  }

  private openCandidate(grant: RelayFabricGrant): void {
    const topics = topicsOf(grant);
    if (topics.length === 0) return;
    this.candidate?.conn.close();
    const entry: StreamEntry = {
      conn: new LaravelMercureConnection(),
      key: topics.join('\n'),
      topics: new Set(topics),
      ttlMs: Number(grant.expires_in_seconds) * 1000,
      subscribedAt: 0,
    };
    this.candidate = entry;
    entry.conn.connect(
      { hub_url: grant.hub_url, topics },
      {
        authorize: async () => ({
          token: grant.subscriber_token,
          token_ttl_seconds: Number(grant.expires_in_seconds),
        }),
        onSubscribed: () => this.promote(entry),
        onEvent: (_event, data) => this.handleFrame(data),
        onClose: (error) => this.streamClosed(entry, error),
      },
    );
  }

  private promote(entry: StreamEntry): void {
    if (this.candidate !== entry && this.active !== entry) {
      entry.conn.close();
      return;
    }
    const previous = this.active;
    entry.subscribedAt = performance.now();
    this.active = entry;
    if (this.candidate === entry) this.candidate = null;
    if (previous && previous !== entry) previous.conn.close();
    this.scheduleRotation(entry.ttlMs);
    this.streamWaiters.forEach((waiter) => waiter());
    this.notifyHealth();
  }

  private streamClosed(entry: StreamEntry, error?: unknown): void {
    if (error) appendLog('error', 'api', `RELAY_FABRIC_STREAM_INTERRUPTED: ${String(error)}`);
    if (this.active === entry) {
      this.active = null;
      if (this.rotateTimer) clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
      if (performance.now() - entry.subscribedAt >= STREAM_STABLE_MS) this.reconnectDelayMs = RECONNECT_MIN_MS;
      this.notifyHealth();
    } else if (this.candidate === entry) {
      this.candidate = null;
    } else {
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (!this.streamWanted || this.reconnectTimer) return;
    const delay = this.reconnectDelayMs + Math.floor(Math.random() * RECONNECT_MIN_MS);
    this.reconnectDelayMs = Math.min(RECONNECT_MAX_MS, this.reconnectDelayMs * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.streamWanted || this.candidate) return;
      this.ensureGrant(false)
        .then((grant) => {
          if (this.streamWanted && !this.candidate) this.openCandidate(grant);
        })
        .catch(() => this.scheduleReconnect());
    }, delay);
  }

  private scheduleRotation(ttlMs: number): void {
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    const delay = Math.max(ROTATE_MIN_MS, ttlMs - GRANT_REFRESH_MARGIN_MS);
    this.rotateTimer = setTimeout(() => {
      this.rotateTimer = null;
      if (Date.now() - this.lastUseAt > STREAM_IDLE_STOP_MS) {
        this.stopStream();
        return;
      }
      this.fetchGrant()
        .then((grant) => {
          if (this.streamWanted && !this.candidate) this.openCandidate(grant);
        })
        .catch(() => this.scheduleReconnect());
    }, delay);
  }

  private stopStream(): void {
    this.streamWanted = false;
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.rotateTimer = null;
    this.reconnectTimer = null;
    this.candidate?.conn.close();
    this.active?.conn.close();
    this.candidate = null;
    this.active = null;
    this.notifyHealth();
  }

  private requireStream(topic: string): Promise<void> {
    const covered = (): boolean => this.active?.topics.has(topic) === true;
    if (covered()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const settle = (ok: boolean): void => {
        clearTimeout(timer);
        this.streamWaiters.delete(check);
        if (ok) resolve();
        else reject(new PycoreFabricFallback('stream_unavailable'));
      };
      const check = (): void => {
        if (covered()) settle(true);
      };
      const timer = setTimeout(() => settle(covered()), STREAM_CONNECT_WAIT_MS);
      this.streamWaiters.add(check);
      if (!this.active && !this.candidate && !this.reconnectTimer && this.grant) this.openCandidate(this.grant);
    });
  }

  private notifyHealth(): void {
    const health = this.health();
    const key = `${health.connected}:${health.fastAvailable}`;
    if (key === this.lastHealthKey) return;
    this.lastHealthKey = key;
    this.healthHandlers.forEach((handler) => {
      try {
        handler(health);
      } catch {
        // Listener errors must never break the shared stream.
      }
    });
  }

  private openCall(operationId: string, bytesOut: number, signal?: AbortSignal): CallHandle {
    const tSend = Date.now();
    let settled = false;
    let resolve: (result: FabricResult) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<FabricResult>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    const onAbort = (): void => call.finish('aborted', null, new DOMException('Aborted', 'AbortError'), null, 0);
    const call: PendingCall = {
      tSend,
      bytesOut,
      answered: false,
      timer: null,
      parts: new Map(),
      head: null,
      completing: false,
      recvAt: 0,
      finish: (outcome, result, error, frame, bytesIn) => {
        if (settled) return;
        settled = true;
        if (call.timer) clearTimeout(call.timer);
        signal?.removeEventListener('abort', onAbort);
        this.pending.delete(operationId);
        if (call.answered) {
          laravelFabricTelemetry.record({
            operation_id: operationId,
            route_policy: TELEMETRY_ROUTE_UNKNOWN,
            lane: TELEMETRY_LANE,
            http_status: result?.status ?? 0,
            outcome,
            t_ui_send: tSend,
            t_ui_recv: call.recvAt || Date.now(),
            dev_recv: Number(frame?.t?.dev_recv) || 0,
            dev_send: Number(frame?.t?.dev_send) || 0,
            exec_ms: Number(frame?.t?.exec_ms) || 0,
            bytes_in: bytesIn,
            bytes_out: bytesOut,
          });
        }
        if (result) resolve(result);
        else reject(error);
      },
    };
    this.pending.set(operationId, call);
    signal?.addEventListener('abort', onAbort, { once: true });
    const arm = (ms: number): void => {
      if (call.timer) clearTimeout(call.timer);
      call.timer = setTimeout(
        () => call.finish('timeout', null, new PycoreRelayError('request-timeout', 'RELAY_OPERATION_TIMEOUT'), call.head, 0),
        ms,
      );
    };
    arm(MAX_DEADLINE_MS + PENDING_GRACE_MS);
    return {
      promise,
      arm,
      answered: () => {
        call.answered = true;
      },
      cancel: () => {
        if (settled) return;
        settled = true;
        if (call.timer) clearTimeout(call.timer);
        signal?.removeEventListener('abort', onAbort);
        this.pending.delete(operationId);
        resolve({ status: 0, headers: new Headers(), bytes: null });
      },
    };
  }

  private handleFrame(data: unknown): void {
    const frame = data as RelayFabricResponseFrame | null;
    if (!frame || typeof frame !== 'object' || typeof frame.op !== 'string') return;
    const call = this.pending.get(frame.op);
    if (!call) return;
    const part = frame.part;
    const partCount = part ? Number(part.n) : 1;
    const partIndex = part ? Number(part.i) : 0;
    if (!Number.isInteger(partCount) || !Number.isInteger(partIndex)
      || partCount < 1 || partCount > LIMITS.max_parts || partIndex < 0 || partIndex >= partCount) {
      call.finish('error', null, new PycoreRelayError('http', 'RELAY_FABRIC_FRAME_INVALID', 502), frame, 0);
      return;
    }
    if (partIndex === 0 || call.head === null) call.head = frame;
    call.parts.set(partIndex, frame.b?.b64 ?? '');
    if (call.parts.size < partCount || call.completing) return;
    call.completing = true;
    call.recvAt = Date.now();
    void this.completeFrames(frame.op, call, partCount);
  }

  private async completeFrames(operationId: string, call: PendingCall, partCount: number): Promise<void> {
    const head = call.head as RelayFabricResponseFrame;
    try {
      if (!this.pending.has(operationId)) return;
      const status = Number(head.s);
      if (!Number.isInteger(status) || status < 200 || status > 599) {
        throw new PycoreRelayError('http', 'RELAY_FABRIC_FRAME_INVALID', 502);
      }
      const headers = responseHeaders(head.h);
      if (status === 502 && headers.get(RESPONSE_ERROR_HEADER) === RESPONSE_TOO_LARGE) {
        call.finish('fallback', null, new PycoreFabricFallback(RESPONSE_TOO_LARGE), head, 0);
        return;
      }
      const expectedLength = Number(head.b?.len) || 0;
      const ref = head.b?.ref || null;
      let encoded = '';
      for (let index = 0; index < partCount; index += 1) encoded += call.parts.get(index) ?? '';
      let bytes = new Uint8Array();
      if (ref) bytes = await laravelApi.getRelayResponseBlob(ref);
      else if (encoded !== '') bytes = base64Bytes(encoded);
      const digestMatches = expectedLength === bytes.byteLength
        && (bytes.byteLength === 0 && !head.b?.sha256 ? true : head.b?.sha256 === await sha256(bytes));
      if (!digestMatches) {
        call.finish('digest_mismatch', null, new PycoreRelayError('http', 'RELAY_RESPONSE_DIGEST_CONFLICT', 409), head, bytes.byteLength);
        return;
      }
      call.finish(
        status >= 400 ? 'http_error' : 'ok',
        { status, headers, bytes: bytes.byteLength > 0 ? bytes : null },
        null,
        head,
        bytes.byteLength,
      );
    } catch (error) {
      call.finish('error', null, error, head, 0);
    }
  }

  private toResponse(result: FabricResult): Response {
    const body = result.bytes === null || NULL_BODY_STATUSES.has(result.status) ? null : new Uint8Array(result.bytes);
    return new Response(body, { status: result.status, headers: result.headers });
  }
}

export const laravelFabricTransport = new LaravelFabricTransport();
