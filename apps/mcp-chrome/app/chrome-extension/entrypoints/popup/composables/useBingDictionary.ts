/**
 * Bing Dictionary Composable
 * Handles word lookup and history management (under 200 lines)
 */

import { ref } from 'vue';

export interface Translation {
  type: string;
  text: string;
}

export interface Example {
  text: string;
  translation?: string;
}

export interface WordResult {
  word: string;
  phonetic?: string;
  pronunciation?: string;
  translations: Translation[];
  examples: Example[];
  synonyms: string[];
}

export interface HistoryItem {
  word: string;
  timestamp: number;
}

export function useBingDictionary() {
  const searchQuery = ref('');
  const isLoading = ref(false);
  const error = ref('');
  const currentResult = ref<WordResult | null>(null);
  const history = ref<HistoryItem[]>([]);

  const lookupWord = async (word?: string) => {
    const query = word || searchQuery.value.trim();

    if (!query) return;

    isLoading.value = true;
    error.value = '';
    currentResult.value = null;

    try {
      // Look the word up by scraping Bing dictionary LOCALLY (same path the
      // worker uses) rather than calling a backend endpoint. laravel_main does
      // not expose a dictionary lookup API — only the worker task queue — so the
      // extension owns single-word lookups itself.
      const response = await chrome.runtime.sendMessage({
        type: 'bing_dictionary_worker_service',
        action: 'test_scrape',
        words: [query],
        mode: 'worker',
      });

      if (!response || !response.success) {
        throw new Error((response && response.error) || 'Failed to lookup word');
      }

      const r = (response.results || [])[0];
      if (!r || !r.ok) {
        throw new Error(r?.invalid ? 'No Bing dictionary entry for this word' : r?.error || 'No result');
      }

      currentResult.value = {
        word: r.word || query,
        phonetic: r.phonetic || undefined,
        pronunciation: r.audioUrl || undefined,
        translations: r.translation ? [{ type: '', text: r.translation }] : [],
        examples: [],
        synonyms: [],
      };

      addToHistory(query);

      if (!word) {
        searchQuery.value = '';
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to lookup word';
      console.error('[Bing Dictionary] Lookup failed:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const playPronunciation = () => {
    if (!currentResult.value?.pronunciation) return;

    const audio = new Audio(currentResult.value.pronunciation);
    audio.play().catch(err => {
      console.error('[Bing Dictionary] Failed to play audio:', err);
    });
  };

  const addToHistory = (word: string) => {
    const existing = history.value.findIndex(item => item.word === word);

    if (existing !== -1) {
      history.value.splice(existing, 1);
    }

    history.value.unshift({
      word,
      timestamp: Date.now(),
    });

    if (history.value.length > 10) {
      history.value = history.value.slice(0, 10);
    }

    saveHistory();
  };

  const clearHistory = async () => {
    history.value = [];
    await chrome.storage.local.remove('bing_dictionary_history');
  };

  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
  };

  const saveHistory = async () => {
    try {
      await chrome.storage.local.set({ bing_dictionary_history: history.value });
    } catch (err) {
      console.error('[Bing Dictionary] Failed to save history:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const result = await chrome.storage.local.get('bing_dictionary_history');
      if (result.bing_dictionary_history) {
        history.value = result.bing_dictionary_history;
      }
    } catch (err) {
      console.error('[Bing Dictionary] Failed to load history:', err);
    }
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
