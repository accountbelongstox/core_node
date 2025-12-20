/**
 * VocabularyAudioCenter - Vocabulary Audio Management System
 *
 * Features:
 * 1. Track words with missing audio
 * 2. Request backend to generate missing audio
 * 3. Poll for audio generation completion
 * 4. Notify subscribers when audio becomes available
 */

import { apiManager } from './ApiManager';
import { StorageCenter } from './StorageCenter';

interface Word {
  index: number;
  word: string;
  audio_url: string | null;
  language?: string;
}

interface AudioGenerationRequest {
  word: string;
  language: string;
  index: number;
  requestTime: number;
  retryCount: number;
}

type AudioStatusListener = (word: string, audioUrl: string) => void;

class VocabularyAudioCenterClass {
  // Words pending audio generation
  private pendingAudioRequests: Map<string, AudioGenerationRequest> = new Map();

  // Audio status listeners
  private listeners: Set<AudioStatusListener> = new Set();

  // Polling configuration
  private POLL_INTERVAL = 3000; // 3 seconds
  private MAX_RETRY = 10; // Maximum retry attempts
  private BATCH_SIZE = 50; // Number of words to request at once

  // Polling timer
  private pollingTimer: NodeJS.Timeout | null = null;

  // Currently processing library
  private currentLibraryId: number | null = null;

  /**
   * Process vocabulary library words
   * Identifies words missing audio and triggers generation
   */
  async processVocabularyLibrary(libraryId: number, words: Word[]): Promise<void> {
    console.log(`[VocabularyAudioCenter] Processing library ${libraryId} with ${words.length} words`);

    this.currentLibraryId = libraryId;

    // Find words with missing audio
    const wordsNeedingAudio = words.filter(w => !w.audio_url || w.audio_url === 'null');

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
          requestTime: Date.now(),
          retryCount: 0
        });
      }
    }

    // Trigger audio generation request
    await this.requestAudioGeneration(libraryId, wordsNeedingAudio);

    // Start polling for completion
    this.startPolling();
  }

  /**
   * Request backend to generate audio for missing words
   */
  private async requestAudioGeneration(libraryId: number, words: Word[]): Promise<void> {
    try {
      console.log(`[VocabularyAudioCenter] Requesting audio generation for ${words.length} words`);

      const baseUrl = apiManager.getCurrentBaseUrl();
      const token = StorageCenter.auth.getToken();

      if (!token) {
        console.error('[VocabularyAudioCenter] No auth token available');
        return;
      }

      // Request audio generation (backend will queue these)
      const response = await fetch(`${baseUrl}/api/app_qy_v1/vocabulary/libraries/${libraryId}/request_audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          words: words.map(w => ({
            word: w.word,
            language: w.language || 'en',
            index: w.index
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        console.log(`[VocabularyAudioCenter] Audio generation queued: ${data.data?.queued_count || 0} words`);
      } else {
        console.error('[VocabularyAudioCenter] Failed to queue audio generation:', data.message);
      }
    } catch (error) {
      console.error('[VocabularyAudioCenter] Error requesting audio generation:', error);
    }
  }

  /**
   * Poll for audio generation completion
   */
  private startPolling(): void {
    if (this.pollingTimer) {
      return; // Already polling
    }

    console.log('[VocabularyAudioCenter] Starting audio polling...');

    this.pollingTimer = setInterval(() => {
      this.pollAudioStatus();
    }, this.POLL_INTERVAL);

    // Immediate first poll
    this.pollAudioStatus();
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
   * Poll backend for audio generation status
   */
  private async pollAudioStatus(): Promise<void> {
    if (this.pendingAudioRequests.size === 0) {
      this.stopPolling();
      return;
    }

    try {
      const baseUrl = apiManager.getCurrentBaseUrl();
      const token = StorageCenter.auth.getToken();

      if (!token) {
        console.error('[VocabularyAudioCenter] No auth token for polling');
        this.stopPolling();
        return;
      }

      // Get batch of pending words
      const pendingWords = Array.from(this.pendingAudioRequests.values())
        .slice(0, this.BATCH_SIZE);

      console.log(`[VocabularyAudioCenter] Polling status for ${pendingWords.length} words`);

      const response = await fetch(`${baseUrl}/api/app_qy_v1/vocabulary/audio/check_status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          words: pendingWords.map(w => ({
            word: w.word,
            language: w.language
          }))
        })
      });

      const data = await response.json();

      if (data.success && data.data?.results) {
        this.processAudioStatusResults(data.data.results);
      }

    } catch (error) {
      console.error('[VocabularyAudioCenter] Error polling audio status:', error);
    }

    // Clean up stale requests
    this.cleanupStaleRequests();
  }

  /**
   * Process audio status check results
   */
  private processAudioStatusResults(results: Array<{word: string; language: string; audio_url: string | null; status: string}>): void {
    let completedCount = 0;

    for (const result of results) {
      const key = this.getWordKey(result.word, result.language);
      const request = this.pendingAudioRequests.get(key);

      if (!request) continue;

      if (result.status === 'completed' && result.audio_url) {
        // Audio is ready!
        console.log(`[VocabularyAudioCenter] Audio ready for: ${result.word}`);

        // Notify listeners
        this.notifyListeners(result.word, result.audio_url);

        // Remove from pending
        this.pendingAudioRequests.delete(key);
        completedCount++;

      } else if (result.status === 'failed') {
        // Generation failed
        console.warn(`[VocabularyAudioCenter] Audio generation failed for: ${result.word}`);

        // Retry if under limit
        request.retryCount++;
        if (request.retryCount >= this.MAX_RETRY) {
          console.error(`[VocabularyAudioCenter] Max retries exceeded for: ${result.word}`);
          this.pendingAudioRequests.delete(key);
        }

      } else if (result.status === 'pending' || result.status === 'processing') {
        // Still processing, keep in queue
        console.log(`[VocabularyAudioCenter] Audio still processing: ${result.word} (${result.status})`);
      }
    }

    if (completedCount > 0) {
      console.log(`[VocabularyAudioCenter] ${completedCount} audio files completed`);
    }

    // Stop polling if all done
    if (this.pendingAudioRequests.size === 0) {
      this.stopPolling();
    }
  }

  /**
   * Clean up requests that have been pending too long
   */
  private cleanupStaleRequests(): void {
    const MAX_AGE = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    let removedCount = 0;

    for (const [key, request] of this.pendingAudioRequests.entries()) {
      if (now - request.requestTime > MAX_AGE) {
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
   * Clear all pending requests (e.g., when switching libraries)
   */
  clearPending(): void {
    console.log('[VocabularyAudioCenter] Clearing all pending requests');
    this.pendingAudioRequests.clear();
    this.stopPolling();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      pending: this.pendingAudioRequests.size,
      isPolling: this.pollingTimer !== null,
      currentLibrary: this.currentLibraryId
    };
  }
}

// Export singleton
export const VocabularyAudioCenter = new VocabularyAudioCenterClass();
