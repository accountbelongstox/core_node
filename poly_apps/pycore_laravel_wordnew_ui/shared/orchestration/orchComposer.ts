/**
 * One composition run on any end: inputs -> plan -> clip chain -> clip
 * durations -> per-segment timelines the stage plays. No ffmpeg: the timeline
 * is the segment; the sequencer plays its clips and the stage draws the video.
 * An end supplies its inputs, its clip-source chain and its duration memory.
 */
import {
  OrchCursorBook,
  resolveOrchClips,
  type OrchApiEndpoints,
  type OrchClipSource,
  type OrchResolveProgress,
  type OrchStageCursor,
  type OrchStageProgress,
} from './orchClipResolver';
import { OrchClipTable } from './orchClipTable';
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

/** Input load progress (sentences, then word read states). */
export interface OrchInputsProgress {
  sentences: number;
  sentencesTotal: number;
  words: number;
  wordsTotal: number;
}

export interface OrchComposeSession {
  planHash: string;
  phase: OrchComposePhase;
  inputsFresh: boolean;
  plan: OrchComposePlan | null;
  wordStates: ReadonlyMap<string, OrchWordState>;
  clips: ReadonlyMap<string, OrchResolvedClip>;
  counts: OrchResolveCounts;
  /**
   * Resolve state of every plan resource (one byte each, index = plan order);
   * the same object while a run goes on - `table.version` tells a change.
   */
  table: OrchClipTable | null;
  /** Stage cursors (how far each stage got on which endpoint), kept for the next run. */
  cursors: Record<string, OrchStageCursor>;
  /** Live transfer: bytes so far and the rate over the last RATE_WINDOW_MS (0 when idle). */
  transfer: { bytes: number; bytesPerSecond: number };
  /** APIs that actually answered this run (inputs and clips), by origin. */
  endpoints: OrchApiEndpoints;
  /** Per schedule stage: batches done / total and items asked / found this run. */
  stages: Record<string, OrchStageProgress>;
  /** Input load progress while phase is `inputs` (null before / for a kept copy). */
  inputsProgress: OrchInputsProgress | null;
  /** Clip durations known / needed (kept durations count at once; only new clips are probed). */
  measureProgress: { done: number; total: number } | null;
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
  loadInputs: (report: (progress: OrchInputsProgress) => void) => Promise<OrchComposeInputs>;
  sources: readonly OrchClipSource[];
  /** The plan is composed and the clips are about to resolve (an end may scope its clip chain by it; awaited). */
  onPlan?: (plan: OrchComposePlan) => Promise<void>;
  durations: OrchDurationMemory;
  signal?: AbortSignal;
  onUpdate: (session: OrchComposeSession) => void;
  /**
   * Kept state of an earlier run of the same plan, shown until this run
   * reports its own (a resumed run keeps its plan and timelines on screen).
   */
  seed?: {
    counts: OrchResolveCounts;
    /** OrchClipTable snapshot of the same plan (shown until this run reports). */
    table?: string;
    cursors?: Record<string, OrchStageCursor>;
    stages?: Record<string, OrchStageProgress>;
  } & Partial<Pick<OrchComposeSession, 'plan' | 'clips' | 'timelines' | 'wordStates'>>;
}

export const ORCH_EMPTY_COUNTS: OrchResolveCounts = { total: 0, device: 0, pycore: 0, laravel: 0, missing: 0, generating: 0, pending: 0 };
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

/**
 * Durations of the clips in plan order: kept durations are taken in one pass,
 * then only the clips without one are probed (PROBE_CONCURRENCY lanes);
 * `report` gets done / total after the pass and after every probe.
 */
async function measure(
  clips: OrchResolvedClip[],
  memory: OrchDurationMemory,
  report: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  const unknown: OrchResolvedClip[] = [];
  for (const clip of clips) {
    const ms = await memory.get(clip.key);
    if (ms) durations.set(clip.key, ms);
    else unknown.push(clip);
  }
  report(durations.size, clips.length);
  let cursor = 0;
  const lane = async (): Promise<void> => {
    while (cursor < unknown.length && !signal?.aborted) {
      const clip = unknown[cursor];
      cursor += 1;
      const ms = await probeClipDurationMs(clip.url);
      await memory.set(clip.key, ms);
      durations.set(clip.key, ms);
      report(durations.size, clips.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PROBE_CONCURRENCY, unknown.length) }, lane));
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
    table: deps.seed?.plan && deps.seed.table
      ? OrchClipTable.fromSnapshot(deps.seed.plan.resources.map((resource) => resource.key), deps.seed.table)
      : null,
    cursors: deps.seed?.cursors ?? {},
    transfer: { bytes: 0, bytesPerSecond: 0 },
    endpoints: {},
    stages: deps.seed?.stages ?? {},
    inputsProgress: null,
    measureProgress: null,
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

  const inputs = await deps.loadInputs((progress) => {
    if (!deps.signal?.aborted) publishThrottled({ inputsProgress: progress });
  });
  flushThrottled();
  checkpoint();
  // `inputsFresh` tells an empty source (fresh, nothing in it) from a failed load (no answer, no kept copy).
  if (inputs.sentences.length === 0) return publish({ phase: 'failed', inputsFresh: inputs.fresh, error: ORCH_ERROR_NO_SENTENCES });
  publish({
    phase: 'plan',
    inputsFresh: inputs.fresh,
    wordStates: inputs.wordStates,
    endpoints: inputs.laravelUrl ? { laravel: inputs.laravelUrl } : {},
  });

  const plan = planComposition(spec, inputs.sentences, inputs.wordStates);
  const keys = plan.resources.map((resource) => resource.key);
  // The kept state of this plan is shown at once (local first); the run then reports its own.
  const shown = session.table?.size === keys.length ? session.table
    : deps.seed?.table ? OrchClipTable.fromSnapshot(keys, deps.seed.table) : null;
  publish({
    phase: 'resolve',
    plan,
    table: shown,
    counts: shown ? { ...shown.counts() } : { ...ORCH_EMPTY_COUNTS, total: keys.length, pending: keys.length },
  });

  await deps.onPlan?.(plan);
  checkpoint();
  let latestProgress: OrchResolveProgress | null = null;
  let progressTimer: ReturnType<typeof setTimeout> | null = null;
  const flushProgress = (): void => {
    progressTimer = null;
    const progress = latestProgress;
    latestProgress = null;
    if (!progress || deps.signal?.aborted) return;
    // Same table / clips objects (no copy); counts are derived from the table here.
    publish({
      table: progress.table,
      counts: progress.table.counts(),
      // A resumed run's seed clips stay until this run delivered as many.
      clips: progress.clips.size >= (deps.seed?.clips?.size ?? 0) ? progress.clips : deps.seed?.clips ?? progress.clips,
      cursors: progress.cursors.toJSON(),
      transfer: { bytes: progress.transferredBytes, bytesPerSecond: rate(progress.transferredBytes) },
      endpoints: { ...session.endpoints, ...progress.endpoints },
      stages: { ...progress.stages },
    });
  };
  const resolved = await resolveOrchClips(plan.resources, deps.sources, {
    signal: deps.signal,
    meaningOf: (resource) => (resource.kind === 'word' ? inputs.wordStates.get(resource.text)?.meaning ?? '' : ''),
    cursors: new OrchCursorBook(deps.seed?.cursors),
    // The resolver reports once per clip (tens of thousands of times): a report only
    // keeps the live state, published at most once per PROGRESS_PUBLISH_MS.
    onProgress: (progress) => {
      if (deps.signal?.aborted) return;
      latestProgress = progress;
      progressTimer ??= setTimeout(flushProgress, PROGRESS_PUBLISH_MS);
    },
  });
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = null;
  flushThrottled();
  checkpoint();
  publish({
    phase: 'measure',
    table: resolved.table,
    counts: resolved.table.counts(),
    clips: resolved.clips,
    cursors: resolved.cursors.toJSON(),
    transfer: { bytes: resolved.transferredBytes, bytesPerSecond: 0 },
    endpoints: { ...session.endpoints, ...resolved.endpoints },
    stages: { ...resolved.stages },
  });

  const ordered = plan.resources.map((resource) => resolved.clips.get(resource.key)).filter((clip): clip is OrchResolvedClip => Boolean(clip));
  const durations = await measure(ordered, deps.durations, (done, total) => {
    if (!deps.signal?.aborted) publishThrottled({ measureProgress: { done, total } });
  }, deps.signal);
  flushThrottled();
  checkpoint();
  const byKey = new Map(plan.resources.map((resource) => [`${resource.kind}\u0000${resource.language}\u0000${resource.text}`, resource.key]));
  const timelines = plan.segments.map((segment) => buildTimeline(segment.items, (item) => {
    const key = byKey.get(`${item.kind}\u0000${item.language}\u0000${item.text}`) ?? '';
    const clip = resolved.clips.get(key);
    return clip ? { url: clip.url, durationMs: durations.get(key) ?? 0 } : null;
  }, ORCH_CLIP_GAP_MS));
  return publish({ phase: 'ready', timelines });
}
