import { CLOUD_CLIPBOARD, type CloudClipboardAction, type CloudClipboardEntry, type CloudClipboardSnapshot } from '../../core/contracts/CloudClipboardContract';
import { LaravelCloudClipboardAPI } from '../../core/integrations/laravel/LaravelCloudClipboardAPI';
import { LaravelMercureConnection } from '../../core/integrations/laravel/LaravelMercureConnection';
import { SHARED_BASE_URL_CHANGED_EVENT } from '../../core/integrations/laravel/transport/BaseAPI';

export interface CloudClipboardState {
  snapshot: CloudClipboardSnapshot | null;
  draft: string;
  dirty: boolean;
  conflict: boolean;
  locked: boolean;
  busy: boolean;
  loading: boolean;
  live: boolean;
  error: string | null;
}

const initialState: CloudClipboardState = {
  snapshot: null, draft: '', dirty: false, conflict: false, locked: false,
  busy: false, loading: true, live: false, error: null,
};

export class CloudClipboardModel {
  readonly api: LaravelCloudClipboardAPI;
  private state: CloudClipboardState = { ...initialState };
  private listeners = new Set<() => void>();
  private connection = new LaravelMercureConnection();
  private active = false;
  private generation = 0;
  private page = 1;
  private baseEntry: CloudClipboardEntry | null = null;
  private refreshing = false;
  private refreshFinished: Promise<void> = Promise.resolve();
  private connecting = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;
  private topic = '';

  constructor(readonly namespace: string) {
    this.api = new LaravelCloudClipboardAPI(namespace);
  }

  getState = (): CloudClipboardState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private patch(update: Partial<CloudClipboardState>): void {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.generation += 1;
    void this.refresh(true);
    this.pollTimer = setInterval(() => void this.refresh(), CLOUD_CLIPBOARD.fallback_poll_ms);
    window.addEventListener('online', this.onWake);
    window.addEventListener('focus', this.onWake);
    window.addEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.onEndpoint);
  }

  stop(): void {
    this.active = false;
    this.generation += 1;
    this.connection.close();
    this.connecting = false;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.renewTimer) clearTimeout(this.renewTimer);
    window.removeEventListener('online', this.onWake);
    window.removeEventListener('focus', this.onWake);
    window.removeEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.onEndpoint);
  }

  private onWake = (): void => { void this.refresh(true); };
  private onEndpoint = (): void => {
    this.generation += 1;
    this.topic = '';
    this.connection.close();
    this.connecting = false;
    this.patch({ snapshot: null, live: false, conflict: this.state.dirty });
    void this.refresh(true);
  };

  private fail(error: unknown): void {
    const status = (error as { status?: number })?.status;
    if (status === 403) {
      this.connection.close();
      this.connecting = false;
      this.topic = '';
      this.patch({ locked: true, snapshot: null, live: false, loading: false, error: 'passwordRequired' });
    } else {
      this.patch({ loading: false, error: status === 409 ? 'conflict' : status === 422 ? 'invalidInput' : 'requestFailed',
        ...(status === 409 ? { conflict: true } : {}) });
    }
  }

  async refresh(force = false): Promise<void> {
    const generation = this.generation;
    let payload: Awaited<ReturnType<LaravelCloudClipboardAPI['snapshot']>>;
    let finish: () => void = () => {};
    while (this.refreshing) await this.refreshFinished;
    if (!this.active || generation !== this.generation || this.state.busy || this.state.locked) return;
    this.refreshing = true;
    this.refreshFinished = new Promise<void>((resolve) => { finish = resolve; });
    try {
      payload = await this.api.snapshot(this.page, force ? undefined : this.state.snapshot?.revision);
      if (!this.active || generation !== this.generation || this.state.busy) return;
      if ('unchanged' in payload) {
        if (this.state.dirty && !this.state.conflict) this.scheduleSave();
        return;
      }
      if (this.state.dirty && this.baseEntry
        && (payload.current.id !== this.baseEntry.id || payload.current.revision !== this.baseEntry.revision)) {
        this.patch({ conflict: true, error: 'conflict' });
      }
      if (!this.state.dirty) {
        this.baseEntry = payload.current;
        this.patch({ draft: payload.current.text, conflict: false });
      }
      this.patch({ snapshot: payload, loading: false, locked: false,
        error: this.state.conflict ? 'conflict' : this.state.error === 'requestFailed' ? null : this.state.error });
      this.connect(payload);
      if (this.state.dirty && !this.state.conflict) this.scheduleSave();
    } catch (error) {
      if (this.active && generation === this.generation) this.fail(error);
    } finally {
      this.refreshing = false;
      finish();
    }
  }

  private connect(snapshot: CloudClipboardSnapshot, force = false): void {
    const topic = snapshot.topics.join('|');
    const generation = this.generation;
    if (!force && topic === this.topic && (this.connecting || this.connection.isConnected() || this.reconnectTimer)) return;
    this.topic = topic;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.renewTimer) clearTimeout(this.renewTimer);
    this.reconnectTimer = null;
    this.connecting = true;
    this.connection.connect(snapshot, {
      authorize: async () => {
        const authorization = await this.api.authorize();
        if (this.active && generation === this.generation) {
          this.renewTimer = setTimeout(() => {
            if (this.state.snapshot) this.connect(this.state.snapshot, true);
          }, Math.max(1000, (authorization.token_ttl_seconds - 10) * 1000));
        }
        return authorization;
      },
      onSubscribed: () => {
        if (!this.active || generation !== this.generation) return;
        this.connecting = false;
        this.patch({ live: true });
        void this.refresh(true);
      },
      onEvent: () => { void this.refresh(true); },
      onClose: (error) => {
        if (!this.active || generation !== this.generation) return;
        this.connecting = false;
        this.patch({ live: false });
        if ((error as { status?: number })?.status === 403) {
          this.fail(error);
          return;
        }
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (this.active && this.state.snapshot && !this.state.locked) this.connect(this.state.snapshot, true);
        }, CLOUD_CLIPBOARD.reconnect_ms);
      },
    });
  }

  unlock(password: string): void {
    this.api.setPassword(password);
    this.patch({ locked: false, error: null, loading: true });
    void this.refresh(true);
  }

  edit(text: string): void {
    this.patch({ draft: text, dirty: true });
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), CLOUD_CLIPBOARD.autosave_ms);
  }

  async save(): Promise<boolean> {
    const entry = this.baseEntry;
    const text = this.state.draft;
    const generation = this.generation;
    if (this.state.busy || this.refreshing || !entry || this.state.locked || this.state.conflict) return false;
    if (!this.state.dirty) return true;
    this.patch({ busy: true, error: null });
    try {
      const result = await this.api.mutate('text', { entry_id: entry.id, expected_revision: entry.revision, text });
      if (!this.active || generation !== this.generation) return false;
      this.baseEntry = { ...entry, text, revision: entry.revision + (result.changed ? 1 : 0) };
      this.patch({ dirty: this.state.draft !== text });
      return true;
    } catch (error) {
      if (this.active && generation === this.generation) this.fail(error);
      return false;
    } finally {
      this.patch({ busy: false });
      if (this.active && generation === this.generation) await this.refresh(true);
    }
  }

  async action(action: CloudClipboardAction, entry: CloudClipboardEntry, extra: Record<string, unknown> = {}, files?: File[]): Promise<boolean> {
    const snapshot = this.state.snapshot;
    const generation = this.generation;
    const payload: Record<string, unknown> = {
      entry_id: entry.id, expected_revision: entry.revision,
      expected_current_entry_id: snapshot?.current.id, expected_room_revision: snapshot?.revision, ...extra,
    };
    const form = new FormData();
    let failure: unknown = null;
    if (!snapshot || this.state.busy || this.state.locked) return false;
    this.patch({ busy: true, error: null });
    if (files) {
      Object.entries(payload).forEach(([key, value]) => form.append(key, String(value)));
      files.forEach((file) => form.append('files[]', file));
    }
    try {
      await this.api.mutate(action, files ? form : payload);
      if (!this.active || generation !== this.generation) return false;
      if (action === 'password') this.api.setPassword(String(extra.new_password ?? ''));
      if (entry.id === this.baseEntry?.id || action === 'new' || action === 'restore') {
        this.patch({ dirty: false, conflict: false });
      }
      return true;
    } catch (error) {
      failure = error;
      return false;
    } finally {
      this.patch({ busy: false });
      if (this.active && generation === this.generation) await this.refresh(true);
      if (failure && this.active && generation === this.generation) {
        if ((failure as { status?: number })?.status === 409 && !this.state.dirty) {
          this.patch({ error: 'historyConflict' });
        } else {
          this.fail(failure);
        }
      }
    }
  }

  async preserveDraft(): Promise<void> {
    const text = this.state.draft;
    const current = this.state.snapshot?.current;
    if (!current || !(await this.action('new', current))) return;
    this.edit(text);
    await this.save();
  }

  discardDraft(): void {
    const entry = this.state.snapshot?.current;
    if (!entry) return;
    this.baseEntry = entry;
    this.patch({ draft: entry.text, dirty: false, conflict: false, error: null });
  }

  setPage(page: number): void {
    this.page = Math.max(1, page);
    void this.refresh(true);
  }
}
