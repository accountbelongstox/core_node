/**
 * wordnew's clip-source chains (docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md 3.4, 4.3):
 *   native  device store -> pycore central cache -> Laravel; every clip read is
 *           kept in the permanent device store
 *   web     Laravel -> pycore; the API resources are used directly (Laravel URLs
 *           played as they are, pycore clips as object URLs of the page) and
 *           nothing is kept locally
 * Laravel: clips without a URL in the inputs are resolved in batches (sentence /
 * word queue-head batches answer the URL of an available clip and move a miss
 * to the head of the generation lanes - it resolves on a later run); the clips
 * are then downloaded as static files.
 */
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { orchPool, type OrchClipSource } from '../../../../shared/orchestration/orchClipResolver';
import { orchPycoreClipSource } from '../../../../shared/orchestration/orchPycoreClipSource';
import type { OrchComposeResource } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi } from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';

const PROGRESS_SCALE = 100;

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

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

/** URLs of clips the inputs had none for: one batch request per chunk (sentences; words per language). */
async function batchLaravelUrls(resources: OrchComposeResource[], answered: (baseUrl: string) => void): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const sentences = resources.filter((resource) => resource.kind === 'sentence');
  for (const batch of chunks(sentences, AUDIO_ORCH_TRANSFER.laravelSentenceBatch)) {
    const baseUrl = wfNewEndpoints.getCurrentBaseUrl();
    const answer = await wfNewApi.moveSentenceAudioToHead(batch.map(({ text, language }) => ({ text, language }))).catch(() => null);
    if (!answer?.success) continue;
    answered(baseUrl);
    const byText = new Map<string, string>();
    answer.items.forEach((item: { text?: string; url?: string | null }) => {
      if (item?.text && item.url) byText.set(String(item.text).trim(), item.url);
    });
    batch.forEach((resource) => {
      const url = absoluteUrl(byText.get(resource.text.trim()));
      if (url) urls.set(resource.key, url);
    });
  }
  const words = resources.filter((resource) => resource.kind === 'word');
  const languages = [...new Set(words.map((resource) => resource.language))];
  for (const language of languages) {
    for (const batch of chunks(words.filter((resource) => resource.language === language), AUDIO_ORCH_TRANSFER.laravelWordBatch)) {
      const baseUrl = wfNewEndpoints.getCurrentBaseUrl();
      const answer = await wfNewApi.moveWordAudioToHead(batch.map((resource) => resource.text), language).catch(() => null);
      if (!answer) continue;
      answered(baseUrl);
      const byWord = new Map<string, string>();
      answer.results.forEach((item: { word?: string; audio_url?: string | null }) => {
        if (item?.word && item.audio_url) byWord.set(String(item.word).trim(), item.audio_url);
      });
      batch.forEach((resource) => {
        const url = absoluteUrl(byWord.get(resource.text.trim()));
        if (url) urls.set(resource.key, url);
      });
    }
  }
  return urls;
}

/** Scheme, host and port of a clip URL (the API that served it). */
function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

const laravelSource: OrchClipSource = {
  origin: 'laravel',
  async resolve(resources, context, found) {
    const unknown = resources.filter((resource) => !resource.laravelUrl);
    const resolved = unknown.length > 0
      ? await batchLaravelUrls(unknown, (baseUrl) => context.answered('laravel', baseUrl))
      : new Map<string, string>();
    await orchPool(resources, async (resource) => {
      const remoteUrl = resource.laravelUrl ? absoluteUrl(resource.laravelUrl) : resolved.get(resource.key) ?? null;
      if (!remoteUrl) return;
      context.loading(resource, 'laravel');
      const meaning = context.meaningOf(resource);
      // Download progress is a fraction: reported on a 0..100 scale.
      const url = isNativeAppShell()
        ? await wordNewOrchClipStore.putFromUrl(resource, remoteUrl, meaning, (fraction) => {
          context.loading(resource, 'laravel', Math.round(fraction * PROGRESS_SCALE), PROGRESS_SCALE, 'percent');
        }).catch(() => null)
        : remoteUrl;
      // The stored size is what was transferred (the web plays the URL: nothing transferred here).
      const bytes = url && isNativeAppShell() ? (await wordNewOrchClipStore.entry(resource.key))?.bytes : undefined;
      if (url && isNativeAppShell()) context.answered('laravel', originOf(remoteUrl));
      if (url) found(resource, { key: resource.key, url, origin: 'laravel', meaning, bytes });
    }, context.signal);
  },
};

export const WORDNEW_ORCH_CLIP_SOURCES: readonly OrchClipSource[] = Object.freeze(
  isNativeAppShell() ? [deviceSource, pycoreSource, laravelSource] : [laravelSource, webPycoreSource],
);
