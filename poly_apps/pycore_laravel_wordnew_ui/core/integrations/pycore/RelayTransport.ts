import {
  RELAY_CONTRACT, relayEventType,
  type RelayFrameAnswer, type RelayFrameRequest, type RelayPairing, type RelayResponseFrame,
} from '../../contracts/RelayContract';
import { laravelRelayApi as laravelApi } from '../laravel/LaravelRelayAPI';
import { laravelRelayStream, RelayGrantUnavailableError } from '../laravel/LaravelRelayStream';
import { laravelRelayTelemetry } from '../laravel/LaravelRelayTelemetry';
import { PycoreRelayError } from './PycoreRelayError';
import type { OperationProgressInit, UploadRequestInit } from '../../network/ProgressUpload';
import { createIdleWatchdog, type IdleWatchdog } from '../../network/IdleWatchdog';
import {
  assertRelayAuthGeneration, ensureRelayPairing, recoverablePairingError, recoverRelayPairing, relayAuthGeneration,
} from './RelayPairing';
import {
  abortGuard, allowedHeaders, base64Bytes, bodyBytes, bytesBase64, newUuid,
  queryRecord, relayRoutePath, sha256,
} from './PycoreRelayWire';

const LIMITS = RELAY_CONTRACT.limits;
const DURATIONS = RELAY_CONTRACT.durations;
const MAX_DEADLINE_MS = DURATIONS.max_deadline_seconds * 1000;
const ACK_TIMEOUT_MS = DURATIONS.ack_timeout_seconds * 1000;
const STALL_WINDOW_MS = DURATIONS.stall_window_seconds * 1000;
const PENDING_GRACE_MS = 1_000;
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);
const RESPONSE_FRAME_EVENT = relayEventType('response_frame');
const KIND_ACK = 'ack';
const KIND_PROGRESS = 'progress';
const TELEMETRY_ROUTE_UNKNOWN = 'unknown';
const DEVICE_OFFLINE_CODE = 'device_offline';
const DEVICE_OVERLOADED_CODE = 'device_overloaded';
const ROUTE_DENIED_CODE = 'route_denied';

interface RelayResult {
  status: number;
  headers: Headers;
  bytes: Uint8Array | null;
}

interface CallHandle {
  promise: Promise<RelayResult>;
  admitted: (answer: RelayFrameAnswer) => void;
  cancel: () => void;
}

interface PendingCall {
  tSend: number;
  bytesOut: number;
  answered: boolean;
  acked: boolean;
  stallMs: number;
  watchdog: IdleWatchdog;
  parts: Map<number, string>;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
  head: RelayResponseFrame | null;
  completing: boolean;
  recvAt: number;
  arm: (ms: number) => void;
  finish: (outcome: string, result: RelayResult | null, error: unknown, frame: RelayResponseFrame | null, bytesIn: number) => void;
}

function errorCode(error: unknown): string {
  const failure = error as { code?: unknown; payload?: { error_code?: unknown } } | null;
  if (typeof failure?.payload?.error_code === 'string') return failure.payload.error_code;
  return typeof failure?.code === 'string' ? failure.code : '';
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

async function uploadRequestBlob(
  pairingId: string,
  bytes: Uint8Array,
  digest: string,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (bytes.byteLength > LIMITS.request_body_bytes) {
    throw new PycoreRelayError('too-large', 'RELAY_REQUEST_BODY_TOO_LARGE', 413);
  }
  const blobId = newUuid();
  abortGuard(signal);
  await laravelApi.allocateRelayRequestBlob(blobId, pairingId, digest, bytes.byteLength);
  const chunkSize = LIMITS.blob_chunk_bytes;
  for (let offset = 0, index = 0; offset < bytes.byteLength; offset += chunkSize, index += 1) {
    abortGuard(signal);
    await laravelApi.putRelayRequestBlobChunk(blobId, index, bytes.subarray(offset, offset + chunkSize));
    onProgress?.(Math.min(1, (offset + chunkSize) / bytes.byteLength));
  }
  abortGuard(signal);
  await laravelApi.finalizeRelayRequestBlob(blobId, digest, bytes.byteLength);
  return blobId;
}

class RelayTransport {
  private pending = new Map<string, PendingCall>();

  async deliver(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    abortGuard(signal);
    const method = String(init.method || 'GET').toUpperCase();
    const parsed = new URL(url);
    const path = relayRoutePath(parsed);
    const bytes = await bodyBytes(init.body);
    const exactBytes = bytes ?? new Uint8Array();
    const digest = await sha256(exactBytes);
    const inline = Math.ceil(exactBytes.byteLength / 3) * 4 <= LIMITS.inline_body_bytes;
    laravelRelayStream.touch();
    const generation = relayAuthGeneration();
    let pairing = await ensureRelayPairing();
    for (let attempt = 0; ; attempt += 1) {
      assertRelayAuthGeneration(generation);
      abortGuard(signal);
      await this.requireDeviceTopic(pairing);
      abortGuard(signal);
      const ref = bytes !== null && !inline
        ? await uploadRequestBlob(pairing.pairing_id, exactBytes, digest, signal, (init as UploadRequestInit).onUploadProgress)
        : null;
      const operationId = newUuid();
      const frame: RelayFrameRequest = {
        operation_id: operationId,
        pairing_id: pairing.pairing_id,
        method,
        path,
        query: queryRecord(parsed),
        headers: allowedHeaders(init.headers, init.body),
        body: {
          present: bytes !== null,
          length: exactBytes.byteLength,
          sha256: digest,
          base64: bytes !== null && inline && exactBytes.byteLength > 0 ? bytesBase64(exactBytes) : null,
          ref,
        },
      };
      const call = this.openCall(operationId, exactBytes.byteLength, signal, (init as OperationProgressInit).onProgress);
      let answer: RelayFrameAnswer;
      try {
        answer = await laravelApi.postRelayFrame(frame);
      } catch (error) {
        call.cancel();
        if (attempt === 0 && recoverablePairingError(error)) {
          pairing = await recoverRelayPairing(pairing);
          continue;
        }
        throw this.classifyAdmissionError(error, pairing);
      }
      call.admitted(answer);
      const result = await call.promise;
      assertRelayAuthGeneration(generation);
      return this.toResponse(result);
    }
  }

  private async requireDeviceTopic(pairing: RelayPairing): Promise<void> {
    try {
      const device = await laravelRelayStream.resolveDevice(pairing);
      if (!device.online) throw new PycoreRelayError('device-offline', 'RELAY_DEVICE_OFFLINE', 503);
      await laravelRelayStream.requireTopic(device.response_topic);
    } catch (error) {
      if (error instanceof RelayGrantUnavailableError) {
        throw new PycoreRelayError('http', `RELAY_${error.reason.toUpperCase()}`,
          error.reason === 'authentication_required' ? 401 : 503);
      }
      throw error;
    }
  }

  private classifyAdmissionError(error: unknown, pairing: RelayPairing): unknown {
    const code = errorCode(error);
    if (code === DEVICE_OFFLINE_CODE) {
      laravelRelayStream.markDeviceOffline(pairing.device_id);
      return new PycoreRelayError('device-offline', 'RELAY_DEVICE_OFFLINE', 503);
    }
    if (code === DEVICE_OVERLOADED_CODE) return new PycoreRelayError('device-overloaded', 'RELAY_DEVICE_OVERLOADED', 503);
    if (code === ROUTE_DENIED_CODE) return new PycoreRelayError('http', 'RELAY_ROUTE_DENIED', 403);
    if (code === 'relay_rate_limited') return new PycoreRelayError('rate-limited', 'RELAY_RATE_LIMITED', 429);
    if (code === 'frame_too_large') return new PycoreRelayError('too-large', 'RELAY_REQUEST_FRAME_TOO_LARGE', 413);
    if (code === 'contract_digest_conflict') laravelRelayStream.noteGrantFailure();
    return error;
  }

  private openCall(operationId: string, bytesOut: number, signal?: AbortSignal, onProgress?: (fraction: number) => void): CallHandle {
    const tSend = Date.now();
    let settled = false;
    let resolve: (result: RelayResult) => void = () => undefined;
    let reject: (error: unknown) => void = () => undefined;
    const promise = new Promise<RelayResult>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    const onAbort = (): void => call.finish('aborted', null, new DOMException('Aborted', 'AbortError'), null, 0);
    const call: PendingCall = {
      tSend,
      bytesOut,
      answered: false,
      acked: false,
      stallMs: STALL_WINDOW_MS,
      watchdog: createIdleWatchdog(
        MAX_DEADLINE_MS + PENDING_GRACE_MS,
        () => call.finish('timeout', null, new PycoreRelayError('request-timeout', 'RELAY_OPERATION_TIMEOUT'), call.head, 0),
      ),
      parts: new Map(),
      signal,
      onProgress,
      head: null,
      completing: false,
      recvAt: 0,
      arm: (ms) => call.watchdog.arm(ms),
      finish: (outcome, result, error, frame, bytesIn) => {
        if (settled) return;
        settled = true;
        call.watchdog.clear();
        signal?.removeEventListener('abort', onAbort);
        this.pending.delete(operationId);
        if (call.answered) {
          laravelRelayTelemetry.record({
            operation_id: operationId,
            route_policy: TELEMETRY_ROUTE_UNKNOWN,
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
    call.arm(MAX_DEADLINE_MS + PENDING_GRACE_MS);
    return {
      promise,
      admitted: (answer) => {
        call.answered = true;
        call.stallMs = answer.ack_required && !call.acked ? ACK_TIMEOUT_MS : STALL_WINDOW_MS;
        call.arm(call.stallMs);
      },
      cancel: () => {
        if (settled) return;
        settled = true;
        call.watchdog.clear();
        signal?.removeEventListener('abort', onAbort);
        this.pending.delete(operationId);
        resolve({ status: 0, headers: new Headers(), bytes: null });
      },
    };
  }

  handleEvent(event: string, data: unknown): void {
    if (event !== RESPONSE_FRAME_EVENT) return;
    const frame = data as RelayResponseFrame | null;
    if (!frame || typeof frame !== 'object' || typeof frame.op !== 'string') return;
    const call = this.pending.get(frame.op);
    if (!call) return;
    call.stallMs = STALL_WINDOW_MS;
    if (call.answered) call.arm(call.stallMs);
    if (frame.k === KIND_ACK) {
      call.acked = true;
      return;
    }
    if (frame.k === KIND_PROGRESS) {
      // A heartbeat-only frame (no done/total) only re-armed the stall timer above.
      const done = Number(frame.p?.done);
      const total = Number(frame.p?.total);
      if (call.onProgress && Number.isFinite(done) && Number.isFinite(total) && total > 0) call.onProgress(Math.min(1, Math.max(0, done / total)));
      return;
    }
    const part = frame.part;
    const partCount = part ? Number(part.n) : 1;
    const partIndex = part ? Number(part.i) : 0;
    if (!Number.isInteger(partCount) || !Number.isInteger(partIndex)
      || partCount < 1 || partCount > LIMITS.max_parts || partIndex < 0 || partIndex >= partCount) {
      call.finish('error', null, new PycoreRelayError('http', 'RELAY_FRAME_INVALID', 502), frame, 0);
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
    const head = call.head as RelayResponseFrame;
    try {
      if (!this.pending.has(operationId)) return;
      const status = Number(head.s);
      if (!Number.isInteger(status) || status < 200 || status > 599) {
        throw new PycoreRelayError('http', 'RELAY_FRAME_INVALID', 502);
      }
      const headers = responseHeaders(head.h);
      const expectedLength = Number(head.b?.len) || 0;
      const ref = head.b?.ref || null;
      let encoded = '';
      for (let index = 0; index < partCount; index += 1) encoded += call.parts.get(index) ?? '';
      let bytes = new Uint8Array();
      if (ref) bytes = await laravelApi.getRelayResponseBlob(ref, call.signal);
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

  private toResponse(result: RelayResult): Response {
    const body = result.bytes === null || NULL_BODY_STATUSES.has(result.status) ? null : new Uint8Array(result.bytes);
    return new Response(body, { status: result.status, headers: result.headers });
  }
}

export const relayTransport = new RelayTransport();
laravelRelayStream.onEvent((event, data) => relayTransport.handleEvent(event, data));
