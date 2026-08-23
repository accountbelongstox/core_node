/**
 * Bing Dictionary Worker Service
 *
 * Acts as a laravel_main translation worker: registers under processor type
 * `remote_translation`, consumes the word_translation queue
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
import {
  DIFF_DELIVERY,
  TASK_CAPABILITY_BY_ROLE,
  TASK_STATUS_BY_ROLE,
  TASK_TYPE_KEYS,
} from '@/utils/queue-center-contract';
import { tabController } from './tab-controller';
import {
  classify,
  buildEntry,
  type ResultEntry,
} from './bing-result';
import { normalizeWords, type NormalizedWord } from '@/utils/task-words';
import { howtopronouncePronunciationSource } from './howtopronounce-pronunciation-source';
import { runScrapeTest, type ScrapeTestResult } from './bing-worker-ops';
import {
  initBingWorkerLifecycle as _initLifecycle,
  RUNTIME_STORAGE_KEY,
  WATCHDOG_ALARM,
  WATCHDOG_PERIOD_MINUTES,
} from './bing-worker-lifecycle';
import { isProcessorActive } from './task-center/run-intent';
import { LANES } from '@/utils/task-center-lanes';
import { DEFAULT_SOURCE_LANG, DEFAULT_TARGET_LANG } from '@/utils/task-center-types';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { LaravelWorkerLifecycleBase } from './task-center/LaravelWorkerLifecycleBase';
import { queueCenterWakeService } from './task-center/QueueCenterWakeService';
import { IntervalController, TimeoutController, delay as waitForDelay } from '@/utils/async';

// Subsystem tag for the global logger.
export const LOG = 'Bing Worker';

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
  // How many words the parallel howtopronounce mode contributed audio/content
  // for (the second pronunciation mode sharing this task's data).
  howtopronounceHits: number;
  // Per-tab live activity: the word each parallel Bing tab is looking up right
  // now (one entry per pool slot), so the popup shows "Tab 1 · Translating: x"
  // for every tab instead of a single overall word.
  tabActivity: Array<{ tabId: number; word: string | null }>;
}

// How many times to re-attempt a word that lands on a non-dict (region/redirect)
// page before treating it as a persistent region-redirect failure. The helper
// already reloads the dict home once per attempt, so this is attempts-of-attempts.
export const NONDICT_ATTEMPTS = 3;

// Anti-scrape backoff: when Bing starts serving net-error / "can't reach this
// page" responses (dead-tab errors that survive one heal), opening more tabs only
// makes it worse. After this many consecutive blocked words we ABORT the batch
// and enter a cooldown so Bing's rate-limit relaxes — instead of churning a heap
// of dead tabs. Tuned conservative: a few transient misses won't trip it.
export const ANTISCRAPE_ABORT_THRESHOLD = 6;
export const ANTISCRAPE_COOLDOWN_MS = 60_000;

// Bing SOFT OUTAGE ("It's not you, it's us" / "Bing isn't available right now")
// or a whole batch dying: a GLOBAL transient, distinct from anti-scrape. Pause ALL
// work for 30s, then probe ONE fresh tab until Bing is reachable again; NEVER
// invalidate words. A bounded probe cap stops an indefinite stall if Bing serves
// something the probe can't clear.
export const OUTAGE_PAUSE_MS = 30_000;
export const OUTAGE_MAX_PROBES = 10;
// Long-term all-tabs-dead recovery: after OUTAGE_MAX_PROBES failed 30s probes
// (~5 min of Bing being unreachable on fresh tabs), escalate to a DEEP RESET
// (close ALL pool tabs) + a longer 5-min backoff, then KEEP probing indefinitely
// — the closest an extension can do to "restart the browser and continue" (a
// Chrome extension cannot restart the browser process; chrome.runtime.reload
// would only reload the extension AND wipe the session-stored run-intent, so it
// would NOT auto-continue). When Bing recovers, the next probe succeeds and the
// crawl resumes directly.
export const LONG_OUTAGE_PAUSE_MS = 300_000;

// Human-paced jitter between consecutive word lookups so the worker NEVER hits
// Bing at a fixed cadence (the user's "必须有一个随机时间，不要一直不停的按时间刷新").
// 1.5s–4.0s, mirroring scheduleFastRepoll's BASE + random*JITTER idiom. This
// spaces individual lookups; the batch-level ANTISCRAPE_COOLDOWN_MS handles
// sustained blocks.
export const LOOKUP_DELAY_BASE_MS = 1500;
export const LOOKUP_DELAY_JITTER_MS = 2500;

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
// (RUNTIME_STORAGE_KEY, WATCHDOG_ALARM, WATCHDOG_PERIOD_MINUTES imported from
// bing-worker-lifecycle.ts)

// Fast re-poll cadence (B3): when a pull reports pending_fast>0 we fire an
// immediate jittered and coalesced re-poll instead of waiting for the next
// poll-interval tick, so fast-tier translate work is drained promptly. Mirrors
// SimpleWorkerBase's FAST_REPOLL_* constants.
export const FAST_REPOLL_BASE_MS = 400;
export const FAST_REPOLL_JITTER_MS = 300;

// Free the Bing renderer memory when the worker has had no task for this long:
// the pool tabs are discarded (unloaded, ids kept) so idle assisting doesn't keep
// several bing.com renderers resident and lagging Chrome. Re-loaded on demand by
// the next lookup's navigation.
export const IDLE_DISCARD_MS = 60_000;

// Task types this worker can handle. A Bing dictionary tab can ONLY do word
// lookups; any other task_type (e.g. image generation) is released as 'failed'
// so the dispatcher re-pends it for a capable worker. Module-level so it is
// created once, not on every processTask call.
export const DICTIONARY_TASK_TYPES = new Set([
  TASK_TYPE_KEYS.dictionary_explanation,
  TASK_TYPE_KEYS.dictionary_explanation_demo,
]);
export const HANDLED_TASK_TYPES = new Set([
  TASK_TYPE_KEYS.word_translation,
  ...DICTIONARY_TASK_TYPES,
]);

interface PersistedRuntime {
  running: boolean;
  config: WorkerConfig | null;
}

export abstract class BingDictionaryWorkerRuntimeBase extends LaravelWorkerLifecycleBase {
  protected isRunning = false;
  protected config: Required<WorkerConfig> | null = null;

  public canHandleTaskType(taskType: string): boolean {
    return HANDLED_TASK_TYPES.has(taskType);
  }

  protected readonly taskPolling = new IntervalController();
  protected readonly heartbeatPolling = new IntervalController();
  // Coalesce fast re-polls (B3): at most one scheduled burst in flight.
  protected readonly fastRepollTimeout = new TimeoutController();
  protected wakeUnsubscribe: (() => void) | null = null;

  // Pool of background Bing dictionary tabs driven in parallel (self-healing).
  protected pool = new BingTabPool();

  // Idle-tab-discard bookkeeping (keeps Chrome responsive): last task activity
  // timestamp, a guard so a still-running task is never discarded mid-lookup,
  // and a once-per-idle-window flag.
  protected lastActivityAt = 0;
  protected processing = false;
  protected poolDiscarded = false;
  // Epoch ms until which polling is paused after sustained Bing anti-scrape.
  protected cooldownUntil = 0;
  // Bing soft-outage state: inOutage gates the poll loop into probe-mode;
  // outageUntil spaces probes 30s apart; outageProbeFails bounds the retries;
  // probing guards against a re-entrant probe from an overlapping poll tick.
  protected outageUntil = 0;
  protected inOutage = false;
  protected outageProbeFails = 0;
  protected probing = false;
  // Re-entrancy guard for pollAndProcessTasks: setInterval does not await an
  // async poll, so without this a slow batch (a 5-word/3-tab crawl takes 20s+)
  // overlaps the next interval tick (and any fast-repoll burst), racing two
  // concurrent runs on the shared tab pool - each pulling tasks and calling
  // unserialized pool.ensure/healUnreachable that clobber this.tabIds and leak
  // orphaned bing.com/dict tabs. A re-entrant tick is dropped on the floor; the
  // in-flight poll drains the work and the next tick picks up anything new.
  protected polling = false;
  protected reconfiguring = false;
  // Single-foreground mutex: serializes the ENTIRE human-input critical section
  // (activate + confirm-active + type + click-search + that word's lookup) so
  // exactly ONE slot drives the foreground tab at a time. This is what kills the
  // flicker / mid-type tab-switch / two-tabs-same-word — previously only the
  // activate step was serialized while the typing raced. Media capture + the
  // inter-word delay run OUTSIDE the lock (parallel).
  protected foregroundChain: Promise<unknown> = Promise.resolve();
  // Whether the heal handler has been wired to the shared TabController.
  protected healHandlerWired = false;

  // Task cache to prevent duplicate processing.
  protected taskCache = new Set<string>();
  protected taskQueue: Task[] = [];

  protected stats: WorkerStats = {
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
    howtopronounceHits: 0,
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

    // Preserve the client that owns an already-claimed task. A rapid Stop ->
    // Start must wait until its terminal result has been posted before replacing
    // workerClient/config or touching the shared tab pool.
    while (this.polling || this.processing) {
      await waitForDelay(50);
    }

    this.config = this.normalizeConfig(config);

    logger.info(LOG, 'Starting service', this.config);

    // Match the howtopronounce pronunciation-source pool to the Bing tab
    // parallelism so the second mode keeps up with the per-word Bing lookups.
    howtopronouncePronunciationSource.setMaxTabs(this.config.tabCount);

    this.connectWorkerApi(this.config.apiUrl);

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
    this.subscribeRealtimeWake();
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
    const workerId = this.stats.workerId;

    if (!this.isRunning) {
      logger.warn(LOG, 'Service not running');
      return;
    }

    this.taskPolling.stop();
    this.heartbeatPolling.stop();
    this.fastRepollTimeout.cancel();

    this.taskCache.clear();
    this.taskQueue = [];
    // Clear outage state so a later Start never resumes wedged in a stale outage.
    this.inOutage = false;
    this.outageUntil = 0;
    this.outageProbeFails = 0;

    // Tabs are intentionally left open so the user keeps their Bing context.
    this.isRunning = false;
    this.stats.isOnline = false;
    this.unregisterWorkerPresence(workerId, (error) => {
      logger.warn(LOG, 'Worker unregister failed; heartbeat expiry remains active', error);
    });
    this.stats.queueTotal = 0;
    this.stats.newTasks = 0;
    this.stats.duplicateTasks = 0;
    this.stats.currentWord = null;
    this.stats.currentTaskId = null;
    this.stats.howtopronounceHits = 0;
    this.stats.tabActivity = [];

    // Close the parallel howtopronounce mode's tab pool (Bing pool tabs are left
    // open for the user; howtopronounce tabs are internal and best closed).
    howtopronouncePronunciationSource.stop().catch(() => undefined);

    // Clear persisted intent + disarm the watchdog so a later SW revival does
    // not auto-restart a service the user explicitly stopped.
    this.persistRuntime(false).catch(() => undefined);
    this.clearWatchdog().catch(() => undefined);
    // Stop owning any tabs for self-recovery (they're left open for the user).
    tabController.clearManagedTabs();

    logger.info(LOG, 'Service stopped');
  }

  /**
   * Force-clear the MV3 resurrection state (session run-intent + watchdog alarm)
   * regardless of the in-memory running flag, then stop if running. Called from
   * the Task Center stop path so the watchdog can NEVER resurrect the crawler
   * after a Stop/uncheck — even if the SW was terminated and the in-memory
   * isRunning=false while a stale session run-intent + armed alarm survive.
   */
  async stopAndClear(closeTabs = false): Promise<void> {
    if (this.isRunning) {
      // stop() already clears persisted intent + disarms the watchdog.
      this.stop();
    } else {
      await this.persistRuntime(false);
      await this.clearWatchdog();
    }
    if (this.wakeUnsubscribe) {
      this.wakeUnsubscribe();
      this.wakeUnsubscribe = null;
    }
    if (closeTabs) {
      await this.pool.closeAll();
      this.stats.activeTabs = 0;
      this.stats.tabActivity = [];
      tabController.clearManagedTabs();
    }
  }

  /** Report the current pool tab ids to the shared TabController (self-recovery). */
  protected syncManagedTabs(): void {
    tabController.registerManagedTabs(this.pool.ids);
  }

  /**
   * Register (once) the heal handler the TabController invokes when the USER
   * closes a plugin pool tab while no lookup is touching it. Reuses the pool's
   * close-first/bounded replace (never opens a heap), then re-syncs the managed
   * set to the fresh id. No-op while stopped (a closed tab is simply forgotten).
   */
  protected wireTabController(): void {
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
  protected isWorkerPaused(): boolean {
    return Date.now() < this.cooldownUntil || tabController.isPaused();
  }

  /**
   * Run fn while holding the single-foreground lock (only one slot's
   * activate+type+lookup at a time). The chain advances on settle (success OR
   * failure), so a throwing fn never deadlocks the next caller; the rejection is
   * propagated to THIS caller (runSlot's try/catch handles it).
   */
  protected runForeground<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.foregroundChain.then(fn, fn);
    this.foregroundChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
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
  protected async probeOneFreshTab(): Promise<boolean> {
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
   * Per-word tab activation: DEFAULT ON (so the user sees each word's tab brought
   * to the front + typed into, fully simulating a human). Safe because the
   * TabController interference-pause yields the browser back the moment the USER
   * switches tabs, and runSlot breaks out of the batch while paused. A user who
   * wants the old silent background-crawl sets bingActivatePerWord=false.
   */
  protected async readActivateFlag(): Promise<boolean> {
    try {
      const r = await chrome.storage.local.get(STORAGE_KEYS.BING_ACTIVATE_PER_WORD);
      return r[STORAGE_KEYS.BING_ACTIVATE_PER_WORD] !== false;
    } catch {
      return true;
    }
  }

  /**
   * Whether the parallel howtopronounce pronunciation mode is enabled. Default
   * ON - both modes (Bing + howtopronounce) consume each word's task data
   * simultaneously. The user can disable it from the popup to run Bing-only.
   */
  protected async readHowtopronounceEnabled(): Promise<boolean> {
    try {
      const r = await chrome.storage.local.get(STORAGE_KEYS.HOW_TO_PRONOUNCE_ENABLED);
      return r[STORAGE_KEYS.HOW_TO_PRONOUNCE_ENABLED] !== false;
    } catch {
      return true;
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
  protected normalizeConfig(raw: WorkerConfig, base?: Required<WorkerConfig>): Required<WorkerConfig> {
    const clamp = (n: number, lo: number, hi: number, fallback: number) =>
      Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
    const pollRaw =
      raw.pollInterval ?? (raw as any).fetchInterval ?? base?.pollInterval ?? TASK_CENTER_DEFAULTS.pollInterval;
    return {
      // Trim + strip trailing slashes so base + '/api/...' never double-slashes.
      apiUrl: (raw.apiUrl ?? base?.apiUrl ?? '').trim().replace(/\/+$/, ''),
      workerName: raw.workerName ?? base?.workerName ?? 'MCP Chrome Bing Translation Worker',
      pollInterval: clamp(Number(pollRaw), 1, 3600, TASK_CENTER_DEFAULTS.pollInterval),
      heartbeatInterval: clamp(
        Number(raw.heartbeatInterval ?? base?.heartbeatInterval ?? TASK_CENTER_DEFAULTS.heartbeatInterval),
        5,
        3600,
        TASK_CENTER_DEFAULTS.heartbeatInterval,
      ),
      batchSize: clamp(Number(raw.batchSize ?? base?.batchSize ?? TASK_CENTER_DEFAULTS.batchSize), 1, 50, TASK_CENTER_DEFAULTS.batchSize),
      tabCount: clamp(Number(raw.tabCount ?? base?.tabCount ?? 3), 1, MAX_BING_TABS, 3),
      sourceLanguage: (raw.sourceLanguage ?? base?.sourceLanguage ?? DEFAULT_SOURCE_LANG).trim().toLowerCase() || DEFAULT_SOURCE_LANG,
      targetLanguage: (raw.targetLanguage ?? base?.targetLanguage ?? DEFAULT_TARGET_LANG).trim().toLowerCase() || DEFAULT_TARGET_LANG,
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

    if (!this.isRunning) {
      this.config = next;
      logger.info(LOG, 'Config stored (service idle; applies on next start)');
      return;
    }

    // Re-point only between poll cycles. A task claimed from the old endpoint
    // must submit its terminal result to that same endpoint.
    const endpointChanged = !!next.apiUrl && (!prev || prev.apiUrl !== next.apiUrl);
    if (endpointChanged) {
      const previousClient = this.workerClient;
      this.reconfiguring = true;
      try {
        while (this.polling || this.processing) {
          await waitForDelay(50);
        }
        if (!this.isRunning) {
          this.config = next;
          return;
        }
        logger.info(LOG, `Endpoint changed live -> ${next.apiUrl}, re-registering`);
        this.config = next;
        this.connectWorkerApi(next.apiUrl);
        await this.registerWorker();
        this.subscribeRealtimeWake();
      } catch (error) {
        this.config = prev;
        this.replaceWorkerApi(previousClient);
        logger.error(LOG, 'Re-register after endpoint change failed', error);
        throw error;
      } finally {
        this.reconfiguring = false;
      }
    } else {
      this.config = next;
    }

    // Re-arm the poll loop on a new interval (no immediate extra poll).
    if (!prev || prev.pollInterval !== next.pollInterval) {
      this.taskPolling.restart(() => {
        this.pollAndProcessTasks().catch((e) => logger.warn(LOG, 'Poll error', e));
      }, next.pollInterval * 1000);
      logger.info(LOG, `Poll interval -> ${next.pollInterval}s (live)`);
    }

    // Re-arm the heartbeat on a new interval.
    if (!prev || prev.heartbeatInterval !== next.heartbeatInterval) {
      this.heartbeatPolling.restart(
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

    // Run-intent gate (single source of truth): NEVER resurrect the crawler
    // unless the Task Center run-intent says assist is running and an active
    // central capability owns the Bing processor. This stops the watchdog from
    // resurrecting Bing after the merged switch is disabled.
    if (!(await isProcessorActive(LANES.BING_DICTIONARY))) {
      await this.clearWatchdog();
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

  protected async persistRuntime(running: boolean): Promise<void> {
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

  protected async ensureWatchdog(): Promise<void> {
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

  protected async clearWatchdog(): Promise<void> {
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

  protected async registerWorker(): Promise<void> {
    if (!this.workerClient || !this.config) {
      throw new Error('Worker client not initialized');
    }

    const workerId = `mcp-chrome-bing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const response = await this.registerWorkerPresence({
      worker_id: workerId,
      worker_name: this.config.workerName,
      // This Chrome service owns Bing translation work. Pycore independently
      // claims other eligible translation tasks from Laravel. Pronunciation capture remains
      // part of each dictionary lookup and the Extension diagnostic tools, while
      // dedicated audio-generation tasks are owned by the shared Qwen TTS worker.
      processor_types: [
        LANES.REMOTE_CLIENT,
        LANES.REMOTE_TRANSLATION,
        LANES.REMOTE_FAST,
      ] as ProcessorType[],
      // Advertise ONLY 'translate' (B18: Bing is the Chrome translate claimant;
      // WebAiTranslate owns Chrome ai_translate, while Pycore remains an independent
      // claimant declared in the central contract). 'image' is no longer in the
      // shared fast set (B17) — a Bing dictionary tab can scrape a word lookup but
      // cannot GENERATE an image, so the dispatcher must never route a true image
      // task here. The processTask capability guard still rejects any image task
      // that somehow slips through. (sentence_audio is generated inline
      // server-side, never by a Bing tab; ai_translate belongs only to the web-AI
      // worker.)
      capabilities: [TASK_CAPABILITY_BY_ROLE.translate],
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

  protected async heartbeatOnce(): Promise<void> {
    if (!this.workerClient) return;
    try {
      await this.heartbeatWorkerPresence();
      this.stats.isOnline = true;
    } catch (error) {
      logger.error(LOG, 'Heartbeat failed', error);
      this.stats.isOnline = false;
    }
  }

  protected startHeartbeat(): void {
    if (!this.workerClient || !this.config) return;
    this.heartbeatOnce();
    this.heartbeatPolling.start(
      () => this.heartbeatOnce(),
      this.config.heartbeatInterval * 1000,
    );
  }

  protected startPolling(): void {
    if (!this.config) return;

    const poll = async () => {
      await this.pollAndProcessTasks();
    };

    poll();
    this.taskPolling.start(() => void poll(), this.config.pollInterval * 1000);
  }

  protected abstract pollAndProcessTasks(): Promise<void>;
}

