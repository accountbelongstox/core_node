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
import { mediaCache } from '@/utils/media-cache';
import { logger } from '@/utils/logger';
import { BingTabPool, MAX_BING_TABS } from './bing-tab-pool';
import { CHROME_FAST_CAPABILITIES } from './task-center/SimpleWorkerBase';

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

interface NormalizedWord {
  word: string;
  md5?: string;
}

interface ResultEntry {
  word: string;
  md5?: string;
  translation: string;
  phonetic?: string;
  us_phonetic?: string;
  uk_phonetic?: string;
  image_urls?: string[];
  audio_base64?: string;
  audio_mime?: string;
  provider: string;
}

const NO_RESULT_ERROR = 'No results found for this word';
// How many times to re-attempt a word that lands on a non-dict (region/redirect)
// page before treating it as a persistent region-redirect failure. The helper
// already reloads the dict home once per attempt, so this is attempts-of-attempts.
const NONDICT_ATTEMPTS = 3;

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

    this.config = {
      // Normalize: trim + strip trailing slashes so base + '/api/...' never
      // produces a double slash.
      apiUrl: config.apiUrl.trim().replace(/\/+$/, ''),
      workerName: config.workerName || 'MCP Chrome Bing Translation Worker',
      pollInterval: config.pollInterval ?? 5,
      heartbeatInterval: config.heartbeatInterval ?? 60,
      batchSize: config.batchSize ?? 5,
      tabCount: Math.max(1, Math.min(MAX_BING_TABS, config.tabCount ?? 3)),
      sourceLanguage: config.sourceLanguage || 'en',
      targetLanguage: config.targetLanguage || 'zh',
    };

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
    if (surface) {
      await this.pool.ensure(this.config.tabCount, true);
      this.stats.activeTabs = this.pool.size;
    }

    this.startHeartbeat();
    this.startPolling();

    this.isRunning = true;
    // Begin the idle-discard countdown from Start so unused pool tabs are freed.
    this.lastActivityAt = Date.now();
    this.poolDiscarded = false;

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

    logger.info(LOG, 'Service stopped');
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

  private startHeartbeat(): void {
    if (!this.workerClient || !this.config) return;

    const sendHeartbeat = async () => {
      try {
        await this.workerClient!.heartbeat();
        this.stats.isOnline = true;
      } catch (error) {
        logger.error(LOG, 'Heartbeat failed', error);
        this.stats.isOnline = false;
      }
    };

    sendHeartbeat();
    this.heartbeatIntervalId = setInterval(sendHeartbeat, this.config.heartbeatInterval * 1000);
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
      const words = this.normalizeWords(rawWords as any);
      if (words.length === 0) {
        throw new Error('No words in task payload');
      }

      // Reuse the existing pool without stealing focus (surface=false).
      const tabIds = await this.pool.ensure(this.config.tabCount, false);
      this.stats.activeTabs = this.pool.size;
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

      const runSlot = async (initialTabId: number, slot: number): Promise<void> => {
        let tabId = initialTabId;
        while (true) {
          const i = nextIndex++;
          if (i >= total) break;
          const w = words[i];
          this.stats.currentWord = w.word;
          this.setSlotWord(slot, tabId, w.word);

          try {
            // Heal a dead/discarded tab transparently and keep the fresh id.
            let looked = await this.lookupHealing(tabId, w.word);
            tabId = looked.tabId;
            this.setSlotWord(slot, tabId, w.word);
            let data = looked.data;
            let classification = this.classify(data);

            // Region/redirect ('non-dict') pages are often transient — retry the
            // word a few times before giving up, so a momentary redirect doesn't
            // get mistaken for a persistent region-redirect failure.
            let attempt = 1;
            while (
              classification.kind === 'error' &&
              !!data &&
              data.pageType === 'non-dict' &&
              attempt < NONDICT_ATTEMPTS
            ) {
              attempt++;
              looked = await this.lookupHealing(tabId, w.word);
              tabId = looked.tabId;
              data = looked.data;
              classification = this.classify(data);
            }

            // Detailed per-word trace for the DEBUG center: shows exactly why a
            // word resolved the way it did (so INVALID vs FAILED is visible).
            logger.info(
              LOG,
              `"${w.word}" -> ${classification.kind.toUpperCase()} (${classification.reason}) ` +
                `[pageType=${data?.pageType ?? '?'} noEntry=${data?.noEntry ?? '?'} ` +
                `hasContent=${data?.hasContent ?? '?'} attempts=${attempt}]`,
            );

            if (classification.kind === 'translated') {
              translations.push(await this.buildEntry(w, data));
              this.stats.translated++;
            } else if (classification.kind === 'invalid') {
              invalidWords.push(w);
              this.stats.invalid++;
              logger.info(
                LOG,
                `"${w.word}" is INVALID (no Bing entry) — reporting to backend as invalid, NOT a failure`,
              );
            } else {
              this.stats.failed++;
              // Persistent non-dict after retries: a region/redirect failure. Hold
              // it aside — it is only promoted to invalid if the batch was
              // otherwise healthy (outage guard below).
              if (data && data.pageType === 'non-dict') {
                nonDictWords.push(w);
              }
              logger.warn(
                LOG,
                `"${w.word}" FAILED transiently (${classification.reason}) — will retry/re-pend, NOT marked invalid`,
              );
            }
          } catch (error) {
            logger.error(LOG, `Failed to translate ${w.word}`, error);
            this.stats.failed++;
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
        }
        // Slot drained — mark it idle.
        this.setSlotWord(slot, tabId, null);
      };

      await Promise.all(tabIds.map((tabId, slot) => runSlot(tabId, slot)));

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
          // Persistent region/redirect words — backend marks is_valid=false with
          // validity_source='region-redirect' so they stop being re-queued.
          region_redirect_words: regionRedirectWords,
        },
      });

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
      if (!this.isDeadTabError(error)) throw error;
      logger.warn(LOG, `Tab ${tabId} vanished, replacing and retrying "${word}"`);
      const fresh = await this.pool.replace(tabId);
      this.stats.activeTabs = this.pool.size;
      const data = await bingDictionaryTool.lookupInTab(fresh, word, includeMedia);
      return { data, tabId: fresh };
    }
  }

  /**
   * A tab the pool was driving no longer exists — Chrome throws
   * "No tab with id: N" (and the inject path wraps it as a content-script
   * injection failure). These are recoverable by replacing the tab.
   */
  private isDeadTabError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return /No tab with id|Failed to inject content script|No frame with id|Frame with id/i.test(
      msg,
    );
  }

  /**
   * Decide what a single Bing lookup result means for the backend, with a
   * human-readable reason for the DEBUG-center trace.
   *
   * invalid  = a definitive "Bing has no entry for this word" — reported to
   *            Laravel via invalid_words[] (is_valid=false), NEVER a failure.
   * error    = a transient miss (region redirect / web fallback / load fail) —
   *            re-pended and retried; must NOT invalidate the word.
   */
  private classify(
    data: BingDictionaryResult | null,
  ): { kind: 'translated' | 'invalid' | 'error'; reason: string } {
    if (!data) {
      return { kind: 'error', reason: 'no data returned from page' };
    }

    const hasContent =
      data.hasContent === true ||
      (data.hasContent === undefined &&
        ((data.translations?.length ?? 0) > 0 ||
          (data.phonetics?.length ?? 0) > 0 ||
          (data.sampleImages?.length ?? 0) > 0));

    if (data.success && hasContent) {
      return { kind: 'translated', reason: 'dictionary content found' };
    }

    // A CONFIRMED "No results found for <word>" page (keyword: "No results") is a
    // definitive no-entry — the word is invalid regardless of the dict-page
    // heuristic. The backend marks it is_valid=false and keeps it as a
    // placeholder so it is never re-queued.
    if (data.success && data.noEntry) {
      return { kind: 'invalid', reason: 'confirmed Bing "No results" page' };
    }

    // SAFETY: otherwise only a CONFIRMED dictionary page with no entry means the
    // word is genuinely invalid. A non-dict page (region redirect, web-search
    // fallback, load failure) must NOT invalidate the word — otherwise a regional
    // Bing outage would mass-flag the whole queue. Those are transient.
    const isDictPage = data.pageType === undefined || data.pageType === 'dict';
    if (isDictPage && data.success && (data.error === NO_RESULT_ERROR || !hasContent)) {
      return { kind: 'invalid', reason: 'dictionary page with no entry' };
    }

    const reason =
      data.pageType === 'non-dict'
        ? `non-dict/region-redirect page${data.error ? ` (${data.error})` : ''}`
        : data.error || 'no usable result';
    return { kind: 'error', reason };
  }

  /** Build the rich result entry (incl. downloaded audio) for one word. */
  private async buildEntry(w: NormalizedWord, data: BingDictionaryResult): Promise<ResultEntry> {
    const formatted = this.formatExplanation(data);

    const entry: ResultEntry = {
      word: w.word,
      translation: formatted.text,
      provider: 'bing',
    };
    if (w.md5) entry.md5 = w.md5;
    if (formatted.phonetic) entry.phonetic = formatted.phonetic;
    if (formatted.us_phonetic) entry.us_phonetic = formatted.us_phonetic;
    if (formatted.uk_phonetic) entry.uk_phonetic = formatted.uk_phonetic;

    const images = (data.sampleImages || [])
      .map((s) => s.url)
      .filter((u): u is string => typeof u === 'string' && u !== '')
      .slice(0, 6);
    if (images.length > 0) {
      entry.image_urls = images;
    }

    const audioUrl = this.pickAudioUrl(data);
    if (audioUrl) {
      const audioBase64 = await this.downloadAudioBase64(audioUrl);
      if (audioBase64) {
        entry.audio_base64 = audioBase64;
        entry.audio_mime = 'audio/mpeg';
      }
    }

    return entry;
  }

  /** Prefer the US pronunciation, else the first phonetic/voice URL available. */
  private pickAudioUrl(data: BingDictionaryResult): string | null {
    const phonetics = data.phonetics || [];
    // Prefer the in-page base64 capture (data URL) so playback never re-requests
    // the remote mp3 (which can fail from the popup context).
    const us = phonetics.find(
      (p) => (p.audioDataUrl || p.audioUrl) && p.lang && p.lang.includes('US'),
    );
    if (us) return us.audioDataUrl || us.audioUrl;

    const any = phonetics.find((p) => p.audioDataUrl || p.audioUrl);
    if (any) return any.audioDataUrl || any.audioUrl;

    return data.voiceUrls && data.voiceUrls.length > 0 ? data.voiceUrls[0] : null;
  }

  private async downloadAudioBase64(url: string): Promise<string | null> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const buf = await resp.arrayBuffer();
      if (!buf || buf.byteLength < 100) return null;
      return this.arrayBufferToBase64(buf);
    } catch (error) {
      logger.warn(LOG, 'Audio download failed', { url, error: String(error) });
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return btoa(binary);
  }

  private formatExplanation(data: BingDictionaryResult): {
    text: string;
    phonetic?: string;
    us_phonetic?: string;
    uk_phonetic?: string;
  } {
    const parts: string[] = [];
    // Short definitions (part of speech + gloss).
    if (data.translations && data.translations.length > 0) {
      data.translations.forEach((trans) => {
        const pos = trans.partOfSpeech ? `${trans.partOfSpeech}. ` : '';
        parts.push(`${pos}${trans.definition}`.trim());
      });
    }
    // Detailed Collins/Oxford definitions (Chinese gloss + English explanation).
    if (data.detailedDefinitions && data.detailedDefinitions.length > 0) {
      data.detailedDefinitions.forEach((d, i) => {
        const en = d.en ? ` — ${d.en}` : '';
        const line = `${i + 1}. ${d.cn}${en}`.trim();
        if (line) parts.push(line);
      });
    }
    // Web definitions (.df_div advanced blocks); the type label comes from the page.
    if (data.advancedTranslations && data.advancedTranslations.length > 0) {
      data.advancedTranslations.forEach((a) => {
        if (a.content) parts.push(`[${a.type}] ${a.content}`.trim());
      });
    }
    // Synonyms / antonyms.
    if (data.synonyms && data.synonyms.length > 0) {
      data.synonyms.forEach((s) => {
        if (s.words) parts.push(`[${s.type}] ${s.words}`.trim());
      });
    }
    // Example sentences (English + Chinese).
    if (data.examples && data.examples.length > 0) {
      data.examples.forEach((ex) => {
        parts.push(`• ${ex.en}${ex.cn ? '  ' + ex.cn : ''}`.trim());
      });
    }

    let phonetic = '';
    let usPhonetic = '';
    let ukPhonetic = '';
    if (data.phonetics && data.phonetics.length > 0) {
      data.phonetics.forEach((p) => {
        const lang = p.lang || '';
        if (lang.includes('US')) {
          usPhonetic = p.text;
        } else if (lang.includes('GB') || lang.includes('UK')) {
          // The helper labels UK pronunciation as 'en-GB' (not 'UK').
          ukPhonetic = p.text;
        } else if (!phonetic) {
          phonetic = p.text;
        }
      });
    }

    return {
      text: parts.join('\n'),
      phonetic: phonetic || usPhonetic || ukPhonetic || undefined,
      us_phonetic: usPhonetic || undefined,
      uk_phonetic: ukPhonetic || undefined,
    };
  }

  /** Payload words may be plain strings or {word, md5, ...} objects. */
  private normalizeWords(raw: Task['payload']['words']): NormalizedWord[] {
    if (!Array.isArray(raw)) return [];
    const out: NormalizedWord[] = [];
    for (const item of raw as any[]) {
      if (typeof item === 'string') {
        const word = item.trim();
        if (word) out.push({ word });
      } else if (item && typeof item.word === 'string') {
        const word = item.word.trim();
        if (word) out.push({ word, md5: item.md5 });
      }
    }
    return out;
  }

  /**
   * Ad-hoc Bing scrape test driven from the popup. Scrapes the given word(s)
   * live across the configured parallel tab pool WITHOUT pulling from or posting
   * to the backend, and returns a compact per-word result for display. Lets the
   * user validate the Bing extraction + parallelism before assisting for real.
   */
  async testScrape(
    rawWords: string[],
    tabCount?: number,
  ): Promise<
    Array<{
      word: string;
      ok: boolean;
      invalid?: boolean;
      translation?: string;
      phonetic?: string;
      usPhonetic?: string;
      ukPhonetic?: string;
      definitions?: Array<{ partOfSpeech: string; definition: string }>;
      detailedDefinitions?: Array<{ cn: string; en: string }>;
      examples?: Array<{ en: string; cn: string }>;
      synonyms?: Array<{ type: string; words: string }>;
      webDefinitions?: Array<{ type: string; content: string }>;
      images?: number;
      audio?: boolean;
      audioUrl?: string;
      usAudioUrl?: string;
      ukAudioUrl?: string;
      imageUrls?: string[];
      // Debug: what was captured in-page as binary and cached (the cache "paths"
      // are the original remote URLs, which double as the cache keys).
      media?: Array<{ url: string; kind: 'image' | 'audio'; mime: string | null; bytes: number; cached: boolean }>;
      error?: string;
    }>
  > {
    const words = this.normalizeWords(rawWords as any);
    if (words.length === 0) return [];

    // Parallelism only helps with many words. Never open more tabs than there
    // are words to test — a single-word test must use exactly ONE tab, not the
    // configured max. (The configured tabCount only caps the upper bound.)
    const want = Math.min(words.length, tabCount ?? this.config?.tabCount ?? 3);
    const tabIds = await this.pool.ensure(want, true);
    this.stats.activeTabs = this.pool.size;
    const results: Array<any> = [];
    let nextIndex = 0;

    const runSlot = async (initialTabId: number): Promise<void> => {
      let tabId = initialTabId;
      while (true) {
        const i = nextIndex++;
        if (i >= words.length) break;
        const w = words[i];
        this.stats.currentWord = w.word;
        try {
          // Extraction returns URLs only; the binaries are fetched in-page by the
          // injected BingMediaFetcher class library (includeMedia=false here).
          // Heal a dead/discarded tab transparently and keep the fresh id.
          const looked = await this.lookupHealing(tabId, w.word, false);
          tabId = looked.tabId;
          const data = looked.data;
          const classification = this.classify(data).kind;
          if (classification === 'translated' && data) {
            const formatted = this.formatExplanation(data);

            // Identify the US/UK pronunciation tracks (Bing labels UK 'en-GB').
            const phonetics = data.phonetics || [];
            const usP = phonetics.find((p: any) => p.lang && p.lang.includes('US'));
            const ukP = phonetics.find(
              (p: any) => p.lang && (p.lang.includes('GB') || p.lang.includes('UK')),
            );
            const usAudioRemote = (usP && usP.audioUrl) || undefined;
            const ukAudioRemote = (ukP && ukP.audioUrl) || undefined;
            const imageRemote = (data.sampleImages || [])
              .map((s: any) => s.url)
              .filter(Boolean)
              .slice(0, 6);

            // Persistent local cache: load it, then ONLY fetch what we don't
            // already have stored locally (a word looked up before is served
            // from chrome.storage.local without re-downloading). Binaries are
            // captured IN the page as raw bytes; we NEVER request the remote
            // *.bing.net / mediamp3 URL directly (it isn't accessible from here).
            await mediaCache.init();
            const allMedia = [...imageRemote, usAudioRemote, ukAudioRemote].filter(
              (u): u is string => typeof u === 'string' && u.length > 0,
            );
            const toFetch = allMedia.filter((u) => !mediaCache.has(u));
            const captured = toFetch.length
              ? await bingDictionaryTool.fetchMediaInTab(tabId, toFetch)
              : [];
            for (const m of captured) {
              if (m.ok && m.bytes && m.bytes.length) {
                mediaCache.put(m.url, m.bytes, m.mime || undefined);
              }
            }

            // Debug: report every media URL with its local-cache status + size
            // (the URL is the cache key; the bytes live in chrome.storage.local).
            const debugMedia = allMedia.map((u) => {
              const e = mediaCache.get(u);
              return {
                url: u,
                kind: (u === usAudioRemote || u === ukAudioRemote ? 'audio' : 'image') as
                  | 'audio'
                  | 'image',
                mime: e ? e.mime : null,
                bytes: e ? e.len : 0,
                cached: !!e,
              };
            });

            // Build data URLs from the cached BYTES (no remote re-request, no
            // remote-URL fallback — a missed capture simply yields nothing).
            const fromCache = (u?: string) => (u ? mediaCache.toDataUrl(u) || undefined : undefined);
            const imageUrls = imageRemote
              .map((u: string) => fromCache(u))
              .filter((u): u is string => !!u)
              .slice(0, 6);
            const usAudioUrl = fromCache(usAudioRemote);
            const ukAudioUrl = fromCache(ukAudioRemote);
            const audioUrl = usAudioUrl || ukAudioUrl;

            results.push({
              word: w.word,
              ok: true,
              translation: formatted.text,
              phonetic:
                formatted.phonetic || formatted.us_phonetic || formatted.uk_phonetic || '',
              usPhonetic: formatted.us_phonetic,
              ukPhonetic: formatted.uk_phonetic,
              definitions: data.translations,
              detailedDefinitions: data.detailedDefinitions,
              examples: data.examples,
              synonyms: data.synonyms,
              webDefinitions: data.advancedTranslations,
              images: imageUrls.length,
              audio: !!(usAudioUrl || ukAudioUrl),
              audioUrl,
              usAudioUrl,
              ukAudioUrl,
              imageUrls,
              media: debugMedia,
            });
          } else if (classification === 'invalid') {
            results.push({ word: w.word, ok: false, invalid: true, error: 'No Bing entry' });
          } else {
            results.push({ word: w.word, ok: false, error: 'Lookup failed (transient)' });
          }
        } catch (error: any) {
          results.push({ word: w.word, ok: false, error: error?.message || 'Error' });
        }
      }
    };

    await Promise.all(tabIds.map((tabId) => runSlot(tabId)));
    this.stats.currentWord = null;

    // Preserve the user's input order.
    const order = new Map(words.map((w, i) => [w.word, i]));
    results.sort((a, b) => (order.get(a.word) ?? 0) - (order.get(b.word) ?? 0));
    return results;
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
