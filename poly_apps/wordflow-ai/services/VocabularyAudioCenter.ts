/**
 * VocabularyAudioCenter - TTS Audio Management System (Optimized)
 *
 * Performance Optimizations:
 * 1. Local word cache - avoid re-fetching entire library
 * 2. Targeted polling - only check pending tasks (not entire library)
 * 3. Dynamic cache management - clear when switching pages
 * 4. BATCH operations - add and query multiple tasks in one request (max 100)
 * 5. File penetration check - backend returns already-available audio immediately
 * 6. Task-based tracking - use task_ids for efficient status queries
 *
 * NEW Backend API v2.0.0 (2025-12-21):
 * - POST /api/app_qy_v1/ai_tools/tts/queue/batch/add (batch add tasks)
 * - POST /api/app_qy_v1/ai_tools/tts/queue/batch/get (batch query by task_ids)
 *
 * Based on: TTS_BATCH_API_DOCUMENTATION.md
 */

import { apiManager } from './ApiManager';
import { StorageCenter } from './StorageCenter';

interface VocabularyWord {
  index: number;
  word: string;
  audio_url: string | null;
  audio_available: boolean;
  language?: string;
}

// Backend Batch API Interfaces (v2.0.0)

interface BatchAddTasksRequest {
  tasks: Array<{
    content: string;
    language: string;
    type?: 'word' | 'sentence' | 'article';
    priority?: number;  // 0-100
  }>;
  default_priority?: number;  // 0-100
}

interface BatchAddTasksResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    total: number;
    results: Array<{
      success: boolean;
      status: 'queued' | 'moved_to_front' | 'already_available' | 'already_completed';
      task_id?: number;
      task_type?: string;
      priority?: number;
      audio_path?: string;
      audio_url?: string;
      index: number;
      content: string;
      error?: string;
    }>;
  };
}

interface BatchGetTasksRequest {
  task_ids: number[];
}

interface BatchGetTasksResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    total: number;
    results: Array<TaskDetail | TaskNotFound>;
  };
}

interface TaskDetail {
  task_id: number;
  task_type: 'word' | 'sentence' | 'article';
  content_text: string;
  language: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retry_count: number;
  audio_path?: string;
  audio_url?: string;
  error_message?: string;
  requested_at?: string;
  started_at?: string;
  completed_at?: string;
}

interface TaskNotFound {
  task_id: number;
  error: string;
}

// Internal Request Tracking
interface AudioGenerationRequest {
  word: string;
  language: string;
  index: number;
  priority: number;
  taskId: number | null;  // Task ID from batch/add
  requestTime: number;
  retryCount: number;
}

type AudioStatusListener = (word: string, audioUrl: string) => void;

class VocabularyAudioCenterClass {
  // LOCAL CACHE: Current page words
  private cachedWords: Map<string, VocabularyWord> = new Map();
  private currentLibraryId: number | null = null;
  private currentPage: number | null = null;

  // Words pending audio generation
  private pendingAudioRequests: Map<string, AudioGenerationRequest> = new Map();

  // Audio status listeners
  private listeners: Set<AudioStatusListener> = new Set();

  // Polling configuration
  private POLL_INTERVAL = 5000; // 5 seconds
  private MAX_RETRY = 10;
  private BATCH_SIZE = 100;
  private MAX_AGE = 5 * 60 * 1000; // 5 minutes

  // Polling timer
  private pollingTimer: NodeJS.Timeout | null = null;

  /**
   * Process vocabulary library words with LOCAL CACHING
   *
   * @param libraryId - Vocabulary library ID
   * @param page - Current page number
   * @param words - Array of vocabulary words
   * @param priority - Priority for this batch (default: 10)
   */
  async processVocabularyLibrary(
    libraryId: number,
    page: number,
    words: VocabularyWord[],
    priority: number = 10
  ): Promise<void> {
    console.log(`[VocabularyAudioCenter] Processing library ${libraryId}, page ${page}, ${words.length} words`);

    // Check if switching to a different page/library
    const isNewContext = this.currentLibraryId !== libraryId || this.currentPage !== page;

    if (isNewContext) {
      console.log(`[VocabularyAudioCenter] Switching context, clearing old cache`);
      this.clearCache();
      this.currentLibraryId = libraryId;
      this.currentPage = page;
    }

    // BUILD LOCAL CACHE
    for (const word of words) {
      const key = this.getWordKey(word.word, word.language || 'en');
      this.cachedWords.set(key, word);
    }

    console.log(`[VocabularyAudioCenter] Cached ${this.cachedWords.size} words locally`);

    // Find words with missing audio
    const wordsNeedingAudio = words.filter(w => !w.audio_available);

    if (wordsNeedingAudio.length === 0) {
      console.log('[VocabularyAudioCenter] All words have audio');
      return;
    }

    console.log(`[VocabularyAudioCenter] Found ${wordsNeedingAudio.length} words without audio`);

    // Add to pending requests
    for (const word of wordsNeedingAudio) {
      const key = this.getWordKey(word.word, word.language || 'en');

      if (!this.pendingAudioRequests.has(key)) {
        this.pendingAudioRequests.set(key, {
          word: word.word,
          language: word.language || 'en',
          index: word.index,
          priority: priority,
          requestTime: Date.now(),
          retryCount: 0
        });
      }
    }

    // Queue words for generation
    await this.queueWordsForGeneration(wordsNeedingAudio, priority);

    // Start OPTIMIZED polling
    this.startPolling();
  }

  /**
   * Queue a single word with high priority (user-clicked)
   */
  async queueSingleWord(
    word: string,
    language: string = 'en',
    priority: number = 50
  ): Promise<void> {
    const key = this.getWordKey(word, language);

    if (!this.pendingAudioRequests.has(key)) {
      this.pendingAudioRequests.set(key, {
        word: word,
        language: language,
        index: 0,
        priority: priority,
        requestTime: Date.now(),
        retryCount: 0
      });
    }

    await this.queueWordsForGeneration([{ word, language, priority }], priority);
    this.startPolling();
  }

  /**
   * Queue words for audio generation using NEW Batch API
   * Backend API: POST /api/app_qy_v1/ai_tools/tts/queue/batch/add
   */
  private async queueWordsForGeneration(
    words: Array<{ word: string; language?: string; priority?: number }>,
    defaultPriority: number = 10
  ): Promise<void> {
    try {
      const baseUrl = apiManager.getCurrentBaseUrl();
      const token = StorageCenter.auth.getToken();

      if (!token) {
        console.error('[VocabularyAudioCenter] No auth token available');
        return;
      }

      // Split into batches of 100
      const batches: Array<{ content: string; language: string; type: string; priority?: number }[]> = [];
      for (let i = 0; i < words.length; i += this.BATCH_SIZE) {
        const batch = words.slice(i, i + this.BATCH_SIZE).map(w => ({
          content: w.word,           // word -> content
          language: w.language || 'en',
          type: 'word',              // always 'word' for vocabulary
          priority: w.priority ?? defaultPriority
        }));
        batches.push(batch);
      }

      console.log(`[VocabularyAudioCenter] Queuing ${words.length} words in ${batches.length} batch(es) using NEW batch/add API`);

      for (const batch of batches) {
        const response = await fetch(`${baseUrl}/api/app_qy_v1/ai_tools/tts/queue/batch/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            tasks: batch,
            default_priority: defaultPriority
          } as BatchAddTasksRequest)
        });

        const data: BatchAddTasksResponse = await response.json();

        if (data.status === 'success') {
          console.log(`[VocabularyAudioCenter] Batch add completed: ${data.data.total} tasks`);

          // Process results
          for (const result of data.data.results) {
            if (!result.success) {
              console.error(`[VocabularyAudioCenter] Task failed: ${result.content}, error: ${result.error}`);
              continue;
            }

            const word = result.content;
            const language = batch[result.index].language;
            const key = this.getWordKey(word, language);

            if (result.status === 'already_available' || result.status === 'already_completed') {
              // Audio already exists -穿透检查返回
              console.log(`[VocabularyAudioCenter] ✅ Audio already available: ${word}`);

              if (result.audio_url) {
                this.updateCachedWord(word, language, result.audio_url);
                this.notifyListeners(word, result.audio_url);
              }

              // Remove from pending
              this.pendingAudioRequests.delete(key);

            } else if (result.status === 'queued' || result.status === 'moved_to_front') {
              // Task queued - need to poll for completion
              console.log(`[VocabularyAudioCenter] ⏳ Task queued: ${word}, task_id: ${result.task_id}`);

              // Update taskId in pending request
              const request = this.pendingAudioRequests.get(key);
              if (request && result.task_id) {
                request.taskId = result.task_id;
              }
            }
          }
        } else {
          console.error('[VocabularyAudioCenter] Failed to queue batch:', data.message);
        }
      }
    } catch (error) {
      console.error('[VocabularyAudioCenter] Error queuing words:', error);
    }
  }

  /**
   * Start OPTIMIZED polling - batch query pending tasks
   */
  private startPolling(): void {
    if (this.pollingTimer) {
      return; // Already polling
    }

    console.log('[VocabularyAudioCenter] Starting OPTIMIZED audio polling (5s intervals)...');
    console.log('[VocabularyAudioCenter] Using NEW batch/get API - query all pending tasks by task_ids');

    this.pollingTimer = setInterval(() => {
      this.pollPendingWordsStatus();
    }, this.POLL_INTERVAL);

    // Immediate first poll
    this.pollPendingWordsStatus();
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('[VocabularyAudioCenter] Polling stopped');
    }
  }

  /**
   * OPTIMIZED: Poll only pending tasks using NEW batch/get API
   * Uses: POST /api/app_qy_v1/ai_tools/tts/queue/batch/get
   */
  private async pollPendingWordsStatus(): Promise<void> {
    if (this.pendingAudioRequests.size === 0) {
      this.stopPolling();
      return;
    }

    const baseUrl = apiManager.getCurrentBaseUrl();
    const token = StorageCenter.auth.getToken();

    if (!token) {
      console.error('[VocabularyAudioCenter] No auth token for polling');
      this.stopPolling();
      return;
    }

    console.log(`[VocabularyAudioCenter] Polling ${this.pendingAudioRequests.size} pending tasks using NEW batch/get API...`);

    let completedCount = 0;

    try {
      // Collect task IDs for batch query
      const taskIds: number[] = [];
      const taskIdToKeyMap = new Map<number, string>(); // task_id -> key

      for (const [key, request] of this.pendingAudioRequests.entries()) {
        if (request.taskId) {
          taskIds.push(request.taskId);
          taskIdToKeyMap.set(request.taskId, key);
        }
      }

      if (taskIds.length === 0) {
        console.warn('[VocabularyAudioCenter] No task IDs to poll (all requests missing taskId)');
        this.stopPolling();
        return;
      }

      // Split into batches of 100 (API maximum)
      const batches: number[][] = [];
      for (let i = 0; i < taskIds.length; i += this.BATCH_SIZE) {
        batches.push(taskIds.slice(i, i + this.BATCH_SIZE));
      }

      console.log(`[VocabularyAudioCenter] Querying ${taskIds.length} task(s) in ${batches.length} batch(es)...`);

      // Process each batch
      for (const batch of batches) {
        const response = await fetch(`${baseUrl}/api/app_qy_v1/ai_tools/tts/queue/batch/get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({ task_ids: batch } as BatchGetTasksRequest)
        });

        const data: BatchGetTasksResponse = await response.json();

        if (data.status === 'success' && data.data) {
          // Process results
          for (const result of data.data.results) {
            // Check if this is a TaskNotFound response
            if ('error' in result) {
              const taskNotFound = result as TaskNotFound;
              const requestKey = taskIdToKeyMap.get(taskNotFound.task_id);

              if (requestKey) {
                console.warn(`[VocabularyAudioCenter] Task not found: ${taskNotFound.task_id}, error: ${taskNotFound.error}`);
                this.pendingAudioRequests.delete(requestKey);
              }
              continue;
            }

            // Process TaskDetail response
            const task = result as TaskDetail;
            const requestKey = taskIdToKeyMap.get(task.task_id);

            if (!requestKey) {
              console.warn(`[VocabularyAudioCenter] Task ID ${task.task_id} not found in mapping`);
              continue;
            }

            const request = this.pendingAudioRequests.get(requestKey);
            if (!request) {
              continue;
            }

            if (task.status === 'completed' && task.audio_url) {
              // Audio is ready!
              console.log(`[VocabularyAudioCenter] ✅ Audio ready for: ${request.word} (task ${task.task_id})`);

              // Update local cache
              this.updateCachedWord(request.word, request.language, task.audio_url);

              // Notify listeners
              this.notifyListeners(request.word, task.audio_url);

              // Remove from pending
              this.pendingAudioRequests.delete(requestKey);
              completedCount++;

            } else if (task.status === 'failed') {
              // Generation failed
              console.warn(`[VocabularyAudioCenter] ❌ Audio generation failed for: ${request.word}`);
              console.warn(`[VocabularyAudioCenter] Error: ${task.error_message || 'Unknown error'}`);

              request.retryCount++;
              if (request.retryCount >= this.MAX_RETRY) {
                console.error(`[VocabularyAudioCenter] Max retries exceeded for: ${request.word}`);
                this.pendingAudioRequests.delete(requestKey);
              }

            } else {
              // Still processing (pending or processing)
              console.log(`[VocabularyAudioCenter] ⏳ Still ${task.status}: ${request.word} (task ${task.task_id})`);
              request.retryCount++;

              if (request.retryCount >= this.MAX_RETRY) {
                console.warn(`[VocabularyAudioCenter] Timeout for: ${request.word}`);
                this.pendingAudioRequests.delete(requestKey);
              }
            }
          }

          // Log summary
          const summary = {
            total: data.data.total,
            completed: data.data.results.filter(r => !('error' in r) && (r as TaskDetail).status === 'completed').length,
            processing: data.data.results.filter(r => !('error' in r) && (r as TaskDetail).status === 'processing').length,
            pending: data.data.results.filter(r => !('error' in r) && (r as TaskDetail).status === 'pending').length,
            failed: data.data.results.filter(r => !('error' in r) && (r as TaskDetail).status === 'failed').length,
            not_found: data.data.results.filter(r => 'error' in r).length
          };

          console.log(`[VocabularyAudioCenter] Batch summary:`, summary);
        } else {
          console.error('[VocabularyAudioCenter] Batch get failed:', data.message || 'Unknown error');
        }
      }

    } catch (error) {
      console.error('[VocabularyAudioCenter] Error during batch status check:', error);
    }

    if (completedCount > 0) {
      console.log(`[VocabularyAudioCenter] ✅ ${completedCount} audio files completed`);
    }

    console.log(`[VocabularyAudioCenter] Still pending: ${this.pendingAudioRequests.size} words`);

    // Clean up stale requests
    this.cleanupStaleRequests();

    // Stop polling if all done
    if (this.pendingAudioRequests.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Update cached word with audio URL
   */
  private updateCachedWord(word: string, language: string, audioUrl: string): void {
    const key = this.getWordKey(word, language);
    const cachedWord = this.cachedWords.get(key);

    if (cachedWord) {
      cachedWord.audio_url = audioUrl;
      cachedWord.audio_available = true;
      this.cachedWords.set(key, cachedWord);
      console.log(`[VocabularyAudioCenter] Updated cache for: ${word}`);
    }
  }

  /**
   * Get cached word
   */
  getCachedWord(word: string, language: string = 'en'): VocabularyWord | undefined {
    const key = this.getWordKey(word, language);
    return this.cachedWords.get(key);
  }

  /**
   * Get all cached words
   */
  getAllCachedWords(): VocabularyWord[] {
    return Array.from(this.cachedWords.values());
  }

  /**
   * Clean up stale requests
   */
  private cleanupStaleRequests(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, request] of this.pendingAudioRequests.entries()) {
      if (now - request.requestTime > this.MAX_AGE) {
        console.warn(`[VocabularyAudioCenter] Removing stale request: ${request.word}`);
        this.pendingAudioRequests.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[VocabularyAudioCenter] Cleaned up ${removedCount} stale requests`);
    }
  }

  /**
   * Subscribe to audio status updates
   */
  subscribe(listener: AudioStatusListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify listeners when audio becomes available
   */
  private notifyListeners(word: string, audioUrl: string): void {
    this.listeners.forEach(listener => {
      try {
        listener(word, audioUrl);
      } catch (error) {
        console.error('[VocabularyAudioCenter] Error in listener:', error);
      }
    });
  }

  /**
   * Get unique key for word+language combination
   */
  private getWordKey(word: string, language: string): string {
    return `${language}:${word.toLowerCase()}`;
  }

  /**
   * Get current pending count
   */
  getPendingCount(): number {
    return this.pendingAudioRequests.size;
  }

  /**
   * Check if a specific word is pending
   */
  isPending(word: string, language: string = 'en'): boolean {
    const key = this.getWordKey(word, language);
    return this.pendingAudioRequests.has(key);
  }

  /**
   * Clear cache and pending requests (when switching pages)
   */
  clearCache(): void {
    console.log('[VocabularyAudioCenter] Clearing cache and pending requests');
    this.cachedWords.clear();
    this.pendingAudioRequests.clear();
    this.stopPolling();
    this.currentLibraryId = null;
    this.currentPage = null;
  }

  /**
   * Clear only pending requests (keep cache)
   */
  clearPending(): void {
    console.log('[VocabularyAudioCenter] Clearing pending requests only');
    this.pendingAudioRequests.clear();
    this.stopPolling();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      cachedWords: this.cachedWords.size,
      pending: this.pendingAudioRequests.size,
      isPolling: this.pollingTimer !== null,
      currentLibrary: this.currentLibraryId,
      currentPage: this.currentPage,
      pollInterval: this.POLL_INTERVAL,
      batchSize: this.BATCH_SIZE
    };
  }

  /**
   * Get queue statistics from backend
   * Backend API: GET /api/app_qy_v1/ai_tools/tts/queue/stats
   */
  async getQueueStats(): Promise<any> {
    try {
      const baseUrl = apiManager.getCurrentBaseUrl();
      const token = StorageCenter.auth.getToken();

      if (!token) {
        console.error('[VocabularyAudioCenter] No auth token');
        return null;
      }

      const response = await fetch(`${baseUrl}/api/app_qy_v1/ai_tools/tts/queue/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (data.status === 'success') {
        console.log('[VocabularyAudioCenter] Queue stats:', data.data);
        return data.data;
      }

      return null;
    } catch (error) {
      console.error('[VocabularyAudioCenter] Error fetching queue stats:', error);
      return null;
    }
  }
}

// Export singleton
export const VocabularyAudioCenter = new VocabularyAudioCenterClass();
