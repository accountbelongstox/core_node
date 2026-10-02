/**
 * Where the user is in each composition: the resume position (written while
 * playing) and the saved play history. Kept per user on the device
 * (`wfnew-orch/users/<user>/playback.json`, read first - no network to open the
 * player) and roamed through Laravel (`/orch_audio/client_playback`): local
 * edits are pushed debounced, a pull asks only for rows newer than the last
 * one; the newest edit of a task's state wins (resume and history together).
 */
import { ChangeSignal } from '../../../../core/events/ChangeSignal';
import { CapJsonStore, Directory } from '../../platform/capabilities';
import { wfNewApi, type WfNewOrchClientPlaybackRow, type WfNewOrchPlaybackHistoryEntry, type WfNewOrchPlaybackPosition } from '../../api';
import { subscribeAuthLoginSuccess } from '../../../../core/auth/AuthRequestCenter';
import { orchUserPath, orchUserScope } from './WordNewOrchUserScope';

export type OrchPlaybackPosition = WfNewOrchPlaybackPosition;
export type OrchPlaybackHistoryEntry = WfNewOrchPlaybackHistoryEntry;

export interface OrchTaskPlayback {
  resume: OrchPlaybackPosition | null;
  history: OrchPlaybackHistoryEntry[];
  updatedAt: string;
  synced: boolean;
}

interface PlaybackDocument {
  version: 1;
  tasks: Record<string, OrchTaskPlayback>;
  /** Server time of the last complete pull. */
  pulledAt: string | null;
}

const PLAYBACK_FILE = 'playback.json';
const HISTORY_MAX = 50;
const PUSH_DELAY_MS = 15_000;

function newer(left: string, right: string): boolean {
  return Date.parse(left || '0') > Date.parse(right || '0');
}

function newHistoryId(): string {
  return `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeHistory(left: OrchPlaybackHistoryEntry[], right: OrchPlaybackHistoryEntry[]): OrchPlaybackHistoryEntry[] {
  const byId = new Map<string, OrchPlaybackHistoryEntry>();
  [...left, ...right].forEach((entry) => { if (!byId.has(entry.id)) byId.set(entry.id, entry); });
  return [...byId.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, HISTORY_MAX);
}

function toRow(taskId: string, playback: OrchTaskPlayback): WfNewOrchClientPlaybackRow {
  return { clientTaskId: taskId, resume: playback.resume, history: playback.history, clientUpdatedAt: playback.updatedAt };
}

class WordNewOrchPlaybackStoreService {
  private scope = '';
  private file: CapJsonStore<PlaybackDocument> | null = null;
  private document: PlaybackDocument | null = null;
  private loading: Promise<PlaybackDocument> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private syncing: Promise<void> | null = null;
  private dirty = false;
  private version = 0;
  private readonly changes = new ChangeSignal();

  constructor() {
    subscribeAuthLoginSuccess(() => { void this.sync(); });
  }

  /** The signed-in user's document (a user switch loads that user's file). */
  private load(): Promise<PlaybackDocument> {
    const scope = orchUserScope();
    if (scope !== this.scope) {
      this.scope = scope;
      this.file = new CapJsonStore<PlaybackDocument>(orchUserPath(scope, PLAYBACK_FILE), { version: 1, tasks: {}, pulledAt: null }, Directory.Data);
      this.document = null;
      this.loading = null;
    }
    if (this.document) return Promise.resolve(this.document);
    const file = this.file as CapJsonStore<PlaybackDocument>;
    this.loading ??= file.load().then((stored) => {
      if (this.scope === scope) this.document ??= { version: 1, tasks: { ...(stored.tasks ?? {}) }, pulledAt: stored.pulledAt ?? null };
      this.emit();
      void this.sync();
      return this.document ?? { version: 1, tasks: {}, pulledAt: null };
    });
    return this.loading;
  }

  private emit(): void {
    this.version += 1;
    this.changes.emit();
  }

  private async commit(mutate: (document: PlaybackDocument) => void, push: boolean): Promise<void> {
    const document = await this.load();
    const file = this.file;
    mutate(document);
    const snapshot: PlaybackDocument = { ...document, tasks: { ...document.tasks } };
    this.writes = this.writes.catch(() => undefined).then(() => file?.save(snapshot));
    this.emit();
    if (push) this.schedulePush();
    await this.writes;
  }

  private edit(taskId: string, change: (current: OrchTaskPlayback) => OrchTaskPlayback): Promise<void> {
    return this.commit((document) => {
      const current = document.tasks[taskId] ?? { resume: null, history: [], updatedAt: '', synced: true };
      document.tasks[taskId] = { ...change(current), updatedAt: new Date().toISOString(), synced: false };
    }, true);
  }

  subscribe = (listener: () => void): (() => void) => {
    const unsubscribe = this.changes.subscribe(listener);
    void this.load();
    return unsubscribe;
  };

  getVersion = (): number => this.version;

  /** Loaded state of a task (null before the device file is read or when never played). */
  playback(taskId: string): OrchTaskPlayback | null {
    return this.scope === orchUserScope() ? this.document?.tasks[taskId] ?? null : null;
  }

  async ready(taskId: string): Promise<OrchTaskPlayback | null> {
    return (await this.load()).tasks[taskId] ?? null;
  }

  saveResume(taskId: string, position: OrchPlaybackPosition): Promise<void> {
    return this.edit(taskId, (current) => ({ ...current, resume: position }));
  }

  addHistory(taskId: string, position: OrchPlaybackPosition): Promise<void> {
    return this.edit(taskId, (current) => ({ ...current, history: mergeHistory([{ ...position, id: newHistoryId() }], current.history) }));
  }

  removeHistory(taskId: string, id: string): Promise<void> {
    return this.edit(taskId, (current) => ({ ...current, history: current.history.filter((entry) => entry.id !== id) }));
  }

  /** Push pending edits now (the player is closing). */
  flush(): void {
    if (!this.pushTimer) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
    void this.sync();
  }

  private schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.sync();
    }, PUSH_DELAY_MS);
  }

  /** Push local edits, then pull newer rows (no-op while signed out). */
  sync(): Promise<void> {
    if (!wfNewApi.isAuthenticated() || orchUserScope() !== this.scope || !this.document) return Promise.resolve();
    if (this.syncing) {
      this.dirty = true;
      return this.syncing;
    }
    this.syncing = this.runSync().catch(() => undefined).finally(() => {
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
    const pushedFrom = new Map<string, string>();
    for (const [taskId, playback] of Object.entries(document.tasks).filter(([, entry]) => !entry.synced)) {
      const result = await wfNewApi.saveOrchClientPlayback(toRow(taskId, playback)).catch(() => null);
      if (result?.applied) pushedFrom.set(taskId, playback.updatedAt);
    }
    const pulled: WfNewOrchClientPlaybackRow[] = [];
    let serverTime: string | null = null;
    for (let page = 1; ; page += 1) {
      const result = await wfNewApi.getOrchClientPlayback(page, document.pulledAt).catch(() => null);
      if (!result) {
        serverTime = null;
        break;
      }
      serverTime = result.serverTime;
      pulled.push(...result.items);
      if (page * result.perPage >= result.total || result.items.length === 0) break;
    }
    let needsPush = false;
    await this.commit((current) => {
      pushedFrom.forEach((stamp, taskId) => {
        const entry = current.tasks[taskId];
        if (entry && entry.updatedAt === stamp) current.tasks[taskId] = { ...entry, synced: true };
      });
      pulled.forEach((row) => {
        const local = current.tasks[row.clientTaskId];
        if (!local || newer(row.clientUpdatedAt, local.updatedAt)) {
          current.tasks[row.clientTaskId] = { resume: row.resume, history: row.history, updatedAt: row.clientUpdatedAt, synced: true };
        } else if (newer(local.updatedAt, row.clientUpdatedAt)) {
          current.tasks[row.clientTaskId] = { ...local, synced: false };
          needsPush = true;
        }
      });
      if (serverTime) current.pulledAt = serverTime;
    }, false);
    if (needsPush) this.schedulePush();
  }
}

export const wordNewOrchPlaybackStore = new WordNewOrchPlaybackStoreService();
