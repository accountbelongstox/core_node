/**
 * Submit Outbox — a persistent, background-only retry queue for WRITE requests.
 *
 * When the backend is interrupted, a write (worker result / validity report /
 * assist cover-or-poster submit) is cached to chrome.storage.local and retried
 * with exponential backoff FOREVER until it succeeds — EXCEPT terminal errors,
 * which are dropped because they can never succeed.
 *
 * Idempotency contract (BACKEND_WORKER_API.md + TaskManagerService.php):
 *   - worker_result re-delivery is keyed by task attempt. Laravel acknowledges
 *     stale attempts without mutating the current lease; a remaining 409 means
 *     this exact attempt belongs to another worker and is terminal.
 *   - assist submit is fill-missing/idempotent (already_done=true on repeat) and
 *     validity report is md5-keyed upsert -> both safe to retry forever.
 *
 * Persistence mirrors utils/deepseek-task-queue.ts TaskQueueManager: an in-memory
 * Map hydrated in initialize(), object-serialized saveAll(), a singleton, and an
 * ensureInitialized() guard. Drain survives MV3 SW suspension via chrome.alarms.
 */

import { WorkerApiClient, type TaskResult } from '../../api/WorkerApiClient';
import { ApiError } from '../../api/BaseApiClient';
import { ValidityApiClient } from '../word-validity/word-validity-runner-service';
import {
  submitAssistCover,
  submitAssistPoster,
  type AssistSubmitResult,
} from '@/services/assist-image-api';
import { logger } from '@/utils/logger';
import { STORAGE_KEYS } from '@/utils/storage-keys';

const LOG = 'Submit Outbox';
const STORAGE_KEY = STORAGE_KEYS.SUBMIT_OUTBOX;
const ALARM_NAME = 'submit_outbox_drain';

// Backoff: min(BASE * 2^attempts, MAX) + small jitter. No max-attempts cap.
const BACKOFF_BASE_MS = 5000;
const BACKOFF_MAX_MS = 300000; // 5 minutes
const BACKOFF_JITTER_MS = 1000;

// Self-scheduling loop cadence bounds.
const MIN_LOOP_MS = 2000;
const IDLE_LOOP_MS = 60000;

// ─────────────────────────── Record shapes ───────────────────────────
// Payloads REUSE the existing request types (never redeclared): TaskResult from
// WorkerApiClient, the validity report body from ValidityApiClient.report, and
// the assist submit extras from assist-image-api's submit functions.

export type OutboxKind = 'worker_result' | 'validity_report' | 'assist_submit';

type ValidityReportBody = Parameters<ValidityApiClient['report']>[0];
type CoverExtras = Parameters<typeof submitAssistCover>[4];
type PosterExtras = Parameters<typeof submitAssistPoster>[5];

/** assist_submit payload: everything needed to replay the idempotent submit. */
export interface AssistSubmitPayload {
  type: 'cover' | 'poster';
  media_type?: 'book' | 'subtitle';
  id: number;
  imageBase64: string;
  claimer: string;
  extras?: CoverExtras | PosterExtras;
}

interface OutboxBase {
  id: string;
  baseUrl: string;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export type OutboxRecord =
  | (OutboxBase & { kind: 'worker_result'; taskType: string; payload: TaskResult })
  | (OutboxBase & { kind: 'validity_report'; payload: ValidityReportBody })
  | (OutboxBase & { kind: 'assist_submit'; payload: AssistSubmitPayload });

export type OutboxEnqueueInput =
  | { kind: 'worker_result'; baseUrl: string; taskType: string; payload: TaskResult }
  | { kind: 'validity_report'; baseUrl: string; payload: ValidityReportBody }
  | { kind: 'assist_submit'; baseUrl: string; payload: AssistSubmitPayload };

// ─────────────────────────── Terminal-error rule ───────────────────────────

/**
 * TERMINAL worker_result error: this exact task attempt is not owned by the
 * reporting worker. Stale older attempts are acknowledged by Laravel, so a 409
 * remains terminal. Exported so SimpleWorkerBase uses the same rule.
 */
export function isTerminalWorkerResultError(error: unknown): boolean {
  const e = error as any;
  if (e instanceof ApiError && e.statusCode === 409) return true;
  return isTerminalMessage(typeof e?.message === 'string' ? e.message : null);
}

function isTerminalMessage(msg?: string | null): boolean {
  return typeof msg === 'string' && /not assigned|reassigned/i.test(msg);
}

function describeError(error: unknown): string {
  const e = error as any;
  return e?.message ? String(e.message) : String(e ?? 'unknown error');
}

/** Stable, order-independent signature of a validity report's md5 set. */
function md5Signature(results: Array<{ md5?: string; word?: string }>): string {
  const keys = (results || [])
    .map((r) => r.md5 || r.word || '')
    .filter(Boolean)
    .sort();
  let h = 5381;
  const joined = keys.join('|');
  for (let i = 0; i < joined.length; i++) {
    h = ((h << 5) + h) ^ joined.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Dedup id = Map key. One record per logical write. */
function computeId(input: OutboxEnqueueInput): string {
  switch (input.kind) {
    case 'worker_result':
      return `worker_result:${input.payload.task_id}:${input.payload.attempt ?? 'legacy'}:${input.payload.status}`;
    case 'validity_report':
      return `validity_report:${input.payload.language}:${md5Signature(input.payload.results as any)}`;
    case 'assist_submit': {
      const p = input.payload;
      return p.type === 'poster'
        ? `assist_submit:poster:${p.media_type || 'book'}:${p.id}`
        : `assist_submit:cover:${p.id}`;
    }
  }
}

function backoffFor(attempts: number): number {
  const exp = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempts), BACKOFF_MAX_MS);
  return exp + Math.floor(Math.random() * BACKOFF_JITTER_MS);
}

// ─────────────────────────── Outbox ───────────────────────────

class SubmitOutbox {
  private records: Map<string, OutboxRecord> = new Map();
  private initialized = false;
  private started = false;
  private draining = false;
  private loopTimer: ReturnType<typeof setTimeout> | null = null;

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const stored = result?.[STORAGE_KEY] as Record<string, OutboxRecord> | undefined;
      if (stored) {
        for (const [id, record] of Object.entries(stored)) {
          this.records.set(id, record);
        }
      }
    } catch {
      /* storage optional — start empty */
    }
    this.initialized = true;
    logger.info(LOG, `Initialized with ${this.records.size} pending record(s)`);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }

  private async saveAll(): Promise<void> {
    const obj: Record<string, OutboxRecord> = {};
    this.records.forEach((record, id) => {
      obj[id] = record;
    });
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: obj });
    } catch {
      /* best-effort */
    }
  }

  /** Upsert a write into the queue and kick a drain. */
  async enqueue(input: OutboxEnqueueInput): Promise<void> {
    await this.ensureInitialized();
    const id = computeId(input);
    const now = Date.now();
    const existing = this.records.get(id);
    if (existing) {
      existing.baseUrl = input.baseUrl;
      (existing as any).payload = input.payload;
      existing.updatedAt = now;
      // Retry promptly again (a fresh failure means the write is still needed).
      existing.nextAttemptAt = Math.min(existing.nextAttemptAt, now);
    } else {
      this.records.set(id, {
        id,
        kind: input.kind,
        baseUrl: input.baseUrl,
        payload: input.payload,
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        nextAttemptAt: now,
        lastError: null,
      } as OutboxRecord);
    }
    await this.saveAll();
    logger.info(LOG, `Enqueued ${input.kind} (${id}); ${this.records.size} pending`);
    this.drainNow();
  }

  /** Delete a record (delivered or dropped). */
  async remove(id: string): Promise<void> {
    if (this.records.delete(id)) await this.saveAll();
  }

  private async scheduleRetry(record: OutboxRecord, error: string): Promise<void> {
    record.attempts += 1;
    record.lastError = error;
    record.updatedAt = Date.now();
    record.nextAttemptAt = Date.now() + backoffFor(record.attempts);
    await this.saveAll();
    logger.warn(LOG, `Retry ${record.kind} (${record.id}) attempt=${record.attempts}: ${error}`);
  }

  private async dropTerminal(record: OutboxRecord, reason: string): Promise<void> {
    await this.remove(record.id);
    logger.warn(LOG, `Dropped ${record.kind} (${record.id}) — terminal, cannot succeed: ${reason}`);
  }

  /** Process every record whose nextAttemptAt has arrived. */
  async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      await this.ensureInitialized();
      const now = Date.now();
      const due = Array.from(this.records.values()).filter((r) => r.nextAttemptAt <= now);
      for (const record of due) {
        if (!this.records.has(record.id)) continue; // removed by a concurrent path
        await this.dispatch(record);
      }
    } finally {
      this.draining = false;
    }
  }

  /** Fire-and-forget drain (opportunistic trigger from the hot path). */
  drainNow(): void {
    void this.drain();
  }

  private async dispatch(record: OutboxRecord): Promise<void> {
    switch (record.kind) {
      case 'worker_result':
        return this.dispatchWorkerResult(record);
      case 'validity_report':
        return this.dispatchValidityReport(record);
      case 'assist_submit':
        return this.dispatchAssistSubmit(record);
    }
  }

  private async dispatchWorkerResult(
    record: OutboxRecord & { kind: 'worker_result' },
  ): Promise<void> {
    const client = new WorkerApiClient(record.baseUrl);
    // Records persisted before the typed result route carry no taskType; they
    // can never be delivered to /api/worker/tasks/{taskType}/result -> drop.
    if (!record.taskType) {
      return this.dropTerminal(record, 'missing taskType (pre-typed-route record)');
    }
    try {
      const resp = await client.submitResult(record.taskType, record.payload);
      if (resp?.success) return this.remove(record.id);
      if (isTerminalMessage(resp?.message)) return this.dropTerminal(record, resp?.message || 'reassigned');
      return this.scheduleRetry(record, resp?.message || 'submit rejected');
    } catch (error) {
      if (isTerminalWorkerResultError(error)) {
        return this.dropTerminal(record, describeError(error));
      }
      return this.scheduleRetry(record, describeError(error));
    }
  }

  private async dispatchValidityReport(
    record: OutboxRecord & { kind: 'validity_report' },
  ): Promise<void> {
    const client = new ValidityApiClient(record.baseUrl);
    try {
      const resp = await client.report(record.payload);
      if (resp?.success) return this.remove(record.id);
      // md5-keyed upsert — safe to retry forever.
      return this.scheduleRetry(record, resp?.message || 'validity report rejected');
    } catch (error) {
      return this.scheduleRetry(record, describeError(error));
    }
  }

  private async dispatchAssistSubmit(
    record: OutboxRecord & { kind: 'assist_submit' },
  ): Promise<void> {
    const p = record.payload;
    try {
      let result: AssistSubmitResult;
      if (p.type === 'poster') {
        result = await submitAssistPoster(
          record.baseUrl,
          p.media_type || 'book',
          p.id,
          p.imageBase64,
          p.claimer,
          p.extras as PosterExtras,
        );
      } else {
        result = await submitAssistCover(
          record.baseUrl,
          p.id,
          p.imageBase64,
          p.claimer,
          p.extras as CoverExtras,
        );
      }
      // Fill-missing/idempotent — already_done counts as success.
      if (result?.ok || result?.already_done) return this.remove(record.id);
      // A server-side VALIDATION rejection (bad magic bytes, bad base64) can
      // never succeed on retry — the payload bytes are fixed. Dropping it
      // prevents the infinite assist_submit retry loop (attempt=600+).
      if (result?.status === 'invalid' || result?.status === 'not_found') {
        return this.dropTerminal(record, result?.error || `assist submit ${result.status}`);
      }
      return this.scheduleRetry(record, result?.error || 'assist submit rejected');
    } catch (error) {
      return this.scheduleRetry(record, describeError(error));
    }
  }

  /** Begin the self-scheduling drain loop + the MV3-survival alarm. */
  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
    } catch {
      /* alarms may be unavailable */
    }
    void this.initialize().finally(() => this.scheduleNext());
  }

  private scheduleNext(): void {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = setTimeout(() => {
      void this.drain().finally(() => this.scheduleNext());
    }, this.computeLoopDelay());
  }

  private computeLoopDelay(): number {
    if (this.records.size === 0) return IDLE_LOOP_MS;
    let earliest = Infinity;
    for (const r of this.records.values()) earliest = Math.min(earliest, r.nextAttemptAt);
    return Math.max(MIN_LOOP_MS, Math.min(IDLE_LOOP_MS, earliest - Date.now()));
  }

  getStatus(): { pending: number; oldestAt: number | null } {
    let oldest: number | null = null;
    for (const r of this.records.values()) {
      if (oldest === null || r.createdAt < oldest) oldest = r.createdAt;
    }
    return { pending: this.records.size, oldestAt: oldest };
  }
}

// Singleton — the whole background shares one outbox.
export const submitOutbox = new SubmitOutbox();

// Alarm-driven drain so a suspended MV3 service worker still retries: the alarm
// wakes the SW ~every minute and we drain whatever is due. Registered at module
// load (after the singleton exists) so it survives SW respawn.
try {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name === ALARM_NAME) submitOutbox.drainNow();
  });
} catch {
  /* alarms may be unavailable in some contexts */
}
