/**
 * Clip bundle transfer (config/audio_orchestration_contract.json `transfer`):
 * tens of thousands of small clips move as framed bundles - one request per
 * bundle, as many in flight as the backend's transfer limit allows
 * (core/network/TransferLimiter, a live device setting) - instead of one
 * request per file. pycore and Laravel answer the same frame. In the native app the
 * Cronet plugin writes every clip straight into the clip store folder while
 * the response streams (no clip byte crosses the WebView bridge); elsewhere the
 * bundle is parsed in memory. A hit past a bundle's byte budget comes back
 * `sent:false` and is asked again in a later bundle.
 */
import { AUDIO_ORCH_TRANSFER } from '../../core/contracts/AudioOrchestrationContract';
import { nativeBundleAvailable, nativeBundleToFolder } from '../../core/network/ProtocolFetch';
import { transferLimiter } from '../../core/network/TransferLimiter';
import { orchPool, orchRetry, type OrchApiOrigin, type OrchClipSourceContext } from './orchClipResolver';
import type { OrchChannelId, OrchComposeResource, OrchResolvedClip } from './orchTypes';

const CLIP_MEDIA_TYPE = 'audio/mpeg';
/** Status of a server without the bundle route (an older build). */
export const ORCH_BUNDLE_ROUTE_MISSING = 404;

export interface OrchBundleEntry {
  index: number;
  hit: boolean;
  sent: boolean;
  bytes: number;
  meaning: string;
  /** Clip bytes (in-memory transfer). */
  data: Uint8Array | null;
  /** Written to the clip store folder by the native stack. */
  written: boolean;
}

export interface OrchBundleAnswer {
  /** False when the server has no bundle route. */
  supported: boolean;
  entries: OrchBundleEntry[];
}

export interface OrchBundleTransport {
  origin: OrchApiOrigin;
  /** Channel recorded on every delivered clip. */
  via: OrchChannelId;
  maxItems: number;
  /** Base URL of the API the next request goes to (reported once it answered). */
  baseUrl: () => string;
  /** URL, headers and JSON body for a native to-disk download; null when not possible now (e.g. relay). */
  nativeRequest?: (batch: OrchComposeResource[]) => Promise<{ url: string; headers: Record<string, string>; body: unknown } | null>;
  /** In-memory transfer; rejects on failure. */
  fetch: (batch: OrchComposeResource[], signal?: AbortSignal) => Promise<OrchBundleAnswer>;
}

export interface OrchBundleSink {
  /** Keep an in-memory clip delivered by `origin`; its playable URL (null when it could not be kept). */
  persist: (resource: OrchComposeResource, blob: Blob, meaning: string, origin: OrchApiOrigin) => Promise<string | null>;
  /** Native: the clip store folder and the file name of a key. */
  nativeTarget?: () => Promise<{ folder: string; fileName: (key: string) => string } | null>;
  /** Native: a clip `origin` wrote into the folder joins the store; its URL. */
  adoptWritten?: (resource: OrchComposeResource, bytes: number, meaning: string, origin: OrchApiOrigin) => Promise<string | null>;
}

export type OrchBundleOutcome =
  | { kind: 'done' }
  /** The server has no bundle route: these resources need the per-file path. */
  | { kind: 'unsupported'; rest: OrchComposeResource[] }
  | { kind: 'failed' };

async function nativeAnswer(
  transport: OrchBundleTransport,
  sink: OrchBundleSink,
  batch: OrchComposeResource[],
  signal?: AbortSignal,
): Promise<OrchBundleAnswer | null> {
  if (!nativeBundleAvailable() || !transport.nativeRequest || !sink.nativeTarget || !sink.adoptWritten) return null;
  const [target, request] = await Promise.all([sink.nativeTarget(), transport.nativeRequest(batch)]);
  if (!target || !request) return null;
  const result = await nativeBundleToFolder({
    ...request,
    folder: target.folder,
    names: batch.map((resource) => target.fileName(resource.key)),
    signal,
  });
  if (result.status === ORCH_BUNDLE_ROUTE_MISSING) return { supported: false, entries: [] };
  if (result.status !== 200) throw new Error(`ORCH_BUNDLE_HTTP_${result.status}`);
  return { supported: true, entries: result.entries.map((entry) => ({ ...entry, data: null })) };
}

export interface OrchBundleHooks {
  /** Asked once a bundle holds its transfer slot: a channel that went away gets no further request. */
  usable?: () => Promise<boolean>;
  /**
   * Bundle `seq` (numbered in the order batches are cut) answered: `delivered` of
   * its items were kept, `deferred` come again in a later bundle (past its byte budget).
   */
  onBatch?: (seq: number, batch: OrchComposeResource[], delivered: number, deferred: number) => void;
}

/** Resolve `resources` through bundles of `transport` into `sink`; what is left goes on to the next source. */
export async function resolveByBundles(
  resources: OrchComposeResource[],
  transport: OrchBundleTransport,
  sink: OrchBundleSink,
  context: OrchClipSourceContext,
  found: (resource: OrchComposeResource, clip: OrchResolvedClip) => void,
  hooks: OrchBundleHooks = {},
): Promise<OrchBundleOutcome> {
  const usable = hooks.usable ?? (async () => true);
  const queue = [...resources];
  let unsupported = false;
  let failed = false;
  let stopped = false;
  let nextSeq = 0;
  const lane = async (): Promise<void> => {
    while (queue.length > 0 && !unsupported && !failed && !stopped && !context.signal?.aborted) {
      const batch = queue.splice(0, transport.maxItems);
      const seq = nextSeq;
      nextSeq += 1;
      const baseUrl = transport.baseUrl();
      // The request holds a transfer slot of its backend while it is on the wire; the channel
      // is checked once the slot is held (it may have gone while the request waited), and its
      // items show as loading only then.
      // A failed request (network error, no answer) is tried again (orchRetry); a gone channel is not.
      const answer = await orchRetry(async () => {
        const sent = await transferLimiter.run(transport.origin, async () => {
          if (stopped || !(await usable())) return null;
          batch.forEach((resource) => context.loading(resource, transport.origin));
          return { answer: await nativeAnswer(transport, sink, batch, context.signal).then((native) => native ?? transport.fetch(batch, context.signal)) };
        }, context.signal).catch((error) => {
          batch.forEach((resource) => context.release(resource));
          throw error;
        });
        if (sent === null) stopped = true;
        return stopped ? { stopped: true as const } : sent?.answer ?? null;
      }, context.signal).then((result): OrchBundleAnswer | null => (!result || 'stopped' in result ? null : result));
      if (context.signal?.aborted) return;
      if (stopped) {
        // The channel went away: the batch is left for the next source.
        queue.unshift(...batch);
        return;
      }
      if (!answer || !answer.supported) {
        // Put the batch back: the caller takes it to the per-file path (or reports the failure).
        batch.forEach((resource) => context.release(resource));
        queue.unshift(...batch);
        if (answer) unsupported = true;
        else failed = true;
        return;
      }
      context.answered(transport.origin, baseUrl);
      const deferred: OrchComposeResource[] = [];
      const delivered = new Set<string>();
      await orchPool(answer.entries, async (entry: OrchBundleEntry) => {
        const resource = batch[entry.index];
        if (!resource) return;
        if (!entry.hit) {
          // Not held here: never shown as loading while nothing transfers.
          context.release(resource);
          return;
        }
        if (!entry.sent) {
          deferred.push(resource);
          return;
        }
        const meaning = entry.meaning || context.meaningOf(resource);
        context.loading(resource, transport.origin, entry.bytes, entry.bytes);
        // A clip that cannot be kept (disk full, volume gone) stays unresolved for the next source.
        const url = entry.written && sink.adoptWritten
          ? await sink.adoptWritten(resource, entry.bytes, meaning, transport.origin).catch(() => null)
          : entry.data
            ? await sink.persist(resource, new Blob([entry.data as BlobPart], { type: CLIP_MEDIA_TYPE }), meaning, transport.origin).catch(() => null)
            : null;
        if (url) {
          delivered.add(resource.key);
          found(resource, { key: resource.key, url, origin: transport.origin, via: transport.via, meaning, bytes: entry.bytes });
        }
      }, context.signal);
      // Whatever this bundle did not deliver (absent, deferred, not kept) is not loading any more.
      batch.forEach((resource) => {
        if (!delivered.has(resource.key)) context.release(resource);
      });
      hooks.onBatch?.(seq, batch, delivered.size, deferred.length);
      queue.push(...deferred);
    }
  };
  // Lanes up to the contract maximum; the limiter decides how many are on the wire.
  await Promise.all(Array.from({ length: AUDIO_ORCH_TRANSFER.parallelMax }, lane));
  if (unsupported) return { kind: 'unsupported', rest: queue };
  return failed ? { kind: 'failed' } : { kind: 'done' };
}
