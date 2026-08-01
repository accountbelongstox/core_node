/**
 * Queue Center shared state.
 *
 * The UI consumes one HTTP API snapshot and only normalizes display-safe scalar
 * values. Queue counts, lifecycle, category membership, and controls are owned
 * by pycore and aligned through config/queue_center_contract.json.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  normalizeQueueCenterSections,
  pycoreApi,
  PYCORE_HTTP_DEFAULTS,
  QUEUE_CENTER_SCHEMA_VERSION,
} from '@/apps/pycore-manager/api';
import type {
  AssistStatus,
  HeartbeatWorkersStatus,
  PcQueueOverview,
  PcTaskCenterResponse,
  PcTaskRecentResponse,
  QueueCenterControlName,
  QueueCenterControlState,
  QueueCenterSnapshot,
  SentenceAudioAutoStatus,
  SentenceAudioQueueSnapshot,
  TranslationQueueResponse,
  TtsStatus,
  WordTtsAutoStatus,
} from '@/apps/pycore-manager/api';
import { PYCORE_BROWSER_EVENTS, PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import type { QcSectionContracts } from '../utils/pcQueueCenterTypes';
import { QC_AUTO_KEY } from '../utils/pcQueueCenterTypes';
import { pycoreTaskCenterState } from './TaskCenterState';
import { useTopicDrivenRefresh } from './useTopicDrivenRefresh';
import { StorageManager } from '../../../core/persistence';

const defaultSectionContracts = normalizeQueueCenterSections(null, null);

export type QueueCenterHubLifecycle = 'idle' | 'loading' | 'ready' | 'stale' | 'degraded' | 'error';

export interface QueueCenterHubState {
  hubState: QueueCenterHubLifecycle;
  diagnostics: Record<string, unknown> | null;
  pycoreReachable: boolean;
  laravelReachable: boolean | null;
  laravelStoredEndpoint: string | null;
  laravelActiveEndpoint: string | null;
  workerApiUrl: string | null;
  laravelSnapshotAgeS: number | null;
  translationPending: number | null;
  voiceWord: WordTtsAutoStatus | null;
  voiceSentence: SentenceAudioAutoStatus | null;
  workers: HeartbeatWorkersStatus | null;
  assist: AssistStatus | null;
  tts: TtsStatus | null;
  overview: PcQueueOverview | null;
  sentenceQueue: SentenceAudioQueueSnapshot | null;
  recent: PcTaskRecentResponse | null;
  taskCenter: PcTaskCenterResponse | null;
  translationQueue: TranslationQueueResponse | null;
  controls: Partial<Record<QueueCenterControlName, QueueCenterControlState>>;
  sliceErrors: Record<string, string>;
  timestamp: string | null;
  loading: boolean;
  error: string | null;
  sectionContracts: QcSectionContracts;
  refreshHub: () => Promise<void>;
  setControl: (name: QueueCenterControlName, enabled: boolean) => Promise<void>;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
}

type QueueCenterHubData = Omit<
  QueueCenterHubState,
  'refreshHub' | 'setControl' | 'autoRefresh' | 'setAutoRefresh'
>;

const defaultHub: QueueCenterHubState = {
  hubState: 'idle',
  diagnostics: null,
  pycoreReachable: true,
  laravelReachable: null,
  laravelStoredEndpoint: null,
  laravelActiveEndpoint: null,
  workerApiUrl: null,
  laravelSnapshotAgeS: null,
  translationPending: null,
  voiceWord: null,
  voiceSentence: null,
  workers: null,
  assist: null,
  tts: null,
  overview: null,
  sentenceQueue: null,
  recent: null,
  taskCenter: null,
  translationQueue: null,
  controls: {},
  sliceErrors: {},
  timestamp: null,
  loading: true,
  error: null,
  sectionContracts: defaultSectionContracts,
  refreshHub: async () => {},
  setControl: async () => {},
  autoRefresh: true,
  setAutoRefresh: () => {},
};

const QueueCenterHubContext = createContext<QueueCenterHubState>(defaultHub);

function readAutoRefreshPref(): boolean {
  const value = StorageManager.getRaw(QC_AUTO_KEY);
  return value === null ? true : value === '1';
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Page-scoped HTTP API hub. Mount once around Queue Center. */
export const QueueCenterHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [autoRefresh, setAutoRefreshState] = useState<boolean>(() => readAutoRefreshPref());
  const [hub, setHub] = useState<QueueCenterHubData>(() => {
    const {
      refreshHub: _refreshHub,
      setControl: _setControl,
      autoRefresh: _autoRefresh,
      setAutoRefresh: _setAutoRefresh,
      ...state
    } = defaultHub;
    return state;
  });
  const requestId = useRef(0);
  const offlineRetryAtRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const mounted = useRef(true);

  const setAutoRefresh = useCallback((enabled: boolean) => {
    setAutoRefreshState(enabled);
    StorageManager.setRaw(QC_AUTO_KEY, enabled ? '1' : '0');
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const poll = useCallback(async (silent = false) => {
    if (pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    try {
      const currentRequest = ++requestId.current;
      const now = Date.now();
      if (now < offlineRetryAtRef.current) {
        if (!silent) setHub((previous) => ({ ...previous, loading: false }));
        return;
      }
      if (!silent) {
        setHub((previous) => ({
          ...previous,
          loading: true,
          hubState: previous.hubState === 'idle' ? 'loading' : previous.hubState,
        }));
      }

      try {
        const snapshot: QueueCenterSnapshot = await pycoreApi.getQueueCenterSnapshot();
        if (!mounted.current || currentRequest !== requestId.current) return;
        if (snapshot.schema_version !== QUEUE_CENTER_SCHEMA_VERSION) {
          throw new Error(`Unsupported Queue Center schema ${snapshot.schema_version}`);
        }
        const sectionContracts = normalizeQueueCenterSections(
          snapshot.section_contracts,
          snapshot.generated_at,
        );
        const snapshotError = Object.entries(snapshot.errors ?? {})
          .map(([name, value]) => `${name}: ${value}`)
          .join('; ');
        const workerApiUrl = snapshot.data.task_center?.remote_queue?.worker?.api_url ?? null;
        let hubState: QueueCenterHubLifecycle = 'ready';
        if (snapshot.data.overview?.degraded) {
          hubState = snapshot.data.overview.source === 'pycore_fallback_stale_cache' ? 'stale' : 'degraded';
        }
        consecutiveFailuresRef.current = 0;
        offlineRetryAtRef.current = 0;

        setHub({
          hubState,
          diagnostics: snapshot.data.overview?.diagnostics ?? null,
          pycoreReachable: true,
          laravelReachable: snapshot.source.laravel_reachable,
          laravelStoredEndpoint: snapshot.source.laravel_stored_endpoint,
          laravelActiveEndpoint: snapshot.source.laravel_active_endpoint,
          workerApiUrl: typeof workerApiUrl === 'string' && workerApiUrl ? workerApiUrl : null,
          laravelSnapshotAgeS: snapshot.source.laravel_snapshot_age_s,
          translationPending: snapshot.data.translation?.summary?.pending ?? null,
          voiceWord: snapshot.data.word_audio,
          voiceSentence: snapshot.data.sentence_audio,
          workers: snapshot.data.workers,
          assist: snapshot.data.assist,
          tts: snapshot.data.tts,
          overview: snapshot.data.overview,
          sentenceQueue: snapshot.data.sentence_queue,
          recent: snapshot.data.recent,
          taskCenter: snapshot.data.task_center,
          translationQueue: snapshot.data.translation,
          controls: snapshot.controls,
          sliceErrors: snapshot.errors,
          timestamp: snapshot.generated_at,
          loading: false,
          error: snapshotError || null,
          sectionContracts,
        });

        if (snapshot.data.recent) pycoreTaskCenterState.ingestRecent(snapshot.data.recent);
      } catch (error: unknown) {
        if (!mounted.current || currentRequest !== requestId.current) return;
        const failures = consecutiveFailuresRef.current + 1;
        consecutiveFailuresRef.current = failures;
        offlineRetryAtRef.current = Date.now() + Math.min(
          PYCORE_HTTP_DEFAULTS.reconnectMaxMs,
          2 ** Math.min(PYCORE_HTTP_DEFAULTS.maxBackoffExponent, failures)
            * PYCORE_HTTP_DEFAULTS.reconnectMinMs,
        );
        setHub((previous) => ({
          ...previous,
          pycoreReachable: false,
          loading: false,
          hubState: 'error',
          error: errorMessage(error, 'Queue Center unavailable'),
        }));
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, []);

  useEffect(() => { void poll(false); }, [poll]);

  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.operationChanged, PYCORE_EVENT_TOPICS.qwenQueueChanged],
    () => { void poll(true); },
    { fallbackMs: autoRefresh ? PYCORE_HTTP_DEFAULTS.fallbackPollMs : 0, enabled: autoRefresh },
  );

  const refreshHub = useCallback(async () => { await poll(false); }, [poll]);

  useEffect(() => {
    const handleEndpointChanged = () => {
      setHub((previous) => ({
        ...previous,
        laravelActiveEndpoint: null,
        laravelStoredEndpoint: null,
        workerApiUrl: null,
        laravelReachable: null,
        laravelSnapshotAgeS: null,
      }));
      void poll(false);
    };
    window.addEventListener(PYCORE_BROWSER_EVENTS.laravelApiChanged, handleEndpointChanged);
    return () => window.removeEventListener(PYCORE_BROWSER_EVENTS.laravelApiChanged, handleEndpointChanged);
  }, [poll]);

  const patchSectionEnabled = useCallback((name: QueueCenterControlName, enabled: boolean) => {
    setHub((previous) => {
      const contract = previous.sectionContracts[name];
      if (!contract) return previous;
      return {
        ...previous,
        sectionContracts: {
          ...previous.sectionContracts,
          [name]: { ...contract, toggle: { ...contract.toggle, enabled } },
        },
      };
    });
  }, []);

  const setControl = useCallback(async (name: QueueCenterControlName, enabled: boolean) => {
    patchSectionEnabled(name, enabled);
    try {
      const response = await pycoreApi.setQueueCenterControl(name, enabled, {
        requested_by: 'user',
        reason: 'ui_toggle',
        graceful_stop: !enabled,
        timeoutMs: 20_000,
      });
      if (!response?.success) throw new Error(response?.error || `Could not update ${name}`);
      void poll(true);
    } catch (error: unknown) {
      patchSectionEnabled(name, !enabled);
      void poll(true);
      throw error;
    }
  }, [poll, patchSectionEnabled]);

  const value = useMemo<QueueCenterHubState>(
    () => ({ ...hub, refreshHub, setControl, autoRefresh, setAutoRefresh }),
    [hub, refreshHub, setControl, autoRefresh, setAutoRefresh],
  );

  return <QueueCenterHubContext.Provider value={value}>{children}</QueueCenterHubContext.Provider>;
};

export function useQueueCenterHub(): QueueCenterHubState {
  return useContext(QueueCenterHubContext);
}

export function laravelLiveSyncOffline(hub: QueueCenterHubState): boolean {
  return hub.pycoreReachable && hub.laravelReachable === false;
}

export function laravelEndpointMismatch(hub: QueueCenterHubState): boolean {
  const stored = hub.laravelStoredEndpoint?.replace(/\/$/, '');
  const active = hub.laravelActiveEndpoint?.replace(/\/$/, '');
  return !!(stored && active && stored !== active);
}

export function workerEndpointMismatch(hub: QueueCenterHubState): boolean {
  const worker = hub.workerApiUrl?.replace(/\/$/, '');
  const active = hub.laravelActiveEndpoint?.replace(/\/$/, '');
  return !!(worker && active && worker !== active);
}
