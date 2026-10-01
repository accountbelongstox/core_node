/**
 * Clip source over the pycore central caches. Bundles first (orchClipBundle:
 * framed multi-clip responses, several in flight, written straight to disk by
 * the native app); a pycore without the bundle route falls back to
 * `resource/lookup` batches and `resource/chunk` downloads. The end decides
 * where a fetched clip lives (`persist`, optional native `nativeTarget` /
 * `adoptWritten`): the phone's permanent store, or an object URL in the
 * pycore UI whose machine already holds the file.
 */
import {
  ORCH_RESOURCE_BUNDLE_MAX_ITEMS,
  ORCH_RESOURCE_LOOKUP_MAX_ITEMS,
  PYCORE_HTTP_ROUTES,
  pycoreApi,
  pycoreDirectRequest,
  pycoreTargetBackendUrl,
  type OrchResourceLookupItem,
} from '../../core/integrations/pycore';
import { AUDIO_ORCH_TRANSFER } from '../../core/contracts/AudioOrchestrationContract';
import { transferLimiter } from '../../core/network/TransferLimiter';
import { resolveByBundles, type OrchBundleSink, type OrchBundleTransport } from './orchClipBundle';
import { orchPool, type OrchClipSource, type OrchClipSourceContext } from './orchClipResolver';
import type { OrchComposeResource, OrchResolvedClip } from './orchTypes';

const LOOKUP_BATCH = Math.min(200, ORCH_RESOURCE_LOOKUP_MAX_ITEMS);

export interface OrchPycoreClipSourceOptions extends OrchBundleSink {
  /** A pycore is reachable (the source is skipped otherwise). */
  available: () => Promise<boolean>;
  /** A request failed on the selected pycore (lets the end re-select). */
  onFailure?: () => void;
}

type Found = (resource: OrchComposeResource, clip: OrchResolvedClip) => void;

const refOf = ({ kind, language, text }: OrchComposeResource) => ({ kind, language, text });

const PYCORE_BUNDLE_TRANSPORT: OrchBundleTransport = {
  origin: 'pycore',
  maxItems: ORCH_RESOURCE_BUNDLE_MAX_ITEMS,
  baseUrl: pycoreTargetBackendUrl,
  nativeRequest: (batch) => pycoreDirectRequest(PYCORE_HTTP_ROUTES.audioOrchResourceBundle, { items: batch.map(refOf) }),
  fetch: async (batch, signal) => {
    const answer = await pycoreApi.orchResourceBundle(batch.map(refOf), signal);
    return { supported: answer.supported, entries: answer.entries.map((entry) => ({ ...entry, written: false })) };
  },
};

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
      // A chunked read holds a pycore transfer slot.
      const file = await transferLimiter.run('pycore', () => {
        context.loading(resource, 'pycore', 0, item.bytes);
        return pycoreApi.orchFetchResource(
          refOf(resource),
          { signal: context.signal, onProgress: (loaded, total) => context.loading(resource, 'pycore', loaded, total) },
        );
      }, context.signal).catch(() => null);
      const url = file ? await options.persist(resource, file.blob, meaning).catch(() => null) : null;
      if (url) found(resource, { key: resource.key, url, origin: 'pycore', meaning, bytes: file?.bytes });
    }, context.signal, AUDIO_ORCH_TRANSFER.parallelMax);
  }
}

export function orchPycoreClipSource(options: OrchPycoreClipSourceOptions): OrchClipSource {
  return {
    origin: 'pycore',
    async resolve(resources, context, found) {
      if (resources.length === 0 || !(await options.available())) return;
      const outcome = await resolveByBundles(resources, PYCORE_BUNDLE_TRANSPORT, options, context, found);
      if (outcome.kind === 'failed' && !context.signal?.aborted) options.onFailure?.();
      if (outcome.kind === 'unsupported') await resolveByChunks(outcome.rest, options, context, found);
    },
  };
}
