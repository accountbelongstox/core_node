import { CLOUD_CLIPBOARD, type CloudClipboardAction, type CloudClipboardEntry, type CloudClipboardSnapshot } from '../../core/contracts/CloudClipboardContract';
import { LaravelCloudClipboardAPI, type ClipboardMutation } from '../../core/integrations/laravel/LaravelCloudClipboardAPI';
import { LaravelMercureConnection } from '../../core/integrations/laravel/LaravelMercureConnection';
import { SHARED_BASE_URL_CHANGED_EVENT } from '../../core/integrations/laravel/transport/BaseAPI';
import { resolveLaravelBaseURL } from '../../core/integrations/laravel/LaravelRequest';

interface EntryDraft {
  text: string;
  baseText: string;
  revision: number;
  sequence: number;
  composing: boolean;
}

export interface CloudClipboardState {
  snapshot: CloudClipboardSnapshot | null;
  entries: CloudClipboardEntry[];
  pendingIds: string[];
  busyIds: string[];
  adding: boolean;
  focusEntryId: string | null;
  locked: boolean;
  loading: boolean;
  live: boolean;
  error: string | null;
}

const initialState: CloudClipboardState = {
  snapshot: null, entries: [], pendingIds: [], busyIds: [], adding: false,
  focusEntryId: null, locked: false, loading: true, live: false, error: null,
};

export class CloudClipboardModel {
  readonly api: LaravelCloudClipboardAPI;
  private state: CloudClipboardState = { ...initialState };
  private listeners = new Set<() => void>();
  private cloud = new Map<string, CloudClipboardEntry>();
  private drafts = new Map<string, EntryDraft>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private saves = new Map<string, Promise<boolean>>();
  private busy = new Set<string>();
  private focused = new Set<string>();
  private recovering = new Set<string>();
  private order: string[] = [];
  private connection = new LaravelMercureConnection();
  private active = false;
  private generation = 0;
  private page = 1;
  private knownRevision = 0;
  private refreshTask: Promise<void> | null = null;
  private refreshRequested = false;
  private connecting = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private renewTimer: ReturnType<typeof setTimeout> | null = null;
  private topic = '';
  private endpoint = '';
  private endpointPaused = false;

  constructor(readonly namespace: string) {
    this.api = new LaravelCloudClipboardAPI(namespace);
    this.endpoint = resolveLaravelBaseURL();
  }

  getState = (): CloudClipboardState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(update: Partial<CloudClipboardState> = {}): void {
    const previous = new Map(this.state.entries.map((entry) => [entry.id, entry]));
    const entries: CloudClipboardEntry[] = [];
    let cloud: CloudClipboardEntry | undefined;
    let draft: EntryDraft | undefined;
    let old: CloudClipboardEntry | undefined;
    let text = '';
    for (const id of this.order) {
      cloud = this.cloud.get(id);
      if (!cloud) continue;
      draft = this.drafts.get(id);
      text = draft?.text ?? cloud.text;
      old = previous.get(id);
      entries.push(old && old.text === text && old.revision === cloud.revision && old.files === cloud.files
        && old.updated_at === cloud.updated_at ? old : { ...cloud, text });
    }
    this.state = { ...this.state, ...update, entries: (update.locked ?? this.state.locked) ? [] : entries,
      pendingIds: [...this.drafts.keys()], busyIds: [...this.busy] };
    this.listeners.forEach((listener) => listener());
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.generation += 1;
    void this.refresh(true);
    this.pollTimer = setInterval(() => {
      void this.refresh();
      this.schedulePending();
    }, CLOUD_CLIPBOARD.fallback_poll_ms);
    window.addEventListener('online', this.onWake);
    window.addEventListener('focus', this.onWake);
    window.addEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.onEndpoint);
  }

  stop(): void {
    if (!this.state.locked && !this.endpointPaused) {
      this.drafts.forEach((draft, id) => {
        if (!this.saves.has(id) && !draft.composing) {
          void this.api.mutate('text', { entry_id: id, expected_revision: draft.revision,
            text: draft.text, base_text: draft.baseText, inline: true }).catch(() => {});
        }
      });
    }
    this.active = false;
    this.generation += 1;
    this.connection.close();
    this.connecting = false;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.renewTimer) clearTimeout(this.renewTimer);
    window.removeEventListener('online', this.onWake);
    window.removeEventListener('focus', this.onWake);
    window.removeEventListener(SHARED_BASE_URL_CHANGED_EVENT, this.onEndpoint);
  }

  private onWake = (): void => { void this.refresh(true); this.schedulePending(); };
  private onEndpoint = (): void => {
    const endpoint = resolveLaravelBaseURL();
    if (this.drafts.size && endpoint !== this.endpoint) {
      this.endpointPaused = true;
      this.publish({ error: 'endpointChanged' });
      return;
    }
    this.endpointPaused = false;
    if (endpoint === this.endpoint) {
      this.publish({ error: null });
      void this.refresh(true);
      this.schedulePending();
      return;
    }
    this.endpoint = endpoint;
    this.generation += 1;
    this.topic = '';
    this.knownRevision = 0;
    this.cloud.clear();
    this.order = [];
    this.connection.close();
    this.connecting = false;
    this.publish({ snapshot: null, live: false, loading: true });
    void this.refresh(true);
  };

  private fail(error: unknown): void {
    const status = (error as { status?: number })?.status;
    const code = (error as { code?: string })?.code;
    if (status === 403) {
      this.connection.close();
      this.connecting = false;
      this.topic = '';
      this.publish({ locked: true, snapshot: null, live: false, loading: false, error: 'passwordRequired' });
      return;
    }
    this.publish({ loading: false, error: code === 'CLOUD_CLIPBOARD_NOT_INITIALIZED' ? 'initializationRequired'
      : status === 422 ? 'invalidInput' : 'requestFailed' });
  }

  private accept(entry: CloudClipboardEntry): void {
    const previous = this.cloud.get(entry.id);
    if (!previous || previous.revision < entry.revision || (previous.revision === entry.revision && previous.text !== entry.text)) {
      this.cloud.set(entry.id, entry);
    }
  }

  private applyMutation(result: ClipboardMutation): void {
    const authoritative = result.revision >= this.knownRevision;
    const currentId = authoritative ? result.current_entry_id : this.state.snapshot?.current.id;
    this.knownRevision = Math.max(this.knownRevision, result.revision);
    if (result.removed_entry_id) {
      this.cloud.delete(result.removed_entry_id);
      this.drafts.delete(result.removed_entry_id);
      this.order = this.order.filter((id) => id !== result.removed_entry_id);
    }
    if (result.entry) {
      this.accept(result.entry);
      if (!this.order.includes(result.entry.id)) this.order.unshift(result.entry.id);
    }
    if (currentId && this.cloud.has(currentId)) {
      this.order = [currentId, ...this.order.filter((id) => id !== currentId)];
      if (this.state.snapshot) this.state = { ...this.state, snapshot: {
        ...this.state.snapshot, current: this.cloud.get(currentId)!,
      } };
    }
    this.publish({ error: null });
  }

  async refresh(force = false): Promise<void> {
    const generation = this.generation;
    if (!this.active || this.state.locked || this.endpointPaused) return;
    if (this.refreshTask) {
      this.refreshRequested ||= force;
      await this.refreshTask;
      return;
    }
    this.refreshTask = this.readSnapshot(force, generation);
    try {
      await this.refreshTask;
    } finally {
      this.refreshTask = null;
      if (this.refreshRequested && this.active && generation === this.generation) {
        this.refreshRequested = false;
        await this.refresh(true);
      }
    }
  }

  private async readSnapshot(force: boolean, generation: number): Promise<void> {
    const tracked = [...new Set([...this.drafts.keys(), ...this.focused])].slice(0, 100);
    let payload: Awaited<ReturnType<LaravelCloudClipboardAPI['snapshot']>>;
    let incoming: CloudClipboardEntry[];
    let ids: Set<string>;
    try {
      payload = await this.api.snapshot(this.page, force ? undefined : this.state.snapshot?.revision, tracked);
      if (!this.active || generation !== this.generation) return;
      if ('unchanged' in payload) return;
      if (payload.revision < this.knownRevision) {
        this.refreshRequested = true;
        return;
      }
      incoming = [payload.current, ...payload.history];
      ids = new Set(incoming.map((entry) => entry.id));
      incoming.forEach((entry) => this.accept(entry));
      this.order = [...ids, ...this.order.filter((id) => this.drafts.has(id) && !ids.has(id))];
      this.knownRevision = payload.revision;
      this.publish({ snapshot: payload, loading: false, locked: false, error: null });
      this.connect(payload);
      tracked.forEach((id) => {
        if (!ids.has(id) && this.drafts.has(id) && !this.saves.has(id)) void this.recoverDraft(id);
      });
      this.schedulePending();
    } catch (error) {
      if (this.active && generation === this.generation) this.fail(error);
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
        if (this.active && generation === this.generation) this.renewTimer = setTimeout(() => {
          if (this.state.snapshot) this.connect(this.state.snapshot, true);
        }, Math.max(1000, (authorization.token_ttl_seconds - 10) * 1000));
        return authorization;
      },
      onSubscribed: () => {
        if (!this.active || generation !== this.generation) return;
        this.connecting = false;
        this.publish({ live: true });
        void this.refresh(true);
      },
      onEvent: () => { void this.refresh(true); },
      onClose: (error) => {
        if (!this.active || generation !== this.generation) return;
        this.connecting = false;
        this.publish({ live: false });
        if ((error as { status?: number })?.status === 403) { this.fail(error); return; }
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          if (this.active && this.state.snapshot && !this.state.locked) this.connect(this.state.snapshot, true);
        }, CLOUD_CLIPBOARD.reconnect_ms);
      },
    });
  }

  unlock(password: string): void {
    this.api.setPassword(password);
    this.publish({ locked: false, error: null, loading: !this.state.snapshot });
    void this.refresh(true);
  }

  async generateNamespace(): Promise<string> {
    const result = await this.api.generate();
    return result.namespace;
  }

  focus(id: string, focused: boolean): void {
    if (focused) this.focused.add(id);
    else this.focused.delete(id);
  }

  compose(id: string, composing: boolean): void {
    const entry = this.cloud.get(id);
    const draft = this.drafts.get(id);
    if (!entry) return;
    this.drafts.set(id, { text: entry.text, baseText: entry.text, revision: entry.revision, sequence: 0,
      ...draft, composing });
    if (!composing) this.schedule(id);
  }

  edit(id: string, text: string): void {
    const entry = this.cloud.get(id);
    const draft = this.drafts.get(id);
    if (!entry || this.state.locked) return;
    this.drafts.set(id, { text, baseText: draft?.baseText ?? entry.text,
      revision: draft?.revision ?? entry.revision, sequence: (draft?.sequence ?? 0) + 1,
      composing: draft?.composing ?? false });
    this.publish();
    this.schedule(id);
  }

  private schedule(id: string, delay = CLOUD_CLIPBOARD.autosave_ms): void {
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    if (!this.active || this.state.locked || this.endpointPaused || this.drafts.get(id)?.composing) return;
    this.timers.set(id, setTimeout(() => {
      this.timers.delete(id);
      void this.flush(id);
    }, delay));
  }

  private schedulePending(): void {
    this.drafts.forEach((draft, id) => {
      if (!draft.composing && !this.timers.has(id) && !this.saves.has(id) && !this.busy.has(id)) this.schedule(id);
    });
  }

  async flush(id: string): Promise<boolean> {
    const existing = this.saves.get(id);
    let task: Promise<boolean>;
    if (existing) {
      if (!(await existing)) return false;
      return this.flush(id);
    }
    if (!this.drafts.has(id)) return true;
    if (!this.active || this.state.locked || this.endpointPaused || this.busy.has(id) || this.drafts.get(id)?.composing) return false;
    task = this.saveEntry(id);
    this.saves.set(id, task);
    try {
      return await task;
    } finally {
      this.saves.delete(id);
      this.schedulePending();
    }
  }

  private async saveEntry(id: string): Promise<boolean> {
    const draft = { ...this.drafts.get(id)! };
    const generation = this.generation;
    let result: ClipboardMutation;
    let latest: EntryDraft | undefined;
    this.busy.add(id);
    this.publish();
    try {
      result = await this.api.mutate('text', { entry_id: id, expected_revision: draft.revision,
        base_text: draft.baseText, text: draft.text, inline: true });
      if (!this.active || generation !== this.generation) return false;
      this.applyMutation(result);
      latest = this.drafts.get(id);
      if (latest?.sequence === draft.sequence && !latest.composing) this.drafts.delete(id);
      else if (latest) this.drafts.set(id, { ...latest, baseText: draft.text,
        revision: result.entry?.revision ?? draft.revision + (result.changed ? 1 : 0) });
      this.publish();
      return true;
    } catch (error) {
      if (this.active && generation === this.generation) {
        if ((error as { status?: number })?.status === 404) void this.recoverDraft(id);
        else { this.fail(error); this.schedule(id, CLOUD_CLIPBOARD.fallback_poll_ms); }
      }
      return false;
    } finally {
      this.busy.delete(id);
      this.publish();
      if (this.active && generation === this.generation) void this.refresh(true);
    }
  }

  async action(action: CloudClipboardAction, id: string, extra: Record<string, unknown> = {}, files?: File[]): Promise<ClipboardMutation | null> {
    const generation = this.generation;
    const actionKey = action === 'new' ? 'new' : id;
    let entry: CloudClipboardEntry | undefined;
    let payload: Record<string, unknown>;
    let form: FormData;
    let result: ClipboardMutation;
    if (!this.state.snapshot || this.state.locked || this.endpointPaused
      || (this.busy.has(actionKey) && !this.saves.has(id))) return null;
    if (action !== 'new' && !(await this.flush(id))) return null;
    this.busy.add(actionKey);
    this.publish();
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        entry = this.cloud.get(id);
        if (!entry) return null;
        payload = { entry_id: id, expected_revision: entry.revision, inline: true,
          expected_current_entry_id: this.state.snapshot?.current.id,
          expected_room_revision: this.state.snapshot?.revision, ...extra };
        form = new FormData();
        if (files) {
          Object.entries(payload).forEach(([key, value]) => form.append(key, String(value === true ? 1 : value)));
          files.forEach((file) => form.append('files[]', file));
        }
        try {
          result = await this.api.mutate(action, files ? form : payload);
          if (!this.active || generation !== this.generation) return null;
          if (action === 'password') this.api.setPassword(String(extra.new_password ?? ''));
          this.applyMutation(result);
          return result;
        } catch (error) {
          if ((error as { status?: number })?.status === 409 && attempt < 2) { await this.refresh(true); continue; }
          if ((error as { status?: number })?.status === 404 && action === 'delete') {
            this.cloud.delete(id);
            this.drafts.delete(id);
            this.order = this.order.filter((value) => value !== id);
            this.publish();
            return { changed: false, revision: this.knownRevision, removed_entry_id: id };
          }
          throw error;
        }
      }
      return null;
    } catch (error) {
      if (this.active && generation === this.generation) this.fail(error);
      return null;
    } finally {
      this.busy.delete(actionKey);
      this.publish();
      if (this.active && generation === this.generation) void this.refresh(true);
      this.schedulePending();
    }
  }

  async addEntry(text = '', focus = true): Promise<CloudClipboardEntry | null> {
    const id = this.state.snapshot?.current.id;
    let result: ClipboardMutation | null;
    if (!id || this.state.adding) return null;
    this.publish({ adding: true });
    try {
      result = await this.action('new', id, { text });
      if (result?.entry && focus) this.publish({ focusEntryId: result.entry.id });
      return result?.entry ?? null;
    } finally {
      this.publish({ adding: false });
    }
  }

  private async recoverDraft(id: string): Promise<void> {
    const draft = this.drafts.get(id);
    let entry: CloudClipboardEntry | null;
    let latest: EntryDraft | undefined;
    if (!draft || draft.composing || this.recovering.has(id)) return;
    this.recovering.add(id);
    try {
      entry = await this.addEntry(draft.text, false);
      if (!entry) return;
      latest = this.drafts.get(id);
      this.drafts.delete(id);
      this.cloud.delete(id);
      this.order = this.order.filter((value) => value !== id);
      if (latest && latest.text !== draft.text) this.edit(entry.id, latest.text);
      this.publish();
    } finally {
      this.recovering.delete(id);
    }
  }

  loadMore(): void {
    this.page += 1;
    void this.refresh(true);
  }
}
