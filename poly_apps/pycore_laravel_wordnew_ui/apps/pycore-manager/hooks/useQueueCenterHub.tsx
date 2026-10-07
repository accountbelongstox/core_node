/**
 * Queue Center shared state.
 *
 * Queue data is read from Pycore's shared snapshot cache. Pycore owns the
 * Laravel stream, bounded queue cache, pull/accept/result processing, and
 * continues after this provider unmounts.
 *
 * Architecture reference: `_prompts/队列中心.txt`.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Backoff } from '@/core/tasks/Backoff';
import {
  applyAudioLaneState,
  getAudioLaneStoreState,
  normalizeQueueCenterSections,
  queueCenterExchangeApi,
  pycoreApi,
  PYCORE_HTTP_DEFAULTS,
  useAudioLaneState,
} from '@/apps/pycore-manager/api';
import type { AssistCapabilities, AssistCycleResponse } from '../../../core/integrations/pycore/PycoreServiceTypes';
import type {
  AssistStatus,
  AudioLaneStatePayload,
  PcQueueOverview,
  QueueCenterLaravelSlice,
  QueueCenterLocalSlice,
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
import type { QcSectionContracts, QcSectionScope } from '../utils/pcQueueCenterTypes';
import { QC_AUTO_KEY } from '../utils/pcQueueCenterTypes';
import { pycoreTaskCenterState } from './TaskCenterState';
import { usePolling } from '../../../core/tasks/usePolling';
import { isPycoreRelayMode } from '../../../core/integrations/pycore/pycoreTarget';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../core/integrations/laravel/LaravelRealtime';
import { NETWORK_TIMEOUTS } from '../../../core/config/NetworkTiming';
import { usePycoreTopicRefresh } from '../../../core/integrations/pycore/usePycoreTopicRefresh';
import { StorageManager } from '../../../core/persistence';
import { usePcLaravelEndpoint } from '../PcLaravelEndpointContext';
import { PC_REQUEST_FAILED_CODE, PcLocalizedError, pcCaughtErrorMessage, pcFailureMessage } from '../utils/pcErrorCodes';
import { PC_AUDIO_LANES } from '../utils/pcAudioLanes';

const defaultSectionContracts = normalizeQueueCenterSections(null, null);

/** Which side a Queue Center read refreshes: pycore pushes refresh the local slice, Laravel pushes the Laravel one. */
type QcPollScope = 'all' | 'local' | 'laravel';

const EMPTY_LOCAL_SLICE: QueueCenterLocalSlice = { snapshot: null, errors: {} };
const EMPTY_LARAVEL_SLICE: QueueCenterLaravelSlice = {
  overview: null, translation: null, sentenceQueue: null, queueCenterOverview: null, errors: {},
};

/**
 * Pycore-owned audio lane truth -> hub fields. The pushed payload carries the
 * SAME section contracts (every audio lane) and word/sentence status the exchange snapshot
 * builds, so applying it can never disagree with a later poll.
 */
function laneStatePatch(
  payload: AudioLaneStatePayload,
  current: QcSectionContracts,
): Partial<Pick<QueueCenterHubData, 'sectionContracts' | 'voiceWord' | 'voiceSentence'>> {
  const pushedLanes = PC_AUDIO_LANES.filter((lane) => payload.lanes[lane]?.section_contract);
  const pushed = normalizeQueueCenterSections(
    Object.fromEntries(pushedLanes.map((lane) => [lane, payload.lanes[lane]?.section_contract])),
    null,
  );
  const patch: Partial<Pick<QueueCenterHubData, 'sectionContracts' | 'voiceWord' | 'voiceSentence'>> = {
    sectionContracts: {
      ...current,
      ...Object.fromEntries(pushedLanes.map((lane) => [lane, pushed[lane]])),
    },
  };
  if (payload.wordAudio) patch.voiceWord = payload.wordAudio as WordTtsAutoStatus;
  if (payload.sentenceAudio) patch.voiceSentence = payload.sentenceAudio as SentenceAudioAutoStatus;
  return patch;
}

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
  runAssistCycle: () => Promise<AssistCycleResponse>;
  setAssistCapability: (capability: keyof AssistCapabilities, enabled: boolean) => Promise<void>;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
}

type QueueCenterHubData = Omit<
  QueueCenterHubState,
  'refreshHub' | 'promoteTranslationTask' | 'setControl' | 'runAssistCycle' | 'setAssistCapability' | 'autoRefresh' | 'setAutoRefresh'
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
  runAssistCycle: async () => ({ ok: false, processed: 0, submitted: 0, released: 0, errors: [] }),
  setAssistCapability: async () => {},
  autoRefresh: true,
  setAutoRefresh: () => {},
};

const QueueCenterHubContext = createContext<QueueCenterHubState>(defaultHub);

function readAutoRefreshPref(): boolean {
  const value = StorageManager.getRaw(QC_AUTO_KEY);
  return value === null ? true : value === '1';
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
      runAssistCycle: _runAssistCycle,
      setAssistCapability: _setAssistCapability,
      autoRefresh: _autoRefresh,
      setAutoRefresh: _setAutoRefresh,
      ...state
    } = defaultHub;
    return state;
  });
  const requestId = useRef(0);
  const offlineRetryAtRef = useRef(0);
  const offlineBackoffRef = useRef(new Backoff(PYCORE_HTTP_DEFAULTS.reconnectMinMs, PYCORE_HTTP_DEFAULTS.reconnectMaxMs, { jitter: 'none', initialStep: 1 }));
  const pollInFlightRef = useRef(false);
  const pollQueuedRef = useRef<QcPollScope | null>(null);
  const remoteRefreshQueuedRef = useRef(false);
  const localSliceRef = useRef<QueueCenterLocalSlice>(EMPTY_LOCAL_SLICE);
  const laravelSliceRef = useRef<QueueCenterLaravelSlice>(EMPTY_LARAVEL_SLICE);
  const pollRef = useRef<(silent?: boolean, requestRemoteRefresh?: boolean, scope?: QcPollScope) => Promise<void>>(
    async () => undefined,
  );
  const mounted = useRef(true);
  const hubRef = useRef(hub);
  hubRef.current = hub;
  const laneStore = useAudioLaneState();

  const setAutoRefresh = useCallback((enabled: boolean) => {
    setAutoRefreshState(enabled);
    StorageManager.setRaw(QC_AUTO_KEY, enabled ? '1' : '0');
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const poll = useCallback(async (silent = false, requestRemoteRefresh = false, scope: QcPollScope = 'all') => {
    if (pollInFlightRef.current) {
      const queued = pollQueuedRef.current;
      pollQueuedRef.current = queued === null || queued === scope ? scope : 'all';
      remoteRefreshQueuedRef.current = remoteRefreshQueuedRef.current || requestRemoteRefresh;
      return;
    }
    pollInFlightRef.current = true;
    try {
      const currentRequest = ++requestId.current;
      const now = Date.now();
      const pollStartedAt = now;
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
        const [local, laravel] = await Promise.all([
          scope === 'laravel' ? localSliceRef.current : queueCenterExchangeApi.readLocal(requestRemoteRefresh),
          scope === 'local' ? laravelSliceRef.current : queueCenterExchangeApi.readLaravel(),
        ]);
        if (!mounted.current || currentRequest !== requestId.current) return;
        localSliceRef.current = local;
        laravelSliceRef.current = laravel;
        const exchange = queueCenterExchangeApi.compose(local, laravel);
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
          offlineRetryAtRef.current = Date.now() + offlineBackoffRef.current.next();
        } else {
          offlineBackoffRef.current.reset();
          offlineRetryAtRef.current = 0;
        }

        // A lane push that arrived after this poll started is newer truth:
        // keep it instead of the exchange's older audio lane fields.
        const heldLanes = getAudioLaneStoreState();
        const lanePatch = heldLanes.payload && heldLanes.receivedAt > pollStartedAt
          ? laneStatePatch(heldLanes.payload, exchange.sectionContracts)
          : null;
        setHub((previous) => ({
          hubState,
          diagnostics: null,
          pycoreReachable: exchange.pycoreReachable,
          laravelReachable: exchange.laravelReachable,
          laravelStoredEndpoint: laravelEndpoint || null,
          laravelActiveEndpoint: exchange.laravelActiveEndpoint,
          workerApiUrl: exchange.workerApiUrl ?? previous.workerApiUrl,
          laravelSnapshotAgeS: exchange.laravelSnapshotAgeS,
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
          error: exchange.errors.pycore || null,
          sectionContracts: exchange.sectionContracts,
          ...(lanePatch ?? {}),
        }));

        if (exchange.recent) pycoreTaskCenterState.ingestRecent(exchange.recent);
      } catch {
        if (!mounted.current || currentRequest !== requestId.current) return;
        offlineRetryAtRef.current = Date.now() + offlineBackoffRef.current.next();
        setHub((previous) => ({
          ...previous,
          pycoreReachable: false,
          loading: false,
          hubState: 'error',
          error: PC_REQUEST_FAILED_CODE,
        }));
      }
    } finally {
      pollInFlightRef.current = false;
      const queuedScope = pollQueuedRef.current;
      if (queuedScope !== null && mounted.current) {
        const queuedRemoteRefresh = remoteRefreshQueuedRef.current;
        pollQueuedRef.current = null;
        remoteRefreshQueuedRef.current = false;
        window.setTimeout(() => {
          if (mounted.current) void pollRef.current(true, queuedRemoteRefresh, queuedScope);
        }, 0);
      }
    }
  }, [laravelEndpoint]);
  pollRef.current = poll;

  useEffect(() => { void poll(false); }, [poll]);

  usePycoreTopicRefresh(
    [
      PYCORE_EVENT_TOPICS.operationChanged,
      PYCORE_EVENT_TOPICS.qwenQueueChanged,
      PYCORE_EVENT_TOPICS.queueCenterSnapshotChanged,
    ],
    () => { void poll(true, false, 'local'); },
    { enabled: autoRefresh },
  );
  // Laravel-fed slices (overview, translation and sentence queues) follow the Laravel Mercure push (queue / presence
  // events, coalesced, and one read after each reconnect); the slow reconcile runs only while that stream is down.
  useEffect(() => {
    if (!autoRefresh) return undefined;
    let timer: number | undefined;
    const schedule = (): void => {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        void pollRef.current(true, false, 'laravel');
      }, NETWORK_TIMEOUTS.queueCenterSliceDebounceMs);
    };
    const offs = [
      laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.queueChanged, schedule),
      laravelRealtime.subscribe(LARAVEL_REALTIME_EVENTS.workerPresence, schedule),
      laravelRealtime.onConnected(schedule),
    ];
    laravelRealtime.start();
    return () => {
      offs.forEach((off) => off());
      if (timer !== undefined) window.clearTimeout(timer);
      laravelRealtime.stop();
    };
  }, [autoRefresh]);
  usePolling(
    () => (laravelRealtime.isConnected() ? undefined : poll(true)),
    { intervalMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs, enabled: autoRefresh, immediate: false },
  );

  const refreshHub = useCallback(async () => { await poll(false, true); }, [poll]);

  // State-driven audio lanes: every pycore push (switch, lifecycle, queue,
  // full pull, worker) lands in the Word/Sentence/Phrase Audio sections at once.
  useEffect(() => {
    const payload = laneStore.payload;
    if (!payload) return;
    setHub((previous) => ({ ...previous, ...laneStatePatch(payload, previous.sectionContracts) }));
  }, [laneStore.payload]);

  const promoteTranslationTask = useCallback((taskId: string, priority: number) => {
    setHub((previous) => {
      const translationQueue = previous.translationQueue;
      if (!translationQueue?.items) return previous;
      const items = translationQueue.items
        .map((task) => task.task_id === taskId
          ? { ...task, priority, recently_bumped: priority > (task.priority ?? 0) }
          : task)
        .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
      return { ...previous, translationQueue: { ...translationQueue, items } };
    });
  }, []);

  useEffect(() => {
    const handleEndpointChanged = () => {
      requestId.current += 1;
      laravelSliceRef.current = EMPTY_LARAVEL_SLICE;
      setHub((previous) => ({
        ...previous,
        hubState: 'loading',
        laravelActiveEndpoint: null,
        laravelStoredEndpoint: null,
        workerApiUrl: null,
        laravelReachable: null,
        laravelSnapshotAgeS: null,
        translationPending: null,
        overview: null,
        sentenceQueue: null,
        recent: null,
        translationQueue: null,
        sliceErrors: {},
        timestamp: null,
        loading: true,
        sectionContracts: defaultSectionContracts,
      }));
      void poll(false);
    };
    window.addEventListener(LARAVEL_BROWSER_EVENTS.selectionChanged, handleEndpointChanged);
    return () => window.removeEventListener(LARAVEL_BROWSER_EVENTS.selectionChanged, handleEndpointChanged);
  }, [poll]);

  // The switch flips at once; pycore's answer (lane_state) or push confirms it,
  // and a failure restores the contract held before the click.
  const setControl = useCallback(async (name: QueueCenterControlName, enabled: boolean) => {
    const held = hubRef.current.sectionContracts[name as QcSectionScope];
    if (held) {
      setHub((previous) => ({
        ...previous,
        sectionContracts: { ...previous.sectionContracts, [name]: { ...held, toggle: { ...held.toggle, enabled } } },
      }));
    }
    let thrown: unknown = null;
    const response = await pycoreApi.setQueueCenterControl(name, enabled, {
      requested_by: 'user',
      reason: 'ui_toggle',
      graceful_stop: false,
      // A relayed node keeps the Laravel route of its own environment; the browser's route may not be reachable from it.
      laravel_endpoint: enabled && !isPycoreRelayMode() ? laravelEndpoint : null,
      timeoutMs: 20_000,
    }).catch((error: unknown) => {
      thrown = error;
      return null;
    });
    if (!response?.success) {
      if (held) setHub((previous) => ({ ...previous, sectionContracts: { ...previous.sectionContracts, [name]: held } }));
      void poll(true, false, 'local');
      const fallback = t('queueCenter.errors.controlFailed');
      throw new PcLocalizedError(response ? pcFailureMessage(response, fallback) : pcCaughtErrorMessage(thrown, fallback));
    }
    // Audio lanes answer with the authoritative post-transition state.
    if (!applyAudioLaneState(response.lane_state)) void poll(true, false, 'local');
  }, [laravelEndpoint, poll, t]);

  const runAssistCycle = useCallback(async (): Promise<AssistCycleResponse> => {
    const response = await pycoreApi.runAssistCycle(hubRef.current.laravelActiveEndpoint || '');
    void poll(true, false, 'local');
    return response;
  }, [poll]);

  const setAssistCapability = useCallback(async (capability: keyof AssistCapabilities, enabled: boolean) => {
    const response = await pycoreApi.setAssistConfig(
      { capabilities: { [capability]: enabled } },
      enabled ? hubRef.current.laravelActiveEndpoint : null,
    );
    void poll(true, false, 'local');
    if (response?.success === false) throw new PcLocalizedError(pcFailureMessage(response, t('queueCenter.errors.controlFailed')));
  }, [poll, t]);

  const value = useMemo<QueueCenterHubState>(
    () => ({ ...hub, refreshHub, promoteTranslationTask, setControl, runAssistCycle, setAssistCapability, autoRefresh, setAutoRefresh }),
    [hub, refreshHub, promoteTranslationTask, setControl, runAssistCycle, setAssistCapability, autoRefresh, setAutoRefresh],
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
