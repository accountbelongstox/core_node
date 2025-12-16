/**
 * Bing Dictionary Worker Service
 * Implements Worker-based auto-translation using Worker API
 * Under 400 lines
 */

import { WorkerApiClient, Task, ProcessorType } from '../api/WorkerApiClient';
import { bingDictionaryTool } from '../tools/browser/bing-dictionary';

export interface WorkerConfig {
  apiUrl: string;
  workerName?: string;
  pollInterval?: number;
  heartbeatInterval?: number;
  batchSize?: number;
}

export interface WorkerStats {
  pending: number;
  translated: number;
  failed: number;
  lastRun: number | null;
  workerId: string | null;
  isOnline: boolean;
  // Queue statistics
  queueTotal: number;      // Total tasks in current queue
  newTasks: number;        // New tasks received in last poll
  duplicateTasks: number;  // Duplicate tasks skipped in last poll
}

class BingDictionaryWorkerService {
  private isRunning = false;
  private config: WorkerConfig | null = null;
  private workerClient: WorkerApiClient | null = null;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;

  // Task cache to prevent duplicate processing
  private taskCache = new Set<string>();
  private taskQueue: Task[] = [];

  private stats: WorkerStats = {
    pending: 0,
    translated: 0,
    failed: 0,
    lastRun: null,
    workerId: null,
    isOnline: false,
    queueTotal: 0,
    newTasks: 0,
    duplicateTasks: 0,
  };

  /**
   * Start the worker service
   */
  async start(config: WorkerConfig): Promise<void> {
    if (this.isRunning) {
      console.warn('[Bing Worker] Service already running');
      return;
    }

    if (!config.apiUrl) {
      throw new Error('API URL is required');
    }

    this.config = {
      workerName: 'MCP Chrome Bing Dictionary Worker',
      pollInterval: 5,  // Default 5 seconds for real-time updates
      heartbeatInterval: 60,
      batchSize: 5,
      ...config,
    };

    console.log('[Bing Worker] Starting service with config:', this.config);

    // Initialize Worker API client
    this.workerClient = new WorkerApiClient(this.config.apiUrl);

    // Register worker
    await this.registerWorker();

    // Start heartbeat
    this.startHeartbeat();

    // Start task polling
    this.startPolling();

    this.isRunning = true;
    console.log('[Bing Worker] Service started successfully');
  }

  /**
   * Stop the worker service
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('[Bing Worker] Service not running');
      return;
    }

    // Stop polling
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }

    // Stop heartbeat
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    // Clear cache and queue
    this.taskCache.clear();
    this.taskQueue = [];

    this.isRunning = false;
    this.stats.isOnline = false;
    this.stats.queueTotal = 0;
    this.stats.newTasks = 0;
    this.stats.duplicateTasks = 0;

    console.log('[Bing Worker] Service stopped');
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; stats: WorkerStats } {
    return {
      isRunning: this.isRunning,
      stats: { ...this.stats },
    };
  }

  /**
   * Register worker with server
   */
  private async registerWorker(): Promise<void> {
    if (!this.workerClient || !this.config) {
      throw new Error('Worker client not initialized');
    }

    try {
      // Generate unique worker ID
      const workerId = `mcp-chrome-bing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const response = await this.workerClient.register({
        worker_id: workerId,
        worker_name: this.config.workerName || 'MCP Chrome Bing Dictionary Worker',
        processor_types: ['remote_client'] as ProcessorType[],
        hostname: 'chrome-extension',
        platform: navigator.userAgent,
        metadata: {
          version: chrome.runtime.getManifest().version,
          extensionId: chrome.runtime.id,
        },
      });

      if (response.success && response.data) {
        this.stats.workerId = response.data.worker_id;
        this.stats.isOnline = true;
        console.log('[Bing Worker] Registered successfully:', response.data.worker_id);
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('[Bing Worker] Registration failed:', error);
      throw error;
    }
  }

  /**
   * Start heartbeat interval
   */
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

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval
    this.heartbeatIntervalId = setInterval(
      sendHeartbeat,
      (this.config.heartbeatInterval || 60) * 1000,
    );
  }

  /**
   * Start task polling
   */
  private startPolling(): void {
    if (!this.config) return;

    const poll = async () => {
      await this.pollAndProcessTasks();
    };

    // Start polling immediately
    poll();

    // Set up interval
    this.pollIntervalId = setInterval(poll, (this.config.pollInterval || 30) * 1000);
  }

  /**
   * Poll and process tasks
   */
  private async pollAndProcessTasks(): Promise<void> {
    if (!this.workerClient || !this.config) return;

    try {
      this.stats.lastRun = Date.now();

      console.log('[Bing Worker] Polling for tasks...');

      // Pull tasks with long polling
      const response = await this.workerClient.pullTasks(undefined, {
        limit: this.config.batchSize || 5,
        timeout: Math.min(this.config.pollInterval || 5, 30),
      });

      if (!response.success || !response.data || response.data.count === 0) {
        console.log('[Bing Worker] No tasks available');
        // Reset new/duplicate counters when no tasks
        this.stats.newTasks = 0;
        this.stats.duplicateTasks = 0;
        return;
      }

      const tasks = response.data.tasks;
      console.log(`[Bing Worker] Received ${tasks.length} tasks`);

      // Filter out duplicate tasks
      let newTaskCount = 0;
      let duplicateCount = 0;

      for (const task of tasks) {
        if (this.taskCache.has(task.task_id)) {
          // Duplicate task
          duplicateCount++;
          console.log(`[Bing Worker] Skipping duplicate task: ${task.task_id}`);
        } else {
          // New task - add to cache and queue
          this.taskCache.add(task.task_id);
          this.taskQueue.push(task);
          newTaskCount++;
        }
      }

      // Update statistics
      this.stats.newTasks = newTaskCount;
      this.stats.duplicateTasks = duplicateCount;
      this.stats.queueTotal = this.taskQueue.length;
      this.stats.pending = this.taskQueue.length;

      console.log(`[Bing Worker] Queue stats - Total: ${this.stats.queueTotal}, New: ${newTaskCount}, Duplicates: ${duplicateCount}`);

      // Process tasks from queue
      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        if (task) {
          await this.processTask(task);
          // Update queue total after processing
          this.stats.queueTotal = this.taskQueue.length;
          this.stats.pending = this.taskQueue.length;
        }
      }
    } catch (error) {
      console.error('[Bing Worker] Polling error:', error);
    }
  }

  /**
   * Process a single task
   */
  private async processTask(task: Task): Promise<void> {
    if (!this.workerClient) return;

    try {
      console.log(`[Bing Worker] Processing task: ${task.task_id}`);

      // Accept task
      await this.workerClient.acceptTask(task.task_id);

      // Submit processing status
      await this.workerClient.submitResult({
        task_id: task.task_id,
        worker_id: this.stats.workerId!,
        status: 'processing',
        progress: 0,
      });

      // Extract words from payload
      const words = task.payload.words || [];

      if (words.length === 0) {
        throw new Error('No words in task payload');
      }

      // Process each word
      const explanations: any[] = [];

      for (let i = 0; i < words.length; i++) {
        const wordData = words[i];

        console.log(`[Bing Worker] Translating: ${wordData.word} (${i + 1}/${words.length})`);

        try {
          // Use Bing Dictionary tool to translate
          const result = await bingDictionaryTool.execute({
            word: wordData.word,
            openInNewTab: false,
          });

          if (result.isError) {
            throw new Error('Translation failed');
          }

          // Parse result
          const translationData = JSON.parse(result.content[0].text);

          if (translationData.success) {
            // Format explanation
            const explanation = this.formatExplanation(translationData);

            explanations.push({
              word: wordData.word,
              md5: wordData.md5,
              explanation: explanation.text,
              phonetic: explanation.phonetic,
              us_phonetic: explanation.us_phonetic,
              uk_phonetic: explanation.uk_phonetic,
              provider: 'bing',
            });

            // Update progress
            const progress = Math.round(((i + 1) / words.length) * 100);
            await this.workerClient.submitResult({
              task_id: task.task_id,
              worker_id: this.stats.workerId!,
              status: 'processing',
              progress,
            });
          }
        } catch (error: any) {
          console.error(`[Bing Worker] Failed to translate ${wordData.word}:`, error);
          this.stats.failed++;
        }

        // Add delay between translations
        await this.delay(2000);
      }

      // Submit completed result
      await this.workerClient.submitResult({
        task_id: task.task_id,
        worker_id: this.stats.workerId!,
        status: 'completed',
        progress: 100,
        result: {
          explanations,
        },
      });

      this.stats.translated += explanations.length;
      this.stats.pending--;

      // Remove from cache after successful completion
      this.taskCache.delete(task.task_id);

      console.log(`[Bing Worker] Task completed: ${task.task_id}`);
    } catch (error: any) {
      console.error(`[Bing Worker] Task processing failed:`, error);

      // Submit failed status
      try {
        await this.workerClient.submitResult({
          task_id: task.task_id,
          worker_id: this.stats.workerId!,
          status: 'failed',
          error: error.message || 'Unknown error',
        });
      } catch (submitError) {
        console.error('[Bing Worker] Failed to submit error status:', submitError);
      }

      this.stats.failed++;
      this.stats.pending--;

      // Remove from cache after failure
      this.taskCache.delete(task.task_id);
    }
  }

  /**
   * Format translation data into explanation text
   */
  private formatExplanation(translationData: any): {
    text: string;
    phonetic?: string;
    us_phonetic?: string;
    uk_phonetic?: string;
  } {
    const parts: string[] = [];

    // Add translations
    if (translationData.translations && translationData.translations.length > 0) {
      translationData.translations.forEach((trans: any) => {
        parts.push(`${trans.partOfSpeech}. ${trans.definition}`);
      });
    }

    // Extract phonetics
    let phonetic = '';
    let us_phonetic = '';
    let uk_phonetic = '';

    if (translationData.phonetics && translationData.phonetics.length > 0) {
      translationData.phonetics.forEach((p: any) => {
        if (p.lang && p.lang.includes('US')) {
          us_phonetic = p.text;
        } else if (p.lang && p.lang.includes('UK')) {
          uk_phonetic = p.text;
        } else if (!phonetic) {
          phonetic = p.text;
        }
      });
    }

    return {
      text: parts.join('\n') || 'No explanation available',
      phonetic: phonetic || us_phonetic || uk_phonetic || undefined,
      us_phonetic: us_phonetic || undefined,
      uk_phonetic: uk_phonetic || undefined,
    };
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const bingDictionaryWorkerService = new BingDictionaryWorkerService();
