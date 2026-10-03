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
import { ORCH_BUNDLE_ROUTE_MISSING, orchTakeHeld, type OrchBundleSink, type OrchBundleTransport } from '../../../../shared/orchestration/orchClipBundle';
import { OrchChannelPaused, orchPool, orchRetry, type OrchClipSource, type OrchClipSourceContext } from '../../../../shared/orchestration/orchClipResolver';
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
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../../core/contracts/QueueCenterContract';
import { wordNewChannels } from '../compute/WordNewCompute';
import { wordNewQueueCenter } from '../WordNewQueueCenter';
import { serverSchemaGate } from '../../../../core/integrations/laravel/ServerSchemaGate';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';
import type { OrchPlanScope } from './WordNewBookAudioPlan';

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
    const held = await wordNewOrchClipStore.lookup(resources);
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
  persist: (resource, blob, meaning, origin, version) => wordNewOrchClipStore.putBlob(resource, blob, origin, meaning, version),
  nativeTarget: () => wordNewOrchClipStore.nativeTarget(),
  adoptWritten: (resource, bytes, meaning, origin, version) => wordNewOrchClipStore.adoptWritten(resource, origin, bytes, meaning, version),
  held: async (resources) => new Map([...(await wordNewOrchClipStore.lookup(resources))].map(([key, { url, entry }]) => [key, { url, meaning: entry.meaning }])),
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
    const results = await orchRetry(() => wfNewApi.lookupAudio(batch.map(refOf)));
    if (!results) continue;
    answered?.(baseUrl);
    batch.forEach((resource, index) => {
      const url = results[index]?.ready ? results[index].url : null;
      if (url) urls.set(resource.key, url);
    });
  }
  return urls;
}

/** A queue command answered `success: false` (null: every item was already in flight elsewhere = accepted). */
function accepted(response: unknown): boolean {
  if (Array.isArray(response)) return response.every(accepted);
  return (response as { success?: boolean } | null)?.success !== false;
}

/** The server pause as the scheduler's typed stop: no retry, no failure count. */
function serverPause(): OrchChannelPaused {
  const { errorCode, retryAfterSeconds } = serverSchemaGate.getSnapshot();
  return new OrchChannelPaused(errorCode, retryAfterSeconds);
}

/**
 * Generation request (R4: only `generate:laravel`) through the one queue command owner
 * (WordNewQueueCenter: single-flight, receipts): the clips go to the head of Laravel's generation
 * lanes (sentences; words per language). Resolves true only when the server accepted every batch;
 * a paused server (schema gate) is a typed stop, not a retry.
 */
async function requestLaravelGeneration(resources: OrchComposeResource[]): Promise<boolean> {
  if (serverSchemaGate.getSnapshot().schema === 'pending') throw serverPause();
  try {
    const sentences = resources.filter((resource) => resource.kind === 'sentence');
    for (const batch of chunks(sentences, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit)) {
      if (!accepted(await wordNewQueueCenter.moveSentencesToHead(batch.map(({ text, language }) => ({ text, language }))))) return false;
    }
    const words = resources.filter((resource) => resource.kind === 'word');
    for (const language of [...new Set(words.map((resource) => resource.language))]) {
      const texts = words.filter((resource) => resource.language === language).map((resource) => resource.text);
      for (const batch of chunks(texts, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit)) {
        if (!accepted(await wordNewQueueCenter.moveWordsToHead(batch, language))) return false;
      }
    }
    return true;
  } catch (error) {
    if (serverSchemaGate.observeError(error) || serverSchemaGate.getSnapshot().schema === 'pending') throw serverPause();
    throw error;
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
  asked: OrchComposeResource[],
  sink: OrchBundleSink,
  context: OrchClipSourceContext,
  found: (resource: OrchComposeResource, clip: OrchResolvedClip) => void,
): Promise<number> {
    let failed = 0;
    const resources = await orchTakeHeld(asked, sink, context, found);
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
      // A failed download is tried again (orchRetry); one that still fails counts as failed.
      const url = isNativeAppShell()
        ? await orchRetry(() => transferLimiter.run('laravel', () => {
          context.loading(resource, 'laravel');
          return wordNewOrchClipStore.putFromUrl(resource, remoteUrl, meaning, (fraction) => {
            context.loading(resource, 'laravel', Math.round(fraction * PROGRESS_SCALE), PROGRESS_SCALE, 'percent');
          });
        }, context.signal), context.signal)
        : remoteUrl;
      if (!url && !context.signal?.aborted) failed += 1;
      // The stored size is what was transferred (the web plays the URL: nothing transferred here).
      const bytes = url && isNativeAppShell() ? (await wordNewOrchClipStore.entry(resource.key))?.bytes : undefined;
      if (url && isNativeAppShell()) context.answered('laravel', originOf(remoteUrl));
      if (url) found(resource, { key: resource.key, url, origin: 'laravel', via: 'laravel', meaning, bytes });
    }, context.signal, AUDIO_ORCH_TRANSFER.parallelMax);
    return failed;
}

/**
 * Laravel as a channel:
 *   transfer  bundles (native) or per-file URLs from the read-only lookup (web,
 *             or a server without bundles) - never the queue;
 *   generate  the next missing clips moved to the head of its generation lanes
 *             (acknowledged by the server; a paused server stops the stage, see
 *             serverSchemaGate; every other missing clip is in its backlog);
 *   holds     the read-only lookup (generation re-checks).
 */
const LARAVEL_CHANNEL: OrchClipChannel = {
  id: 'laravel',
  available: wordNewChannels.available('laravel'),
  bundle: LARAVEL_BUNDLE_TRANSPORT,
  preferPerFile: !NATIVE,
  perFile: (resources, sink, context, found) => laravelPerFile(resources, sink, context, found),
  generate: (_kind, resources) => requestLaravelGeneration(resources.slice(0, AUDIO_ORCH_TRANSFER.laravelHeadMaxItems)),
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

/** The run's server book plan scope; `current` stays null until the plan answered (then the chain is unscoped). */
export interface OrchPlanScopeHolder {
  current: OrchPlanScope | null;
}

/**
 * The schedule's sources limited by the run's server book plan (the stages and their order are unchanged):
 *   transfer  covered clips are asked only once the server reported them ready (plus every uncovered clip);
 *   generate  covered clips belong to the server plan, which every node generates through work leases - they
 *             are flagged `generating`; only the direct pycore's share of the missing covered clips (the app-led
 *             assignment, WordNewBookPlanAssigner; `book_plan.local_head_items` until one is computed) is
 *             still requested from the direct pycore.
 */
export function scopeOrchClipSources(holder: OrchPlanScopeHolder): readonly OrchClipSource[] {
  return WORDNEW_ORCH_SCHEDULE.sources.map((source, index): OrchClipSource => {
    const stage = WORDNEW_ORCH_SCHEDULE.stages[index];
    if (stage === 'device') return source;
    const generate = stage.startsWith('generate:');
    return {
      origin: source.origin,
      resolve: (resources, context, found) => {
        const scope = holder.current;
        if (!scope) return source.resolve(resources, context, found);
        if (!generate) {
          return source.resolve(resources.filter((resource) => !scope.covered.has(resource.key) || scope.ready.has(resource.key)), context, found);
        }
        const share = scope.direct();
        const headLeft = { sentence: share.sentence_audio, word: share.word_audio };
        const own = resources.filter((resource) => {
          if (!scope.covered.has(resource.key)) return true;
          const lane = resource.kind === 'word' ? 'word' : 'sentence';
          if (stage === 'generate:pycore' && headLeft[lane] > 0) {
            headLeft[lane] -= 1;
            return true;
          }
          if (!scope.ready.has(resource.key)) context.generating(resource, 'laravel');
          return false;
        });
        return own.length > 0 ? source.resolve(own, context, found) : Promise.resolve();
      },
    };
  });
}
