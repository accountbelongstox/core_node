import { useSyncExternalStore } from 'react';
import {
  GLOBAL_TASK_LIVE_STATUSES,
  GLOBAL_TASK_STATUSES_BY_ROLE,
} from '../../core/contracts/QueueCenterContract';
import { APPQYV1_LIBRARY_COVER_MAX_IDS } from '../../core/contracts/AppQyV1AiToolsContract';
import type {
  LibraryCoverEnqueueRequest,
  LibraryCoverEnqueueResult,
  LibraryCoverHandler,
  LibraryCoverMode,
  LibraryCoverTask,
  LibraryCoverTaskStatus,
  LibraryCoverTasksResult,
  VocabLibrary,
} from '../../core/integrations/laravel/LaravelTypes';

const LIBRARY_COVER_POLL_INTERVAL_MS = 3000;
const COVER_VERSION_PARAM = 'v';

export type LibraryCoverPhase = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface LibraryCoverEntry {
  libraryId: number;
  mode: LibraryCoverMode | null;
  phase: LibraryCoverPhase;
  handler: LibraryCoverHandler | null;
  error: string | null;
  coverStatus: string | null;
  coverErrorMessage: string | null;
  /** Cache-busted cover URLs (`?v=<cover_last_generated_at>`); null until known. */
  coverUrl: string | null;
  imageUrl: string | null;
  active: boolean;
}

/** Library-row cover fields the model reads (list rows, admin rows, raw table rows). */
export type LibraryCoverRow = Pick<
  VocabLibrary,
  'id' | 'image_url' | 'cover_status' | 'cover_error_message' | 'cover_attempts' | 'cover_task'
>;

export interface LibraryCoverTaskState {
  entries: Record<number, LibraryCoverEntry>;
}

/** Per-app HTTP binding (endpoint policy stays with each app's API layer). */
export interface LibraryCoverTaskTransport {
  enqueue(request: LibraryCoverEnqueueRequest): Promise<LibraryCoverEnqueueResult>;
  status(ids: number[]): Promise<LibraryCoverTasksResult>;
}

/** Library-row cover fields merged with the live task state. */
export interface LibraryCoverView {
  coverStatus: string | null;
  errorMessage: string | null;
  attempts: number;
  imageUrl: string | null;
  phase: LibraryCoverPhase | null;
  handler: LibraryCoverHandler | null;
  taskError: string | null;
  active: boolean;
}

const LIVE_STATUSES = new Set<string>(GLOBAL_TASK_LIVE_STATUSES);
const STATUS = GLOBAL_TASK_STATUSES_BY_ROLE;

function taskPhase(task: LibraryCoverTask): LibraryCoverPhase {
  switch (task.status) {
    case STATUS.pending:
      return 'queued';
    case STATUS.assigned:
    case STATUS.processing:
      return 'processing';
    case STATUS.failed:
      return 'failed';
    case STATUS.cancelled:
      return 'cancelled';
    default:
      return 'completed';
  }
}

function idlePhase(coverStatus: string | null): LibraryCoverPhase {
  if (coverStatus === 'failed') return 'failed';
  if (coverStatus === 'ready') return 'completed';
  return 'cancelled';
}

/** Append `?v=<version>` unless the backend already versioned the URL. */
export function versionedCoverUrl(url: string | null | undefined, version: string | null | undefined): string | null {
  if (!url) return null;
  if (!version) return url;
  const [path, hash = ''] = url.split('#', 2);
  const query = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
  if (new URLSearchParams(query).has(COVER_VERSION_PARAM)) return url;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${COVER_VERSION_PARAM}=${encodeURIComponent(version)}${hash ? `#${hash}` : ''}`;
}

function chunks(ids: number[]): number[][] {
  const result: number[][] = [];
  for (let index = 0; index < ids.length; index += APPQYV1_LIBRARY_COVER_MAX_IDS) {
    result.push(ids.slice(index, index + APPQYV1_LIBRARY_COVER_MAX_IDS));
  }
  return result;
}

function libraryIds(ids: Array<number | string>): number[] {
  return Array.from(new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
}

export function libraryCoverView(library: LibraryCoverRow, entry?: LibraryCoverEntry): LibraryCoverView {
  const attempts = typeof library.cover_attempts === 'number' ? library.cover_attempts : 0;
  const rowStatus = library.cover_status ?? null;
  const rowError = library.cover_error_message ?? null;
  const rowImage = library.image_url ?? null;
  if (!entry) {
    const task = library.cover_task ?? null;
    return {
      coverStatus: rowStatus,
      errorMessage: rowError,
      attempts,
      imageUrl: rowImage,
      phase: task ? taskPhase(task) : null,
      handler: task?.handler ?? null,
      taskError: task?.error ?? null,
      active: task ? LIVE_STATUSES.has(task.status) : false,
    };
  }
  return {
    coverStatus: entry.coverStatus ?? rowStatus,
    errorMessage: entry.coverStatus !== null ? entry.coverErrorMessage : rowError,
    attempts,
    imageUrl: entry.imageUrl ?? rowImage,
    phase: entry.phase,
    handler: entry.handler,
    taskError: entry.error,
    active: entry.active,
  };
}

/**
 * Tracks library cover tasks: enqueue, per-library live state, and a status
 * poll that runs only while a task is live and at least one view subscribes.
 */
export class LibraryCoverTaskModel {
  private state: LibraryCoverTaskState = { entries: {} };
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private polling = false;

  constructor(private readonly transport: LibraryCoverTaskTransport) {}

  getState = (): LibraryCoverTaskState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    this.schedule();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopTimer();
    };
  };

  entry(libraryId: number | string): LibraryCoverEntry | undefined {
    return this.state.entries[Number(libraryId)];
  }

  isActive(libraryId: number | string): boolean {
    return this.entry(libraryId)?.active === true;
  }

  /** Seed live tasks from library list rows (`cover_task`) so polling resumes after a reload. */
  track(libraries: LibraryCoverRow[]): void {
    const entries = { ...this.state.entries };
    let changed = false;
    for (const library of libraries) {
      const id = Number(library.id);
      const task = library.cover_task ?? null;
      const existing = entries[id];
      if (existing?.active) continue;
      if (task && LIVE_STATUSES.has(task.status)) {
        entries[id] = this.fromTask(id, task, existing, {
          coverStatus: library.cover_status ?? null,
          coverErrorMessage: library.cover_error_message ?? null,
        });
        changed = true;
      } else if (existing) {
        delete entries[id];
        changed = true;
      }
    }
    if (!changed) return;
    this.publish(entries);
    this.schedule();
  }

  async enqueue(ids: Array<number | string>, mode: LibraryCoverMode, prompt?: string): Promise<LibraryCoverEnqueueResult> {
    const targets = libraryIds(ids);
    const result: LibraryCoverEnqueueResult = { tasks: [], skipped: [] };
    if (targets.length === 0) return result;

    const previous = { ...this.state.entries };
    const optimistic = { ...previous };
    for (const id of targets) {
      optimistic[id] = {
        ...this.emptyEntry(id, previous[id]),
        mode,
        phase: 'queued',
        coverStatus: 'pending',
        coverErrorMessage: null,
        active: true,
      };
    }
    this.publish(optimistic);

    const trimmedPrompt = prompt?.trim();
    try {
      for (const chunk of chunks(targets)) {
        const response = await this.transport.enqueue({
          ids: chunk,
          mode,
          ...(trimmedPrompt ? { prompt: trimmedPrompt } : {}),
        });
        result.tasks.push(...(response.tasks ?? []));
        result.skipped.push(...(response.skipped ?? []));
      }
    } catch (error) {
      const restored = { ...this.state.entries };
      for (const id of targets) {
        if (previous[id]) restored[id] = previous[id];
        else delete restored[id];
      }
      this.publish(restored);
      throw error;
    }

    const entries = { ...this.state.entries };
    for (const skipped of result.skipped) {
      const id = Number(skipped.id);
      if (previous[id]) entries[id] = previous[id];
      else delete entries[id];
    }
    for (const task of result.tasks) {
      const id = Number(task.library_id);
      if (Number.isInteger(id) && id > 0) entries[id] = this.fromTask(id, task, entries[id]);
    }
    this.publish(entries);
    this.refreshNow();
    return result;
  }

  private emptyEntry(libraryId: number, existing?: LibraryCoverEntry): LibraryCoverEntry {
    return {
      libraryId,
      mode: existing?.mode ?? null,
      phase: 'queued',
      handler: null,
      error: null,
      coverStatus: existing?.coverStatus ?? null,
      coverErrorMessage: existing?.coverErrorMessage ?? null,
      coverUrl: existing?.coverUrl ?? null,
      imageUrl: existing?.imageUrl ?? null,
      active: false,
    };
  }

  private fromTask(
    libraryId: number,
    task: LibraryCoverTask,
    existing?: LibraryCoverEntry,
    cover?: Partial<Pick<LibraryCoverEntry, 'coverStatus' | 'coverErrorMessage' | 'coverUrl' | 'imageUrl'>>,
  ): LibraryCoverEntry {
    return {
      ...this.emptyEntry(libraryId, existing),
      ...(cover ?? {}),
      mode: task.mode ?? existing?.mode ?? null,
      phase: taskPhase(task),
      handler: task.handler ?? null,
      error: task.error ?? null,
      active: LIVE_STATUSES.has(task.status),
    };
  }

  private fromStatus(item: LibraryCoverTaskStatus, existing?: LibraryCoverEntry): LibraryCoverEntry {
    const libraryId = Number(item.library_id);
    const version = item.cover_last_generated_at ?? item.task?.updated_at ?? null;
    const cover = {
      coverStatus: item.cover_status ?? null,
      coverErrorMessage: item.cover_error_message ?? null,
      coverUrl: versionedCoverUrl(item.cover_url, version),
      imageUrl: versionedCoverUrl(item.image_url, version),
    };
    if (item.task) return this.fromTask(libraryId, item.task, existing, cover);
    return {
      ...this.emptyEntry(libraryId, existing),
      ...cover,
      mode: existing?.mode ?? null,
      phase: idlePhase(cover.coverStatus),
    };
  }

  private activeIds(): number[] {
    return Object.values(this.state.entries)
      .filter((entry) => entry.active)
      .map((entry) => entry.libraryId);
  }

  private refreshNow(): void {
    this.stopTimer();
    if (this.listeners.size > 0) void this.poll();
  }

  private schedule(): void {
    if (this.timer || this.polling || this.listeners.size === 0 || this.activeIds().length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, LIBRARY_COVER_POLL_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async poll(): Promise<void> {
    const ids = this.activeIds();
    if (this.polling || ids.length === 0) return;
    this.polling = true;
    try {
      for (const chunk of chunks(ids)) {
        const response = await this.transport.status(chunk);
        const entries = { ...this.state.entries };
        for (const item of response.items ?? []) {
          const id = Number(item.library_id);
          entries[id] = this.fromStatus(item, entries[id]);
        }
        this.publish(entries);
      }
    } catch (error) {
      console.warn('[LibraryCoverTaskModel] status poll failed', error);
    } finally {
      this.polling = false;
      this.schedule();
    }
  }

  private publish(entries: Record<number, LibraryCoverEntry>): void {
    this.state = { entries };
    this.listeners.forEach((listener) => listener());
  }
}

/** Subscribe a view to a cover-task model (polling stops when the last view unmounts). */
export function useLibraryCoverTasks(model: LibraryCoverTaskModel): LibraryCoverTaskState {
  return useSyncExternalStore(model.subscribe, model.getState, model.getState);
}

/** Subscribe to one library's entry (re-renders only when that entry changes). */
export function useLibraryCoverEntry(model: LibraryCoverTaskModel, libraryId: number | string): LibraryCoverEntry | undefined {
  const read = () => model.entry(libraryId);
  return useSyncExternalStore(model.subscribe, read, read);
}
