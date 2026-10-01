/**
 * Clip source over the pycore central caches. Bundles first: many clips in one
 * framed binary response (`resource/bundle`, contract transfer); a hit past the
 * bundle's byte budget is asked again in the next bundle. A pycore without the
 * bundle route falls back to `resource/lookup` batches and `resource/chunk`
 * downloads. The end decides where a fetched clip lives (`persist`): the
 * phone's permanent store, or an object URL in the pycore UI whose machine
 * already holds the file.
 */
import {
  ORCH_RESOURCE_BUNDLE_MAX_ITEMS,
  ORCH_RESOURCE_LOOKUP_MAX_ITEMS,
  pycoreApi,
  pycoreTargetBackendUrl,
  type OrchResourceBundleEntry,
  type OrchResourceLookupItem,
} from '../../core/integrations/pycore';
import { orchPool, type OrchClipSource, type OrchClipSourceContext } from './orchClipResolver';
import type { OrchComposeResource, OrchResolvedClip } from './orchTypes';

const LOOKUP_BATCH = Math.min(200, ORCH_RESOURCE_LOOKUP_MAX_ITEMS);
const CLIP_MEDIA_TYPE = 'audio/mpeg';

export interface OrchPycoreClipSourceOptions {
  /** A pycore is reachable (the source is skipped otherwise). */
  available: () => Promise<boolean>;
  /** Keep a fetched clip; its playable URL, or null when it could not be kept. */
  persist: (resource: OrchComposeResource, blob: Blob, meaning: string) => Promise<string | null>;
  /** A request failed on the selected pycore (lets the end re-select). */
  onFailure?: () => void;
}

type Found = (resource: OrchComposeResource, clip: OrchResolvedClip) => void;

const refOf = ({ kind, language, text }: OrchComposeResource) => ({ kind, language, text });

/**
 * Bundle transfer; the resources still to resolve when this pycore has no
 * bundle route (null when it failed or everything was answered).
 */
async function resolveByBundles(
  resources: OrchComposeResource[],
  options: OrchPycoreClipSourceOptions,
  context: OrchClipSourceContext,
  found: Found,
): Promise<OrchComposeResource[] | null> {
  let pending = resources;
  while (pending.length > 0 && !context.signal?.aborted) {
    const batch = pending.slice(0, ORCH_RESOURCE_BUNDLE_MAX_ITEMS);
    const baseUrl = pycoreTargetBackendUrl();
    batch.forEach((resource) => context.loading(resource, 'pycore'));
    const answer = await pycoreApi.orchResourceBundle(batch.map(refOf), context.signal).catch(() => null);
    // An aborted run (replaced by a newer one) reports no failure.
    if (context.signal?.aborted) return null;
    if (!answer) {
      options.onFailure?.();
      return null;
    }
    if (!answer.supported) return pending;
    context.answered('pycore', baseUrl);
    const deferred: OrchComposeResource[] = [];
    await orchPool(answer.entries, async (entry: OrchResourceBundleEntry) => {
      const resource = batch[entry.index];
      if (!resource || !entry.hit) return;
      if (!entry.sent || !entry.data) {
        deferred.push(resource);
        return;
      }
      const meaning = entry.meaning || context.meaningOf(resource);
      context.loading(resource, 'pycore', entry.bytes, entry.bytes);
      // A clip that cannot be kept (disk full, volume gone) stays unresolved for the next source.
      const url = await options.persist(resource, new Blob([entry.data as BlobPart], { type: CLIP_MEDIA_TYPE }), meaning).catch(() => null);
      if (url) found(resource, { key: resource.key, url, origin: 'pycore', meaning, bytes: entry.bytes });
    }, context.signal);
    pending = [...deferred, ...pending.slice(batch.length)];
  }
  return null;
}

async function resolveByChunks(
  resources: OrchComposeResource[],
  options: OrchPycoreClipSourceOptions,
  context: OrchClipSourceContext,
  found: Found,
): Promise<void> {
  for (let offset = 0; offset < resources.length && !context.signal?.aborted; offset += LOOKUP_BATCH) {
    const batch = resources.slice(offset, offset + LOOKUP_BATCH);
    const baseUrl = pycoreTargetBackendUrl();
    const answer = await pycoreApi.orchResourceLookup(batch.map(refOf)).catch(() => null);
    if (context.signal?.aborted) return;
    if (!answer?.success || !Array.isArray(answer.items)) {
      options.onFailure?.();
      return;
    }
    context.answered('pycore', baseUrl);
    const hits: Array<{ resource: OrchComposeResource; item: OrchResourceLookupItem }> = [];
    batch.forEach((resource, index) => {
      const item = answer.items?.[index];
      if (item?.hit) hits.push({ resource, item });
    });
    await orchPool(hits, async ({ resource, item }) => {
      const meaning = item.meaning || context.meaningOf(resource);
      context.loading(resource, 'pycore', 0, item.bytes);
      const file = await pycoreApi.orchFetchResource(
        refOf(resource),
        { signal: context.signal, onProgress: (loaded, total) => context.loading(resource, 'pycore', loaded, total) },
      ).catch(() => null);
      const url = file ? await options.persist(resource, file.blob, meaning).catch(() => null) : null;
      if (url) found(resource, { key: resource.key, url, origin: 'pycore', meaning, bytes: file?.bytes });
    }, context.signal);
  }
}

export function orchPycoreClipSource(options: OrchPycoreClipSourceOptions): OrchClipSource {
  return {
    origin: 'pycore',
    async resolve(resources, context, found) {
      if (resources.length === 0 || !(await options.available())) return;
      const unbundled = await resolveByBundles(resources, options, context, found);
      if (unbundled && unbundled.length > 0) await resolveByChunks(unbundled, options, context, found);
    },
  };
}
