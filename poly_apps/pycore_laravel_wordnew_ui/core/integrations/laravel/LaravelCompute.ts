/**
 * Laravel compute answers: Laravel never calls pycore, it queues a pycore task (202) or answers
 * `pycore_unavailable` (laravel_main PycoreTaskQueue). One classifier maps both to the scheduler's attempt
 * outcomes, and one reader maps the task status route.
 */
import { GLOBAL_TASK_TERMINAL_STATUSES } from '../../contracts/QueueCenterContract';
import { COMPUTE_ERROR_CODES, type ComputeAttempt } from '../compute/ComputeTypes';

export const PYCORE_UNAVAILABLE_CODE = 'pycore_unavailable';
export const LARAVEL_TASK_FAILED_CODE = 'LARAVEL_TASK_FAILED';

const MS_PER_SECOND = 1000;
const PERCENT_SCALE = 100;
const DISPOSITION_QUEUED = 'queued';
const FAILED_STATUSES: ReadonlySet<string> = new Set(['failed', 'cancelled']);

/** `data.pycore_task` of a 202 answer. */
export interface LaravelPycoreTask {
  status: string;
  task_id: string;
  task_type: string;
  client_task_id: string | null;
  required_compute: string | null;
  /** Status route of the task (`/api/task/{id}/status`). */
  poll: string;
  last_error?: string;
}

/** `data` of the `pycore_unavailable` error envelope. */
export interface LaravelPycoreUnavailable {
  task_type: string;
  required_compute: string | null;
  registered_pycores: number;
  eligible_pycores: number;
  last_seen_at: string | null;
  heartbeat_ttl_seconds: number;
  disposition: 'queued' | 'rejected';
  task_id: string | null;
  client_task_id: string | null;
  retry_after_seconds: number;
}

/** What the scheduler keeps to pick a queued task up. */
export interface LaravelTaskRef {
  taskId: string;
  poll: string;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

function taskRef(taskId: string, poll?: string): LaravelTaskRef {
  return { taskId, poll: poll || `/api/task/${encodeURIComponent(taskId)}/status` };
}

/**
 * Classify one Laravel answer body (a success envelope, or the `.body` of a thrown HTTP error).
 * `readResult` maps the domain data of a completed answer; undefined means the answer holds no result.
 */
export function classifyLaravelCompute<R>(body: unknown, readResult: (data: any) => R | undefined): ComputeAttempt<R> {
  const envelope = asRecord(body);
  const data = asRecord(envelope?.data);
  if (envelope?.error_code === PYCORE_UNAVAILABLE_CODE) {
    const info = (data ?? {}) as Partial<LaravelPycoreUnavailable>;
    const retryAfterMs = Number(info.retry_after_seconds) > 0 ? Number(info.retry_after_seconds) * MS_PER_SECOND : undefined;
    if (info.disposition === DISPOSITION_QUEUED && info.task_id) {
      return { status: 'queued', ref: taskRef(info.task_id), info: { ...info }, retryAfterMs };
    }
    return { status: 'unavailable', info: { ...info }, retryAfterMs };
  }
  const task = asRecord(data?.pycore_task) as LaravelPycoreTask | null;
  if (task?.task_id) return { status: 'queued', ref: taskRef(task.task_id, task.poll) };
  if (envelope?.success === false) {
    return {
      status: 'failed',
      failure: {
        code: String(envelope.error_code || COMPUTE_ERROR_CODES.requestFailed),
        params: asRecord(envelope.error_params) ?? asRecord(data?.error_params) ?? undefined,
        retryable: false,
      },
    };
  }
  const result = readResult(data ?? envelope);
  return result === undefined
    ? { status: 'failed', failure: { code: COMPUTE_ERROR_CODES.requestFailed, retryable: true } }
    : { status: 'done', result };
}

/** Read one answer of the task status route (`data.task`): done, still queued, or failed. */
export function classifyLaravelTaskStatus<R>(
  body: unknown,
  readResult: (taskResult: any) => R | undefined,
  progress?: (fraction: number) => void,
): ComputeAttempt<R> {
  const task = asRecord(asRecord(asRecord(body)?.data)?.task);
  const status = String(task?.status ?? '');
  if (!task) return { status: 'queued', ref: undefined };
  const percent = Number(task.progress);
  if (progress && Number.isFinite(percent)) progress(percent > 1 ? percent / PERCENT_SCALE : percent);
  if (FAILED_STATUSES.has(status)) {
    return {
      status: 'failed',
      failure: {
        code: LARAVEL_TASK_FAILED_CODE,
        params: { error: String(task.error ?? '') },
        retryable: status !== 'cancelled',
      },
    };
  }
  if (!GLOBAL_TASK_TERMINAL_STATUSES.includes(status as never)) return { status: 'queued', ref: undefined };
  const result = readResult(task.result);
  return result === undefined
    ? { status: 'failed', failure: { code: COMPUTE_ERROR_CODES.requestFailed, retryable: true } }
    : { status: 'done', result };
}
