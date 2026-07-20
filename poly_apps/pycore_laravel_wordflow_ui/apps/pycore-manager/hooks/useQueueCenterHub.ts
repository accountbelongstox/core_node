/**
 * Shared Queue Center hub — one poll of GET /api/local/task-center for all tabs.
 * Same cached Laravel reachability the Translation Queue tab uses (monitor snapshot).
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type {
  PcTaskCenterResponse, WordTtsAutoStatus, SentenceAudioAutoStatus,
  HeartbeatWorkersStatus, AssistStatus, TtsStatus, PcQueueOverview,
  SentenceAudioQueueSnapshot, PcTaskRecentResponse,
} from '../../../core/api-libs/pycore/pycoreTypes';

const HUB_POLL_MS = 5000;

export interface QueueCenterHubState {
  /** pycore responded — distinct from Laravel live sync. */
  pycoreReachable: boolean;
  /** Cached monitor flag (same source as Translation Queue). */
  laravelReachable: boolean | null;
  /** UI-selected Laravel URL (user_data laravel_api.current). */
  laravelStoredEndpoint: string | null;
  /** Last-known healthy Laravel URL the monitor/worker actually uses. */
  laravelActiveEndpoint: string | null;
  /** Age (seconds) of the monitor snapshot the reachability fields came from. */
  laravelSnapshotAgeS: number | null;
  localTaskTotal: number | null;
  localProcessing: number | null;
  translationPending: number | null;
  /** Shared voice auto-run statuses — consumed by the voice strip + panels so
   *  they no longer each poll getWordTtsAutoStatus/getSentenceAudioAutoStatus. */
  voiceWord: WordTtsAutoStatus | null;
  voiceSentence: SentenceAudioAutoStatus | null;
  /** Shared status/snapshot payloads for every Queue Center strip + panel, all
   *  fetched by the hub's single poll so no tab/strip fetches its own data. */
  workers: HeartbeatWorkersStatus | null;
  assist: AssistStatus | null;
  tts: TtsStatus | null;
  overview: PcQueueOverview | null;
  sentenceQueue: SentenceAudioQueueSnapshot | null;
  recent: PcTaskRecentResponse | null;
  timestamp: string | null;
  loading: boolean;
  error: string | null;
  refreshHub: () => void;
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
  timestamp: null,
  loading: true,
  error: null,
  refreshHub: () => {},
};

const QueueCenterHubContext = createContext<QueueCenterHubState>(defaultHub);

function parseHubPayload(raw: PcTaskCenterResponse | null): Omit<QueueCenterHubState, 'loading' | 'error' | 'refreshHub' | 'pycoreReachable' | 'voiceWord' | 'voiceSentence' | 'workers' | 'assist' | 'tts' | 'overview' | 'sentenceQueue' | 'recent'> {
  const remote = raw?.remote_queue;
  const local = raw?.local_tasks;
  const counts = local?.counts;
  const summary = remote?.summary;
  const stored = remote?.laravel_endpoint ?? null;
  const active = remote?.laravel_active_endpoint ?? stored;
  let localTaskTotal: number | null = null;
  if (counts) {
    localTaskTotal = (['pending', 'processing', 'completed', 'failed'] as const)
      .reduce((sum, key) => sum + (typeof counts[key] === 'number' ? counts[key]! : 0), 0);
  }
  return {
    laravelReachable: typeof remote?.laravel_reachable === 'boolean' ? remote.laravel_reachable : null,
    laravelStoredEndpoint: stored,
    laravelActiveEndpoint: active,
    laravelSnapshotAgeS: typeof remote?.laravel_snapshot_age_s === 'number' ? remote.laravel_snapshot_age_s : null,
    localTaskTotal,
    localProcessing: typeof counts?.processing === 'number' ? counts.processing : null,
    translationPending: typeof summary?.pending === 'number' ? summary.pending : null,
    timestamp: raw?.timestamp ?? null,
  };
}

export const QueueCenterHubProvider: React.FC<{ children: React.ReactNode; refreshTick?: number }> = ({
  children,
  refreshTick = 0,
}) => {
  const [hub, setHub] = useState<Omit<QueueCenterHubState, 'refreshHub'>>({
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
    timestamp: null,
    loading: true,
    error: null,
  });
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const poll = useCallback(async (silent = false) => {
    if (!silent) {
      setHub((prev) => ({ ...prev, loading: true }));
    }
    // ONE shared fetch for the whole page — every Queue Center strip + panel
    // reads its data from this hub instead of polling its own endpoint. allSettled
    // so any one sub-fetch failing never fails the hub, and a rejected sub-fetch
    // keeps the previous good value (keep()) instead of blanking the panel.
    const [tc, vw, vs, wk, as, tt, ov, sq, rc] = await Promise.allSettled([
      pycoreApi.getTaskCenter(),
      pycoreApi.getWordTtsAutoStatus(),
      pycoreApi.getSentenceAudioAutoStatus(),
      pycoreApi.getHeartbeatWorkersStatus(),
      pycoreApi.getAssistStatus(),
      pycoreApi.getTtsStatus(),
      pycoreApi.getQueueOverview(),
      pycoreApi.getSentenceAudioQueue(),
      pycoreApi.getRecentTasks({ limit: 200 }),
    ]);
    if (!mounted.current) return;
    // Surface rejected sub-fetches instead of swallowing them — a silently-kept
    // null previously made a backend failure indistinguishable from "no data".
    const names = ['taskCenter', 'wordTts', 'sentenceTts', 'workers', 'assist', 'tts', 'overview', 'sentenceQueue', 'recent'] as const;
    [tc, vw, vs, wk, as, tt, ov, sq, rc].forEach((r, i) => {
      if (r.status === 'rejected') console.warn(`[QueueCenterHub] ${names[i]} fetch failed:`, r.reason);
    });
    if (tc.status === 'fulfilled') {
      const keep = <T,>(r: PromiseSettledResult<T>, prev: T | null): T | null =>
        (r.status === 'fulfilled' ? r.value : prev);
      setHub((prev) => ({
        pycoreReachable: true,
        ...parseHubPayload(tc.value),
        voiceWord: keep(vw, prev.voiceWord),
        voiceSentence: keep(vs, prev.voiceSentence),
        workers: keep(wk, prev.workers),
        assist: keep(as, prev.assist),
        tts: keep(tt, prev.tts),
        overview: keep(ov, prev.overview),
        sentenceQueue: keep(sq, prev.sentenceQueue),
        recent: keep(rc, prev.recent),
        loading: false,
        error: null,
      }));
    } else {
      setHub((prev) => ({
        ...prev,
        pycoreReachable: false,
        loading: false,
        error: (tc.reason && tc.reason.message) || 'task-center unavailable',
      }));
    }
  }, []);

  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    void pollRef.current(false);
    const id = window.setInterval(() => { void pollRef.current(true); }, HUB_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (refreshTick > 0) void pollRef.current(true);
  }, [refreshTick]);

  const refreshHub = useCallback(() => { void pollRef.current(false); }, []);

  const value = useMemo<QueueCenterHubState>(
    () => ({ ...hub, refreshHub }),
    [hub, refreshHub],
  );

  return React.createElement(QueueCenterHubContext.Provider, { value }, children);
};

export function useQueueCenterHub(): QueueCenterHubState {
  return useContext(QueueCenterHubContext);
}

/** Laravel live sync is down; pycore itself is still up. */
export function laravelLiveSyncOffline(hub: QueueCenterHubState): boolean {
  return hub.pycoreReachable && hub.laravelReachable === false;
}

/** Selected URL differs from the active URL the monitor uses. */
export function laravelEndpointMismatch(hub: QueueCenterHubState): boolean {
  const stored = hub.laravelStoredEndpoint?.replace(/\/$/, '');
  const active = hub.laravelActiveEndpoint?.replace(/\/$/, '');
  return !!(stored && active && stored !== active);
}
