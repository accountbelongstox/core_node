/** Compute job model shared by the scheduler, its journal and the UI. */

export type ComputePath = 'pycore' | 'laravel';

/**
 * pending: waiting for a path (or for its backoff) · submitted-pycore: running on pycore ·
 * submitted-laravel: queued at Laravel, waiting for its result · done / failed: terminal.
 */
export type ComputeJobState = 'pending' | 'submitted-pycore' | 'submitted-laravel' | 'done' | 'failed';

export const COMPUTE_TERMINAL_STATES: ReadonlySet<ComputeJobState> = new Set(['done', 'failed']);

export interface ComputeJob<P = unknown> {
  /** The client_task_id: the idempotency key sent on every submission of this job. */
  id: string;
  kind: string;
  payload: P;
  state: ComputeJobState;
  /** Submissions made (any path). */
  attempts: number;
  /** Failed attempts counted against `maxAttempts` (a lost connection is not one). */
  failures: number;
  createdAt: number;
  updatedAt: number;
  nextAttemptAt: number;
  /** Path of the primary submission. */
  path?: ComputePath;
  /** Second concurrent submission started by a failover; the first result wins. */
  shadow?: ComputePath;
  submittedAt?: number;
  lastPollAt?: number;
  /** 0..1 */
  progress: number;
  /** Pickup reference of the task queued at Laravel. */
  laravelRef?: unknown;
  resultRef?: string;
  resultVia?: ComputePath;
  errorCode?: string;
  errorParams?: Record<string, unknown>;
  /** Last answer of an unavailable path (compute class, registered count, last seen, retry hint). */
  unavailable?: Record<string, unknown>;
}

export interface ComputeFailure {
  code: string;
  params?: Record<string, unknown>;
  /** A retry (backoff) may succeed; otherwise the job fails at once. */
  retryable: boolean;
}

export type ComputeAttempt<R> =
  | { status: 'done'; result: R }
  /** Accepted and queued remotely; the result is picked up later. */
  | { status: 'queued'; ref: unknown; retryAfterMs?: number; info?: Record<string, unknown> }
  /** No suitable executor right now (Laravel `pycore_unavailable`): retry later. */
  | { status: 'unavailable'; info?: Record<string, unknown>; retryAfterMs?: number }
  | { status: 'failed'; failure: ComputeFailure };

export interface ComputeRunContext {
  signal: AbortSignal;
  progress: (fraction: number) => void;
}

/** One kind of compute work (TTS, OCR, ...): how each path runs it. Runners throw on a lost connection. */
export interface ComputeKind<P = unknown, R = unknown> {
  kind: string;
  /** Direct call; must send `job.id` as client_task_id. */
  pycore?: (job: ComputeJob<P>, context: ComputeRunContext) => Promise<ComputeAttempt<R>>;
  /** Submit to Laravel; must send `job.id` as the idempotency key and client_task_id. */
  laravel?: (job: ComputeJob<P>, context: ComputeRunContext) => Promise<ComputeAttempt<R>>;
  /** Result pickup of a task queued at Laravel: `queued` means still pending. */
  pollLaravel?: (job: ComputeJob<P>, context: ComputeRunContext) => Promise<ComputeAttempt<R>>;
  /** Persist a (large) result outside the journal and return its reference. */
  persistResult?: (job: ComputeJob<P>, result: R) => Promise<string | undefined>;
  loadResult?: (ref: string) => Promise<R | undefined>;
  maxAttempts?: number;
  /**
   * False for work Laravel does without pycore (`pycore_required: false` in /api_info): it goes to
   * Laravel directly, whatever the pycore availability. Default true.
   */
  pycoreRequired?: boolean | (() => boolean);
}

export const COMPUTE_DEFAULTS = {
  parallel: { pycore: 2, laravel: 4 },
  backoffMinMs: 1_000,
  backoffMaxMs: 30_000,
  maxAttempts: 6,
  /** A queued Laravel job still unfinished this long is also submitted directly when pycore is up. */
  failoverAfterMs: 15_000,
  pollMs: 4_000,
  /** Availability hysteresis: a path flips up after this stable time, down after the (longer) one. */
  upAfterMs: 500,
  downAfterMs: 3_000,
  /** Finished jobs stay in the journal this long. */
  retentionMs: 24 * 60 * 60 * 1000,
} as const;

export const COMPUTE_ERROR_CODES = {
  cancelled: 'COMPUTE_CANCELLED',
  noPath: 'COMPUTE_NO_PATH',
  requestFailed: 'COMPUTE_REQUEST_FAILED',
  unknownKind: 'COMPUTE_UNKNOWN_KIND',
  maxAttempts: 'COMPUTE_MAX_ATTEMPTS',
} as const;
