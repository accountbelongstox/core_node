/**
 * Resolves the clips of a composition plan in the binding order
 * device store -> pycore central cache -> Laravel -> missing
 * (docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md section 3.4).
 *
 * Native keeps every clip it reads (permanent device store). The web plays
 * Laravel clips from their URL and keeps only pycore clips (they arrive as
 * base64 chunks, so they are never re-transferred). A Laravel miss is queued at
 * the head of the Laravel generation lanes by the lookup itself and resolves on
 * a later run.
 */
import {
  ORCH_RESOURCE_LOOKUP_MAX_ITEMS,
  pycoreApi,
  type OrchResourceLookupItem,
} from '../../../../core/integrations/pycore';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { wfNewApi } from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';
import type {
  OrchComposeResource,
  OrchResolveCounts,
  OrchResolvedClip,
  OrchWordState,
} from './orchComposeTypes';

const PYCORE_LOOKUP_BATCH = Math.min(200, ORCH_RESOURCE_LOOKUP_MAX_ITEMS);
const RESOLVE_CONCURRENCY = 4;

export interface OrchResolveProgress {
  counts: OrchResolveCounts;
  clips: ReadonlyMap<string, OrchResolvedClip>;
}

export interface OrchResolveOptions {
  wordStates: ReadonlyMap<string, OrchWordState>;
  signal?: AbortSignal;
  onProgress?: (progress: OrchResolveProgress) => void;
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : wfNewEndpoints.buildUrl(url);
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>, signal?: AbortSignal): Promise<void> {
  let cursor = 0;
  const lane = async (): Promise<void> => {
    while (cursor < items.length && !signal?.aborted) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(RESOLVE_CONCURRENCY, items.length) }, lane));
}

class WordNewOrchResolverService {
  async resolve(resources: OrchComposeResource[], options: OrchResolveOptions): Promise<OrchResolveProgress> {
    const clips = new Map<string, OrchResolvedClip>();
    const counts: OrchResolveCounts = {
      total: resources.length, device: 0, pycore: 0, laravel: 0, missing: 0, pending: resources.length,
    };
    const report = (): void => options.onProgress?.({ counts: { ...counts }, clips });
    const settle = (clip: OrchResolvedClip | null, resource: OrchComposeResource): void => {
      counts.pending -= 1;
      if (clip) {
        clips.set(resource.key, clip);
        counts[clip.origin] += 1;
      } else {
        counts.missing += 1;
      }
      report();
    };
    const meaningOf = (resource: OrchComposeResource): string => (
      resource.kind === 'word' ? options.wordStates.get(resource.text)?.meaning ?? '' : ''
    );

    const misses: OrchComposeResource[] = [];
    await runPool(resources, async (resource) => {
      const url = await wordNewOrchClipStore.url(resource.key);
      if (!url) {
        misses.push(resource);
        return;
      }
      const stored = await wordNewOrchClipStore.entry(resource.key);
      const meaning = stored?.meaning || meaningOf(resource);
      if (meaning && !stored?.meaning) await wordNewOrchClipStore.setMeaning(resource.key, meaning);
      settle({ key: resource.key, url, origin: 'device', meaning }, resource);
    }, options.signal);

    const laravelQueue = await this.fromPycore(misses, options, settle, meaningOf);
    await runPool(laravelQueue, async (resource) => {
      settle(await this.fromLaravel(resource, meaningOf(resource)), resource);
    }, options.signal);
    return { counts: { ...counts }, clips };
  }

  /** Batched pycore cache lookup, then chunk download of the hits; returns what is left. */
  private async fromPycore(
    resources: OrchComposeResource[],
    options: OrchResolveOptions,
    settle: (clip: OrchResolvedClip | null, resource: OrchComposeResource) => void,
    meaningOf: (resource: OrchComposeResource) => string,
  ): Promise<OrchComposeResource[]> {
    if (resources.length === 0) return [];
    if (!(await wordNewPycoreLink.ensure()).selectedUrl) return resources;
    const left: OrchComposeResource[] = [];
    for (let offset = 0; offset < resources.length && !options.signal?.aborted; offset += PYCORE_LOOKUP_BATCH) {
      const batch = resources.slice(offset, offset + PYCORE_LOOKUP_BATCH);
      const answer = await pycoreApi.orchResourceLookup(
        batch.map(({ kind, language, text }) => ({ kind, language, text })),
      ).catch(() => null);
      if (!answer?.success || !Array.isArray(answer.items)) {
        wordNewPycoreLink.reportFailure();
        left.push(...resources.slice(offset));
        return left;
      }
      const hits: Array<{ resource: OrchComposeResource; item: OrchResourceLookupItem }> = [];
      batch.forEach((resource, index) => {
        const item = answer.items?.[index];
        if (item?.hit) hits.push({ resource, item });
        else left.push(resource);
      });
      await runPool(hits, async ({ resource, item }) => {
        const meaning = item.meaning || meaningOf(resource);
        const file = await pycoreApi.orchFetchResource(
          { kind: resource.kind, language: resource.language, text: resource.text },
          { signal: options.signal },
        ).catch(() => null);
        const url = file ? await wordNewOrchClipStore.putBlob(resource.key, file.blob, 'pycore', meaning) : null;
        if (url) settle({ key: resource.key, url, origin: 'pycore', meaning }, resource);
        else left.push(resource);
      }, options.signal);
    }
    return left;
  }

  private async laravelUrl(resource: OrchComposeResource): Promise<string | null> {
    if (resource.laravelUrl) return absoluteUrl(resource.laravelUrl);
    if (resource.kind === 'word') return null;
    const answer = await wfNewApi.resolveSentenceAudio(resource.text, resource.language).catch(() => null);
    return answer?.exists ? absoluteUrl(answer.url) : null;
  }

  private async fromLaravel(resource: OrchComposeResource, meaning: string): Promise<OrchResolvedClip | null> {
    const remoteUrl = await this.laravelUrl(resource);
    if (!remoteUrl) return null;
    if (!isNativeAppShell()) return { key: resource.key, url: remoteUrl, origin: 'laravel', meaning };
    const url = await wordNewOrchClipStore.putFromUrl(resource.key, remoteUrl, meaning).catch(() => null);
    return url ? { key: resource.key, url, origin: 'laravel', meaning } : null;
  }
}

export const wordNewOrchResolver = new WordNewOrchResolverService();
