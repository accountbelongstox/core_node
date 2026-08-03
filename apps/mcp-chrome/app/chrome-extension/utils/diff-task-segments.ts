import { DIFF_DELIVERY, type Task } from '@/utils/queue-center-contract';


const CURSOR_STORAGE_KEY = 'queueDiffCursors';
const ID_PAGE_STORAGE_KEY = 'queueDiffIdPages';
const DATA_SEGMENT_STORAGE_KEY = 'queueDiffDataSegments';

type CursorMap = Record<string, { revision: number; lastId?: string; headId?: string; updatedAt: number }>;
type IdPage = { pageId: string | number; ids: string[]; state: 'ready' | 'consumed' | 'priority'; updatedAt: number };
type IdPageMap = Record<string, IdPage[]>;
type DataSegmentMap = Record<string, Record<string, Task>>;

class DiffTaskSegmentStore {
  private readonly delivered = new Set<string>();
  private operation: Promise<void> = Promise.resolve();

  async stage(scope: string, tasks: Task[]): Promise<Task[]> {
    return this.runExclusive(() => this.stageUnlocked(scope, tasks));
  }

  private async stageUnlocked(scope: string, tasks: Task[]): Promise<Task[]> {
    const stored = await chrome.storage.local.get([
      CURSOR_STORAGE_KEY,
      ID_PAGE_STORAGE_KEY,
      DATA_SEGMENT_STORAGE_KEY,
    ]);
    const cursors: CursorMap = stored[CURSOR_STORAGE_KEY] || {};
    const pages: IdPageMap = stored[ID_PAGE_STORAGE_KEY] || {};
    const segments: DataSegmentMap = stored[DATA_SEGMENT_STORAGE_KEY] || {};
    const scopeSegments = { ...(segments[scope] || {}) };
    const accepted: Task[] = [];

    for (const task of tasks) {
      if (!task.task_id || scopeSegments[task.task_id]) continue;
      scopeSegments[task.task_id] = task;
      this.delivered.add(this.deliveryKey(scope, task.task_id));
      accepted.push(task);
    }
    if (accepted.length === 0) return [];

    const revision = (cursors[scope]?.revision || 0) + 1;
    cursors[scope] = {
      revision,
      lastId: accepted[accepted.length - 1].task_id,
      updatedAt: Date.now(),
    };
    pages[scope] = this.trimPages([
      ...(pages[scope] || []),
      {
        pageId: revision,
        ids: accepted.map((task) => task.task_id),
        state: 'ready',
        updatedAt: Date.now(),
      },
    ]);
    segments[scope] = this.trimSegments(scopeSegments);
    await chrome.storage.local.set({
      [CURSOR_STORAGE_KEY]: cursors,
      [ID_PAGE_STORAGE_KEY]: pages,
      [DATA_SEGMENT_STORAGE_KEY]: segments,
    });
    return accepted;
  }

  async pending(scope: string): Promise<Task[]> {
    return this.runExclusive(() => this.pendingUnlocked(scope));
  }

  private async pendingUnlocked(scope: string): Promise<Task[]> {
    const stored = await chrome.storage.local.get(DATA_SEGMENT_STORAGE_KEY);
    const segments: DataSegmentMap = stored[DATA_SEGMENT_STORAGE_KEY] || {};
    const pending: Task[] = [];
    for (const task of Object.values(segments[scope] || {})) {
      const key = this.deliveryKey(scope, task.task_id);
      if (this.delivered.has(key)) continue;
      this.delivered.add(key);
      pending.push(task);
    }
    return pending;
  }

  async consume(scope: string, taskId: string): Promise<void> {
    return this.runExclusive(() => this.consumeUnlocked(scope, taskId));
  }

  private async consumeUnlocked(scope: string, taskId: string): Promise<void> {
    const stored = await chrome.storage.local.get([ID_PAGE_STORAGE_KEY, DATA_SEGMENT_STORAGE_KEY]);
    const pages: IdPageMap = stored[ID_PAGE_STORAGE_KEY] || {};
    const segments: DataSegmentMap = stored[DATA_SEGMENT_STORAGE_KEY] || {};
    const scopeSegments = { ...(segments[scope] || {}) };
    delete scopeSegments[taskId];
    this.delivered.delete(this.deliveryKey(scope, taskId));
    const remaining = new Set(Object.keys(scopeSegments));
    pages[scope] = this.trimPages((pages[scope] || []).map((page) => ({
      ...page,
      state: page.ids.includes(taskId) && !page.ids.some((id) => remaining.has(id))
        ? 'consumed'
        : page.state,
      updatedAt: Date.now(),
    })));
    segments[scope] = scopeSegments;
    await chrome.storage.local.set({
      [ID_PAGE_STORAGE_KEY]: pages,
      [DATA_SEGMENT_STORAGE_KEY]: segments,
    });
  }

  async promote(taskId: string, priority: number): Promise<void> {
    return this.runExclusive(() => this.promoteUnlocked(taskId, priority));
  }

  private async promoteUnlocked(taskId: string, priority: number): Promise<void> {
    const stored = await chrome.storage.local.get([
      CURSOR_STORAGE_KEY,
      ID_PAGE_STORAGE_KEY,
      DATA_SEGMENT_STORAGE_KEY,
    ]);
    const cursors: CursorMap = stored[CURSOR_STORAGE_KEY] || {};
    const pages: IdPageMap = stored[ID_PAGE_STORAGE_KEY] || {};
    const segments: DataSegmentMap = stored[DATA_SEGMENT_STORAGE_KEY] || {};

    for (const scope of new Set([...Object.keys(cursors), ...Object.keys(segments)])) {
      const belongsToScope = Boolean(segments[scope]?.[taskId])
        || (pages[scope] || []).some((page) => page.ids.includes(taskId));
      if (!belongsToScope) continue;
      const revision = (cursors[scope]?.revision || 0) + 1;
      cursors[scope] = { revision, headId: taskId, updatedAt: Date.now() };
      pages[scope] = this.trimPages([
        { pageId: `head-${revision}`, ids: [taskId], state: 'priority', updatedAt: Date.now() },
        ...(pages[scope] || []),
      ]);
      const task = segments[scope]?.[taskId];
      if (task) task.priority = Math.max(task.priority || 0, priority);
    }
    await chrome.storage.local.set({
      [CURSOR_STORAGE_KEY]: cursors,
      [ID_PAGE_STORAGE_KEY]: pages,
      [DATA_SEGMENT_STORAGE_KEY]: segments,
    });
  }

  private trimPages(pages: IdPage[]): IdPage[] {
    const priority = pages.filter((page) => page.state === 'priority');
    const ready = pages.filter((page) => page.state === 'ready').reverse();
    const consumed = pages.filter((page) => page.state === 'consumed').reverse();
    const bounded: IdPage[] = [];
    let idCount = 0;
    for (const page of [...priority, ...ready, ...consumed]) {
      if (bounded.length >= DIFF_DELIVERY.id_page_limit) break;
      if (idCount + page.ids.length > DIFF_DELIVERY.id_limit) continue;
      bounded.push(page);
      idCount += page.ids.length;
    }
    return bounded;
  }

  private trimSegments(segments: Record<string, Task>): Record<string, Task> {
    return Object.fromEntries(
      Object.entries(segments).slice(-DIFF_DELIVERY.data_segment_limit),
    );
  }

  private deliveryKey(scope: string, taskId: string): string {
    return `${scope}:${taskId}`;
  }

  private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}

export const diffTaskSegmentStore = new DiffTaskSegmentStore();
