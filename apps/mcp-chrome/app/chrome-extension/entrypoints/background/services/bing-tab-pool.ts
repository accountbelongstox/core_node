/**
 * Bing dictionary tab pool.
 *
 * Owns the set of bing.com/dict tabs the translation worker drives in parallel.
 * The tabs are NOT collected into a tab group — they coexist with the user's
 * normal tabs; the pool only TRACKS their ids (tabIds) for self-recovery.
 * Centralizing every chrome.tabs lifecycle call here keeps
 * BingDictionaryWorkerService focused on task orchestration (and lets the ad-hoc
 * scrape test reuse the exact same pool behaviour).
 *
 * SELF-HEALING: pool tabs can be closed by the user or silently discarded by
 * Chrome's memory saver mid-crawl, which invalidates their id and makes every
 * subsequent lookup on that slot fail with "No tab with id: N". `replace()`
 * swaps a dead id for a fresh background tab so a long crawl never stalls on a
 * vanished tab.
 */

import { logger } from '@/utils/logger';

/** Hard ceiling on parallel Bing tabs (also enforced by the config sanitizer). */
export const MAX_BING_TABS = 8;

/**
 * A tab error that is RECOVERABLE by replacing the tab + retrying: the tab
 * vanished ("No tab with id"), the injected content script's channel is gone
 * (navigation/reload), OR the tab is on an unscriptable Chrome net-error /
 * anti-scrape page ("cannot access" / "showing error page" / chrome-error /
 * ERR_*). One shared predicate — used by the pool's health probe AND the worker's
 * lookup healing, so the two can never diverge.
 */
export function isRecoverableTabError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /No tab with id|Failed to inject content script|No frame with id|Frame with id|Could not establish connection|Receiving end does not exist|message channel closed|message port closed|cannot access|showing error page|chrome-error|ERR_[A-Z_]+/i.test(
    msg,
  );
}

// Subsystem tag for the global logger.
const LOG = 'Bing TabPool';

// The SINGLE shared dictionary URL (exported; bing-dictionary.ts imports it so
// the two can never drift). NO URL parameters: the worker DRIVES the page (types
// the word into the search box + clicks search) instead of query-by-URL, per the
// "operate the page, not URL params" rule. The market is left to the page's
// geo/session cookie — a region redirect (if any) is handled by the worker's
// non-dict retry + outage guard. Was '?mkt=zh-CN'; dropped to honor no-URL-param.
export const BING_DICT_URL = 'https://www.bing.com/dict';

export class BingTabPool {
  private tabIds: number[] = [];
  // Configured ceiling (set by ensure/resize). replace()/heal must never grow the
  // live tab count beyond this — the fix for "spawns a heap of invalid tabs".
  private targetSize = 1;
  // Serializes replace() so concurrent slots hitting anti-scrape at once don't
  // each open a tab (a pile). One replacement happens at a time; the rest reuse.
  private replaceChain: Promise<unknown> = Promise.resolve();

  /** Snapshot of the current live tab ids. */
  get ids(): number[] {
    return [...this.tabIds];
  }

  get size(): number {
    return this.tabIds.length;
  }

  /**
   * Ensure `want` live Bing dictionary tabs exist: reuse tracked tabs that are
   * still alive, then adopt any other open bing.com/dict tab, then create the
   * remainder as BACKGROUND tabs (never stealing focus). The pool is then
   * collected into a collapsed "Bing Assist" group.
   *
   * @param surface when true (an explicit user Start) reveal + focus the group;
   *   otherwise keep it collapsed in the background.
   */
  async ensure(want: number, surface = false): Promise<number[]> {
    const target = Math.max(1, Math.min(MAX_BING_TABS, Math.round(want) || 1));
    this.targetSize = target;
    const alive: number[] = [];

    // Keep tracked tabs that still exist.
    for (const id of this.tabIds) {
      if (await this.exists(id)) alive.push(id);
    }

    // Adopt other open Bing dictionary tabs before creating new ones.
    if (alive.length < target) {
      const all = await chrome.tabs.query({});
      for (const t of all) {
        if (alive.length >= target) break;
        if (t.id && t.url && t.url.includes('bing.com/dict') && !alive.includes(t.id)) {
          alive.push(t.id);
        }
      }
    }

    // Create the remainder as background tabs — never yank the user away.
    while (alive.length < target) {
      const created = await chrome.tabs.create({ url: BING_DICT_URL, active: false });
      if (created.id) alive.push(created.id);
      else break;
    }

    this.tabIds = alive.slice(0, target);
    await this.surfaceFirstTab(surface);
    return this.ids;
  }

  /**
   * Resize the pool to `target` live tabs (real-time settings). Growing reuses
   * ensure(); shrinking CLOSES the surplus tabs — but only the pool's OWN tracked
   * tabs (which are the "Bing Assist" group), never the user's other windows or
   * any non-pool tab. Returns the new id list.
   */
  async resize(target: number, surface = false): Promise<number[]> {
    const t = Math.max(1, Math.min(MAX_BING_TABS, Math.round(target) || 1));
    this.targetSize = t;
    if (this.tabIds.length <= t) {
      return this.ensure(t, surface);
    }
    // Shrink: drop + close the surplus tracked tabs (pool/group tabs only).
    const surplus = this.tabIds.slice(t);
    this.tabIds = this.tabIds.slice(0, t);
    for (const id of surplus) {
      try {
        await chrome.tabs.remove(id);
      } catch {
        // Already gone — nothing to close.
      }
    }
    logger.info(LOG, `Pool shrunk to ${this.tabIds.length} (closed ${surplus.length})`);
    await this.surfaceFirstTab(surface);
    return this.ids;
  }

  /**
   * Replace a dead / anti-scrape-error tab. Hard rules (the fix for "spawns a
   * heap of invalid tabs"):
   *   1. CLOSE the bad tab FIRST — error tabs must never pile up.
   *   2. NEVER grow past targetSize — if the pool already has enough live tabs
   *      (e.g. another slot already healed), REUSE an existing one instead of
   *      opening another.
   *   3. Open AT MOST ONE replacement and WAIT for it to finish loading before
   *      returning it — a still-loading page may resolve to a valid page, so we
   *      don't judge/replace it again while it is mid-load.
   *   4. Serialized: concurrent slots can't each open a tab at the same instant.
   */
  async replace(deadId: number): Promise<number> {
    const run = this.replaceChain.then(
      () => this.replaceOne(deadId),
      () => this.replaceOne(deadId),
    );
    // Keep the chain alive regardless of this call's outcome.
    this.replaceChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async replaceOne(deadId: number): Promise<number> {
    // 1. Close the bad tab first and drop it from tracking.
    try {
      await chrome.tabs.remove(deadId);
    } catch {
      // already gone
    }
    const idx = this.tabIds.indexOf(deadId);
    if (idx >= 0) this.tabIds.splice(idx, 1);

    // 2. Re-sync to only live tabs; if we're already at/over the ceiling (another
    //    slot healed, or the pool is full), REUSE a live tab — do NOT open more.
    this.tabIds = await this.aliveIds();
    if (this.tabIds.length >= this.targetSize && this.tabIds.length > 0) {
      return this.tabIds[0];
    }

    // 3. Open exactly ONE replacement and wait for it to settle before use.
    const created = await chrome.tabs.create({ url: BING_DICT_URL, active: false });
    if (!created.id) {
      if (this.tabIds.length > 0) return this.tabIds[0];
      throw new Error('Failed to create replacement Bing tab');
    }
    this.tabIds.push(created.id);
    await this.waitForComplete(created.id, 15000);
    return created.id;
  }

  /** The subset of tracked ids whose tabs still exist, in order. */
  private async aliveIds(): Promise<number[]> {
    const out: number[] = [];
    for (const id of this.tabIds) {
      if (await this.exists(id)) out.push(id);
    }
    return out;
  }

  /**
   * Resolve once the tab reports status 'complete' (or after a hard timeout).
   * Used so a freshly opened replacement is given time to finish loading before
   * the worker drives it — a still-loading page must not be treated as broken.
   */
  private waitForComplete(tabId: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          chrome.tabs.onUpdated.removeListener(onUpdated);
        } catch {
          // listener already gone
        }
        clearTimeout(timer);
        resolve();
      };
      const onUpdated = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (id === tabId && info.status === 'complete') finish();
      };
      const timer = setTimeout(finish, timeoutMs);
      chrome.tabs.onUpdated.addListener(onUpdated);
      // Maybe it's already complete.
      chrome.tabs.get(tabId).then(
        (tab) => {
          if (tab.status === 'complete') finish();
        },
        () => finish(),
      );
    });
  }

  /**
   * Discard (unload) the pool tabs to free their bing.com renderer memory while
   * the worker is idle — the key "keep Chrome responsive" optimization. The tab
   * AND its id are kept (discard only unloads the renderer); the next lookup
   * navigates the tab via tabs.update(url) and Chrome reloads it on demand. If a
   * Chrome build reassigns the id on discard, the returned id is tracked so the
   * pool (and the existing replace() healing) stays consistent. Best-effort: an
   * active/undiscardable tab is skipped. Returns the number discarded.
   */
  async discardIdle(): Promise<number> {
    let discarded = 0;
    for (let i = 0; i < this.tabIds.length; i++) {
      const id = this.tabIds[i];
      try {
        const tab = await chrome.tabs.discard(id);
        if (tab && typeof tab.id === 'number') {
          this.tabIds[i] = tab.id;
        }
        discarded++;
      } catch {
        // Active or otherwise non-discardable tab — leave it loaded.
      }
    }
    if (discarded > 0) {
      logger.info(LOG, `Discarded ${discarded} idle Bing tab(s) to free renderer memory`);
    }
    return discarded;
  }

  /**
   * Proactively clean Bing's anti-scrape / unreachable tabs (real complaint:
   * after a long run Bing serves "Hmmm… can't reach this page" /
   * ERR_CONNECTION_CLOSED on some tabs). For each TRACKED pool tab (so the user's
   * other windows and any non-pool tab are NEVER touched) we probe its health and
   * 1-for-1 close+reopen any that are showing a Chrome error page. The live tab
   * count never exceeds `target` (surplus is closed, not replaced). A 'gone' tab
   * is simply dropped — the worker's ensure()/replace() recreates it on demand.
   * Returns the number healed.
   */
  async healUnreachable(target: number): Promise<number> {
    const t = Math.max(1, Math.min(MAX_BING_TABS, Math.round(target) || 1));
    const next: number[] = [];
    let healed = 0;
    for (const id of this.tabIds) {
      if (next.length >= t) {
        // Already at the ceiling — close the surplus rather than keep/replace it.
        try {
          await chrome.tabs.remove(id);
        } catch {
          // already gone
        }
        continue;
      }
      const state = await this.probe(id);
      if (state === 'ok') {
        next.push(id);
        continue;
      }
      if (state === 'gone') {
        healed++; // dropped from tracking; ensure() recreates it when needed
        continue;
      }
      // 'error' — an unreachable / anti-scrape page. Close it and open ONE fresh
      // background replacement so the slot keeps working.
      try {
        await chrome.tabs.remove(id);
      } catch {
        // already gone
      }
      try {
        const created = await chrome.tabs.create({ url: BING_DICT_URL, active: false });
        if (created.id) next.push(created.id);
      } catch {
        // creation failed — leave the slot for ensure() to fill later
      }
      healed++;
    }
    this.tabIds = next;
    if (healed > 0) {
      logger.info(LOG, `Healed ${healed} unreachable Bing tab(s)`);
    }
    return healed;
  }

  /**
   * Transport-level reachability of one tab id (no navigation/replace of its
   * own). 'ok' from probe() = the tab is scriptable and not on a chrome net-error
   * page. Used by the outage probe AFTER the caller has produced a fresh tab.
   */
  async probeReachable(id: number): Promise<boolean> {
    return (await this.probe(id)) === 'ok';
  }

  /**
   * Classify one tab's health: 'gone' (no longer exists), 'error' (showing a
   * Chrome net-error / anti-scrape page), or 'ok'. A discarded (unloaded) tab is
   * 'ok' — it reloads on demand. Detection: a chrome-error:// URL is a definitive
   * error; otherwise a tiny in-page probe checks for the net-error DOM (a failed
   * main-frame load keeps the requested URL but renders chrome's error document,
   * and an unscriptable error page makes executeScript itself throw).
   */
  private async probe(id: number): Promise<'ok' | 'error' | 'gone'> {
    let tab: chrome.tabs.Tab;
    try {
      tab = await chrome.tabs.get(id);
    } catch {
      return 'gone';
    }
    if (!tab) return 'gone';
    if ((tab.url || '').startsWith('chrome-error://')) return 'error';
    // Unloaded tab — fine; the next lookup navigates + reloads it.
    if (tab.discarded) return 'ok';
    try {
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: id },
        func: () => {
          const title = document.title || '';
          const isError =
            location.href.startsWith('chrome-error://') ||
            !!document.querySelector('#main-frame-error, .neterror, .error-code') ||
            /can[’']?t be reached|can[’']?t reach this page|ERR_|无法访问此?网站|无法访问此页面/i.test(
              title,
            );
          return isError;
        },
      });
      return res && res.result === true ? 'error' : 'ok';
    } catch (error) {
      // executeScript throws on a non-scriptable chrome-error page / detached
      // frame — treat as an error tab; any other scripting hiccup is left as 'ok'
      // so a momentary glitch never closes a healthy tab.
      const m = error instanceof Error ? error.message : String(error);
      if (/chrome-error|cannot access|showing error page|No tab with id|No frame/i.test(m)) {
        return 'error';
      }
      return 'ok';
    }
  }

  private async exists(id: number): Promise<boolean> {
    try {
      await chrome.tabs.get(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * On an explicit user Start (surface=true) reveal Bing by activating the first
   * pool tab — WITHOUT grouping. The pool tabs are deliberately NOT collected into
   * a tab group; they coexist with the user's normal tabs (we only track ids).
   * Silent paths (surface=false) do nothing — never steal focus in the background.
   */
  private async surfaceFirstTab(surface: boolean): Promise<void> {
    if (!surface || this.tabIds[0] === undefined) return;
    try {
      await chrome.tabs.update(this.tabIds[0], { active: true });
    } catch {
      // first tab gone — harmless; the next lookup heals.
    }
  }
}
