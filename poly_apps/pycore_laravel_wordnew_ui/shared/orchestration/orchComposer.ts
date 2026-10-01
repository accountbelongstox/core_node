/**
 * One composition run on any end: inputs -> plan -> clip chain -> clip
 * durations -> per-segment timelines the stage plays. No ffmpeg: the timeline
 * is the segment; the sequencer plays its clips and the stage draws the video.
 * An end supplies its inputs, its clip-source chain and its duration memory.
 */
import { resolveOrchClips, type OrchApiEndpoints, type OrchClipSource, type OrchResolveItem } from './orchClipResolver';
import { ORCH_CLIP_GAP_MS, planComposition } from './orchPlanner';
import { buildTimeline, type OrchTimelineEntry } from './orchStageLayout';
import type {
  OrchComposePlan,
  OrchComposeSentence,
  OrchComposeSpec,
  OrchResolveCounts,
  OrchResolvedClip,
  OrchWordState,
} from './orchTypes';

export type OrchComposePhase = 'inputs' | 'plan' | 'resolve' | 'measure' | 'ready' | 'failed';

/** Thrown by runComposition when its signal aborts: an aborted run never reports `ready`. */
export const ORCH_COMPOSE_ABORTED = 'ORCH_COMPOSE_ABORTED';

export function isOrchComposeAborted(error: unknown): boolean {
  return (error as Error)?.message === ORCH_COMPOSE_ABORTED;
}

export interface OrchComposeInputs {
  sentences: OrchComposeSentence[];
  wordStates: Map<string, OrchWordState>;
  /** False when the live source was unreachable and a kept copy was used. */
  fresh: boolean;
  /** Base URL of the Laravel API the inputs were just loaded from ('' for a kept copy). */
  laravelUrl?: string;
}

export interface OrchComposeSession {
  planHash: string;
  phase: OrchComposePhase;
  inputsFresh: boolean;
  plan: OrchComposePlan | null;
  wordStates: ReadonlyMap<string, OrchWordState>;
  clips: ReadonlyMap<string, OrchResolvedClip>;
  counts: OrchResolveCounts;
  /** Per-item resolve state (plan order): source, bytes, done / missing. */
  items: ReadonlyMap<string, OrchResolveItem>;
  /** Live transfer: bytes so far and the rate over the last RATE_WINDOW_MS (0 when idle). */
  transfer: { bytes: number; bytesPerSecond: number };
  /** APIs that actually answered this run (inputs and clips), by origin. */
  endpoints: OrchApiEndpoints;
  /** Per segment (plan order): the playable timeline. */
  timelines: OrchTimelineEntry[][];
  /** i18n key of the failure. */
  error: string;
}

/** Clip durations an end remembers (probing a clip costs a media load). */
export interface OrchDurationMemory {
  get(key: string): Promise<number>;
  set(key: string, durationMs: number): Promise<void>;
}

export interface OrchComposeDeps {
  loadInputs: () => Promise<OrchComposeInputs>;
  sources: readonly OrchClipSource[];
  durations: OrchDurationMemory;
  signal?: AbortSignal;
  onUpdate: (session: OrchComposeSession) => void;
  /**
   * Kept state of an earlier run of the same plan, shown until this run
   * reports its own (a resumed run keeps its plan and timelines on screen).
   */
  seed?: Pick<OrchComposeSession, 'counts' | 'items'> & Partial<Pick<OrchComposeSession, 'plan' | 'clips' | 'timelines' | 'wordStates'>>;
}

export const ORCH_EMPTY_COUNTS: OrchResolveCounts = { total: 0, device: 0, pycore: 0, laravel: 0, missing: 0, pending: 0 };
export const ORCH_ERROR_NO_SENTENCES = 'orchCompose.error.noSentences';

const PROBE_CONCURRENCY = 6;
const PROGRESS_PUBLISH_MS = 150;
const RATE_WINDOW_MS = 5_000;
const PROBE_TIMEOUT_MS = 15_000;

/** Duration of a playable clip from its media metadata (0 when unreadable). */
export function probeClipDurationMs(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const finish = (value: number): void => {
      clearTimeout(timer);
      audio.removeAttribute('src');
      audio.load();
      resolve(value);
    };
    const timer = setTimeout(() => finish(0), PROBE_TIMEOUT_MS);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
    audio.onerror = () => finish(0);
    audio.src = url;
  });
}

async function measure(clips: OrchResolvedClip[], memory: OrchDurationMemory, signal?: AbortSignal): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  let cursor = 0;
  const lane = async (): Promise<void> => {
    while (cursor < clips.length && !signal?.aborted) {
      const clip = clips[cursor];
      cursor += 1;
      let ms = await memory.get(clip.key);
      if (!ms) {
        ms = await probeClipDurationMs(clip.url);
        await memory.set(clip.key, ms);
      }
      durations.set(clip.key, ms);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, clips.length) }, lane));
  return durations;
}

export function totalDurationMs(timelines: OrchTimelineEntry[][]): number {
  return timelines.reduce((total, timeline) => total + (timeline[timeline.length - 1]?.endMs ?? 0), 0);
}

export async function runComposition(spec: OrchComposeSpec, planHash: string, deps: OrchComposeDeps): Promise<OrchComposeSession> {
  let session: OrchComposeSession = {
    planHash,
    phase: 'inputs',
    inputsFresh: false,
    plan: deps.seed?.plan ?? null,
    wordStates: deps.seed?.wordStates ?? new Map(),
    clips: deps.seed?.clips ?? new Map(),
    counts: deps.seed?.counts ?? ORCH_EMPTY_COUNTS,
    items: deps.seed?.items ?? new Map(),
    transfer: { bytes: 0, bytesPerSecond: 0 },
    endpoints: {},
    timelines: deps.seed?.timelines ?? [],
    error: '',
  };
  const publish = (patch: Partial<OrchComposeSession>): OrchComposeSession => {
    session = { ...session, ...patch };
    deps.onUpdate(session);
    return session;
  };
  // Byte progress arrives many times a second: publish at most every PROGRESS_PUBLISH_MS.
  let pendingPatch: Partial<OrchComposeSession> | null = null;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  const flushThrottled = (): void => {
    if (throttleTimer) clearTimeout(throttleTimer);
    throttleTimer = null;
    if (pendingPatch) publish(pendingPatch);
    pendingPatch = null;
  };
  const publishThrottled = (patch: Partial<OrchComposeSession>): void => {
    pendingPatch = { ...(pendingPatch ?? {}), ...patch };
    throttleTimer ??= setTimeout(flushThrottled, PROGRESS_PUBLISH_MS);
  };
  // Transfer rate over a sliding window of byte samples.
  const samples: Array<[number, number]> = [];
  const rate = (bytes: number): number => {
    const now = Date.now();
    samples.push([now, bytes]);
    while (samples.length > 1 && now - samples[0][0] > RATE_WINDOW_MS) samples.shift();
    const [since, base] = samples[0];
    return now > since ? Math.round(((bytes - base) * 1000) / (now - since)) : 0;
  };
  const checkpoint = (): void => {
    if (deps.signal?.aborted) throw new Error(ORCH_COMPOSE_ABORTED);
  };
  publish({});

  const inputs = await deps.loadInputs();
  checkpoint();
  if (inputs.sentences.length === 0) return publish({ phase: 'failed', error: ORCH_ERROR_NO_SENTENCES });
  publish({
    phase: 'plan',
    inputsFresh: inputs.fresh,
    wordStates: inputs.wordStates,
    endpoints: inputs.laravelUrl ? { laravel: inputs.laravelUrl } : {},
  });

  const plan = planComposition(spec, inputs.sentences, inputs.wordStates);
  publish({
    phase: 'resolve',
    plan,
    counts: deps.seed ? session.counts : { ...ORCH_EMPTY_COUNTS, total: plan.resources.length, pending: plan.resources.length },
  });

  const resolved = await resolveOrchClips(plan.resources, deps.sources, {
    signal: deps.signal,
    meaningOf: (resource) => (resource.kind === 'word' ? inputs.wordStates.get(resource.text)?.meaning ?? '' : ''),
    onProgress: (progress) => {
      if (deps.signal?.aborted) return;
      publishThrottled({
        counts: progress.counts,
        // Clips of a resumed run's seed stay until this run delivers its own.
        clips: new Map([...(deps.seed?.clips ?? []), ...progress.clips]),
        items: new Map(progress.items),
        transfer: { bytes: progress.transferredBytes, bytesPerSecond: rate(progress.transferredBytes) },
        endpoints: { ...session.endpoints, ...progress.endpoints },
      });
    },
  });
  flushThrottled();
  checkpoint();
  publish({
    phase: 'measure',
    counts: resolved.counts,
    clips: new Map(resolved.clips),
    items: new Map(resolved.items),
    transfer: { bytes: resolved.transferredBytes, bytesPerSecond: 0 },
    endpoints: { ...session.endpoints, ...resolved.endpoints },
  });

  const durations = await measure([...resolved.clips.values()], deps.durations, deps.signal);
  checkpoint();
  const byKey = new Map(plan.resources.map((resource) => [`${resource.kind}\u0000${resource.language}\u0000${resource.text}`, resource.key]));
  const timelines = plan.segments.map((segment) => buildTimeline(segment.items, (item) => {
    const key = byKey.get(`${item.kind}\u0000${item.language}\u0000${item.text}`) ?? '';
    const clip = resolved.clips.get(key);
    return clip ? { url: clip.url, durationMs: durations.get(key) ?? 0 } : null;
  }, ORCH_CLIP_GAP_MS));
  return publish({ phase: 'ready', timelines });
}
