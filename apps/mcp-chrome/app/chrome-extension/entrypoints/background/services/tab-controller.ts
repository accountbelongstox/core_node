/**
 * TabController — shared background tab-activation + human-interference + tab
 * self-recovery coordinator.
 *
 * Three responsibilities, used by every page-driving worker (Bing dictionary,
 * the DeepSeek / ChatGPT / Gemini web tools):
 *
 *  1. activate(tabId): bring a tab to the foreground (chrome.tabs.update active +
 *     window focus) so the page is NOT a throttled background tab while we type
 *     into it — full human simulation. EVERY programmatic activation is recorded
 *     first so it is never mistaken for the user (see below).
 *
 *  2. Human-interference pause: chrome fires tabs.onActivated for BOTH our own
 *     activations and the USER manually switching tabs — there is no isTrusted on
 *     tab events. We record our own activations (by tabId, short TTL) and treat
 *     any UNrecorded onActivated as a user switch. If the user switches tabs
 *     frequently (>= THRESHOLD within WINDOW), a human is clearly using the
 *     browser, so we PAUSE for PAUSE_MS and auto-resume — yielding the browser
 *     back. The pause is a transient clock (pausedUntil); it never stops a worker
 *     or touches run-intent, so the manual-re-enable invariant is preserved.
 *
 *  3. Self-recovery: when a MANAGED (plugin-owned) tab is closed, invoke the
 *     registered heal handler (the Bing pool's close-first/bounded replace).
 *     User-opened tabs (onCreated) and non-managed closes are ignored — the
 *     plugin's tabs simply coexist with the user's tabs; we only track their ids.
 *
 * This module is a LEAF (imports only chrome + logger) so workers/pool can import
 * it without a cycle; it calls back into them via the registered heal handler.
 */

import { logger } from '@/utils/logger';

const LOG = 'TabController';

// How long a recorded self-activation stays valid. Kept short so a genuine user
// switch to the same tab later is not absorbed; long enough to cover the
// tabs.update + windows.update pair's onActivated event(s) within one SW wakeup.
const SELF_ACTIVATION_TTL_MS = 1500;
// Sliding window + threshold for "a human is actively switching tabs".
const INTERFERENCE_WINDOW_MS = 10_000;
const INTERFERENCE_THRESHOLD = 3;
// How long to yield the browser to the user once interference is detected.
const INTERFERENCE_PAUSE_MS = 60_000;

class TabController {
  private registered = false;
  // tabId -> last self-activation timestamp (tabId-primary so a window mismatch
  // between our record and onActivated.windowId can never leak a self-activation
  // into the user-switch window).
  private pendingSelfActivations = new Map<number, number>();
  private userSwitchTimes: number[] = [];
  private pausedUntil = 0;
  // Plugin-owned tab ids (e.g. the Bing pool) — only these are auto-healed.
  private managedTabs = new Set<number>();
  private healHandler: ((closedTabId: number) => void) | null = null;

  /** Register the chrome.tabs listeners once (call at SW init). */
  init(): void {
    if (this.registered) return;
    this.registered = true;
    try {
      chrome.tabs.onActivated.addListener((info) => this.onActivated(info));
      chrome.tabs.onRemoved.addListener((tabId, removeInfo) => this.onRemoved(tabId, removeInfo));
      // onCreated is intentionally a no-op: user-opened tabs are never adopted.
      logger.info(LOG, 'Initialized (activation + interference + self-recovery)');
    } catch (error) {
      logger.warn(LOG, 'Failed to register tab listeners', error);
    }
  }

  /** Record a programmatic activation we are about to perform / just performed. */
  private recordSelfActivation(tabId: number): void {
    this.pendingSelfActivations.set(tabId, Date.now());
  }

  /**
   * Record an activation performed by the CALLER (e.g. chrome.tabs.create with
   * active:true, where the id only exists after the call) so the resulting
   * onActivated is recognized as ours and not mis-counted as a user switch.
   */
  recordActivation(tabId: number): void {
    if (typeof tabId === 'number') this.recordSelfActivation(tabId);
  }

  /**
   * Bring a tab to the foreground like a human would. Records the self-activation
   * BEFORE the chrome call (so the resulting onActivated is recognized as ours),
   * and re-records around the window-focus call (which can emit a second
   * onActivated for the same tab). Best-effort: a dead tab never throws out.
   */
  async activate(tabId: number, opts?: { focusWindow?: boolean }): Promise<void> {
    if (typeof tabId !== 'number') return;
    this.recordSelfActivation(tabId);
    try {
      await chrome.tabs.update(tabId, { active: true });
    } catch {
      // tab gone — caller's healing handles it.
      return;
    }
    if (opts?.focusWindow !== false) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab && typeof tab.windowId === 'number') {
          // Refresh the record so the window-focus onActivated is also absorbed.
          this.recordSelfActivation(tabId);
          await chrome.windows.update(tab.windowId, { focused: true });
        }
      } catch {
        // window focus is best-effort
      }
    }
    // CONFIRM the tab is actually active before returning, so the caller never
    // types into a not-yet-foreground tab. Bounded poll (~5x80ms = 400ms, well
    // under SELF_ACTIVATION_TTL_MS so re-issues stay recognized as ours). Gate
    // only on tab.active — window.focused can be denied by the OS, so it is
    // best-effort and never blocks. A vanished tab exits silently (caller heals).
    for (let i = 0; i < 5; i++) {
      let active = false;
      try {
        const t = await chrome.tabs.get(tabId);
        active = !!t && t.active === true;
      } catch {
        return; // tab gone
      }
      if (active) return;
      this.recordSelfActivation(tabId);
      try {
        await chrome.tabs.update(tabId, { active: true });
      } catch {
        return;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  /**
   * Open a worker tab in the BACKGROUND (active:false) so the user's focus is
   * never stolen. No self-activation is recorded because we did not foreground
   * anything. Result capture (executeScript / sendMessage) works on background
   * tabs, so page-driving workers should prefer this over an active create.
   */
  async openBackgroundTab(url: string): Promise<chrome.tabs.Tab> {
    return chrome.tabs.create({ url, active: false });
  }

  /**
   * Snapshot the user's currently-focused tab so a path that MUST foreground can
   * restore it afterwards. Best-effort; returns null if none resolvable.
   */
  async captureActiveTab(): Promise<{ tabId: number; windowId: number } | null> {
    try {
      const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (t && typeof t.id === 'number' && typeof t.windowId === 'number') {
        return { tabId: t.id, windowId: t.windowId };
      }
    } catch {
      // best-effort
    }
    return null;
  }

  /**
   * Re-activate a tab captured by captureActiveTab (only if it still exists).
   * Best-effort; swallows errors. Uses activate() so the self-switch is recorded.
   */
  async restoreActiveTab(captured: { tabId: number; windowId: number } | null): Promise<void> {
    if (!captured) return;
    try {
      await chrome.tabs.get(captured.tabId);
    } catch {
      return; // captured tab is gone
    }
    await this.activate(captured.tabId);
  }

  /** The unified pause gate (human-interference; anti-scrape lives on the worker). */
  isPaused(): boolean {
    return Date.now() < this.pausedUntil;
  }

  pauseFor(ms: number, reason: string): void {
    const until = Date.now() + ms;
    if (until > this.pausedUntil) {
      this.pausedUntil = until;
      logger.warn(LOG, `Paused ${Math.round(ms / 1000)}s (${reason}); auto-resume after`);
    }
  }

  // --- managed-tab registry (self-recovery scope) ---------------------------
  registerManagedTabs(ids: number[]): void {
    this.managedTabs = new Set(ids.filter((id) => typeof id === 'number'));
  }
  unregisterManagedTab(id: number): void {
    this.managedTabs.delete(id);
  }
  clearManagedTabs(): void {
    this.managedTabs.clear();
  }
  setHealHandler(fn: (closedTabId: number) => void): void {
    this.healHandler = fn;
  }

  // --- listeners ------------------------------------------------------------
  private onActivated(info: chrome.tabs.TabActiveInfo): void {
    const now = Date.now();
    // Prune expired self-activation records first.
    for (const [tid, ts] of this.pendingSelfActivations) {
      if (now - ts > SELF_ACTIVATION_TTL_MS) this.pendingSelfActivations.delete(tid);
    }
    // tabId-primary match: our own activation (kept until TTL so the paired
    // window-focus onActivated for the same tab is also absorbed) -> ignore.
    const ts = this.pendingSelfActivations.get(info.tabId);
    if (ts !== undefined && now - ts <= SELF_ACTIVATION_TTL_MS) {
      return;
    }
    // Unrecorded activation = the user switched tabs.
    this.userSwitchTimes.push(now);
    this.userSwitchTimes = this.userSwitchTimes.filter((t) => now - t <= INTERFERENCE_WINDOW_MS);
    if (this.userSwitchTimes.length >= INTERFERENCE_THRESHOLD) {
      this.pauseFor(INTERFERENCE_PAUSE_MS, 'human tab activity');
      this.userSwitchTimes = [];
    }
  }

  private onRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): void {
    this.pendingSelfActivations.delete(tabId);
    if (!this.managedTabs.has(tabId)) return;
    this.managedTabs.delete(tabId);
    // A whole window closing is not a per-tab failure — don't churn replacements.
    if (removeInfo && removeInfo.isWindowClosing) return;
    if (this.healHandler) {
      try {
        this.healHandler(tabId);
      } catch (error) {
        logger.warn(LOG, 'Heal handler threw', error);
      }
    }
  }
}

export const tabController = new TabController();

/** Register the tab listeners at SW init (idempotent). */
export function initTabController(): void {
  tabController.init();
}
