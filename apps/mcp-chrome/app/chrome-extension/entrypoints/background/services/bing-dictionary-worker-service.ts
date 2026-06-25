/**
 * Bing Dictionary Worker Service
 *
 * Acts as a laravel_main translation worker: registers under processor type
 * `remote_translation`, long-polls the word_translation queue
 * (/api/worker/tasks/*), and for every word scrapes Bing dictionary for the
 * translation, phonetics, sample images and pronunciation audio. Words are
 * processed in parallel across a configurable pool of Bing tabs; the audio mp3
 * is downloaded and shipped as base64. Words Bing has no entry for are reported
 * in `invalid_words` so the backend flags them is_valid=false and never
 * re-queues them.
 */

import { WorkerApiClient, Task, ProcessorType } from '../api/WorkerApiClient';
import { bingDictionaryTool, BingDictionaryResult } from '../tools/browser/bing-dictionary';
import { logger } from '@/utils/logger';
import { BingTabPool, MAX_BING_TABS, isRecoverableTabError } from './bing-tab-pool';
import { CHROME_FAST_CAPABILITIES } from './task-center/SimpleWorkerBase';
import { tabController } from './tab-controller';
import {
  classify,
  buildEntry,
  normalizeWords,
  type NormalizedWord,
  type ResultEntry,
} from './bing-result';
import { runScrapeTest, type ScrapeTestResult } from './bing-worker-ops';

// Subsystem tag for the global logger.
const LOG = 'Bing Worker';

export interface WorkerConfig {
  apiUrl: string;
  workerName?: string;
  pollInterval?: number;
  heartbeatInterval?: number;
  batchSize?: number;
  /** Number of Bing dictionary tabs to drive in parallel. */
  tabCount?: number;
  /** Source language of the pending words (drives pending query + enqueue). */
  sourceLanguage?: string;
  /** Default target language when a task payload omits one. */
  targetLanguage?: string;
}

export interface WorkerStats {
  pending: number;
  translated: number;
  failed: number;
  invalid: number;
  lastRun: number | null;
  workerId: string | null;
  isOnline: boolean;
  queueTotal: number;
  newTasks: number;
  duplicateTasks: number;
  activeTabs: number;
  // Live activity surfaced in the popup so the user can see work happening.
  currentWord: string | null;
  currentTaskId: string | null;
  // Per-tab live activity: the word each parallel Bing tab is looking up right
  // now (one entry per pool slot), so the popup shows "Tab 1 · Translating: x"
  // for every tab instead of a single overall word.
  tabActivity: Array<{ tabId: number; word: string | null }>;
}

// How many times to re-attempt a word that lands on a non-dict (region/redirect)
// page before treating it as a persistent region-redirect failure. The helper
// already reloads the dict home once per attempt, so this is attempts-of-attempts.
const NONDICT_ATTEMPTS = 3;

// Anti-scrape backoff: when Bing starts serving net-error / "can't reach this
// page" responses (dead-tab errors that survive one heal), opening more tabs only
// makes it worse. After this many consecutive blocked words we ABORT the batch
// and enter a cooldown so Bing's rate-limit relaxes — instead of churning a heap
// of dead tabs. Tuned conservative: a few transient misses won't trip it.
const ANTISCRAPE_ABORT_THRESHOLD = 6;
const ANTISCRAPE_COOLDOWN_MS = 60_000;

// Bing SOFT OUTAGE ("It's not you, it's us" / "Bing isn't available right now")
// or a whole batch dying: a GLOBAL transient, distinct from anti-scrape. Pause ALL
// work for 30s, then probe ONE fresh tab until Bing is reachable again; NEVER
// invalidate words. A bounded probe cap stops an indefinite stall if Bing serves
// something the probe can't clear.
const OUTAGE_PAUSE_MS = 30_000;
const OUTAGE_MAX_PROBES = 10;

// Human-paced jitter between consecutive word lookups so the worker NEVER hits
// Bing at a fixed cadence (the user's "必须有一个随机时间，不要一直不停的按时间刷新").
// 1.5s–4.0s, mirroring scheduleFastRepoll's BASE + random*JITTER idiom. This
// spaces individual lookups; the batch-level ANTISCRAPE_COOLDOWN_MS handles
// sustained blocks.
const LOOKUP_DELAY_BASE_MS = 1500;
const LOOKUP_DELAY_JITTER_MS = 2500;

// MV3 service workers are terminated after ~30s idle and lose all globals +
// setInterval timers (https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
// We persist the "assisting" intent and reuse a chrome.alarms watchdog to
// resurrect the worker after the SW is terminated MID-SESSION.
//
// IMPORTANT: the intent lives in chrome.storage.SESSION, not .local. Session
// storage survives SW termination but is wiped when the browser fully closes,
// so a browser restart never auto-reopens Bing tabs / re-starts crawling. This
// is the fix for "Bing dict tabs keep opening when I'm not doing anything":
// crawling is strictly user-initiated each browser session, and silent
// recovery (focus=false) never steals focus.
const RUNTIME_STORAGE_KEY = 'bing_worker_runtime';
const WATCHDOG_ALARM = 'bing-translation-worker-watchdog';
// 1 min: above the 30s production floor, frequent enough to recover quickly.
const WATCHDOG_PERIOD_MINUTES = 1;

// Fast re-poll cadence (B3): when a pull reports pending_fast>0 we fire an
// immediate jittered+coalesced wait=0 re-poll instead of waiting for the next
// poll-interval tick, so fast-tier translate work is drained promptly. Mirrors
// SimpleWorkerBase's FAST_REPOLL_* constants.
const FAST_REPOLL_BASE_MS = 400;
const FAST_REPOLL_JITTER_MS = 300;

// Free the Bing renderer memory when the worker has had no task for this long:
// the pool tabs are discarded (unloaded, ids kept) so idle assisting doesn't keep
// several bing.com renderers resident and lagging Chrome. Re-loaded on demand by
// the next lookup's navigation.
const IDLE_DISCARD_MS = 60_000;

interface PersistedRuntime {
  running: boolean;
  config: WorkerConfig | null;
}

class BingDictionaryWorkerService {
  private isRunning = false;
  private config: Required<WorkerConfig> | null = null;
  private workerClient: WorkerApiClient | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  // Coalesce fast re-polls (B3): at most one scheduled burst in flight.
  private fastRepollTimer: ReturnType<typeof setTimeout> | null = null;

  // Pool of background Bing dictionary tabs driven in parallel (self-healing).
  private pool = new BingTabPool();

  // Idle-tab-discard bookkeeping (keeps Chrome responsive): last task activity
  // timestamp, a guard so a still-running task is never discarded mid-lookup,
  // and a once-per-idle-window flag.
  private lastActivityAt = 0;
  private processing = false;
  private poolDiscarded = false;
  // Epoch ms until which polling is paused after sustained Bing anti-scrape.
  private cooldownUntil = 0;
  // Bing soft-outage state: inOutage gates the poll loop into probe-mode;
  // outageUntil spaces probes 30s apart; outageProbeFails bounds the retries;
  // probing guards against a re-entrant probe from an overlapping poll tick.
  private outageUntil = 0;
  private inOutage = false;
  private outageProbeFails = 0;
  private probing = false;
  // Serializes per-word tab activation so concurrent slots don't fight over the
  // single active tab (the tab being typed into is the one foregrounded).
  private activateChain: Promise<unknown> = Promise.resolve();
  // Whether the heal handler has been wired to the shared TabController.
  private healHandlerWired = false;

  // Task cache to prevent duplicate processing.
  private taskCache = new Set<string>();
  private taskQueue: Task[] = [];

  private stats: WorkerStats = {
    pending: 0,
    translated: 0,
    failed: 0,
    invalid: 0,
    lastRun: null,
    workerId: null,
    isOnline: false,
    queueTotal: 0,
    newTasks: 0,
    duplicateTasks: 0,
    activeTabs: 0,
    currentWord: null,
    currentTaskId: null,
    tabActivity: [],
  };

  /**
   * @param surface when true (an explicit user Start) open + reveal the Bing
   *   tab pool up front. When false (silent recovery after SW termination) do
   *   NOT eagerly open or focus tabs — they are created lazily, in the
   *   background, only when a task actually needs them.
   */
  async start(config: WorkerConfig, surface = true): Promise<void> {
    if (this.isRunning) {
      logger.warn(LOG, 'Service already running');
      return;
    }
    if (!config.apiUrl) {
      throw new Error('API URL is required');
    }

    this.config = this.normalizeConfig(config);

    logger.info(LOG, 'Starting service', this.config);

    this.workerClient = new WorkerApiClient(this.config.apiUrl);

    await this.registerWorker();

    // On an explicit user Start, turn the dictionary-pending words into actual
    // word_translation tasks so this worker has something to pull. Silent
    // recovery (surface=false) skips this — it only resumes in-flight work.
    if (surface) {
      await this.enqueuePending();
    }

    // Open/reuse the Bing dictionary tab pool up front ONLY on an explicit user
    // Start (surface=true) — the one place we reveal Bing to the user. On silent
    // recovery (surface=false) tabs are created lazily by processTask, in the
    // background, never stealing focus.
    // Wire the shared TabController: heal a plugin tab the user closes, and let
    // it know which tabs we own (so only ours are auto-healed, never the user's).
    this.wireTabController();

    if (surface) {
      await this.pool.ensure(this.config.tabCount, true);
      this.stats.activeTabs = this.pool.size;
      this.syncManagedTabs();
    }

    this.startHeartbeat();
    this.startPolling();

    this.isRunning = true;
    // Begin the idle-discard countdown from Start so unused pool tabs are freed.
    this.lastActivityAt = Date.now();
    this.poolDiscarded = false;
    // Defensive: never start wedged in a stale outage / cooldown.
    this.inOutage = false;
    this.outageUntil = 0;
    this.outageProbeFails = 0;

    // Persist intent + arm the watchdog so the worker survives SW termination
    // and browser restarts.
    await this.persistRuntime(true);
    await this.ensureWatchdog();

    logger.info(LOG, 'Service started successfully');
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn(LOG, 'Service not running');
      return;
    }

    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    if (this.fastRepollTimer) {
      clearTimeout(this.fastRepollTimer);
      this.fastRepollTimer = null;
    }

    this.taskCache.clear();
    this.taskQueue = [];
    // Clear outage state so a later Start never resumes wedged in a stale outage.
    this.inOutage = false;
    this.outageUntil = 0;
    this.outageProbeFails = 0;

    // Tabs are intentionally left open so the user keeps their Bing context.
    this.isRunning = false;
    this.stats.isOnline = false;
    this.stats.queueTotal = 0;
    this.stats.newTasks = 0;
    this.stats.duplicateTasks = 0;
    this.stats.currentWord = null;
    this.stats.currentTaskId = null;
    this.stats.tabActivity = [];

    // Clear persisted intent + disarm the watchdog so a later SW revival does
    // not auto-restart a service the user explicitly stopped.
    this.persistRuntime(false).catch(() => undefined);
    this.clearWatchdog().catch(() => undefined);
    // Stop owning any tabs for self-recovery (they're left open for the user).
    tabController.clearManagedTabs();

    logger.info(LOG, 'Service stopped');
  }

  /** Report the current pool tab ids to the shared TabController (self-recovery). */
  private syncManagedTabs(): void {
    tabController.registerManagedTabs(this.pool.ids);
  }

  /**
   * Register (once) the heal handler the TabController invokes when the USER
   * closes a plugin pool tab while no lookup is touching it. Reuses the pool's
   * close-first/bounded replace (never opens a heap), then re-syncs the managed
   * set to the fresh id. No-op while stopped (a closed tab is simply forgotten).
   */
  private wireTabController(): void {
    if (this.healHandlerWired) return;
    this.healHandlerWired = true;
    tabController.setHealHandler((closedId) => {
      if (!this.isRunning) return;
      this.pool
        .replace(closedId)
        .then(() => {
          this.stats.activeTabs = this.pool.size;
          this.syncManagedTabs();
        })
        .catch(() => undefined);
    });
  }

  /** The unified pause gate: anti-scrape cooldown OR shared human-interference. */
  private isWorkerPaused(): boolean {
    return Date.now() < this.cooldownUntil || tabController.isPaused();
  }

  /**
   * Single-tab Bing reachability probe for soft-outage recovery. Collapses the
   * pool to ONE tab, opens a BRAND-NEW bing.com/dict tab (pool.replace is
   * close-first — never a reload of the original tab/URL, and BING_DICT_URL is
   * parameter-free), and reports reachable = transport ok AND the page is NOT the
   * outage page. A benign region redirect (non-outage, non-dict) counts as
   * reachable so outage mode EXITS (the normal non-dict retry handles it) instead
   * of livelocking. Best-effort: any throw = not reachable.
   */
  private async probeOneFreshTab(): Promise<boolean> {
    try {
      await this.pool.resize(1, false); // collapse to exactly one (closes extras)
      const baseId = this.pool.ids[0];
      if (baseId === undefined) return false;
      const fresh = await this.pool.replace(baseId); // brand-new bing.com/dict tab
      this.syncManagedTabs();
      if (!(await this.pool.probeReachable(fresh))) return false;
      const data = await bingDictionaryTool.lookupInTab(fresh, 'hello');
      return !!data && data.outage !== true;
    } catch {
      return false;
    }
  }

  /**
   * Opt-in (default OFF) for per-word tab activation. Activating the pool tab per
   * word fully simulates a human BUT steals focus, so it is gated behind the
   * `bingActivatePerWord` setting — the long-standing default is background tabs.
   */
  private async readActivateFlag(): Promise<boolean> {
    try {
      const r = await chrome.storage.local.get('bingActivatePerWord');
      return r.bingActivatePerWord === true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize a raw config (from the popup, the persisted runtime, or a live
   * update) into the fully-defaulted internal shape, optionally layering it over
   * an existing config so a partial update keeps prior values. Sanitizes ranges
   * and accepts the popup's `fetchInterval` as an alias for `pollInterval` (the
   * popup field is named fetchInterval — historically the worker read only
   * pollInterval and silently ignored the UI's poll interval).
   */
  private normalizeConfig(raw: WorkerConfig, base?: Required<WorkerConfig>): Required<WorkerConfig> {
    const clamp = (n: number, lo: number, hi: number, fallback: number) =>
      Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
    const pollRaw = raw.pollInterval ?? (raw as any).fetchInterval ?? base?.pollInterval ?? 5;
    return {
      // Trim + strip trailing slashes so base + '/api/...' never double-slashes.
      apiUrl: (raw.apiUrl ?? base?.apiUrl ?? '').trim().replace(/\/+$/, ''),
      workerName: raw.workerName ?? base?.workerName ?? 'MCP Chrome Bing Translation Worker',
      pollInterval: clamp(Number(pollRaw), 1, 3600, 5),
      heartbeatInterval: clamp(Number(raw.heartbeatInterval ?? base?.heartbeatInterval ?? 60), 5, 3600, 60),
      batchSize: clamp(Number(raw.batchSize ?? base?.batchSize ?? 5), 1, 50, 5),
      tabCount: clamp(Number(raw.tabCount ?? base?.tabCount ?? 3), 1, MAX_BING_TABS, 3),
      sourceLanguage: (raw.sourceLanguage ?? base?.sourceLanguage ?? 'en').trim().toLowerCase() || 'en',
      targetLanguage: (raw.targetLanguage ?? base?.targetLanguage ?? 'zh').trim().toLowerCase() || 'zh',
    };
  }

  /**
   * Apply a config change WITHOUT stopping the service (real-time settings):
   *   - poll / heartbeat intervals are re-armed when they change;
   *   - the Bing tab pool is grown/shrunk when tabCount changes (only while not
   *     mid-task, so a resize never closes a tab a slot is using);
   *   - batchSize, source/target language are read live each poll/task, so they
   *     take effect on the next cycle with no extra work;
   *   - an apiUrl change re-points + re-registers the worker.
   * When the service is not running this just stores the config for the next
   * start(). Safe to call repeatedly.
   */
  async updateConfig(patch: WorkerConfig): Promise<void> {
    const prev = this.config;
    const next = this.normalizeConfig(patch, prev ?? undefined);
    this.config = next;

    if (!this.isRunning) {
      logger.info(LOG, 'Config stored (service idle; applies on next start)');
      return;
    }

    // Re-point + re-register if the endpoint changed (best-effort).
    if (next.apiUrl && (!prev || prev.apiUrl !== next.apiUrl)) {
      logger.info(LOG, `Endpoint changed live -> ${next.apiUrl}, re-registering`);
      this.workerClient = new WorkerApiClient(next.apiUrl);
      try {
        await this.registerWorker();
      } catch (error) {
        logger.error(LOG, 'Re-register after endpoint change failed', error);
      }
    }

    // Re-arm the poll loop on a new interval (no immediate extra poll).
    if (!prev || prev.pollInterval !== next.pollInterval) {
      if (this.pollIntervalId) clearInterval(this.pollIntervalId);
      this.pollIntervalId = setInterval(() => {
        this.pollAndProcessTasks().catch((e) => logger.warn(LOG, 'Poll error', e));
      }, next.pollInterval * 1000);
      logger.info(LOG, `Poll interval -> ${next.pollInterval}s (live)`);
    }

    // Re-arm the heartbeat on a new interval.
    if (!prev || prev.heartbeatInterval !== next.heartbeatInterval) {
      if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = setInterval(
        () => this.heartbeatOnce(),
        next.heartbeatInterval * 1000,
      );
      logger.info(LOG, `Heartbeat interval -> ${next.heartbeatInterval}s (live)`);
    }

    // Resize the parallel Bing tab pool. Only when idle: shrinking mid-task could
    // close a tab a slot is actively driving. A change requested mid-task is not
    // lost — it is the new ceiling and the next task's pool.ensure() honors it.
    if ((!prev || prev.tabCount !== next.tabCount) && !this.processing) {
      try {
        await this.pool.resize(next.tabCount, false);
        this.stats.activeTabs = this.pool.size;
        this.syncManagedTabs();
        logger.info(LOG, `Tab pool resized -> ${next.tabCount} (live)`);
      } catch (error) {
        logger.warn(LOG, 'Live tab-pool resize failed', error);
      }
    }

    await this.persistRuntime(true);
    logger.info(LOG, 'Config applied live', next);
  }

  /**
   * Re-establish the worker after a service-worker restart that happened WHILE
   * the user had assisting active in the current browser session. Safe to call
   * repeatedly: start() no-ops when already running. Invoked from the alarm
   * watchdog and SW-revival hooks.
   *
   * The intent is read from session storage, which is wiped on browser close —
   * so this never auto-resumes after a full browser restart, and recovery is
   * silent (surface=false: no eager tabs, no focus stealing).
   */
  async resume(): Promise<void> {
    if (this.isRunning) {
      // Already alive — just make sure the watchdog stays armed.
      await this.ensureWatchdog();
      return;
    }

    let persisted: PersistedRuntime | null = null;
    try {
      const result = await chrome.storage.session.get(RUNTIME_STORAGE_KEY);
      persisted = result[RUNTIME_STORAGE_KEY] || null;
    } catch (error) {
      logger.warn(LOG, 'Failed to read persisted runtime', error);
      return;
    }

    if (!persisted || !persisted.running || !persisted.config?.apiUrl) {
      // No active session to recover (e.g. fresh browser start) — make sure a
      // stale watchdog alarm from a previous session does not linger and fire
      // every minute for nothing.
      await this.clearWatchdog();
      return;
    }

    try {
      logger.info(LOG, 'Resuming assist after SW termination (silent)');
      await this.start(persisted.config, /* surface */ false);
    } catch (error) {
      logger.error(LOG, 'Resume failed', error);
    }
  }

  // ------------------------------------------------------------------
  // Persistence + watchdog (MV3 lifecycle resilience)
  // ------------------------------------------------------------------

  private async persistRuntime(running: boolean): Promise<void> {
    const payload: PersistedRuntime = {
      running,
      config: running ? this.config : null,
    };
    try {
      // Session storage: survives SW termination, wiped on browser close.
      await chrome.storage.session.set({ [RUNTIME_STORAGE_KEY]: payload });
    } catch (error) {
      logger.warn(LOG, 'Failed to persist runtime', error);
    }
  }

  private async ensureWatchdog(): Promise<void> {
    try {
      const existing = await chrome.alarms.get(WATCHDOG_ALARM);
      if (!existing) {
        await chrome.alarms.create(WATCHDOG_ALARM, {
          periodInMinutes: WATCHDOG_PERIOD_MINUTES,
          delayInMinutes: WATCHDOG_PERIOD_MINUTES,
        });
      }
    } catch (error) {
      logger.warn(LOG, 'Failed to arm watchdog alarm', error);
    }
  }

  private async clearWatchdog(): Promise<void> {
    try {
      await chrome.alarms.clear(WATCHDOG_ALARM);
    } catch (error) {
      logger.warn(LOG, 'Failed to clear watchdog alarm', error);
    }
  }

  getStatus(): { isRunning: boolean; stats: WorkerStats } {
    return {
      isRunning: this.isRunning,
      stats: { ...this.stats },
    };
  }

  // ------------------------------------------------------------------
  // Registration / heartbeat / polling
  // ------------------------------------------------------------------

  private async registerWorker(): Promise<void> {
    if (!this.workerClient || !this.config) {
      throw new Error('Worker client not initialized');
    }

    const workerId = `mcp-chrome-bing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const response = await this.workerClient.register({
      worker_id: workerId,
      worker_name: this.config.workerName,
      // word_translation tasks are dispatched as execution_type
      // `remote_translation`; the worker must register that processor type to be
      // assigned them. It also joins the shared `remote_fast` lane so the
      // dispatcher can route fast-tier translate work here.
      processor_types: ['remote_translation', 'remote_fast'] as ProcessorType[],
      // Advertise ONLY 'translate' (B18: bing is the sole translate owner on the
      // fast lane; WebAiTranslate owns ai_translate). 'image' is no longer in the
      // shared fast set (B17) — a Bing dictionary tab can scrape a word lookup but
      // cannot GENERATE an image, so the dispatcher must never route a true image
      // task here. The processTask capability guard still rejects any image task
      // that somehow slips through. (sentence_audio is generated inline
      // server-side, never by a Bing tab; ai_translate belongs only to the web-AI
      // worker.)
      capabilities: CHROME_FAST_CAPABILITIES,
      hostname: 'chrome-extension',
      platform: navigator.userAgent,
      metadata: {
        version: chrome.runtime.getManifest().version,
        extensionId: chrome.runtime.id,
        tabCount: this.config.tabCount,
      },
    });

    if (response.success && response.data) {
      this.stats.workerId = response.data.worker_id;
      this.stats.isOnline = true;
      logger.info(LOG, 'Registered successfully', response.data.worker_id);
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  }

  private async heartbeatOnce(): Promise<void> {
    if (!this.workerClient) return;
    try {
      await this.workerClient.heartbeat();
      this.stats.isOnline = true;
    } catch (error) {
      logger.error(LOG, 'Heartbeat failed', error);
      this.stats.isOnline = false;
    }
  }

  private startHeartbeat(): void {
    if (!this.workerClient || !this.config) return;
    this.heartbeatOnce();
    this.heartbeatIntervalId = setInterval(
      () => this.heartbeatOnce(),
      this.config.heartbeatInterval * 1000,
    );
  }

  private startPolling(): void {
    if (!this.config) return;

    const poll = async () => {
      await this.pollAndProcessTasks();
    };

    poll();
    this.pollIntervalId = setInterval(poll, this.config.pollInterval * 1000);
  }

  private async pollAndProcessTasks(): Promise<void> {
    if (!this.workerClient || !this.config) return;

    // Unified pause: anti-scrape cooldown OR a human actively switching tabs
    // (TabController). Either way we stop pulling + creating tabs and let the
    // idle-discard run; both clocks self-clear so the next tick resumes.
    if (this.isWorkerPaused()) {
      this.maybeDiscardIdleTabs();
      return;
    }

    // Bing soft-outage recovery: while in outage, don't pull tasks — wait out the
    // 30s window, then probe ONE fresh tab. Reachable -> clear outage + fall
    // through to pull this tick; still down -> re-pause 30s (bounded so a
    // persistent unclearable state can't wedge the worker forever).
    if (this.inOutage) {
      if (Date.now() < this.outageUntil) {
        this.maybeDiscardIdleTabs();
        return;
      }
      if (this.probing) return;
      this.probing = true;
      let reachable = false;
      try {
        reachable = await this.probeOneFreshTab();
      } finally {
        this.probing = false;
      }
      if (reachable) {
        this.inOutage = false;
        this.outageProbeFails = 0;
        logger.info(LOG, 'Bing outage cleared — fresh-tab probe reached Bing; resuming');
        // fall through to the normal pull this tick
      } else {
        this.outageProbeFails++;
        if (this.outageProbeFails >= OUTAGE_MAX_PROBES) {
          this.inOutage = false;
          this.outageProbeFails = 0;
          logger.warn(
            LOG,
            `Bing outage probe exceeded ${OUTAGE_MAX_PROBES} attempts — exiting outage mode; ` +
              `resuming normal handling (per-word non-dict/anti-scrape logic takes over)`,
          );
          // fall through to pull
        } else {
          this.outageUntil = Date.now() + OUTAGE_PAUSE_MS;
          logger.warn(
            LOG,
            `Bing still in outage on fresh-tab probe (${this.outageProbeFails}/${OUTAGE_MAX_PROBES}) — re-pausing 30s`,
          );
          return;
        }
      }
    }

    try {
      this.stats.lastRun = Date.now();

      const response = await this.workerClient.pullTasks(undefined, {
        limit: this.config.batchSize,
        // `wait` (server-side long-poll seconds) replaces the old `timeout`
        // param; cap to the poll interval so this loop stays responsive.
        wait: Math.min(this.config.pollInterval, 30),
      });

      if (!response.success || !response.data || response.data.count === 0) {
        this.stats.newTasks = 0;
        this.stats.duplicateTasks = 0;
        // No tasks now, but the backend may still report fast-tier backlog —
        // schedule an immediate re-poll so we don't wait a full interval.
        if (response.success && response.data) {
          this.noteFastSignals(response.data.pending_fast);
        }
        // Idle with nothing to do -> free the Bing renderers (keeps Chrome snappy).
        this.maybeDiscardIdleTabs();
        return;
      }

      // B3: react to the fast-tier backlog signal — schedule a jittered wait=0
      // re-poll burst so newly-bumped fast translate tasks are drained promptly.
      this.noteFastSignals(response.data.pending_fast);

      // B3: highest priority first, so a bumped (fast-tier) task is processed
      // ahead of the rest of the claimed batch.
      const tasks = [...response.data.tasks].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
      );
      let newTaskCount = 0;
      let duplicateCount = 0;

      for (const task of tasks) {
        if (this.taskCache.has(task.task_id)) {
          duplicateCount++;
        } else {
          this.taskCache.add(task.task_id);
          this.taskQueue.push(task);
          newTaskCount++;
        }
      }

      this.stats.newTasks = newTaskCount;
      this.stats.duplicateTasks = duplicateCount;
      this.stats.queueTotal = this.taskQueue.length;
      this.stats.pending = this.taskQueue.length;

      // One task at a time, but the words WITHIN a task run in parallel across
      // the tab pool.
      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        if (task) {
          await this.processTask(task);
          this.stats.queueTotal = this.taskQueue.length;
          this.stats.pending = this.taskQueue.length;
        }
      }
    } catch (error) {
      logger.error(LOG, 'Polling error', error);
    }
  }

  /**
   * B3: schedule a fast re-poll burst when the backend signals fast-tier work is
   * waiting. The burst is jittered and coalesced (only one in flight) so it does
   * not stampede the pull endpoint.
   */
  private noteFastSignals(pendingFast?: number): void {
    if ((pendingFast ?? 0) > 0) {
      this.scheduleFastRepoll();
    }
  }

  /**
   * Discard the idle Bing pool tabs once the worker has had nothing to do for
   * IDLE_DISCARD_MS — frees their renderer memory so idle assisting doesn't lag
   * Chrome. Strictly guarded: never while a task is processing or queued, never
   * twice per idle window, and only when the pool actually has tabs. The next
   * task's lookup reloads a discarded tab on demand (and replace() self-heals if
   * Chrome evicted it), so the pool stays intact.
   */
  private maybeDiscardIdleTabs(): void {
    if (!this.isRunning) return;
    if (this.processing) return;
    if (this.poolDiscarded) return;
    if (this.taskQueue.length > 0) return;
    if (this.pool.size === 0) return;
    if (this.lastActivityAt <= 0) return;
    if (Date.now() - this.lastActivityAt < IDLE_DISCARD_MS) return;
    this.poolDiscarded = true;
    this.pool.discardIdle().catch(() => undefined);
  }

  private scheduleFastRepoll(): void {
    if (!this.isRunning) return;
    if (this.fastRepollTimer) return; // coalesce — one burst in flight
    const jitter = Math.floor(Math.random() * FAST_REPOLL_JITTER_MS);
    this.fastRepollTimer = setTimeout(() => {
      this.fastRepollTimer = null;
      if (!this.isRunning) return;
      // Drain whatever fast-tier work matched our capabilities now.
      this.pollAndProcessTasks().catch((error) =>
        logger.warn(LOG, 'Fast re-poll failed', error),
      );
    }, FAST_REPOLL_BASE_MS + jitter);
  }

  // ------------------------------------------------------------------
  // Task processing
  // ------------------------------------------------------------------

  private async processTask(task: Task): Promise<void> {
    if (!this.workerClient || !this.config) return;

    const workerId = this.stats.workerId!;
    this.stats.currentTaskId = task.task_id;

    // Capability/task_type guard: a Bing dictionary tab can ONLY do word
    // lookups. If the dispatcher hands us an image task (or any unknown
    // task_type) — e.g. because the shared fast lane briefly routed one here —
    // do NOT mis-scrape it as a dictionary lookup. Submit 'failed' to cleanly
    // release it (release-by-failure, mirroring SimpleWorkerBase.dispatchOne)
    // so it re-pends and reaches a worker that can actually handle it.
    const HANDLED_TASK_TYPES = new Set([
      'word_translation',
      'word_media',
      'bing_dictionary',
      'dictionary_translation',
    ]);
    if (task.capability === 'image' || !HANDLED_TASK_TYPES.has(task.task_type)) {
      const reason = `unhandled task_type/capability: task_type=${task.task_type} capability=${task.capability ?? 'none'}`;
      logger.warn(LOG, `Releasing task ${task.task_id} — ${reason}`);
      try {
        await this.workerClient.submitResult({
          task_id: task.task_id,
          worker_id: workerId,
          status: 'failed',
          error: reason,
        });
      } catch (submitError) {
        logger.error(LOG, 'Failed to submit unhandled-task release', submitError);
      }
      this.taskCache.delete(task.task_id);
      this.stats.currentTaskId = null;
      return;
    }

    try {
      logger.info(LOG, `Processing task: ${task.task_id}`);
      // Mark active so the idle-discard poll never unloads a tab mid-lookup.
      this.processing = true;
      this.lastActivityAt = Date.now();
      this.poolDiscarded = false;

      await this.workerClient.acceptTask(task.task_id);
      await this.workerClient.submitResult({
        task_id: task.task_id,
        worker_id: workerId,
        status: 'processing',
        progress: 0,
      });

      // Accept either an explicit words[] payload or a single `content` word
      // (the fast-tier single-word shape). Empty => fail so it re-pends.
      const rawWords =
        task.payload.words ??
        (task.payload.content
          ? [{ word: task.payload.content, md5: (task.payload as any).md5 }]
          : []);
      const words = normalizeWords(rawWords);
      if (words.length === 0) {
        throw new Error('No words in task payload');
      }

      // Per-word tab activation is opt-in (default OFF) — see readActivateFlag.
      const activatePerWord = await this.readActivateFlag();

      // Proactively clean Bing's anti-scrape / unreachable tabs BEFORE crawling
      // so a dead "can't reach this page" tab is never driven (it's closed and
      // replaced 1-for-1, capped at tabCount, touching only our own pool tabs).
      await this.pool.healUnreachable(this.config.tabCount);

      // Reuse the existing pool without stealing focus (surface=false). Open no
      // more tabs than there are words — a small task must not spin up the full
      // pool (keeps Chrome light); the configured tabCount is only the ceiling.
      const tabIds = await this.pool.ensure(Math.min(this.config.tabCount, words.length), false);
      this.stats.activeTabs = this.pool.size;
      // Re-report the live pool ids so TabController heals exactly these (and the
      // healUnreachable above may have swapped some ids).
      this.syncManagedTabs();
      // Seed per-tab activity (one slot per tab) so the popup can show which
      // word each parallel tab is translating right now.
      this.stats.tabActivity = tabIds.map((id) => ({ tabId: id, word: null }));
      const targetLanguage = task.payload.target_language || this.config.targetLanguage;

      const translations: ResultEntry[] = [];
      const invalidWords: NormalizedWord[] = [];
      // Words that persistently landed on a non-dict (region/redirect) page even
      // after retries. Promoted to region-redirect-invalid only if the batch was
      // otherwise healthy (see the outage guard after the slots finish).
      const nonDictWords: NormalizedWord[] = [];

      let nextIndex = 0;
      let done = 0;
      let lastReported = 0;
      const total = words.length;
      // Anti-scrape detection shared across slots: count consecutive blocked
      // words (dead-tab errors that survived healing); abort the batch once it
      // crosses the threshold so we back off instead of spawning more tabs.
      let antiScrapeHits = 0;
      let aborted = false;
      // Bing soft-outage detection (a global transient, distinct from anti-scrape):
      // any outage page stops the batch fast WITHOUT arming the 60s anti-scrape
      // cooldown — the after-batch trigger enters 30s outage-probe mode instead.
      let outageHits = 0;
      let outageDetected = false;

      const runSlot = async (initialTabId: number, slot: number): Promise<void> => {
        let tabId = initialTabId;
        while (true) {
          if (aborted || outageDetected) break;
          const i = nextIndex++;
          if (i >= total) break;
          const w = words[i];
          this.stats.currentWord = w.word;
          this.setSlotWord(slot, tabId, w.word);

          // Per-word tab activation (opt-in): bring THIS slot's tab to the front
          // before typing into it. Serialized via activateChain so concurrent
          // slots don't fight over the single active tab — the foregrounded tab
          // is the one being typed into right now. Each activation is recorded by
          // TabController so it is never mis-counted as a human tab switch.
          if (activatePerWord) {
            await (this.activateChain = this.activateChain
              .catch(() => undefined)
              .then(() => tabController.activate(tabId)));
          }

          try {
            // Heal a dead/discarded tab transparently and keep the fresh id.
            let looked = await this.lookupHealing(tabId, w.word);
            tabId = looked.tabId;
            this.setSlotWord(slot, tabId, w.word);
            let data = looked.data;
            let classification = classify(data);

            // Region/redirect ('non-dict') pages are often transient — retry the
            // word a few times before giving up, so a momentary redirect doesn't
            // get mistaken for a persistent region-redirect failure.
            let attempt = 1;
            while (
              classification.kind === 'error' &&
              !!data &&
              data.pageType === 'non-dict' &&
              !data.outage && // an outage page won't clear by retrying — don't
              attempt < NONDICT_ATTEMPTS
            ) {
              attempt++;
              looked = await this.lookupHealing(tabId, w.word);
              tabId = looked.tabId;
              data = looked.data;
              classification = classify(data);
            }

            // Detailed per-word trace for the DEBUG center: shows exactly why a
            // word resolved the way it did (so INVALID vs FAILED is visible).
            logger.info(
              LOG,
              `"${w.word}" -> ${classification.kind.toUpperCase()} (${classification.reason}) ` +
                `[pageType=${data?.pageType ?? '?'} noEntry=${data?.noEntry ?? '?'} ` +
                `outage=${data?.outage ?? '?'} hasContent=${data?.hasContent ?? '?'} attempts=${attempt}]`,
            );

            if (classification.kind === 'translated') {
              const entry = await buildEntry(w, data, tabId);
              translations.push(entry);
              this.stats.translated++;
              logger.info(
                LOG,
                `"${w.word}" VALID: images=${entry.image_base64?.length ?? 0} audio=${entry.audio_base64 ? 'yes' : 'no'} phonetic=${entry.phonetic ?? entry.us_phonetic ?? entry.uk_phonetic ?? '-'}`,
              );
            } else if (classification.kind === 'invalid') {
              invalidWords.push(w);
              this.stats.invalid++;
              logger.info(
                LOG,
                `"${w.word}" is INVALID (no Bing entry) — reporting to backend as invalid, NOT a failure`,
              );
            } else {
              this.stats.failed++;
              if (data && data.outage) {
                // Bing soft-outage page — a GLOBAL transient. Flag it (never add to
                // nonDictWords, so it can NEVER be promoted to region-redirect
                // invalid, even in a mixed batch) and stop the batch fast.
                outageHits++;
                outageDetected = true;
                logger.warn(LOG, `"${w.word}" hit Bing OUTAGE page — entering outage mode`);
              } else if (data && data.pageType === 'non-dict') {
                // Persistent non-dict after retries: a region/redirect failure. Hold
                // it aside — only promoted to invalid if the batch was otherwise
                // healthy (outage guard below).
                nonDictWords.push(w);
              }
              if (!data || !data.outage) {
                logger.warn(
                  LOG,
                  `"${w.word}" FAILED transiently (${classification.reason}) — will retry/re-pend, NOT marked invalid`,
                );
              }
            }
            // A non-throwing lookup means the page responded — Bing is not
            // blocking us, so clear the anti-scrape streak.
            antiScrapeHits = 0;
          } catch (error) {
            logger.error(LOG, `Failed to translate ${w.word}`, error);
            this.stats.failed++;
            // A dead-tab / "showing error page" failure that survived healing is
            // an anti-scrape block. Count consecutive ones and abort the batch
            // once Bing is clearly rate-limiting, so we cool down rather than
            // open a heap of error tabs.
            if (isRecoverableTabError(error)) {
              antiScrapeHits++;
              if (antiScrapeHits >= ANTISCRAPE_ABORT_THRESHOLD) {
                aborted = true;
              }
            }
          }

          done++;
          const progress = Math.round((done / total) * 100);
          if (progress - lastReported >= 20 && progress < 100) {
            lastReported = progress;
            this.workerClient!
              .submitResult({
                task_id: task.task_id,
                worker_id: workerId,
                status: 'processing',
                progress,
              })
              .catch(() => undefined);
          }

          // Human-paced random gap before this slot grabs the next word, so the
          // worker never hammers Bing at a fixed cadence. Skipped when aborting
          // (anti-scrape / outage) or when no words remain for this slot.
          if (!aborted && !outageDetected && nextIndex < total) {
            const gap = LOOKUP_DELAY_BASE_MS + Math.floor(Math.random() * LOOKUP_DELAY_JITTER_MS);
            await new Promise((resolve) => setTimeout(resolve, gap));
          }
        }
        // Slot drained — mark it idle.
        this.setSlotWord(slot, tabId, null);
      };

      await Promise.all(tabIds.map((tabId, slot) => runSlot(tabId, slot)));

      // Sustained anti-scrape: enter a cooldown so the next polls back off (no tab
      // churn) until Bing relaxes. Whatever WAS scraped is still submitted below;
      // the unprocessed words stay needing-translation and re-enqueue later.
      if (aborted) {
        this.cooldownUntil = Date.now() + ANTISCRAPE_COOLDOWN_MS;
        logger.warn(
          LOG,
          `Bing anti-scrape detected (${antiScrapeHits} consecutive blocks) — aborted batch, ` +
            `cooling down ${ANTISCRAPE_COOLDOWN_MS / 1000}s before polling again`,
        );
      }

      // Bing SOFT OUTAGE (or a whole batch dying): a GLOBAL transient. Pause ALL
      // work 30s and enter probe-mode (one fresh tab until reachable). NOTHING is
      // invalidated — region_redirect_words is forced []. Whatever was scraped
      // BEFORE the outage is still saved (partial completed); the rest re-enqueue.
      if (outageHits > 0 || (aborted && translations.length === 0 && invalidWords.length === 0)) {
        this.inOutage = true;
        this.outageUntil = Date.now() + OUTAGE_PAUSE_MS;
        this.outageProbeFails = 0;
        const hadOutput = translations.length > 0 || invalidWords.length > 0;
        logger.warn(
          LOG,
          `Bing SOFT OUTAGE / all-tabs-dead (outageHits=${outageHits}) — pausing all work ` +
            `${OUTAGE_PAUSE_MS / 1000}s then probing one fresh tab; task ${task.task_id} ` +
            `${hadOutput ? 'partial-saved' : 're-pended'}; NOTHING invalidated by outage`,
        );
        if (hadOutput) {
          await this.workerClient.submitResult({
            task_id: task.task_id,
            worker_id: workerId,
            status: 'completed',
            progress: 100,
            result: {
              target_language: targetLanguage,
              provider: 'bing',
              translations,
              invalid_words: invalidWords,
              region_redirect_words: [],
            },
          });
        } else {
          await this.workerClient.submitResult({
            task_id: task.task_id,
            worker_id: workerId,
            status: 'failed',
            error: 'Bing outage / service unavailable',
          });
        }
        this.taskCache.delete(task.task_id);
        return;
      }

      // Outage guard: only treat persistent non-dict words as region-redirect
      // invalid when the batch was OTHERWISE healthy (at least one word resolved
      // — a real dict page or a confirmed "No results" no-entry). If the WHOLE
      // batch was non-dict it is almost certainly a transient Bing region outage,
      // so we invalidate nothing and let the words be retried later.
      const batchHealthy = translations.length > 0 || invalidWords.length > 0;
      const regionRedirectWords = batchHealthy ? nonDictWords : [];

      // Zero-output guard: a batch that produced NO translations AND NO invalid
      // words is a transient miss (region outage / all redirects), not real
      // work done. Submit 'failed' so the task re-pends and is retried later,
      // instead of a fake completed-empty that would mark the words handled.
      if (translations.length === 0 && invalidWords.length === 0) {
        await this.workerClient.submitResult({
          task_id: task.task_id,
          worker_id: workerId,
          status: 'failed',
          error: 'no translations or invalid words produced (transient miss)',
        });
        this.taskCache.delete(task.task_id);
        logger.warn(
          LOG,
          `Task ${task.task_id} produced zero output; submitted failed for re-pend`,
        );
        return;
      }

      const audioCount = translations.filter((t) => !!t.audio_base64).length;
      const imageCount = translations.reduce((n, t) => n + (t.image_base64?.length ?? 0), 0);
      logger.info(
        LOG,
        `Submitting ${task.task_id}: ${translations.length} translated (audio=${audioCount}, images=${imageCount}), ` +
          `${invalidWords.length} invalid, ${regionRedirectWords.length} region-redirect`,
      );

      const submitResp = await this.workerClient.submitResult({
        task_id: task.task_id,
        worker_id: workerId,
        status: 'completed',
        progress: 100,
        result: {
          target_language: targetLanguage,
          provider: 'bing',
          translations,
          invalid_words: invalidWords,
          // Persistent region/redirect words — backend marks is_valid=false with
          // validity_source='region-redirect' so they stop being re-queued.
          region_redirect_words: regionRedirectWords,
        },
      });

      // Backend reception: log exactly what the server stored so the DEBUG center
      // shows the round-trip result (saved/invalid/audio_saved/images_saved).
      logger.info(
        LOG,
        `Backend reception ${task.task_id}: ok=${submitResp?.success} ${JSON.stringify(submitResp?.data ?? null)}`,
      );

      this.taskCache.delete(task.task_id);
      logger.info(
        LOG,
        `Task completed: ${task.task_id} (${translations.length} translated, ${invalidWords.length} invalid, ${regionRedirectWords.length} region-redirect)`,
      );
    } catch (error: any) {
      logger.error(LOG, 'Task processing failed', error);

      try {
        await this.workerClient.submitResult({
          task_id: task.task_id,
          worker_id: workerId,
          status: 'failed',
          error: error?.message || 'Unknown error',
        });
      } catch (submitError) {
        logger.error(LOG, 'Failed to submit error status', submitError);
      }

      this.taskCache.delete(task.task_id);
    } finally {
      // Task done — restart the idle-discard countdown; allow idle discard again.
      this.processing = false;
      this.lastActivityAt = Date.now();
      // Clear live activity between tasks so the popup shows idle, not a stale word.
      this.stats.currentWord = null;
      this.stats.currentTaskId = null;
      this.stats.tabActivity = [];
    }
  }

  /** Update one pool slot's live activity (tab id + word) for the popup. */
  private setSlotWord(slot: number, tabId: number, word: string | null): void {
    const arr = this.stats.tabActivity;
    if (slot < 0) return;
    arr[slot] = { tabId, word };
  }

  /**
   * Look up a word in the slot's tab, transparently healing a tab that died
   * mid-crawl (closed by the user / discarded by Chrome's memory saver). On a
   * dead-tab error it swaps in a fresh pool tab and retries the word ONCE, then
   * returns the (possibly replaced) tab id so the slot keeps using a live tab.
   */
  private async lookupHealing(
    tabId: number,
    word: string,
    includeMedia = false,
  ): Promise<{ data: BingDictionaryResult; tabId: number }> {
    try {
      const data = await bingDictionaryTool.lookupInTab(tabId, word, includeMedia);
      return { data, tabId };
    } catch (error) {
      if (!isRecoverableTabError(error)) throw error;
      logger.warn(LOG, `Tab ${tabId} vanished, replacing and retrying "${word}"`);
      const fresh = await this.pool.replace(tabId);
      this.stats.activeTabs = this.pool.size;
      // The pool id set changed — keep TabController's managed set in step so a
      // real user-close of the NEW tab is still healed (and the dead id forgotten).
      this.syncManagedTabs();
      const data = await bingDictionaryTool.lookupInTab(fresh, word, includeMedia);
      return { data, tabId: fresh };
    }
  }

  /**
   * Ad-hoc Bing scrape test (popup) — delegates to the shared runScrapeTest in
   * bing-worker-ops, injecting this worker's pool + lookup-healing + live-stat
   * setters. Behavior is identical to the former inline implementation.
   */
  async testScrape(rawWords: string[], tabCount?: number): Promise<ScrapeTestResult[]> {
    return runScrapeTest(rawWords, tabCount, {
      pool: this.pool,
      defaultTabCount: this.config?.tabCount ?? 3,
      lookup: (tabId, word, includeMedia) => this.lookupHealing(tabId, word, includeMedia),
      setActiveTabs: (n) => {
        this.stats.activeTabs = n;
      },
      setCurrentWord: (w) => {
        this.stats.currentWord = w;
      },
    });
  }

  /**
   * Translation queue overview: how many words are still untranslated + a
   * preview of those words, for the panel to show on "Load queue". Reads the
   * DICTIONARY-driven pending list (words with no translation that are not
   * invalid) from laravel_main, NOT the global_tasks work queue — so the panel
   * shows real remaining work even before any task exists. A plain control read
   * that works whether or not the worker is running.
   */
  async getQueueOverview(
    apiUrl?: string,
    status = 'pending',
    limit = 10,
    page = 1,
    language = 'en',
    targetLanguage?: string,
  ): Promise<{ ok: boolean; summary?: any; items?: any[]; pagination?: any; message?: string }> {
    const base = (apiUrl || this.config?.apiUrl || '').trim().replace(/\/+$/, '');
    if (!base) return { ok: false, message: 'No endpoint configured in Settings' };
    const target = targetLanguage || this.config?.targetLanguage || 'zh';
    try {
      const client =
        this.workerClient && this.config?.apiUrl === base
          ? this.workerClient
          : new WorkerApiClient(base);
      const resp = await client.getPendingWords({
        language,
        target_language: target,
        limit,
        page,
      });
      if (resp.success && resp.data) {
        return {
          ok: true,
          summary: resp.data.summary,
          items: resp.data.items,
          pagination: resp.data.pagination,
        };
      }
      return { ok: false, message: resp.message || 'Failed to load queue' };
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Unreachable' };
    }
  }

  /**
   * Enqueue dictionary-pending words into the shared word_translation queue so
   * this worker has tasks to pull. Best-effort: a failure must not block Start
   * (the background scan also enqueues, just more slowly).
   */
  private async enqueuePending(): Promise<void> {
    if (!this.workerClient || !this.config) return;
    try {
      const resp = await this.workerClient.enqueuePending({
        language: this.config.sourceLanguage,
        target_language: this.config.targetLanguage,
        limit: 500,
      });
      if (resp.success && resp.data) {
        logger.info(
          LOG,
          `Enqueued pending words: queued=${resp.data.queued} moved=${resp.data.moved} skipped=${resp.data.skipped}`,
        );
      }
    } catch (error) {
      logger.warn(LOG, 'enqueuePending failed (background scan will still feed)', error);
    }
  }

  /**
   * Verify the API base URL is reachable by hitting the worker stats endpoint.
   * Used by the popup "Test" button so the user gets immediate feedback instead
   * of a silently dead Start.
   */
  async testConnection(apiUrl: string): Promise<{ ok: boolean; message: string }> {
    const trimmed = (apiUrl || '').trim().replace(/\/+$/, '');
    if (!trimmed) {
      return { ok: false, message: 'API URL is empty' };
    }
    try {
      const client = new WorkerApiClient(trimmed);
      const response = await client.getWorkerStats();
      if (response.success) {
        return { ok: true, message: 'Connected' };
      }
      return { ok: false, message: response.message || 'Server returned an error' };
    } catch (error: any) {
      return { ok: false, message: error?.message || 'Unreachable' };
    }
  }
}

// Singleton instance
export const bingDictionaryWorkerService = new BingDictionaryWorkerService();

/**
 * Register the MV3 lifecycle hooks that keep the translation assist alive
 * ACROSS service-worker termination WITHIN a browser session.
 *
 * Per the official service-worker lifecycle guidance, event listeners must be
 * registered synchronously at the top level of the SW so they are present when
 * the worker is revived. This wires:
 *   - chrome.alarms.onAlarm  -> watchdog resurrection (also wakes a terminated SW)
 *   - chrome.runtime.onStartup / onInstalled -> recover if a session was active
 * plus an immediate resume() for SWs revived by any other event.
 *
 * resume() reads the run intent from session storage (wiped on browser close),
 * so none of these hooks auto-start crawling or open Bing tabs after a fresh
 * browser launch — only an explicit user Start does that.
 */
export function initBingWorkerLifecycle(): void {
  // Load any persisted global logs so the background buffer continues across
  // service-worker restarts (best-effort; logging never blocks startup).
  logger.init().catch(() => undefined);

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === WATCHDOG_ALARM) {
      bingDictionaryWorkerService.resume().catch(() => undefined);
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    bingDictionaryWorkerService.resume().catch(() => undefined);
  });

  chrome.runtime.onInstalled.addListener(() => {
    bingDictionaryWorkerService.resume().catch(() => undefined);
  });

  // The SW may have just been revived by an unrelated event; re-establish the
  // worker immediately if the user had it assisting.
  bingDictionaryWorkerService.resume().catch(() => undefined);
}
