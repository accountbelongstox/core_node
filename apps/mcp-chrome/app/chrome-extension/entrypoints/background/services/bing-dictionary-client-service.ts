/**
 * Bing Dictionary Client Service
 * Handles automatic word fetching, translation, and result uploading
 */

import { bingDictionaryTool } from '../tools/browser/bing-dictionary';

export interface BingClientConfig {
  apiUrl: string;
  fetchInterval: number;
  batchSize: number;
}

export interface BingClientStats {
  pending: number;
  translated: number;
  failed: number;
  lastRun: number | null;
}

interface WordTask {
  id: string;
  word: string;
  status: 'pending' | 'translating' | 'completed' | 'failed';
  retries: number;
  error?: string;
}

class BingDictionaryClientService {
  private isRunning = false;
  private config: BingClientConfig | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private queue: WordTask[] = [];
  private stats: BingClientStats = {
    pending: 0,
    translated: 0,
    failed: 0,
    lastRun: null,
  };
  private isProcessing = false;

  /**
   * Start the client service
   */
  async start(config: BingClientConfig): Promise<void> {
    if (this.isRunning) {
      console.warn('[Bing Client] Service already running');
      return;
    }

    if (!config.apiUrl) {
      throw new Error('API URL is required');
    }

    this.config = config;
    this.isRunning = true;

    console.log('[Bing Client] Service started with config:', config);

    // Start periodic fetching
    await this.runCycle();
    this.intervalId = setInterval(() => this.runCycle(), config.fetchInterval * 1000);
  }

  /**
   * Stop the client service
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('[Bing Client] Service not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('[Bing Client] Service stopped');
  }

  /**
   * Get service status
   */
  getStatus(): { isRunning: boolean; stats: BingClientStats } {
    return {
      isRunning: this.isRunning,
      stats: { ...this.stats },
    };
  }

  /**
   * Run one fetch-translate-upload cycle
   */
  private async runCycle(): Promise<void> {
    if (!this.config || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.stats.lastRun = Date.now();

    try {
      console.log('[Bing Client] Starting new cycle...');

      // Fetch pending words from server
      const words = await this.fetchPendingWords();
      console.log(`[Bing Client] Fetched ${words.length} pending words`);

      if (words.length === 0) {
        console.log('[Bing Client] No pending words to process');
        this.isProcessing = false;
        return;
      }

      // Add to queue
      for (const word of words) {
        if (!this.queue.find((t) => t.word === word.word)) {
          this.queue.push({
            id: word.id,
            word: word.word,
            status: 'pending',
            retries: 0,
          });
        }
      }

      // Update stats
      this.updateStats();

      // Process queue
      await this.processQueue();
    } catch (error) {
      console.error('[Bing Client] Cycle error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Fetch pending words from server
   */
  private async fetchPendingWords(): Promise<Array<{ id: string; word: string }>> {
    if (!this.config) {
      return [];
    }

    try {
      const url = `${this.config.apiUrl}/api/dictionary/pending`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      return data.words || [];
    } catch (error) {
      console.error('[Bing Client] Failed to fetch pending words:', error);
      return [];
    }
  }

  /**
   * Process translation queue
   */
  private async processQueue(): Promise<void> {
    const pendingTasks = this.queue.filter((t) => t.status === 'pending');
    const batchSize = this.config?.batchSize || 10;
    const batch = pendingTasks.slice(0, batchSize);

    console.log(`[Bing Client] Processing batch of ${batch.length} words`);

    for (const task of batch) {
      try {
        task.status = 'translating';
        this.updateStats();

        console.log(`[Bing Client] Translating: ${task.word}`);

        // Use the Bing Dictionary MCP tool to translate
        const result = await bingDictionaryTool.execute({
          word: task.word,
          openInNewTab: false,
        });

        if (result.isError) {
          throw new Error('Translation failed');
        }

        // Parse result
        const translationData = JSON.parse(result.content[0].text);

        // Upload result to server
        await this.uploadTranslationResult(task.id, translationData);

        // Mark as completed
        task.status = 'completed';
        this.stats.translated++;

        console.log(`[Bing Client] Successfully translated: ${task.word}`);
      } catch (error: any) {
        console.error(`[Bing Client] Failed to translate ${task.word}:`, error);

        task.retries++;
        if (task.retries >= 3) {
          task.status = 'failed';
          task.error = error.message || 'Unknown error';
          this.stats.failed++;
        } else {
          task.status = 'pending';
        }
      }

      this.updateStats();

      // Add a small delay between translations
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Clean up completed and failed tasks
    this.queue = this.queue.filter((t) => t.status === 'pending' && t.retries < 3);
    this.updateStats();
  }

  /**
   * Upload translation result to server
   */
  private async uploadTranslationResult(taskId: string, translationData: any): Promise<void> {
    if (!this.config) {
      return;
    }

    try {
      const url = `${this.config.apiUrl}/api/dictionary/result`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          word: translationData.word,
          phonetics: translationData.phonetics,
          translations: translationData.translations,
          pluralForms: translationData.pluralForms,
          sampleImages: translationData.sampleImages,
          synonyms: translationData.synonyms,
          advancedTranslations: translationData.advancedTranslations,
          voiceUrls: translationData.voiceUrls,
          success: translationData.success,
          error: translationData.error,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      console.log(`[Bing Client] Uploaded result for task: ${taskId}`);
    } catch (error) {
      console.error('[Bing Client] Failed to upload result:', error);
      throw error;
    }
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.pending = this.queue.filter((t) => t.status === 'pending').length;
    // translated and failed are updated elsewhere
  }
}

// Singleton instance
export const bingDictionaryClientService = new BingDictionaryClientService();
