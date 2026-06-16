/**
 * Bing dictionary tab pool.
 *
 * Owns the set of background bing.com/dict tabs the translation worker drives in
 * parallel and keeps them tidy inside a single collapsed "Bing Assist" tab
 * group. Centralizing every chrome.tabs lifecycle call here keeps
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

// Subsystem tag for the global logger.
const LOG = 'Bing TabPool';

// Title of the tab group the pool tabs are collected under so a multi-tab pool
// does not clutter the tab strip (chrome.tabs.group + chrome.tabGroups.update).
const TAB_GROUP_TITLE = 'Bing Assist';
const BING_DICT_URL = 'https://www.bing.com/dict';

export class BingTabPool {
  private tabIds: number[] = [];
  private groupId: number | null = null;

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
    await this.group(surface);
    return this.ids;
  }

  /**
   * Replace a dead tab id with a freshly created background tab and return the
   * new id. Safe to call concurrently from multiple worker slots: each dead slot
   * gets its own replacement.
   */
  async replace(deadId: number): Promise<number> {
    const created = await chrome.tabs.create({ url: BING_DICT_URL, active: false });
    if (!created.id) throw new Error('Failed to create replacement Bing tab');
    const idx = this.tabIds.indexOf(deadId);
    if (idx >= 0) this.tabIds[idx] = created.id;
    else this.tabIds.push(created.id);
    await this.group(false);
    return created.id;
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
   * Collect the pool tabs into a single collapsed, labelled tab group.
   * chrome.tabs.group() needs only "tabs"; chrome.tabGroups.update()
   * (title/color/collapsed) needs "tabGroups". Best-effort: grouping can fail if
   * the API is unavailable or tabs span windows, which must never break crawling.
   */
  private async group(surface: boolean): Promise<void> {
    if (this.tabIds.length === 0) return;
    if (!chrome.tabs.group || !chrome.tabGroups) return;

    try {
      const options: chrome.tabs.GroupOptions = { tabIds: this.tabIds as [number, ...number[]] };
      if (this.groupId !== null) options.groupId = this.groupId;
      this.groupId = await chrome.tabs.group(options);

      await chrome.tabGroups.update(this.groupId, {
        title: TAB_GROUP_TITLE,
        color: 'cyan',
        // Collapse when running in the background; expand only when the user
        // explicitly started the worker so they can see Bing.
        collapsed: !surface,
      });

      if (surface && this.tabIds[0] !== undefined) {
        chrome.tabs.update(this.tabIds[0], { active: true }).catch(() => undefined);
      }
    } catch (error) {
      logger.warn(LOG, 'Grouping skipped', error);
      this.groupId = null;
    }
  }
}
