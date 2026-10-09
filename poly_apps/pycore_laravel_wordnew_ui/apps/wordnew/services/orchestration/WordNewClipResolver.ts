/**
 * The one clip lookup / fetch service for every wordnew audio caller outside a composition run (word buttons,
 * word list player, daily reading, reader cells, click-to-sound): a clip is identified by its resource id
 * (shared/orchestration/orchClipIdentity), looked up in the permanent device store first (R14: a held clip is
 * never requested again) and otherwise fetched through the SAME sources the composition run uses - the
 * schedule's `device` and `transfer:*` stages in their order (WORDNEW_ORCH_SCHEDULE; availability from
 * `wordNewChannels`, one slot per transfer in TransferLimiter) - into the same store with the same identity and
 * version recording. Generation stays with the queue owners (WordNewQueueCenter) and the composition run.
 * Requests of one tick are coalesced into one batched run, and one clip in flight is fetched once.
 */
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import type { OrchResourceKind } from '../../../../core/integrations/pycore';
import { orchClipIdentity, type OrchClipIdentity } from '../../../../shared/orchestration/orchClipIdentity';
import { resolveOrchClips } from '../../../../shared/orchestration/orchClipResolver';
import type { OrchComposeResource } from '../../../../shared/orchestration/orchTypes';
import { WORDNEW_ORCH_SCHEDULE } from './WordNewOrchClipSources';
import { wordNewOrchClipStore } from './WordNewOrchClipStore';

/** What a caller knows about a clip: its kind, language and text (the identity follows from them). */
export interface WordNewClipRef {
  kind: OrchResourceKind;
  language: string;
  text: string;
}

export interface WordNewClipFetchOptions {
  /** Give up waiting after this long (the fetch itself goes on and lands in the store). */
  timeoutMs?: number;
  /** Ask again although the clip was found missing within the recheck window. */
  force?: boolean;
}

interface PendingFetch {
  resource: OrchComposeResource;
  waiters: Array<(url: string | null) => void>;
}

const COALESCE_MS = 20;
const BATCH_MAX = 100;
const NATIVE = isNativeAppShell();

/** The stages a lookup may use: the device store and every transfer (never a generate stage). */
const TRANSFER_SOURCES = WORDNEW_ORCH_SCHEDULE.sources.filter((_, index) => {
  const stage = WORDNEW_ORCH_SCHEDULE.stages[index];
  return stage === 'device' || stage.startsWith('transfer:');
});

export const wordNewClipRef = (kind: OrchResourceKind, language: string, text: string): WordNewClipRef => ({ kind, language, text });

export const wordNewWordClip = (text: string, language = 'en'): WordNewClipRef => wordNewClipRef('word', language, text);

export const wordNewSentenceClip = (text: string, language = 'en'): WordNewClipRef => wordNewClipRef('sentence', language, text);

/** Whether the ref can name a clip (a clip without text has no identity). */
export const wordNewClipUsable = (ref: WordNewClipRef | null | undefined): ref is WordNewClipRef =>
  !!ref && ref.text.trim() !== '' && ref.language.trim() !== '';

class WordNewClipResolverClass {
  /** Playable URLs resolved so far (store URLs, page object URLs); dropped when the store moves or loses clips. */
  private readonly known = new Map<string, string>();
  private readonly inFlight = new Map<string, PendingFetch>();
  /** When a backend last answered that a clip is missing: it is not asked again within the generation recheck window. */
  private readonly missing = new Map<string, number>();
  private queue: PendingFetch[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private heldWaiters = new Map<string, { identity: OrchClipIdentity; waiters: Array<(url: string | null) => void> }>();
  private heldTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    wordNewOrchClipStore.onRemoved(() => this.known.clear());
    wordNewOrchClipStore.onRootChanged(() => this.known.clear());
  }

  identityOf(ref: WordNewClipRef): OrchClipIdentity {
    return orchClipIdentity(ref.kind, ref.language, ref.text.trim());
  }

  /** The playable URL already resolved in this session (no lookup), or undefined. */
  peek(ref: WordNewClipRef): string | undefined {
    return wordNewClipUsable(ref) ? this.known.get(this.identityOf(ref).resourceId) : undefined;
  }

  /**
   * The playable URL when the device store holds the clip (native; batched with the other lookups of the tick), else
   * null. The web keeps no store: only clips resolved in this page are known.
   */
  held(ref: WordNewClipRef): Promise<string | null> {
    if (!wordNewClipUsable(ref)) return Promise.resolve(null);
    const identity = this.identityOf(ref);
    const known = this.known.get(identity.resourceId);
    if (known) return Promise.resolve(known);
    if (!NATIVE) return Promise.resolve(null);
    return new Promise((resolve) => {
      const waiting = this.heldWaiters.get(identity.resourceId);
      if (waiting) waiting.waiters.push(resolve);
      else this.heldWaiters.set(identity.resourceId, { identity, waiters: [resolve] });
      this.heldTimer ??= setTimeout(() => { void this.flushHeld(); }, COALESCE_MS);
    });
  }

  /** `held` for many refs at once: the playable URL of each held clip, by ref index. */
  async heldMany(refs: readonly WordNewClipRef[]): Promise<Map<number, string>> {
    const answers = await Promise.all(refs.map((ref) => this.held(ref)));
    const found = new Map<number, string>();
    answers.forEach((url, index) => { if (url) found.set(index, url); });
    return found;
  }

  private async flushHeld(): Promise<void> {
    this.heldTimer = null;
    const batch = [...this.heldWaiters.values()];
    this.heldWaiters = new Map();
    let hits = new Map<string, { url: string }>();
    try {
      hits = await wordNewOrchClipStore.lookup(batch.map(({ identity }) => identity));
    } catch {
      /* A store that cannot answer holds nothing for this tick. */
    }
    batch.forEach(({ identity, waiters }) => {
      const url = hits.get(identity.resourceId)?.url ?? null;
      if (url) this.known.set(identity.resourceId, url);
      waiters.forEach((resolve) => resolve(url));
    });
  }

  /**
   * Resolve the clip: the device store, then the schedule's transfer stages in their order (the optional `remoteUrl`
   * is the Laravel file the caller's payload already named; it seeds the Laravel stage). Null when no source has it.
   */
  async fetch(ref: WordNewClipRef, remoteUrl?: string | null, options: WordNewClipFetchOptions = {}): Promise<string | null> {
    if (!wordNewClipUsable(ref)) return null;
    const identity = this.identityOf(ref);
    const known = this.known.get(identity.resourceId);
    if (known) return known;
    const missingAt = this.missing.get(identity.resourceId);
    if (!options.force && missingAt && Date.now() - missingAt < AUDIO_ORCH_TRANSFER.generationRecheckMs) return null;
    const result = this.enqueue(identity, remoteUrl ?? null);
    if (!options.timeoutMs) return result;
    return Promise.race([
      result,
      new Promise<null>((resolve) => { setTimeout(() => resolve(null), options.timeoutMs); }),
    ]);
  }

  private enqueue(identity: OrchClipIdentity, remoteUrl: string | null): Promise<string | null> {
    return new Promise((resolve) => {
      const running = this.inFlight.get(identity.resourceId);
      if (running) {
        running.waiters.push(resolve);
        return;
      }
      const pending: PendingFetch = {
        resource: { ...identity, key: identity.resourceId, laravelUrl: remoteUrl },
        waiters: [resolve],
      };
      this.inFlight.set(identity.resourceId, pending);
      this.queue.push(pending);
      this.timer ??= setTimeout(() => { void this.flush(); }, COALESCE_MS);
    });
  }

  private async flush(): Promise<void> {
    this.timer = null;
    const queued = this.queue;
    this.queue = [];
    for (let offset = 0; offset < queued.length; offset += BATCH_MAX) {
      await this.run(queued.slice(offset, offset + BATCH_MAX));
    }
  }

  private async run(batch: PendingFetch[]): Promise<void> {
    let urls = new Map<string, string>();
    const answeredMissing = new Set<string>();
    try {
      const resources = batch.map(({ resource }) => resource);
      const progress = await resolveOrchClips(resources, TRANSFER_SOURCES, { meaningOf: () => '' });
      urls = new Map([...progress.clips].map(([key, clip]) => [key, clip.url]));
      resources.forEach((resource, index) => {
        if (progress.table.state(index) === 'missing') answeredMissing.add(resource.key);
      });
    } catch {
      /* A failed run leaves the clips unresolved; callers fall back to their own tier. */
    }
    batch.forEach(({ resource, waiters }) => {
      const url = urls.get(resource.key) ?? null;
      if (url) {
        this.known.set(resource.key, url);
        this.missing.delete(resource.key);
      } else if (answeredMissing.has(resource.key)) {
        this.missing.set(resource.key, Date.now());
      }
      this.inFlight.delete(resource.key);
      waiters.forEach((resolve) => resolve(url));
    });
  }
}

export const wordNewClipResolver = new WordNewClipResolverClass();
