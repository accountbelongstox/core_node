/**
 * HowToPronounce Pronunciation Source
 *
 * The parallel "howtopronounce mode" that shares the Bing dictionary worker's
 * word_translation task data. For each word the worker claims, this source
 * drives a background zh.howtopronounce.com tab (URL navigation - no foreground
 * typing, so it never contends with the Bing worker's foreground lock) and
 * returns a pronunciation contribution: the best-voted audio clip as base64 +
 * IPA + wiki/sentences. The Bing worker merges it into the word's ResultEntry
 * via mergeInto() (pure fill-missing - non-destructive, safe with the
 * idempotent Laravel writeback).
 *
 * POOL: the Bing worker runs `tabCount` slots in parallel, each calling
 * lookup(). A single howtopronounce tab would serialize and bottleneck the
 * batch, so this source keeps a small pool (default 3) of background tabs with
 * an acquire/release semaphore - howtopronounce parallelism then matches Bing's.
 *
 * Fail-soft by design: a howtopronounce miss NEVER fails a word - the Bing
 * result still ships. Audio bytes are fetched by the tool in the background
 * (CORS bypass via <all_urls>); this module only orchestrates tabs + picks the
 * best clip. NOT registered with tabController (whose single healHandler
 * belongs to the Bing pool) - liveness is checked on acquire, dead tabs are
 * evicted + replaced transparently.
 */

import { howToPronounceTool, HowToPronounceResult } from '../tools/browser/howtopronounce';
import type { ResultEntry } from './bing-result';
import { logger } from '@/utils/logger';
import { toErrorMessage } from '@/utils/errors';

const LOG = 'HowToPronounce Src';
const HOWTO_HOME = 'https://zh.howtopronounce.com/';
const DEFAULT_MAX_TABS = 3;

/** What the howtopronounce mode contributes for one word (mergeable). */
export interface HowToPronounceContribution {
  source: 'howtopronounce';
  ok: boolean;
  audio_base64?: string;
  audio_mime?: string;
  audioUrls: string[];
  ipa?: string;
  phoneticSpelling?: string;
  wiki: string[];
  sentences: Array<{ en?: string; cn?: string }>;
  error?: string;
}

type Waiter = (tabId: number) => void;

class HowToPronouncePronunciationSource {
  private pool: number[] = []; // all owned tab ids
  private free: number[] = []; // available tab ids
  private waiters: Waiter[] = [];
  private maxTabs = DEFAULT_MAX_TABS;

  /** Match the Bing worker's parallelism (called when the worker starts). */
  setMaxTabs(n: number): void {
    this.maxTabs = Math.max(1, Math.min(6, Math.round(n) || DEFAULT_MAX_TABS));
  }

  /**
   * Look up one word. Acquires a pool tab (waiting if all are busy), drives it,
   * releases the tab. Returns a contribution (ok=false on any miss - never
   * throws). The worker calls this in parallel with the Bing lookup so both
   * modes consume the same task word simultaneously.
   */
  async lookup(word: string): Promise<HowToPronounceContribution> {
    const w = (word || '').trim();
    if (!w) return this.empty('empty word');
    let tabId: number | null = null;
    try {
      tabId = await this.acquire();
      const data: HowToPronounceResult = await howToPronounceTool.lookupInTab(tabId, w);
      // A dead/evicted tab returns a transport-style error; evict it so the
      // next acquire creates a fresh one instead of reusing a corpse.
      if (this.isDeadTabError(data?.error)) {
        this.evict(tabId);
        tabId = null; // don't release back into the pool
      }
      if (!data.hasContent) return this.empty(data.error || 'no pronunciation content');
      const best = data.audioClips && data.audioClips.length > 0 ? data.audioClips[0] : null;
      const contribution: HowToPronounceContribution = {
        source: 'howtopronounce',
        ok: true,
        audioUrls: data.audioUrls || [],
        wiki: data.wiki || [],
        sentences: data.sentences || [],
      };
      if (best && best.base64) {
        contribution.audio_base64 = best.base64;
        contribution.audio_mime = best.mime || 'audio/mpeg';
      }
      if (data.ipa) contribution.ipa = data.ipa;
      if (data.phoneticSpelling) contribution.phoneticSpelling = data.phoneticSpelling;
      logger.info(
        LOG,
        `"${w}" -> clips=${data.audioClips?.length ?? 0} ipa=${data.ipa ? 'yes' : 'no'} wiki=${data.wiki.length}`,
      );
      return contribution;
    } catch (error) {
      if (tabId !== null) this.evict(tabId); // likely dead - don't reuse
      logger.warn(LOG, `lookup failed for "${w}":`, error);
      return this.empty(toErrorMessage(error));
    } finally {
      if (tabId !== null) this.release(tabId);
    }
  }

  /**
   * Merge a howtopronounce contribution into a Bing-built ResultEntry. PURE
   * fill-missing: only fills fields the Bing result lacked, so a rich Bing
   * entry is untouched and the idempotent Laravel writeback stays safe. Returns
   * true when howtopronounce added something (for stats).
   */
  mergeInto(entry: ResultEntry, hp: HowToPronounceContribution | null): boolean {
    if (!hp || !hp.ok) return false;
    let contributed = false;

    // Audio: fill only when Bing had none. This is the primary value - words
    // Bing has no pronunciation for get a howtopronounce clip.
    if (!entry.audio_base64 && hp.audio_base64) {
      entry.audio_base64 = hp.audio_base64;
      entry.audio_mime = hp.audio_mime || 'audio/mpeg';
      entry.audio_available = true;
      contributed = true;
    }
    // Persist a howtopronounce audio URL for retry, mirroring Bing's audio_url,
    // but only when no Bing audio_url was recorded.
    if (!entry.audio_url && hp.audioUrls && hp.audioUrls.length > 0) {
      entry.audio_url = hp.audioUrls[0];
    }

    // Phonetics: fill missing accent slots from howtopronounce IPA.
    if (hp.ipa) {
      if (!entry.us_phonetic) entry.us_phonetic = hp.ipa;
      else if (!entry.uk_phonetic) entry.uk_phonetic = hp.ipa;
      else if (!entry.phonetic) entry.phonetic = hp.ipa;
      contributed = true;
    }

    // Web-document content (wiki + sentences + IPA): append a compact
    // [howtopronounce] block ONLY when the Bing translation text is thin, so a
    // rich Bing entry is never bloated. This is the "search web documents" bit.
    const thinBing = !entry.translation || entry.translation.trim().length < 24;
    if (thinBing && (hp.ipa || hp.phoneticSpelling || hp.wiki.length > 0 || hp.sentences.length > 0)) {
      const extras: string[] = [];
      if (hp.ipa) extras.push(`IPA: ${hp.ipa}`);
      if (hp.phoneticSpelling) extras.push(`Phonetic: ${hp.phoneticSpelling}`);
      if (hp.wiki.length > 0) extras.push(`Wiki: ${hp.wiki.slice(0, 3).join(' ')}`);
      if (hp.sentences.length > 0) {
        const s = hp.sentences.slice(0, 3).map((x) => x.en).filter(Boolean).join(' | ');
        if (s) extras.push(`Examples: ${s}`);
      }
      if (extras.length > 0) {
        const block = `[howtopronounce] ${extras.join(' · ')}`;
        entry.translation = entry.translation
          ? `${entry.translation.trim()}\n${block}`
          : block;
        contributed = true;
      }
    }

    if (contributed) entry.howtopronounce_audio = true;
    return contributed;
  }

  /** Close all howtopronounce tabs (called on worker stop). Best-effort. */
  async stop(): Promise<void> {
    const ids = this.pool.slice();
    this.pool = [];
    this.free = [];
    this.waiters = [];
    await Promise.all(
      ids.map((id) =>
        chrome.tabs.remove(id).catch(() => undefined),
      ),
    );
  }

  /** Discard idle tab renderers to free memory (best-effort). */
  async discardIdle(): Promise<void> {
    const ids = this.free.slice();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const tab = await chrome.tabs.get(id);
          if (tab && tab.id !== undefined && !tab.active) {
            await chrome.tabs.discard(tab.id).catch(() => undefined);
          }
        } catch {
          /* dead - will be evicted on next acquire */
        }
      }),
    );
  }

  // --- pool semaphore -------------------------------------------------------

  /** Acquire a live background tab, creating one if the pool has room. */
  private async acquire(): Promise<number> {
    // Reuse a free tab if it is still alive.
    while (this.free.length > 0) {
      const id = this.free.pop()!;
      if (await this.isAlive(id)) return id;
      this.evict(id); // dead - drop and try the next
    }
    if (this.pool.length < this.maxTabs) {
      const tab = await chrome.tabs.create({ url: HOWTO_HOME, active: false });
      if (!tab.id) throw new Error('Failed to create HowToPronounce tab');
      this.pool.push(tab.id);
      logger.info(LOG, `Opened background tab ${tab.id} (pool=${this.pool.length})`);
      return tab.id;
    }
    // Pool exhausted - wait for a release to hand one over directly.
    return new Promise<number>((resolve) => this.waiters.push(resolve));
  }

  private release(tabId: number): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter(tabId); // hand the tab directly to the next caller
    else this.free.push(tabId);
  }

  private evict(tabId: number): void {
    this.pool = this.pool.filter((id) => id !== tabId);
    this.free = this.free.filter((id) => id !== tabId);
    chrome.tabs.remove(tabId).catch(() => undefined);
  }

  private async isAlive(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch {
      return false;
    }
  }

  private isDeadTabError(error?: string | null): boolean {
    if (!error) return false;
    return /No response from HowToPronounce|Receiving end does not exist|Failed to create or access tab/i.test(
      error,
    );
  }

  private empty(error: string): HowToPronounceContribution {
    return { source: 'howtopronounce', ok: false, audioUrls: [], wiki: [], sentences: [], error };
  }
}

export const howtopronouncePronunciationSource = new HowToPronouncePronunciationSource();
