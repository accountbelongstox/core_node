/**
 * The composition list, kept on the device (authoritative for editing,
 * `Directory.Data`) and mirrored in Laravel (`/orch_audio/client_tasks`).
 * Every local change is pushed (debounced); a pull merges by
 * `client_updated_at`, the newest edit wins and a newer tombstone removes the
 * task on every device.
 */
import { CapJsonStore, Directory } from '../../platform/capabilities';
import { wfNewApi, type WfNewOrchClientTaskRow } from '../../api';
import { StorageManager } from '../../../../core/persistence';
import { getWordNewClientKey } from '../../utils/WordNewClientIdentity';
import { wordNewOrchProgressStore } from './WordNewOrchProgressStore';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import { defaultOrchConfig, orchPlanHash, orchTaskVirtualBatch } from '../../../../shared/orchestration/orchPlanner';
import type {
  OrchComposeConfig,
  OrchComposeSource,
  OrchComposeStatus,
  OrchComposeTask,
  OrchTaskProgressSummary,
} from '../../../../shared/orchestration/orchTypes';

const TASKS_PATH = 'wfnew-orch/tasks.json';
const PUSH_DELAY_MS = 1_200;
const DEVICE_ID_MAX = 64;
/** Prefix of a stable device id (a fingerprint id has another). */
const STABLE_DEVICE_PREFIX = 'd-';
const UNFINISHED_STATUSES: readonly OrchComposeStatus[] = ['resolving', 'partial'];

interface TaskDocument {
  version: 1;
  tasks: OrchComposeTask[];
  /** Server time of the last complete pull (next pull asks for newer rows). */
  pulledAt: string | null;
}

type TaskListener = (tasks: OrchComposeTask[]) => void;

function newTaskId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `c-${random}`.slice(0, DEVICE_ID_MAX);
}

/**
 * This device's id for its tasks: random, generated once and kept (a browser
 * fingerprint can change between sessions; this does not).
 */
function orchDeviceId(): string {
  const stored = StorageManager.get<string>(StorageKeys.WORDNEW_ORCH_DEVICE_ID, '');
  if (stored) return stored;
  const created = newTaskId().replace(/^c-/, STABLE_DEVICE_PREFIX);
  StorageManager.set(StorageKeys.WORDNEW_ORCH_DEVICE_ID, created);
  return created;
}

function newer(left: string, right: string): boolean {
  return Date.parse(left || '0') > Date.parse(right || '0');
}

function toRow(task: OrchComposeTask): WfNewOrchClientTaskRow {
  return {
    clientTaskId: task.id,
    name: task.name,
    source: task.source,
    language: task.language,
    sourceRef: task.config.book ? { ...task.config.book } : null,
    config: task.config as unknown as Record<string, unknown>,
    progress: task.progress
      ? { plan_hash: task.progress.planHash, phase: task.progress.phase, done: task.progress.done, total: task.progress.total, updated_at: task.progress.updatedAt }
      : null,
    planHash: task.planHash,
    status: task.status,
    segmentCount: task.segmentCount,
    itemCount: task.itemCount,
    durationMs: task.durationMs,
    deviceId: task.deviceId,
    clientUpdatedAt: task.updatedAt,
    deleted: task.deleted,
  };
}

function progressFromRow(raw: Record<string, unknown> | null): OrchTaskProgressSummary | null {
  if (!raw || typeof raw.plan_hash !== 'string') return null;
  return {
    planHash: raw.plan_hash,
    phase: String(raw.phase ?? ''),
    done: Number(raw.done) || 0,
    total: Number(raw.total) || 0,
    updatedAt: String(raw.updated_at ?? ''),
  };
}

function fromRow(row: WfNewOrchClientTaskRow): OrchComposeTask {
  const source: OrchComposeSource = row.source === 'prompt_rewrite' ? 'prompt_rewrite' : 'vocab_book';
  const config = { ...defaultOrchConfig(source), ...(row.config as Partial<OrchComposeConfig> | null) };
  const status = (['draft', 'resolving', 'ready', 'partial'] as OrchComposeStatus[]).includes(row.status as OrchComposeStatus)
    ? row.status as OrchComposeStatus
    : 'draft';
  return {
    id: row.clientTaskId,
    name: row.name,
    source,
    language: row.language || 'en',
    config,
    status,
    planHash: row.planHash,
    segmentCount: row.segmentCount,
    itemCount: row.itemCount,
    durationMs: row.durationMs,
    deviceId: row.deviceId,
    updatedAt: row.clientUpdatedAt,
    deleted: row.deleted,
    progress: progressFromRow(row.progress),
    synced: true,
  };
}

class WordNewOrchTaskStoreService {
  private readonly file = new CapJsonStore<TaskDocument>(TASKS_PATH, { version: 1, tasks: [], pulledAt: null }, Directory.Data);
  private document: TaskDocument | null = null;
  private readonly listeners = new Set<TaskListener>();
  private writes: Promise<void> = Promise.resolve();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing: Promise<void> | null = null;

  private loading: Promise<TaskDocument> | null = null;
  /** An edit arrived while a sync was running: sync again when it ends. */
  private dirty = false;

  private load(): Promise<TaskDocument> {
    if (this.document) return Promise.resolve(this.document);
    this.loading ??= this.file.load().then((stored) => {
      this.document ??= { ...stored };
      return this.document;
    });
    return this.loading;
  }

  private async commit(mutate: (tasks: OrchComposeTask[]) => OrchComposeTask[], push = true): Promise<void> {
    const document = await this.load();
    document.tasks = mutate(document.tasks);
    const snapshot = { ...document, tasks: [...document.tasks] };
    this.writes = this.writes.catch(() => undefined).then(() => this.file.save(snapshot));
    await this.writes;
    this.emit();
    if (push) this.schedulePush();
  }

  private emit(): void {
    const tasks = this.visible();
    this.listeners.forEach((listener) => listener(tasks));
  }

  private visible(): OrchComposeTask[] {
    return (this.document?.tasks ?? [])
      .filter((task) => !task.deleted)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  subscribe(listener: TaskListener): () => void {
    this.listeners.add(listener);
    void this.load().then(() => listener(this.visible()));
    return () => { this.listeners.delete(listener); };
  }

  async get(id: string): Promise<OrchComposeTask | null> {
    return (await this.load()).tasks.find((task) => task.id === id && !task.deleted) ?? null;
  }

  /**
   * This device's tasks a run left unfinished (interrupted, failed, or still
   * missing clips). A task stored under a former fingerprint id (it changes
   * between sessions) is this device's when the device holds its run progress
   * (kept per device), or the fingerprint is the current one; it moves to the
   * stable id.
   */
  async unfinished(): Promise<OrchComposeTask[]> {
    const deviceId = orchDeviceId();
    const legacyId = (await getWordNewClientKey()).slice(0, DEVICE_ID_MAX);
    const tasks = (await this.load()).tasks;
    const kept = new Set(await wordNewOrchProgressStore.taskIds());
    const adopt = (task: OrchComposeTask): boolean => task.deviceId !== deviceId && !task.deviceId.startsWith(STABLE_DEVICE_PREFIX)
      && (task.deviceId === legacyId || kept.has(task.id));
    if (tasks.some(adopt)) {
      await this.commit((all) => all.map((task) => (adopt(task) ? { ...task, deviceId } : task)));
    }
    return (await this.load()).tasks.filter((task) => !task.deleted && task.deviceId === deviceId
      && UNFINISHED_STATUSES.includes(task.status));
  }

  async create(source: OrchComposeSource, name: string, language: string, config?: OrchComposeConfig): Promise<OrchComposeTask> {
    const id = newTaskId();
    const base = config ?? defaultOrchConfig(source);
    // `virtual`: every orchestration reads against its own API-side batch.
    const taskConfig = base.readState === 'virtual' ? { ...base, virtualBatch: orchTaskVirtualBatch(id) } : base;
    const task: OrchComposeTask = {
      id,
      name,
      source,
      language,
      config: taskConfig,
      status: 'draft',
      planHash: orchPlanHash({ source, config: taskConfig, language }),
      segmentCount: 0,
      itemCount: 0,
      durationMs: 0,
      deviceId: orchDeviceId(),
      updatedAt: new Date().toISOString(),
      deleted: false,
      progress: null,
      synced: false,
    };
    await this.commit((tasks) => [...tasks, task]);
    return task;
  }

  /** Edit a task; a plan-shaping edit resets it to a draft (re-resolved on open). */
  async update(id: string, patch: Partial<Pick<OrchComposeTask, 'name' | 'source' | 'language' | 'config' | 'status' | 'segmentCount' | 'itemCount' | 'durationMs' | 'progress'>>): Promise<OrchComposeTask | null> {
    let updated: OrchComposeTask | null = null;
    await this.commit((tasks) => tasks.map((task) => {
      if (task.id !== id) return task;
      const next = { ...task, ...patch };
      next.planHash = orchPlanHash(next);
      if (next.planHash !== task.planHash && !patch.status) next.status = 'draft';
      next.updatedAt = new Date().toISOString();
      next.synced = false;
      updated = next;
      return next;
    }));
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.commit((tasks) => tasks.map((task) => (
      task.id === id ? { ...task, deleted: true, synced: false, updatedAt: new Date().toISOString() } : task
    )));
  }

  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.sync();
    }, PUSH_DELAY_MS);
  }

  /** Push unsynced edits, then pull newer rows (no-op while logged out). */
  sync(): Promise<void> {
    if (!wfNewApi.isAuthenticated()) return Promise.resolve();
    if (this.syncing) {
      this.dirty = true;
      return this.syncing;
    }
    this.syncing = this.runSync().finally(() => {
      this.syncing = null;
      if (this.dirty) {
        this.dirty = false;
        void this.sync();
      }
    });
    return this.syncing;
  }

  private async runSync(): Promise<void> {
    const document = await this.load();
    const pushed = new Map<string, OrchComposeTask>();
    /** The edit time each push was made from: a later local edit is never replaced. */
    const pushedFrom = new Map<string, string>();
    for (const task of document.tasks.filter((entry) => !entry.synced)) {
      pushedFrom.set(task.id, task.updatedAt);
      if (task.deleted) {
        const ok = await wfNewApi.deleteOrchClientTask(task.id, task.updatedAt).then(() => true, () => false);
        if (ok) pushed.set(task.id, { ...task, synced: true });
        continue;
      }
      const result = await wfNewApi.saveOrchClientTask(toRow(task)).catch(() => null);
      if (result) pushed.set(task.id, result.applied ? { ...task, synced: true } : fromRow(result.row));
    }
    const pulled = new Map<string, OrchComposeTask>();
    let needsPush = false;
    let serverTime: string | null = null;
    for (let page = 1; ; page += 1) {
      const result = await wfNewApi.getOrchClientTasks(page, document.pulledAt).catch(() => null);
      if (!result) {
        serverTime = null;
        break;
      }
      serverTime = result.serverTime;
      result.items.forEach((row) => pulled.set(row.clientTaskId, fromRow(row)));
      if (page * result.perPage >= result.total || result.items.length === 0) break;
    }
    await this.commit((tasks) => {
      const merged = new Map(tasks.map((task) => {
        const result = pushed.get(task.id);
        return [task.id, result && pushedFrom.get(task.id) === task.updatedAt ? result : task];
      }));
      // The newest edit wins: a newer remote replaces the local task, a newer
      // local task is kept and uploaded (the remote only stores the list).
      pulled.forEach((remote, id) => {
        const local = merged.get(id);
        if (!local || newer(remote.updatedAt, local.updatedAt)) {
          merged.set(id, remote);
        } else if (newer(local.updatedAt, remote.updatedAt)) {
          merged.set(id, { ...local, synced: false });
          needsPush = true;
        } else {
          merged.set(id, { ...local, synced: true });
        }
      });
      return [...merged.values()];
    }, false);
    if (needsPush) this.schedulePush();
    if (serverTime) {
      document.pulledAt = serverTime;
      await this.commit((tasks) => tasks, false);
    }
  }
}

export const wordNewOrchTaskStore = new WordNewOrchTaskStoreService();
