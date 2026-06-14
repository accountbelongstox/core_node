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
  };

  async start(config: WorkerConfig): Promise<void> {
    if (this.isRunning) {
      console.warn('[Bing Worker] Service already running');
      return;
    }
    if (!config.apiUrl) {
      throw new Error('API URL is required');
    }

    this.config = {
      apiUrl: config.apiUrl,
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

    // Open/reuse the Bing dictionary tab pool up front so "start assisting"
    // immediately surfaces Bing (auto-open if none, switch/activate if present).
    await this.ensureTabs();

    this.startHeartbeat();
    this.startPolling();

    this.isRunning = true;
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

    console.log('[Bing Worker] Service stopped');
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

      const tabIds = await this.ensureTabs();
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

    // Genuine "Bing has no entry" signals: either the explicit no-results page,
    // or a successful parse that yielded nothing usable.
    if (data.error === NO_RESULT_ERROR || (data.success && !hasContent)) {
      return 'invalid';
    }

    // success === false from a helper exception -> treat as transient.
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
    const us = phonetics.find((p) => p.audioUrl && p.lang && p.lang.includes('US'));
    if (us?.audioUrl) return us.audioUrl;

    const any = phonetics.find((p) => p.audioUrl);
    if (any?.audioUrl) return any.audioUrl;

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
    if (data.translations && data.translations.length > 0) {
      data.translations.forEach((trans) => {
        const pos = trans.partOfSpeech ? `${trans.partOfSpeech}. ` : '';
        parts.push(`${pos}${trans.definition}`.trim());
      });
    }

    let phonetic = '';
    let usPhonetic = '';
    let ukPhonetic = '';
    if (data.phonetics && data.phonetics.length > 0) {
      data.phonetics.forEach((p) => {
        if (p.lang && p.lang.includes('US')) {
          usPhonetic = p.text;
        } else if (p.lang && p.lang.includes('UK')) {
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
   * already-tracked or already-open bing.com/dict tabs and creates the rest,
   * activating the first so "start assisting" visibly switches to Bing.
   */
  private async ensureTabs(): Promise<number[]> {
    const want = this.config?.tabCount ?? 3;
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

    // Create the remainder.
    while (alive.length < want) {
      const created = await chrome.tabs.create({
        url: 'https://www.bing.com/dict',
        active: alive.length === 0,
      });
      if (created.id) {
        alive.push(created.id);
      } else {
        break;
      }
    }

    this.tabIds = alive.slice(0, want);
    this.stats.activeTabs = this.tabIds.length;

    // Surface Bing: activate the first pool tab.
    if (this.tabIds.length > 0) {
      chrome.tabs.update(this.tabIds[0], { active: true }).catch(() => undefined);
    }

    return this.tabIds;
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
