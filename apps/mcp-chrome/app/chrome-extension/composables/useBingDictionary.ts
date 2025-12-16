import { ref, Ref } from 'vue';
import { ApiManager } from '@/services/ApiManager';

export interface BingDictionaryResult {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  definitions?: Array<{
    pos: string;
    meanings: string[];
  }>;
  translations?: string[];
  examples?: string[];
  synonyms?: string[];
  timestamp: number;
}

export interface HistoryItem extends BingDictionaryResult {}

export function useBingDictionary() {
  const searchQuery = ref('');
  const isLoading = ref(false);
  const error = ref('');
  const currentResult: Ref<BingDictionaryResult | null> = ref(null);
  const history: Ref<HistoryItem[]> = ref([]);

  /**
   * Load search history from storage
   */
  const loadHistory = async () => {
    try {
      const result = await chrome.storage.local.get(['bingDictionaryHistory']);
      if (result.bingDictionaryHistory) {
        history.value = result.bingDictionaryHistory;
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  /**
   * Save history to storage
   */
  const saveHistory = async () => {
    try {
      await chrome.storage.local.set({
        bingDictionaryHistory: history.value.slice(0, 50), // Keep last 50 items
      });
    } catch (err) {
      console.error('Failed to save history:', err);
    }
  };

  /**
   * Lookup a word using Bing Dictionary
   */
  const lookupWord = async (word?: string) => {
    const query = word || searchQuery.value.trim();
    if (!query) {
      error.value = 'Please enter a word to lookup';
      return;
    }

    isLoading.value = true;
    error.value = '';

    try {
      const baseUrl = await ApiManager.getCurrentBaseUrl();
      const response = await fetch(`${baseUrl}/api/dictionary/bing?word=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const result: BingDictionaryResult = {
        word: query,
        phonetic: data.phonetic,
        audioUrl: data.audioUrl,
        definitions: data.definitions,
        translations: data.translations,
        examples: data.examples,
        synonyms: data.synonyms,
        timestamp: Date.now(),
      };

      currentResult.value = result;

      // Add to history (avoid duplicates)
      history.value = [
        result,
        ...history.value.filter((item) => item.word.toLowerCase() !== query.toLowerCase()),
      ];

      await saveHistory();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to lookup word';
      console.error('Lookup error:', err);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Play pronunciation audio
   */
  const playPronunciation = () => {
    if (currentResult.value?.audioUrl) {
      const audio = new Audio(currentResult.value.audioUrl);
      audio.play().catch((err) => {
        console.error('Failed to play audio:', err);
        error.value = 'Failed to play pronunciation';
      });
    }
  };

  /**
   * Clear all history
   */
  const clearHistory = async () => {
    history.value = [];
    currentResult.value = null;
    await chrome.storage.local.remove(['bingDictionaryHistory']);
  };

  /**
   * Format timestamp
   */
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return {
    searchQuery,
    isLoading,
    error,
    currentResult,
    history,
    lookupWord,
    playPronunciation,
    clearHistory,
    formatTime,
    loadHistory,
  };
}
