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

export interface OrchClipSourceContext {
  signal?: AbortSignal;
  /** Meaning known from the inputs (word read states), '' otherwise. */
  meaningOf: (resource: OrchComposeResource) => string;
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
  context: OrchClipSourceContext & { onProgress?: (progress: OrchResolveProgress) => void },
): Promise<OrchResolveProgress> {
  const clips = new Map<string, OrchResolvedClip>();
  const counts: OrchResolveCounts = {
    total: resources.length, device: 0, pycore: 0, laravel: 0, missing: 0, pending: resources.length,
  };
  const report = (): void => context.onProgress?.({ counts: { ...counts }, clips });
  let remaining = resources;
  for (const source of sources) {
    if (remaining.length === 0 || context.signal?.aborted) break;
    await source.resolve(remaining, context, (resource, clip) => {
      if (clips.has(resource.key)) return;
      clips.set(resource.key, clip);
      counts[clip.origin] += 1;
      counts.pending -= 1;
      report();
    });
    remaining = remaining.filter((resource) => !clips.has(resource.key));
  }
  counts.missing = remaining.length;
  counts.pending = 0;
  report();
  return { counts: { ...counts }, clips };
}
