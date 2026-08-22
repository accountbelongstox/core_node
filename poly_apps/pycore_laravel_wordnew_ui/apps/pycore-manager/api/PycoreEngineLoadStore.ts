/**
 * PycoreEngineLoadStore — shared live model-load progress for every speech engine
 * (TTS + STT, class-B in-process models and class-C HTTP servers).
 *
 * The backend exposes GET /api/local/engines/load-status (authoritative snapshot)
 * and also publishes per-engine deltas through the HTTP event journal as the
 * 'engine_load_status_update' event. This store multiplexes BOTH: it subscribes to
 * the HTTP event for instant state transitions, and it fast-polls the endpoint only
 * while a load is relevant — a consumer explicitly asks (a test popup open) or any
 * engine is currently 'loading' (so the per-service log tail streams live, which
 * the event delta does not carry between transitions).
 *
 * Presentational consumers: PcTestPopup (live load view) and PcPipelineStatusPanels
 * (per-tile loading/error badges). One store, single-flight polling.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { pycoreApi } from '../../../core/integrations/pycore/PycoreApi';
import { subscribe } from '../../../core/integrations/pycore/PycoreHttp';
import { PYCORE_EVENT_TOPICS } from '../../../core/integrations/pycore/PycoreEventTopics';
import { PYCORE_BROWSER_EVENTS, PYCORE_HTTP_DEFAULTS } from '../../../core/integrations/pycore/PycoreNetwork';
import type {
  EngineLoadStatusEntry,
  EngineLoadState,
} from '../../../core/integrations/pycore/PycoreSpeechTypes';

export const PYCORE_ENGINE_LOAD_EVENT = PYCORE_BROWSER_EVENTS.engineLoadChanged;

export interface PycoreEngineLoadState {
  engines: Record<string, EngineLoadStatusEntry>;
  updatedAt: number;
}

let state: PycoreEngineLoadState = { engines: {}, updatedAt: 0 };

let subscribers = 0;         // mounted hooks drive event subscription lifetime
let explicitPollRefs = 0;    // consumers that force polling (e.g. an open test popup)
let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;
let eventOff: (() => void) | null = null;

function notify(): void {
  window.dispatchEvent(new CustomEvent(PYCORE_ENGINE_LOAD_EVENT));
}

export function getPycoreEngineLoadState(): PycoreEngineLoadState {
  return state;
}

export function subscribePycoreEngineLoad(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(PYCORE_ENGINE_LOAD_EVENT, handler);
  return () => window.removeEventListener(PYCORE_ENGINE_LOAD_EVENT, handler);
}

function anyLoading(): boolean {
  for (const key in state.engines) {
    if (state.engines[key]?.state === 'loading') return true;
  }
  return false;
}

/** Poll while mounted AND (a consumer forced it OR an engine is loading). */
function shouldPoll(): boolean {
  return subscribers > 0 && (explicitPollRefs > 0 || anyLoading());
}

function syncPollLoop(): void {
  if (shouldPoll()) {
    if (!pollTimer) {
      pollTimer = setInterval(() => { void pollOnce(); }, PYCORE_HTTP_DEFAULTS.engineLoadPollMs);
    }
  } else if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollOnce(): Promise<void> {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const res = await pycoreApi.getEnginesLoadStatus();
    if (res && res.success !== false && res.engines) {
      // Endpoint is authoritative — replace the whole map (freshest tail + elapsed).
      state = { engines: res.engines, updatedAt: Date.now() };
      notify();
    }
  } catch {
    // Best-effort: keep the last snapshot on a transient failure.
  } finally {
    pollInFlight = false;
    syncPollLoop(); // a poll may have cleared/added a loading engine — re-evaluate.
  }
}

function normalizeEntry(data: any): EngineLoadStatusEntry | null {
  if (!data || typeof data.name !== 'string') return null;
  return {
    name: data.name,
    state: (data.state as EngineLoadState) || 'idle',
    message: typeof data.message === 'string' ? data.message : '',
    device: typeof data.device === 'string' ? data.device : '',
    started_at: typeof data.started_at === 'number' ? data.started_at : null,
    updated_at: typeof data.updated_at === 'number' ? data.updated_at : null,
    elapsed_ms: typeof data.elapsed_ms === 'number' ? data.elapsed_ms : 0,
    log_tail: Array.isArray(data.log_tail) ? data.log_tail.map((l: unknown) => String(l)) : [],
  };
}

function onHttpUpdate(data: any): void {
  const entry = normalizeEntry(data);
  if (!entry) return;
  state = { engines: { ...state.engines, [entry.name]: entry }, updatedAt: Date.now() };
  notify();
  // A fresh 'loading' delta kicks off the fast poll so the log tail streams live.
  syncPollLoop();
}

function retain(): void {
  subscribers += 1;
  if (subscribers === 1) {
    eventOff = subscribe(PYCORE_EVENT_TOPICS.engineLoadStatusUpdate, onHttpUpdate);
    void pollOnce(); // one-shot seed so tiles reflect an in-progress load on mount.
  }
  syncPollLoop();
}

function release(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers === 0 && eventOff) {
    eventOff();
    eventOff = null;
  }
  syncPollLoop();
}

function acquireExplicitPoll(): void { explicitPollRefs += 1; syncPollLoop(); }
function releaseExplicitPoll(): void {
  explicitPollRefs = Math.max(0, explicitPollRefs - 1);
  syncPollLoop();
}

export interface PycoreEngineLoadHook {
  engines: Record<string, EngineLoadStatusEntry>;
  /** Live load-status for one engine, or null when it has never reported a load. */
  getEngine: (name: string) => EngineLoadStatusEntry | null;
}

/**
 * Subscribe to the shared engine-load store. Pass `pollActive` = true while a load
 * is relevant to this consumer (e.g. a test popup running) to force the fast poll;
 * otherwise the store still fast-polls on its own whenever any engine is loading.
 */
export function usePcEngineLoadStatus(pollActive = false): PycoreEngineLoadHook {
  useEffect(() => {
    retain();
    return () => release();
  }, []);

  useEffect(() => {
    if (!pollActive) return undefined;
    acquireExplicitPoll();
    return () => releaseExplicitPoll();
  }, [pollActive]);

  const snap = useSyncExternalStore(
    subscribePycoreEngineLoad,
    getPycoreEngineLoadState,
    getPycoreEngineLoadState,
  );

  const getEngine = useCallback(
    (name: string): EngineLoadStatusEntry | null => snap.engines[name] ?? null,
    [snap],
  );

  return useMemo(() => ({ engines: snap.engines, getEngine }), [snap, getEngine]);
}
