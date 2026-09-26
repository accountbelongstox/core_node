/**
 * AudioLaneStateStore — the ONE UI copy of pycore's audio lane truth.
 *
 * Both lanes (word_audio, sentence_audio) each own a Queue = Part1 + Part2 in
 * pycore. Pycore composes their state (switch, lifecycle, section contract,
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
 * on demand and re-fetched when the lane revision moves.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pycoreApi } from '../../../core/integrations/pycore/PycoreApi';
import { subscribe } from '../../../core/integrations/pycore/PycoreHttp';
import { PYCORE_EVENT_TOPICS } from '../../../core/integrations/pycore/PycoreEventTopics';
import { PYCORE_BROWSER_EVENTS, PYCORE_HTTP_DEFAULTS } from '../../../core/integrations/pycore/PycoreNetwork';
import { isPycoreRelayMode } from '../../../core/integrations/pycore/pycoreTarget';
import type {
  AudioLaneKey,
  AudioLaneQueueView,
  AudioLaneStatePayload,
} from '../../../core/contracts/QueueCenterTypes';

/** Relay mode has no pycore SSE stream: poll the (small) lane state instead. */
const RELAY_POLL_MS = 5_000;
const OWNER_REFETCH_DEBOUNCE_MS = 800;
const OWNER_ITEM_LIMIT = 30;

export interface AudioLaneStoreState {
  payload: AudioLaneStatePayload | null;
  loading: boolean;
  error: string | null;
  receivedAt: number;
}

let state: AudioLaneStoreState = { payload: null, loading: false, error: null, receivedAt: 0 };
const listeners = new Set<() => void>();
let subscribers = 0;
let fetchInFlight: Promise<void> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let eventOffs: Array<() => void> = [];

function emit(): void {
  listeners.forEach((listener) => listener());
}

function setState(next: AudioLaneStoreState): void {
  state = next;
  emit();
}

export function getAudioLaneStoreState(): AudioLaneStoreState {
  return state;
}

export function subscribeAudioLaneStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Apply one lane-state payload (push / RPC / control response). Returns false
 * when it is older than the held payload of the same pycore instance.
 */
export function applyAudioLaneState(payload: AudioLaneStatePayload | null | undefined): boolean {
  if (!payload || payload.success === false || !payload.lanes) return false;
  const held = state.payload;
  if (held && held.instance === payload.instance && payload.revision < held.revision) return false;
  setState({ payload, loading: false, error: null, receivedAt: Date.now() });
  return true;
}

export function refreshAudioLaneState(): Promise<void> {
  if (fetchInFlight) return fetchInFlight;
  if (!state.payload) setState({ ...state, loading: true });
  fetchInFlight = pycoreApi.audioLaneState()
    .then((payload) => {
      if (!applyAudioLaneState(payload) && payload?.success === false) {
        setState({ ...state, loading: false, error: payload.error || null });
      }
    })
    .catch((error: unknown) => {
      setState({ ...state, loading: false, error: error instanceof Error ? error.message : String(error) });
    })
    .finally(() => {
      fetchInFlight = null;
      if (state.loading) setState({ ...state, loading: false });
    });
  return fetchInFlight;
}

function retain(): void {
  subscribers += 1;
  if (subscribers > 1) return;
  eventOffs = [
    subscribe(PYCORE_EVENT_TOPICS.queueCenterAudioLaneChanged, (payload: AudioLaneStatePayload) => {
      applyAudioLaneState(payload);
    }),
    subscribe(PYCORE_BROWSER_EVENTS.httpEventServerRestarted, () => { void refreshAudioLaneState(); }),
    subscribe(PYCORE_BROWSER_EVENTS.httpEventReplayLost, () => { void refreshAudioLaneState(); }),
  ];
  void refreshAudioLaneState();
  pollTimer = setInterval(() => {
    void refreshAudioLaneState();
  }, isPycoreRelayMode() ? RELAY_POLL_MS : PYCORE_HTTP_DEFAULTS.fallbackPollMs);
}

function release(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0) return;
  eventOffs.forEach((off) => off());
  eventOffs = [];
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/** Live two-lane state; mounting keeps the push subscription alive. */
export function useAudioLaneState(): AudioLaneStoreState {
  useEffect(() => {
    retain();
    return release;
  }, []);
  return useSyncExternalStore(subscribeAudioLaneStore, getAudioLaneStoreState, getAudioLaneStoreState);
}

export interface AudioLaneOwnerViews {
  views: Partial<Record<AudioLaneKey, AudioLaneQueueView>>;
  loading: boolean;
  error: string | null;
}

/**
 * One owner's (orchestration task's) Part1/Part2/Queue views of BOTH lanes:
 * its missing words in the word_audio Queue, its missing sentences in the
 * sentence_audio Queue. Re-fetched when the lane revision moves.
 */
export function useAudioLaneOwnerViews(owner: string, active: boolean): AudioLaneOwnerViews {
  const lanes = useAudioLaneState();
  const [result, setResult] = useState<AudioLaneOwnerViews>({ views: {}, loading: false, error: null });
  const inFlight = useRef(false);
  const revisionKey = `${lanes.payload?.instance ?? ''}:${lanes.payload?.lanes?.word_audio?.queue?.revision ?? 0}:${lanes.payload?.lanes?.sentence_audio?.queue?.revision ?? 0}`;

  useEffect(() => {
    if (!active || !owner) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (inFlight.current) return;
      inFlight.current = true;
      setResult((previous) => ({ ...previous, loading: Object.keys(previous.views).length === 0 }));
      pycoreApi.audioLaneState(owner, OWNER_ITEM_LIMIT)
        .then((payload) => {
          if (cancelled) return;
          if (!payload?.lanes) {
            setResult((previous) => ({ ...previous, loading: false, error: payload?.error || null }));
            return;
          }
          setResult({
            views: {
              word_audio: payload.lanes.word_audio?.queue,
              sentence_audio: payload.lanes.sentence_audio?.queue,
            },
            loading: false,
            error: null,
          });
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setResult((previous) => ({
              ...previous,
              loading: false,
              error: error instanceof Error ? error.message : String(error),
            }));
          }
        })
        .finally(() => { inFlight.current = false; });
    }, OWNER_REFETCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [owner, active, revisionKey]);

  return result;
}
