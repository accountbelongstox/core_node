/**
 * Phrases of the sentences a composition plans (pattern step `phrases`, docs_fix/DESIGN_PHRASE_PIPELINE.md).
 *
 * Laravel extracts the phrases of a sentence once (`phrases_by_sentences`, at most 500 sentences per call, answered
 * in request order). The device keeps every answer per sentence content id and never asks for held data again
 * (WORDNEW_GUIDE R14): a sentence with a final status (`done` / `none`) is answered from the device, only sentences
 * still `pending` / `unknown` on the server (or `failed` long ago) are asked on a later run - the composer re-runs
 * until they arrive. Native keeps the answers in small shard files (language / first two chars of the content id),
 * so a whole book never rewrites one large document; the web keeps them for the page lifetime only.
 */
import { AUDIO_ORCH_TRANSFER } from '../../../../core/contracts/AudioOrchestrationContract';
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { orchPool, orchRetry } from '../../../../shared/orchestration/orchClipResolver';
import type { OrchPhraseText } from '../../../../shared/orchestration/orchTypes';
import { wfNewApi, type WfNewPhrase, type WfNewSentencePhraseStatus } from '../../api';
import { PHRASES_BY_SENTENCES_MAX_IDS } from '../../api/methods/phrases';
import { CapJsonStore, Directory, capFs } from '../../platform/capabilities';

const PHRASE_DIR = 'wfnew-orch/phrases';
const PLANS_PATH = `${PHRASE_DIR}/plans.json`;
const SHARD_PREFIX_CHARS = 2;
const ASK_CONCURRENCY = 3;

/** One kept phrase: [content id, text, meaning, has audio (0 | 1), version (0 = none)]. */
type HeldPhrase = [string, string, string, number, number];

/** One kept sentence: status, when it was answered, its phrases. */
interface HeldSentence {
  s: WfNewSentencePhraseStatus;
  t: number;
  p: HeldPhrase[];
}

type ShardDocument = Record<string, HeldSentence>;

export interface OrchPhraseResolution {
  /** Phrases per sentence content id (only sentences that have some). */
  bySentence: Map<string, OrchPhraseText[]>;
  /** Sentences the server has not extracted yet (or that were never answered): asked again on a later run. */
  pending: string[];
  /** Sentences the server does not hold: asked again on a later run, but nothing waits for them. */
  unknown: number;
  /** Sentences whose extraction failed on the server (not chased until the server returns them to its pool). */
  failed: number;
  /** At least one answer (or kept copy) exists, i.e. the result is not a blind guess. */
  answered: boolean;
}

export interface OrchPhraseAskOptions {
  signal?: AbortSignal;
  /** False: nothing is requested (offline / logged out); the kept answers are used as they are. */
  ask: boolean;
}

const isFinal = (entry: HeldSentence | undefined): boolean => entry?.s === 'done' || entry?.s === 'none';

/** Whether a kept sentence is asked again on this run (never a final one; a recent unanswered one waits its re-check interval). */
function needsAsk(entry: HeldSentence | undefined, now: number): boolean {
  if (!entry) return true;
  if (isFinal(entry)) return false;
  const waitMs = entry.s === 'failed' ? AUDIO_ORCH_TRANSFER.absenceRecheckMs : AUDIO_ORCH_TRANSFER.generationRecheckMs;
  return now - entry.t >= waitMs;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

const prefixOf = (contentId: string): string => contentId.slice(0, SHARD_PREFIX_CHARS).toLowerCase();
const shardPath = (language: string, prefix: string): string => `${PHRASE_DIR}/${language}/${prefix}.json`;
const memoryKey = (language: string, prefix: string): string => `${language}/${prefix}`;

function toHeld(status: WfNewSentencePhraseStatus, phrases: readonly WfNewPhrase[], previous: HeldSentence | undefined, now: number): HeldSentence {
  const kept = previous?.p ?? [];
  // An answer without phrases never wipes kept ones (a sentence that was answered `done` stays `done`).
  if ((status === 'pending' || status === 'unknown') && kept.length > 0) return { s: previous?.s ?? status, t: now, p: kept };
  return {
    s: status,
    t: now,
    p: phrases.map((phrase): HeldPhrase => [phrase.contentId, phrase.text, phrase.meaning, phrase.hasAudio ? 1 : 0, phrase.version ?? 0]),
  };
}

class WordNewOrchPhraseStoreService {
  private readonly keep = isNativeAppShell();
  /** Web: the answers of this page lifetime. */
  private readonly memory = new Map<string, ShardDocument>();
  /** Web: phrases planned per task (native keeps it in `plans.json`). */
  private readonly planned = new Map<string, number>();
  /** Shard writes run one at a time: each re-reads its shard, merges and saves (no lost update between two runs). */
  private chain: Promise<void> = Promise.resolve();

  private shardStore(language: string, prefix: string): CapJsonStore<ShardDocument> {
    return new CapJsonStore<ShardDocument>(shardPath(language, prefix), {}, Directory.Data);
  }

  private async shardDocument(language: string, prefix: string): Promise<ShardDocument> {
    if (!this.keep) return this.memory.get(memoryKey(language, prefix)) ?? {};
    return this.shardStore(language, prefix).load().catch((): ShardDocument => ({}));
  }

  /** The kept state of `ids` (one read per shard). */
  private async read(language: string, ids: readonly string[]): Promise<Map<string, HeldSentence>> {
    const byPrefix = new Map<string, string[]>();
    ids.forEach((id) => {
      const prefix = prefixOf(id);
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), id]);
    });
    const held = new Map<string, HeldSentence>();
    for (const [prefix, members] of byPrefix) {
      const document = await this.shardDocument(language, prefix);
      members.forEach((id) => { if (document[id]) held.set(id, document[id]); });
    }
    return held;
  }

  /** Merge answers into their shards (serialized). */
  private commit(language: string, updates: ReadonlyMap<string, HeldSentence>): Promise<void> {
    this.chain = this.chain.catch(() => undefined).then(async () => {
      const byPrefix = new Map<string, Array<[string, HeldSentence]>>();
      updates.forEach((entry, id) => byPrefix.set(prefixOf(id), [...(byPrefix.get(prefixOf(id)) ?? []), [id, entry]]));
      for (const [prefix, entries] of byPrefix) {
        if (!this.keep) {
          const key = memoryKey(language, prefix);
          const document = this.memory.get(key) ?? {};
          entries.forEach(([id, entry]) => { document[id] = entry; });
          this.memory.set(key, document);
          continue;
        }
        const store = this.shardStore(language, prefix);
        const document = await store.load().catch((): ShardDocument => ({}));
        entries.forEach(([id, entry]) => { document[id] = entry; });
        await store.save(document);
      }
    });
    return this.chain;
  }

  /** Ask the server for `ids`; every answered chunk is kept at once (an interrupted run keeps what it got). */
  private async ask(language: string, ids: readonly string[], held: Map<string, HeldSentence>, signal?: AbortSignal): Promise<boolean> {
    let answered = false;
    await orchPool(chunks(ids, PHRASES_BY_SENTENCES_MAX_IDS), async (chunk) => {
      const items = await orchRetry(() => wfNewApi.getPhrasesBySentences(language, chunk), signal);
      if (!items) return;
      answered = true;
      const now = Date.now();
      const updates = new Map<string, HeldSentence>();
      items.forEach((item) => updates.set(item.contentId, toHeld(item.status, item.phrases, held.get(item.contentId), now)));
      updates.forEach((entry, id) => held.set(id, entry));
      await this.commit(language, updates);
    }, signal, ASK_CONCURRENCY);
    return answered;
  }

  /**
   * The phrases of sentences `sentenceIds` (content ids of `language` sentences): kept answers first, then only the
   * sentences that are not final on the device are asked (single batch pass, pages of 500).
   */
  async resolve(language: string, sentenceIds: readonly string[], { signal, ask }: OrchPhraseAskOptions): Promise<OrchPhraseResolution> {
    const ids = [...new Set(sentenceIds)];
    const held = await this.read(language, ids);
    const now = Date.now();
    const toAsk = ask ? ids.filter((id) => needsAsk(held.get(id), now)) : [];
    const answered = toAsk.length > 0 ? await this.ask(language, toAsk, held, signal) : false;
    return this.resolution(ids, held, answered || held.size > 0);
  }

  /**
   * One cheap re-check of sentences that were pending: only those are asked (no interval wait, the caller paces it).
   * `resolved` are the ids the server no longer reports as pending.
   */
  async refresh(language: string, pendingIds: readonly string[], signal?: AbortSignal): Promise<{ resolved: string[]; pending: string[] }> {
    const ids = [...new Set(pendingIds)];
    const held = await this.read(language, ids);
    await this.ask(language, ids, held, signal);
    const resolved = ids.filter((id) => held.get(id)?.s !== 'pending' && held.has(id));
    return { resolved, pending: ids.filter((id) => !resolved.includes(id)) };
  }

  private resolution(ids: readonly string[], held: ReadonlyMap<string, HeldSentence>, answered: boolean): OrchPhraseResolution {
    const bySentence = new Map<string, OrchPhraseText[]>();
    const pending: string[] = [];
    let failed = 0;
    let unknown = 0;
    ids.forEach((id) => {
      const entry = held.get(id);
      if (entry && entry.p.length > 0) bySentence.set(id, entry.p.map(([, text, meaning]) => ({ text, meaning })));
      if (entry?.s === 'failed') failed += 1;
      else if (entry?.s === 'unknown') unknown += 1;
      else if (!isFinal(entry)) pending.push(id);
    });
    return { bySentence, pending, unknown, failed, answered };
  }

  /**
   * Remember how many phrases a task's plan holds; true when that count differs from the last plan of the task
   * (stage cursors are plan positions: phrases inserted into the plan invalidate them).
   */
  async notePlanned(taskId: string, count: number): Promise<boolean> {
    if (!this.keep) {
      const previous = this.planned.get(taskId);
      this.planned.set(taskId, count);
      return previous !== undefined && previous !== count;
    }
    const store = new CapJsonStore<Record<string, number>>(PLANS_PATH, {}, Directory.Data);
    const document = await store.load().catch((): Record<string, number> => ({}));
    const previous = document[taskId];
    if (previous === count) return false;
    await store.save({ ...document, [taskId]: count });
    return previous !== undefined;
  }

  /** The user cleared the cache: the kept phrase answers go (the next run asks again). */
  async clear(): Promise<void> {
    this.memory.clear();
    this.planned.clear();
    if (this.keep) await capFs.rmdir(PHRASE_DIR, Directory.Data);
  }
}

export const wordNewOrchPhraseStore = new WordNewOrchPhraseStoreService();
