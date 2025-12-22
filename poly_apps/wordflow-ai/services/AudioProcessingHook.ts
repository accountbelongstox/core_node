import { EventBus } from './EventBus';
import { VocabularyLibraryManager, Word } from './VocabularyLibraryManager';
import { apiManager } from './ApiManager';

interface AudioQueueRequest {
  word: string;
  language: string;
  languageCode: string;
}

class AudioProcessingHookClass {
  private isInitialized = false;
  private batchQueue: AudioQueueRequest[] = [];
  private batchSize = 50;
  private batchDelay = 2000;
  private batchTimer: any = null;

  initialize(): void {
    if (this.isInitialized) return;

    EventBus.on('library:audio_needed', this.handleAudioNeeded.bind(this));
    EventBus.on('library:words_added', this.onWordsAdded.bind(this));

    this.isInitialized = true;
    console.log('[AudioProcessingHook] Initialized');
  }

  private handleAudioNeeded(event: any): void {
    const { libraryId, words, count } = event;
    console.log(`[AudioProcessingHook] ${count} words need audio for library ${libraryId}`);

    const library = VocabularyLibraryManager.getLibrary(libraryId);
    if (!library) return;

    const languageCode = this.getLanguageCode(library.language);

    words.forEach((word: Word) => {
      this.batchQueue.push({
        word: word.word,
        language: library.language,
        languageCode,
      });
    });

    if (this.batchQueue.length >= this.batchSize) {
      this.flushBatchQueue();
    } else {
      this.scheduleBatchFlush();
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushBatchQueue();
    }, this.batchDelay);
  }

  private async flushBatchQueue(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.batchSize);
    console.log(`[AudioProcessingHook] Sending ${batch.length} words to backend queue`);

    try {
      const baseUrl = apiManager.getCurrentBaseUrl();
      const response = await fetch(`${baseUrl}/api/app_qy_v1/ai_tools/tts/queue_batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          words: batch.map(item => ({
            text: item.word,
            language: item.languageCode,
            type: 'word',
          }))
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[AudioProcessingHook] Backend queued ${result.queued || batch.length} audio requests`);
      } else {
        console.warn('[AudioProcessingHook] Failed to queue audio requests:', response.status);
      }
    } catch (error) {
      console.error('[AudioProcessingHook] Error queuing audio requests:', error);
    }

    if (this.batchQueue.length > 0) {
      this.scheduleBatchFlush();
    }
  }

  private onWordsAdded(event: any): void {
    const { libraryId, wordsAdded, totalWords } = event;
    console.log(`[AudioProcessingHook] Library ${libraryId}: ${wordsAdded} words added (total: ${totalWords})`);
  }

  private getLanguageCode(language: string): string {
    const languageMap: Record<string, string> = {
      'english': 'en',
      'chinese': 'zh',
      'japanese': 'ja',
      'korean': 'ko',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'russian': 'ru',
      'arabic': 'ar',
      'portuguese': 'pt',
      'italian': 'it',
      'dutch': 'nl',
      'polish': 'pl',
      'turkish': 'tr',
      'vietnamese': 'vi',
      'lao': 'lo',
      'thai': 'th',
      'indonesian': 'id',
      'hindi': 'hi',
      'bengali': 'bn',
      'urdu': 'ur',
    };

    const normalizedLang = language.toLowerCase();
    return languageMap[normalizedLang] || (normalizedLang.length === 2 ? normalizedLang : 'en');
  }

  getPendingQueueSize(): number {
    return this.batchQueue.length;
  }
}

export const AudioProcessingHook = new AudioProcessingHookClass();
