import { StorageCenter, StorageKey } from './StorageCenter';
import { EventBus } from './EventBus';

export interface Word {
  index: number;
  word: string;
  translations?: string[] | null;
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  word_details?: any;
  has_translation: boolean;
  audio_url?: string | null;
}

export interface VocabularyLibrary {
  id: number;
  name: string;
  language: string;
  total_words: number;
  words: Word[];
  loadedPages: Set<number>;
  isFullyLoaded: boolean;
}

export interface AudioRequest {
  word: string;
  language: string;
  audio_url: string;
  retryCount: number;
  lastRetry: number;
}

class VocabularyLibraryManagerClass {
  private libraries: Map<number, VocabularyLibrary> = new Map();
  private pendingAudioRequests: Map<string, AudioRequest> = new Map();
  private maxRetries = 3;
  private retryDelay = 5000;
  private processingAudio = false;

  constructor() {
    this.loadFromStorage();
    this.startAudioProcessor();
  }

  loadLibrary(libraryId: number, libraryName: string, language: string, totalWords: number): void {
    if (!this.libraries.has(libraryId)) {
      this.libraries.set(libraryId, {
        id: libraryId,
        name: libraryName,
        language,
        total_words: totalWords,
        words: [],
        loadedPages: new Set(),
        isFullyLoaded: false,
      });
      this.saveToStorage();
      EventBus.emit('library:loaded', { libraryId });
    }
  }

  addWords(libraryId: number, words: Word[], page: number): void {
    const library = this.libraries.get(libraryId);
    if (!library) {
      console.warn(`[VocabularyLibraryManager] Library ${libraryId} not found`);
      return;
    }

    library.loadedPages.add(page);

    const existingWordIndices = new Set(library.words.map(w => w.index));
    const newWords = words.filter(w => !existingWordIndices.has(w.index));

    library.words.push(...newWords);
    library.words.sort((a, b) => a.index - b.index);

    if (library.words.length >= library.total_words) {
      library.isFullyLoaded = true;
    }

    this.saveToStorage();

    EventBus.emit('library:words_added', {
      libraryId,
      wordsAdded: newWords.length,
      totalWords: library.words.length
    });

    this.processWordsForAudio(libraryId, newWords);
  }

  private processWordsForAudio(libraryId: number, words: Word[]): void {
    const library = this.libraries.get(libraryId);
    if (!library) return;

    const wordsNeedingAudio = words.filter(w => !w.audio_url);

    if (wordsNeedingAudio.length > 0) {
      EventBus.emit('library:audio_needed', {
        libraryId,
        words: wordsNeedingAudio,
        count: wordsNeedingAudio.length,
      });

      wordsNeedingAudio.forEach(word => {
        const key = `${library.language}:${word.word}`;
        if (!this.pendingAudioRequests.has(key)) {
          const languageCode = this.getLanguageCode(library.language);
          const audioFilename = this.md5(word.word) + '.mp3';
          const audioUrl = `/api/app_qy_v1/tts/audio/${languageCode}/word/${audioFilename}`;

          this.pendingAudioRequests.set(key, {
            word: word.word,
            language: library.language,
            audio_url: audioUrl,
            retryCount: 0,
            lastRetry: 0,
          });
        }
      });

      this.saveAudioRequestsToStorage();
    }
  }

  private async startAudioProcessor(): Promise<void> {
    setInterval(() => {
      if (!this.processingAudio && this.pendingAudioRequests.size > 0) {
        this.processAudioQueue();
      }
    }, this.retryDelay);
  }

  private async processAudioQueue(): Promise<void> {
    if (this.processingAudio) return;

    this.processingAudio = true;
    const now = Date.now();
    const requestsToProcess: AudioRequest[] = [];

    this.pendingAudioRequests.forEach((request, key) => {
      if (request.retryCount >= this.maxRetries) {
        this.pendingAudioRequests.delete(key);
        return;
      }

      if (now - request.lastRetry >= this.retryDelay) {
        requestsToProcess.push(request);
      }
    });

    if (requestsToProcess.length > 0) {
      console.log(`[VocabularyLibraryManager] Processing ${requestsToProcess.length} audio requests`);

      for (const request of requestsToProcess.slice(0, 10)) {
        await this.checkAudioAvailability(request);
      }

      this.saveAudioRequestsToStorage();
    }

    this.processingAudio = false;
  }

  private async checkAudioAvailability(request: AudioRequest): Promise<void> {
    const key = `${request.language}:${request.word}`;

    try {
      const response = await fetch(`http://192.168.50.3:9000${request.audio_url}`, {
        method: 'HEAD',
      });

      if (response.ok) {
        this.pendingAudioRequests.delete(key);

        this.libraries.forEach(library => {
          if (library.language === request.language) {
            const word = library.words.find(w => w.word === request.word);
            if (word) {
              word.audio_url = request.audio_url;
            }
          }
        });

        this.saveToStorage();
        EventBus.emit('library:audio_ready', { word: request.word, language: request.language });
      } else {
        const updatedRequest = this.pendingAudioRequests.get(key);
        if (updatedRequest) {
          updatedRequest.retryCount++;
          updatedRequest.lastRetry = Date.now();
        }
      }
    } catch (error) {
      const updatedRequest = this.pendingAudioRequests.get(key);
      if (updatedRequest) {
        updatedRequest.retryCount++;
        updatedRequest.lastRetry = Date.now();
      }
    }
  }

  getLibrary(libraryId: number): VocabularyLibrary | undefined {
    return this.libraries.get(libraryId);
  }

  getWord(libraryId: number, wordIndex: number): Word | undefined {
    const library = this.libraries.get(libraryId);
    return library?.words.find(w => w.index === wordIndex);
  }

  unloadLibrary(libraryId: number): void {
    this.libraries.delete(libraryId);
    this.saveToStorage();
    EventBus.emit('library:unloaded', { libraryId });
  }

  clearAllLibraries(): void {
    this.libraries.clear();
    this.pendingAudioRequests.clear();
    this.saveToStorage();
    this.saveAudioRequestsToStorage();
    EventBus.emit('library:all_cleared');
  }

  getPendingAudioCount(): number {
    return this.pendingAudioRequests.size;
  }

  private saveToStorage(): void {
    const data = Array.from(this.libraries.values()).map(lib => ({
      ...lib,
      loadedPages: Array.from(lib.loadedPages),
    }));
    StorageCenter.set(StorageKey.VOCABULARY_LIBRARY_CACHE, data);
  }

  private loadFromStorage(): void {
    const data = StorageCenter.get<any[]>(StorageKey.VOCABULARY_LIBRARY_CACHE);
    if (data && Array.isArray(data)) {
      data.forEach(lib => {
        this.libraries.set(lib.id, {
          ...lib,
          loadedPages: new Set(lib.loadedPages),
        });
      });
    }
  }

  private saveAudioRequestsToStorage(): void {
    const data = Array.from(this.pendingAudioRequests.entries());
    StorageCenter.set(StorageKey.AUDIO_REQUESTS_CACHE, data);
  }

  private loadAudioRequestsFromStorage(): void {
    const data = StorageCenter.get<Array<[string, AudioRequest]>>(StorageKey.AUDIO_REQUESTS_CACHE);
    if (data && Array.isArray(data)) {
      this.pendingAudioRequests = new Map(data);
    }
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
    if (languageMap[normalizedLang]) {
      return languageMap[normalizedLang];
    }

    if (normalizedLang.length === 2) {
      return normalizedLang;
    }

    return 'en';
  }

  private md5(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
    return hashStr + hashStr + hashStr + hashStr;
  }
}

export const VocabularyLibraryManager = new VocabularyLibraryManagerClass();
