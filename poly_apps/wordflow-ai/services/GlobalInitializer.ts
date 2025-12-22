import { AudioProcessingHook } from './AudioProcessingHook';
import { VocabularyLibraryManager } from './VocabularyLibraryManager';
import { WordGroupsCenter } from './WordGroupsCenter';
import { LearningStatsCenter } from './LearningStatsCenter';
import { LanguagesCenter } from './LanguagesCenter';
import { QuizHistoryCenter } from './QuizHistoryCenter';
import { ReadingProgressCenter } from './ReadingProgressCenter';

class GlobalInitializerClass {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[GlobalInitializer] Already initialized');
      return;
    }

    console.log('[GlobalInitializer] Starting initialization...');

    // Initialize audio processing
    AudioProcessingHook.initialize();

    // Initialize all data centers
    console.log('[GlobalInitializer] Initializing data centers...');

    // Initialize synchronously (from storage)
    QuizHistoryCenter.initialize();
    ReadingProgressCenter.initialize();

    // Initialize asynchronously (may fetch from API)
    await Promise.all([
      WordGroupsCenter.initialize(),
      LearningStatsCenter.initialize(),
      LanguagesCenter.initialize(),
    ]);

    this.isInitialized = true;
    console.log('[GlobalInitializer] Initialization complete');
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      vocabularyLibraries: VocabularyLibraryManager.getLibrary ? 'loaded' : 'not loaded',
      audioHook: AudioProcessingHook ? 'loaded' : 'not loaded',
      pendingAudioRequests: VocabularyLibraryManager.getPendingAudioCount(),
      pendingQueueSize: AudioProcessingHook.getPendingQueueSize(),
      // New data centers
      wordGroups: {
        count: WordGroupsCenter.getCount(),
        loading: WordGroupsCenter.isLoading(),
      },
      languages: {
        count: LanguagesCenter.getCount(),
        initialized: LanguagesCenter.isInitialized(),
      },
      learningStats: {
        lastUpdated: LearningStatsCenter.getLastUpdated(),
        loading: LearningStatsCenter.isLoading(),
      },
      quizHistory: {
        count: QuizHistoryCenter.getCount(),
      },
      readingProgress: {
        count: ReadingProgressCenter.getCount(),
      },
    };
  }
}

export const GlobalInitializer = new GlobalInitializerClass();
