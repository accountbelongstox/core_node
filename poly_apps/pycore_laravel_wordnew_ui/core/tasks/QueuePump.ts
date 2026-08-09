/**
 * SentenceAudioQueuePump — retained compatibility API (Queue Center v3).
 *
 * The active Queue Center architecture is documented in
 * `_prompts/队列中心.txt`: the UI owns switches and endpoint editing while
 * Pycore performs persistent typed pull/accept/result work. This client remains
 * available for compatibility and diagnostics but is not started by the UI.
 *
 * Cycle (spec: FIX_20260802_UI_EXCHANGE_HUB_ARCHITECTURE.md):
 *   1. Restore the diff ID page table from the local store (no cold full pull)
 *      and align it via LaravelApi on the server cursor/revision model
 *      (high-water global_tasks.id cursor + realtime revision + head_ids).
 *   2. Materialize the current page's data segment (<= data_segment_limit).
 *   3. Accept each task (per-task claim guard; 409 = foreign owner, skipped).
 *   4. Dispatch each claimed payload to pycore via PycoreApi and await the RPC.
 *   5. Mark consumed IDs; the stored segment stays ID + count metadata only.
 */
import { LARAVEL_REALTIME_EVENTS, laravelApi, laravelRealtime } from '../api-libs/laravel';
import { getClientId, onHttpStatus, pycoreApi } from '../api-libs/pycore';
import { GLOBAL_TASK_LIVE_STATUSES, QUEUE_CENTER_DIFF_DELIVERY } from '../contracts/QueueCenterContract';
import type { GlobalTaskWorkerRegistration } from '../contracts/QueueCenterContract';
import { diffQueueContext } from './DiffQueueContext';
import type { DiffScope } from './DiffQueueContext';

const QUEUE_KEY = 'sentence_audio';
const SCOPE_PREFIX = 'pump:sentence-audio';
const IDLE_WAIT_MS = 5000;
const ERROR_BACKOFF_MS = 15000;
const MAX_PUMP_BATCH_LIMIT = Math.max(1, Math.min(
  QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit,
  QUEUE_CENTER_DIFF_DELIVERY.consumer_batch_limits[QUEUE_KEY]
    ?? QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit,
));

export interface QueuePumpOptions {
  laravelEndpoint?: string | null;
  worker?: GlobalTaskWorkerRegistration | null;
  concurrency?: number | null;
  /** Invoked exactly once per pycore (re)connect while the pump runs. */
  syncConfig?: () => Promise<unknown> | unknown;
}

/** Persisted recovery state is isolated by Pycore client and Laravel host. */
function recoveryScope(): string {
  const pycoreId = getClientId();
  const laravelEndpoint = laravelApi.currentEndpointUrl().replace(/\/+$/, '');
  return `${SCOPE_PREFIX}:${pycoreId}:${laravelEndpoint}`;
}

/**
 * Server ID pages arrive as positional chunks of {task_id, status, priority}
 * entries covering EVERY task above the cursor — keep only live IDs.
 */
function normalizeServerPages(raw: unknown): Array<{ ids: string[] }> {
  if (!Array.isArray(raw)) return [];
  const pages: Array<{ ids: string[] }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const entries = (entry as Record<string, unknown>).ids;
    if (!Array.isArray(entries)) continue;
    const ids = entries
      .filter((item) => item && typeof item === 'object'
        && GLOBAL_TASK_LIVE_STATUSES.includes(String((item as Record<string, unknown>).status)))
      .map((item) => String((item as Record<string, unknown>).task_id ?? '').trim())
      .filter(Boolean);
    if (ids.length > 0) pages.push({ ids });
  }
  return pages;
}

/** Head priority IDs first, then the head-most page's unconsumed IDs. */
function nextDispatchIds(scope: DiffScope | null, batchLimit: number): string[] {
  if (!scope) return [];
  if (scope.headIds.length > 0) {
    return scope.headIds.slice(0, batchLimit);
  }
  for (const page of scope.pages) {
    if (page.state === 'consumed') continue;
    const consumed = new Set(page.consumedIds ?? []);
    const pending = page.ids.filter((id) => !consumed.has(id));
    if (pending.length > 0) {
      return pending.slice(0, batchLimit);
    }
  }
  return [];
}

class SentenceAudioQueuePump {
  private running = false;
  private options: QueuePumpOptions = {};
  private unsubscribeStatus: (() => void) | null = null;
  private unsubscribeRealtime: (() => void) | null = null;
  private configSyncedForConnect = false;
  private registeredWorkerKey: string | null = null;
  private wakeResolver: (() => void) | null = null;

  isRunning(): boolean {
    return this.running;
  }

  /** Idempotent: re-arms options when already running. */
  start(options: QueuePumpOptions = {}): void {
    this.options = { ...this.options, ...options };
    if (this.running) {
      this.wake();
      return;
    }
    this.running = true;
    this.configSyncedForConnect = false;
    this.unsubscribeStatus = onHttpStatus((connected) => {
      if (!connected) {
        this.configSyncedForConnect = false;
        return;
      }
      // On PycoreApi connect the UI syncs configuration exactly once.
      if (this.configSyncedForConnect) return;
      this.configSyncedForConnect = true;
      void Promise.resolve(this.options.syncConfig?.()).catch((error) => {
        console.warn('[queue-pump] pycore config sync failed', error);
      });
      this.wake();
    });
    // Realtime wake: a Laravel sentence.priority outbox event (SSE stream)
    // bumps the page-table head and dispatches it immediately.
    this.unsubscribeRealtime = laravelRealtime.subscribe(
      LARAVEL_REALTIME_EVENTS.sentencePriority,
      (payload) => {
        if (String(payload?.queue ?? QUEUE_KEY) !== QUEUE_KEY) return;
        const taskId = String(payload?.task_id ?? '').trim();
        this.notifyQueueChanged(taskId ? [taskId] : []);
      },
    );
    laravelRealtime.start();
    void this.loop();
  }

  stop(): void {
    this.running = false;
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = null;
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtime = null;
    laravelRealtime.stop();
    this.wake();
  }

  /**
   * Realtime seam for Laravel queue-head changes: bumps the page-table head
   * and dispatches the head item immediately instead of waiting out the idle
   * poll. Driven by the SSE stream (`sentence.priority` outbox events via
   * `laravelRealtime`); callers that learn about a bump through another
   * channel may still invoke this seam.
   */
  notifyQueueChanged(headIds: string[] = []): void {
    if (headIds.length > 0) diffQueueContext.touch(recoveryScope(), headIds);
    if (this.running) this.wake();
  }

  private wake(): void {
    const resolve = this.wakeResolver;
    this.wakeResolver = null;
    resolve?.();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wakeResolver = null;
        resolve();
      }, ms);
      this.wakeResolver = () => {
        clearTimeout(timer);
        this.wakeResolver = null;
        resolve();
      };
    });
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const progressed = await this.cycle();
        if (!progressed && this.running) await this.wait(IDLE_WAIT_MS);
      } catch (error) {
        console.warn('[queue-pump] cycle failed', error);
        if (this.running) await this.wait(ERROR_BACKOFF_MS);
      }
    }
  }

  private async cycle(): Promise<boolean> {
    // Drain restored local pages before requesting another server delta. This
    // keeps the bounded page table lossless and avoids one id-pages request
    // per materialized data segment while backlog already exists locally.
    const scopeKey = recoveryScope();
    const workerId = await this.ensureWorkerRegistration();
    if (!workerId) return false;
    const batchLimit = this.batchLimit();
    const local = diffQueueContext.snapshot(scopeKey);
    if (nextDispatchIds(local, batchLimit).length === 0) {
      // Steps 1-2: align on the server high-water cursor / realtime revision
      // (0 cursor = full realign). Laravel returns only the requested page
      // count and advances the cursor only through those returned entries.
      const idPages = await laravelApi.getQueueCenterIdPages(QUEUE_KEY, {
        cursor: local?.cursor ?? 0,
        pages: QUEUE_CENTER_DIFF_DELIVERY.id_page_limit,
      });
      const serverRevision = Number(idPages.revision ?? 0);
      const serverCursor = Number(idPages.cursor ?? 0);
      const headIds = Array.isArray(idPages.head_ids)
        ? idPages.head_ids.map((id) => String(id))
        : [];
      const serverPages = normalizeServerPages(idPages.pages);
      const localHeadIds = local?.headIds ?? [];
      const headUnchanged = headIds.length === localHeadIds.length
        && headIds.every((id, index) => id === localHeadIds[index]);
      const unchanged = serverCursor <= (local?.cursor ?? 0)
        && serverRevision === (local?.revision ?? 0)
        && serverPages.length === 0
        && headUnchanged;
      if (!unchanged) {
        diffQueueContext.align(scopeKey, {
          revision: serverRevision,
          cursor: serverCursor,
          headIds,
          pages: serverPages,
        });
      }
    }

    // Step 3: materialize the current page's data segment.
    const scope = diffQueueContext.snapshot(scopeKey);
    const ids = nextDispatchIds(scope, batchLimit);
    if (ids.length === 0) return false;
    const segment = await laravelApi.getQueueCenterPageData(QUEUE_KEY, ids);
    const tasks = Array.isArray(segment.items) ? segment.items : [];
    if (tasks.length === 0) {
      // Nothing materialized: compact the segment to ID metadata and move on.
      diffQueueContext.consume(scopeKey, ids);
      return true;
    }

    // Step 4: accept per task (claim guard against multi-instance
    // double-processing). 409 = foreign owner — skip; processed elsewhere.
    const materializedIds = new Set(tasks.map((task) => task.task_id));
    const claimCandidates = ids.filter((id) => materializedIds.has(id));
    diffQueueContext.consume(
      scopeKey,
      ids.filter((id) => !materializedIds.has(id)),
    );
    const claimed: string[] = [];
    const foreignOwned: string[] = [];
    for (const id of claimCandidates) {
      try {
        await laravelApi.acceptWorkerTask(QUEUE_KEY, id, workerId);
        claimed.push(id);
      } catch (error) {
        if ((error as { status?: number })?.status === 409) {
          foreignOwned.push(id);
          continue;
        }
        if ((error as { status?: number })?.status === 404) {
          this.registeredWorkerKey = null;
        }
        throw error;
      }
    }
    diffQueueContext.consume(scopeKey, foreignOwned);
    if (claimed.length === 0) {
      return true;
    }

    // Claimed IDs with no materialized row are already handled elsewhere.
    const claimedSet = new Set(claimed);
    const dispatchable = tasks.filter((task) => claimedSet.has(task.task_id));
    const dispatchableIds = new Set(
      dispatchable.map((task) => task.task_id),
    );
    diffQueueContext.consume(scopeKey, claimed.filter((id) => !dispatchableIds.has(id)));

    // Step 5: dispatch each claimed payload to pycore (in-memory only) and
    // await the RPC; consumed IDs are marked per successful dispatch.
    for (const task of dispatchable) {
      const accepted = await pycoreApi.acceptQueueCenterTask({
        task,
        laravel_endpoint: this.options.laravelEndpoint ?? null,
      });
      if (!accepted?.success) {
        if (accepted?.retryable) {
          return false;
        }
        throw new Error(accepted?.error || `Pycore rejected queue task ${task.task_id}`);
      }
      diffQueueContext.consume(scopeKey, [task.task_id]);
    }
    return true;
  }

  private async ensureWorkerRegistration(): Promise<string | null> {
    const worker = this.options.worker;
    const workerId = String(worker?.worker_id ?? '').trim();
    if (!worker || !workerId) return null;
    const registrationKey = JSON.stringify([
      laravelApi.currentEndpointUrl().replace(/\/+$/, ''),
      workerId,
      worker.worker_name,
      worker.processor_types,
      worker.capabilities ?? [],
    ]);
    if (registrationKey !== this.registeredWorkerKey) {
      await laravelApi.registerQueueWorker(worker);
      this.registeredWorkerKey = registrationKey;
    }
    return workerId;
  }

  private batchLimit(): number {
    const requested = Math.max(1, Number(this.options.concurrency) || 1);
    return Math.min(MAX_PUMP_BATCH_LIMIT, requested);
  }
}

export const sentenceAudioQueuePump = new SentenceAudioQueuePump();
