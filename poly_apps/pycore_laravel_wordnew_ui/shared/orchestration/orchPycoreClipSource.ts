/**
 * Clip source over the pycore central caches (`resource/lookup` batches, then
 * `resource/chunk` downloads of the hits). The end decides where a fetched
 * clip lives (`persist`): the phone's permanent store, or an object URL in the
 * pycore UI whose machine already holds the file.
 */
import {
  ORCH_RESOURCE_LOOKUP_MAX_ITEMS,
  pycoreApi,
  type OrchResourceLookupItem,
} from '../../core/integrations/pycore';
import { orchPool, type OrchClipSource } from './orchClipResolver';
import type { OrchComposeResource } from './orchTypes';

const LOOKUP_BATCH = Math.min(200, ORCH_RESOURCE_LOOKUP_MAX_ITEMS);

export interface OrchPycoreClipSourceOptions {
  /** A pycore is reachable (the source is skipped otherwise). */
  available: () => Promise<boolean>;
  /** Keep a fetched clip; its playable URL, or null when it could not be kept. */
  persist: (resource: OrchComposeResource, blob: Blob, meaning: string) => Promise<string | null>;
  /** A lookup failed on the selected pycore (lets the end re-select). */
  onFailure?: () => void;
}

export function orchPycoreClipSource(options: OrchPycoreClipSourceOptions): OrchClipSource {
  return {
    origin: 'pycore',
    async resolve(resources, context, found) {
      if (resources.length === 0 || !(await options.available())) return;
      for (let offset = 0; offset < resources.length && !context.signal?.aborted; offset += LOOKUP_BATCH) {
        const batch = resources.slice(offset, offset + LOOKUP_BATCH);
        const answer = await pycoreApi.orchResourceLookup(
          batch.map(({ kind, language, text }) => ({ kind, language, text })),
        ).catch(() => null);
        if (!answer?.success || !Array.isArray(answer.items)) {
          options.onFailure?.();
          return;
        }
        const hits: Array<{ resource: OrchComposeResource; item: OrchResourceLookupItem }> = [];
        batch.forEach((resource, index) => {
          const item = answer.items?.[index];
          if (item?.hit) hits.push({ resource, item });
        });
        await orchPool(hits, async ({ resource, item }) => {
          const meaning = item.meaning || context.meaningOf(resource);
          context.loading(resource, 'pycore', 0, item.bytes);
          const file = await pycoreApi.orchFetchResource(
            { kind: resource.kind, language: resource.language, text: resource.text },
            { signal: context.signal, onProgress: (loaded, total) => context.loading(resource, 'pycore', loaded, total) },
          ).catch(() => null);
          // A clip that cannot be kept (disk full, volume gone) stays unresolved for the next source.
          const url = file ? await options.persist(resource, file.blob, meaning).catch(() => null) : null;
          if (url) found(resource, { key: resource.key, url, origin: 'pycore', meaning, bytes: file?.bytes });
        }, context.signal);
      }
    },
  };
}
