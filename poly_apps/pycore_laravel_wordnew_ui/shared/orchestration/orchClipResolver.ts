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
  updatedAt: number;
}

export interface OrchClipSourceContext {
  signal?: AbortSignal;
  /** Meaning known from the inputs (word read states), '' otherwise. */
  meaningOf: (resource: OrchComposeResource) => string;
  /** A source reports a transfer it started or advanced (bytes; total 0 = unknown). */
  loading: (resource: OrchComposeResource, origin: OrchClipOrigin, loaded?: number, total?: number) => void;
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
  context: Omit<OrchClipSourceContext, 'loading'> & { onProgress?: (progress: OrchResolveProgress) => void },
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
    updatedAt: Date.now(),
  }]));
  const counts: OrchResolveCounts = {
    total: resources.length, device: 0, pycore: 0, laravel: 0, missing: 0, pending: resources.length,
  };
  const report = (): void => context.onProgress?.({ counts: { ...counts }, clips, items });
  const track = (key: string, patch: Partial<OrchResolveItem>): void => {
    const item = items.get(key);
    if (item) items.set(key, { ...item, ...patch, updatedAt: Date.now() });
  };
  const sourceContext: OrchClipSourceContext = {
    ...context,
    loading: (resource, origin, loaded = 0, total = 0) => {
      track(resource.key, { state: 'loading', origin, loaded, total });
      report();
    },
  };
  let remaining = resources;
  for (const source of sources) {
    if (remaining.length === 0 || context.signal?.aborted) break;
    await source.resolve(remaining, sourceContext, (resource, clip) => {
      if (clips.has(resource.key)) return;
      clips.set(resource.key, clip);
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
  counts.pending = 0;
  report();
  return { counts: { ...counts }, clips, items };
}
