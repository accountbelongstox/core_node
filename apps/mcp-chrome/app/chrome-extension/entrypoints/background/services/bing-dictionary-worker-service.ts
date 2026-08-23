import { WorkerApiClient, Task } from '../api/WorkerApiClient';
import { bingDictionaryTool, BingDictionaryResult } from '../tools/browser/bing-dictionary';
import { logger } from '@/utils/logger';
import { isRecoverableTabError } from './bing-tab-pool';
import { DIFF_DELIVERY, TASK_CAPABILITY_BY_ROLE, TASK_STATUS_BY_ROLE, TASK_TYPE_KEYS } from '@/utils/queue-center-contract';
import { classify, buildEntry, type ResultEntry } from './bing-result';
import { type NormalizedWord } from '@/utils/task-words';
import { howtopronouncePronunciationSource } from './howtopronounce-pronunciation-source';
import { runScrapeTest, type ScrapeTestResult } from './bing-worker-ops';
import { initBingWorkerLifecycle as _initLifecycle } from './bing-worker-lifecycle';
import { DEFAULT_SOURCE_LANG, DEFAULT_TARGET_LANG } from '@/utils/task-center-types';
import { delay as waitForDelay } from '@/utils/async';
import { tabController } from './tab-controller';
import { queueCenterWakeService } from './task-center/QueueCenterWakeService';
import {
  BingDictionaryWorkerRuntimeBase,
  LOG, NONDICT_ATTEMPTS, ANTISCRAPE_ABORT_THRESHOLD, ANTISCRAPE_COOLDOWN_MS,
  OUTAGE_PAUSE_MS, OUTAGE_MAX_PROBES, LONG_OUTAGE_PAUSE_MS,
  LOOKUP_DELAY_BASE_MS, LOOKUP_DELAY_JITTER_MS,
  FAST_REPOLL_BASE_MS, FAST_REPOLL_JITTER_MS, IDLE_DISCARD_MS,
  DICTIONARY_TASK_TYPES, HANDLED_TASK_TYPES,
  type WorkerConfig,
} from './bing-dictionary-worker-runtime';

export type { WorkerConfig, WorkerStats } from './bing-dictionary-worker-runtime';
export const initBingWorkerLifecycle = () => _initLifecycle(() => bingDictionaryWorkerService.resume());

class BingDictionaryWorkerService extends BingDictionaryWorkerRuntimeBase {
  protected async pollAndProcessTasks(): Promise<void> {
    if (this.polling || this.reconfiguring) return;
    this.polling = true;
    try {
      await this.pollAndProcessTasksInner();
    } finally {
      this.polling = false;
    }
  }

  private async pollAndProcessTasksInner(): Promise<void> {
    if (!this.workerClient || !this.config) return;

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
        if (this.outageProbeFails === OUTAGE_MAX_PROBES) {
          // Long-term all-tabs-dead: the closest an extension can do to a
          // "browser restart" — DEEP RESET (close ALL pool tabs so the next probe
          // opens brand-new ones) + a long 5-min backoff. We do NOT give up and do
          // NOT chrome.runtime.reload (that only reloads the extension and wipes
          // the run-intent). We keep probing on the long interval; when Bing
          // recovers the next probe succeeds and the crawl continues directly.
          await this.pool.closeAll();
          this.syncManagedTabs();
          logger.warn(
            LOG,
            `Bing unreachable after ${OUTAGE_MAX_PROBES} fresh-tab probes — deep reset ` +
              `(closed all pool tabs; a Chrome extension cannot restart the browser). ` +
              `Backing off ${LONG_OUTAGE_PAUSE_MS / 60000}min and continuing to probe.`,
          );
        }
        // Keep probing indefinitely: 30s while under the cap, then the long
        // interval after the deep reset (never exit outage — that would just pull
        // a batch straight back into the outage).
        const interval =
          this.outageProbeFails >= OUTAGE_MAX_PROBES ? LONG_OUTAGE_PAUSE_MS : OUTAGE_PAUSE_MS;
        this.outageUntil = Date.now() + interval;
        logger.warn(
          LOG,
          `Bing still in outage on fresh-tab probe (#${this.outageProbeFails}) — re-pausing ${interval / 1000}s`,
        );
        return;
      }
    }

    try {
      this.stats.lastRun = Date.now();

      const response = await this.pullTasksAcrossTypes({
        limit: this.config.batchSize,
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

      // B3: react to the fast-tier backlog signal — schedule a jittered
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
    if (this.fastRepollTimeout.isScheduled) return; // coalesce — one burst in flight
    const jitter = Math.floor(Math.random() * FAST_REPOLL_JITTER_MS);
    this.fastRepollTimeout.schedule(() => {
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

  /**
   * Pull across the dictionary/translate task types via the typed pull route
   * (/api/worker/tasks/{taskType}/pull). word_translation LAST: the
   * routes. Each type is queried immediately so no Laravel request worker is
   * retained while the browser waits for work.
   */
  private async pullTasksAcrossTypes(options: { limit: number }) {
    const types = [
      TASK_TYPE_KEYS.dictionary_explanation,
      TASK_TYPE_KEYS.dictionary_explanation_demo,
      TASK_TYPE_KEYS.word_translation,
    ];
    const merged: Task[] = [];
    let lastData: any = { count: 0, pending_urgent: 0, pending_fast: 0, tasks: [] as Task[] };
    for (let i = 0; i < types.length; i++) {
      const resp = await this.workerClient!.pullTasks(types[i], undefined, {
        limit: options.limit,
      });
      if (!resp.success || !resp.data) return resp;
      lastData = resp.data;
      if (Array.isArray(resp.data.tasks)) merged.push(...resp.data.tasks);
      if (merged.length >= options.limit) break;
    }
    return { success: true, data: { ...lastData, tasks: merged, count: merged.length } };
  }

  private subscribeRealtimeWake(): void {
    if (!this.config) return;
    if (this.wakeUnsubscribe) this.wakeUnsubscribe();
    this.wakeUnsubscribe = queueCenterWakeService.subscribe(
      this.config.apiUrl,
      () => this.scheduleFastRepoll(),
    );
  }

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
    if (task.capability === TASK_CAPABILITY_BY_ROLE.image || !HANDLED_TASK_TYPES.has(task.task_type)) {
      const reason = `unhandled task_type/capability: task_type=${task.task_type} capability=${task.capability ?? 'none'}`;
      logger.warn(LOG, `Releasing task ${task.task_id} — ${reason}`);
      try {
        await this.workerClient.submitResult(task.task_type, {
          task_id: task.task_id,
          worker_id: workerId,
          status: TASK_STATUS_BY_ROLE.failed,
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

      await this.workerClient.acceptTask(task.task_type, task.task_id);
      await this.workerClient.submitResult(task.task_type, {
        task_id: task.task_id,
        worker_id: workerId,
        status: TASK_STATUS_BY_ROLE.processing,
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
          // Yield to the user MID-BATCH: if a human is switching tabs (or any
          // pause is in effect), stop this batch's per-word foregrounding
          // immediately — don't keep yanking OS focus until the next poll tick.
          // This is the safety that makes default-on activation acceptable.
          if (this.isWorkerPaused()) break;
          const i = nextIndex++;
          if (i >= total) break;
          const w = words[i];
          this.stats.currentWord = w.word;
          this.setSlotWord(slot, tabId, w.word);

          // ONE word's human input is a single foreground-locked unit: bring the
          // tab to front (default ON) + CONFIRM active + type + click-search +
          // that word's lookup, all under runForeground so NO other slot can
          // steal the foreground mid-typing (fixes flicker / mid-type-switch /
          // two-tabs-same-word). Activation is skipped while paused (yield to the
          // user) and recorded by TabController so it's never read as a human
          // switch. The lock is RELEASED before media capture + the random gap.
          const doLookup = async () => {
            if (activatePerWord && !tabController.isPaused()) {
              await tabController.activate(tabId);
            }
            return this.lookupHealing(tabId, w.word);
          };

          try {
            // Heal a dead/discarded tab transparently and keep the fresh id.
            let looked = activatePerWord
              ? await this.runForeground(doLookup)
              : await doLookup();
            tabId = looked.tabId;
            this.setSlotWord(slot, tabId, w.word);
            let data = looked.data;
            let classification = classify(data);

            // Region/redirect ('non-dict') pages are often transient — retry the
            // word a few times before giving up, so a momentary redirect doesn't
            // get mistaken for a persistent region-redirect failure. Each retry
            // re-acquires the foreground lock (it re-types the word).
            let attempt = 1;
            while (
              classification.kind === 'error' &&
              !!data &&
              data.pageType === 'non-dict' &&
              !data.outage && // an outage page won't clear by retrying — don't
              attempt < NONDICT_ATTEMPTS
            ) {
              attempt++;
              looked = activatePerWord ? await this.runForeground(doLookup) : await doLookup();
              tabId = looked.tabId;
              data = looked.data;
              classification = classify(data);
            }

            // Full-load barrier for EVERY word (valid / invalid / error): never
            // advance to the next word while this tab is still loading/spinning.
            // (Defensive against a late async redirect after extract returned;
            // the lookup itself already waited for its own navigation.)
            await bingDictionaryTool.waitForTabIdle(tabId);

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
              .submitResult(task.task_type, {
                task_id: task.task_id,
                worker_id: workerId,
                status: TASK_STATUS_BY_ROLE.processing,
                progress,
              })
              .catch(() => undefined);
          }

          // Human-paced random gap before this slot grabs the next word, so the
          // worker never hammers Bing at a fixed cadence. Skipped when aborting
          // (anti-scrape / outage) or when no words remain for this slot.
          if (!aborted && !outageDetected && nextIndex < total) {
            const gap = LOOKUP_DELAY_BASE_MS + Math.floor(Math.random() * LOOKUP_DELAY_JITTER_MS);
            await waitForDelay(gap);
          }
        }
        // Slot drained — mark it idle.
        this.setSlotWord(slot, tabId, null);
      };

      await Promise.all(tabIds.map((tabId, slot) => runSlot(tabId, slot)));

      // An audio-only task is complete only when real MP3 bytes were captured.
      // Do not let a translation-only Bing result mark a still-missing audio
      // row complete; retain invalid-word verdicts, but re-pend valid misses.
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
          await this.workerClient.submitResult(task.task_type, {
            task_id: task.task_id,
            worker_id: workerId,
            status: TASK_STATUS_BY_ROLE.completed,
            progress: 100,
            result: {
              target_language: targetLanguage,
              provider: 'bing',
              translations,
              words: DICTIONARY_TASK_TYPES.has(task.task_type) ? translations : undefined,
              invalid_words: invalidWords,
              region_redirect_words: [],
            },
          });
        } else {
          await this.workerClient.submitResult(task.task_type, {
            task_id: task.task_id,
            worker_id: workerId,
            status: TASK_STATUS_BY_ROLE.failed,
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
        await this.workerClient.submitResult(task.task_type, {
          task_id: task.task_id,
          worker_id: workerId,
          status: TASK_STATUS_BY_ROLE.failed,
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

      const submitResp = await this.workerClient.submitResult(task.task_type, {
        task_id: task.task_id,
        worker_id: workerId,
        status: TASK_STATUS_BY_ROLE.completed,
        progress: 100,
        result: {
          target_language: targetLanguage,
          provider: 'bing',
          translations,
          words: DICTIONARY_TASK_TYPES.has(task.task_type) ? translations : undefined,
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
        await this.workerClient.submitResult(task.task_type, {
          task_id: task.task_id,
          worker_id: workerId,
          status: TASK_STATUS_BY_ROLE.failed,
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
    language: string = DEFAULT_SOURCE_LANG,
    targetLanguage?: string,
  ): Promise<{ ok: boolean; summary?: any; items?: any[]; pagination?: any; message?: string }> {
    const base = (apiUrl || this.config?.apiUrl || '').trim().replace(/\/+$/, '');
    if (!base) return { ok: false, message: 'No endpoint configured in Settings' };
    const target = targetLanguage || this.config?.targetLanguage || DEFAULT_TARGET_LANG;
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
        limit: DIFF_DELIVERY.data_segment_limit,
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

// initBingWorkerLifecycle is re-exported at the top of this file (bound to the
// singleton's resume() method) from bing-worker-lifecycle.ts.
