import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  PeerStatus,
  SelfStatus,
  SyncLogEntry,
  SyncSettings,
} from '../../../core/integrations/pycore';
import {
  connectPycoreHttp,
  pycoreApi,
  pycoreEventBus,
  pycoreRouteRecoveryStore,
  PYCORE_BROWSER_EVENTS,
  PYCORE_EVENT_TOPICS,
  PYCORE_HTTP_ROUTES,
} from '../../../core/integrations/pycore';
import { StorageManager } from '../../../core/persistence';
import { createRuntimeStore } from '../../../core/persistence/RuntimeStore';
import { TASK_INDEX_KEY, taskStorageKey } from '../../../core/tasks/taskStorageKeys';

const LOG_PAGE = 1;
const LOG_PAGE_SIZE = 100;
const RECOVERY_PARAMS = { page: LOG_PAGE, page_size: LOG_PAGE_SIZE };
const PERSIST_DEBOUNCE_MS = 250;
const LEGACY_TASK_KEY = 'pycore.code-sync';

function removeLegacyPollingSession(): void {
  const taskIndex = StorageManager.get<string[]>(TASK_INDEX_KEY, []);
  if (!Array.isArray(taskIndex) || !taskIndex.includes(LEGACY_TASK_KEY)) return;
  StorageManager.set(
    TASK_INDEX_KEY,
    taskIndex.filter((key) => key !== LEGACY_TASK_KEY),
  );
  StorageManager.remove(taskStorageKey(LEGACY_TASK_KEY));
}

export interface CodeSyncMeshSnapshot {
  self: SelfStatus | null;
  peers: PeerStatus[];
}

export interface CodeSyncRuntimeState {
  mesh: CodeSyncMeshSnapshot;
  settings: SyncSettings | null;
  settingsOverridden: boolean;
  logs: SyncLogEntry[];
  logRevision: string;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

const store = createRuntimeStore<CodeSyncRuntimeState>({
  defaults: () => ({
    mesh: { self: null, peers: [] },
    settings: null,
    settingsOverridden: false,
    logs: [],
    logRevision: '',
    loading: false,
    initialized: false,
    error: null,
  }),
  restore: () => pycoreRouteRecoveryStore.read<CodeSyncRuntimeState>(
    PYCORE_HTTP_ROUTES.codeSyncRuntimeGet,
    RECOVERY_PARAMS,
  )?.data ?? null,
  persist: (state) => {
    pycoreRouteRecoveryStore.write(
      PYCORE_HTTP_ROUTES.codeSyncRuntimeGet,
      RECOVERY_PARAMS,
      state,
      { revision: state.logRevision },
    );
  },
  persistDebounceMs: PERSIST_DEBOUNCE_MS,
  errorFallback: 'CODE_SYNC_RUNTIME_UNAVAILABLE',
});

let consumerCount = 0;
let runtimeFlight: Promise<void> | null = null;
let unsubscribers: Array<() => void> = [];

function patch(partial: Partial<CodeSyncRuntimeState>, save = true): void {
  store.patch(partial, save);
}

export function getCodeSyncRuntimeState(): CodeSyncRuntimeState {
  return store.getState();
}

export function subscribeCodeSyncRuntime(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function setCodeSyncMesh(mesh: CodeSyncMeshSnapshot): void {
  patch({ mesh, error: null });
}

export function setCodeSyncSettings(settings: SyncSettings, overridden: boolean): void {
  patch({ settings, settingsOverridden: overridden, error: null });
}

export async function refreshCodeSyncRuntime(): Promise<void> {
  if (runtimeFlight) return runtimeFlight;
  patch({ loading: true }, false);
  runtimeFlight = pycoreApi.getCodeSyncRuntime({
    page: LOG_PAGE,
    pageSize: LOG_PAGE_SIZE,
    sinceRevision: store.getState().logRevision,
  })
    .then((response: any) => {
      if (!response?.success || !response.data) {
        patch({ error: response?.error || 'CODE_SYNC_RUNTIME_UNAVAILABLE' }, false);
        return;
      }
      const mesh = response.data.mesh || {};
      const settings = response.data.settings || {};
      const logPage = response.data.log_page || {};
      const state = store.getState();
      patch({
        mesh: {
          self: mesh.self ?? state.mesh.self,
          peers: Array.isArray(mesh.peers) ? mesh.peers : state.mesh.peers,
        },
        settings: settings.settings || state.settings,
        settingsOverridden: settings.settings
          ? Boolean(settings.overridden)
          : state.settingsOverridden,
        logs: logPage.unchanged
          ? state.logs
          : Array.isArray(logPage.logs) ? logPage.logs.slice(-LOG_PAGE_SIZE) : state.logs,
        logRevision: String(logPage.revision || state.logRevision),
        initialized: true,
        error: null,
      });
    })
    .catch((error: unknown) => {
      patch({ error: store.errorMessage(error) }, false);
    })
    .finally(() => {
      runtimeFlight = null;
      patch({ loading: false, initialized: true });
    });
  return runtimeFlight;
}

function applyMeshEvent(payload: Record<string, any>): void {
  const state = store.getState();
  setCodeSyncMesh({
    self: payload.self ?? state.mesh.self,
    peers: Array.isArray(payload.peers) ? payload.peers : state.mesh.peers,
  });
}

function applyLogEvent(payload: Record<string, any>): void {
  const state = store.getState();
  const eventId = String(payload.id || payload.revision || '');
  const exists = eventId && state.logs.some((entry: any) => {
    return String(entry.id || entry.revision || '') === eventId;
  });
  if (exists) return;
  patch({
    logs: [...state.logs, payload as SyncLogEntry].slice(-LOG_PAGE_SIZE),
    logRevision: String(payload.revision || state.logRevision),
    error: null,
  });
}

function startCodeSyncRuntime(): void {
  consumerCount += 1;
  if (consumerCount !== 1) return;
  removeLegacyPollingSession();
  connectPycoreHttp();
  unsubscribers = [
    pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.codeSyncUpdate, applyMeshEvent),
    pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.codeSyncLog, applyLogEvent),
    pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => {
      void refreshCodeSyncRuntime();
    }),
    pycoreEventBus.subscribe(PYCORE_BROWSER_EVENTS.httpEventReplayLost, () => {
      void refreshCodeSyncRuntime();
    }),
  ];
  void refreshCodeSyncRuntime();
}

function stopCodeSyncRuntime(): void {
  consumerCount = Math.max(0, consumerCount - 1);
  if (consumerCount !== 0) return;
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
}

export interface CodeSyncRuntimeHook extends CodeSyncRuntimeState {
  refresh: () => Promise<void>;
}

export function useCodeSyncRuntime(): CodeSyncRuntimeHook {
  useEffect(() => {
    startCodeSyncRuntime();
    return () => stopCodeSyncRuntime();
  }, []);
  const snapshot = useSyncExternalStore(
    subscribeCodeSyncRuntime,
    getCodeSyncRuntimeState,
    getCodeSyncRuntimeState,
  );
  const refresh = useCallback(() => refreshCodeSyncRuntime(), []);
  return useMemo(() => ({ ...snapshot, refresh }), [snapshot, refresh]);
}
