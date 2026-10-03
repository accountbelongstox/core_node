/**
 * Playback editions: the pre-compiled composition the preview and the player
 * page play, kept apart from the live run.
 *
 * An edition is the whole timeline: clips still missing are placeholders the
 * player skips. The first run reaching `ready` publishes it; after that it is
 * static - opening a page or a re-run never recompiles it. A later run with
 * other clips (new or updated resources, a re-orchestrated plan) is an offer
 * that replaces the edition only when accepted. Editions are kept per user on
 * the device (`wfnew-orch/users/<user>/editions/<task>.json`), so opening a
 * player needs no run and no network. The file is compact (one bridge write
 * on the app): items and clip URLs once each, timelines as flat number rows
 * (a placeholder's URL index is -1).
 */
import { capFs, Directory } from '../../platform/capabilities';
import type { OrchComposeSession } from '../../../../shared/orchestration/orchComposer';
import { orchResourceKey } from '../../../../shared/orchestration/orchPlanner';
import { orchEntryPlayable, type OrchTimelineEntry } from '../../../../shared/orchestration/orchStageLayout';
import type { OrchComposeItem, OrchComposeSentence, OrchComposeTask, OrchWordState } from '../../../../shared/orchestration/orchTypes';
import { orchNewWords } from '../../components/orch-compose/WordNewOrchNewWords';
import { wordNewOrchComposer } from './WordNewOrchComposer';
import { wordNewOrchTaskStore } from './WordNewOrchTaskStore';
import { orchUserPath, orchUserScope } from './WordNewOrchUserScope';

export interface OrchPlaybackEdition {
  id: string;
  taskId: string;
  planHash: string;
  publishedAt: string;
  timelines: OrchTimelineEntry[][];
  /** The sentences the timelines speak. */
  sentences: OrchComposeSentence[];
  /** Meaning of every spoken word (lower case). */
  meanings: Record<string, string>;
  /** Read state of every spoken word (virtual reads of played words). */
  words: Record<string, OrchWordState>;
  newWords: string[];
  /** Playable clips (placeholders not counted). */
  clips: number;
  durationMs: number;
}

/** A newer run waiting for the player's answer. */
export interface OrchEditionOffer {
  clips: number;
  durationMs: number;
  addedClips: number;
  addedMs: number;
}

/** Stored form: `segments[s]` = flat `[item, url, startMs, endMs, ...]` indices into `items` / `urls` (after `urlPrefix`). */
interface StoredEdition extends Omit<OrchPlaybackEdition, 'timelines'> {
  items: OrchComposeItem[];
  urlPrefix: string;
  urls: string[];
  segments: number[][];
}

interface EditionDocument {
  version: 2;
  edition: StoredEdition | null;
}

const ENTRY_FIELDS = 4;
const NO_URL = -1;
const PAGE_LOCAL_URL_PREFIX = 'blob:';

function commonPrefix(values: string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0];
  for (const value of values) {
    while (prefix && !value.startsWith(prefix)) prefix = prefix.slice(0, prefix.lastIndexOf('/', prefix.length - 2) + 1);
    if (!prefix) break;
  }
  return prefix;
}

function encodeEdition(edition: OrchPlaybackEdition): StoredEdition {
  const { timelines, ...meta } = edition;
  const itemIndex = new Map<OrchComposeItem, number>();
  const urlIndex = new Map<string, number>();
  const items: OrchComposeItem[] = [];
  const urls: string[] = [];
  const segments = timelines.map((timeline) => timeline.flatMap((entry) => {
    let item = itemIndex.get(entry.item);
    if (item === undefined) {
      item = items.push(entry.item) - 1;
      itemIndex.set(entry.item, item);
    }
    let url = orchEntryPlayable(entry) ? urlIndex.get(entry.clipUrl) : NO_URL;
    if (url === undefined) {
      url = urls.push(entry.clipUrl) - 1;
      urlIndex.set(entry.clipUrl, url);
    }
    return [item, url, Math.round(entry.startMs), Math.round(entry.endMs)];
  }));
  const urlPrefix = commonPrefix(urls);
  return { ...meta, items, urlPrefix, urls: urls.map((url) => url.slice(urlPrefix.length)), segments };
}

function decodeEdition(stored: StoredEdition | null | undefined): OrchPlaybackEdition | null {
  if (!stored || !Array.isArray(stored.segments)) return null;
  const { items, urlPrefix, urls, segments, ...meta } = stored;
  const timelines = segments.map((row) => {
    const timeline: OrchTimelineEntry[] = [];
    for (let at = 0; at + ENTRY_FIELDS <= row.length; at += ENTRY_FIELDS) {
      const url = row[at + 1];
      timeline.push({ item: items[row[at]], clipUrl: url === NO_URL ? '' : urlPrefix + urls[url], startMs: row[at + 2], endMs: row[at + 3] });
    }
    return timeline;
  });
  return { ...meta, timelines };
}

interface Offer extends OrchEditionOffer {
  task: OrchComposeTask;
  session: OrchComposeSession;
  signature: string;
}

type Listener = () => void;

function measure(timelines: OrchTimelineEntry[][]): { clips: number; durationMs: number } {
  return {
    clips: timelines.reduce((total, timeline) => total + timeline.filter(orchEntryPlayable).length, 0),
    durationMs: timelines.reduce((total, timeline) => total + (timeline[timeline.length - 1]?.endMs ?? 0), 0),
  };
}

function signatureOf(planHash: string, clips: number, durationMs: number): string {
  return `${planHash}:${clips}:${Math.round(durationMs)}`;
}

function editionSignature(edition: OrchPlaybackEdition | null): string {
  return edition ? signatureOf(edition.planHash, edition.clips, edition.durationMs) : '';
}

function hasPageLocalUrls(edition: OrchPlaybackEdition): boolean {
  return edition.timelines.some((timeline) => timeline.some((entry) => entry.clipUrl.startsWith(PAGE_LOCAL_URL_PREFIX)));
}

function newEditionId(): string {
  return `e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Copy what playing a run needs (the sentences / words its timelines speak). */
function copyEdition(task: OrchComposeTask, session: OrchComposeSession): OrchPlaybackEdition | null {
  const plan = session.plan;
  if (!plan || session.timelines.length === 0) return null;
  const timelines = session.timelines.map((timeline) => [...timeline]);
  const seqs = new Set<number>();
  const spokenWords = new Set<string>();
  timelines.forEach((timeline) => timeline.forEach((entry) => {
    seqs.add(entry.item.seq);
    const word = (entry.item.meaningOf ?? (entry.item.kind === 'word' ? entry.item.text : '')).toLowerCase();
    if (word) spokenWords.add(word);
  }));
  const meanings: Record<string, string> = {};
  const words: Record<string, OrchWordState> = {};
  spokenWords.forEach((word) => {
    const state = session.wordStates.get(word);
    const meaning = session.clips.get(orchResourceKey('word', task.language, word))?.meaning || state?.meaning || '';
    if (meaning) meanings[word] = meaning;
    if (state) words[word] = state;
  });
  const { clips, durationMs } = measure(timelines);
  return {
    id: newEditionId(),
    taskId: task.id,
    planHash: session.planHash,
    publishedAt: new Date().toISOString(),
    timelines,
    sentences: plan.sentences.filter((sentence) => seqs.has(sentence.seq)),
    meanings,
    words,
    newWords: orchNewWords(plan, session.wordStates, task.config.newOnlyMaxReadCount ?? 0).filter((word) => spokenWords.has(word)),
    clips,
    durationMs,
  };
}

class WordNewOrchEditionStoreService {
  private readonly editions = new Map<string, OrchPlaybackEdition | null>();
  private readonly loads = new Map<string, Promise<OrchPlaybackEdition | null>>();
  private readonly offers = new Map<string, Offer>();
  private readonly dismissed = new Map<string, string>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly versions = new Map<string, number>();
  private readonly seen = new WeakSet<OrchTimelineEntry[][]>();

  constructor() {
    wordNewOrchComposer.subscribeReady((taskId, session) => { void this.offer(taskId, session); });
  }

  private key(taskId: string): string {
    return `${orchUserScope()}:${taskId}`;
  }

  private path(taskId: string): string {
    return orchUserPath(orchUserScope(), `editions/${taskId}.json`);
  }

  private emit(taskId: string): void {
    const key = this.key(taskId);
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
    this.listeners.get(key)?.forEach((listener) => listener());
  }

  private load(taskId: string): Promise<OrchPlaybackEdition | null> {
    const key = this.key(taskId);
    if (this.editions.has(key)) return Promise.resolve(this.editions.get(key) ?? null);
    let loading = this.loads.get(key);
    if (!loading) {
      loading = capFs.readJson<EditionDocument>(this.path(taskId), null, Directory.Data).then((document) => {
        if (!this.editions.has(key)) {
          this.editions.set(key, document?.version === 2 ? decodeEdition(document.edition) : null);
          this.emit(taskId);
        }
        return this.editions.get(key) ?? null;
      }, () => null);
      this.loads.set(key, loading);
    }
    return loading;
  }

  private async publish(task: OrchComposeTask, session: OrchComposeSession): Promise<OrchPlaybackEdition | null> {
    const edition = copyEdition(task, session);
    if (!edition) return null;
    const key = this.key(task.id);
    this.editions.set(key, edition);
    this.offers.delete(key);
    this.emit(task.id);
    const document: EditionDocument = { version: 2, edition: encodeEdition(edition) };
    await capFs.writeText(this.path(task.id), JSON.stringify(document), Directory.Data).catch(() => undefined);
    return edition;
  }

  /** A run reached `ready`: the first one becomes the edition, a later one with other clips waits as an offer. */
  private async offer(taskId: string, session: OrchComposeSession): Promise<void> {
    if (this.seen.has(session.timelines) || session.timelines.length === 0) return;
    this.seen.add(session.timelines);
    const task = await wordNewOrchTaskStore.get(taskId);
    if (!task || task.planHash !== session.planHash) return;
    const current = await this.load(taskId);
    const { clips, durationMs } = measure(session.timelines);
    const signature = signatureOf(session.planHash, clips, durationMs);
    const key = this.key(taskId);
    if (signature === editionSignature(current)) {
      this.offers.delete(key);
      return;
    }
    if (!current) {
      await this.publish(task, session);
      return;
    }
    this.offers.set(key, {
      task,
      session,
      signature,
      clips,
      durationMs,
      addedClips: clips - current.clips,
      addedMs: durationMs - current.durationMs,
    });
    this.emit(taskId);
  }

  /**
   * A page opens the task: its stored edition as is (no recompilation). Only
   * without one is a ready run published; a differing run stays an offer.
   */
  async open(task: OrchComposeTask): Promise<OrchPlaybackEdition | null> {
    const key = this.key(task.id);
    const current = await this.load(task.id);
    const session = wordNewOrchComposer.session(task.id);
    if (session?.phase !== 'ready' || session.planHash !== task.planHash || session.timelines.length === 0) return current;
    if (!current) return this.publish(task, session);
    const { clips, durationMs } = measure(session.timelines);
    if (signatureOf(session.planHash, clips, durationMs) !== editionSignature(current)) {
      await this.offer(task.id, session);
      return current;
    }
    if (hasPageLocalUrls(current)) {
      // Same clips, page-local URLs (web): take this session's URLs, they die with their page.
      const fresh = copyEdition(task, session);
      if (fresh) this.editions.set(key, { ...fresh, id: current.id, publishedAt: current.publishedAt });
      this.emit(task.id);
    }
    return this.edition(task.id);
  }

  edition(taskId: string): OrchPlaybackEdition | null {
    return this.editions.get(this.key(taskId)) ?? null;
  }

  /** The offer the player has not answered yet (null once dismissed until a newer one). */
  pending(taskId: string): OrchEditionOffer | null {
    const key = this.key(taskId);
    const offer = this.offers.get(key);
    if (!offer || this.dismissed.get(key) === offer.signature) return null;
    return { clips: offer.clips, durationMs: offer.durationMs, addedClips: offer.addedClips, addedMs: offer.addedMs };
  }

  /** Copy the waiting offer into the playing edition. */
  async accept(taskId: string): Promise<OrchPlaybackEdition | null> {
    const offer = this.offers.get(this.key(taskId));
    return offer ? this.publish(offer.task, offer.session) : this.edition(taskId);
  }

  dismiss(taskId: string): void {
    const key = this.key(taskId);
    const offer = this.offers.get(key);
    if (offer) this.dismissed.set(key, offer.signature);
    this.emit(taskId);
  }

  subscribe = (taskId: string, listener: Listener): (() => void) => {
    const key = this.key(taskId);
    const set = this.listeners.get(key) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(key, set);
    return () => { set.delete(listener); };
  };

  version(taskId: string): number {
    return this.versions.get(this.key(taskId)) ?? 0;
  }
}

export const wordNewOrchEditionStore = new WordNewOrchEditionStoreService();
