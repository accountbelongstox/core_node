/**
 * Clip scheduler - the one place that decides where a composition's clips come
 * from (docs_fix/DESIGN_WORDNEW_CLIENT.md section 4).
 * Every end (wordnew native / web, pycore-manager) builds its clip chain here;
 * an end only provides its channels' specifics and where clips are kept.
 *
 * A channel is a backend reached one way: the selected pycore directly, a
 * paired pycore through the Laravel relay, or Laravel. Each can transfer clips
 * (framed bundles, with a per-file fallback), report which clips it holds, and
 * accept clips to generate. The schedule, in order:
 *   1 device store                         (the end's own source)
 *   2 transfer  pycore (direct)            when the selected pycore is online
 *   3 transfer  Laravel
 *   4 generate  pycore (direct)            when the selected pycore is online
 *   5 transfer  pycore via the relay       when no pycore is online directly
 *   6 generate  pycore via the relay       idem
 *   7 generate  Laravel (queue head)       when no pycore is reachable at all
 * Every end follows this order; an end without a device store (the web)
 * starts at 2. Generation stages deliver nothing in the
 * run: they flag the clips `generating`; `recheckGenerating` reports which of
 * them a pycore holds by now (the caller then resumes the run, idempotently).
 *
 * HARD RULES - binding on every end. Changing one needs the user's approval
 * and an update of development-guides/WORDNEW_GUIDE.md ("Clip scheduler") and
 * of the drills (docs_fix/TEST_20261001_ORCH_CLIP_SCHEDULER_DRILL.md).
 *   R1 Order is ORCH_CLIP_STAGE_ORDER on every end (native and web alike); an
 *      end may only omit stages it lacks. `buildOrchClipSchedule` refuses any
 *      other order.
 *   R2 pycore-direct stages run only while the selected pycore is usable directly.
 *   R3 Relay stages run only while no pycore is usable directly and the relay is.
 *   R4 Laravel generation runs only while no pycore is reachable (direct or
 *      relay) and Laravel is usable.
 *   R5 Every bundle re-checks its stage's gate once it holds a transfer slot:
 *      a channel that went away gets no further request.
 *   R6 Generation stages deliver nothing. Per run they request at most
 *      `generate_max_items` NEW missing clips (plan order, from the stage
 *      cursor on); clips requested within the window stay flagged and are not
 *      requested again. Continuation comes from `recheckGenerating` and a
 *      resumed run, never from a stage waiting.
 *   R7 Channel availability comes from ONE source per end (wordnew:
 *      `wordNewChannels`). Stages never judge availability themselves.
 *   R8 A clip is delivered once per run; what a channel does not deliver is
 *      released (never left `loading`) and goes on to the next stage.
 *   R9 Recovery while pycore / Laravel come and go (WordNewOrchComposer):
 *      a channel turning usable, an endpoint change, `online` or start resumes
 *      every unfinished (`resolving` / `partial`) task of the device, open or
 *      not; a failed run stays `resolving`; resumed runs fetch only what is
 *      still missing.
 *   R10 State is an OrchClipTable (one byte per plan resource, the plan's
 *      resource array is the mapping) and progress is per-stage cursors
 *      (endpoint, plan position, time): never per-item objects or text. A
 *      resumed run starts each stage at its fresh cursor (R9 continuation); the
 *      device stage answers first in one batched lookup.
 */
import { AUDIO_ORCH_TRANSFER } from '../../core/contracts/AudioOrchestrationContract';
import {
  ORCH_RESOURCE_BUNDLE_MAX_ITEMS,
  ORCH_RESOURCE_LOOKUP_MAX_ITEMS,
  PYCORE_HTTP_ROUTES,
  parseOrchResourceBundle,
  pycoreApi,
  pycoreDirectRequest,
  pycoreTargetBackendUrl,
  relayPycoreFetch,
  relayPycoreOrigin,
  type OrchResourceLookupItem,
  type OrchResourceLookupResponse,
} from '../../core/integrations/pycore';
import { readBytesWithStallGuard } from '../../core/network/StallGuardedRead';
import { transferLimiter } from '../../core/network/TransferLimiter';
import {
  ORCH_BUNDLE_ROUTE_MISSING,
  resolveByBundles,
  type OrchBundleSink,
  type OrchBundleTransport,
} from './orchClipBundle';
import { OrchChannelPaused, orchPool, orchRetry, type OrchClipSource, type OrchClipSourceContext } from './orchClipResolver';
import type { OrchChannelId, OrchComposeResource, OrchResolvedClip } from './orchTypes';

type Found = (resource: OrchComposeResource, clip: OrchResolvedClip) => void;
type ResourceKind = OrchComposeResource['kind'];

export interface OrchClipChannel {
  id: OrchChannelId;
  /** Usable now (link online, relay paired, ...). */
  available: () => Promise<boolean>;
  bundle: OrchBundleTransport;
  /** Transfer per file even when bundles exist (an end that plays this channel's URLs directly). */
  preferPerFile?: boolean;
  /** Per-file transfer: a server without the bundle route, or an end that plays URLs directly. */
  /** Resolves `resources` one file at a time; returns how many transfers still failed after their retries. */
  perFile?: (resources: OrchComposeResource[], sink: OrchBundleSink, context: OrchClipSourceContext, found: Found) => Promise<number>;
  /** Ask the backend to generate missing clips of one kind (true when accepted). */
  generate?: (kind: ResourceKind, resources: OrchComposeResource[]) => Promise<boolean>;
  /** Keys of the resources the backend holds now. */
  holds?: (resources: OrchComposeResource[]) => Promise<Set<string>>;
  /** A request failed on this channel (lets the end re-check its link). */
  onFailure?: () => void;
}

const refOf = ({ kind, language, text }: OrchComposeResource) => ({ kind, language, text });
const LOOKUP_BATCH = Math.min(200, ORCH_RESOURCE_LOOKUP_MAX_ITEMS);
const RESOURCE_KINDS: readonly ResourceKind[] = ['word', 'sentence'];

/** Keys of the hits of a lookup answer (index-aligned with `batch`). */
function lookupHits(batch: OrchComposeResource[], answer: OrchResourceLookupResponse | null): Set<string> {
  const hits = new Set<string>();
  if (!answer?.success || !Array.isArray(answer.items)) return hits;
  batch.forEach((resource, index) => {
    if (answer.items?.[index]?.hit) hits.add(resource.key);
  });
  return hits;
}

async function holdsInBatches(
  resources: OrchComposeResource[],
  lookup: (batch: OrchComposeResource[]) => Promise<OrchResourceLookupResponse | null>,
): Promise<Set<string>> {
  const hits = new Set<string>();
  for (let offset = 0; offset < resources.length; offset += LOOKUP_BATCH) {
    const batch = resources.slice(offset, offset + LOOKUP_BATCH);
    lookupHits(batch, await lookup(batch).catch(() => null)).forEach((key) => hits.add(key));
  }
  return hits;
}

/** pycore's older per-file path: lookup batches, then chunked reads of the hits. */
async function pycoreChunks(resources: OrchComposeResource[], sink: OrchBundleSink, context: OrchClipSourceContext, found: Found): Promise<number> {
  let failed = 0;
  for (let offset = 0; offset < resources.length && !context.signal?.aborted; offset += LOOKUP_BATCH) {
    const batch = resources.slice(offset, offset + LOOKUP_BATCH);
    const baseUrl = pycoreTargetBackendUrl();
    const answer = await orchRetry(async () => {
      const result = await pycoreApi.orchResourceLookup(batch.map(refOf));
      return result?.success && Array.isArray(result.items) ? result : null;
    }, context.signal);
    if (context.signal?.aborted) return failed;
    if (!answer?.items) return failed + resources.length - offset;
    context.answered('pycore', baseUrl);
    const hits: Array<{ resource: OrchComposeResource; item: OrchResourceLookupItem }> = [];
    batch.forEach((resource, index) => {
      const item = answer.items?.[index];
      if (item?.hit) hits.push({ resource, item });
    });
    await orchPool(hits, async ({ resource, item }) => {
      const meaning = item.meaning || context.meaningOf(resource);
      const file = await orchRetry(() => transferLimiter.run('pycore', () => {
        context.loading(resource, 'pycore', 0, item.bytes);
        return pycoreApi.orchFetchResource(
          refOf(resource),
          { signal: context.signal, onProgress: (loaded, total) => context.loading(resource, 'pycore', loaded, total) },
        );
      }, context.signal), context.signal);
      const url = file ? await sink.persist(resource, file.blob, meaning, 'pycore').catch(() => null) : null;
      if (url) found(resource, { key: resource.key, url, origin: 'pycore', via: 'pycore', meaning, bytes: file?.bytes });
      else {
        if (!file && !context.signal?.aborted) failed += 1;
        context.release(resource);
      }
    }, context.signal, AUDIO_ORCH_TRANSFER.parallelMax);
  }
  return failed;
}

/** The selected pycore, reached directly (its own target transport). */
export function orchPycoreDirectChannel(available: () => Promise<boolean>, onFailure?: () => void): OrchClipChannel {
  return {
    id: 'pycore',
    available,
    onFailure,
    bundle: {
      origin: 'pycore',
      via: 'pycore',
      maxItems: ORCH_RESOURCE_BUNDLE_MAX_ITEMS,
      baseUrl: pycoreTargetBackendUrl,
      nativeRequest: (batch) => pycoreDirectRequest(PYCORE_HTTP_ROUTES.audioOrchResourceBundle, { items: batch.map(refOf) }),
      fetch: async (batch, signal) => {
        const answer = await pycoreApi.orchResourceBundle(batch.map(refOf), signal);
        return { supported: answer.supported, entries: answer.entries.map((entry) => ({ ...entry, written: false })) };
      },
    },
    perFile: pycoreChunks,
    generate: async (kind, resources) => {
      const answer = await pycoreApi.promoteLocalQueueHead({ items: resources.map((resource) => ({ ...refOf(resource), kind })) });
      return answer?.success === true;
    },
    holds: (resources) => holdsInBatches(resources, (batch) => pycoreApi.orchResourceLookup(batch.map(refOf))),
  };
}

async function relayJson<T>(route: string, body: unknown): Promise<T | null> {
  const response = await relayPycoreFetch(route, body);
  return response.ok ? (await response.json()) as T : null;
}

/** A paired pycore reached through the Laravel relay (used when no pycore is online directly). */
export function orchPycoreRelayChannel(available: () => Promise<boolean>): OrchClipChannel {
  return {
    id: 'relay',
    available,
    bundle: {
      origin: 'pycore',
      via: 'relay',
      maxItems: AUDIO_ORCH_TRANSFER.relayBundleMaxItems,
      baseUrl: relayPycoreOrigin,
      fetch: async (batch, signal) => {
        const response = await relayPycoreFetch(PYCORE_HTTP_ROUTES.audioOrchResourceBundle, { items: batch.map(refOf) }, signal);
        if (response.status === ORCH_BUNDLE_ROUTE_MISSING) return { supported: false, entries: [] };
        if (!response.ok) throw new Error(`ORCH_BUNDLE_HTTP_${response.status}`);
        // No total deadline on the body: only a stalled stream fails.
        const entries = parseOrchResourceBundle(await readBytesWithStallGuard(response));
        return { supported: true, entries: entries.map((entry) => ({ ...entry, written: false })) };
      },
    },
    generate: async (kind, resources) => {
      const answer = await relayJson<{ success?: boolean }>(
        PYCORE_HTTP_ROUTES.queueCenterPromoteLocalHead,
        { items: resources.map((resource) => ({ ...refOf(resource), kind })) },
      ).catch(() => null);
      return answer?.success === true;
    },
    holds: (resources) => holdsInBatches(
      resources,
      (batch) => relayJson<OrchResourceLookupResponse>(PYCORE_HTTP_ROUTES.audioOrchResourceLookup, { items: batch.map(refOf) }),
    ),
  };
}

/** Plan index of a resource in the run's table (-1: not in the plan). */
const planIndex = (context: OrchClipSourceContext, resource: OrchComposeResource): number =>
  context.table.indexOf.get(resource.key) ?? -1;

/**
 * Transfer stage: bundles (falling back to the channel's per-file path), from the
 * stage's cursor on (R9): what lies below a fresh cursor of this endpoint was asked
 * recently and is not asked again. The cursor advances over contiguously finished
 * bundles; a bundle with deferred clips holds it (they are asked again next time).
 */
function transferStage(stage: OrchClipStageId, channel: OrchClipChannel, sink: OrchBundleSink, gate: () => Promise<boolean>): OrchClipSource {
  return {
    origin: channel.bundle.origin,
    async resolve(resources, context, found) {
      if (resources.length === 0) return;
      if (!(await gate())) {
        context.stage(stage, { state: 'skipped' });
        return;
      }
      const endpoint = channel.bundle.baseUrl();
      const from = context.cursors.position(stage, endpoint);
      const ask = from > 0 ? resources.filter((resource) => planIndex(context, resource) >= from) : resources;
      let delivered = 0;
      let batchesDone = 0;
      context.stage(stage, {
        state: 'running', asked: ask.length, known: resources.length - ask.length, found: 0,
        batches: Math.ceil(ask.length / channel.bundle.maxItems), batchesDone: 0,
      });
      const deliver = (resource: OrchComposeResource, clip: OrchResolvedClip): void => {
        delivered += 1;
        found(resource, clip);
      };
      let failed = false;
      if (ask.length > 0 && channel.preferPerFile && channel.perFile) {
        failed = (await channel.perFile(ask, sink, context, deliver)) > 0;
      } else if (ask.length > 0) {
        const finished = new Map<number, number>();
        let contiguous = 0;
        const outcome = await resolveByBundles(ask, channel.bundle, sink, context, deliver, {
          usable: gate,
          onBatch: (seq, batch, kept, deferred) => {
            batchesDone += 1;
            // A bundle with deferred clips never advances the cursor past itself.
            if (deferred === 0) finished.set(seq, Math.max(...batch.map((resource) => planIndex(context, resource))));
            while (finished.has(contiguous)) {
              context.cursors.advance(stage, endpoint, (finished.get(contiguous) ?? 0) + 1);
              contiguous += 1;
            }
            context.stage(stage, { batchesDone, found: delivered });
          },
        });
        if (outcome.kind === 'failed' && !context.signal?.aborted) {
          failed = true;
          channel.onFailure?.();
        }
        if (outcome.kind === 'unsupported' && channel.perFile) failed = (await channel.perFile(outcome.rest, sink, context, deliver)) > 0;
      }
      context.stage(stage, { state: failed ? 'failed' : 'done', batchesDone, found: delivered });
    },
  };
}

/**
 * Generate stage (R6): the missing clips below the stage's fresh cursor were
 * requested recently - they stay flagged and are not requested again; the next
 * `generate_max_items` after the cursor (plan order) are requested now.
 */
function generateStage(stage: OrchClipStageId, channel: OrchClipChannel, gate: () => Promise<boolean>): OrchClipSource {
  return {
    origin: channel.bundle.origin,
    async resolve(resources, context) {
      if (resources.length === 0 || !channel.generate) return;
      if (!(await gate())) {
        context.stage(stage, { state: 'skipped' });
        return;
      }
      const endpoint = channel.bundle.baseUrl();
      const from = context.cursors.position(stage, endpoint);
      const requested = resources.filter((resource) => planIndex(context, resource) < from);
      requested.forEach((resource) => context.generating(resource, channel.id));
      const next = resources.filter((resource) => planIndex(context, resource) >= from).slice(0, AUDIO_ORCH_TRANSFER.generateMaxItems);
      context.stage(stage, {
        state: 'running', asked: next.length, known: requested.length, found: requested.length,
        batches: RESOURCE_KINDS.filter((kind) => next.some((resource) => resource.kind === kind)).length, batchesDone: 0,
      });
      let accepted = 0;
      let batchesDone = 0;
      let complete = true;
      let paused: OrchChannelPaused | null = null;
      for (const kind of RESOURCE_KINDS) {
        const batch = next.filter((resource) => resource.kind === kind);
        if (batch.length === 0 || context.signal?.aborted) continue;
        const baseUrl = channel.bundle.baseUrl();
        try {
          if (await orchRetry(async () => ((await channel.generate?.(kind, batch)) ? true : null), context.signal)) {
            context.answered(channel.bundle.origin, baseUrl);
            batch.forEach((resource) => context.generating(resource, channel.id));
            accepted += batch.length;
          } else {
            complete = false;
          }
        } catch (error) {
          if (!(error instanceof OrchChannelPaused)) throw error;
          paused = error;
          complete = false;
          break;
        }
        batchesDone += 1;
        context.stage(stage, { batchesDone, found: requested.length + accepted });
      }
      // Only a fully accepted request moves the cursor past it.
      if (complete && next.length > 0) {
        context.cursors.advance(stage, endpoint, Math.max(...next.map((resource) => planIndex(context, resource))) + 1);
      }
      context.stage(stage, paused
        ? { state: 'paused', reason: paused.code, retryAfterSeconds: paused.retryAfterSeconds, found: requested.length + accepted }
        : { state: complete ? 'done' : 'failed', found: requested.length + accepted });
    },
  };
}

/** R1: the stage order every schedule must follow. */
export const ORCH_CLIP_STAGE_ORDER = [
  'device',
  'transfer:pycore',
  'transfer:laravel',
  'generate:pycore',
  'transfer:relay',
  'generate:relay',
  'generate:laravel',
] as const;

export type OrchClipStageId = (typeof ORCH_CLIP_STAGE_ORDER)[number];

export const ORCH_CLIP_SCHEDULE_ORDER_VIOLATION = 'ORCH_CLIP_SCHEDULE_ORDER_VIOLATION';

/** R1 check: the stages appear in ORCH_CLIP_STAGE_ORDER order. */
function assertStageOrder(stages: readonly OrchClipStageId[]): void {
  const rank = (stage: OrchClipStageId): number => ORCH_CLIP_STAGE_ORDER.indexOf(stage);
  stages.forEach((stage, index) => {
    if (index > 0 && rank(stage) <= rank(stages[index - 1])) {
      throw new Error(`${ORCH_CLIP_SCHEDULE_ORDER_VIOLATION}: ${stages.join(' > ')}`);
    }
  });
}

export interface OrchClipScheduleSpec {
  /** The end's own store (first). */
  device?: OrchClipSource;
  /** Where transferred clips are kept. */
  sink: OrchBundleSink;
  pycore: OrchClipChannel;
  relay?: OrchClipChannel;
  laravel?: OrchClipChannel;
}

export interface OrchClipSchedule {
  sources: readonly OrchClipSource[];
  /** The stage of each source (same order), checked against ORCH_CLIP_STAGE_ORDER. */
  stages: readonly OrchClipStageId[];
  /** Keys of `resources` a pycore (direct, else relay) holds now. */
  recheckGenerating: (resources: OrchComposeResource[]) => Promise<Set<string>>;
}

export function buildOrchClipSchedule(spec: OrchClipScheduleSpec): OrchClipSchedule {
  const direct = spec.pycore.available;
  const relayOnly = async (): Promise<boolean> => !(await direct()) && Boolean(spec.relay && (await spec.relay.available()));
  // Laravel generation: no pycore reachable at all, and Laravel itself usable.
  const laravelOnly = async (): Promise<boolean> => Boolean(spec.laravel && (await spec.laravel.available()))
    && !(await direct()) && !(await relayOnly());
  type Stage = [OrchClipStageId, OrchClipSource] | null;
  const built = [
    spec.device ? ['device', spec.device] as Stage : null,
    ['transfer:pycore', transferStage('transfer:pycore', spec.pycore, spec.sink, direct)] as Stage,
    spec.laravel ? ['transfer:laravel', transferStage('transfer:laravel', spec.laravel, spec.sink, spec.laravel.available)] as Stage : null,
    ['generate:pycore', generateStage('generate:pycore', spec.pycore, direct)] as Stage,
    spec.relay ? ['transfer:relay', transferStage('transfer:relay', spec.relay, spec.sink, relayOnly)] as Stage : null,
    spec.relay ? ['generate:relay', generateStage('generate:relay', spec.relay, relayOnly)] as Stage : null,
    spec.laravel ? ['generate:laravel', generateStage('generate:laravel', spec.laravel, laravelOnly)] as Stage : null,
  ].filter((stage): stage is [OrchClipStageId, OrchClipSource] => stage !== null);
  const stages = built.map(([stage]) => stage);
  assertStageOrder(stages);
  return {
    sources: built.map(([, source]) => source),
    stages,
    // Every usable channel is asked (a clip may be generated by pycore or by Laravel's lanes).
    recheckGenerating: async (resources) => {
      const held = new Set<string>();
      if (resources.length === 0) return held;
      const ask = async (channel: OrchClipChannel | undefined, usable: () => Promise<boolean>): Promise<void> => {
        if (!channel?.holds || !(await usable())) return;
        (await channel.holds(resources).catch(() => new Set<string>())).forEach((key) => held.add(key));
      };
      await ask(spec.pycore, direct);
      if (spec.relay) await ask(spec.relay, relayOnly);
      if (spec.laravel) await ask(spec.laravel, spec.laravel.available);
      return held;
    },
  };
}
