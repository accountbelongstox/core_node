/**
 * wordnew's clip-source chains (docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md 3.4, 4.3):
 *   native  device store -> pycore central cache -> Laravel; every clip read is
 *           kept in the permanent device store
 *   web     Laravel -> pycore; the API resources are used directly (Laravel URLs
 *           played as they are, pycore clips as object URLs of the page) and
 *           nothing is kept locally
 * A Laravel miss is queued at the head of the Laravel generation lanes by the
 * lookup itself and resolves on a later run.
 */
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { orchPool, type OrchClipSource } from '../../../../shared/orchestration/orchClipResolver';
import { orchPycoreClipSource } from '../../../../shared/orchestration/orchPycoreClipSource';
import type { OrchComposeResource } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi } from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : wfNewEndpoints.buildUrl(url);
}

const deviceSource: OrchClipSource = {
  origin: 'device',
  async resolve(resources, context, found) {
    await orchPool(resources, async (resource) => {
      const url = await wordNewOrchClipStore.url(resource.key);
      if (!url) return;
      const stored = await wordNewOrchClipStore.entry(resource.key);
      const meaning = stored?.meaning || context.meaningOf(resource);
      if (meaning && !stored?.meaning) await wordNewOrchClipStore.setMeaning(resource.key, meaning);
      found(resource, { key: resource.key, url, origin: 'device', meaning });
    }, context.signal);
  },
};

const pycoreAvailable = async (): Promise<boolean> => (await wordNewPycoreLink.ensure()).selectedUrl !== '';

const pycoreSource = orchPycoreClipSource({
  available: pycoreAvailable,
  persist: (resource, blob, meaning) => wordNewOrchClipStore.putBlob(resource, blob, 'pycore', meaning),
  onFailure: () => wordNewPycoreLink.reportFailure(),
});

/** Object URLs of pycore clips on the web (page lifetime only). */
const webPycoreUrls = new Map<string, string>();

const webPycoreSource = orchPycoreClipSource({
  available: pycoreAvailable,
  persist: async (resource, blob) => {
    const existing = webPycoreUrls.get(resource.key);
    if (existing) return existing;
    const url = URL.createObjectURL(blob);
    webPycoreUrls.set(resource.key, url);
    return url;
  },
  onFailure: () => wordNewPycoreLink.reportFailure(),
});

async function laravelUrl(resource: OrchComposeResource): Promise<string | null> {
  if (resource.laravelUrl) return absoluteUrl(resource.laravelUrl);
  if (resource.kind === 'word') return null;
  const answer = await wfNewApi.resolveSentenceAudio(resource.text, resource.language).catch(() => null);
  return answer?.exists ? absoluteUrl(answer.url) : null;
}

const laravelSource: OrchClipSource = {
  origin: 'laravel',
  async resolve(resources, context, found) {
    await orchPool(resources, async (resource) => {
      const remoteUrl = await laravelUrl(resource);
      if (!remoteUrl) return;
      const meaning = context.meaningOf(resource);
      const url = isNativeAppShell()
        ? await wordNewOrchClipStore.putFromUrl(resource, remoteUrl, meaning).catch(() => null)
        : remoteUrl;
      if (url) found(resource, { key: resource.key, url, origin: 'laravel', meaning });
    }, context.signal);
  },
};

export const WORDNEW_ORCH_CLIP_SOURCES: readonly OrchClipSource[] = Object.freeze(
  isNativeAppShell() ? [deviceSource, pycoreSource, laravelSource] : [laravelSource, webPycoreSource],
);
