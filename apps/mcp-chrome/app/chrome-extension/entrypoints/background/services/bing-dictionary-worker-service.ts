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

export interface WorkerConfig {
  apiUrl: string;
  workerName?: string;
  pollInterval?: number;
  heartbeatInterval?: number;
  batchSize?: number;
  /** Number of Bing dictionary tabs to drive in parallel. */
  tabCount?: number;
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

const MAX_TABS = 8;
const NO_RESULT_ERROR = 'No results found for this word';
// Title of the tab group the pool tabs are collected under, so a multi-tab pool
// does not clutter the tab strip (chrome.tabs.group + chrome.tabGroups.update).
const TAB_GROUP_TITLE = 'Bing Assist';

// MV3 service workers are terminated after ~30s idle and lose all globals +
// setInterval timers (https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
// We persist the "assisting" intent and reuse a chrome.alarms watchdog to
// resurrect the worker after the SW (or the whole browser) restarts.
const RUNTIME_STORAGE_KEY = 'bing_worker_runtime';
const WATCHDOG_ALARM = 'bing-translation-worker-watchdog';
// 1 min: above the 30s production floor, frequent enough to recover quickly.
const WATCHDOG_PERIOD_MINUTES = 1;

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

  // Pool of Bing dictionary tab ids driven in parallel.
  private tabIds: number[] = [];

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
  };

  // Id of the collapsed "Bing Assist" tab group holding the pool tabs.
  private tabGroupId: number | null = null;

  async start(config: WorkerConfig): Promise<void> {
    if (this.isRunning) {
      console.warn('[Bing Worker] Service already running');
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
      tabCount: Math.max(1, Math.min(MAX_TABS, config.tabCount ?? 3)),
      targetLanguage: config.targetLanguage || 'zh',
    };

    console.log('[Bing Worker] Starting service with config:', this.config);

    this.workerClient = new WorkerApiClient(this.config.apiUrl);

    await this.registerWorker();

    // Open/reuse the Bing dictionary tab pool up front. focus=true here is the
    // ONE place we surface Bing to the user (they just clicked Start); per-task
    // ensureTabs(false) calls never steal focus afterwards.
    await this.ensureTabs(true);

    this.startHeartbeat();
    this.startPolling();

    this.isRunning = true;

    // Persist intent + arm the watchdog so the worker survives SW termination
    // and browser restarts.
    await this.persistRuntime(true);
    await this.ensureWatchdog();

    console.log('[Bing Worker] Service started successfully');
  }

  stop(): void {
    if (!this.isRunning) {
      console.warn('[Bing Worker] Service not running');
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

    // Clear persisted intent + disarm the watchdog so a later SW revival does
    // not auto-restart a service the user explicitly stopped.
    this.persistRuntime(false).catch(() => undefined);
    this.clearWatchdog().catch(() => undefined);

    console.log('[Bing Worker] Service stopped');
  }

  /**
   * Re-establish the worker after a service-worker (or browser) restart if the
   * user had it assisting. Safe to call repeatedly: start() no-ops when already
   * running. Invoked from the alarm watchdog and runtime startup listeners.
   */
  async resume(): Promise<void> {
    if (this.isRunning) {
      // Already alive — just make sure the watchdog stays armed.
      await this.ensureWatchdog();
      return;
    }

    let persisted: PersistedRuntime | null = null;
    try {
      const result = await chrome.storage.local.get(RUNTIME_STORAGE_KEY);
      persisted = result[RUNTIME_STORAGE_KEY] || null;
    } catch (error) {
      console.warn('[Bing Worker] Failed to read persisted runtime:', error);
      return;
    }

    if (!persisted || !persisted.running || !persisted.config?.apiUrl) {
      return;
    }

    try {
      console.log('[Bing Worker] Resuming assist after restart');
      await this.start(persisted.config);
    } catch (error) {
      console.error('[Bing Worker] Resume failed:', error);
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
      await chrome.storage.local.set({ [RUNTIME_STORAGE_KEY]: payload });
    } catch (error) {
      console.warn('[Bing Worker] Failed to persist runtime:', error);
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
      console.warn('[Bing Worker] Failed to arm watchdog alarm:', error);
    }
  }

  private async clearWatchdog(): Promise<void> {
    try {
      await chrome.alarms.clear(WATCHDOG_ALARM);
    } catch (error) {
      console.warn('[Bing Worker] Failed to clear watchdog alarm:', error);
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
      // assigned them.
      processor_types: ['remote_translation'] as ProcessorType[],
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
      console.log('[Bing Worker] Registered successfully:', response.data.worker_id);
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
        console.error('[Bing Worker] Heartbeat failed:', error);
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
        timeout: Math.min(this.config.pollInterval, 30),
      });

      if (!response.success || !response.data || response.data.count === 0) {
        this.stats.newTasks = 0;
        this.stats.duplicateTasks = 0;
        return;
      }

      const tasks = response.data.tasks;
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
      console.error('[Bing Worker] Polling error:', error);
    }
  }

  // ------------------------------------------------------------------
  // Task processing
  // ------------------------------------------------------------------

  private async processTask(task: Task): Promise<void> {
    if (!this.workerClient || !this.config) return;

    const workerId = this.stats.workerId!;
    this.stats.currentTaskId = task.task_id;

    try {
      console.log(`[Bing Worker] Processing task: ${task.task_id}`);

      await this.workerClient.acceptTask(task.task_id);
      await this.workerClient.submitResult({
        task_id: task.task_id,
        worker_id: workerId,
        status: 'processing',
        progress: 0,
      });

      const words = this.normalizeWords(task.payload.words);
      if (words.length === 0) {
        throw new Error('No words in task payload');
      }

      // Reuse the existing pool without stealing focus (focus=false).
      const tabIds = await this.ensureTabs(false);
      const targetLanguage = task.payload.target_language || this.config.targetLanguage;

      const translations: ResultEntry[] = [];
      const invalidWords: NormalizedWord[] = [];

      let nextIndex = 0;
      let done = 0;
      let lastReported = 0;
      const total = words.length;

      const runSlot = async (tabId: number): Promise<void> => {
        while (true) {
          const i = nextIndex++;
          if (i >= total) break;
          const w = words[i];
          this.stats.currentWord = w.word;

          try {
            const data = await bingDictionaryTool.lookupInTab(tabId, w.word);
            const classification = this.classify(data);

            if (classification === 'translated') {
              translations.push(await this.buildEntry(w, data));
              this.stats.translated++;
            } else if (classification === 'invalid') {
              invalidWords.push(w);
              this.stats.invalid++;
            } else {
              // Transient extraction/network error — leave the word for a later
              // task rather than wrongly marking it invalid.
              this.stats.failed++;
            }
          } catch (error) {
            console.error(`[Bing Worker] Failed to translate ${w.word}:`, error);
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
      };

      await Promise.all(tabIds.map((tabId) => runSlot(tabId)));

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
        },
      });

      this.taskCache.delete(task.task_id);
      console.log(
        `[Bing Worker] Task completed: ${task.task_id} (${translations.length} translated, ${invalidWords.length} invalid)`,
      );
    } catch (error: any) {
      console.error('[Bing Worker] Task processing failed:', error);

      try {
        await this.workerClient.submitResult({
          task_id: task.task_id,
          worker_id: workerId,
          status: 'failed',
          error: error?.message || 'Unknown error',
        });
      } catch (submitError) {
        console.error('[Bing Worker] Failed to submit error status:', submitError);
      }

      this.taskCache.delete(task.task_id);
    } finally {
      // Clear live activity between tasks so the popup shows idle, not a stale word.
      this.stats.currentWord = null;
      this.stats.currentTaskId = null;
    }
  }

  /** Decide what a single Bing lookup result means for the backend. */
  private classify(data: BingDictionaryResult | null): 'translated' | 'invalid' | 'error' {
    if (!data) {
      return 'error';
    }

    const hasContent =
      data.hasContent === true ||
      (data.hasContent === undefined &&
        ((data.translations?.length ?? 0) > 0 ||
          (data.phonetics?.length ?? 0) > 0 ||
          (data.sampleImages?.length ?? 0) > 0));

    if (data.success && hasContent) {
      return 'translated';
    }

    // SAFETY: only a CONFIRMED dictionary page with no entry means the word is
    // genuinely invalid. A non-dict page (region redirect, web-search fallback,
    // load failure) must NOT invalidate the word — otherwise a regional Bing
    // outage would mass-flag the whole queue. Those are transient.
    const isDictPage = data.pageType === undefined || data.pageType === 'dict';
    if (isDictPage && data.success && (data.error === NO_RESULT_ERROR || !hasContent)) {
      return 'invalid';
    }

    return 'error';
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
      console.warn('[Bing Worker] Audio download failed:', url, error);
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

  // ------------------------------------------------------------------
  // Tab pool
  // ------------------------------------------------------------------

  /**
   * Ensure the configured number of Bing dictionary tabs exist. Reuses any
   * already-tracked or already-open bing.com/dict tabs and creates the rest as
   * BACKGROUND tabs (never stealing focus), then collects them into a collapsed
   * "Bing Assist" tab group so a multi-tab pool stays tidy.
   *
   * @param focus when true (explicit Start only), surface the group to the user.
   */
  private async ensureTabs(focus = false, wantOverride?: number): Promise<number[]> {
    const want = Math.max(1, Math.min(MAX_TABS, wantOverride ?? this.config?.tabCount ?? 3));
    const alive: number[] = [];

    // Keep tracked tabs that still exist.
    for (const id of this.tabIds) {
      const tab = await this.tabExists(id);
      if (tab) alive.push(id);
    }

    // Adopt other open Bing dictionary tabs before creating new ones.
    if (alive.length < want) {
      const all = await chrome.tabs.query({});
      for (const t of all) {
        if (alive.length >= want) break;
        if (t.id && t.url && t.url.includes('bing.com/dict') && !alive.includes(t.id)) {
          alive.push(t.id);
        }
      }
    }

    // Create the remainder as background tabs — never yank the user away.
    while (alive.length < want) {
      const created = await chrome.tabs.create({
        url: 'https://www.bing.com/dict',
        active: false,
      });
      if (created.id) {
        alive.push(created.id);
      } else {
        break;
      }
    }

    this.tabIds = alive.slice(0, want);
    this.stats.activeTabs = this.tabIds.length;

    await this.groupTabs(focus);

    return this.tabIds;
  }

  /**
   * Collect the pool tabs into a single collapsed, labelled tab group so they
   * don't clutter the tab strip. chrome.tabs.group() needs only "tabs";
   * chrome.tabGroups.update() (title/color/collapsed) needs "tabGroups".
   * Best-effort: grouping can fail if the API is unavailable or tabs span
   * windows, which must never break translation.
   */
  private async groupTabs(focus: boolean): Promise<void> {
    if (this.tabIds.length === 0) return;
    if (!chrome.tabs.group || !chrome.tabGroups) return;

    try {
      const options: chrome.tabs.GroupOptions = { tabIds: this.tabIds as [number, ...number[]] };
      if (this.tabGroupId !== null) {
        options.groupId = this.tabGroupId;
      }
      this.tabGroupId = await chrome.tabs.group(options);

      await chrome.tabGroups.update(this.tabGroupId, {
        title: TAB_GROUP_TITLE,
        color: 'cyan',
        // Collapse when running in the background; expand when the user just
        // pressed Start so they can see Bing.
        collapsed: !focus,
      });

      if (focus && this.tabIds[0] !== undefined) {
        chrome.tabs.update(this.tabIds[0], { active: true }).catch(() => undefined);
      }
    } catch (error) {
      console.warn('[Bing Worker] Tab grouping skipped:', error);
      this.tabGroupId = null;
    }
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
    const tabIds = await this.ensureTabs(true, want);
    const results: Array<any> = [];
    let nextIndex = 0;

    const runSlot = async (tabId: number): Promise<void> => {
      while (true) {
        const i = nextIndex++;
        if (i >= words.length) break;
        const w = words[i];
        this.stats.currentWord = w.word;
        try {
          // Extraction returns URLs only; the binaries are fetched in-page by the
          // injected BingMediaFetcher class library (includeMedia=false here).
          const data = await bingDictionaryTool.lookupInTab(tabId, w.word, false);
          const classification = this.classify(data);
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

  private async tabExists(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const bingDictionaryWorkerService = new BingDictionaryWorkerService();

/**
 * Register the MV3 lifecycle hooks that keep the translation assist alive.
 *
 * Per the official service-worker lifecycle guidance, event listeners must be
 * registered synchronously at the top level of the SW so they are present when
 * the worker is revived. This wires:
 *   - chrome.alarms.onAlarm  -> watchdog resurrection (also wakes a terminated SW)
 *   - chrome.runtime.onStartup / onInstalled -> resume after browser restart/update
 * plus an immediate resume() for SWs revived by any other event.
 */
export function initBingWorkerLifecycle(): void {
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
