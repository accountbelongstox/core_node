/**
 * Queue Center shared state.
 *
 * One pycore request returns a versioned snapshot for every page section. The
 * hub never combines independently-timed responses and never hides slice
 * failures behind an unrelated health check.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { mapQueueSnapshot, pycoreApi } from '../../../core/api-libs/pycore';
import type {
  AssistStatus, HeartbeatWorkersStatus, PcQueueOverview, PcTaskCenterResponse,
  PcTaskRecentResponse, QueueCenterControlName, QueueCenterControlState,
  QueueCenterLocalTaskRow, QueueResponse, SentenceAudioAutoStatus,
  SentenceAudioQueueSnapshot, TranslationQueueResponse, TtsStatus,
  WordTtsAutoStatus,
} from '../../../core/api-libs/pycore';

const HUB_POLL_MS = 5000;

export interface QueueCenterHubState {
  pycoreReachable: boolean;
  laravelReachable: boolean | null;
  laravelStoredEndpoint: string | null;
  laravelActiveEndpoint: string | null;
  laravelSnapshotAgeS: number | null;
  localTaskTotal: number | null;
  localProcessing: number | null;
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
  managerQueue: QueueResponse | null;
  localTasks: QueueCenterLocalTaskRow[] | null;
  translationQueue: TranslationQueueResponse | null;
  controls: Partial<Record<QueueCenterControlName, QueueCenterControlState>>;
  sliceErrors: Record<string, string>;
  timestamp: string | null;
  loading: boolean;
  error: string | null;
  refreshHub: () => Promise<void>;
  setControl: (name: QueueCenterControlName, enabled: boolean) => Promise<void>;
}

const defaultHub: QueueCenterHubState = {
  pycoreReachable: true,
  laravelReachable: null,
  laravelStoredEndpoint: null,
  laravelActiveEndpoint: null,
  laravelSnapshotAgeS: null,
  localTaskTotal: null,
  localProcessing: null,
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
  managerQueue: null,
  localTasks: null,
  translationQueue: null,
  controls: {},
  sliceErrors: {},
  timestamp: null,
  loading: true,
  error: null,
  refreshHub: async () => {},
  setControl: async () => {},
};

const QueueCenterHubContext = createContext<QueueCenterHubState>(defaultHub);

export const QueueCenterHubProvider: React.FC<{
  children: React.ReactNode;
  autoRefresh?: boolean;
}> = ({ children, autoRefresh = true }) => {
  const [hub, setHub] = useState<Omit<QueueCenterHubState, 'refreshHub' | 'setControl'>>(() => {
    const { refreshHub: _refreshHub, setControl: _setControl, ...state } = defaultHub;
    return state;
  });
  const mounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const poll = useCallback(async (silent = false) => {
    const currentRequest = ++requestId.current;
    if (!silent) setHub((previous) => ({ ...previous, loading: true }));
    try {
      const snapshot = await pycoreApi.getQueueCenterSnapshot();
      if (!mounted.current || currentRequest !== requestId.current) return;
      const counts = snapshot.data.task_center?.local_tasks?.counts;
      const total = counts
        ? (['pending', 'processing', 'completed', 'failed'] as const)
          .reduce((sum, key) => sum + (Number(counts[key]) || 0), 0)
        : null;
      const managerQueue = snapshot.data.manager_queue
        ? mapQueueSnapshot(snapshot.data.manager_queue)
        : null;
      const sliceMessage = Object.entries(snapshot.errors)
        .map(([name, message]) => `${name}: ${message}`)
        .join('; ');
      setHub({
        pycoreReachable: true,
        laravelReachable: snapshot.source.laravel_reachable,
        laravelStoredEndpoint: snapshot.source.laravel_stored_endpoint,
        laravelActiveEndpoint: snapshot.source.laravel_active_endpoint,
        laravelSnapshotAgeS: snapshot.source.laravel_snapshot_age_s,
        localTaskTotal: total,
        localProcessing: counts ? Number(counts.processing) || 0 : null,
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
        managerQueue,
        localTasks: snapshot.data.local_tasks?.tasks ?? null,
        translationQueue: snapshot.data.translation,
        controls: snapshot.controls,
        sliceErrors: snapshot.errors,
        timestamp: snapshot.generated_at,
        loading: false,
        error: sliceMessage || null,
      });
    } catch (error: any) {
      if (!mounted.current || currentRequest !== requestId.current) return;
      setHub((previous) => ({
        ...previous,
        pycoreReachable: false,
        loading: false,
        error: error?.message || 'Queue Center unavailable',
      }));
    }
  }, []);

  useEffect(() => {
    void poll(false);
  }, [poll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => { void poll(true); }, HUB_POLL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, poll]);

  const refreshHub = useCallback(async () => { await poll(false); }, [poll]);
  const setControl = useCallback(async (name: QueueCenterControlName, enabled: boolean) => {
    const result = await pycoreApi.setQueueCenterControl(name, enabled);
    if (!result?.success) throw new Error(result?.error || `Could not update ${name}`);
    await poll(false);
  }, [poll]);

  const value = useMemo<QueueCenterHubState>(
    () => ({ ...hub, refreshHub, setControl }),
    [hub, refreshHub, setControl],
  );

  return React.createElement(QueueCenterHubContext.Provider, { value }, children);
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
