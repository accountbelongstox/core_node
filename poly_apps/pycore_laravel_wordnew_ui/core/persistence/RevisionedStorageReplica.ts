import { StorageManager } from './StorageManager';
import type { StorageKey } from './StorageKey';

export interface RevisionedStorageDocument {
  exists: boolean;
  schema_version: number;
  revision: number;
  updated_at: string;
  values: Record<string, string>;
  accepted?: boolean;
  conflict?: boolean;
}

export interface RevisionedStorageWrite {
  values: Record<string, string>;
  base_revision: number;
  initialize_only: boolean;
}

export interface RevisionedStorageReplicaOptions {
  keys: readonly StorageKey[];
  bootstrapLocalKeys?: readonly StorageKey[];
  pendingRevisionKey: StorageKey;
  readRemote: () => Promise<RevisionedStorageDocument>;
  writeRemote: (request: RevisionedStorageWrite) => Promise<RevisionedStorageDocument>;
}

export class RevisionedStorageReplica {
  private readonly keys: readonly StorageKey[];
  private readonly bootstrapLocalKeySet: ReadonlySet<StorageKey>;
  private readonly pendingRevisionKey: StorageKey;
  private readonly readRemote: () => Promise<RevisionedStorageDocument>;
  private readonly writeRemote: (
    request: RevisionedStorageWrite,
  ) => Promise<RevisionedStorageDocument>;
  private revision = 0;
  private applyingRemote = false;
  private reconciliationFlight: Promise<boolean> | null = null;
  private operationTail: Promise<void> = Promise.resolve();

  constructor(options: RevisionedStorageReplicaOptions) {
    this.keys = options.keys;
    this.bootstrapLocalKeySet = new Set(options.bootstrapLocalKeys || []);
    this.pendingRevisionKey = options.pendingRevisionKey;
    this.readRemote = options.readRemote;
    this.writeRemote = options.writeRemote;
  }

  isApplyingRemote(): boolean {
    return this.applyingRemote;
  }

  markLocalChange(): void {
    if (this.applyingRemote || this.revision <= 0) return;
    StorageManager.set(this.pendingRevisionKey, { base_revision: this.revision });
  }

  discardPendingLocal(): void {
    StorageManager.remove(this.pendingRevisionKey);
  }

  async reconcile(): Promise<boolean> {
    if (this.reconciliationFlight) return this.reconciliationFlight;
    this.reconciliationFlight = this.enqueue(() => this.performReconcile()).finally(() => {
      this.reconciliationFlight = null;
    });
    return this.reconciliationFlight;
  }

  async push(): Promise<boolean> {
    return this.enqueue(() => this.performPush());
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operationTail.then(operation, operation);
    this.operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async performPush(): Promise<boolean> {
    if (this.applyingRemote) return false;
    if (this.revision <= 0) return this.performReconcile();
    const values = this.captureLocal();
    const saved = await this.writeRemote({
      values,
      base_revision: this.revision,
      initialize_only: false,
    });
    if (saved.conflict) return this.applyRemote(saved);
    this.acceptWrite(saved, values);
    return false;
  }

  private acceptWrite(
    state: RevisionedStorageDocument,
    writtenValues: Record<string, string>,
  ): void {
    this.revision = Math.max(0, Number(state.revision || this.revision));
    if (this.localMatches(writtenValues)) {
      this.discardPendingLocal();
      return;
    }
    this.markLocalChange();
  }

  private pendingBaseRevision(): number | null {
    const pending = StorageManager.get<{ base_revision?: unknown } | null>(
      this.pendingRevisionKey,
      null,
    );
    const revision = Number(pending?.base_revision);
    return Number.isFinite(revision) && revision > 0 ? revision : null;
  }

  private captureLocal(): Record<string, string> {
    const values: Record<string, string> = {};
    this.keys.forEach((key) => {
      const rawValue = StorageManager.getRaw(key);
      if (rawValue !== null) values[key] = rawValue;
    });
    return values;
  }

  private captureBootstrapValues(
    remoteValues: Record<string, string>,
  ): Record<string, string> {
    const values: Record<string, string> = {};
    this.bootstrapLocalKeySet.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(remoteValues, key)) return;
      const rawValue = StorageManager.getRaw(key);
      if (rawValue !== null) values[key] = rawValue;
    });
    return values;
  }

  private localMatches(remoteValues: Record<string, string>): boolean {
    return this.keys.every((key) => (
      (StorageManager.getRaw(key) ?? null) === (remoteValues[key] ?? null)
    ));
  }

  private applyRemote(state: RevisionedStorageDocument): boolean {
    const remoteValues = state.values && typeof state.values === 'object' ? state.values : {};
    this.revision = Math.max(0, Number(state.revision || 0));
    this.discardPendingLocal();
    if (this.localMatches(remoteValues)) return false;
    this.applyingRemote = true;
    this.keys.forEach((key) => {
      StorageManager.setRaw(key, remoteValues[key] ?? null);
    });
    this.applyingRemote = false;
    return true;
  }

  private async performReconcile(): Promise<boolean> {
    const remote = await this.readRemote();
    if (remote.exists) {
      const pendingRevision = this.pendingBaseRevision();
      if (pendingRevision === Number(remote.revision || 0)) {
        const values = this.captureLocal();
        const recovered = await this.writeRemote({
          values,
          base_revision: pendingRevision,
          initialize_only: false,
        });
        if (recovered.conflict) return this.applyRemote(recovered);
        this.acceptWrite(recovered, values);
        return false;
      }
      const remoteValues = remote.values && typeof remote.values === 'object'
        ? remote.values
        : {};
      const bootstrapValues = this.captureBootstrapValues(remoteValues);
      if (Object.keys(bootstrapValues).length > 0) {
        const bootstrapped = await this.writeRemote({
          values: { ...remoteValues, ...bootstrapValues },
          base_revision: Number(remote.revision || 0),
          initialize_only: false,
        });
        return this.applyRemote(bootstrapped);
      }
      return this.applyRemote(remote);
    }
    this.revision = 0;
    const values = this.captureLocal();
    const initialized = await this.writeRemote({
      values,
      base_revision: 0,
      initialize_only: true,
    });
    if (initialized.conflict) return this.applyRemote(initialized);
    this.acceptWrite(initialized, values);
    return false;
  }
}
