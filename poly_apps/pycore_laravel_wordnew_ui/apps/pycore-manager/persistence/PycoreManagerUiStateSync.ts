import {
  getPycoreHealth,
  onHttpStatus,
  pycoreEventBus,
  PYCORE_BROWSER_EVENTS,
  PYCORE_HEALTH_EVENT,
  PYCORE_HTTP_ROUTES,
  requestPycoreHttp,
} from '../../../core/api-libs/pycore';
import {
  RevisionedStorageReplica,
  STORAGE_MANAGER_CHANGED_EVENT,
  type RevisionedStorageDocument,
  type RevisionedStorageWrite,
  type StorageManagerChangedDetail,
} from '../../../core/persistence';
import {
  PYCORE_MANAGER_SYNCED_STORAGE_KEYS,
  PycoreManagerStorageKeys,
} from './PycoreManagerStorageKeys';

const PUSH_DEBOUNCE_MS = 500;
const SYNCED_KEY_SET = new Set<string>(PYCORE_MANAGER_SYNCED_STORAGE_KEYS);

class PycoreManagerUiStateSync {
  private readonly replica = new RevisionedStorageReplica({
    keys: PYCORE_MANAGER_SYNCED_STORAGE_KEYS,
    pendingRevisionKey: PycoreManagerStorageKeys.PYCORE_UI_STATE_PENDING_REVISION,
    readRemote: () => this.readBackend(),
    writeRemote: (request) => this.writeBackend(request),
  });
  private started = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Array<() => void> = [];

  async initialize(): Promise<void> {
    try {
      await this.replica.reconcile();
    } catch {
      // Offline startup keeps the browser copy until a later authoritative reconnect.
    }
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const storageHandler = (event: Event) => {
      const detail = (event as CustomEvent<StorageManagerChangedDetail>).detail;
      if (!detail || !SYNCED_KEY_SET.has(String(detail.key))) return;
      this.replica.markLocalChange();
      this.schedulePush();
    };
    const nativeStorageHandler = (event: StorageEvent) => {
      if (!event.key || !SYNCED_KEY_SET.has(event.key)) return;
      this.replica.markLocalChange();
      this.schedulePush();
    };
    const healthHandler = () => {
      if (getPycoreHealth().up === true) {
        this.reconcileAndReload();
        return;
      }
      this.replica.discardPendingLocal();
    };
    window.addEventListener(STORAGE_MANAGER_CHANGED_EVENT, storageHandler);
    window.addEventListener('storage', nativeStorageHandler);
    window.addEventListener(PYCORE_HEALTH_EVENT, healthHandler);
    this.unsubscribers = [
      () => window.removeEventListener(STORAGE_MANAGER_CHANGED_EVENT, storageHandler),
      () => window.removeEventListener('storage', nativeStorageHandler),
      () => window.removeEventListener(PYCORE_HEALTH_EVENT, healthHandler),
      onHttpStatus((connected) => {
        if (connected) {
          this.reconcileAndReload();
          return;
        }
        this.replica.discardPendingLocal();
      }),
      pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => {
        this.replica.discardPendingLocal();
        this.reconcileAndReload();
      }),
    ];
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.pushTimer !== null) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
  }

  private schedulePush(): void {
    if (this.replica.isApplyingRemote()) return;
    if (this.pushTimer !== null) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.replica.push()
        .then((changed) => {
          if (changed) window.location.reload();
        })
        .catch(() => {
          this.replica.discardPendingLocal();
          // Offline writes remain in the browser copy until reconnect.
        });
    }, PUSH_DEBOUNCE_MS);
  }

  private async readBackend(): Promise<RevisionedStorageDocument> {
    const response = await requestPycoreHttp(PYCORE_HTTP_ROUTES.pycoreManagerStateGet, {});
    if (!response?.success || !response.data) {
      throw new Error(response?.error || 'PYCORE_MANAGER_UI_STATE_UNAVAILABLE');
    }
    return response.data as RevisionedStorageDocument;
  }

  private async writeBackend(request: RevisionedStorageWrite): Promise<RevisionedStorageDocument> {
    const response = await requestPycoreHttp(PYCORE_HTTP_ROUTES.pycoreManagerStatePut, request);
    if (!response?.success || !response.data) {
      throw new Error(response?.error || 'PYCORE_MANAGER_UI_STATE_SAVE_FAILED');
    }
    return response.data as RevisionedStorageDocument;
  }

  private reconcileAndReload(): void {
    void this.replica.reconcile()
      .then((changed) => {
        if (changed) window.location.reload();
      })
      .catch(() => {
        // The browser copy remains available while the backend is offline.
      });
  }
}

export const pycoreManagerUiStateSync = new PycoreManagerUiStateSync();
