/**
 * wordnew's clip schedule (shared/orchestration/orchClipScheduler): wordnew
 * provides its channels, its device store and where clips are kept; the
 * scheduler decides the order and gating (pycore direct -> Laravel ->
 * pycore generation -> relay transfer / generation -> Laravel generation).
 *   native  the device store first; every transferred clip is kept in the
 *           permanent device store (bundles land in its folder natively)
 *   web     no device store (the chain starts at pycore direct, same order);
 *           Laravel clips are fetched per file and played by URL, pycore clips
 *           become object URLs of the page; nothing is kept
 * Channel usability comes from the shared `wordNewChannels` (services/compute/WordNewCompute:
 * the one debounced availability every wordnew router reads; the UI shows the same).
 */
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { parseOrchResourceBundle } from '../../../../core/integrations/pycore';
import { protocolFetch } from '../../../../core/network/ProtocolFetch';
import { readBytesWithStallGuard } from '../../../../core/network/StallGuardedRead';
import { transferLimiter } from '../../../../core/network/TransferLimiter';
import { ORCH_BUNDLE_ROUTE_MISSING, type OrchBundleSink, type OrchBundleTransport } from '../../../../shared/orchestration/orchClipBundle';
import { orchPool, type OrchClipSource, type OrchClipSourceContext } from '../../../../shared/orchestration/orchClipResolver';
import {
  buildOrchClipSchedule,
  orchPycoreDirectChannel,
  orchPycoreRelayChannel,
  type OrchClipChannel,
} from '../../../../shared/orchestration/orchClipScheduler';
import type { OrchComposeResource, OrchResolvedClip } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi } from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { WfNewApiPaths } from '../../api/WfNewApiPaths';
import { wordNewPycoreLink } from '../../integrations/WordNewPycoreLink';
import { wordNewChannels } from '../compute/WordNewCompute';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';

const PROGRESS_SCALE = 100;

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : wfNewEndpoints.buildUrl(url);
}

/** Local cache first: one batched lookup of the device store for every resource (no call per clip). */
const deviceSource: OrchClipSource = {
  origin: 'device',
  async resolve(resources, context, found) {
    context.stage('device', { state: 'running', asked: resources.length, batches: 1, batchesDone: 0, found: 0, known: 0 });
    const held = await wordNewOrchClipStore.lookup(resources.map((resource) => resource.key));
    let delivered = 0;
    resources.forEach((resource) => {
      const hit = held.get(resource.key);
      if (!hit) return;
      const meaning = hit.entry.meaning || context.meaningOf(resource);
      if (meaning && !hit.entry.meaning) void wordNewOrchClipStore.setMeaning(resource.key, meaning);
      found(resource, { key: resource.key, url: hit.url, origin: 'device', meaning });
      delivered += 1;
    });
    context.stage('device', { state: 'done', batchesDone: 1, found: delivered });
  },
};

const NATIVE = isNativeAppShell();

/** Native: the permanent device store (bundles are written into its folder by the native stack). */
const DEVICE_SINK: OrchBundleSink = {
  persist: (resource, blob, meaning, origin) => wordNewOrchClipStore.putBlob(resource, blob, origin, meaning),
  nativeTarget: () => wordNewOrchClipStore.nativeTarget(),
  adoptWritten: (resource, bytes, meaning, origin) => wordNewOrchClipStore.adoptWritten(resource, origin, bytes, meaning),
};

/** Object URLs of clips on the web (page lifetime only). */
const webClipUrls = new Map<string, string>();

const WEB_SINK: OrchBundleSink = {
  persist: async (resource, blob) => {
    const existing = webClipUrls.get(resource.key);
    if (existing) return existing;
    const url = URL.createObjectURL(blob);
    webClipUrls.set(resource.key, url);
    return url;
  },
};

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

/**
 * Read-only URLs of clips (Laravel `audio/lookup`: no queue write, no head move),
 * in batches of the bundle size. Missing keys are not held by Laravel.
 */
async function laravelLookup(resources: OrchComposeResource[], answered?: (baseUrl: string) => void): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const batch of chunks(resources, AUDIO_ORCH_TRANSFER.laravelBundleMaxItems)) {
    const baseUrl = wfNewEndpoints.getCurrentBaseUrl();
    const results = await wfNewApi.lookupAudio(batch.map(refOf)).catch(() => null);
    if (!results) continue;
    answered?.(baseUrl);
    batch.forEach((resource, index) => {
      const url = results[index]?.ready ? results[index].url : null;
      if (url) urls.set(resource.key, url);
    });
  }
  return urls;
}

/**
 * Generation request (R4: only `generate:laravel`): the clips go to the head of
 * Laravel's generation lanes (sentences; words per language). Nothing is read back.
 */
async function requestLaravelGeneration(resources: OrchComposeResource[]): Promise<void> {
  const sentences = resources.filter((resource) => resource.kind === 'sentence');
  for (const batch of chunks(sentences, AUDIO_ORCH_TRANSFER.laravelSentenceBatch)) {
    await wfNewApi.moveSentenceAudioToHead(batch.map(({ text, language }) => ({ text, language }))).catch(() => null);
  }
  const words = resources.filter((resource) => resource.kind === 'word');
  for (const language of [...new Set(words.map((resource) => resource.language))]) {
    for (const batch of chunks(words.filter((resource) => resource.language === language), AUDIO_ORCH_TRANSFER.laravelWordBatch)) {
      await wfNewApi.moveWordAudioToHead(batch.map((resource) => resource.text), language).catch(() => null);
    }
  }
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
  via: 'laravel',
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
    // No total deadline on the body: only a stalled stream fails.
    const entries = parseOrchResourceBundle(await readBytesWithStallGuard(response));
    return { supported: true, entries: entries.map((entry) => ({ ...entry, written: false })) };
  },
};

/** Per-file path: batch-resolved URLs downloaded one clip at a time (web, or a Laravel without bundles). */
async function laravelPerFile(
  resources: OrchComposeResource[],
  context: OrchClipSourceContext,
  found: (resource: OrchComposeResource, clip: OrchResolvedClip) => void,
): Promise<void> {
    // Clips without a URL in the inputs: a read-only lookup (R4 - the transfer never touches the queue).
    const unknown = resources.filter((resource) => !resource.laravelUrl);
    const resolved = unknown.length > 0
      ? await laravelLookup(unknown, (baseUrl) => context.answered('laravel', baseUrl))
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
      if (url) found(resource, { key: resource.key, url, origin: 'laravel', via: 'laravel', meaning, bytes });
    }, context.signal, AUDIO_ORCH_TRANSFER.parallelMax);
}

/**
 * Laravel as a channel:
 *   transfer  bundles (native) or per-file URLs from the read-only lookup (web,
 *             or a server without bundles) - never the queue;
 *   generate  the next missing clips moved to the head of its generation lanes,
 *             sent without holding up the run (the server moves each item
 *             separately, ~0.25 s; every other missing clip is in its backlog);
 *   holds     the read-only lookup (generation re-checks).
 */
const LARAVEL_CHANNEL: OrchClipChannel = {
  id: 'laravel',
  available: wordNewChannels.available('laravel'),
  bundle: LARAVEL_BUNDLE_TRANSPORT,
  preferPerFile: !NATIVE,
  perFile: (resources, _sink, context, found) => laravelPerFile(resources, context, found),
  generate: async (_kind, resources) => {
    void requestLaravelGeneration(resources.slice(0, AUDIO_ORCH_TRANSFER.laravelHeadMaxItems)).catch(() => undefined);
    return true;
  },
  holds: async (resources) => new Set((await laravelLookup(resources)).keys()),
};

/** wordnew's clip schedule (the run's sources and the generation re-check). */
export const WORDNEW_ORCH_SCHEDULE = buildOrchClipSchedule({
  device: NATIVE ? deviceSource : undefined,
  sink: NATIVE ? DEVICE_SINK : WEB_SINK,
  pycore: orchPycoreDirectChannel(wordNewChannels.available('direct'), () => wordNewPycoreLink.reportFailure()),
  relay: orchPycoreRelayChannel(wordNewChannels.available('relay')),
  laravel: LARAVEL_CHANNEL,
});

export const WORDNEW_ORCH_CLIP_SOURCES: readonly OrchClipSource[] = WORDNEW_ORCH_SCHEDULE.sources;
