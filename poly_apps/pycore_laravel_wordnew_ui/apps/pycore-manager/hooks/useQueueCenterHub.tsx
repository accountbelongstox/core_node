/**
 * Queue Center shared state.
 *
 * Laravel-owned queues are fetched directly from Laravel. Pycore supplies only
 * local runtime state and worker controls. Both branches remain independently
 * usable when the other backend is unavailable.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  normalizeQueueCenterSections,
  queueCenterExchangeApi,
  pycoreApi,
  PYCORE_HTTP_DEFAULTS,
} from '@/apps/pycore-manager/api';
import type {
  AssistStatus,
  PcQueueOverview,
  PcTaskRecentResponse,
  QueueCenterControlName,
  QueueCenterControlState,
  SentenceAudioAutoStatus,
  SentenceAudioQueueSnapshot,
  TranslationQueueResponse,
  TtsStatus,
  WordTtsAutoStatus,
} from '@/apps/pycore-manager/api';
import { LARAVEL_BROWSER_EVENTS, PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import type { QcSectionContracts } from '../utils/pcQueueCenterTypes';
import { QC_AUTO_KEY } from '../utils/pcQueueCenterTypes';
import { pycoreTaskCenterState } from './TaskCenterState';
import { useTopicDrivenRefresh } from './useTopicDrivenRefresh';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { diffQueueContext } from '../../../core/tasks/DiffQueueContext';
import { sentenceAudioQueuePump } from '../../../core/tasks/QueuePump';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';
import type { GlobalTaskWorkerRegistration } from '../../../core/contracts/QueueCenterContract';
import { usePcLaravelEndpoint } from '../PcLaravelEndpointContext';

const defaultSectionContracts = normalizeQueueCenterSections(null, null);
const SENTENCE_CONCURRENCY_LIMIT = QUEUE_CENTER_DIFF_DELIVERY.consumer_batch_limits.sentence_audio;

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
  assist: AssistStatus | null;
  tts: TtsStatus | null;
  overview: PcQueueOverview | null;
  sentenceQueue: SentenceAudioQueueSnapshot | null;
  recent: PcTaskRecentResponse | null;
  translationQueue: TranslationQueueResponse | null;
  controls: Partial<Record<QueueCenterControlName, QueueCenterControlState>>;
  sliceErrors: Record<string, string>;
  timestamp: string | null;
  loading: boolean;
  error: string | null;
  sectionContracts: QcSectionContracts;
  refreshHub: () => Promise<void>;
  promoteTranslationTask: (taskId: string, priority: number) => void;
  setControl: (name: QueueCenterControlName, enabled: boolean) => Promise<void>;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
}

type QueueCenterHubData = Omit<
  QueueCenterHubState,
  'refreshHub' | 'promoteTranslationTask' | 'setControl' | 'autoRefresh' | 'setAutoRefresh'
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
  assist: null,
  tts: null,
  overview: null,
  sentenceQueue: null,
  recent: null,
  translationQueue: null,
  controls: {},
  sliceErrors: {},
  timestamp: null,
  loading: true,
  error: null,
  sectionContracts: defaultSectionContracts,
  refreshHub: async () => {},
  promoteTranslationTask: () => {},
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
  const { t } = useTranslation('pc');
  const { current: laravelEndpoint } = usePcLaravelEndpoint();
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
    return () => {
      mounted.current = false;
      // Closing the UI stops the pump.
      sentenceAudioQueuePump.stop();
    };
  }, []);

  /**
   * The sentence_audio processor toggle drives the UI's own pump loop.
   * Pycore never pulls by itself; on connect the UI syncs the stored worker
   * configuration exactly once (no periodic config polling).
   */
  const syncPumpWithControl = useCallback((
    enabled: boolean,
    worker: GlobalTaskWorkerRegistration | null,
  ) => {
    if (!enabled) {
      sentenceAudioQueuePump.stop();
      return;
    }
    sentenceAudioQueuePump.start({
      laravelEndpoint,
      worker,
      concurrency: hub.voiceSentence?.concurrency ?? 1,
      syncConfig: async () => {
        const raw = StorageManager.get(PycoreManagerStorageKeys.PYCORE_SENTENCE_WORKER_CONCURRENCY, '');
        const concurrency = Math.min(
          SENTENCE_CONCURRENCY_LIMIT,
          Math.max(0, parseInt(raw, 10) || 0),
        );
        const speaker = StorageManager.get(PycoreManagerStorageKeys.PYCORE_SENTENCE_QWEN_SPEAKER, '');
        await pycoreApi.setSentenceAudioRuntimeConfig({
          auto_start: true,
          concurrency,
          speaker,
        });
      },
    });
  }, [hub.voiceSentence?.concurrency, laravelEndpoint]);

  const sentenceAudioEnabled = hub.sectionContracts.sentence_audio?.toggle.enabled === true;
  const sentenceWorker = hub.voiceSentence?.worker;
  const sentenceWorkerId = String(sentenceWorker?.worker_id ?? '').trim();
  const sentenceWorkerName = String(sentenceWorker?.worker_name ?? sentenceWorkerId).trim();
  const sentenceProcessorTypes = sentenceWorker?.processor_types ?? [];
  const sentenceCapabilities = sentenceWorker?.capabilities ?? [];
  const sentenceWorkerRegistration: GlobalTaskWorkerRegistration | null = sentenceWorkerId
    ? {
        worker_id: sentenceWorkerId,
        worker_name: sentenceWorkerName || sentenceWorkerId,
        processor_types: sentenceProcessorTypes,
        capabilities: sentenceCapabilities,
      }
    : null;
  const sentenceWorkerSignature = JSON.stringify(sentenceWorkerRegistration);
  useEffect(() => {
    syncPumpWithControl(sentenceAudioEnabled, sentenceWorkerRegistration);
  }, [sentenceAudioEnabled, sentenceWorkerSignature, syncPumpWithControl]);

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
        const exchange = await queueCenterExchangeApi.read();
        if (!mounted.current || currentRequest !== requestId.current) return;
        const laravelComplete = !exchange.errors.overview
          && !exchange.errors.queue_metrics
          && !exchange.errors.translation
          && !exchange.errors.sentence_queue;
        const hubState: QueueCenterHubLifecycle = exchange.pycoreReachable
          && exchange.laravelReachable
          && laravelComplete
          ? 'ready'
          : exchange.pycoreReachable || exchange.laravelReachable
            ? 'degraded'
            : 'error';

        if (hubState === 'error') {
          const failures = consecutiveFailuresRef.current + 1;
          consecutiveFailuresRef.current = failures;
          offlineRetryAtRef.current = Date.now() + Math.min(
            PYCORE_HTTP_DEFAULTS.reconnectMaxMs,
            2 ** Math.min(PYCORE_HTTP_DEFAULTS.maxBackoffExponent, failures)
              * PYCORE_HTTP_DEFAULTS.reconnectMinMs,
          );
        } else {
          consecutiveFailuresRef.current = 0;
          offlineRetryAtRef.current = 0;
        }

        setHub((previous) => ({
          hubState,
          diagnostics: null,
          pycoreReachable: exchange.pycoreReachable,
          laravelReachable: exchange.laravelReachable,
          laravelStoredEndpoint: laravelEndpoint || null,
          laravelActiveEndpoint: laravelEndpoint || null,
          workerApiUrl: exchange.workerApiUrl ?? previous.workerApiUrl,
          laravelSnapshotAgeS: exchange.laravelReachable ? 0 : previous.laravelSnapshotAgeS,
          translationPending: exchange.translation?.summary?.pending ?? previous.translationPending,
          voiceWord: exchange.wordAudio ?? previous.voiceWord,
          voiceSentence: exchange.sentenceAudio ?? previous.voiceSentence,
          assist: exchange.assist ?? previous.assist,
          tts: exchange.tts ?? previous.tts,
          overview: exchange.overview ?? previous.overview,
          sentenceQueue: exchange.sentenceQueue ?? previous.sentenceQueue,
          recent: exchange.recent ?? previous.recent,
          translationQueue: exchange.translation ?? previous.translationQueue,
          controls: previous.controls,
          sliceErrors: exchange.errors,
          timestamp: exchange.generatedAt,
          loading: false,
          error: hubState === 'error'
            ? t('queueCenter.errors.centerUnavailable')
            : exchange.errors.pycore || null,
          sectionContracts: exchange.sectionContracts,
        }));

        if (exchange.recent) pycoreTaskCenterState.ingestRecent(exchange.recent);
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
          error: errorMessage(error, t('queueCenter.errors.centerUnavailable')),
        }));
      }
    } finally {
      pollInFlightRef.current = false;
    }
  }, [laravelEndpoint, t]);

  useEffect(() => { void poll(false); }, [poll]);

  useTopicDrivenRefresh(
    [PYCORE_EVENT_TOPICS.operationChanged, PYCORE_EVENT_TOPICS.qwenQueueChanged],
    () => { void poll(true); },
    { fallbackMs: autoRefresh ? PYCORE_HTTP_DEFAULTS.fallbackPollMs : 0, enabled: autoRefresh },
  );

  const refreshHub = useCallback(async () => { await poll(false); }, [poll]);

  const promoteTranslationTask = useCallback((taskId: string, priority: number) => {
    diffQueueContext.touch('pycore-manager:translation:priority', [taskId]);
    setHub((previous) => {
      const translationQueue = previous.translationQueue;
      if (!translationQueue?.items) return previous;
      const items = translationQueue.items
        .map((task) => task.task_id === taskId
          ? { ...task, priority: Math.max(task.priority ?? 0, priority), recently_bumped: true }
          : task)
        .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
      return { ...previous, translationQueue: { ...translationQueue, items } };
    });
  }, []);

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
    window.addEventListener(LARAVEL_BROWSER_EVENTS.selectionChanged, handleEndpointChanged);
    return () => window.removeEventListener(LARAVEL_BROWSER_EVENTS.selectionChanged, handleEndpointChanged);
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
        laravel_endpoint: enabled ? laravelEndpoint : null,
        timeoutMs: 20_000,
      });
      if (!response?.success) throw new Error(response?.error || `Could not update ${name}`);
      void poll(true);
    } catch (error: unknown) {
      patchSectionEnabled(name, !enabled);
      void poll(true);
      throw error;
    }
  }, [laravelEndpoint, poll, patchSectionEnabled]);

  const value = useMemo<QueueCenterHubState>(
    () => ({ ...hub, refreshHub, promoteTranslationTask, setControl, autoRefresh, setAutoRefresh }),
    [hub, refreshHub, promoteTranslationTask, setControl, autoRefresh, setAutoRefresh],
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
