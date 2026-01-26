import { AudioProcessingHook } from './AudioProcessingHook';
import { VocabularyLibraryManager } from './VocabularyLibraryManager';
import { WordGroupsCenter } from './WordGroupsCenter';
import { LearningStatsCenter } from './LearningStatsCenter';
import { LanguagesCenter } from './LanguagesCenter';
import { QuizHistoryCenter } from './QuizHistoryCenter';
import { ReadingProgressCenter } from './ReadingProgressCenter';
import { StorageCenter } from './StorageCenter';

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

    // Initialize asynchronously (from storage - no auth required)
    const syncInitPromises = [
      QuizHistoryCenter.initialize(),
      ReadingProgressCenter.initialize(),
    ];
    await Promise.all(syncInitPromises);

    // Check if user is authenticated
    const isAuthenticated = await StorageCenter.auth.hasToken();

    // Initialize asynchronously
    const initPromises: Promise<void>[] = [
      LanguagesCenter.initialize(), // Public API, no auth required
    ];

    // Only initialize auth-required centers if user is logged in
    if (isAuthenticated) {
      console.log('[GlobalInitializer] User authenticated, initializing auth-required centers...');
      initPromises.push(
        WordGroupsCenter.initialize(), // Requires auth - query_all_groups
        LearningStatsCenter.initialize(), // Requires auth - user stats
      );
    } else {
      console.log('[GlobalInitializer] User not authenticated, skipping auth-required centers');
    }

    await Promise.all(initPromises);

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
