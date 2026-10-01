/**
 * Clip resolution as an ordered chain of sources: each source resolves what it
 * can of the resources the earlier ones left, a resource none resolves is
 * missing. The chain comes from the clip scheduler (orchClipScheduler).
 *
 * State lives in an OrchClipTable (one byte per plan resource, the plan's
 * resource array is the mapping): reports carry the same table and clips map,
 * nothing is copied per report - a view copies at most once per publish.
 * Per stage, a cursor book keeps how far the stage got on which endpoint and
 * when (OrchCursorBook), so a resumed run continues instead of re-asking.
 */
import { AUDIO_ORCH_TRANSFER } from '../../core/contracts/AudioOrchestrationContract';
import { OrchClipTable, type OrchClipTableCounts } from './orchClipTable';
import type {
  OrchChannelId,
  OrchClipOrigin,
  OrchComposeResource,
  OrchResolvedClip,
} from './orchTypes';

export const ORCH_RESOLVE_CONCURRENCY = 4;

/** Network origins of clip sources (the device store is local). */
export type OrchApiOrigin = 'pycore' | 'laravel';

/** Per network origin: the base URL of the API that last answered this run. */
export type OrchApiEndpoints = Partial<Record<OrchApiOrigin, string>>;

/** One schedule stage's work in a run (batches = network requests of bundled transfers). */
export interface OrchStageProgress {
  state: 'running' | 'done' | 'skipped';
  batches: number;
  batchesDone: number;
  /** Resources the stage asked its channel about this run. */
  asked: number;
  /** Delivered (transfer) or flagged to generate (generate). */
  found: number;
  /** Left out: below the stage's fresh cursor (asked recently on this endpoint). */
  known: number;
}

/** How far a stage got (a plan index) on one endpoint, and when. */
export interface OrchStageCursor {
  endpoint: string;
  position: number;
  at: number;
}

/**
 * Per stage: everything below `position` (plan order) was asked on `endpoint`
 * at `at`. Within `transfer.absence_recheck_minutes` a stage skips those; another
 * endpoint or an older cursor starts from 0.
 */
export class OrchCursorBook {
  private readonly cursors: Record<string, OrchStageCursor>;

  constructor(cursors: Record<string, OrchStageCursor> = {}) {
    this.cursors = { ...cursors };
  }

  position(stage: string, endpoint: string): number {
    const cursor = this.cursors[stage];
    if (!cursor || cursor.endpoint !== endpoint || Date.now() - cursor.at > AUDIO_ORCH_TRANSFER.absenceRecheckMs) return 0;
    return cursor.position;
  }

  advance(stage: string, endpoint: string, position: number): void {
    const current = this.position(stage, endpoint);
    if (position > current) this.cursors[stage] = { endpoint, position, at: Date.now() };
  }

  /** Forget stages' cursors (e.g. clips were generated: transfers must ask again). */
  reset(stages?: readonly string[]): void {
    (stages ?? Object.keys(this.cursors)).forEach((stage) => { delete this.cursors[stage]; });
  }

  toJSON(): Record<string, OrchStageCursor> {
    return { ...this.cursors };
  }
}

export interface OrchClipSourceContext {
  signal?: AbortSignal;
  /** Meaning known from the inputs (word read states), '' otherwise. */
  meaningOf: (resource: OrchComposeResource) => string;
  /** The run's state (read: plan index of a resource, its state). */
  table: OrchClipTable;
  /** The run's stage cursors. */
  cursors: OrchCursorBook;
  /**
   * A source reports a transfer it started or advanced. `unit` bytes (default):
   * loaded / total are bytes (counted in the transfer rate); percent: 0..100.
   */
  loading: (resource: OrchComposeResource, origin: OrchClipOrigin, loaded?: number, total?: number, unit?: 'bytes' | 'percent') => void;
  /** A request to `baseUrl` just answered (only real responses are reported). */
  answered: (origin: OrchApiOrigin, baseUrl: string) => void;
  /** The source does not hold this resource: it leaves `loading` at once (queued for the next source). */
  release: (resource: OrchComposeResource) => void;
  /** A backend accepted to generate this missing resource (it stays unresolved this run). */
  generating: (resource: OrchComposeResource, channel: OrchChannelId) => void;
  /** Progress of one schedule stage (merged into what it reported before). */
  stage: (stage: string, patch: Partial<OrchStageProgress>) => void;
}

export interface OrchClipSource {
  origin: OrchClipOrigin;
  /** Resolve what this source holds; report every clip through `found`. */
  resolve(
    resources: OrchComposeResource[],
    context: OrchClipSourceContext,
    found: (resource: OrchComposeResource, clip: OrchResolvedClip) => void,
  ): Promise<void>;
}

export interface OrchResolveProgress {
  /** Bytes transferred so far by every source (for the live rate). */
  transferredBytes: number;
  /** APIs that answered during this resolve. */
  endpoints: OrchApiEndpoints;
  /** Per schedule stage: batches and items of this resolve. */
  stages: Record<string, OrchStageProgress>;
  /** Live state (same object across reports; `table.version` changes). */
  table: OrchClipTable;
  cursors: OrchCursorBook;
  clips: ReadonlyMap<string, OrchResolvedClip>;
}

/** Counts of a progress (derived from the table). */
export function orchResolveCounts(progress: Pick<OrchResolveProgress, 'table'>): OrchClipTableCounts {
  return progress.table.counts();
}

/** Run `worker` over `items` with bounded concurrency; stops taking items once aborted. */
export async function orchPool<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal,
  concurrency = ORCH_RESOLVE_CONCURRENCY,
): Promise<void> {
  let cursor = 0;
  const lane = async (): Promise<void> => {
    while (cursor < items.length && !signal?.aborted) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}

export async function resolveOrchClips(
  resources: OrchComposeResource[],
  sources: readonly OrchClipSource[],
  context: {
    signal?: AbortSignal;
    meaningOf: (resource: OrchComposeResource) => string;
    /** Cursors kept from an earlier run of the same plan. */
    cursors?: OrchCursorBook;
    onProgress?: (progress: OrchResolveProgress) => void;
  },
): Promise<OrchResolveProgress> {
  const table = new OrchClipTable(resources.map((resource) => resource.key));
  const cursors = context.cursors ?? new OrchCursorBook();
  const clips = new Map<string, OrchResolvedClip>();
  let transferredBytes = 0;
  const endpoints: OrchApiEndpoints = {};
  const stages: Record<string, OrchStageProgress> = {};
  /** Bytes already counted per item (chunk progress), so a landing clip adds only the rest. */
  const counted = new Map<number, number>();
  const count = (index: number, bytes: number): void => {
    const before = counted.get(index) ?? 0;
    if (bytes > before) {
      transferredBytes += bytes - before;
      counted.set(index, bytes);
    }
  };
  const progress = (): OrchResolveProgress => ({ transferredBytes, endpoints, stages, table, cursors, clips });
  const report = (): void => context.onProgress?.(progress());
  const at = (resource: OrchComposeResource): number => table.indexOf.get(resource.key) ?? -1;
  const sourceContext: OrchClipSourceContext = {
    signal: context.signal,
    meaningOf: context.meaningOf,
    table,
    cursors,
    loading: (resource, origin, loaded = 0, total = 0, unit = 'bytes') => {
      const index = at(resource);
      if (index < 0) return;
      if (unit === 'bytes') count(index, loaded);
      table.set(index, { state: 'loading', origin });
      table.progress(index, loaded, total);
      report();
    },
    stage: (stage, patch) => {
      stages[stage] = { ...(stages[stage] ?? { state: 'running', batches: 0, batchesDone: 0, asked: 0, found: 0, known: 0 }), ...patch };
      report();
    },
    generating: (resource, channel) => {
      const index = at(resource);
      if (index < 0 || table.state(index) === 'done' || table.entry(index).generating) return;
      table.set(index, { generating: channel });
      report();
    },
    release: (resource) => {
      const index = at(resource);
      if (index < 0 || table.state(index) !== 'loading') return;
      table.set(index, { state: 'queued', origin: null });
      report();
    },
    answered: (origin, baseUrl) => {
      if (!baseUrl || endpoints[origin] === baseUrl) return;
      endpoints[origin] = baseUrl;
      report();
    },
  };
  let remaining = resources;
  for (const source of sources) {
    if (remaining.length === 0 || context.signal?.aborted) break;
    await source.resolve(remaining, sourceContext, (resource, clip) => {
      const index = at(resource);
      if (index < 0 || clips.has(resource.key)) return;
      clips.set(resource.key, clip);
      if (clip.bytes) count(index, clip.bytes);
      table.set(index, { state: 'done', origin: clip.origin, via: clip.via ?? null, generating: null });
      report();
    });
    remaining = remaining.filter((resource) => !clips.has(resource.key));
    // A source that gave up on an item hands it back to the queue for the next one.
    remaining.forEach((resource) => {
      const index = at(resource);
      if (table.state(index) === 'loading') table.set(index, { state: 'queued', origin: null });
    });
  }
  remaining.forEach((resource) => table.set(at(resource), { state: 'missing', origin: null }));
  report();
  return progress();
}
