/**
 * AudioLaneStateStore — the ONE UI copy of pycore's audio lane truth.
 *
 * Every audio lane of the contract (word_audio, sentence_audio, phrase_audio)
 * owns a Queue = Part1 + Part2 in pycore. Pycore composes their state (switch, lifecycle, section contract,
 * Part1/Part2/whole-Queue view, Part1 tracker, worker, full pull) and pushes
 * it on every change through the `queue_center.audio_lane.changed` topic.
 * This store applies:
 *   - pushed payloads (direct SSE),
 *   - the RPC answer (mount, server restart / replay loss, relay polling),
 *   - control responses (`lane_state` of set_queue_center_control),
 * guarded by the pycore instance + monotonic revision so an older payload
 * never overwrites a newer one. Components render from it and send intents;
 * they never keep a second copy.
 *
 * Owner views (one orchestration task's missing words/sentences) are fetched
 * on demand and re-fetched when the lane revision moves. `error` holds a
 * pycore error code; views localize it and never render raw text.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pycoreApi } from '../../../core/integrations/pycore/PycoreApi';
import { createPycoreLiveSource } from '../../../core/integrations/pycore/PycoreLiveSource';
import { PYCORE_EVENT_TOPICS } from '../../../core/integrations/pycore/PycoreEventTopics';
import { PYCORE_HTTP_DEFAULTS } from '../../../core/integrations/pycore/PycoreNetwork';
import type {
  AudioLaneKey,
  AudioLaneQueueView,
  AudioLaneStatePayload,
} from '../../../core/contracts/QueueCenterTypes';
import { PC_REQUEST_FAILED_CODE, pcFailureCode } from '../utils/pcErrorCodes';
import { createRuntimeStore } from '../../../core/persistence/RuntimeStore';
import { PC_AUDIO_LANES } from '../utils/pcAudioLanes';

const OWNER_REFETCH_DEBOUNCE_MS = 800;
const OWNER_ITEM_LIMIT = 30;

export interface AudioLaneStoreState {
  payload: AudioLaneStatePayload | null;
  loading: boolean;
  error: string | null;
  receivedAt: number;
}

const store = createRuntimeStore<AudioLaneStoreState>({
  defaults: () => ({ payload: null, loading: false, error: null, receivedAt: 0 }),
  errorFallback: PC_REQUEST_FAILED_CODE,
});

let fetchInFlight: Promise<void> | null = null;

function setState(next: AudioLaneStoreState): void {
  store.patch(next);
}

function laneFailureCode(payload: AudioLaneStatePayload | null | undefined): string {
  return pcFailureCode(payload) || PC_REQUEST_FAILED_CODE;
}

/** Identity of every lane Queue's state: it moves on every Part1/Part2 change of any lane. */
export function audioLaneRevisionKey(payload: AudioLaneStatePayload | null | undefined): string {
  const revisions = PC_AUDIO_LANES.map((lane) => payload?.lanes?.[lane]?.queue?.revision ?? 0);
  return `${payload?.instance ?? ''}:${revisions.join(':')}`;
}

export function getAudioLaneStoreState(): AudioLaneStoreState {
  return store.getState();
}

export function subscribeAudioLaneStore(listener: () => void): () => void {
  return store.subscribe(listener);
}

/**
 * Apply one lane-state payload (push / RPC / control response). Returns false
 * when it is older than the held payload of the same pycore instance.
 */
export function applyAudioLaneState(payload: AudioLaneStatePayload | null | undefined): boolean {
  if (!payload || payload.success === false || !payload.lanes) return false;
  const held = store.getState().payload;
  if (held && held.instance === payload.instance && payload.revision < held.revision) return false;
  setState({ payload, loading: false, error: null, receivedAt: Date.now() });
  return true;
}

export function refreshAudioLaneState(): Promise<void> {
  if (fetchInFlight) return fetchInFlight;
  if (!store.getState().payload) setState({ ...store.getState(), loading: true });
  fetchInFlight = pycoreApi.audioLaneState()
    .then((payload) => {
      if (!applyAudioLaneState(payload) && payload?.success === false) {
        setState({ ...store.getState(), loading: false, error: laneFailureCode(payload) });
      }
    })
    .catch(() => {
      setState({ ...store.getState(), loading: false, error: PC_REQUEST_FAILED_CODE });
    })
    .finally(() => {
      fetchInFlight = null;
      if (store.getState().loading) setState({ ...store.getState(), loading: false });
    });
  return fetchInFlight;
}

const liveSource = createPycoreLiveSource({
  topics: {
    [PYCORE_EVENT_TOPICS.queueCenterAudioLaneChanged]: (payload: AudioLaneStatePayload) => { applyAudioLaneState(payload); },
  },
  refresh: refreshAudioLaneState,
  fallbackMs: PYCORE_HTTP_DEFAULTS.fallbackPollMs,
});

/** Live audio lane state; mounting keeps the push subscription alive. */
export function useAudioLaneState(): AudioLaneStoreState {
  useEffect(() => {
    liveSource.retain();
    return liveSource.release;
  }, []);
  return useSyncExternalStore(subscribeAudioLaneStore, getAudioLaneStoreState, getAudioLaneStoreState);
}

export interface AudioLaneOwnerViews {
  views: Partial<Record<AudioLaneKey, AudioLaneQueueView>>;
  loading: boolean;
  error: string | null;
}

/**
 * One owner's (orchestration task's) Part1/Part2/Queue views of EVERY audio
 * lane: its missing words in the word_audio Queue, its missing sentences in
 * the sentence_audio Queue, its missing phrases in the phrase_audio Queue.
 * Re-fetched when the lane revision moves; a move that
 * arrives while a fetch is in flight schedules one trailing fetch, and every
 * fetch exit (also after the effect was cleaned up) ends the loading state.
 */
export function useAudioLaneOwnerViews(owner: string, active: boolean): AudioLaneOwnerViews {
  const lanes = useAudioLaneState();
  const [result, setResult] = useState<AudioLaneOwnerViews>({ views: {}, loading: false, error: null });
  const [trailingTick, setTrailingTick] = useState(0);
  const inFlight = useRef(false);
  const trailingFetch = useRef(false);
  const revisionKey = audioLaneRevisionKey(lanes.payload);

  useEffect(() => {
    setResult({ views: {}, loading: false, error: null });
  }, [owner]);

  useEffect(() => {
    if (!active || !owner) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (inFlight.current) {
        trailingFetch.current = true;
        return;
      }
      inFlight.current = true;
      trailingFetch.current = false;
      setResult((previous) => ({ ...previous, loading: Object.keys(previous.views).length === 0 }));
      pycoreApi.audioLaneState(owner, OWNER_ITEM_LIMIT)
        .then((payload) => {
          if (cancelled) return;
          if (!payload?.lanes) {
            setResult((previous) => ({ ...previous, error: laneFailureCode(payload) }));
            return;
          }
          setResult({
            views: Object.fromEntries(PC_AUDIO_LANES.map((lane) => [lane, payload.lanes[lane]?.queue])),
            loading: false,
            error: null,
          });
        })
        .catch(() => {
          if (!cancelled) setResult((previous) => ({ ...previous, error: PC_REQUEST_FAILED_CODE }));
        })
        .finally(() => {
          inFlight.current = false;
          setResult((previous) => (previous.loading ? { ...previous, loading: false } : previous));
          if (trailingFetch.current) {
            trailingFetch.current = false;
            setTrailingTick((tick) => tick + 1);
          }
        });
    }, OWNER_REFETCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [owner, active, revisionKey, trailingTick]);

  return result;
}
