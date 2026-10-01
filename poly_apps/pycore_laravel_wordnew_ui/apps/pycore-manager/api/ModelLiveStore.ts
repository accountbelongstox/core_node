/**
 * ModelLiveStore — the ONE UI copy of pycore's live model monitor (qwen3tts
 * queue, kokoro word batch, per-engine load, system CPU/RAM/GPU).
 *
 * Pycore's sampler publishes the snapshot through the `model_live.changed`
 * topic (<= 1 Hz) only while a UI client watches or a job is active. This store
 * applies pushed payloads and the RPC answer (mount, server restart, replay
 * loss, relay polling), guarded by `sampled_at` so an older payload never
 * overwrites a newer one. While any consumer is mounted it renews the
 * `ui/model_live/watch` keep-alive; the last consumer withdraws it.
 */
import { useEffect } from 'react';
import { pycoreApi } from '../../../core/integrations/pycore/PycoreApi';
import { aiHubData, aiHubFailureCode } from '../../../core/integrations/pycore/PycoreApiAiHub';
import { createPycoreLiveSource } from '../../../core/integrations/pycore/PycoreLiveSource';
import { PYCORE_EVENT_TOPICS } from '../../../core/integrations/pycore/PycoreEventTopics';
import { PYCORE_HTTP_DEFAULTS } from '../../../core/integrations/pycore/PycoreNetwork';
import type { ModelLiveSnapshot } from '../../../core/integrations/pycore/PycoreAiHubTypes';
import { PC_REQUEST_FAILED_CODE } from '../utils/pcErrorCodes';
import { createPcExternalStore } from './PcExternalStore';

const WATCH_TTL_SECONDS = 30;
const WATCH_RENEW_MS = 10_000;
const STALE_AFTER_MS = 6_000;

export interface ModelLiveState {
  snapshot: ModelLiveSnapshot | null;
  loading: boolean;
  error: string | null;
  receivedAt: number;
}

const store = createPcExternalStore<ModelLiveState>({
  snapshot: null, loading: false, error: null, receivedAt: 0,
});

let fetchInFlight: Promise<void> | null = null;
let watchTimer: ReturnType<typeof setInterval> | null = null;

export function getModelLiveState(): ModelLiveState {
  return store.get();
}

/** True when the last snapshot is older than the sampler cadence allows. */
export function isModelLiveStale(state: ModelLiveState, now: number = Date.now()): boolean {
  return state.receivedAt > 0 && now - state.receivedAt > STALE_AFTER_MS;
}

/** Apply one snapshot (push / RPC). Returns false when it is older than the held one. */
export function applyModelLiveSnapshot(payload: unknown): boolean {
  const data = aiHubData<ModelLiveSnapshot>(payload as ModelLiveSnapshot);
  if (!data) return false;
  const held = store.get().snapshot;
  if (held?.sampled_at && data.sampled_at && data.sampled_at < held.sampled_at) return false;
  store.set({ snapshot: data, loading: false, error: null, receivedAt: Date.now() });
  return true;
}

export function refreshModelLive(): Promise<void> {
  if (fetchInFlight) return fetchInFlight;
  if (!store.get().snapshot) store.set((state) => ({ ...state, loading: true }));
  fetchInFlight = pycoreApi.getModelLiveSnapshot()
    .then((answer) => {
      if (!applyModelLiveSnapshot(answer)) {
        store.set((state) => ({ ...state, loading: false, error: aiHubFailureCode(answer) || PC_REQUEST_FAILED_CODE }));
      }
    })
    .catch(() => {
      store.set((state) => ({ ...state, loading: false, error: PC_REQUEST_FAILED_CODE }));
    })
    .finally(() => { fetchInFlight = null; });
  return fetchInFlight;
}

function renewWatch(): void {
  void pycoreApi.watchModelLive(true, WATCH_TTL_SECONDS).catch(() => undefined);
}

const liveSource = createPycoreLiveSource({
  topics: { [PYCORE_EVENT_TOPICS.modelLiveChanged]: (payload: unknown) => { applyModelLiveSnapshot(payload); } },
  refresh: refreshModelLive,
  fallbackMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs,
  onServerRestart: renewWatch,
  onRetain: () => {
    renewWatch();
    watchTimer = setInterval(renewWatch, WATCH_RENEW_MS);
  },
  onRelease: () => {
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = null;
    void pycoreApi.watchModelLive(false).catch(() => undefined);
  },
});

/** Live model monitor; mounting (while `active`) keeps the push subscription and watch keep-alive. */
export function usePcModelLive(active = true): ModelLiveState {
  useEffect(() => {
    if (!active) return undefined;
    liveSource.retain();
    return liveSource.release;
  }, [active]);
  return store.use();
}
