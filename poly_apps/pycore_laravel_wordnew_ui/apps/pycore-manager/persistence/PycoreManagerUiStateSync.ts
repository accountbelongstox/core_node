import {
  getPycoreHealth,
  onHttpStatus,
  pycoreApi,
  pycoreEventBus,
  PYCORE_BROWSER_EVENTS,
  PYCORE_HEALTH_EVENT,
  PYCORE_HTTP_ROUTES,
  requestPycoreHttp,
} from '../../../core/integrations/pycore';
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
  PycoreManagerUiStorageKeys,
} from './PycoreManagerStorageKeys';

const PUSH_DEBOUNCE_MS = 500;
const SYNCED_KEY_SET = new Set<string>(PYCORE_MANAGER_SYNCED_STORAGE_KEYS);

class PycoreManagerUiStateSync {
  private readonly replica = new RevisionedStorageReplica({
    keys: PYCORE_MANAGER_SYNCED_STORAGE_KEYS,
    localAuthorityKeys: [PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES],
    pendingRevisionKey: PycoreManagerStorageKeys.PYCORE_UI_STATE_PENDING_REVISION,
    readRemote: () => this.readBackend(),
    writeRemote: (request) => this.writeBackend(request),
  });
  private started = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Array<() => void> = [];
  private terminalScheduleChangeSerial = 0;
  private terminalScheduleSyncSerial = 0;

  async initialize(): Promise<void> {
    try {
      await this.replica.reconcile();
      const result = await this.syncTerminalScheduleRuntime();
      if (result?.success) {
        this.terminalScheduleSyncSerial = this.terminalScheduleChangeSerial;
      }
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
      if (detail.key === PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES) {
        this.terminalScheduleChangeSerial += 1;
      }
      this.replica.markLocalChange();
      this.schedulePush();
    };
    const nativeStorageHandler = (event: StorageEvent) => {
      if (!event.key || !SYNCED_KEY_SET.has(event.key)) return;
      if (event.key === PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES) {
        this.terminalScheduleChangeSerial += 1;
      }
      this.replica.markLocalChange();
      this.schedulePush();
    };
    const healthHandler = () => {
      if (getPycoreHealth().up === true) {
        this.reconcileAndReload();
      }
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
        }
      }),
      pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => {
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

  async pushTerminalScheduleJson(): Promise<void> {
    this.cancelScheduledPush();
    await this.replica.push();
  }

  async synchronizeTerminalSchedules(terminalNumber = 0) {
    this.cancelScheduledPush();
    await this.replica.push();
    const result = await this.syncTerminalScheduleRuntime(terminalNumber);
    if (result?.success) {
      this.terminalScheduleSyncSerial = this.terminalScheduleChangeSerial;
    }
    return result;
  }

  async clearTerminalSchedules() {
    this.cancelScheduledPush();
    await this.replica.push();
    return pycoreApi.clearTerminalScheduleEntries();
  }

  private schedulePush(): void {
    if (this.replica.isApplyingRemote()) return;
    if (this.pushTimer !== null) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      const scheduleSerial = this.terminalScheduleChangeSerial;
      void this.replica.push()
        .then(async (changed) => {
          if (scheduleSerial > this.terminalScheduleSyncSerial) {
            const result = await this.syncTerminalScheduleRuntime();
            if (result?.success) {
              this.terminalScheduleSyncSerial = scheduleSerial;
            }
          }
          if (changed) window.location.reload();
        })
        .catch(() => {
          // Offline writes remain in the browser copy until reconnect.
        });
    }, PUSH_DEBOUNCE_MS);
  }

  private cancelScheduledPush(): void {
    if (this.pushTimer === null) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
  }

  private syncTerminalScheduleRuntime(terminalNumber = 0) {
    return pycoreApi.synchronizeTerminalSchedules(terminalNumber);
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
      .then(async (changed) => {
        const result = await this.syncTerminalScheduleRuntime();
        if (result?.success) {
          this.terminalScheduleSyncSerial = this.terminalScheduleChangeSerial;
        }
        if (changed) window.location.reload();
      })
      .catch(() => {
        // The browser copy remains available while the backend is offline.
      });
  }
}

export const pycoreManagerUiStateSync = new PycoreManagerUiStateSync();
