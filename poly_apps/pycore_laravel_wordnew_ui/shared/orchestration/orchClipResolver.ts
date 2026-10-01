/**
 * Clip resolution as an ordered chain of sources: each source resolves what it
 * can of the resources the earlier ones left, a resource none resolves is
 * missing. The chain is the only thing an end configures - wordnew runs
 * device store -> pycore -> Laravel, the pycore UI runs pycore -> ...
 */
import type {
  OrchClipOrigin,
  OrchComposeResource,
  OrchResolveCounts,
  OrchResolvedClip,
} from './orchTypes';

export const ORCH_RESOLVE_CONCURRENCY = 4;

export type OrchResolveItemState = 'queued' | 'loading' | 'done' | 'missing';

/** Per-item progress of one resource of the plan. */
export interface OrchResolveItem {
  key: string;
  kind: OrchComposeResource['kind'];
  language: string;
  text: string;
  state: OrchResolveItemState;
  /** Source that is loading / delivered it. */
  origin: OrchClipOrigin | null;
  /** Bytes transferred so far and the total (0 when unknown). */
  loaded: number;
  total: number;
  /** The backend asked to generate this missing clip (null: none). */
  generating: OrchApiOrigin | null;
  updatedAt: number;
}

/** Network origins of clip sources (the device store is local). */
export type OrchApiOrigin = 'pycore' | 'laravel';

/** Per network origin: the base URL of the API that last answered this run. */
export type OrchApiEndpoints = Partial<Record<OrchApiOrigin, string>>;

export interface OrchClipSourceContext {
  signal?: AbortSignal;
  /** Meaning known from the inputs (word read states), '' otherwise. */
  meaningOf: (resource: OrchComposeResource) => string;
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
  generating: (resource: OrchComposeResource, origin: OrchApiOrigin) => void;
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
  counts: OrchResolveCounts;
  clips: ReadonlyMap<string, OrchResolvedClip>;
  /** Every resource of the plan with its state (plan order). */
  items: ReadonlyMap<string, OrchResolveItem>;
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
  context: Omit<OrchClipSourceContext, 'loading' | 'answered' | 'release' | 'generating'> & { onProgress?: (progress: OrchResolveProgress) => void },
): Promise<OrchResolveProgress> {
  const clips = new Map<string, OrchResolvedClip>();
  const items = new Map<string, OrchResolveItem>(resources.map((resource) => [resource.key, {
    key: resource.key,
    kind: resource.kind,
    language: resource.language,
    text: resource.text,
    state: 'queued',
    origin: null,
    loaded: 0,
    total: 0,
    generating: null,
    updatedAt: Date.now(),
  }]));
  const counts: OrchResolveCounts = {
    total: resources.length, device: 0, pycore: 0, laravel: 0, missing: 0, generating: 0, pending: resources.length,
  };
  let transferredBytes = 0;
  const endpoints: OrchApiEndpoints = {};
  /** Bytes already counted per item (chunk progress), so a landing clip adds only the rest. */
  const counted = new Map<string, number>();
  const count = (key: string, bytes: number): void => {
    const before = counted.get(key) ?? 0;
    if (bytes > before) {
      transferredBytes += bytes - before;
      counted.set(key, bytes);
    }
  };
  const report = (): void => context.onProgress?.({ transferredBytes, endpoints: { ...endpoints }, counts: { ...counts }, clips, items });
  const track = (key: string, patch: Partial<OrchResolveItem>): void => {
    const item = items.get(key);
    if (item) items.set(key, { ...item, ...patch, updatedAt: Date.now() });
  };
  const sourceContext: OrchClipSourceContext = {
    ...context,
    loading: (resource, origin, loaded = 0, total = 0, unit = 'bytes') => {
      if (unit === 'bytes') count(resource.key, loaded);
      track(resource.key, { state: 'loading', origin, loaded, total });
      report();
    },
    generating: (resource, origin) => {
      const item = items.get(resource.key);
      if (!item || item.state === 'done' || item.generating) return;
      track(resource.key, { generating: origin });
      report();
    },
    release: (resource) => {
      if (items.get(resource.key)?.state !== 'loading') return;
      track(resource.key, { state: 'queued', origin: null, loaded: 0, total: 0 });
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
      if (clips.has(resource.key)) return;
      clips.set(resource.key, clip);
      if (clip.bytes) count(resource.key, clip.bytes);
      const item = items.get(resource.key);
      track(resource.key, { state: 'done', origin: clip.origin, loaded: item?.total || item?.loaded || 0 });
      counts[clip.origin] += 1;
      counts.pending -= 1;
      report();
    });
    remaining = remaining.filter((resource) => !clips.has(resource.key));
    // A source that gave up on an item hands it back to the queue for the next one.
    remaining.forEach((resource) => {
      if (items.get(resource.key)?.state === 'loading') track(resource.key, { state: 'queued', origin: null, loaded: 0, total: 0 });
    });
  }
  remaining.forEach((resource) => track(resource.key, { state: 'missing', origin: null }));
  counts.missing = remaining.length;
  counts.generating = remaining.filter((resource) => items.get(resource.key)?.generating).length;
  counts.pending = 0;
  report();
  return { transferredBytes, endpoints: { ...endpoints }, counts: { ...counts }, clips, items };
}
