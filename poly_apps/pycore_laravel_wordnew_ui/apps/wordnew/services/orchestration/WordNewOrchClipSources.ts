/**
 * wordnew's clip-source chains (docs_fix/REQUIREMENTS_20260930_WORDNEW_CLIENT_ORCHESTRATION.md 3.4, 4.3):
 *   native  device store -> pycore central cache -> Laravel; every clip read is
 *           kept in the permanent device store
 *   web     Laravel -> pycore; the API resources are used directly (Laravel URLs
 *           played as they are, pycore clips as object URLs of the page) and
 *           nothing is kept locally
 * Native transfers are clip bundles (orchClipBundle: framed multi-clip
 * responses, several in flight, written straight into the clip store folder by
 * the native stack) from pycore and from Laravel (`tts/audio/bundle`); what
 * Laravel does not hold is moved to the head of its generation lanes in batches
 * (it resolves on a later run). A Laravel without the bundle route falls back
 * to per-file downloads of the batch-resolved URLs. The web plays Laravel URLs
 * directly.
 */
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { parseOrchResourceBundle } from '../../../../core/integrations/pycore';
import { protocolFetch } from '../../../../core/network/ProtocolFetch';
import { transferLimiter } from '../../../../core/network/TransferLimiter';
import {
  ORCH_BUNDLE_ROUTE_MISSING,
  resolveByBundles,
  type OrchBundleSink,
  type OrchBundleTransport,
} from '../../../../shared/orchestration/orchClipBundle';
import { orchPool, type OrchClipSource, type OrchClipSourceContext } from '../../../../shared/orchestration/orchClipResolver';
import { orchPycoreClipSource } from '../../../../shared/orchestration/orchPycoreClipSource';
import type { OrchClipOrigin, OrchComposeResource, OrchResolvedClip } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi } from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { WfNewApiPaths } from '../../api/WfNewApiPaths';
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

/** pycore is read only while its link answers; a run that skipped it resumes when the link is back. */
const pycoreAvailable = async (): Promise<boolean> => (await wordNewPycoreLink.ensure()).state === 'online';

/** The permanent device store as a bundle sink (native bundles land in its folder directly). */
function deviceSink(origin: Exclude<OrchClipOrigin, 'device'>): OrchBundleSink {
  return {
    persist: (resource, blob, meaning) => wordNewOrchClipStore.putBlob(resource, blob, origin, meaning),
    nativeTarget: () => wordNewOrchClipStore.nativeTarget(),
    adoptWritten: (resource, bytes, meaning) => wordNewOrchClipStore.adoptWritten(resource, origin, bytes, meaning),
  };
}

const pycoreSource = orchPycoreClipSource({
  available: pycoreAvailable,
  ...deviceSink('pycore'),
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

const refOf = ({ kind, language, text }: OrchComposeResource) => ({ kind, language, text });

const LARAVEL_BUNDLE_TRANSPORT: OrchBundleTransport = {
  origin: 'laravel',
  maxItems: AUDIO_ORCH_TRANSFER.laravelBundleMaxItems,
  baseUrl: () => wfNewEndpoints.getCurrentBaseUrl(),
  nativeRequest: async (batch) => ({
    url: wfNewEndpoints.buildUrl(WfNewApiPaths.audioBundle),
    headers: { accept: AUDIO_ORCH_TRANSFER.bundleMediaType },
    body: { items: batch.map(refOf) },
  }),
  fetch: async (batch, signal) => {
    const response = await protocolFetch(wfNewEndpoints.buildUrl(WfNewApiPaths.audioBundle), {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: AUDIO_ORCH_TRANSFER.bundleMediaType },
      body: JSON.stringify({ items: batch.map(refOf) }),
      signal,
    });
    if (response.status === ORCH_BUNDLE_ROUTE_MISSING) return { supported: false, entries: [] };
    if (!response.ok) throw new Error(`ORCH_BUNDLE_HTTP_${response.status}`);
    const entries = parseOrchResourceBundle(new Uint8Array(await response.arrayBuffer()));
    return { supported: true, entries: entries.map((entry) => ({ ...entry, written: false })) };
  },
};

/** Per-file path: batch-resolved URLs downloaded one clip at a time (web, or a Laravel without bundles). */
async function laravelPerFile(
  resources: OrchComposeResource[],
  context: OrchClipSourceContext,
  found: (resource: OrchComposeResource, clip: OrchResolvedClip) => void,
): Promise<void> {
    // Clips without a URL in the inputs were absent when the inputs were read: only the next
    // ones in play order are asked again (the queue-head call costs the server ~0.25 s per item).
    const unknown = resources.filter((resource) => !resource.laravelUrl).slice(0, AUDIO_ORCH_TRANSFER.laravelHeadMaxItems);
    const resolved = unknown.length > 0
      ? await batchLaravelUrls(unknown, (baseUrl) => context.answered('laravel', baseUrl))
      : new Map<string, string>();
    await orchPool(resources, async (resource) => {
      const remoteUrl = resource.laravelUrl ? absoluteUrl(resource.laravelUrl) : resolved.get(resource.key) ?? null;
      if (!remoteUrl) return;
      const meaning = context.meaningOf(resource);
      // A download holds a Laravel transfer slot; progress is a fraction (reported on a 0..100 scale).
      const url = isNativeAppShell()
        ? await transferLimiter.run('laravel', () => {
          context.loading(resource, 'laravel');
          return wordNewOrchClipStore.putFromUrl(resource, remoteUrl, meaning, (fraction) => {
            context.loading(resource, 'laravel', Math.round(fraction * PROGRESS_SCALE), PROGRESS_SCALE, 'percent');
          });
        }, context.signal).catch(() => null)
        : remoteUrl;
      // The stored size is what was transferred (the web plays the URL: nothing transferred here).
      const bytes = url && isNativeAppShell() ? (await wordNewOrchClipStore.entry(resource.key))?.bytes : undefined;
      if (url && isNativeAppShell()) context.answered('laravel', originOf(remoteUrl));
      if (url) found(resource, { key: resource.key, url, origin: 'laravel', meaning, bytes });
    }, context.signal, AUDIO_ORCH_TRANSFER.parallelMax);
}

const laravelSource: OrchClipSource = {
  origin: 'laravel',
  async resolve(resources, context, found) {
    if (!isNativeAppShell()) {
      await laravelPerFile(resources, context, found);
      return;
    }
    const delivered = new Set<string>();
    const outcome = await resolveByBundles(resources, LARAVEL_BUNDLE_TRANSPORT, deviceSink('laravel'), context, (resource, clip) => {
      delivered.add(resource.key);
      found(resource, clip);
    });
    if (outcome.kind === 'unsupported') {
      await laravelPerFile(outcome.rest, context, found);
      return;
    }
    // What Laravel does not hold: only the next clips in play order go to the head of its
    // generation lanes, without holding up the run. The server moves each item separately
    // (about 0.25 s each), and every other missing library clip is already in the backlog
    // its workers pull; a later run moves the next ones up.
    const missing = resources.filter((resource) => !delivered.has(resource.key));
    if (outcome.kind === 'done' && missing.length > 0 && !context.signal?.aborted) {
      void batchLaravelUrls(missing.slice(0, AUDIO_ORCH_TRANSFER.laravelHeadMaxItems), (baseUrl) => context.answered('laravel', baseUrl))
        .catch(() => undefined);
    }
  },
};

export const WORDNEW_ORCH_CLIP_SOURCES: readonly OrchClipSource[] = Object.freeze(
  isNativeAppShell() ? [deviceSource, pycoreSource, laravelSource] : [laravelSource, webPycoreSource],
);
