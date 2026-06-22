/**
 * Task History Store
 *
 * A small, framework-agnostic, bounded store that tracks the lifecycle of
 * unified tasks the popup has observed — keyed by task_id, carrying the
 * task_type / capability / priority and an append-only `timeline` of status
 * transitions. It is fed by the per-task SSE stream
 * (GET /api/task/{id}/stream) via `updateFromSSE(frame)` and read by
 * UnifiedTaskCenter.vue + TaskDetailModal.vue.
 *
 * It deliberately does NOT import Vue: the background service worker also
 * touches it, and a plain subscribe()/snapshot() API lets the popup wrap it in
 * a `ref` (see composables/useTaskCenter) without coupling this module to a
 * rendering runtime.
 */

import type { WorkerCapability } from '../../api/WorkerApiClient';

/** Canonical lifecycle states a task transitions through. */
export type TaskTimelineEvent =
  | 'pending'
  | 'assigned'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'reclaimed'
  | 'cancelled';

export interface TaskTimelineEntry {
  event: TaskTimelineEvent | string;
  at: number; // client receipt timestamp (ms)
  /** The SSE frame id (_id) that produced this entry, when present. */
  eventId?: string | number | null;
  /** Optional worker that owns/owned the task at this transition. */
  worker_id?: string | null;
}

export interface TaskHistoryRecord {
  task_id: string;
  task_type: string | null;
  capability: WorkerCapability | string | null;
  priority: number | null;
  status: TaskTimelineEvent | string;
  is_fast_tier: boolean;
  updated_at: number;
  timeline: TaskTimelineEntry[];
}

/**
 * One SSE frame as delivered to updateFromSSE. The per-task stream emits
 * `task.detail-initial` (full bundle) and `task.event` (single transition,
 * carrying `_id` and `data.event`). Both fold into the same record here.
 */
export interface TaskSSEFrame {
  /** SSE event name: 'task.detail-initial' | 'task.event' | 'ping' | 'stream.close'. */
  event?: string;
  /** Per-frame id used as the SSE Last-Event-ID cursor. */
  _id?: string | number | null;
  task_id?: string;
  data?: {
    task_id?: string;
    task_type?: string | null;
    capability?: WorkerCapability | string | null;
    priority?: number | null;
    is_fast_tier?: boolean;
    status?: string;
    /** For task.event frames: the transition that just happened. */
    event?: string;
    worker_id?: string | null;
    [k: string]: any;
  };
  [k: string]: any;
}

// Status values that count as terminal — used to cap timeline noise.
const TERMINAL = new Set<string>(['completed', 'failed', 'timeout', 'cancelled']);

// Bound the store so a long-running popup never grows without limit.
const MAX_RECORDS = 200;
const MAX_TIMELINE = 50;

type Listener = (records: TaskHistoryRecord[]) => void;

class TaskHistoryStore {
  private records = new Map<string, TaskHistoryRecord>();
  private listeners = new Set<Listener>();

  /** Current records, most-recently-updated first. */
  snapshot(): TaskHistoryRecord[] {
    return Array.from(this.records.values()).sort((a, b) => b.updated_at - a.updated_at);
  }

  get(taskId: string): TaskHistoryRecord | null {
    return this.records.get(taskId) ?? null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // Push the current snapshot immediately so subscribers render at once.
    try {
      listener(this.snapshot());
    } catch {
      /* listener errors must not break the store */
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Fold an SSE frame into the store. Handles both the initial detail bundle
   * (which establishes task_type/capability/priority) and incremental
   * task.event transitions (which advance status + append to the timeline).
   * `ping` / `stream.close` frames carry no task data and are ignored.
   */
  updateFromSSE(frame: TaskSSEFrame): void {
    if (!frame) return;
    const name = frame.event;
    if (name === 'ping' || name === 'stream.close') return;

    const data = frame.data ?? {};
    const taskId = data.task_id ?? frame.task_id;
    if (!taskId) return;

    const existing = this.records.get(taskId);
    const now = Date.now();

    // `task.event` frames carry the transition under data.event; the initial
    // bundle carries a settled status under data.status.
    const transition =
      typeof data.event === 'string' && data.event
        ? data.event
        : typeof data.status === 'string'
          ? data.status
          : undefined;

    const record: TaskHistoryRecord = existing ?? {
      task_id: taskId,
      task_type: null,
      capability: null,
      priority: null,
      status: 'pending',
      is_fast_tier: false,
      updated_at: now,
      timeline: [],
    };

    // Establish/refresh descriptive fields when the frame supplies them.
    if (data.task_type !== undefined && data.task_type !== null) record.task_type = data.task_type;
    if (data.capability !== undefined) record.capability = data.capability;
    if (data.priority !== undefined && data.priority !== null) record.priority = data.priority;
    if (data.is_fast_tier !== undefined) record.is_fast_tier = !!data.is_fast_tier;

    if (transition) {
      record.status = transition;
      // Append a timeline entry, de-duping consecutive identical events.
      const last = record.timeline[record.timeline.length - 1];
      if (!last || last.event !== transition) {
        record.timeline.push({
          event: transition,
          at: now,
          eventId: frame._id ?? null,
          worker_id: data.worker_id ?? null,
        });
        if (record.timeline.length > MAX_TIMELINE) {
          record.timeline.splice(0, record.timeline.length - MAX_TIMELINE);
        }
      }
    }

    record.updated_at = now;
    this.records.set(taskId, record);

    // Evict oldest records once over the cap; prefer evicting terminal ones.
    if (this.records.size > MAX_RECORDS) {
      this.evict();
    }

    this.emit();
  }

  /** Drop the oldest record(s), terminal-first, to stay under MAX_RECORDS. */
  private evict(): void {
    const all = Array.from(this.records.values());
    all.sort((a, b) => {
      const at = TERMINAL.has(a.status) ? 0 : 1;
      const bt = TERMINAL.has(b.status) ? 0 : 1;
      if (at !== bt) return at - bt; // terminal first
      return a.updated_at - b.updated_at; // then oldest
    });
    const overflow = this.records.size - MAX_RECORDS;
    for (let i = 0; i < overflow; i++) {
      this.records.delete(all[i].task_id);
    }
  }

  clear(): void {
    this.records.clear();
    this.emit();
  }

  private emit(): void {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
        /* a misbehaving subscriber must not break the rest */
      }
    }
  }
}

// Singleton — one shared history across the popup + background contexts.
export const taskHistoryStore = new TaskHistoryStore();
